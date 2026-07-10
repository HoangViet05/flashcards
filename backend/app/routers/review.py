from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.card import Card
from app.models.review import Review
from app.schemas.review import ReviewSubmit, ReviewOut, StatsOut
from app.services.sm2 import compute_sm2

router = APIRouter(prefix="/api/review", tags=["review"])


@router.get("/due", response_model=list[ReviewOut])
def get_due_cards(db: Session = Depends(get_db)):
    today = date.today()
    return db.query(Review).filter(Review.due_date <= today).all()


@router.post("/{card_id}", response_model=ReviewOut)
def submit_review(card_id: str, body: ReviewSubmit, db: Session = Depends(get_db)):
    if body.quality < 0 or body.quality > 5:
        raise HTTPException(status_code=400, detail="Quality must be 0-5")
    if body.auto_quality is not None and (body.auto_quality < 0 or body.auto_quality > 5):
        raise HTTPException(status_code=400, detail="Auto quality must be 0-5")
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
    db.commit()
    db.refresh(review)
    return review


@router.get("/stats", response_model=StatsOut)
def get_stats(db: Session = Depends(get_db)):
    today = date.today()
    total_cards = db.query(Review).count()
    total_reviewed_today = db.query(Review).filter(
        Review.reviewed_at >= datetime.combine(today, datetime.min.time())
    ).count()
    due_today = db.query(Review).filter(Review.due_date <= today, Review.repetitions > 0).count()
    new_cards = db.query(Review).filter(Review.due_date <= today, Review.repetitions == 0).count()

    due_upcoming = {}
    for i in range(1, 8):
        d = today + timedelta(days=i)
        count = db.query(Review).filter(Review.due_date == d).count()
        due_upcoming[d.isoformat()] = count

    # Simple streak: count consecutive days with at least 1 review
    streak = 0
    check_date = today
    while True:
        start = datetime.combine(check_date, datetime.min.time())
        end = datetime.combine(check_date + timedelta(days=1), datetime.min.time())
        count = db.query(Review).filter(
            Review.reviewed_at >= start,
            Review.reviewed_at < end
        ).count()
        if count == 0:
            break
        streak += 1
        check_date -= timedelta(days=1)

    return StatsOut(
        streak=streak,
        total_cards=total_cards,
        total_reviewed_today=total_reviewed_today,
        due_today=due_today,
        new_cards=new_cards,
        due_upcoming=due_upcoming,
    )
