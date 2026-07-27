from datetime import datetime, timedelta, timezone

from app.models.learning_event import LearningEvent
from app.models.user import User


def _seed(db, moment_utc: datetime, key: str) -> None:
    user = db.query(User).filter(User.email == "usera@test.com").one()
    db.add(LearningEvent(
        user_id=user.id, event_type="duration", skill="vocabulary",
        source_type="full", source_id="s1", idempotency_key=key,
        duration_seconds=600, payload={}, occurred_at=moment_utc,
    ))
    db.commit()


def test_an_early_morning_session_counts_for_the_local_day(client, db):
    """23:30 UTC is 06:30 the next morning in Asia/Ho_Chi_Minh (UTC+7)."""
    now = datetime.now(timezone.utc)
    local_today = (now + timedelta(hours=7)).date()
    moment = datetime.combine(local_today, datetime.min.time(), tzinfo=timezone.utc) - timedelta(minutes=30)
    _seed(db, moment, "tz-early-0001")

    body = client.get("/api/progress/overview").json()
    assert body["heatmap"][local_today.isoformat()] == 600
    assert body["study_minutes_today"] == 10
    assert body["streak"] == 1


def test_the_calendar_window_is_anchored_to_the_local_date(client):
    body = client.get("/api/progress/overview").json()
    days = sorted(body["heatmap"])
    assert len(days) == 28
    assert days[-1] == body["effective_date"]


def test_overview_reports_a_combined_level(client):
    for index in range(3):
        client.post("/api/events/batch", json={"events": [{
            "event_type": "answer_correct", "skill": "vocabulary",
            "idempotency_key": f"combined-xp-{index:04d}", "source_type": "quick",
        }]})
    body = client.get("/api/progress/overview").json()
    assert body["total_xp"] == sum(skill["xp"] for skill in body["skills"])
    assert body["total_xp"] > 0
    assert body["level"] >= 1
