import json
import random
import uuid
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.card import Card
from app.models.daily_session import DailySession, DailySessionWord
from app.models.review_log import ReviewLog
from app.models.user import User
from app.schemas.card import CardOut
from app.schemas.daily import (
    AnswerIn, ConfirmIn, ConfirmOut, ConfirmResultItem, DailySessionOut,
    DailySessionResponse, DailyStatusOut, DailyHomeOut, DailyWordOut, FoundIn, FoundOut,
    GameMeaning, GameOut, GameWordChip, HintIn, HintOut,
    LatestArticleOut,
)
from app.services import daily as daily_service
from app.services import word_search
from app.services.security import get_current_user
from app.services.sm2 import compute_sm2

router = APIRouter(prefix="/api/daily", tags=["daily"])


def _close_stale_game_sessions(db: Session, user: User) -> None:
    for session in db.query(DailySession).filter(
        DailySession.user_id == user.id, DailySession.status == "game", DailySession.session_date < date.today()
    ).all():
        session.status, session.completed_at = "done", datetime.utcnow()


def _live_words(session: DailySession) -> list[DailySessionWord]:
    return [word for word in session.words if word.card is not None]


def _word_out(word: DailySessionWord) -> DailyWordOut:
    return DailyWordOut(id=word.id, card_id=word.card_id, is_new=word.is_new,
                        assigned_step=word.assigned_step, steps_done=json.loads(word.steps_done or "[]"),
                        wrong_count=word.wrong_count, card=CardOut.model_validate(word.card))


def _session_out(session: DailySession) -> DailySessionOut:
    words = sorted(_live_words(session), key=lambda word: (word.is_new, word.id))
    return DailySessionOut(id=session.id, session_date=session.session_date, status=session.status,
                           phase=session.phase, words=[_word_out(word) for word in words])


def _make_word(session: DailySession, card: Card, is_new: bool, assigned_step: str) -> DailySessionWord:
    review = card.review
    return DailySessionWord(session_id=session.id, card_id=card.id, is_new=is_new, assigned_step=assigned_step,
                            prev_ease=review.ease_factor, prev_interval=review.interval, prev_reps=review.repetitions)


