from datetime import datetime, timedelta

from app.models.review import Review
from app.models.review_log import ReviewLog
from app.models.user import User


def _user_id(db):
    return db.query(User).filter(User.email == "usera@test.com").one().id


def test_word_states_marks_learning_mastered_and_weak(client, db):
    article = client.post("/api/articles", json={
        "title": "Bài",
        "text": "Alpha and beta and gamma appear here.",
    }).json()
    for word in ("alpha", "beta", "gamma"):
        assert client.post(
            f"/api/articles/{article['id']}/cards",
            json={"word": word, "back_text": f"nghĩa {word}"},
        ).status_code == 200

    user_id = _user_id(db)
    reviews = {review.card.front_text.lower(): review for review in db.query(Review).all()}
    reviews["alpha"].repetitions = 1
    reviews["beta"].repetitions = 4
    reviews["gamma"].repetitions = 2
    for days_ago, quality in ((3, 1), (2, 2)):
        db.add(ReviewLog(
            user_id=user_id,
            card_id=reviews["gamma"].card_id,
            quality=quality,
            rating_source="daily",
            reviewed_at=datetime.utcnow() - timedelta(days=days_ago),
        ))
    db.commit()

    states = client.get(f"/api/articles/{article['id']}/word-states").json()["states"]
    assert states["alpha"] == "learning"
    assert states["beta"] == "mastered"
    assert states["gamma"] == "weak"


def test_word_states_skips_never_studied_cards(client):
    article = client.post("/api/articles", json={
        "title": "Bài",
        "text": "Delta appears here.",
    }).json()
    client.post(
        f"/api/articles/{article['id']}/cards",
        json={"word": "delta", "back_text": "đồng bằng"},
    )
    assert client.get(f"/api/articles/{article['id']}/word-states").json()["states"] == {}
