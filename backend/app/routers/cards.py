from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.card import Card
from app.models.deck import Deck
from app.models.review import Review
from app.models.user import User
from app.routers.decks import get_owned_deck
from app.schemas.card import CardCreate, CardOut, CardUpdate
from app.services.security import get_current_user

router = APIRouter(tags=["cards"])


def get_owned_card(card_id: str, db: Session, user: User) -> Card:
    card = (
        db.query(Card)
        .join(Deck, Card.deck_id == Deck.id)
        .filter(Card.id == card_id, Deck.user_id == user.id)
        .first()
    )
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


@router.get("/api/decks/{deck_id}/cards", response_model=list[CardOut])
def list_cards(
    deck_id: str,
    response: Response,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    get_owned_deck(deck_id, db, user)
    base = db.query(Card).filter(Card.deck_id == deck_id)
    response.headers["X-Total-Count"] = str(base.count())
    return base.order_by(Card.created_at.asc(), Card.id.asc()).offset(offset).limit(limit).all()


@router.post("/api/decks/{deck_id}/cards", response_model=CardOut)
def create_card(
    deck_id: str,
    body: CardCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    get_owned_deck(deck_id, db, user)
    existing = (
        db.query(Card)
        .filter(Card.deck_id == deck_id, Card.front_text == body.front_text.strip())
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Thẻ này đã tồn tại trong bộ bài!")

    card = Card(deck_id=deck_id, **body.model_dump())
    db.add(card)
    db.flush()
    db.add(Review(card_id=card.id, due_date=date.today()))
    db.commit()
    db.refresh(card)
    return card


@router.put("/api/cards/{card_id}", response_model=CardOut)
def update_card(
    card_id: str,
    body: CardUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    card = get_owned_card(card_id, db, user)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(card, field, value)
    db.commit()
    db.refresh(card)
    return card


@router.delete("/api/cards/{card_id}", response_model=CardOut)
def delete_card(
    card_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    card = get_owned_card(card_id, db, user)
    db.delete(card)
    db.commit()
    return card
