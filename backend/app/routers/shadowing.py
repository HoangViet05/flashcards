from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.article import Article
from app.models.card import Card
from app.models.deck import Deck
from app.models.review import Review
from app.models.shadow_video import ShadowVideo
from app.models.shadowing_attempt import ShadowingAttempt
from app.models.user import User
from app.routers.cards import get_owned_card
from app.routers.decks import get_owned_deck
from app.schemas.shadowing import (ShadowAttemptCreate, ShadowAttemptOut, ShadowCardOut, ShadowingDayStat, ShadowingStatsOut, ShadowVideoCreate, ShadowVideoListItem, ShadowVideoOut)
from app.services.security import get_current_user

router = APIRouter(prefix="/api/shadowing", tags=["shadowing"])


@router.get("/cards", response_model=list[ShadowCardOut])
def get_shadow_cards(deck_id: str | None = None, card_id: str | None = None, due_only: bool = False, limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    query = db.query(Card).join(Deck, Card.deck_id == Deck.id).filter(Deck.user_id == user.id, Card.example_sentence.isnot(None), Card.example_sentence != "", Card.example_audio_url.isnot(None), Card.example_audio_url != "")
    if card_id:
        query = query.filter(Card.id == card_id)
    if deck_id:
        get_owned_deck(deck_id, db, user)
        query = query.filter(Card.deck_id == deck_id)
    if due_only:
        query = query.join(Review, Review.card_id == Card.id).filter(Review.due_date <= date.today())
    return query.order_by(Card.created_at).limit(limit).all()


def _get_owned_video(video_id: str, db: Session, user: User) -> ShadowVideo:
    video = db.query(ShadowVideo).filter(ShadowVideo.id == video_id, ShadowVideo.user_id == user.id).first()
    if not video:
        raise HTTPException(404, "Video not found")
    return video


def _video_out(video: ShadowVideo) -> dict:
    return {"id": video.id, "youtube_id": video.youtube_id, "title": video.title, "duration_s": video.duration_s, "segment_count": len(video.segments), "created_at": video.created_at, "segments": video.segments}


@router.post("/videos", response_model=ShadowVideoOut, status_code=201)
def create_video(body: ShadowVideoCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    video = db.query(ShadowVideo).filter(ShadowVideo.user_id == user.id, ShadowVideo.youtube_id == body.youtube_id).first()
    segments = [segment.model_dump() for segment in body.segments]
    if video:
        video.title, video.duration_s, video.segments, video.updated_at = body.title, body.duration_s, segments, datetime.utcnow()
    else:
        video = ShadowVideo(user_id=user.id, youtube_id=body.youtube_id, title=body.title, duration_s=body.duration_s, segments=segments)
        db.add(video)
    db.commit(); db.refresh(video)
    return _video_out(video)


@router.get("/videos", response_model=list[ShadowVideoListItem])
def list_videos(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [_video_out(video) for video in db.query(ShadowVideo).filter(ShadowVideo.user_id == user.id).order_by(ShadowVideo.created_at.desc()).all()]


@router.get("/videos/{video_id}", response_model=ShadowVideoOut)
def get_video(video_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _video_out(_get_owned_video(video_id, db, user))


@router.delete("/videos/{video_id}", status_code=204)
def delete_video(video_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.delete(_get_owned_video(video_id, db, user)); db.commit()
    return Response(status_code=204)


@router.post("/attempts", response_model=ShadowAttemptOut, status_code=201)
def create_attempt(body: ShadowAttemptCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if body.source_type == "card":
        if not body.card_id: raise HTTPException(400, "card_id là bắt buộc với source_type=card")
        get_owned_card(body.card_id, db, user)
    elif body.source_type == "article":
        if not body.article_id: raise HTTPException(400, "article_id là bắt buộc với source_type=article")
        if not db.query(Article).filter(Article.id == body.article_id, Article.user_id == user.id).first(): raise HTTPException(404, "Article not found")
    else:
        if not body.video_id: raise HTTPException(400, "video_id là bắt buộc với source_type=youtube")
        _get_owned_video(body.video_id, db, user)
    attempt = ShadowingAttempt(user_id=user.id, **body.model_dump(exclude={"word_results"}), word_results=[item.model_dump() for item in body.word_results])
    db.add(attempt); db.commit(); db.refresh(attempt)
    return attempt


@router.get("/stats", response_model=ShadowingStatsOut)
def get_shadowing_stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    today = date.today(); since = datetime.combine(today - timedelta(days=6), datetime.min.time())
    total = db.query(func.count(ShadowingAttempt.id)).filter(ShadowingAttempt.user_id == user.id).scalar() or 0
    rows = db.query(func.date(ShadowingAttempt.created_at), func.count(ShadowingAttempt.id), func.avg(ShadowingAttempt.score)).filter(ShadowingAttempt.user_id == user.id, ShadowingAttempt.created_at >= since).group_by(func.date(ShadowingAttempt.created_at)).all()
    by_date = {str(day): (int(count), float(avg)) for day, count, avg in rows}
    by_day = [ShadowingDayStat(date=(today - timedelta(days=offset)).isoformat(), count=by_date.get((today - timedelta(days=offset)).isoformat(), (0, None))[0], avg_score=round(by_date.get((today - timedelta(days=offset)).isoformat(), (0, None))[1], 1) if by_date.get((today - timedelta(days=offset)).isoformat(), (0, None))[1] is not None else None) for offset in range(6, -1, -1)]
    count = sum(day.count for day in by_day)
    weighted = sum(day.count * day.avg_score for day in by_day if day.avg_score is not None)
    return ShadowingStatsOut(total_attempts=int(total), attempts_7d=count, avg_score_7d=round(weighted / count, 1) if count else None, by_day=by_day)
