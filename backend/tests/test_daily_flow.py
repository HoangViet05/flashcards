import json
from datetime import date, timedelta

from app.models.daily_session import DailySession
from app.models.review import Review
from app.models.review_log import ReviewLog


WORDS = ["apple", "banana", "cherry", "dragon", "eagle", "falcon", "grape", "honey", "island", "jungle"]


def _session(client):
    deck = client.post("/api/decks", json={"name": "Daily"}).json()
    for word in WORDS:
        assert client.post(f"/api/decks/{deck['id']}/cards", json={"front_text": word, "back_text": f"nghĩa {word}"}).status_code == 200
    return client.get("/api/daily/session").json()["session"]


def _reach_game(client):
    session = _session(client)
    for word in session["words"]:
        for step in ["flip", "dictation", word["assigned_step"]]:
            assert client.post("/api/daily/answer", json={"card_id": word["card_id"], "step": step, "correct": True}).status_code == 200
    assert client.post("/api/daily/complete-learning").status_code == 200
    return session


def test_daily_session_completes_learning_and_builds_game(client, db):
    session = _session(client)
    assert client.get("/api/daily/status").json()["session_status"] == "learning"
    for word in session["words"]:
        for step in ["flip", "dictation", word["assigned_step"]]:
            assert client.post("/api/daily/answer", json={"card_id": word["card_id"], "step": step, "correct": True}).status_code == 200
    assert client.post("/api/daily/complete-learning").status_code == 200
    stored = db.query(DailySession).filter_by(id=session["id"]).one()
    puzzle = json.loads(stored.puzzle_json)
    assert stored.status == "game"
    assert len(puzzle["meanings"]) == 10
    assert db.query(ReviewLog).filter_by(rating_source="daily").count() == 10
    review = db.query(Review).filter_by(card_id=session["words"][0]["card_id"]).one()
    assert review.repetitions == 1 and review.due_date == date.today() + timedelta(days=1)


def test_daily_game_found_hint_and_confirm_adjusts_sm2(client, db):
    session = _reach_game(client)
    stored = db.query(DailySession).filter_by(id=session["id"]).one()
    puzzle = json.loads(stored.puzzle_json)
    placement = puzzle["placements"][0]
    direction = {"h": (0, 1), "v": (1, 0), "d": (1, 1)}[placement["dir"]]
    end_row = placement["row"] + direction[0] * (len(placement["word"]) - 1)
    end_col = placement["col"] + direction[1] * (len(placement["word"]) - 1)
    assert client.post("/api/daily/game/found", json={"start_row": end_row, "start_col": end_col, "end_row": placement["row"], "end_col": placement["col"]}).json()["matched"]["card_id"] == placement["card_id"]
    token = next(item["token"] for item in puzzle["meanings"] if item["card_id"] == placement["card_id"])
    assert client.post("/api/daily/game/hint", json={"token": token}).json()["level"] == 1
    for word in stored.words:
        word.game_found = True
    db.commit()
    pairs = [{"card_id": item["card_id"], "token": item["token"]} for item in puzzle["meanings"]]
    result = client.post("/api/daily/game/confirm", json={"pairs": pairs})
    assert result.status_code == 200
    adjusted = next(item for item in result.json()["results"] if item["card_id"] == placement["card_id"])
    assert adjusted["quality_after"] == 4
