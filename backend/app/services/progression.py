from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.learning_event import LearningEvent
from app.models.skill_progress import SkillProgress
from app.models.review import Review
from app.models.review_log import ReviewLog
from app.models.card import Card
from app.models.deck import Deck
from app.models.user_preference import UserPreference
from app.models.user_unlock import UserUnlock

SKILLS = ("vocabulary", "reading", "listening", "speaking")
SESSION_CAPS = {"full": 80, "quick": 30, "reading": 80, "speaking": 60}
DEFAULT_TZ = "Asia/Ho_Chi_Minh"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def user_timezone(db: Session, user_id: str) -> ZoneInfo:
    """Every day boundary must follow the learner's timezone.

    Bucketing by UTC put a 00:00–07:00 Vietnam session on the previous day,
    which silently corrupted the streak, the heatmap and the active-day count.
    """
    name = db.query(UserPreference.timezone).filter(UserPreference.user_id == user_id).scalar()
    try:
        return ZoneInfo(name or DEFAULT_TZ)
    except Exception:
        return ZoneInfo(DEFAULT_TZ)


def today_local(tz: ZoneInfo) -> date:
    return datetime.now(tz).date()


def local_date(moment: datetime, tz: ZoneInfo) -> date:
    aware = moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)
    return aware.astimezone(tz).date()


def local_day_bounds(day: date, tz: ZoneInfo) -> tuple[datetime, datetime]:
    """UTC [start, end) of one local day, usable directly in a WHERE clause
    against columns that store UTC."""
    start = datetime.combine(day, datetime.min.time(), tzinfo=tz)
    return start.astimezone(timezone.utc), (start + timedelta(days=1)).astimezone(timezone.utc)


def level_for_xp(xp: int) -> int:
    level = 1
    while 100 * (level + 1) * level // 2 <= xp:
        level += 1
    return level


