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
