import hashlib
import hmac
import json
from datetime import date

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.boss_attempt import BossAttempt
from app.models.card import Card
from app.models.deck import Deck
from app.models.user_unlock import UserUnlock
from app.services import missions
from app.services.progression import ensure_skill_rows

MEDAL_XP = {None: 0, "bronze": 100, "silver": 150, "gold": 250}
MEDAL_RANK = {None: 0, "bronze": 1, "silver": 2, "gold": 3}


def medal_for(score: int) -> str | None:
    if score >= 90: return "gold"
    if score >= 75: return "silver"
    if score >= 60: return "bronze"
    return None


def _signature(user_id: str, week_start: date, challenge: dict) -> str:
    raw = f"{user_id}:{week_start.isoformat()}:{json.dumps(challenge, sort_keys=True)}".encode()
    return hmac.new(get_settings().auth_secret.encode(), raw, hashlib.sha256).hexdigest()


def current(db: Session, user_id: str) -> dict:
    now, _ = missions.user_now(db, user_id); week_start = missions.period_start(now, "weekly")
    attempts = db.query(BossAttempt).filter(BossAttempt.user_id == user_id, BossAttempt.week_start == week_start).all()
    best = max(attempts, key=lambda item: item.score) if attempts else None
    if now.weekday() < 4:
        return {"available": False, "week_start": week_start, "best_score": best.score if best else None, "best_medal": best.medal if best else None}
    cards = db.query(Card).join(Deck).filter(Deck.user_id == user_id).order_by(Card.id).limit(10).all()
    card_ids = [card.id for card in cards]
    challenge = {"duration_minutes": 12, "vocabulary_card_ids": card_ids[:5], "reading": {"prompt": "Read a short work-focused passage and identify its main point."}, "listening": {"prompt": "Listen, then choose the key detail."}, "speaking_mode": "scored_or_self_compare"}
    signature = _signature(user_id, week_start, challenge)
    return {"available": True, "week_start": week_start, "snapshot_token": f"{week_start.isoformat()}.{signature}", "challenge": challenge, "best_score": best.score if best else None, "best_medal": best.medal if best else None}


def complete(db: Session, user_id: str, body) -> dict:
    state = current(db, user_id)
    if not state["available"]: raise ValueError("Boss is available from Friday through Sunday")
    if not hmac.compare_digest(body.snapshot_token, state["snapshot_token"]): raise ValueError("Boss snapshot is not valid")
    prior = db.query(BossAttempt).filter(BossAttempt.user_id == user_id, BossAttempt.idempotency_key == body.idempotency_key).first()
    if prior is not None:
        return _result(db, user_id, state["week_start"], prior, 0, [])
    components = [min(100, body.vocabulary_correct * 20), min(100, body.reading_correct * 10), min(100, body.listening_correct * 10)]
    if body.speaking_score is not None: components.append(body.speaking_score)
    score = round(sum(components) / len(components))
    medal = medal_for(score)
    old_attempts = db.query(BossAttempt).filter(BossAttempt.user_id == user_id, BossAttempt.week_start == state["week_start"]).all()
    old_medal = max((item.medal for item in old_attempts), key=lambda item: MEDAL_RANK[item], default=None)
    attempt = BossAttempt(user_id=user_id, week_start=state["week_start"], score=score, medal=medal, duration_seconds=min(body.duration_seconds, 900), idempotency_key=body.idempotency_key, breakdown={"speaking_scored": body.speaking_score is not None, "components": components})
    db.add(attempt)
    awarded = max(0, MEDAL_XP[medal] - MEDAL_XP[old_medal])
    unlocks = []
    if awarded:
        progress = ensure_skill_rows(db, user_id)
        for item in progress: item.xp += awarded // 4
        key = f"boss-{medal}"
        if not db.query(UserUnlock).filter(UserUnlock.user_id == user_id, UserUnlock.unlock_key == key).first():
            db.add(UserUnlock(user_id=user_id, unlock_key=key, unlock_type="title")); unlocks.append(key)
    db.flush()
    return _result(db, user_id, state["week_start"], attempt, awarded, unlocks)


def _result(db: Session, user_id: str, week_start: date, attempt: BossAttempt, awarded: int, unlocks: list[str]) -> dict:
    attempts = db.query(BossAttempt).filter(BossAttempt.user_id == user_id, BossAttempt.week_start == week_start).all()
    best = max(attempts, key=lambda item: item.score)
    best_medal = max((item.medal for item in attempts), key=lambda item: MEDAL_RANK[item], default=None)
    return {"score": attempt.score, "medal": attempt.medal, "best_score": best.score, "best_medal": best_medal, "xp_awarded": awarded, "unlocks": unlocks, "replay_available": True}