def xp_for_event(event_type: str, metric_value: int | None) -> int:
    if event_type == "answer_correct": return 4
    if event_type == "answer_corrected": return 1
    if event_type == "reading_complete": return 20 + min(15, max(5, metric_value or 5))
    if event_type == "shadowing_scored": return 5 + min(5, max(0, (metric_value or 0) // 20))
    if event_type == "shadowing_offline": return 4
    return 0


def cap_key(event: LearningEvent) -> tuple[str, date] | None:
    if event.source_type in {"full", "quick"}: return event.source_type, event.occurred_at.date()
    if event.event_type == "reading_complete": return "reading", event.occurred_at.date()
    if event.event_type.startswith("shadowing"): return "speaking", event.occurred_at.date()
    return None


def awarded_xp_with_cap(db: Session, event: LearningEvent, proposed: int) -> int:
    key = cap_key(event)
    if key is None: return proposed
    group, day = key
    start = datetime.combine(day, datetime.min.time(), tzinfo=timezone.utc)
    end = start + timedelta(days=1)
    used = db.query(func.coalesce(func.sum(LearningEvent.payload["xp"].as_integer()), 0)).filter(
        LearningEvent.user_id == event.user_id, LearningEvent.occurred_at >= start, LearningEvent.occurred_at < end
    ).scalar() or 0
    return max(0, min(proposed, SESSION_CAPS[group] - int(used)))


def apply_event(db: Session, user_id: str, data) -> tuple[LearningEvent, int, bool]:
    existing = db.query(LearningEvent).filter(LearningEvent.user_id == user_id, LearningEvent.idempotency_key == data.idempotency_key).first()
    if existing is not None:
        return existing, int((existing.payload or {}).get("xp", 0)), True
    occurred_at = data.occurred_at or utcnow()
    if occurred_at.tzinfo is None:
        occurred_at = occurred_at.replace(tzinfo=timezone.utc)
    event = LearningEvent(user_id=user_id, event_type=data.event_type, skill=data.skill, source_type=data.source_type,
        source_id=data.source_id, idempotency_key=data.idempotency_key, duration_seconds=min(data.duration_seconds, 300),
        metric_value=data.metric_value, payload=dict(data.payload), occurred_at=occurred_at)
    proposed = xp_for_event(data.event_type, data.metric_value)
    awarded = awarded_xp_with_cap(db, event, proposed)
    event.payload = {**event.payload, "xp": awarded}
    db.add(event)
    progress = db.query(SkillProgress).filter(SkillProgress.user_id == user_id, SkillProgress.skill == data.skill).first()
    if progress is None:
        progress = SkillProgress(user_id=user_id, skill=data.skill, xp=0)
        db.add(progress)
    progress.xp += awarded
    return event, awarded, False


def ensure_skill_rows(db: Session, user_id: str) -> list[SkillProgress]:
    current = {item.skill: item for item in db.query(SkillProgress).filter(SkillProgress.user_id == user_id).all()}
    for skill in SKILLS:
        if skill not in current:
            current[skill] = SkillProgress(user_id=user_id, skill=skill, xp=0)
            db.add(current[skill])
    db.flush()
    return [current[skill] for skill in SKILLS]


def calendar_data(db: Session, user_id: str, days: int) -> list[dict]:
    """`active` must use the same definition the streak uses (learning events
    union review logs). If the two drift the dashboard contradicts itself."""
    tz = user_timezone(db, user_id)
    today = today_local(tz)
    window_start = today - timedelta(days=days - 1)
    since, _ = local_day_bounds(window_start, tz)

    buckets = {(window_start + timedelta(days=offset)).isoformat(): {"seconds": 0, "reviews": 0} for offset in range(days)}

    for moment, seconds in db.query(LearningEvent.occurred_at, LearningEvent.duration_seconds).filter(
        LearningEvent.user_id == user_id, LearningEvent.occurred_at >= since
    ).all():
        bucket = buckets.get(local_date(moment, tz).isoformat())
        if bucket is not None:
            bucket["seconds"] += int(seconds or 0)

    for (moment,) in db.query(ReviewLog.reviewed_at).filter(
        ReviewLog.user_id == user_id, ReviewLog.reviewed_at >= since
    ).all():
        bucket = buckets.get(local_date(moment, tz).isoformat())
        if bucket is not None:
            bucket["reviews"] += 1

    return [
        {"date": day, "seconds": value["seconds"], "reviews": value["reviews"],
         "active": value["seconds"] > 0 or value["reviews"] > 0}
        for day, value in sorted(buckets.items())
    ]


def overview_data(db: Session, user_id: str) -> dict:
    tz = user_timezone(db, user_id)
    now = utcnow()
    today = today_local(tz)
    # The chart is a calendar view, so its data window must be calendar based
    # too.  A rolling 30 x 24-hour query used to omit the first days and left
    # the UI with only the dates that happened to have events.
    window_start = today - timedelta(days=27)
    since, _ = local_day_bounds(window_start, tz)
    rows = ensure_skill_rows(db, user_id)
    event_rows = db.query(LearningEvent.skill, func.count(LearningEvent.id), func.avg(LearningEvent.metric_value)).filter(
        LearningEvent.user_id == user_id, LearningEvent.occurred_at >= since
    ).group_by(LearningEvent.skill).all()
    samples = {skill: (int(count), avg) for skill, count, avg in event_rows}
    skills = []
    for row in rows:
        count, average = samples.get(row.skill, (0, None))
        mastery = None if count < 3 else max(0, min(100, round(float(average if average is not None else 70))))
        skills.append({"skill": row.skill, "xp": row.xp, "level": level_for_xp(row.xp), "mastery": mastery, "building_signal": mastery is None})
    week_start, _ = local_day_bounds(today - timedelta(days=today.weekday()), tz)
    day_start, day_end = local_day_bounds(today, tz)
    duration_today = db.query(func.coalesce(func.sum(LearningEvent.duration_seconds), 0)).filter(LearningEvent.user_id == user_id, LearningEvent.occurred_at >= day_start, LearningEvent.occurred_at < day_end).scalar() or 0
    duration_week = db.query(func.coalesce(func.sum(LearningEvent.duration_seconds), 0)).filter(LearningEvent.user_id == user_id, LearningEvent.occurred_at >= week_start).scalar() or 0
    remembered = db.query(func.count(Review.id)).join(Card).join(Deck).filter(Deck.user_id == user_id, Review.repetitions >= 3).scalar() or 0
    logs = db.query(ReviewLog).filter(ReviewLog.user_id == user_id, ReviewLog.reviewed_at >= since).all()
    retention = None if len(logs) < 3 else round(100 * sum(log.quality >= 3 for log in logs) / len(logs))
    total_cards = db.query(func.count(Card.id)).join(Deck).filter(Deck.user_id == user_id).scalar() or 0
    learning_cards = db.query(func.count(Review.id)).join(Card).join(Deck).filter(Deck.user_id == user_id, Review.repetitions.between(1, 2)).scalar() or 0
    due_cards = db.query(func.count(Review.id)).join(Card).join(Deck).filter(Deck.user_id == user_id, Review.repetitions > 0, Review.due_date <= today).scalar() or 0
    deck_count = db.query(func.count(Deck.id)).filter(Deck.user_id == user_id).scalar() or 0
    reviews_today = db.query(func.count(ReviewLog.id)).filter(ReviewLog.user_id == user_id, ReviewLog.reviewed_at >= day_start, ReviewLog.reviewed_at < day_end).scalar() or 0
    reviews_week = db.query(func.count(ReviewLog.id)).filter(ReviewLog.user_id == user_id, ReviewLog.reviewed_at >= week_start).scalar() or 0
    reviews_total = db.query(func.count(ReviewLog.id)).filter(ReviewLog.user_id == user_id).scalar() or 0

    # Always return one cell per calendar day.  A zero means no focused-time
    # was recorded; it is intentionally distinct from a score or retention.
    # Bucketing happens in Python, not in SQL: SQLite's date() knows nothing
    # about the learner's timezone, so func.date() would reopen the same bug.
    heatmap = {(window_start + timedelta(days=offset)).isoformat(): 0 for offset in range(28)}
    for moment, seconds in db.query(LearningEvent.occurred_at, LearningEvent.duration_seconds).filter(
        LearningEvent.user_id == user_id, LearningEvent.occurred_at >= since
    ).all():
        day = local_date(moment, tz).isoformat()
        if day in heatmap:
            heatmap[day] += int(seconds or 0)

    event_days = {local_date(moment, tz).isoformat() for (moment,) in db.query(LearningEvent.occurred_at).filter(
        LearningEvent.user_id == user_id, LearningEvent.occurred_at >= since).all()}
    review_days = {local_date(moment, tz).isoformat() for (moment,) in db.query(ReviewLog.reviewed_at).filter(
        ReviewLog.user_id == user_id, ReviewLog.reviewed_at >= since).all()}
    active_days = event_days | review_days
    streak = 0; cursor = today.isoformat()
    while cursor in active_days:
        streak += 1
        cursor = (date.fromisoformat(cursor) - timedelta(days=1)).isoformat()
    total_xp = sum(item["xp"] for item in skills)
    return {"server_time": now, "effective_date": today.isoformat(), "streak": streak,
            "total_xp": total_xp, "level": level_for_xp(total_xp), "study_minutes_today": int(duration_today) // 60,
            "study_minutes_week": int(duration_week) // 60, "remembered_cards": int(remembered), "retention": retention, "retention_samples": len(logs),
            "reviews_today": int(reviews_today), "reviews_week": int(reviews_week), "reviews_total": int(reviews_total),
            "total_cards": int(total_cards), "learning_cards": int(learning_cards), "due_cards": int(due_cards), "deck_count": int(deck_count), "active_days_28": len(active_days),
            "skills": skills, "heatmap": heatmap, "unlocks": [item.unlock_key for item in db.query(UserUnlock).filter(UserUnlock.user_id == user_id).all()]}
