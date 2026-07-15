from app.models.review import Review
from app.models.review_log import ReviewLog


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


def _make_card(client, deck_name="RLog Deck"):
    deck = client.post("/api/decks", json={"name": deck_name}).json()
    client.post(
        f"/api/decks/{deck['id']}/cards",
        json={"front_text": "log-word", "back_text": "nghĩa"},
    )
    return client.get(f"/api/decks/{deck['id']}/cards").json()[0]


def test_review_due_requires_auth(anon_client):
    assert anon_client.get("/api/review/due").status_code == 401


def test_due_cards_scoped_per_user(client, user_b_client):
    _make_card(client)
    assert len(client.get("/api/review/due").json()) == 1
    assert user_b_client.get("/api/review/due").json() == []


def test_submit_review_writes_log(client, db):
    card = _make_card(client, "Log Deck 2")
    res = client.post(
        f"/api/review/{card['id']}",
        json={"quality": 5, "rating_source": "flip", "response_time_ms": 1200},
    )
    assert res.status_code == 200
    logs = db.query(ReviewLog).all()
    assert len(logs) == 1
    assert logs[0].card_id == card["id"]
    assert logs[0].quality == 5
    assert logs[0].rating_source == "flip"
    assert logs[0].response_time_ms == 1200


def test_deleting_card_preserves_review_log(client, db):
    card = _make_card(client, "Persistent Log Deck")
    client.post(f"/api/review/{card['id']}", json={"quality": 4})

    assert client.delete(f"/api/cards/{card['id']}").status_code == 200
    db.expire_all()
    log = db.query(ReviewLog).one()
    assert log.card_id is None


def test_submit_review_foreign_card_404(client, user_b_client):
    card = _make_card(client, "Log Deck 3")
    assert user_b_client.post(f"/api/review/{card['id']}", json={"quality": 5}).status_code == 404


def test_stats_scoped_and_aggregated(client, user_b_client):
    card = _make_card(client, "Stats Deck")
    client.post(f"/api/review/{card['id']}", json={"quality": 5})

    stats = client.get("/api/review/stats").json()
    assert stats["total_cards"] == 1
    assert stats["total_reviewed_today"] == 1
    assert stats["streak"] == 1
    assert len(stats["due_upcoming"]) == 7

    stats_b = user_b_client.get("/api/review/stats").json()
    assert stats_b["total_cards"] == 0
    assert stats_b["streak"] == 0


def test_stats_streak_from_logs(client, db):
    from datetime import datetime, timedelta

    from app.models.user import User

    user = db.query(User).filter(User.email == "usera@test.com").one()
    now = datetime.utcnow()
    for days_ago in (0, 1, 2, 4):
        db.add(
            ReviewLog(
                user_id=user.id,
                card_id=None,
                quality=4,
                reviewed_at=now - timedelta(days=days_ago),
            )
        )
    db.commit()

    assert client.get("/api/review/stats").json()["streak"] == 3


def test_heatmap_and_extended_stats(client, db):
    from app.models.user import User

    user = db.query(User).filter(User.email == "usera@test.com").one()
    db.add(ReviewLog(user_id=user.id, card_id=None, quality=5, rating_source="game_cloze"))
    db.commit()

    heatmap = client.get("/api/review/heatmap")
    assert heatmap.status_code == 200
    assert sum(day["count"] for day in heatmap.json()) == 1
    stats = client.get("/api/review/stats").json()
    assert stats["total_reviews"] == 1
    assert stats["reviews_by_source"] == {"game_cloze": 1}
