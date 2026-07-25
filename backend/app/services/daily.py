import random
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.article import Article
from app.models.card import Card
from app.models.deck import Deck
from app.models.review import Review
from app.models.review_log import ReviewLog

NEW_WORDS_PER_DAY = 10
GAME_REVIEW_WORDS_MAX = 5
GAME_REVIEW_ONLY_MAX = 15
LOW_NEW_WORDS_THRESHOLD = 30
STEPS_REVIEW = ("dictation", "vi_en", "en_vi")


@dataclass
class LatestArticleData:
    id: str
    title: str
    unlearned_saved_words: int


@dataclass
class HomeCounters:
    streak: int
    mastered_cards: int
    total_cards: int
    deck_count: int
    studied_today: bool
    latest_article: LatestArticleData | None


def home_counters(db: Session, user_id: str) -> HomeCounters:
    total_cards = (
        db.query(func.count(Card.id)).join(Deck, Card.deck_id == Deck.id)
        .filter(Deck.user_id == user_id).scalar() or 0
    )
    deck_count = db.query(func.count(Deck.id)).filter(Deck.user_id == user_id).scalar() or 0
    mastered_cards = (
        db.query(func.count(Review.id))
        .join(Card, Review.card_id == Card.id).join(Deck, Card.deck_id == Deck.id)
        .filter(Deck.user_id == user_id, Review.repetitions >= 3).scalar() or 0
    )

    today = date.today()
    since = datetime.combine(today - timedelta(days=400), datetime.min.time())
    day_rows = (
        db.query(func.date(ReviewLog.reviewed_at), func.count(ReviewLog.id))
        .filter(ReviewLog.user_id == user_id, ReviewLog.reviewed_at >= since)
        .group_by(func.date(ReviewLog.reviewed_at)).all()
    )
    counts_by_day = {str(day): int(count) for day, count in day_rows}
    streak, check = 0, today
    while counts_by_day.get(check.isoformat(), 0) > 0:
        streak += 1
        check -= timedelta(days=1)

    article = (
        db.query(Article).filter(Article.user_id == user_id)
        .order_by(Article.created_at.desc()).first()
    )
    latest = None
    if article is not None:
        unlearned = 0
        if article.deck_id:
            unlearned = (
                db.query(func.count(Card.id))
                .outerjoin(Review, Review.card_id == Card.id)
                .filter(
                    Card.deck_id == article.deck_id,
                    (Review.id.is_(None)) | (Review.repetitions == 0),
                )
                .scalar() or 0
            )
        latest = LatestArticleData(
            id=article.id, title=article.title, unlearned_saved_words=int(unlearned)
        )

    return HomeCounters(
        streak=streak, mastered_cards=int(mastered_cards), total_cards=int(total_cards),
        deck_count=int(deck_count), studied_today=counts_by_day.get(today.isoformat(), 0) > 0,
        latest_article=latest,
    )


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
