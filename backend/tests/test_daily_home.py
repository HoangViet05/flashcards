from datetime import datetime

from app.models.review import Review
from app.models.review_log import ReviewLog

WORDS = ["apple", "banana", "cherry", "dragon", "eagle", "falcon", "grape", "honey", "island", "jungle"]


def _deck_with_words(client, name="Home", words=WORDS):
    deck = client.post("/api/decks", json={"name": name}).json()
    for word in words:
        assert client.post(
            f"/api/decks/{deck['id']}/cards",
            json={"front_text": word, "back_text": f"nghĩa {word}"},
        ).status_code == 200
    return deck


def test_home_for_empty_user(client):
    body = client.get("/api/daily/home").json()
    assert body["total_cards"] == body["deck_count"] == body["mastered_cards"] == body["streak"] == 0
    assert body["studied_today"] is False and body["latest_article"] is None
    assert body["session_status"] == "none" and body["steps_total"] == body["steps_done"] == 0


def test_home_counts_cards_and_decks(client):
    _deck_with_words(client)
    body = client.get("/api/daily/home").json()
    assert body["total_cards"] == 10 and body["deck_count"] == 1


def test_home_reports_learning_session_progress(client):
    _deck_with_words(client)
    session = client.get("/api/daily/session").json()["session"]
    body = client.get("/api/daily/home").json()
    assert body["session_status"] == "learning"
    assert body["new_count"] == 10 and body["due_count"] == 0
    assert body["steps_total"] == 30 and body["steps_done"] == 0
    word = session["words"][0]
    assert client.post("/api/daily/answer", json={"card_id": word["card_id"], "step": "flip", "correct": True}).status_code == 200
    assert client.get("/api/daily/home").json()["steps_done"] == 1


def test_home_matches_stats_for_streak_and_mastered(client, db):
    _deck_with_words(client)
    card_id = client.get("/api/daily/session").json()["session"]["words"][0]["card_id"]
    review = db.query(Review).filter_by(card_id=card_id).one()
    review.repetitions = 4
    db.add(ReviewLog(user_id=review.card.deck.user_id, card_id=card_id, quality=5, rating_source="daily", reviewed_at=datetime.utcnow()))
    db.commit()
    home, stats = client.get("/api/daily/home").json(), client.get("/api/review/stats").json()
    assert home["mastered_cards"] == stats["mastered_cards"] == 1
    assert home["streak"] == stats["streak"] == 1 and home["studied_today"] is True


def test_home_reports_latest_article_and_unlearned_saved_words(client):
    client.post("/api/articles", json={"title": "Bài cũ", "text": "The engine will abandon the plan."})
    newer = client.post("/api/articles", json={"title": "Bài mới", "text": "She will abandon the old plan today."}).json()
    assert client.post(f"/api/articles/{newer['id']}/cards", json={"word": "abandon", "back_text": "từ bỏ"}).status_code == 200
    latest = client.get("/api/daily/home").json()["latest_article"]
    assert latest["id"] == newer["id"] and latest["title"] == "Bài mới"
    assert latest["unlearned_saved_words"] == 1
