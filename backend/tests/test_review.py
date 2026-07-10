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


def test_submit_review_stores_auto_rating_metadata(client):
    _, cards = _make_deck_with_cards(client, n=1)

    response = client.post(
        f"/api/review/{cards[0]['id']}",
        json={
            "quality": 3,
            "auto_quality": 5,
            "rating_source": "manual",
            "response_time_ms": 4200,
            "flip_count": 1,
            "audio_play_count": 0,
            "answer_mode": "self-check",
            "answer_correct": None,
            "attempt_count": None,
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["last_quality"] == 3
    assert data["last_auto_quality"] == 5
    assert data["last_rating_source"] == "manual"
    assert data["last_response_time_ms"] == 4200
    assert data["last_flip_count"] == 1
    assert data["last_audio_play_count"] == 0
    assert data["last_answer_mode"] == "self-check"
