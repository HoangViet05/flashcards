from datetime import datetime

from app.models.deck import Deck
from app.models.review_log import ReviewLog
from app.models.user import User


def _make_user(db, email="owner@test.com"):
    user = User(email=email, password_hash="x")
    db.add(user)
    db.commit()
    return user


def test_deck_requires_user_id(db):
    user = _make_user(db)
    deck = Deck(name="D1", user_id=user.id)
    db.add(deck)
    db.commit()
    assert db.query(Deck).filter(Deck.user_id == user.id).count() == 1


def test_review_log_insert(db):
    user = _make_user(db)
    log = ReviewLog(user_id=user.id, card_id=None, quality=5, rating_source="flip")
    db.add(log)
    db.commit()
    saved = db.query(ReviewLog).one()
    assert saved.quality == 5
    assert saved.rating_source == "flip"
    assert isinstance(saved.reviewed_at, datetime)
