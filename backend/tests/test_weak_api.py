from datetime import datetime, timedelta

from app.models.review import Review
from app.models.review_log import ReviewLog
from app.models.user import User


def _user_id(db):
    return db.query(User).filter(User.email == "usera@test.com").one().id


def _weak_card(client, db, word="alpha"):
    deck = client.post("/api/decks", json={"name": f"Deck {word}"}).json()
    card = client.post(
        f"/api/decks/{deck['id']}/cards",
        json={"front_text": word, "back_text": f"nghĩa {word}"},
    ).json()
    user_id = _user_id(db)
    for days_ago, quality in ((3, 1), (2, 2)):
        db.add(ReviewLog(
            user_id=user_id,
            card_id=card["id"],
            quality=quality,
            rating_source="daily",
            reviewed_at=datetime.utcnow() - timedelta(days=days_ago),
        ))
    db.commit()
    return card


def test_weak_list_returns_the_weak_card(client, db):
    card = _weak_card(client, db)
    body = client.get("/api/review/weak").json()
    assert len(body) == 1
    assert body[0]["card"]["id"] == card["id"]
    assert body[0]["recent_wrong"] == 2
    assert body[0]["suggested_step"] in {"dictation", "vi_en", "en_vi"}


def test_weak_list_is_empty_without_failures(client):
    deck = client.post("/api/decks", json={"name": "Sạch"}).json()
    client.post(f"/api/decks/{deck['id']}/cards", json={"front_text": "clean", "back_text": "sạch"})
    assert client.get("/api/review/weak").json() == []


def test_weak_answer_logs_without_touching_the_schedule(client, db):
    card = _weak_card(client, db)
    review = db.query(Review).filter_by(card_id=card["id"]).one()
    before = (review.due_date, review.interval, review.ease_factor, review.repetitions)

    assert client.post(f"/api/review/weak/{card['id']}", json={"correct": True}).status_code == 200

    db.refresh(review)
    assert (review.due_date, review.interval, review.ease_factor, review.repetitions) == before
    logged = db.query(ReviewLog).filter_by(card_id=card["id"], rating_source="weak").one()
    assert logged.quality == 4


def test_weak_answer_wrong_logs_quality_two(client, db):
    card = _weak_card(client, db)
    client.post(f"/api/review/weak/{card['id']}", json={"correct": False})
    logged = db.query(ReviewLog).filter_by(card_id=card["id"], rating_source="weak").one()
    assert logged.quality == 2


def test_weak_answer_rejects_another_users_card(client, user_b_client, db):
    card = _weak_card(client, db)
    assert user_b_client.post(f"/api/review/weak/{card['id']}", json={"correct": True}).status_code == 404
