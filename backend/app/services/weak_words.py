import random
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.card import Card
from app.models.daily_session import DailySession, DailySessionWord
from app.models.deck import Deck
from app.models.review_log import ReviewLog

WEAK_WINDOW = 5
WEAK_MIN_WRONG = 2
WEAK_QUALITY = 2
STEPS = ("dictation", "vi_en", "en_vi")


@dataclass
class WeakWord:
    card_id: str
    recent_wrong: int
    total_reviews: int
    last_step: str | None
    suggested_step: str


def _recent_logs(db: Session, card_id: str) -> list[ReviewLog]:
    return (
        db.query(ReviewLog)
        .filter(ReviewLog.card_id == card_id)
        .order_by(ReviewLog.reviewed_at.desc(), ReviewLog.id.desc())
        .limit(WEAK_WINDOW)
        .all()
    )


def _wrong_in_window(logs: list[ReviewLog]) -> int:
    return sum(log.quality <= WEAK_QUALITY for log in logs)


def last_step(db: Session, card_id: str) -> str | None:
    row = (
        db.query(DailySessionWord)
        .join(DailySession, DailySessionWord.session_id == DailySession.id)
        .filter(DailySessionWord.card_id == card_id)
        .order_by(DailySession.session_date.desc(), DailySession.created_at.desc())
        .first()
    )
    return row.assigned_step if row else None


def suggested_step(
    db: Session, card_id: str, rng: random.Random | None = None
) -> str:
    previous = last_step(db, card_id)
    options = [step for step in STEPS if step != previous] or list(STEPS)
    return (rng or random.Random()).choice(options)


def is_weak(db: Session, card_id: str) -> bool:
    return _wrong_in_window(_recent_logs(db, card_id)) >= WEAK_MIN_WRONG


def weak_words(
    db: Session, user_id: str, rng: random.Random | None = None
) -> list[WeakWord]:
    card_ids = [
        card_id
        for (card_id,) in (
            db.query(Card.id)
            .join(Deck, Card.deck_id == Deck.id)
            .filter(Deck.user_id == user_id)
            .all()
        )
    ]
    found: list[WeakWord] = []
    for card_id in card_ids:
        logs = _recent_logs(db, card_id)
        recent_wrong = _wrong_in_window(logs)
        if recent_wrong < WEAK_MIN_WRONG:
            continue
        found.append(
            WeakWord(
                card_id=card_id,
                recent_wrong=recent_wrong,
                total_reviews=db.query(ReviewLog)
                .filter(ReviewLog.card_id == card_id)
                .count(),
                last_step=last_step(db, card_id),
                suggested_step=suggested_step(db, card_id, rng),
            )
        )
    return sorted(found, key=lambda item: item.recent_wrong, reverse=True)


def weak_card_ids(db: Session, user_id: str) -> set[str]:
    return {item.card_id for item in weak_words(db, user_id)}
