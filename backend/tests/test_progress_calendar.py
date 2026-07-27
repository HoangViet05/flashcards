from datetime import datetime, timedelta, timezone

from app.models.learning_event import LearningEvent
from app.models.user import User


def _event_now(db, key: str, seconds: int = 300) -> None:
    user = db.query(User).filter(User.email == "usera@test.com").one()
    db.add(LearningEvent(
        user_id=user.id, event_type="reading_complete", skill="reading",
        source_type="article", source_id="a1", idempotency_key=key,
        duration_seconds=seconds, payload={}, occurred_at=datetime.now(timezone.utc),
    ))
    db.commit()


def test_calendar_returns_one_entry_per_day_even_when_empty(client):
    body = client.get("/api/progress/calendar?days=84").json()
    assert len(body) == 84
    assert all(entry["active"] is False for entry in body)
    assert body[0]["date"] < body[-1]["date"]


def test_a_reading_only_day_counts_as_active(client, db):
    """/api/review/heatmap misses this case: it only counts ReviewLog rows,
    while the streak counts learning events too."""
    _event_now(db, "calendar-reading-0001")
    body = client.get("/api/progress/calendar?days=84").json()
    today = body[-1]
    assert today["seconds"] == 300
    assert today["reviews"] == 0
    assert today["active"] is True


def test_calendar_rejects_an_out_of_range_window(client):
    assert client.get("/api/progress/calendar?days=1000").status_code == 422


def test_calendar_is_user_scoped(client, user_b_client, db):
    _event_now(db, "calendar-scope-0001")
    body = user_b_client.get("/api/progress/calendar?days=84").json()
    assert all(entry["active"] is False for entry in body)


def test_the_calendar_agrees_with_the_streak_on_the_same_day(client, db):
    """Hai con số trên cùng một trang dashboard không được mâu thuẫn."""
    _event_now(db, "calendar-agree-0001")
    calendar = client.get("/api/progress/calendar?days=84").json()
    overview = client.get("/api/progress/overview").json()
    assert calendar[-1]["date"] == overview["effective_date"]
    assert calendar[-1]["active"] is True
    assert overview["streak"] == 1
