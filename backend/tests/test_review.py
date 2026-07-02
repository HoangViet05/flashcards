from app.models.review import Review


def _make_deck_with_cards(client, n=2):
    deck = client.post("/api/decks", json={"name": "Stats deck"}).json()
    cards = [
        client.post(f"/api/decks/{deck['id']}/cards", json={"front_text": f"w{i}", "back_text": "x"}).json()
        for i in range(n)
    ]
    return deck, cards


def test_stats_splits_new_and_due(client, db):
    _, cards = _make_deck_with_cards(client, n=2)
    review = db.query(Review).filter(Review.card_id == cards[1]["id"]).first()
    review.repetitions = 2
    db.commit()

    stats = client.get("/api/review/stats").json()
    assert stats["new_cards"] == 1
    assert stats["due_today"] == 1
    assert stats["total_cards"] == 2
