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


def test_missions_and_boss_are_user_scoped(client, user_b_client):
    missions = client.get("/api/missions")
    assert missions.status_code == 200
    assert len(missions.json()["daily"]) <= 3
    boss = client.get("/api/boss/current")
    assert boss.status_code == 200
    assert user_b_client.get("/api/progress/overview").json()["remembered_cards"] == 0
