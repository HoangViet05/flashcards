from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.article import Article
from app.models.card import Card
from app.models.deck import Deck
from app.models.review import Review
from app.models.review_log import ReviewLog
from app.models.user import User
from app.schemas.deck import DeckCreate, DeckOut, DeckUpdate
from app.services.security import get_current_user

router = APIRouter(prefix="/api/decks", tags=["decks"])


def deck_counts_query(db: Session, user_id: str, deck_id: str | None = None):
    """Return owned decks and their card/due/new counts in a single query."""
    today = date.today()
    query = (
        db.query(
            Deck,
            func.count(Card.id).label("card_count"),
            func.coalesce(
                func.sum(case(((Review.due_date <= today) & (Review.repetitions > 0), 1), else_=0)),
                0,
            ).label("due_count"),
            func.coalesce(
                func.sum(case(((Review.due_date <= today) & (Review.repetitions == 0), 1), else_=0)),
                0,
            ).label("new_count"),
        )
        .outerjoin(Card, Card.deck_id == Deck.id)
        .outerjoin(Review, Review.card_id == Card.id)
        .filter(Deck.user_id == user_id)
        .group_by(Deck.id)
        .order_by(Deck.name.asc())
    )
    if deck_id is not None:
        query = query.filter(Deck.id == deck_id)
    return query


def deck_to_out(row) -> DeckOut:
    deck, card_count, due_count, new_count = row
    return DeckOut(
        id=deck.id,
        name=deck.name,
        description=deck.description,
        created_at=deck.created_at,
        updated_at=deck.updated_at,
        card_count=int(card_count or 0),
        due_count=int(due_count or 0),
        new_count=int(new_count or 0),
    )


def get_owned_deck(deck_id: str, db: Session, user: User) -> Deck:
    deck = db.query(Deck).filter(Deck.id == deck_id, Deck.user_id == user.id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    return deck


@router.get("", response_model=list[DeckOut])
def list_decks(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [deck_to_out(row) for row in deck_counts_query(db, user.id).all()]


@router.post("", response_model=DeckOut)
def create_deck(
    body: DeckCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    deck = Deck(name=body.name, description=body.description, user_id=user.id)
    db.add(deck)
    db.commit()
    db.refresh(deck)
    return deck_to_out((deck, 0, 0, 0))


@router.get("/{deck_id}", response_model=DeckOut)
def get_deck(
    deck_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    row = deck_counts_query(db, user.id, deck_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Deck not found")
    return deck_to_out(row)


@router.put("/{deck_id}", response_model=DeckOut)
def update_deck(
    deck_id: str,
    body: DeckUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    deck = get_owned_deck(deck_id, db, user)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(deck, field, value)
    db.commit()
    return deck_to_out(deck_counts_query(db, user.id, deck_id).first())


@router.delete("/{deck_id}", response_model=DeckOut)
def delete_deck(
    deck_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    deck = get_owned_deck(deck_id, db, user)
    row = deck_counts_query(db, user.id, deck_id).first()
    out = deck_to_out(row)

    # Keep learning history when a deck is removed. New databases have
    # ``ON DELETE SET NULL`` on review_logs.card_id, but older SQLite files
    # may have been created before that foreign-key action existed.
    card_ids = db.query(Card.id).filter(Card.deck_id == deck.id)
    db.query(ReviewLog).filter(ReviewLog.card_id.in_(card_ids)).update(
        {ReviewLog.card_id: None}, synchronize_session=False
    )
    # The reading item remains available after deleting its paired deck.
    db.query(Article).filter(Article.deck_id == deck.id).update(
        {Article.deck_id: None}, synchronize_session=False
    )
    db.delete(deck)
    db.commit()
    return out
