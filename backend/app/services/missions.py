import hashlib
import random
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.article import Article
from app.models.card import Card
from app.models.deck import Deck
from app.models.mission_assignment import MissionAssignment
from app.models.user_preference import UserPreference
from app.services.progression import ensure_skill_rows

TEMPLATES = (
    {"key": "study_answers", "skill": "vocabulary", "target": 8, "events": {"answer_correct", "answer_corrected"}, "requires": "cards"},
    {"key": "study_session", "skill": "vocabulary", "target": 1, "events": {"duration"}, "requires": "cards"},
    {"key": "reading_minutes", "skill": "reading", "target": 5, "events": {"duration", "reading_complete"}, "requires": "articles"},
    {"key": "read_complete", "skill": "reading", "target": 1, "events": {"reading_complete"}, "requires": "articles"},
    {"key": "listen_answers", "skill": "listening", "target": 5, "events": {"answer_correct"}, "requires": "cards"},
    {"key": "shadowing", "skill": "speaking", "target": 1, "events": {"shadowing_scored", "shadowing_offline"}, "requires": "speaking"},
)


def user_now(db: Session, user_id: str) -> tuple[datetime, str]:
    preference = db.get(UserPreference, user_id)
    tz_name = preference.timezone if preference else "Asia/Ho_Chi_Minh"
    return datetime.now(ZoneInfo(tz_name)), tz_name


def period_start(now: datetime, period_type: str) -> date:
    return now.date() if period_type == "daily" else now.date() - timedelta(days=now.weekday())


def _available_templates(db: Session, user_id: str) -> list[dict]:
    has_cards = db.query(func.count(Card.id)).join(Deck).filter(Deck.user_id == user_id).scalar() > 0
    has_articles = db.query(func.count(Article.id)).filter(Article.user_id == user_id).scalar() > 0
    # Offline speaking remains feasible, so it never requires a scoring worker.
    return [template for template in TEMPLATES if (template["requires"] != "cards" or has_cards) and (template["requires"] != "articles" or has_articles)]


def assignments_for(db: Session, user_id: str, period_type: str) -> list[MissionAssignment]:
    now, _ = user_now(db, user_id); start = period_start(now, period_type)
    existing = db.query(MissionAssignment).filter(MissionAssignment.user_id == user_id, MissionAssignment.period_type == period_type, MissionAssignment.period_start == start).order_by(MissionAssignment.slot).all()
    if len(existing) == 3:
        return existing
    options = _available_templates(db, user_id)
    if not options:
        return existing
    seed = int(hashlib.sha256(f"{user_id}:{period_type}:{start.isoformat()}".encode()).hexdigest()[:16], 16)
    rng = random.Random(seed)
    chosen = options.copy(); rng.shuffle(chosen)
    while len(chosen) < 3:
        chosen.extend(options)
    for slot, template in enumerate(chosen[:3]):
        if any(item.slot == slot for item in existing):
            continue
        target = template["target"] * (3 if period_type == "weekly" else 1)
        assignment = MissionAssignment(user_id=user_id, period_type=period_type, period_start=start, slot=slot, mission_key=template["key"], skill=template["skill"], target=target)
        db.add(assignment); existing.append(assignment)
    db.flush()
    return sorted(existing, key=lambda item: item.slot)


def apply_event_to_missions(db: Session, user_id: str, event) -> list[str]:
    changed = []
    for period_type in ("daily", "weekly"):
        for assignment in assignments_for(db, user_id, period_type):
            if assignment.completed_at is not None:
                continue
            template = next(item for item in TEMPLATES if item["key"] == assignment.mission_key)
            if event.event_type not in template["events"]:
                continue
            increment = max(1, event.duration_seconds // 60) if assignment.mission_key == "reading_minutes" else 1
            assignment.progress = min(assignment.target, assignment.progress + increment)
            changed.append(assignment.id)
            if assignment.progress >= assignment.target:
                assignment.completed_at = datetime.now(timezone.utc)
                progress = next(item for item in ensure_skill_rows(db, user_id) if item.skill == assignment.skill)
                progress.xp += 75 if period_type == "weekly" else 20
    return changed


def reroll(db: Session, user_id: str, assignment_id: str) -> MissionAssignment:
    assignment = db.query(MissionAssignment).filter(MissionAssignment.id == assignment_id, MissionAssignment.user_id == user_id).first()
    if assignment is None: raise LookupError("Mission not found")
    if assignment.period_type != "daily" or assignment.rerolled or assignment.completed_at is not None: raise ValueError("This mission cannot be rerolled")
    options = [item for item in _available_templates(db, user_id) if item["key"] != assignment.mission_key]
    if not options: raise ValueError("No alternate mission is available")
    template = options[int(hashlib.sha256(f"{assignment.id}:reroll".encode()).hexdigest(), 16) % len(options)]
    assignment.mission_key, assignment.skill, assignment.target, assignment.progress, assignment.rerolled = template["key"], template["skill"], template["target"], 0, True
    return assignment


def journey(db: Session, user_id: str) -> dict:
    now, tz_name = user_now(db, user_id); start = period_start(now, "weekly")
    from app.models.learning_event import LearningEvent
    events = db.query(LearningEvent.skill, LearningEvent.occurred_at).filter(LearningEvent.user_id == user_id, LearningEvent.occurred_at >= datetime.combine(start, datetime.min.time(), tzinfo=timezone.utc)).all()
    lanes = []
    for skill in ("vocabulary", "reading", "listening", "speaking"):
        event_days = {occurred.astimezone(ZoneInfo(tz_name)).date() for event_skill, occurred in events if event_skill == skill}
        lanes.append({"skill": skill, "checkpoints": [{"date": (start + timedelta(days=index)).isoformat(), "active": start + timedelta(days=index) in event_days} for index in range(7)]})
    return {"week_start": start, "timezone": tz_name, "lanes": lanes, "boss_available": now.weekday() >= 4}
