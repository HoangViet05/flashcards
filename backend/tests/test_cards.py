def test_create_card(client):
    deck = client.post("/api/decks", json={"name": "Vocab"}).json()
    response = client.post(f"/api/decks/{deck['id']}/cards", json={
        "front_text": "ephemeral",
        "back_text": "tạm thời, ngắn ngủi"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["front_text"] == "ephemeral"
    assert data["deck_id"] == deck["id"]


def test_list_cards(client):
    deck = client.post("/api/decks", json={"name": "Vocab"}).json()
    client.post(f"/api/decks/{deck['id']}/cards", json={"front_text": "a", "back_text": "b"})
    client.post(f"/api/decks/{deck['id']}/cards", json={"front_text": "c", "back_text": "d"})
    response = client.get(f"/api/decks/{deck['id']}/cards")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_update_card(client):
    deck = client.post("/api/decks", json={"name": "Vocab"}).json()
    card = client.post(f"/api/decks/{deck['id']}/cards", json={"front_text": "old", "back_text": "old"}).json()
    response = client.put(f"/api/cards/{card['id']}", json={"front_text": "new"})
    assert response.status_code == 200
    assert response.json()["front_text"] == "new"


def test_delete_card(client):
    deck = client.post("/api/decks", json={"name": "Vocab"}).json()
    card = client.post(f"/api/decks/{deck['id']}/cards", json={"front_text": "x", "back_text": "y"}).json()
    response = client.delete(f"/api/cards/{card['id']}")
    assert response.status_code == 200
