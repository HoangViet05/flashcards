from app.models.card import Card
from app.routers.games import is_eligible


def _card(**kwargs):
    return Card(deck_id="x", front_text=kwargs.pop("front", "docker"), back_text="meaning", **kwargs)


def test_game_eligibility():
    assert is_eligible(_card(example_sentence="Docker ships containers everywhere."), "sentence")
    assert not is_eligible(_card(example_sentence="Too short."), "sentence")
    assert is_eligible(_card(example_sentence="I use Docker every day."), "cloze")
    assert not is_eligible(_card(front="queue", example_sentence="I use Docker every day."), "cloze")
    assert is_eligible(_card(definition="A platform for containers"), "match")


def test_games_cards_filter_and_scope(client, user_b_client):
    deck = client.post("/api/decks", json={"name": "Games"}).json()
    for payload in [
        {"front_text": "docker", "back_text": "n", "example_sentence": "I use docker every single day at work.", "definition": "A container platform"},
        {"front_text": "noexample", "back_text": "n"},
    ]:
        assert client.post(f"/api/decks/{deck['id']}/cards", json=payload).status_code == 200
    response = client.get("/api/games/cards", params={"mode": "sentence", "deck_id": deck["id"]})
    assert response.status_code == 200
    assert [card["front_text"] for card in response.json()] == ["docker"]
    assert user_b_client.get("/api/games/cards", params={"mode": "sentence", "deck_id": deck["id"]}).status_code == 404
