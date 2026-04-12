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
