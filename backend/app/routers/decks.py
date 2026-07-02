from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.deck import Deck
from app.schemas.deck import DeckCreate, DeckUpdate, DeckOut

router = APIRouter(prefix="/api/decks", tags=["decks"])


@router.get("", response_model=list[DeckOut])
def list_decks(db: Session = Depends(get_db)):
    return db.query(Deck).order_by(Deck.name.asc()).all()


@router.post("", response_model=DeckOut)
def create_deck(body: DeckCreate, db: Session = Depends(get_db)):
    deck = Deck(name=body.name, description=body.description)
    db.add(deck)
    db.commit()
    db.refresh(deck)
    return deck


@router.get("/{deck_id}", response_model=DeckOut)
def get_deck(deck_id: str, db: Session = Depends(get_db)):
    deck = db.query(Deck).filter(Deck.id == deck_id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    return deck


@router.put("/{deck_id}", response_model=DeckOut)
def update_deck(deck_id: str, body: DeckUpdate, db: Session = Depends(get_db)):
    deck = db.query(Deck).filter(Deck.id == deck_id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(deck, field, value)
    db.commit()
    db.refresh(deck)
    return deck


@router.delete("/{deck_id}", response_model=DeckOut)
def delete_deck(deck_id: str, db: Session = Depends(get_db)):
    deck = db.query(Deck).filter(Deck.id == deck_id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    db.delete(deck)
    db.commit()
    return deck