def _create_session(db: Session, user: User) -> DailySession | None:
    if db.query(DailySession).filter(DailySession.user_id == user.id, DailySession.session_date == date.today(), DailySession.status == "done").first():
        return None
    rng = random.Random()
    review_cards, new_cards = daily_service.due_review_cards(db, user.id), daily_service.pick_new_cards(db, user.id, rng=rng)
    if not review_cards and not new_cards:
        return None
    session = DailySession(user_id=user.id, session_date=date.today(), phase="review" if review_cards else "flip")
    db.add(session); db.flush()
    sides = (["vi_en", "en_vi"] * ((len(new_cards) + 1) // 2))[:len(new_cards)]
    rng.shuffle(sides)
    for card, side in zip(new_cards, sides): db.add(_make_word(session, card, True, side))
    for card in review_cards: db.add(_make_word(session, card, False, rng.choice(daily_service.STEPS_REVIEW)))
    db.flush()
    return session


def _active_session(db: Session, user: User) -> DailySession | None:
    return db.query(DailySession).options(joinedload(DailySession.words).joinedload(DailySessionWord.card)).filter(
        DailySession.user_id == user.id, DailySession.status.in_(["learning", "game"])
    ).order_by(DailySession.created_at.asc()).first()


def _get_learning_session(db: Session, user: User) -> DailySession:
    session = _active_session(db, user)
    if session is None or session.status != "learning":
        raise HTTPException(status_code=404, detail="Không có phiên học đang mở")
    return session


@router.get("/session", response_model=DailySessionResponse)
def get_session(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _close_stale_game_sessions(db, user)
    session = _active_session(db, user) or _create_session(db, user)
    db.commit()
    if session is None: return DailySessionResponse(session=None)
    db.refresh(session)
    return DailySessionResponse(session=_session_out(session))


def _required_steps(word: DailySessionWord) -> list[str]:
    return ["flip", "dictation", word.assigned_step] if word.is_new else [word.assigned_step]


def _steps_complete(word: DailySessionWord) -> bool:
    return all(step in set(json.loads(word.steps_done or "[]")) for step in _required_steps(word))


def _current_phase(session: DailySession) -> str:
    words = _live_words(session)
    def missing(word: DailySessionWord, step: str) -> bool: return step not in json.loads(word.steps_done or "[]")
    if any(missing(word, word.assigned_step) for word in words if not word.is_new): return "review"
    new_words = [word for word in words if word.is_new]
    if any(missing(word, "flip") for word in new_words): return "flip"
    if any(missing(word, "dictation") for word in new_words): return "dictation"
    return "split"


@router.post("/answer", response_model=DailyWordOut)
def submit_answer(body: AnswerIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = _get_learning_session(db, user)
    word = next((item for item in _live_words(session) if item.card_id == body.card_id), None)
    if word is None: raise HTTPException(status_code=404, detail="Từ không thuộc phiên hôm nay")
    if body.step not in _required_steps(word): raise HTTPException(status_code=400, detail="Bước không hợp lệ cho từ này")
    if body.correct:
        done = set(json.loads(word.steps_done or "[]")); done.add(body.step); word.steps_done = json.dumps(sorted(done))
    else: word.wrong_count += 1
    session.phase = _current_phase(session)
    db.commit()
    return _word_out(word)


def _apply_sm2(word: DailySessionWord, quality: int) -> None:
    review = word.card.review
    result = compute_sm2(word.prev_ease, word.prev_interval, word.prev_reps, quality)
    review.ease_factor, review.interval, review.repetitions = result["ease_factor"], result["interval"], result["repetitions"]
    review.due_date, review.last_quality, review.last_rating_source = date.today() + timedelta(days=result["interval"]), quality, "daily"
    review.reviewed_at = datetime.utcnow()


def _select_game_words(session: DailySession, rng: random.Random) -> None:
    words = _live_words(session); new_words = [word for word in words if word.is_new]
    pool = ([word for word in words if not word.is_new and word.wrong_count > 0] if new_words else [word for word in words if not word.is_new])
    rng.shuffle(pool); pool.sort(key=lambda word: word.wrong_count, reverse=True)
    chosen = new_words + pool[:daily_service.GAME_REVIEW_WORDS_MAX] if new_words else pool[:daily_service.GAME_REVIEW_ONLY_MAX]
    seen: set[str] = set()
    for word in chosen:
        normalized = word_search.normalize_word(word.card.front_text)
        if normalized and normalized not in seen:
            seen.add(normalized); word.in_game = True


def _build_puzzle(session: DailySession, rng: random.Random) -> None:
    game_words = [word for word in _live_words(session) if word.in_game]
    puzzle = word_search.generate_puzzle([{"card_id": word.card_id, "word": word.card.front_text} for word in game_words], rng)
    meanings = [{"token": uuid.uuid4().hex[:8], "card_id": word.card_id, "meaning": word.card.back_text} for word in game_words]
    rng.shuffle(meanings); puzzle["meanings"] = meanings
    for word in game_words:
        if word.card_id in puzzle["unplaced"]: word.game_found = True
    session.puzzle_json = json.dumps(puzzle)


@router.post("/complete-learning", response_model=DailySessionResponse)
def complete_learning(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = _get_learning_session(db, user)
    if any(not _steps_complete(word) for word in _live_words(session)):
        raise HTTPException(status_code=409, detail="Chưa hoàn thành hết các bước học")
    rng = random.Random()
    for word in _live_words(session):
        quality = daily_service.quality_for_wrong_count(word.wrong_count)
        word.learning_quality = quality; _apply_sm2(word, quality)
        db.add(ReviewLog(user_id=user.id, card_id=word.card_id, quality=quality, rating_source="daily"))
    _select_game_words(session, rng); _build_puzzle(session, rng)
    session.status, session.phase = "game", "game"
    db.commit(); db.refresh(session)
    return DailySessionResponse(session=_session_out(session))


def _game_session(db: Session, user: User) -> DailySession:
    _close_stale_game_sessions(db, user); db.commit()
    session = _active_session(db, user)
    if session is not None and session.status == "learning": raise HTTPException(status_code=409, detail="learning")
    if session is None or session.status != "game": raise HTTPException(status_code=404, detail="Không có game cho hôm nay")
    return session


def _placement_cells(placement: dict) -> list[list[int]]:
    dr, dc = word_search.DIRECTIONS[placement["dir"]]
    return [[placement["row"] + dr * index, placement["col"] + dc * index] for index in range(len(placement["word"]))]


def _chip(word: DailySessionWord, puzzle: dict) -> GameWordChip:
    placement = next((item for item in puzzle["placements"] if item["card_id"] == word.card_id), None)
    return GameWordChip(card_id=word.card_id, word=placement["word"] if placement else word_search.normalize_word(word.card.front_text), cells=_placement_cells(placement) if placement else None)


@router.get("/game", response_model=GameOut)
def get_game(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = _game_session(db, user); puzzle = json.loads(session.puzzle_json or "{}")
    words = [word for word in _live_words(session) if word.in_game]; ids = {word.card_id for word in words}; hints = {word.card_id: word.hint_count for word in words}
    return GameOut(size=puzzle["size"], grid=puzzle["grid"], found=[_chip(word, puzzle) for word in words if word.game_found], total_words=len(words), status=session.status,
                   meanings=[GameMeaning(token=item["token"], meaning=item["meaning"], hint_level=hints.get(item["card_id"], 0)) for item in puzzle["meanings"] if item["card_id"] in ids])


@router.post("/game/found", response_model=FoundOut)
def mark_found(body: FoundIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = _game_session(db, user); puzzle = json.loads(session.puzzle_json or "{}")
    placement = word_search.find_placement(puzzle, body.start_row, body.start_col, body.end_row, body.end_col) or word_search.find_placement(puzzle, body.end_row, body.end_col, body.start_row, body.start_col)
    if placement is None: return FoundOut(matched=None)
    word = next((item for item in _live_words(session) if item.card_id == placement["card_id"]), None)
    if word is None: return FoundOut(matched=None)
    if not word.game_found: word.game_found = True; db.commit()
    return FoundOut(matched=_chip(word, puzzle))


@router.post("/game/hint", response_model=HintOut)
def get_hint(body: HintIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = _game_session(db, user); puzzle = json.loads(session.puzzle_json or "{}")
    meaning = next((item for item in puzzle["meanings"] if item["token"] == body.token), None)
    word = next((item for item in _live_words(session) if meaning and item.card_id == meaning["card_id"]), None)
    if word is None: raise HTTPException(status_code=404, detail="Không tìm thấy nghĩa này")
    if word.hint_count < 2: word.hint_count += 1; db.commit()
    normalized = word_search.normalize_word(word.card.front_text)
    return HintOut(level=word.hint_count, text=f"{normalized[0]} ({len(normalized)} chữ cái)" if word.hint_count == 1 else normalized)


@router.post("/game/confirm", response_model=ConfirmOut)
def confirm_game(body: ConfirmIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = _game_session(db, user); puzzle = json.loads(session.puzzle_json or "{}")
    words = [word for word in _live_words(session) if word.in_game]
    if any(not word.game_found for word in words): raise HTTPException(status_code=409, detail="Chưa tìm hết từ trong ô chữ")
    pair_by_card = {pair.card_id: pair.token for pair in body.pairs}
    if set(pair_by_card) != {word.card_id for word in words}: raise HTTPException(status_code=409, detail="Chưa nối đủ tất cả các từ")
    cards_by_token = {item["token"]: item["card_id"] for item in puzzle["meanings"]}; results = []
    for word in words:
        correct = cards_by_token.get(pair_by_card[word.card_id]) == word.card_id; word.game_correct = correct
        adjusted = 2 if not correct or word.hint_count >= 2 else max(1, (word.learning_quality or 2) - 1) if word.hint_count == 1 else None
        if adjusted is not None: _apply_sm2(word, adjusted)
        results.append(ConfirmResultItem(card_id=word.card_id, word=word_search.normalize_word(word.card.front_text), meaning=word.card.back_text, correct=correct, quality_after=adjusted))
    session.status, session.phase, session.completed_at = "done", "game", datetime.utcnow()
    db.commit()
    return ConfirmOut(results=results)


@router.get("/status", response_model=DailyStatusOut)
def get_status(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _close_stale_game_sessions(db, user); db.commit(); session = _active_session(db, user)
    if session is None:
        session = db.query(DailySession).filter(DailySession.user_id == user.id, DailySession.session_date == date.today(), DailySession.status == "done").first()
    words = _live_words(session) if session else []
    active_new = {word.card_id for word in words if word.is_new} if session and session.status != "done" else set()
    remaining = max(0, daily_service.count_remaining_new(db, user.id) - len(active_new))
    return DailyStatusOut(new_remaining=remaining, low_new_words=remaining <= daily_service.LOW_NEW_WORDS_THRESHOLD,
                          session_status=session.status if session else "none", session_date=session.session_date if session else None,
                          new_count=sum(word.is_new for word in words), due_count=sum(not word.is_new for word in words))


@router.get("/home", response_model=DailyHomeOut)
def get_home(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _close_stale_game_sessions(db, user)
    db.commit()
    session = _active_session(db, user)
    if session is None:
        session = db.query(DailySession).options(
            joinedload(DailySession.words).joinedload(DailySessionWord.card)
        ).filter(
            DailySession.user_id == user.id, DailySession.session_date == date.today(),
            DailySession.status == "done",
        ).first()
    words = _live_words(session) if session else []
    new_words = [word for word in words if word.is_new]
    due_words = [word for word in words if not word.is_new]
    steps_total = len(due_words) + len(new_words) * 3
    steps_done = sum(len(json.loads(word.steps_done or "[]")) for word in words)
    active_new = {word.card_id for word in new_words} if session and session.status != "done" else set()
    remaining = max(0, daily_service.count_remaining_new(db, user.id) - len(active_new))
    counters = daily_service.home_counters(db, user.id)
    latest = counters.latest_article
    return DailyHomeOut(
        new_count=len(new_words), due_count=len(due_words),
        session_status=session.status if session else "none", steps_total=steps_total,
        steps_done=steps_done, streak=counters.streak, studied_today=counters.studied_today,
        mastered_cards=counters.mastered_cards, total_cards=counters.total_cards,
        deck_count=counters.deck_count,
        low_new_words=remaining <= daily_service.LOW_NEW_WORDS_THRESHOLD,
        new_remaining=remaining,
        latest_article=LatestArticleOut(
            id=latest.id, title=latest.title, unlearned_saved_words=latest.unlearned_saved_words
        ) if latest else None,
    )
