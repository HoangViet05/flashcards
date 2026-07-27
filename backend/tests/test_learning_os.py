from datetime import datetime

from app.models.learning_event import LearningEvent
from app.models.review import Review
from app.models.review_log import ReviewLog


def test_preferences_are_created_lazily_and_patched(client):
    response = client.get("/api/auth/me/preferences")
    assert response.status_code == 200
    assert response.json()["timezone"] == "Asia/Ho_Chi_Minh"
    response = client.patch("/api/auth/me/preferences", json={"ui_theme": "dark", "daily_goal_minutes": 25, "onboarding_completed": True})
    assert response.status_code == 200
    assert response.json()["preferences"]["ui_theme"] == "dark"


def test_event_batch_is_idempotent_and_returns_four_skills(client):
    event = {"event_type": "answer_correct", "skill": "vocabulary", "idempotency_key": "event-key-0001", "source_type": "quick"}
    first = client.post("/api/events/batch", json={"events": [event]})
    second = client.post("/api/events/batch", json={"events": [event]})
    assert first.status_code == 200 and first.json()["xp_awarded"] == 4
    assert second.status_code == 200 and second.json()["events"][0]["duplicate"] is True
    overview = client.get("/api/progress/overview")
    assert overview.status_code == 200
    assert {item["skill"] for item in overview.json()["skills"]} == {"vocabulary", "reading", "listening", "speaking"}


def test_progress_overview_has_a_complete_calendar_and_review_metrics(client, db):
    deck = client.post("/api/decks", json={"name": "Progress"}).json()
    card = client.post(f"/api/decks/{deck['id']}/cards", json={"front_text": "signal", "back_text": "tín hiệu"}).json()
    review = db.query(Review).filter(Review.card_id == card["id"]).one()
    review.repetitions = 3
    db.add(ReviewLog(user_id=review.card.deck.user_id, card_id=card["id"], quality=5, rating_source="daily", reviewed_at=datetime.utcnow()))
    db.add(LearningEvent(user_id=review.card.deck.user_id, event_type="duration", skill="vocabulary", source_type="full", source_id="session-1", idempotency_key="progress-duration-0001", duration_seconds=120, payload={}, occurred_at=datetime.utcnow()))
    db.commit()

    overview = client.get("/api/progress/overview")
    assert overview.status_code == 200
    body = overview.json()
    assert len(body["heatmap"]) == 28
    assert body["active_days_28"] == body["streak"] == 1
    assert body["study_minutes_today"] == body["study_minutes_week"] == 2
    assert body["reviews_today"] == body["reviews_week"] == body["reviews_total"] == 1
    assert body["remembered_cards"] == body["total_cards"] == body["deck_count"] == 1
    assert body["retention"] is None and body["retention_samples"] == 1


def test_missions_and_boss_are_user_scoped(client, user_b_client):
    missions = client.get("/api/missions")
    assert missions.status_code == 200
    assert len(missions.json()["daily"]) <= 3
    boss = client.get("/api/boss/current")
    assert boss.status_code == 200
    assert user_b_client.get("/api/progress/overview").json()["remembered_cards"] == 0
