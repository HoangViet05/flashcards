import random
from datetime import date

from sqlalchemy.orm import Session

from app.models.card import Card
from app.models.deck import Deck
from app.models.review import Review

NEW_WORDS_PER_DAY = 10
GAME_REVIEW_WORDS_MAX = 5
GAME_REVIEW_ONLY_MAX = 15
LOW_NEW_WORDS_THRESHOLD = 30
STEPS_REVIEW = ("dictation", "vi_en", "en_vi")


def quality_for_wrong_count(wrong_count: int) -> int:
    return {0: 5, 1: 4, 2: 3}.get(wrong_count, 2)


def _new_cards_query(db: Session, user_id: str):
    return (db.query(Card).join(Review).join(Deck).filter(
        Deck.user_id == user_id, Review.repetitions == 0, Review.reviewed_at.is_(None)
    ))


def count_remaining_new(db: Session, user_id: str) -> int:
    return _new_cards_query(db, user_id).count()


def pick_new_cards(db: Session, user_id: str, limit: int = NEW_WORDS_PER_DAY, rng: random.Random | None = None) -> list[Card]:
    rng = rng or random.Random()
    picked: list[Card] = []
    for deck in db.query(Deck).filter(Deck.user_id == user_id).order_by(Deck.created_at.asc(), Deck.id.asc()).all():
        if len(picked) >= limit:
            break
        candidates = _new_cards_query(db, user_id).filter(Card.deck_id == deck.id).all()
        rng.shuffle(candidates)
        picked.extend(candidates[:limit - len(picked)])
    return picked


def due_review_cards(db: Session, user_id: str) -> list[Card]:
    return (db.query(Card).join(Review).join(Deck).filter(
        Deck.user_id == user_id, Review.due_date <= date.today(), Review.repetitions > 0
    ).all())
