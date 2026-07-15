import re
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.card import Card
from app.models.deck import Deck
from app.models.review import Review
from app.models.user import User
from app.routers.decks import get_owned_deck
from app.schemas.card import CardOut
from app.services.security import get_current_user

router = APIRouter(prefix="/api/games", tags=["games"])
GAME_MODES = ("sentence", "cloze", "match")
CANDIDATE_POOL = 60


def _clean_front(front: str) -> str:
    match = re.match(r"[A-Za-z][A-Za-z\s'-]*", front or "")
    return (match.group(0) if match else front or "").strip().lower()


def _english_part(example: str) -> str:
    return re.sub(r"\s*\([^)]*\)\s*$", "", example or "").strip()


def is_eligible(card: Card, mode: str) -> bool:
    if mode == "sentence":
        return bool(card.example_sentence) and 3 <= len(_english_part(card.example_sentence).split()) <= 30
    if mode == "cloze":
        return bool(card.example_sentence) and bool(_clean_front(card.front_text)) and _clean_front(card.front_text) in _english_part(card.example_sentence).lower()
    if mode == "match":
        return bool(card.definition and card.definition.strip())
    return False


@router.get("/cards", response_model=list[CardOut])
def get_game_cards(mode: str = Query(...), deck_id: str | None = Query(default=None), limit: int = Query(default=10, ge=1, le=20), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if mode not in GAME_MODES:
        raise HTTPException(status_code=400, detail="mode phải là sentence | cloze | match")
    query = db.query(Card).join(Deck, Card.deck_id == Deck.id).filter(Deck.user_id == user.id).options(joinedload(Card.review))
    if deck_id:
        get_owned_deck(deck_id, db, user)
        query = query.filter(Card.deck_id == deck_id)
    else:
        query = query.join(Review, Review.card_id == Card.id).filter(Review.due_date <= date.today())
    return [card for card in query.order_by(func.random()).limit(CANDIDATE_POOL).all() if is_eligible(card, mode)][:limit]
