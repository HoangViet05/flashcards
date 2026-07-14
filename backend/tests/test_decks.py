def test_create_deck(client):
    response = client.post("/api/decks", json={"name": "IELTS Vocab"})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "IELTS Vocab"
    assert "id" in data


def test_list_decks(client):
    client.post("/api/decks", json={"name": "Deck A"})
    client.post("/api/decks", json={"name": "Deck B"})
    response = client.get("/api/decks")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_get_deck(client):
    created = client.post("/api/decks", json={"name": "My Deck"}).json()
    response = client.get(f"/api/decks/{created['id']}")
    assert response.status_code == 200
    assert response.json()["name"] == "My Deck"


def test_get_deck_not_found(client):
    response = client.get("/api/decks/nonexistent-id")
    assert response.status_code == 404


def test_update_deck(client):
    created = client.post("/api/decks", json={"name": "Old Name"}).json()
    response = client.put(f"/api/decks/{created['id']}", json={"name": "New Name"})
    assert response.status_code == 200
    assert response.json()["name"] == "New Name"


def test_delete_deck(client):
    created = client.post("/api/decks", json={"name": "To Delete"}).json()
    response = client.delete(f"/api/decks/{created['id']}")
    assert response.status_code == 200
    assert client.get(f"/api/decks/{created['id']}").status_code == 404


def test_decks_require_auth(anon_client):
    assert anon_client.get("/api/decks").status_code == 401


def test_deck_isolated_between_users(client, user_b_client):
    created = client.post("/api/decks", json={"name": "Private"}).json()
    assert user_b_client.get("/api/decks").json() == []
    assert user_b_client.get(f"/api/decks/{created['id']}").status_code == 404
    assert user_b_client.put(f"/api/decks/{created['id']}", json={"name": "Hack"}).status_code == 404
    assert user_b_client.delete(f"/api/decks/{created['id']}").status_code == 404


def test_deck_list_returns_counts(client):
    deck = client.post("/api/decks", json={"name": "Counted"}).json()
    client.post(
        f"/api/decks/{deck['id']}/cards",
        json={"front_text": "hello", "back_text": "xin chào"},
    )
    listed = client.get("/api/decks").json()
    assert listed[0]["card_count"] == 1
    assert listed[0]["new_count"] == 1
    assert listed[0]["due_count"] == 0
