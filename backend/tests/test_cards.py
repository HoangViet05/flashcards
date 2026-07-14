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


def test_create_card_with_media_fields(client):
    deck = client.post("/api/decks", json={"name": "Unit test"}).json()
    resp = client.post(
        f"/api/decks/{deck['id']}/cards",
        json={
            "front_text": "afraid",
            "back_text": "Sợ hãi",
            "pronunciation": "[ə'freɪd]",
            "definition": "When someone is afraid, they feel fear.",
            "example_sentence": "The woman was afraid of what she saw.",
            "image_url": "/media/4000B1_001.jpg",
            "audio_url": "/media/4000B1_afraid.mp3",
            "example_audio_url": "/media/4000B1_afraid_example.mp3",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["pronunciation"] == "[ə'freɪd]"
    assert data["definition"] == "When someone is afraid, they feel fear."
    assert data["example_audio_url"] == "/media/4000B1_afraid_example.mp3"


def _create_deck_with_cards(client, n):
    deck = client.post("/api/decks", json={"name": f"Deck {n} cards"}).json()
    for i in range(n):
        client.post(
            f"/api/decks/{deck['id']}/cards",
            json={"front_text": f"word-{i}", "back_text": f"nghĩa {i}"},
        )
    return deck


def test_cards_require_auth(anon_client):
    assert anon_client.get("/api/decks/any-id/cards").status_code == 401


def test_cards_isolated_between_users(client, user_b_client):
    deck = _create_deck_with_cards(client, 1)
    card = client.get(f"/api/decks/{deck['id']}/cards").json()[0]
    assert user_b_client.get(f"/api/decks/{deck['id']}/cards").status_code == 404
    assert user_b_client.put(f"/api/cards/{card['id']}", json={"front_text": "hack"}).status_code == 404
    assert user_b_client.delete(f"/api/cards/{card['id']}").status_code == 404


def test_cards_pagination(client):
    deck = _create_deck_with_cards(client, 5)
    res = client.get(f"/api/decks/{deck['id']}/cards", params={"limit": 2, "offset": 0})
    assert res.status_code == 200
    assert len(res.json()) == 2
    assert res.headers["X-Total-Count"] == "5"
    res2 = client.get(f"/api/decks/{deck['id']}/cards", params={"limit": 2, "offset": 4})
    assert len(res2.json()) == 1


def test_cards_pagination_validates_bounds(client):
    deck = _create_deck_with_cards(client, 1)
    assert client.get(f"/api/decks/{deck['id']}/cards", params={"limit": 0}).status_code == 422
    assert client.get(f"/api/decks/{deck['id']}/cards", params={"limit": 201}).status_code == 422
    assert client.get(f"/api/decks/{deck['id']}/cards", params={"offset": -1}).status_code == 422
