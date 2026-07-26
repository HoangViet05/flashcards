from datetime import date, datetime, timedelta

from app.models.review import Review
from app.models.review_log import ReviewLog
from app.models.user import User


def _user_id(db):
    return db.query(User).filter(User.email == "usera@test.com").one().id


def _card(client, deck_id, word):
    return client.post(
        f"/api/decks/{deck_id}/cards",
        json={"front_text": word, "back_text": f"nghĩa {word}"},
    ).json()


def _make_weak(db, user_id, card_id):
    for days_ago, quality in ((3, 1), (2, 2)):
        db.add(ReviewLog(
            user_id=user_id,
            card_id=card_id,
            quality=quality,
            rating_source="daily",
            reviewed_at=datetime.utcnow() - timedelta(days=days_ago),
        ))


def test_session_includes_weak_cards_that_are_not_due(client, db):
    deck = client.post("/api/decks", json={"name": "Weak"}).json()
    weak = _card(client, deck["id"], "alpha")
    user_id = _user_id(db)
    review = db.query(Review).filter_by(card_id=weak["id"]).one()
    review.repetitions = 2
    review.due_date = date.today() + timedelta(days=6)
    _make_weak(db, user_id, weak["id"])
    db.commit()

    words = client.get("/api/daily/session").json()["session"]["words"]
    weak_words = [word for word in words if word["is_weak"]]
    assert [word["card_id"] for word in weak_words] == [weak["id"]]
    assert weak_words[0]["is_new"] is False


def test_due_cards_are_not_duplicated_as_weak(client, db):
    deck = client.post("/api/decks", json={"name": "Due"}).json()
    card = _card(client, deck["id"], "beta")
    user_id = _user_id(db)
    review = db.query(Review).filter_by(card_id=card["id"]).one()
    review.repetitions = 2
    review.due_date = date.today()
    _make_weak(db, user_id, card["id"])
    db.commit()

    words = client.get("/api/daily/session").json()["session"]["words"]
    assert [word["card_id"] for word in words].count(card["id"]) == 1


def test_session_without_weak_cards_still_works(client):
    deck = client.post("/api/decks", json={"name": "Sạch"}).json()
    _card(client, deck["id"], "gamma")
    words = client.get("/api/daily/session").json()["session"]["words"]
    assert words
    assert all(word["is_weak"] is False for word in words)
