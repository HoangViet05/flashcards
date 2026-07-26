from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.card import Card
from app.models.deck import Deck
from app.models.review import Review
from app.models.review_log import ReviewLog
from app.models.user import User
from app.routers.cards import get_owned_card
from app.schemas.card import CardOut
from app.schemas.review import (
    HeatmapDay, ReviewOut, ReviewSubmit, StatsOut, WeakAnswerIn, WeakWordOut,
)
from app.services.security import get_current_user
from app.services.sm2 import compute_sm2
from app.services import weak_words as weak_service

router = APIRouter(prefix="/api/review", tags=["review"])
WeakWordOut.model_rebuild(_types_namespace={"CardOut": CardOut})


@router.get("/due", response_model=list[ReviewOut])
def get_due_cards(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    today = date.today()
    return (
        db.query(Review)
        .join(Card, Review.card_id == Card.id)
        .join(Deck, Card.deck_id == Deck.id)
        .filter(Deck.user_id == user.id, Review.due_date <= today)
        .all()
    )


@router.get("/heatmap", response_model=list[HeatmapDay])
def get_heatmap(days: int = Query(default=365, ge=7, le=730), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    since = datetime.combine(date.today() - timedelta(days=days - 1), datetime.min.time())
    rows = (db.query(func.date(ReviewLog.reviewed_at), func.count(ReviewLog.id))
              .filter(ReviewLog.user_id == user.id, ReviewLog.reviewed_at >= since)
              .group_by(func.date(ReviewLog.reviewed_at)).order_by(func.date(ReviewLog.reviewed_at)).all())
    return [HeatmapDay(date=str(day), count=int(count)) for day, count in rows]


@router.get("/weak", response_model=list[WeakWordOut])
def get_weak_words(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    items = weak_service.weak_words(db, user.id)
    cards = {
        card.id: card
        for card in db.query(Card).filter(Card.id.in_([item.card_id for item in items])).all()
    } if items else {}
    return [
        WeakWordOut(
            card=CardOut.model_validate(cards[item.card_id]),
            recent_wrong=item.recent_wrong,
            total_reviews=item.total_reviews,
            last_step=item.last_step,
            suggested_step=item.suggested_step,
        )
        for item in items
        if item.card_id in cards
    ]


@router.post("/weak/{card_id}")
def answer_weak_word(
    card_id: str,
    body: WeakAnswerIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    card = get_owned_card(card_id, db, user)
    db.add(
        ReviewLog(
            user_id=user.id,
            card_id=card.id,
            quality=4 if body.correct else 2,
            rating_source="weak",
            reviewed_at=datetime.utcnow(),
        )
    )
    db.commit()
    return {"ok": True}


@router.post("/{card_id}", response_model=ReviewOut)
def submit_review(
    card_id: str,
    body: ReviewSubmit,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if body.quality < 0 or body.quality > 5:
        raise HTTPException(status_code=400, detail="Quality must be 0-5")
    if body.auto_quality is not None and (body.auto_quality < 0 or body.auto_quality > 5):
        raise HTTPException(status_code=400, detail="Auto quality must be 0-5")

    get_owned_card(card_id, db, user)
    review = db.query(Review).filter(Review.card_id == card_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")

    result = compute_sm2(
        ease_factor=review.ease_factor,
        interval=review.interval,
        repetitions=review.repetitions,
        quality=body.quality,
    )
    review.ease_factor = result["ease_factor"]
    review.interval = result["interval"]
    review.repetitions = result["repetitions"]
    review.due_date = date.today() + timedelta(days=result["interval"])
    review.last_quality = body.quality
    review.last_auto_quality = body.auto_quality
    review.last_rating_source = body.rating_source
    review.last_response_time_ms = body.response_time_ms
    review.last_flip_count = body.flip_count
    review.last_audio_play_count = body.audio_play_count
    review.last_answer_mode = body.answer_mode
    review.last_answer_correct = body.answer_correct
    review.last_attempt_count = body.attempt_count
    review.reviewed_at = datetime.utcnow()

    db.add(
        ReviewLog(
            user_id=user.id,
            card_id=card_id,
            quality=body.quality,
            rating_source=body.rating_source or "flip",
            response_time_ms=body.response_time_ms,
        )
    )
    db.commit()
    db.refresh(review)
    return review


@router.get("/stats", response_model=StatsOut)
def get_stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    today = date.today()

    totals = (
        db.query(
            func.count(Review.id),
            func.coalesce(
                func.sum(case(((Review.due_date <= today) & (Review.repetitions > 0), 1), else_=0)),
                0,
            ),
            func.coalesce(
                func.sum(case(((Review.due_date <= today) & (Review.repetitions == 0), 1), else_=0)),
                0,
            ),
            func.coalesce(func.sum(case((Review.repetitions >= 3, 1), else_=0)), 0),
        )
        .select_from(Review)
        .join(Card, Review.card_id == Card.id)
        .join(Deck, Card.deck_id == Deck.id)
        .filter(Deck.user_id == user.id)
        .one()
    )
    total_cards, due_today, new_cards, mastered_cards = (int(value) for value in totals)

    since = datetime.combine(today - timedelta(days=365), datetime.min.time())
    day_rows = (
        db.query(func.date(ReviewLog.reviewed_at), func.count(ReviewLog.id))
        .filter(ReviewLog.user_id == user.id, ReviewLog.reviewed_at >= since)
        .group_by(func.date(ReviewLog.reviewed_at))
        .all()
    )
    counts_by_day = {str(day): int(count) for day, count in day_rows}
    total_reviewed_today = counts_by_day.get(today.isoformat(), 0)

    streak = 0
    check = today
    while counts_by_day.get(check.isoformat(), 0) > 0:
        streak += 1
        check -= timedelta(days=1)

    upcoming_rows = (
        db.query(Review.due_date, func.count(Review.id))
        .join(Card, Review.card_id == Card.id)
        .join(Deck, Card.deck_id == Deck.id)
        .filter(
            Deck.user_id == user.id,
            Review.due_date > today,
            Review.due_date <= today + timedelta(days=7),
        )
        .group_by(Review.due_date)
        .all()
    )
    upcoming_counts = {
        due_date.isoformat() if hasattr(due_date, "isoformat") else str(due_date): int(count)
        for due_date, count in upcoming_rows
    }
    due_upcoming = {
        (today + timedelta(days=i)).isoformat(): upcoming_counts.get(
            (today + timedelta(days=i)).isoformat(), 0
        )
        for i in range(1, 8)
    }

    source_rows = (db.query(ReviewLog.rating_source, func.count(ReviewLog.id))
                     .filter(ReviewLog.user_id == user.id).group_by(ReviewLog.rating_source).all())
    reviews_by_source = {str(source): int(count) for source, count in source_rows}

    return StatsOut(
        streak=streak,
        total_cards=total_cards,
        total_reviewed_today=total_reviewed_today,
        due_today=due_today,
        new_cards=new_cards,
        due_upcoming=due_upcoming,
        mastered_cards=mastered_cards,
        total_reviews=sum(reviews_by_source.values()),
        reviews_by_source=reviews_by_source,
    )
