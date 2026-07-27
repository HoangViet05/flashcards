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


def test_day_detail_lists_articles_and_skill_breakdown(client, db):
    article = client.post("/api/articles", json={"title": "Ozone layer", "text": "word " * 120}).json()
    user = db.query(User).filter(User.email == "usera@test.com").one()
    db.add(LearningEvent(
        user_id=user.id, event_type="reading_complete", skill="reading",
        source_type="article", source_id=article["id"], idempotency_key="day-detail-0001",
        duration_seconds=420, payload={}, occurred_at=datetime.now(timezone.utc),
    ))
    db.commit()

    today = client.get("/api/progress/overview").json()["effective_date"]
    body = client.get(f"/api/progress/day/{today}").json()
    assert body["date"] == today
    assert body["seconds"] == 420
    assert {"skill": "reading", "seconds": 420, "events": 1} in body["skills"]
    assert body["articles"] == [{"id": article["id"], "title": "Ozone layer"}]


def test_a_quiet_day_is_a_valid_answer_not_an_error(client):
    today = client.get("/api/progress/overview").json()["effective_date"]
    quiet = (datetime.fromisoformat(today) - timedelta(days=5)).date().isoformat()
    response = client.get(f"/api/progress/day/{quiet}")
    assert response.status_code == 200
    assert response.json()["seconds"] == 0 and response.json()["articles"] == []


def test_day_detail_rejects_a_future_date(client):
    today = client.get("/api/progress/overview").json()["effective_date"]
    future = (datetime.fromisoformat(today) + timedelta(days=1)).date().isoformat()
    assert client.get(f"/api/progress/day/{future}").status_code == 400


def test_day_detail_does_not_leak_another_learner(client, user_b_client, db):
    user = db.query(User).filter(User.email == "usera@test.com").one()
    db.add(LearningEvent(
        user_id=user.id, event_type="duration", skill="vocabulary",
        source_type="full", source_id="s1", idempotency_key="day-scope-0001",
        duration_seconds=900, payload={}, occurred_at=datetime.now(timezone.utc),
    ))
    db.commit()
    today = client.get("/api/progress/overview").json()["effective_date"]
    assert user_b_client.get(f"/api/progress/day/{today}").json()["seconds"] == 0
