from app.models.user import User


def test_register_login_and_me(client):
    response = client.post(
        "/api/auth/register",
        json={"email": "Learner@Example.com", "password": "strongpass123", "name": "Learner"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["access_token"]
    assert body["user"]["email"] == "learner@example.com"

    duplicate = client.post(
        "/api/auth/register",
        json={"email": "learner@example.com", "password": "strongpass123"},
    )
    assert duplicate.status_code == 409

    login = client.post(
        "/api/auth/login",
        json={"email": "learner@example.com", "password": "strongpass123"},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "learner@example.com"


def test_update_reminder_settings_requires_auth(client):
    unauthenticated = client.put(
        "/api/auth/reminder",
        json={"reminder_enabled": True, "reminder_time": "08:30", "timezone": "Asia/Saigon"},
    )
    assert unauthenticated.status_code == 401

    registered = client.post(
        "/api/auth/register",
        json={"email": "reminder@example.com", "password": "strongpass123"},
    ).json()
    token = registered["access_token"]

    response = client.put(
        "/api/auth/reminder",
        headers={"Authorization": f"Bearer {token}"},
        json={"reminder_enabled": True, "reminder_time": "07:45", "timezone": "Asia/Saigon"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["reminder_enabled"] is True
    assert body["reminder_time"] == "07:45"


def test_send_daily_reminders_skips_without_smtp(client, db):
    client.post(
        "/api/auth/register",
        json={"email": "daily@example.com", "password": "strongpass123"},
    )
    user = db.query(User).filter(User.email == "daily@example.com").first()
    user.reminder_enabled = True
    user.reminder_time = "00:00"

    deck = client.post("/api/decks", json={"name": "Due deck"}).json()
    client.post(f"/api/decks/{deck['id']}/cards", json={"front_text": "word", "back_text": "meaning"})
    db.commit()

    response = client.post("/api/reminders/send-daily")
    assert response.status_code == 200
    body = response.json()
    assert body["checked_users"] == 1
    assert body["sent"] == 0
    assert body["skipped"] == 1
    assert body["due_cards"] == 1
