from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.card import Card
from app.models.deck import Deck
from app.models.review import Review
from app.schemas.card import CardCreate, CardUpdate, CardOut

router = APIRouter(tags=["cards"])


@router.get("/api/decks/{deck_id}/cards", response_model=list[CardOut])
def list_cards(deck_id: str, db: Session = Depends(get_db)):
    deck = db.query(Deck).filter(Deck.id == deck_id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    return db.query(Card).filter(Card.deck_id == deck_id).all()


@router.post("/api/decks/{deck_id}/cards", response_model=CardOut)
def create_card(deck_id: str, body: CardCreate, db: Session = Depends(get_db)):
    deck = db.query(Deck).filter(Deck.id == deck_id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    
    # Kiểm tra trùng lặp
    existing = db.query(Card).filter(
        Card.deck_id == deck_id, 
        Card.front_text == body.front_text.strip()
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Thẻ này đã tồn tại trong bộ bài!")

    card = Card(deck_id=deck_id, **body.model_dump())
    db.add(card)
    db.flush()
    review = Review(card_id=card.id, due_date=date.today())
    db.add(review)
    db.commit()
    db.refresh(card)
    return card


@router.put("/api/cards/{card_id}", response_model=CardOut)
def update_card(card_id: str, body: CardUpdate, db: Session = Depends(get_db)):
    card = db.query(Card).filter(Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(card, field, value)
    db.commit()
    db.refresh(card)
    return card


@router.delete("/api/cards/{card_id}", response_model=CardOut)
def delete_card(card_id: str, db: Session = Depends(get_db)):
    card = db.query(Card).filter(Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    db.delete(card)
    db.commit()
    return card
