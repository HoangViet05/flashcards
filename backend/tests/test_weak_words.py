from datetime import datetime, timedelta
import json

from app.models.daily_session import DailySession, DailySessionWord
from app.models.review_log import ReviewLog
from app.models.user import User
from app.services import weak_words


def _user_id(db):
    return db.query(User).filter(User.email == "usera@test.com").one().id


def _card(client, word="alpha"):
    deck = client.post("/api/decks", json={"name": f"Deck {word}"}).json()
    return client.post(
        f"/api/decks/{deck['id']}/cards",
        json={"front_text": word, "back_text": f"nghĩa {word}"},
    ).json()


def _log(db, user_id, card_id, quality, days_ago):
    db.add(ReviewLog(
        user_id=user_id,
        card_id=card_id,
        quality=quality,
        rating_source="daily",
        reviewed_at=datetime.utcnow() - timedelta(days=days_ago),
    ))


def test_two_recent_failures_make_a_card_weak(client, db):
    user_id = _user_id(db)
    card = _card(client)
    _log(db, user_id, card["id"], 2, 3)
    _log(db, user_id, card["id"], 1, 2)
    _log(db, user_id, card["id"], 5, 1)
    db.commit()

    result = weak_words.weak_words(db, user_id)
    assert [item.card_id for item in result] == [card["id"]]
    assert result[0].recent_wrong == 2
    assert weak_words.is_weak(db, card["id"]) is True


def test_one_failure_is_not_weak(client, db):
    user_id = _user_id(db)
    card = _card(client)
    _log(db, user_id, card["id"], 2, 2)
    _log(db, user_id, card["id"], 5, 1)
    db.commit()

    assert weak_words.weak_words(db, user_id) == []
    assert weak_words.is_weak(db, card["id"]) is False


def test_old_failures_fall_out_of_the_window(client, db):
    user_id = _user_id(db)
    card = _card(client)
    _log(db, user_id, card["id"], 1, 10)
    _log(db, user_id, card["id"], 1, 9)
    for day in range(5):
        _log(db, user_id, card["id"], 5, day)
    db.commit()

    assert weak_words.is_weak(db, card["id"]) is False


def test_card_without_logs_is_not_weak(client, db):
    card = _card(client)
    assert weak_words.is_weak(db, card["id"]) is False


def test_suggested_step_avoids_the_previous_step(client, db):
    user_id = _user_id(db)
    card = _card(client)
    session = DailySession(
        user_id=user_id,
        session_date=datetime.utcnow().date(),
        status="done",
        phase="review",
    )
    db.add(session)
    db.flush()
    db.add(DailySessionWord(
        session_id=session.id,
        card_id=card["id"],
        is_new=False,
        assigned_step="dictation",
        steps_done=json.dumps(["dictation"]),
        prev_ease=2.5,
        prev_interval=0,
        prev_reps=0,
    ))
    db.commit()

    for _ in range(10):
        assert weak_words.suggested_step(db, card["id"]) in {"vi_en", "en_vi"}


def test_suggested_step_without_history_is_any_valid_step(client, db):
    card = _card(client)
    assert weak_words.suggested_step(db, card["id"]) in {"dictation", "vi_en", "en_vi"}
