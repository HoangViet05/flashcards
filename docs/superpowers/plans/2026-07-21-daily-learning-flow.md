# Daily Learning Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Daily study session (10 new words + SM2-due reviews) with a 4-step learning sequence, one aggregated SM2 submission per word, and a gated word-search + meaning-matching game that adjusts SM2 afterwards.

**Architecture:** New `daily_sessions` / `daily_session_words` tables persist session state and pre-session SM2 snapshots. A new `/api/daily` FastAPI router owns session lifecycle, answer recording, SM2 aggregation, server-side puzzle generation, and game grading. Frontend gets a `/daily` page (learning phases), a rebuilt GamesPage (gate + combined game), and a HomePage CTA/warning. Old mini-games are removed.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 typed mappings + SQLite, pytest; React + TypeScript + Vite + Tailwind, axios.

**Spec:** `docs/superpowers/specs/2026-07-21-daily-learning-flow-design.md` — read it before starting any task.

## Global Constraints

- New tables are created by `Base.metadata.create_all` at startup (existing pattern in `backend/app/main.py`) — no migration scripts needed.
- Session statuses: `learning` → `game` → `done`. Only `learning` blocks a new session; a `game` session from a previous day is auto-closed to `done`.
- Phases: `review` → `flip` → `dictation` → `split` → `game`.
- Steps stored in `assigned_step` / `steps_done`: `flip`, `dictation`, `vi_en`, `en_vi`.
- Quality mapping: wrong_count 0→5, 1→4, 2→3, ≥3→2. Game adjust: level-1 hint → `max(1, learning_quality - 1)`; wrong match or level-2 hint → quality 2. Recompute always starts from the `prev_*` snapshot.
- Grid: max side 13; directions horizontal L→R, vertical T→B, diagonal down-right only; words normalized to A–Z uppercase; too-long/unplaceable words become match-only (auto-found).
- Warning threshold: total unlearned new words ≤ 30.
- ReviewLog `rating_source` for daily sessions: `"daily"`.
- UI copy is Vietnamese, matching the existing app tone.
- Run backend tests from `backend/`: `python -m pytest tests/... -v` (conda env `flashcard`). Frontend check: `npm run build` from `frontend/`.

---

### Task 1: DailySession + DailySessionWord models

**Files:**
- Create: `backend/app/models/daily_session.py`
- Modify: `backend/app/models/__init__.py`
- Test: `backend/tests/test_daily_models.py`

**Interfaces:**
- Produces: `DailySession(id, user_id, session_date, status, phase, puzzle_json, created_at, completed_at, words)` and `DailySessionWord(id, session_id, card_id, is_new, assigned_step, steps_done, wrong_count, hint_count, learning_quality, in_game, game_found, game_correct, prev_ease, prev_interval, prev_reps, session, card)`.

- [ ] **Step 1: Write the failing test**

`backend/tests/test_daily_models.py`:

```python
from datetime import date

from app.models.card import Card
from app.models.daily_session import DailySession, DailySessionWord
from app.models.deck import Deck
from app.models.review import Review
from app.models.user import User


def test_daily_session_word_roundtrip(db):
    user = User(email="m@test.com", password_hash="x", name="m")
    db.add(user)
    db.flush()
    deck = Deck(user_id=user.id, name="D")
    db.add(deck)
    db.flush()
    card = Card(deck_id=deck.id, front_text="docker", back_text="nền tảng container")
    db.add(card)
    db.flush()
    db.add(Review(card_id=card.id, due_date=date.today()))

    session = DailySession(user_id=user.id)
    db.add(session)
    db.flush()
    word = DailySessionWord(
        session_id=session.id, card_id=card.id, is_new=True, assigned_step="vi_en",
        prev_ease=2.5, prev_interval=1, prev_reps=0,
    )
    db.add(word)
    db.commit()

    loaded = db.query(DailySession).filter(DailySession.user_id == user.id).one()
    assert loaded.status == "learning"
    assert loaded.phase == "review"
    assert loaded.session_date == date.today()
    assert len(loaded.words) == 1
    assert loaded.words[0].card.front_text == "docker"
    assert loaded.words[0].steps_done == "[]"
    assert loaded.words[0].wrong_count == 0
    assert loaded.words[0].in_game is False

    db.delete(loaded)
    db.commit()
    assert db.query(DailySessionWord).count() == 0  # cascade delete
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_daily_models.py -v` (from `backend/`)
Expected: FAIL with `ModuleNotFoundError: No module named 'app.models.daily_session'`

- [ ] **Step 3: Write the models**

`backend/app/models/daily_session.py`:

```python
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DailySession(Base):
    __tablename__ = "daily_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    session_date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="learning")  # learning | game | done
    phase: Mapped[str] = mapped_column(String(20), nullable=False, default="review")  # review | flip | dictation | split | game
    puzzle_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    words: Mapped[list["DailySessionWord"]] = relationship(
        "DailySessionWord", back_populates="session", cascade="all, delete-orphan"
    )


class DailySessionWord(Base):
    __tablename__ = "daily_session_words"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("daily_sessions.id"), nullable=False, index=True)
    card_id: Mapped[str] = mapped_column(String(36), ForeignKey("cards.id"), nullable=False)
    is_new: Mapped[bool] = mapped_column(Boolean, nullable=False)
    assigned_step: Mapped[str] = mapped_column(String(20), nullable=False)  # dictation | vi_en | en_vi
    steps_done: Mapped[str] = mapped_column(Text, nullable=False, default="[]")  # JSON list of finished steps
    wrong_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    hint_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # 0 | 1 | 2
    learning_quality: Mapped[int | None] = mapped_column(Integer, nullable=True)
    in_game: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    game_found: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    game_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    prev_ease: Mapped[float] = mapped_column(Float, nullable=False)
    prev_interval: Mapped[int] = mapped_column(Integer, nullable=False)
    prev_reps: Mapped[int] = mapped_column(Integer, nullable=False)

    session: Mapped["DailySession"] = relationship("DailySession", back_populates="words")
    card: Mapped["Card"] = relationship("Card")


from app.models.card import Card  # noqa: E402,F401  (resolve forward ref for typed relationship)
```

Append to `backend/app/models/__init__.py`:

```python
from app.models.daily_session import DailySession, DailySessionWord  # noqa: F401
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_daily_models.py -v`
Expected: PASS

- [ ] **Step 5: Run full backend suite to check nothing broke**

Run: `python -m pytest`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/daily_session.py backend/app/models/__init__.py backend/tests/test_daily_models.py
git commit -m "feat(daily): add DailySession and DailySessionWord models"
```

---

### Task 2: Word-search puzzle generator service

**Files:**
- Create: `backend/app/services/word_search.py`
- Test: `backend/tests/test_word_search.py`

**Interfaces:**
- Produces:
  - `normalize_word(text: str) -> str` — A–Z uppercase only.
  - `generate_puzzle(entries: list[dict], rng: random.Random | None = None) -> dict` — entries `[{"card_id", "word"}]` (caller already deduplicated); returns `{"size": int, "grid": list[list[str]], "placements": [{"card_id","word","row","col","dir"}], "unplaced": [card_id, ...]}`.
  - `find_placement(puzzle: dict, start_row, start_col, end_row, end_col) -> dict | None` — exact-coordinate lookup.
  - `DIRECTIONS = {"h": (0, 1), "v": (1, 0), "d": (1, 1)}`, `MAX_SIZE = 13`.

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_word_search.py`:

```python
import random

from app.services.word_search import MAX_SIZE, find_placement, generate_puzzle, normalize_word


def _entries(words):
    return [{"card_id": f"c{i}", "word": w} for i, w in enumerate(words)]


def test_normalize_word():
    assert normalize_word("give up") == "GIVEUP"
    assert normalize_word("well-known") == "WELLKNOWN"
    assert normalize_word("café 123!") == "CAF"
    assert normalize_word("") == ""


def test_all_words_placed_and_findable():
    words = ["docker", "queue", "resilient", "throughput", "cache", "deploy", "branch", "merge", "commit", "stash"]
    puzzle = generate_puzzle(_entries(words), rng=random.Random(42))
    assert puzzle["unplaced"] == []
    assert len(puzzle["placements"]) == len(words)
    assert puzzle["size"] <= MAX_SIZE
    for placement in puzzle["placements"]:
        # letters on the grid actually spell the word
        from app.services.word_search import DIRECTIONS
        dr, dc = DIRECTIONS[placement["dir"]]
        spelled = "".join(
            puzzle["grid"][placement["row"] + dr * i][placement["col"] + dc * i]
            for i in range(len(placement["word"]))
        )
        assert spelled == placement["word"]
        # and find_placement resolves the exact coordinates
        last = len(placement["word"]) - 1
        found = find_placement(
            puzzle, placement["row"], placement["col"],
            placement["row"] + dr * last, placement["col"] + dc * last,
        )
        assert found is not None and found["card_id"] == placement["card_id"]


def test_grid_fully_filled():
    puzzle = generate_puzzle(_entries(["alpha", "beta"]), rng=random.Random(1))
    assert all(cell.isalpha() and cell.isupper() for row in puzzle["grid"] for cell in row)


def test_too_long_word_is_unplaced():
    puzzle = generate_puzzle(_entries(["extraordinarily", "cat"]), rng=random.Random(1))  # 15 letters > 13
    assert "c0" in puzzle["unplaced"]
    assert [p["card_id"] for p in puzzle["placements"]] == ["c1"]


def test_empty_word_is_unplaced():
    puzzle = generate_puzzle(_entries(["123!", "dog"]), rng=random.Random(1))
    assert "c0" in puzzle["unplaced"]


def test_find_placement_no_match():
    puzzle = generate_puzzle(_entries(["dog"]), rng=random.Random(1))
    assert find_placement(puzzle, 99, 99, 99, 99) is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_word_search.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.word_search'`

- [ ] **Step 3: Implement the generator**

`backend/app/services/word_search.py`:

```python
import math
import random
import re
import string

MAX_SIZE = 13
DIRECTIONS = {"h": (0, 1), "v": (1, 0), "d": (1, 1)}


def normalize_word(text: str) -> str:
    """Uppercase and strip everything that is not an ASCII letter."""
    return re.sub(r"[^A-Za-z]", "", text or "").upper()


def _attempt(words: list[dict], size: int, rng: random.Random):
    """Try to place every word on a size x size grid. Longest-first, prefer overlaps."""
    grid: list[list[str | None]] = [[None] * size for _ in range(size)]
    placements: list[dict] = []
    failed: list[dict] = []
    for entry in words:
        word = entry["word"]
        options: list[tuple[int, int, int, str]] = []
        for direction, (dr, dc) in DIRECTIONS.items():
            for row in range(size):
                for col in range(size):
                    if row + dr * (len(word) - 1) >= size or col + dc * (len(word) - 1) >= size:
                        continue
                    overlap, ok = 0, True
                    for i, letter in enumerate(word):
                        cell = grid[row + dr * i][col + dc * i]
                        if cell is not None:
                            if cell != letter:
                                ok = False
                                break
                            overlap += 1
                    if ok:
                        options.append((overlap, row, col, direction))
        if not options:
            failed.append(entry)
            continue
        best = max(option[0] for option in options)
        _, row, col, direction = rng.choice([o for o in options if o[0] == best])
        dr, dc = DIRECTIONS[direction]
        for i, letter in enumerate(word):
            grid[row + dr * i][col + dc * i] = letter
        placements.append({"card_id": entry["card_id"], "word": word, "row": row, "col": col, "dir": direction})
    return grid, placements, failed


def generate_puzzle(entries: list[dict], rng: random.Random | None = None) -> dict:
    """entries: [{"card_id", "word"}], already deduplicated by the caller.

    Words that are empty after normalization, longer than MAX_SIZE, or
    unplaceable end up in "unplaced" (match-only, auto-found).
    """
    rng = rng or random.Random()
    words: list[dict] = []
    unplaced: list[str] = []
    for entry in entries:
        norm = normalize_word(entry["word"])
        if not norm or len(norm) > MAX_SIZE:
            unplaced.append(entry["card_id"])
        else:
            words.append({"card_id": entry["card_id"], "word": norm})
    if not words:
        return {"size": 0, "grid": [], "placements": [], "unplaced": unplaced}

    words.sort(key=lambda w: len(w["word"]), reverse=True)
    total_letters = sum(len(w["word"]) for w in words)
    size = min(MAX_SIZE, max(len(words[0]["word"]), math.isqrt(total_letters * 2) + 1))
    while True:
        grid, placements, failed = _attempt(words, size, rng)
        if not failed or size >= MAX_SIZE:
            break
        size += 1
    unplaced.extend(entry["card_id"] for entry in failed)
    for row in range(size):
        for col in range(size):
            if grid[row][col] is None:
                grid[row][col] = rng.choice(string.ascii_uppercase)
    return {"size": size, "grid": grid, "placements": placements, "unplaced": unplaced}


def find_placement(puzzle: dict, start_row: int, start_col: int, end_row: int, end_col: int) -> dict | None:
    """Return the placement whose exact start/end cells match, else None."""
    for placement in puzzle["placements"]:
        dr, dc = DIRECTIONS[placement["dir"]]
        last = len(placement["word"]) - 1
        if (placement["row"], placement["col"]) == (start_row, start_col) and (
            placement["row"] + dr * last,
            placement["col"] + dc * last,
        ) == (end_row, end_col):
            return placement
    return None
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_word_search.py -v`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/word_search.py backend/tests/test_word_search.py
git commit -m "feat(daily): add word-search puzzle generator"
```

---

### Task 3: Daily selection service (new-word picking, due reviews, quality mapping)

**Files:**
- Create: `backend/app/services/daily.py`
- Test: `backend/tests/test_daily_service.py`

**Interfaces:**
- Consumes: `Card`, `Deck`, `Review` models.
- Produces:
  - `NEW_WORDS_PER_DAY = 10`, `GAME_REVIEW_WORDS_MAX = 5`, `GAME_REVIEW_ONLY_MAX = 15`, `LOW_NEW_WORDS_THRESHOLD = 30`, `STEPS_REVIEW = ("dictation", "vi_en", "en_vi")`.
  - `quality_for_wrong_count(wrong_count: int) -> int`.
  - `count_remaining_new(db, user_id) -> int`.
  - `pick_new_cards(db, user_id, limit=10, rng=None) -> list[Card]` — oldest deck first, tops up from next decks.
  - `due_review_cards(db, user_id) -> list[Card]` — due today, `repetitions > 0`.

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_daily_service.py`:

```python
import random
from datetime import date, datetime, timedelta

from app.models.card import Card
from app.models.deck import Deck
from app.models.review import Review
from app.models.user import User
from app.services.daily import (
    count_remaining_new,
    due_review_cards,
    pick_new_cards,
    quality_for_wrong_count,
)


def _user(db):
    user = User(email="s@test.com", password_hash="x", name="s")
    db.add(user)
    db.flush()
    return user


def _deck(db, user, name, created_at):
    deck = Deck(user_id=user.id, name=name, created_at=created_at)
    db.add(deck)
    db.flush()
    return deck


def _card(db, deck, front, learned=False, due_offset=0):
    card = Card(deck_id=deck.id, front_text=front, back_text=f"nghĩa {front}")
    db.add(card)
    db.flush()
    review = Review(card_id=card.id, due_date=date.today() + timedelta(days=due_offset))
    if learned:
        review.repetitions = 2
        review.reviewed_at = datetime.utcnow()
    db.add(review)
    db.flush()
    return card


def test_quality_for_wrong_count():
    assert quality_for_wrong_count(0) == 5
    assert quality_for_wrong_count(1) == 4
    assert quality_for_wrong_count(2) == 3
    assert quality_for_wrong_count(3) == 2
    assert quality_for_wrong_count(9) == 2


def test_pick_new_cards_oldest_deck_first_with_topup(db):
    user = _user(db)
    old_deck = _deck(db, user, "old", datetime(2026, 1, 1))
    new_deck = _deck(db, user, "new", datetime(2026, 6, 1))
    for i in range(4):
        _card(db, old_deck, f"old{i}")
    _card(db, old_deck, "learned", learned=True)  # already learned, must be skipped
    for i in range(20):
        _card(db, new_deck, f"new{i}")

    picked = pick_new_cards(db, user.id, rng=random.Random(1))
    assert len(picked) == 10
    fronts = [card.front_text for card in picked]
    assert all(f.startswith("old") for f in fronts[:4])  # oldest deck exhausted first
    assert all(f.startswith("new") for f in fronts[4:])  # topped up from next deck
    assert "learned" not in fronts


def test_count_remaining_new(db):
    user = _user(db)
    deck = _deck(db, user, "d", datetime(2026, 1, 1))
    _card(db, deck, "a")
    _card(db, deck, "b")
    _card(db, deck, "c", learned=True)
    assert count_remaining_new(db, user.id) == 2


def test_due_review_cards_excludes_new_and_future(db):
    user = _user(db)
    deck = _deck(db, user, "d", datetime(2026, 1, 1))
    _card(db, deck, "new-word")                       # new → excluded
    due = _card(db, deck, "due", learned=True)        # due today → included
    _card(db, deck, "future", learned=True, due_offset=3)  # future → excluded
    cards = due_review_cards(db, user.id)
    assert [card.id for card in cards] == [due.id]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_daily_service.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.daily'`

- [ ] **Step 3: Implement the service**

`backend/app/services/daily.py`:

```python
import random
from datetime import date

from sqlalchemy.orm import Session

from app.models.card import Card
from app.models.deck import Deck
from app.models.review import Review

NEW_WORDS_PER_DAY = 10
GAME_REVIEW_WORDS_MAX = 5
GAME_REVIEW_ONLY_MAX = 15
LOW_NEW_WORDS_THRESHOLD = 30
STEPS_REVIEW = ("dictation", "vi_en", "en_vi")


def quality_for_wrong_count(wrong_count: int) -> int:
    return {0: 5, 1: 4, 2: 3}.get(wrong_count, 2)


def _new_cards_query(db: Session, user_id: str):
    return (
        db.query(Card)
        .join(Review, Review.card_id == Card.id)
        .join(Deck, Card.deck_id == Deck.id)
        .filter(Deck.user_id == user_id, Review.repetitions == 0, Review.reviewed_at.is_(None))
    )


def count_remaining_new(db: Session, user_id: str) -> int:
    return _new_cards_query(db, user_id).count()


def pick_new_cards(
    db: Session, user_id: str, limit: int = NEW_WORDS_PER_DAY, rng: random.Random | None = None
) -> list[Card]:
    """Oldest deck (by created_at) first; top up from the next deck when it runs out."""
    rng = rng or random.Random()
    picked: list[Card] = []
    decks = (
        db.query(Deck)
        .filter(Deck.user_id == user_id)
        .order_by(Deck.created_at.asc(), Deck.id.asc())
        .all()
    )
    for deck in decks:
        if len(picked) >= limit:
            break
        candidates = _new_cards_query(db, user_id).filter(Card.deck_id == deck.id).all()
        rng.shuffle(candidates)
        picked.extend(candidates[: limit - len(picked)])
    return picked


def due_review_cards(db: Session, user_id: str) -> list[Card]:
    return (
        db.query(Card)
        .join(Review, Review.card_id == Card.id)
        .join(Deck, Card.deck_id == Deck.id)
        .filter(Deck.user_id == user_id, Review.due_date <= date.today(), Review.repetitions > 0)
        .all()
    )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_daily_service.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/daily.py backend/tests/test_daily_service.py
git commit -m "feat(daily): add word selection and quality mapping service"
```

---

### Task 4: Schemas + GET /api/daily/session (create / resume / stale auto-close)

**Files:**
- Create: `backend/app/schemas/daily.py`
- Create: `backend/app/routers/daily.py`
- Modify: `backend/app/main.py` (import + `app.include_router(daily.router)` — add `daily` to the first `from app.routers import ...` line and the router after `review.router`)
- Test: `backend/tests/test_daily_session_api.py`

**Interfaces:**
- Consumes: Task 1 models, Task 3 service, `CardOut` from `app.schemas.card`, `get_current_user`, `get_db`.
- Produces (used by every later task):
  - Schemas: `DailyWordOut(id, card_id, is_new, assigned_step, steps_done: list[str], wrong_count, card: CardOut)`, `DailySessionOut(id, session_date, status, phase, words: list[DailyWordOut])`, `DailySessionResponse(session: DailySessionOut | None)`, `AnswerIn(card_id, step, correct)`, `GameMeaning(token, meaning, hint_level)`, `GameWordChip(card_id, word, cells: list[list[int]] | None)`, `GameOut(size, grid, meanings, found, total_words, status)`, `FoundIn(start_row, start_col, end_row, end_col)`, `FoundOut(matched: GameWordChip | None)`, `HintIn(token)`, `HintOut(level, text)`, `MatchPair(card_id, token)`, `ConfirmIn(pairs: list[MatchPair])`, `ConfirmResultItem(card_id, word, meaning, correct, quality_after: int | None)`, `ConfirmOut(results)`, `DailyStatusOut(new_remaining, low_new_words, session_status, session_date: date | None, new_count, due_count)`.
  - Router helpers: `_close_stale_game_sessions(db, user)`, `_word_out(word)`, `_session_out(session)`, `_get_learning_session(db, user)` (raises 404 when absent).

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_daily_session_api.py`:

```python
from datetime import date, datetime, timedelta

from app.models.daily_session import DailySession
from app.models.review import Review


def _make_deck_with_cards(client, name, count, prefix):
    deck = client.post("/api/decks", json={"name": name}).json()
    for i in range(count):
        res = client.post(
            f"/api/decks/{deck['id']}/cards",
            json={"front_text": f"{prefix}{i}", "back_text": f"nghĩa {prefix}{i}"},
        )
        assert res.status_code == 200
    return deck


def test_session_created_with_new_words_only(client):
    _make_deck_with_cards(client, "Deck A", 15, "worda")
    res = client.get("/api/daily/session")
    assert res.status_code == 200
    session = res.json()["session"]
    assert session["status"] == "learning"
    assert session["phase"] == "flip"  # no due reviews → starts at flip
    new_words = [w for w in session["words"] if w["is_new"]]
    assert len(new_words) == 10
    sides = {w["assigned_step"] for w in new_words}
    assert sides == {"vi_en", "en_vi"}
    assert len([w for w in new_words if w["assigned_step"] == "vi_en"]) == 5


def test_session_includes_due_reviews_and_review_steps(client, db):
    _make_deck_with_cards(client, "Deck A", 12, "w")
    # mark 3 cards as previously learned and due today
    for review in db.query(Review).limit(3).all():
        review.repetitions = 2
        review.reviewed_at = datetime.utcnow()
        review.due_date = date.today()
    db.commit()
    session = client.get("/api/daily/session").json()["session"]
    assert session["phase"] == "review"
    review_words = [w for w in session["words"] if not w["is_new"]]
    assert len(review_words) == 3
    assert all(w["assigned_step"] in ("dictation", "vi_en", "en_vi") for w in review_words)
    new_words = [w for w in session["words"] if w["is_new"]]
    assert len(new_words) == 9  # only 9 unlearned left


def test_session_resumes_same_words(client):
    _make_deck_with_cards(client, "Deck A", 15, "w")
    first = client.get("/api/daily/session").json()["session"]
    second = client.get("/api/daily/session").json()["session"]
    assert first["id"] == second["id"]
    assert [w["card_id"] for w in first["words"]] == [w["card_id"] for w in second["words"]]


def test_empty_account_returns_null_session(client):
    res = client.get("/api/daily/session")
    assert res.status_code == 200
    assert res.json()["session"] is None


def test_stale_game_session_auto_closes(client, db):
    _make_deck_with_cards(client, "Deck A", 15, "w")
    session_id = client.get("/api/daily/session").json()["session"]["id"]
    stale = db.query(DailySession).filter(DailySession.id == session_id).one()
    stale.status = "game"
    stale.session_date = date.today() - timedelta(days=1)
    db.commit()
    fresh = client.get("/api/daily/session").json()["session"]
    assert fresh is not None and fresh["id"] != session_id
    db.refresh(stale)
    assert stale.status == "done"


def test_learning_session_from_yesterday_blocks_new_session(client, db):
    _make_deck_with_cards(client, "Deck A", 15, "w")
    session_id = client.get("/api/daily/session").json()["session"]["id"]
    old = db.query(DailySession).filter(DailySession.id == session_id).one()
    old.session_date = date.today() - timedelta(days=1)
    db.commit()
    again = client.get("/api/daily/session").json()["session"]
    assert again["id"] == session_id
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_daily_session_api.py -v`
Expected: FAIL (404s — router does not exist yet)

- [ ] **Step 3: Write schemas**

`backend/app/schemas/daily.py`:

```python
from datetime import date

from pydantic import BaseModel

from app.schemas.card import CardOut


class DailyWordOut(BaseModel):
    id: str
    card_id: str
    is_new: bool
    assigned_step: str
    steps_done: list[str]
    wrong_count: int
    card: CardOut


class DailySessionOut(BaseModel):
    id: str
    session_date: date
    status: str
    phase: str
    words: list[DailyWordOut]


class DailySessionResponse(BaseModel):
    session: DailySessionOut | None


class AnswerIn(BaseModel):
    card_id: str
    step: str
    correct: bool


class GameMeaning(BaseModel):
    token: str
    meaning: str
    hint_level: int


class GameWordChip(BaseModel):
    card_id: str
    word: str
    cells: list[list[int]] | None  # [[row, col], ...]; None when match-only


class GameOut(BaseModel):
    size: int
    grid: list[list[str]]
    meanings: list[GameMeaning]
    found: list[GameWordChip]
    total_words: int
    status: str


class FoundIn(BaseModel):
    start_row: int
    start_col: int
    end_row: int
    end_col: int


class FoundOut(BaseModel):
    matched: GameWordChip | None


class HintIn(BaseModel):
    token: str


class HintOut(BaseModel):
    level: int
    text: str


class MatchPair(BaseModel):
    card_id: str
    token: str


class ConfirmIn(BaseModel):
    pairs: list[MatchPair]


class ConfirmResultItem(BaseModel):
    card_id: str
    word: str
    meaning: str
    correct: bool
    quality_after: int | None


class ConfirmOut(BaseModel):
    results: list[ConfirmResultItem]


class DailyStatusOut(BaseModel):
    new_remaining: int
    low_new_words: bool
    session_status: str  # none | learning | game | done
    session_date: date | None
    new_count: int
    due_count: int
```

- [ ] **Step 4: Write the router with GET /session**

`backend/app/routers/daily.py`:

```python
import json
import random
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.card import Card
from app.models.daily_session import DailySession, DailySessionWord
from app.models.user import User
from app.schemas.card import CardOut
from app.schemas.daily import DailySessionOut, DailySessionResponse, DailyWordOut
from app.services import daily as daily_service
from app.services.security import get_current_user

router = APIRouter(prefix="/api/daily", tags=["daily"])


def _close_stale_game_sessions(db: Session, user: User) -> None:
    stale = (
        db.query(DailySession)
        .filter(
            DailySession.user_id == user.id,
            DailySession.status == "game",
            DailySession.session_date < date.today(),
        )
        .all()
    )
    for session in stale:
        session.status = "done"
        session.completed_at = datetime.utcnow()


def _live_words(session: DailySession) -> list[DailySessionWord]:
    """Cards can be deleted mid-session; orphaned session words are skipped everywhere."""
    return [word for word in session.words if word.card is not None]


def _word_out(word: DailySessionWord) -> DailyWordOut:
    return DailyWordOut(
        id=word.id,
        card_id=word.card_id,
        is_new=word.is_new,
        assigned_step=word.assigned_step,
        steps_done=json.loads(word.steps_done or "[]"),
        wrong_count=word.wrong_count,
        card=CardOut.model_validate(word.card),
    )


def _session_out(session: DailySession) -> DailySessionOut:
    words = sorted(_live_words(session), key=lambda w: (w.is_new, w.id))
    return DailySessionOut(
        id=session.id,
        session_date=session.session_date,
        status=session.status,
        phase=session.phase,
        words=[_word_out(word) for word in words],
    )


def _make_word(session: DailySession, card: Card, is_new: bool, assigned_step: str) -> DailySessionWord:
    review = card.review
    return DailySessionWord(
        session_id=session.id,
        card_id=card.id,
        is_new=is_new,
        assigned_step=assigned_step,
        prev_ease=review.ease_factor,
        prev_interval=review.interval,
        prev_reps=review.repetitions,
    )


def _create_session(db: Session, user: User) -> DailySession | None:
    done_today = (
        db.query(DailySession)
        .filter(
            DailySession.user_id == user.id,
            DailySession.session_date == date.today(),
            DailySession.status == "done",
        )
        .first()
    )
    if done_today:
        return None  # one session per day

    rng = random.Random()
    review_cards = daily_service.due_review_cards(db, user.id)
    new_cards = daily_service.pick_new_cards(db, user.id, rng=rng)
    if not review_cards and not new_cards:
        return None

    session = DailySession(
        user_id=user.id,
        session_date=date.today(),
        phase="review" if review_cards else "flip",
    )
    db.add(session)
    db.flush()
    sides = (["vi_en", "en_vi"] * ((len(new_cards) + 1) // 2))[: len(new_cards)]
    rng.shuffle(sides)
    for card, side in zip(new_cards, sides):
        db.add(_make_word(session, card, is_new=True, assigned_step=side))
    for card in review_cards:
        db.add(_make_word(session, card, is_new=False, assigned_step=rng.choice(daily_service.STEPS_REVIEW)))
    db.flush()
    return session


def _active_session(db: Session, user: User) -> DailySession | None:
    return (
        db.query(DailySession)
        .options(joinedload(DailySession.words).joinedload(DailySessionWord.card))
        .filter(DailySession.user_id == user.id, DailySession.status.in_(["learning", "game"]))
        .order_by(DailySession.created_at.asc())
        .first()
    )


def _get_learning_session(db: Session, user: User) -> DailySession:
    session = _active_session(db, user)
    if session is None or session.status != "learning":
        raise HTTPException(status_code=404, detail="Không có phiên học đang mở")
    return session


@router.get("/session", response_model=DailySessionResponse)
def get_session(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _close_stale_game_sessions(db, user)
    session = _active_session(db, user)
    if session is None:
        session = _create_session(db, user)
    db.commit()
    if session is None:
        return DailySessionResponse(session=None)
    db.refresh(session)
    return DailySessionResponse(session=_session_out(session))
```

Modify `backend/app/main.py`: change the import line to
`from app.routers import articles, cards, daily, decks, dictionary, documents, games, review, shadowing`
and add `app.include_router(daily.router)` directly after `app.include_router(review.router)`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `python -m pytest tests/test_daily_session_api.py -v`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/app/schemas/daily.py backend/app/routers/daily.py backend/app/main.py backend/tests/test_daily_session_api.py
git commit -m "feat(daily): add session schemas and GET /api/daily/session"
```

---

### Task 5: POST /api/daily/answer

**Files:**
- Modify: `backend/app/routers/daily.py`
- Test: `backend/tests/test_daily_answer_api.py`

**Interfaces:**
- Consumes: `_get_learning_session`, `_word_out`, `AnswerIn` from Task 4.
- Produces: `POST /api/daily/answer` body `{card_id, step, correct}` → `DailyWordOut`; updates `session.phase` server-side via `_current_phase(session)`.

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_daily_answer_api.py`:

```python
def _start_session(client):
    deck = client.post("/api/decks", json={"name": "D"}).json()
    for i in range(10):
        client.post(f"/api/decks/{deck['id']}/cards", json={"front_text": f"w{i}", "back_text": f"n{i}"})
    return client.get("/api/daily/session").json()["session"]


def test_correct_answer_marks_step_done(client):
    session = _start_session(client)
    word = session["words"][0]
    res = client.post("/api/daily/answer", json={"card_id": word["card_id"], "step": "flip", "correct": True})
    assert res.status_code == 200
    assert res.json()["steps_done"] == ["flip"]
    assert res.json()["wrong_count"] == 0


def test_wrong_answer_increments_wrong_count_only(client):
    session = _start_session(client)
    word = session["words"][0]
    res = client.post("/api/daily/answer", json={"card_id": word["card_id"], "step": "dictation", "correct": False})
    assert res.json()["wrong_count"] == 1
    assert res.json()["steps_done"] == []


def test_invalid_step_for_word_rejected(client):
    session = _start_session(client)
    word = session["words"][0]  # new word: allowed steps are flip, dictation, assigned_step
    wrong_step = "vi_en" if word["assigned_step"] == "en_vi" else "en_vi"
    res = client.post("/api/daily/answer", json={"card_id": word["card_id"], "step": wrong_step, "correct": True})
    assert res.status_code == 400


def test_unknown_card_rejected(client):
    _start_session(client)
    res = client.post("/api/daily/answer", json={"card_id": "nope", "step": "flip", "correct": True})
    assert res.status_code == 404


def test_phase_advances_as_steps_complete(client):
    session = _start_session(client)
    for word in session["words"]:
        client.post("/api/daily/answer", json={"card_id": word["card_id"], "step": "flip", "correct": True})
    assert client.get("/api/daily/session").json()["session"]["phase"] == "dictation"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_daily_answer_api.py -v`
Expected: FAIL with 404/405 (endpoint missing)

- [ ] **Step 3: Implement the endpoint**

Append to `backend/app/routers/daily.py` (also add `AnswerIn` to the schema imports):

```python
def _required_steps(word: DailySessionWord) -> list[str]:
    if word.is_new:
        return ["flip", "dictation", word.assigned_step]
    return [word.assigned_step]


def _steps_complete(word: DailySessionWord) -> bool:
    done = set(json.loads(word.steps_done or "[]"))
    return all(step in done for step in _required_steps(word))


def _current_phase(session: DailySession) -> str:
    def missing(word: DailySessionWord, step: str) -> bool:
        return step not in json.loads(word.steps_done or "[]")

    words = _live_words(session)
    review_words = [w for w in words if not w.is_new]
    if any(missing(w, w.assigned_step) for w in review_words):
        return "review"
    new_words = [w for w in words if w.is_new]
    if any(missing(w, "flip") for w in new_words):
        return "flip"
    if any(missing(w, "dictation") for w in new_words):
        return "dictation"
    return "split"


@router.post("/answer", response_model=DailyWordOut)
def submit_answer(body: AnswerIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = _get_learning_session(db, user)
    word = next((w for w in _live_words(session) if w.card_id == body.card_id), None)
    if word is None:
        raise HTTPException(status_code=404, detail="Từ không thuộc phiên hôm nay")
    if body.step not in _required_steps(word):
        raise HTTPException(status_code=400, detail="Bước không hợp lệ cho từ này")
    if body.correct:
        done = set(json.loads(word.steps_done or "[]"))
        done.add(body.step)
        word.steps_done = json.dumps(sorted(done))
    else:
        word.wrong_count += 1
    session.phase = _current_phase(session)
    db.commit()
    return _word_out(word)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_daily_answer_api.py -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/daily.py backend/tests/test_daily_answer_api.py
git commit -m "feat(daily): record step answers and advance phase"
```

---

### Task 6: POST /api/daily/complete-learning (SM2 submit + game selection + puzzle build)

**Files:**
- Modify: `backend/app/routers/daily.py`
- Test: `backend/tests/test_daily_complete_api.py`

**Interfaces:**
- Consumes: Task 2 (`generate_puzzle`, `normalize_word`), Task 3 (`quality_for_wrong_count`, `GAME_REVIEW_WORDS_MAX`, `GAME_REVIEW_ONLY_MAX`), `compute_sm2`, `ReviewLog`.
- Produces:
  - `POST /api/daily/complete-learning` → `DailySessionResponse` (status `game`).
  - `_apply_sm2(word, quality)` — recomputes SM2 from `prev_*` snapshot and overwrites the card's review (used again by Task 8).
  - `puzzle_json` layout: `{"size", "grid", "placements", "unplaced", "meanings": [{"token","card_id","meaning"}]}`.

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_daily_complete_api.py`:

```python
import json
from datetime import date, timedelta

from app.models.daily_session import DailySession
from app.models.review import Review
from app.models.review_log import ReviewLog

# Distinct after normalization! normalize_word strips digits, so "word0".."word9"
# would all collapse to "WORD" and the game would dedupe them down to one word.
WORDS = ["apple", "banana", "cherry", "dragon", "eagle", "falcon", "grape", "honey", "island", "jungle"]


def _finish_learning(client, session, wrong_cards=()):
    """Complete every required step; cards in wrong_cards get one wrong answer first."""
    for word in session["words"]:
        steps = ["flip", "dictation", word["assigned_step"]] if word["is_new"] else [word["assigned_step"]]
        for step in steps:
            if word["card_id"] in wrong_cards and step == steps[-1]:
                client.post("/api/daily/answer", json={"card_id": word["card_id"], "step": step, "correct": False})
            client.post("/api/daily/answer", json={"card_id": word["card_id"], "step": step, "correct": True})


def _start_session(client, count=10):
    deck = client.post("/api/decks", json={"name": "D"}).json()
    for i in range(count):
        client.post(f"/api/decks/{deck['id']}/cards", json={"front_text": WORDS[i], "back_text": f"nghĩa {i}"})
    return client.get("/api/daily/session").json()["session"]


def test_complete_rejected_while_steps_missing(client):
    _start_session(client)
    res = client.post("/api/daily/complete-learning")
    assert res.status_code == 409


def test_complete_submits_sm2_and_builds_puzzle(client, db):
    session = _start_session(client)
    wrong_card = session["words"][0]["card_id"]
    _finish_learning(client, session, wrong_cards={wrong_card})

    res = client.post("/api/daily/complete-learning")
    assert res.status_code == 200
    assert res.json()["session"]["status"] == "game"

    # SM2 applied: perfect words got quality 5 → interval 1, repetitions 1
    clean_review = db.query(Review).filter(Review.card_id == session["words"][1]["card_id"]).one()
    assert clean_review.repetitions == 1
    assert clean_review.last_quality == 5
    assert clean_review.due_date == date.today() + timedelta(days=1)
    wrong_review = db.query(Review).filter(Review.card_id == wrong_card).one()
    assert wrong_review.last_quality == 4  # one wrong → 4

    assert db.query(ReviewLog).filter(ReviewLog.rating_source == "daily").count() == 10

    stored = db.query(DailySession).filter(DailySession.id == session["id"]).one()
    puzzle = json.loads(stored.puzzle_json)
    assert len(puzzle["meanings"]) == 10  # all 10 new words in game
    assert {w.card_id for w in stored.words if w.in_game} == {w["card_id"] for w in session["words"]}
    assert puzzle["size"] <= 13


def test_complete_twice_rejected(client):
    session = _start_session(client)
    _finish_learning(client, session)
    assert client.post("/api/daily/complete-learning").status_code == 200
    assert client.post("/api/daily/complete-learning").status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_daily_complete_api.py -v`
Expected: FAIL (endpoint missing → 404/405 on POST)

- [ ] **Step 3: Implement the endpoint**

Append to `backend/app/routers/daily.py`. Add imports at top of file: `import uuid`, `from datetime import timedelta`, `from app.models.review_log import ReviewLog`, `from app.services import word_search`, `from app.services.sm2 import compute_sm2`.

```python
def _apply_sm2(word: DailySessionWord, quality: int) -> None:
    """Recompute SM2 from the pre-session snapshot and overwrite the review."""
    review = word.card.review
    result = compute_sm2(word.prev_ease, word.prev_interval, word.prev_reps, quality)
    review.ease_factor = result["ease_factor"]
    review.interval = result["interval"]
    review.repetitions = result["repetitions"]
    review.due_date = date.today() + timedelta(days=result["interval"])
    review.last_quality = quality
    review.last_rating_source = "daily"
    review.reviewed_at = datetime.utcnow()


def _select_game_words(session: DailySession, rng: random.Random) -> None:
    words = _live_words(session)
    new_words = [w for w in words if w.is_new]
    if new_words:
        review_pool = [w for w in words if not w.is_new and w.wrong_count > 0]
        rng.shuffle(review_pool)
        review_pool.sort(key=lambda w: w.wrong_count, reverse=True)
        chosen = new_words + review_pool[: daily_service.GAME_REVIEW_WORDS_MAX]
    else:
        pool = [w for w in words if not w.is_new]
        rng.shuffle(pool)
        pool.sort(key=lambda w: w.wrong_count, reverse=True)
        chosen = pool[: daily_service.GAME_REVIEW_ONLY_MAX]
    seen: set[str] = set()
    for word in chosen:
        norm = word_search.normalize_word(word.card.front_text)
        if not norm or norm in seen:
            continue  # duplicates after normalization: only the first enters the game
        seen.add(norm)
        word.in_game = True


def _build_puzzle(session: DailySession, rng: random.Random) -> None:
    game_words = [w for w in _live_words(session) if w.in_game]
    entries = [{"card_id": w.card_id, "word": w.card.front_text} for w in game_words]
    puzzle = word_search.generate_puzzle(entries, rng)
    meanings = [
        {"token": uuid.uuid4().hex[:8], "card_id": w.card_id, "meaning": w.card.back_text}
        for w in game_words
    ]
    rng.shuffle(meanings)
    puzzle["meanings"] = meanings
    for word in game_words:
        if word.card_id in puzzle["unplaced"]:
            word.game_found = True  # match-only word
    session.puzzle_json = json.dumps(puzzle)


@router.post("/complete-learning", response_model=DailySessionResponse)
def complete_learning(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = _get_learning_session(db, user)
    if any(not _steps_complete(word) for word in _live_words(session)):
        raise HTTPException(status_code=409, detail="Chưa hoàn thành hết các bước học")
    rng = random.Random()
    for word in _live_words(session):
        quality = daily_service.quality_for_wrong_count(word.wrong_count)
        word.learning_quality = quality
        _apply_sm2(word, quality)
        db.add(ReviewLog(user_id=user.id, card_id=word.card_id, quality=quality, rating_source="daily"))
    _select_game_words(session, rng)
    _build_puzzle(session, rng)
    session.status = "game"
    session.phase = "game"
    db.commit()
    db.refresh(session)
    return DailySessionResponse(session=_session_out(session))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_daily_complete_api.py -v`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the whole daily test set**

Run: `python -m pytest tests/test_daily_session_api.py tests/test_daily_answer_api.py tests/test_daily_complete_api.py -v`
Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/daily.py backend/tests/test_daily_complete_api.py
git commit -m "feat(daily): aggregate SM2 on learning completion and build puzzle"
```

---

### Task 7: Game read endpoints — GET /game, POST /game/found, POST /game/hint

**Files:**
- Modify: `backend/app/routers/daily.py`
- Test: `backend/tests/test_daily_game_api.py`

**Interfaces:**
- Consumes: `puzzle_json` layout and `_close_stale_game_sessions` from earlier tasks; `find_placement`, `DIRECTIONS` from Task 2.
- Produces:
  - `GET /api/daily/game` → `GameOut`. 409 with detail `"learning"` when today's learning is unfinished; 404 when no game exists.
  - `POST /api/daily/game/found` body `FoundIn` → `FoundOut` (accepts a drag in either direction).
  - `POST /api/daily/game/hint` body `HintIn` → `HintOut` (level 1: first letter + length; level 2: full normalized word; capped at 2).
  - `_game_session(db, user)` and `_chip(word, puzzle)` helpers (reused by Task 8).

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_daily_game_api.py`:

```python
import json

from app.models.daily_session import DailySession

# Distinct after normalization — normalize_word strips digits (see test_daily_complete_api.py).
WORDS = ["apple", "banana", "cherry", "dragon", "eagle", "falcon", "grape", "honey", "island", "jungle"]


def _reach_game(client, count=10):
    deck = client.post("/api/decks", json={"name": "D"}).json()
    for i in range(count):
        client.post(f"/api/decks/{deck['id']}/cards", json={"front_text": WORDS[i], "back_text": f"nghĩa {i}"})
    session = client.get("/api/daily/session").json()["session"]
    for word in session["words"]:
        for step in ["flip", "dictation", word["assigned_step"]]:
            client.post("/api/daily/answer", json={"card_id": word["card_id"], "step": step, "correct": True})
    assert client.post("/api/daily/complete-learning").status_code == 200
    return session


def test_game_blocked_before_learning_done(client):
    deck = client.post("/api/decks", json={"name": "D"}).json()
    client.post(f"/api/decks/{deck['id']}/cards", json={"front_text": "alpha", "back_text": "x"})
    client.get("/api/daily/session")
    res = client.get("/api/daily/game")
    assert res.status_code == 409


def test_game_returns_grid_without_answers(client):
    _reach_game(client)
    game = client.get("/api/daily/game").json()
    assert game["total_words"] == 10
    assert len(game["meanings"]) == 10
    assert game["size"] >= 1
    assert "placements" not in game  # answers must not leak
    assert all(m["hint_level"] == 0 for m in game["meanings"])


def test_found_marks_word_and_survives_reload(client, db):
    session = _reach_game(client)
    stored = db.query(DailySession).filter(DailySession.id == session["id"]).one()
    placement = json.loads(stored.puzzle_json)["placements"][0]
    from app.services.word_search import DIRECTIONS
    dr, dc = DIRECTIONS[placement["dir"]]
    last = len(placement["word"]) - 1
    res = client.post("/api/daily/game/found", json={
        "start_row": placement["row"], "start_col": placement["col"],
        "end_row": placement["row"] + dr * last, "end_col": placement["col"] + dc * last,
    })
    assert res.json()["matched"]["word"] == placement["word"]
    assert res.json()["matched"]["cells"][0] == [placement["row"], placement["col"]]
    game = client.get("/api/daily/game").json()
    assert placement["card_id"] in [chip["card_id"] for chip in game["found"]]


def test_found_reverse_drag_accepted(client, db):
    session = _reach_game(client)
    stored = db.query(DailySession).filter(DailySession.id == session["id"]).one()
    placement = json.loads(stored.puzzle_json)["placements"][0]
    from app.services.word_search import DIRECTIONS
    dr, dc = DIRECTIONS[placement["dir"]]
    last = len(placement["word"]) - 1
    res = client.post("/api/daily/game/found", json={
        "start_row": placement["row"] + dr * last, "start_col": placement["col"] + dc * last,
        "end_row": placement["row"], "end_col": placement["col"],
    })
    assert res.json()["matched"] is not None


def test_found_miss_returns_null(client):
    _reach_game(client)
    res = client.post("/api/daily/game/found", json={"start_row": 0, "start_col": 0, "end_row": 0, "end_col": 0})
    assert res.status_code == 200
    assert res.json()["matched"] is None


def test_hint_levels(client, db):
    session = _reach_game(client)
    stored = db.query(DailySession).filter(DailySession.id == session["id"]).one()
    meaning = json.loads(stored.puzzle_json)["meanings"][0]
    first = client.post("/api/daily/game/hint", json={"token": meaning["token"]}).json()
    assert first["level"] == 1
    second = client.post("/api/daily/game/hint", json={"token": meaning["token"]}).json()
    assert second["level"] == 2
    third = client.post("/api/daily/game/hint", json={"token": meaning["token"]}).json()
    assert third["level"] == 2  # capped
    game = client.get("/api/daily/game").json()
    hinted = next(m for m in game["meanings"] if m["token"] == meaning["token"])
    assert hinted["hint_level"] == 2
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_daily_game_api.py -v`
Expected: FAIL (endpoints missing)

- [ ] **Step 3: Implement the endpoints**

Append to `backend/app/routers/daily.py`. Extend the schema import with `FoundIn, FoundOut, GameMeaning, GameOut, GameWordChip, HintIn, HintOut`.

```python
def _game_session(db: Session, user: User) -> DailySession:
    _close_stale_game_sessions(db, user)
    db.commit()
    session = _active_session(db, user)
    if session is not None and session.status == "learning":
        raise HTTPException(status_code=409, detail="learning")
    if session is None or session.status != "game":
        raise HTTPException(status_code=404, detail="Không có game cho hôm nay")
    return session


def _placement_cells(placement: dict) -> list[list[int]]:
    dr, dc = word_search.DIRECTIONS[placement["dir"]]
    return [[placement["row"] + dr * i, placement["col"] + dc * i] for i in range(len(placement["word"]))]


def _chip(word: DailySessionWord, puzzle: dict) -> GameWordChip:
    placement = next((p for p in puzzle["placements"] if p["card_id"] == word.card_id), None)
    return GameWordChip(
        card_id=word.card_id,
        word=placement["word"] if placement else word_search.normalize_word(word.card.front_text),
        cells=_placement_cells(placement) if placement else None,
    )


@router.get("/game", response_model=GameOut)
def get_game(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = _game_session(db, user)
    puzzle = json.loads(session.puzzle_json)
    game_words = [w for w in _live_words(session) if w.in_game]
    hint_by_card = {w.card_id: w.hint_count for w in game_words}
    live_ids = {w.card_id for w in game_words}
    return GameOut(
        size=puzzle["size"],
        grid=puzzle["grid"],
        meanings=[
            GameMeaning(token=m["token"], meaning=m["meaning"], hint_level=hint_by_card.get(m["card_id"], 0))
            for m in puzzle["meanings"]
            if m["card_id"] in live_ids  # card may have been deleted after the puzzle was built
        ],
        found=[_chip(w, puzzle) for w in game_words if w.game_found],
        total_words=len(game_words),
        status=session.status,
    )


@router.post("/game/found", response_model=FoundOut)
def mark_found(body: FoundIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = _game_session(db, user)
    puzzle = json.loads(session.puzzle_json)
    placement = word_search.find_placement(
        puzzle, body.start_row, body.start_col, body.end_row, body.end_col
    ) or word_search.find_placement(puzzle, body.end_row, body.end_col, body.start_row, body.start_col)
    if placement is None:
        return FoundOut(matched=None)
    word = next((w for w in _live_words(session) if w.card_id == placement["card_id"]), None)
    if word is None:
        return FoundOut(matched=None)  # card deleted after puzzle build
    if not word.game_found:
        word.game_found = True
        db.commit()
    return FoundOut(matched=_chip(word, puzzle))


@router.post("/game/hint", response_model=HintOut)
def get_hint(body: HintIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = _game_session(db, user)
    puzzle = json.loads(session.puzzle_json)
    meaning = next((m for m in puzzle["meanings"] if m["token"] == body.token), None)
    if meaning is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy nghĩa này")
    word = next((w for w in _live_words(session) if w.card_id == meaning["card_id"]), None)
    if word is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy nghĩa này")
    if word.hint_count < 2:
        word.hint_count += 1
        db.commit()
    norm = word_search.normalize_word(word.card.front_text)
    text = f"{norm[0]} ({len(norm)} chữ cái)" if word.hint_count == 1 else norm
    return HintOut(level=word.hint_count, text=text)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_daily_game_api.py -v`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/daily.py backend/tests/test_daily_game_api.py
git commit -m "feat(daily): add game grid, found and hint endpoints"
```

---

### Task 8: POST /api/daily/game/confirm (grade matches, adjust SM2)

**Files:**
- Modify: `backend/app/routers/daily.py`
- Test: `backend/tests/test_daily_confirm_api.py`

**Interfaces:**
- Consumes: `_game_session`, `_apply_sm2`, `puzzle_json.meanings` token→card mapping.
- Produces: `POST /api/daily/game/confirm` body `ConfirmIn` → `ConfirmOut`; session → `done`.

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_daily_confirm_api.py`:

```python
import json
from datetime import date, timedelta

from app.models.daily_session import DailySession, DailySessionWord
from app.models.review import Review

# Distinct after normalization — normalize_word strips digits (see test_daily_complete_api.py).
WORDS = ["apple", "banana", "cherry", "dragon", "eagle", "falcon", "grape", "honey", "island", "jungle"]


def _reach_game(client, count=10):
    deck = client.post("/api/decks", json={"name": "D"}).json()
    for i in range(count):
        client.post(f"/api/decks/{deck['id']}/cards", json={"front_text": WORDS[i], "back_text": f"nghĩa {i}"})
    session = client.get("/api/daily/session").json()["session"]
    for word in session["words"]:
        for step in ["flip", "dictation", word["assigned_step"]]:
            client.post("/api/daily/answer", json={"card_id": word["card_id"], "step": step, "correct": True})
    client.post("/api/daily/complete-learning")
    return session


def _force_all_found(db, session_id):
    for word in db.query(DailySessionWord).filter(DailySessionWord.session_id == session_id).all():
        word.game_found = True
    db.commit()


def _token_map(db, session_id):
    stored = db.query(DailySession).filter(DailySession.id == session_id).one()
    return {m["card_id"]: m["token"] for m in json.loads(stored.puzzle_json)["meanings"]}


def test_confirm_requires_all_found(client, db):
    session = _reach_game(client)
    tokens = _token_map(db, session["id"])
    pairs = [{"card_id": cid, "token": tok} for cid, tok in tokens.items()]
    res = client.post("/api/daily/game/confirm", json={"pairs": pairs})
    assert res.status_code == 409  # nothing found yet


def test_confirm_all_correct_keeps_learning_result(client, db):
    session = _reach_game(client)
    _force_all_found(db, session["id"])
    tokens = _token_map(db, session["id"])
    pairs = [{"card_id": cid, "token": tok} for cid, tok in tokens.items()]
    res = client.post("/api/daily/game/confirm", json={"pairs": pairs})
    assert res.status_code == 200
    results = res.json()["results"]
    assert all(item["correct"] for item in results)
    assert all(item["quality_after"] is None for item in results)
    review = db.query(Review).filter(Review.card_id == session["words"][0]["card_id"]).one()
    assert review.last_quality == 5  # unchanged from learning
    stored = db.query(DailySession).filter(DailySession.id == session["id"]).one()
    assert stored.status == "done"
    assert stored.completed_at is not None


def test_confirm_wrong_pair_resets_to_quality_2(client, db):
    session = _reach_game(client)
    _force_all_found(db, session["id"])
    tokens = _token_map(db, session["id"])
    ids = list(tokens.keys())
    swapped = {ids[0]: tokens[ids[1]], ids[1]: tokens[ids[0]]}
    pairs = [{"card_id": cid, "token": swapped.get(cid, tok)} for cid, tok in tokens.items()]
    results = client.post("/api/daily/game/confirm", json={"pairs": pairs}).json()["results"]
    wrong = [item for item in results if not item["correct"]]
    assert {item["card_id"] for item in wrong} == {ids[0], ids[1]}
    review = db.query(Review).filter(Review.card_id == ids[0]).one()
    assert review.last_quality == 2
    assert review.repetitions == 0  # SM2 fail resets reps
    assert review.due_date == date.today() + timedelta(days=1)


def test_confirm_level1_hint_lowers_quality_by_one(client, db):
    session = _reach_game(client)
    _force_all_found(db, session["id"])
    tokens = _token_map(db, session["id"])
    hinted_card = list(tokens.keys())[0]
    client.post("/api/daily/game/hint", json={"token": tokens[hinted_card]})  # level 1
    pairs = [{"card_id": cid, "token": tok} for cid, tok in tokens.items()]
    results = client.post("/api/daily/game/confirm", json={"pairs": pairs}).json()["results"]
    hinted = next(item for item in results if item["card_id"] == hinted_card)
    assert hinted["correct"] is True
    assert hinted["quality_after"] == 4  # learning quality 5 − 1
    review = db.query(Review).filter(Review.card_id == hinted_card).one()
    assert review.last_quality == 4


def test_confirm_missing_pairs_rejected(client, db):
    session = _reach_game(client)
    _force_all_found(db, session["id"])
    res = client.post("/api/daily/game/confirm", json={"pairs": []})
    assert res.status_code == 409
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_daily_confirm_api.py -v`
Expected: FAIL (endpoint missing)

- [ ] **Step 3: Implement the endpoint**

Append to `backend/app/routers/daily.py`. Extend schema imports with `ConfirmIn, ConfirmOut, ConfirmResultItem`.

```python
@router.post("/game/confirm", response_model=ConfirmOut)
def confirm_game(body: ConfirmIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    session = _game_session(db, user)
    puzzle = json.loads(session.puzzle_json)
    game_words = [w for w in _live_words(session) if w.in_game]
    if any(not w.game_found for w in game_words):
        raise HTTPException(status_code=409, detail="Chưa tìm hết từ trong ô chữ")
    pair_by_card = {pair.card_id: pair.token for pair in body.pairs}
    if set(pair_by_card) != {w.card_id for w in game_words}:
        raise HTTPException(status_code=409, detail="Chưa nối đủ tất cả các từ")
    card_by_token = {m["token"]: m["card_id"] for m in puzzle["meanings"]}

    results: list[ConfirmResultItem] = []
    for word in game_words:
        correct = card_by_token.get(pair_by_card[word.card_id]) == word.card_id
        word.game_correct = correct
        if not correct or word.hint_count >= 2:
            adjusted: int | None = 2
        elif word.hint_count == 1:
            adjusted = max(1, (word.learning_quality or 2) - 1)
        else:
            adjusted = None
        if adjusted is not None:
            _apply_sm2(word, adjusted)
        results.append(
            ConfirmResultItem(
                card_id=word.card_id,
                word=word_search.normalize_word(word.card.front_text),
                meaning=word.card.back_text,
                correct=correct,
                quality_after=adjusted,
            )
        )
    session.status = "done"
    session.phase = "game"
    session.completed_at = datetime.utcnow()
    db.commit()
    return ConfirmOut(results=results)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_daily_confirm_api.py -v`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/daily.py backend/tests/test_daily_confirm_api.py
git commit -m "feat(daily): grade game matches and adjust SM2 from snapshot"
```

---

### Task 9: GET /api/daily/status

**Files:**
- Modify: `backend/app/routers/daily.py`
- Test: `backend/tests/test_daily_status_api.py`

**Interfaces:**
- Consumes: `count_remaining_new`, `LOW_NEW_WORDS_THRESHOLD`, `_close_stale_game_sessions`, `_active_session`.
- Produces: `GET /api/daily/status` → `DailyStatusOut` — powers the HomePage CTA, the low-new-words banner, and the GamesPage gate.

- [ ] **Step 1: Write the failing tests**

`backend/tests/test_daily_status_api.py`:

```python
def _make_cards(client, count):
    deck = client.post("/api/decks", json={"name": "D"}).json()
    for i in range(count):
        client.post(f"/api/decks/{deck['id']}/cards", json={"front_text": f"word{i}", "back_text": f"n{i}"})


def test_status_no_session(client):
    _make_cards(client, 40)
    res = client.get("/api/daily/status")
    assert res.status_code == 200
    body = res.json()
    assert body["session_status"] == "none"
    assert body["new_remaining"] == 40
    assert body["low_new_words"] is False


def test_status_low_new_words_threshold(client):
    _make_cards(client, 30)
    assert client.get("/api/daily/status").json()["low_new_words"] is True


def test_status_reflects_learning_session(client):
    _make_cards(client, 40)
    client.get("/api/daily/session")
    body = client.get("/api/daily/status").json()
    assert body["session_status"] == "learning"
    assert body["new_count"] == 10
    assert body["due_count"] == 0
    assert body["new_remaining"] == 30  # 10 now inside the session... see note in Step 3


def test_status_done_after_confirm(client, db):
    import json as jsonlib
    from app.models.daily_session import DailySession, DailySessionWord
    _make_cards(client, 10)
    session = client.get("/api/daily/session").json()["session"]
    for word in session["words"]:
        for step in ["flip", "dictation", word["assigned_step"]]:
            client.post("/api/daily/answer", json={"card_id": word["card_id"], "step": step, "correct": True})
    client.post("/api/daily/complete-learning")
    for word in db.query(DailySessionWord).filter(DailySessionWord.session_id == session["id"]).all():
        word.game_found = True
    db.commit()
    stored = db.query(DailySession).filter(DailySession.id == session["id"]).one()
    tokens = {m["card_id"]: m["token"] for m in jsonlib.loads(stored.puzzle_json)["meanings"]}
    client.post("/api/daily/game/confirm", json={"pairs": [{"card_id": c, "token": t} for c, t in tokens.items()]})
    assert client.get("/api/daily/status").json()["session_status"] == "done"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_daily_status_api.py -v`
Expected: FAIL (endpoint missing)

- [ ] **Step 3: Implement the endpoint**

Note on `new_remaining`: cards inside an active session are still "unlearned" until complete-learning runs, so the count includes them. The third test expects 30 — that is `40 - 10` only after the session's words are excluded. Exclude words that sit in an active (non-done) session:

Append to `backend/app/routers/daily.py`. Extend schema imports with `DailyStatusOut`.

```python
@router.get("/status", response_model=DailyStatusOut)
def get_status(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _close_stale_game_sessions(db, user)
    db.commit()
    session = _active_session(db, user)
    if session is None:
        done_today = (
            db.query(DailySession)
            .filter(
                DailySession.user_id == user.id,
                DailySession.session_date == date.today(),
                DailySession.status == "done",
            )
            .first()
        )
        session = done_today

    words = _live_words(session) if session is not None else []
    in_session_new_ids: set[str] = set()
    if session is not None and session.status != "done":
        in_session_new_ids = {w.card_id for w in words if w.is_new}
    remaining = daily_service.count_remaining_new(db, user.id) - len(in_session_new_ids)

    return DailyStatusOut(
        new_remaining=remaining,
        low_new_words=remaining <= daily_service.LOW_NEW_WORDS_THRESHOLD,
        session_status=session.status if session is not None else "none",
        session_date=session.session_date if session is not None else None,
        new_count=len([w for w in words if w.is_new]),
        due_count=len([w for w in words if not w.is_new]),
    )
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_daily_status_api.py -v`
Expected: PASS (4 tests)

- [ ] **Step 5: Run the full backend suite**

Run: `python -m pytest`
Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/daily.py backend/tests/test_daily_status_api.py
git commit -m "feat(daily): add status endpoint for CTA and warnings"
```

---

### Task 10: Frontend types + API layer + audio util

**Files:**
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/api/daily.ts`
- Create: `frontend/src/utils/audio.ts`

**Interfaces:**
- Consumes: backend endpoints from Tasks 4–9; `client` axios instance; `resolveAssetUrl` from `frontend/src/api/config.ts`.
- Produces (used by all later frontend tasks):
  - Types: `DailyWord`, `DailySession`, `DailyStatus`, `DailyGame`, `GameMeaning`, `GameChip`, `GameConfirmResult`, `ExerciseStep`.
  - API: `getDailySession`, `postDailyAnswer`, `completeLearning`, `getDailyGame`, `postGameFound`, `postGameHint`, `confirmGame`, `getDailyStatus`.
  - `playCardAudio(card: Card): void`.

- [ ] **Step 1: Add types**

Append to `frontend/src/types/index.ts`:

```ts
export type ExerciseStep = 'dictation' | 'vi_en' | 'en_vi'

export interface DailyWord {
  id: string
  card_id: string
  is_new: boolean
  assigned_step: ExerciseStep
  steps_done: string[]
  wrong_count: number
  card: Card
}

export interface DailySession {
  id: string
  session_date: string
  status: 'learning' | 'game' | 'done'
  phase: 'review' | 'flip' | 'dictation' | 'split' | 'game'
  words: DailyWord[]
}

export interface DailyStatus {
  new_remaining: number
  low_new_words: boolean
  session_status: 'none' | 'learning' | 'game' | 'done'
  session_date: string | null
  new_count: number
  due_count: number
}

export interface GameMeaning {
  token: string
  meaning: string
  hint_level: number
}

export interface GameChip {
  card_id: string
  word: string
  cells: number[][] | null
}

export interface DailyGame {
  size: number
  grid: string[][]
  meanings: GameMeaning[]
  found: GameChip[]
  total_words: number
  status: string
}

export interface GameConfirmResult {
  card_id: string
  word: string
  meaning: string
  correct: boolean
  quality_after: number | null
}
```

- [ ] **Step 2: Create the API module**

`frontend/src/api/daily.ts`:

```ts
import client from './client'
import type { DailyGame, DailySession, DailyStatus, DailyWord, GameChip, GameConfirmResult } from '../types'

export const getDailySession = () =>
  client.get<{ session: DailySession | null }>('/daily/session').then(r => r.data.session)

export const postDailyAnswer = (cardId: string, step: string, correct: boolean) =>
  client.post<DailyWord>('/daily/answer', { card_id: cardId, step, correct }).then(r => r.data)

export const completeLearning = () =>
  client.post<{ session: DailySession | null }>('/daily/complete-learning').then(r => r.data.session)

export const getDailyGame = () => client.get<DailyGame>('/daily/game').then(r => r.data)

export const postGameFound = (sel: { start_row: number; start_col: number; end_row: number; end_col: number }) =>
  client.post<{ matched: GameChip | null }>('/daily/game/found', sel).then(r => r.data.matched)

export const postGameHint = (token: string) =>
  client.post<{ level: number; text: string }>('/daily/game/hint', { token }).then(r => r.data)

export const confirmGame = (pairs: { card_id: string; token: string }[]) =>
  client.post<{ results: GameConfirmResult[] }>('/daily/game/confirm', { pairs }).then(r => r.data.results)

export const getDailyStatus = () => client.get<DailyStatus>('/daily/status').then(r => r.data)
```

- [ ] **Step 3: Create the audio util**

`frontend/src/utils/audio.ts`:

```ts
import { resolveAssetUrl } from '../api/config'
import type { Card } from '../types'

let current: HTMLAudioElement | null = null

export function playCardAudio(card: Card) {
  const url = resolveAssetUrl(card.audio_url)
  if (url) {
    current?.pause()
    current = new Audio(url)
    void current.play().catch(() => {})
    return
  }
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(card.front_text)
  utterance.lang = 'en-US'
  utterance.rate = 0.9
  window.speechSynthesis.speak(utterance)
}
```

- [ ] **Step 4: Verify the build**

Run: `npm run build` (from `frontend/`)
Expected: tsc + vite succeed with no errors

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/api/daily.ts frontend/src/utils/audio.ts
git commit -m "feat(daily): add frontend types, API client and audio util"
```

---

### Task 11: ExerciseCard component (dictation / vi_en / en_vi with requeue semantics)

**Files:**
- Create: `frontend/src/components/daily/ExerciseCard.tsx`

**Interfaces:**
- Consumes: `playCardAudio`, `Card`, `ExerciseStep`.
- Produces: `<ExerciseCard card mode onResult />` where `onResult(correct: boolean)` fires exactly once per presentation — `true` advances, `false` means the caller requeues the word.

- [ ] **Step 1: Implement the component**

`frontend/src/components/daily/ExerciseCard.tsx`:

```tsx
import { useEffect, useState } from 'react'
import type { Card, ExerciseStep } from '../../types'
import { playCardAudio } from '../../utils/audio'

interface Props {
  card: Card
  mode: ExerciseStep
  onResult: (correct: boolean) => void
}

const normalizeEn = (value: string) =>
  value.trim().toLowerCase().replace(/[.,!?;:()[\]{}"']/g, '').replace(/\s+/g, ' ')
const normalizeVi = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')

const PROMPTS: Record<ExerciseStep, string> = {
  dictation: '🎧 Nghe và gõ lại từ',
  vi_en: '🇻🇳→🇬🇧 Gõ từ tiếng Anh cho nghĩa này',
  en_vi: '🇬🇧→🇻🇳 Gõ nghĩa tiếng Việt của từ này',
}

export default function ExerciseCard({ card, mode, onResult }: Props) {
  const [typed, setTyped] = useState('')
  const [state, setState] = useState<'answering' | 'wrong' | 'self_confirm'>('answering')

  useEffect(() => {
    setTyped('')
    setState('answering')
    if (mode === 'dictation') playCardAudio(card)
    return () => window.speechSynthesis.cancel()
  }, [card.id, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  const answerText = mode === 'en_vi' ? card.back_text : card.front_text

  const check = () => {
    if (mode === 'en_vi') {
      const typedNorm = normalizeVi(typed)
      const backNorm = normalizeVi(card.back_text)
      const soft = typedNorm.length >= 2 && (backNorm.includes(typedNorm) || typedNorm.includes(backNorm))
      if (soft) onResult(true)
      else setState('self_confirm')
      return
    }
    if (normalizeEn(typed) === normalizeEn(card.front_text)) onResult(true)
    else setState('wrong')
  }

  return (
    <div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-5">
      <p className="mb-3 text-xs font-black uppercase text-slate-500">{PROMPTS[mode]}</p>

      {mode === 'dictation' && (
        <button onClick={() => playCardAudio(card)} className="mb-4 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200">
          🔊 Nghe lại
        </button>
      )}
      {mode === 'vi_en' && <p className="mb-4 rounded-xl bg-black/25 p-3 text-[15px] text-slate-200">{card.back_text}</p>}
      {mode === 'en_vi' && (
        <p className="mb-4 flex items-center gap-3 rounded-xl bg-black/25 p-3 text-[15px] text-slate-200">
          <span className="font-bold text-white">{card.front_text}</span>
          <button onClick={() => playCardAudio(card)} className="text-cyan-300">🔊</button>
        </p>
      )}

      {state === 'answering' && (
        <>
          <input
            value={typed}
            onChange={event => setTyped(event.target.value)}
            onKeyDown={event => event.key === 'Enter' && typed.trim() && check()}
            placeholder={mode === 'en_vi' ? 'Gõ nghĩa tiếng Việt...' : 'Gõ từ tiếng Anh...'}
            autoFocus
            className="mb-4 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-white placeholder:text-slate-500"
          />
          <button onClick={check} disabled={!typed.trim()} className="w-full rounded-xl border border-emerald-300/25 bg-emerald-400/10 py-2.5 text-sm font-bold text-emerald-200 disabled:opacity-40">
            Kiểm tra
          </button>
        </>
      )}

      {state === 'wrong' && (
        <div>
          <p className="mb-2 text-sm text-rose-300">Chưa đúng. Đáp án:</p>
          <p className="mb-4 rounded-xl bg-black/25 p-3 font-bold text-emerald-300">{answerText}</p>
          <p className="mb-3 text-xs text-slate-500">Từ này sẽ quay lại ở cuối lượt để bạn làm lại.</p>
          <button onClick={() => onResult(false)} className="w-full rounded-xl border border-white/10 bg-white/[.05] py-2.5 text-sm font-bold text-slate-200">
            Tiếp tục
          </button>
        </div>
      )}

      {state === 'self_confirm' && (
        <div>
          <p className="mb-2 text-sm text-slate-300">Đáp án trong thẻ:</p>
          <p className="mb-4 rounded-xl bg-black/25 p-3 font-bold text-emerald-300">{card.back_text}</p>
          <p className="mb-3 text-sm text-slate-400">Câu trả lời của bạn: “{typed}” — bạn có đúng không?</p>
          <div className="flex gap-2">
            <button onClick={() => onResult(true)} className="flex-1 rounded-xl border border-emerald-300/25 bg-emerald-400/10 py-2.5 text-sm font-bold text-emerald-200">
              ✅ Tôi đúng
            </button>
            <button onClick={() => onResult(false)} className="flex-1 rounded-xl border border-rose-300/25 bg-rose-400/10 py-2.5 text-sm font-bold text-rose-200">
              ❌ Tôi sai
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: success (component compiles even though nothing imports it yet)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/daily/ExerciseCard.tsx
git commit -m "feat(daily): add ExerciseCard for typed learning steps"
```

---

### Task 12: DailyPage — learning phases, requeue, resume, complete-learning

**Files:**
- Create: `frontend/src/pages/DailyPage.tsx`
- Modify: `frontend/src/App.tsx` (lazy import + route `/daily`)
- Modify: `frontend/src/components/Navbar.tsx` (add link "Học hôm nay" → `/daily`; follow the existing nav-link markup in that file)

**Interfaces:**
- Consumes: `getDailySession`, `postDailyAnswer`, `completeLearning`, `ExerciseCard`, `FlipCard`, `DailyWord`, `DailySession`.
- Produces: route `/daily`. Renders a `game` phase placeholder (`<p>Game đang được xây dựng…</p>`) that Task 13 replaces with `DailyGamePanel`.

- [ ] **Step 1: Implement the page**

`frontend/src/pages/DailyPage.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { completeLearning, getDailySession, postDailyAnswer } from '../api/daily'
import ExerciseCard from '../components/daily/ExerciseCard'
import FlipCard from '../components/FlipCard'
import { useNotification } from '../components/NotificationProvider'
import type { DailySession, DailyWord, ExerciseStep } from '../types'

type Phase = 'review' | 'flip' | 'dictation' | 'split' | 'game' | 'done' | 'empty'

const PHASE_LABELS: [Phase, string][] = [
  ['review', 'Ôn tập'],
  ['flip', 'Lật thẻ'],
  ['dictation', 'Nghe & điền'],
  ['split', 'Chia đôi'],
  ['game', 'Game'],
]

const notDone = (word: DailyWord, step: string) => !word.steps_done.includes(step)

export default function DailyPage() {
  const { toast } = useNotification()
  const [session, setSession] = useState<DailySession | null>(null)
  const [loading, setLoading] = useState(true)
  const [phase, setPhase] = useState<Phase>('review')
  const [reviewQueue, setReviewQueue] = useState<DailyWord[]>([])
  const [flipQueue, setFlipQueue] = useState<DailyWord[]>([])
  const [dictationQueue, setDictationQueue] = useState<DailyWord[]>([])
  const [leftQueue, setLeftQueue] = useState<DailyWord[]>([])   // vi_en
  const [rightQueue, setRightQueue] = useState<DailyWord[]>([]) // en_vi
  // Bumped on every answer so a requeued word remounts its ExerciseCard even
  // when it is the only word left in the queue (same card, fresh input state).
  const [presented, setPresented] = useState(0)

  useEffect(() => {
    getDailySession()
      .then(loaded => {
        setSession(loaded)
        if (!loaded) { setPhase('empty'); return }
        if (loaded.status !== 'learning') { setPhase(loaded.status === 'game' ? 'game' : 'done'); return }
        const words = loaded.words
        setReviewQueue(words.filter(w => !w.is_new && notDone(w, w.assigned_step)))
        setFlipQueue(words.filter(w => w.is_new && notDone(w, 'flip')))
        setDictationQueue(words.filter(w => w.is_new && notDone(w, 'dictation')))
        setLeftQueue(words.filter(w => w.is_new && w.assigned_step === 'vi_en' && notDone(w, 'vi_en')))
        setRightQueue(words.filter(w => w.is_new && w.assigned_step === 'en_vi' && notDone(w, 'en_vi')))
        setPhase(loaded.phase as Phase)
      })
      .catch(() => toast('Không tải được phiên học hôm nay', 'error'))
      .finally(() => setLoading(false))
  }, [toast])

  const finishLearning = () => {
    void completeLearning()
      .then(() => setPhase('game'))
      .catch(() => toast('Không hoàn tất được phần học', 'error'))
  }

  // Generic queue handler: correct → pop; wrong → move to back. Advances phase when empty.
  const handleResult = (
    queue: DailyWord[],
    setQueue: (words: DailyWord[]) => void,
    step: string,
    nextPhase: Phase | null,
  ) => (correct: boolean) => {
    const [word, ...rest] = queue
    void postDailyAnswer(word.card_id, step, correct).catch(() => toast('Không lưu được câu trả lời', 'error'))
    const next = correct ? rest : [...rest, word]
    setQueue(next)
    setPresented(n => n + 1)
    if (next.length === 0 && nextPhase) setPhase(nextPhase)
  }

  const splitDone = leftQueue.length === 0 && rightQueue.length === 0
  useEffect(() => {
    if (phase === 'split' && splitDone && session) finishLearning()
  }, [phase, splitDone]) // eslint-disable-line react-hooks/exhaustive-deps

  const stepper = useMemo(() => (
    <div className="mb-6 flex flex-wrap gap-2">
      {PHASE_LABELS.map(([key, label]) => (
        <span key={key} className={`rounded-full px-3 py-1 text-xs font-bold ${phase === key ? 'bg-violet-500/30 text-violet-200' : 'bg-white/[.05] text-slate-500'}`}>
          {label}
        </span>
      ))}
    </div>
  ), [phase])

  if (loading) return <div className="flex justify-center py-24"><div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" /></div>

  if (phase === 'empty') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="mb-3 text-3xl">🎉</p>
        <h1 className="mb-2 text-xl font-black text-white">Hôm nay hết bài rồi!</h1>
        <p className="mb-6 text-sm text-slate-400">Không còn từ mới và không có từ nào đến hạn ôn tập.</p>
        <Link to="/" className="rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-5 py-2.5 text-sm font-bold text-cyan-200">Tạo thêm thẻ mới</Link>
      </div>
    )
  }

  // Review-only sessions have no new words: jump straight to the first
  // non-empty phase, or finish learning immediately when nothing remains.
  const startFlip = () => {
    if (flipQueue.length) setPhase('flip')
    else if (dictationQueue.length) setPhase('dictation')
    else if (!splitDone) setPhase('split')
    else finishLearning()
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-black text-white">📅 Học hôm nay</h1>
      {stepper}

      {phase === 'review' && reviewQueue.length > 0 && (
        <div className="mx-auto max-w-2xl">
          <p className="mb-3 text-sm text-slate-400">Ôn tập · còn {reviewQueue.length} từ</p>
          <ExerciseCard
            key={`${reviewQueue[0].card_id}-${presented}`}
            card={reviewQueue[0].card}
            mode={reviewQueue[0].assigned_step}
            onResult={handleResult(reviewQueue, setReviewQueue, reviewQueue[0].assigned_step, null)}
          />
        </div>
      )}
      {phase === 'review' && reviewQueue.length === 0 && (
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-4 text-sm text-emerald-300">✅ Xong phần ôn tập!</p>
          <button onClick={startFlip} className="rounded-xl border border-violet-300/25 bg-violet-400/10 px-5 py-2.5 text-sm font-bold text-violet-200">
            Tiếp tục →
          </button>
        </div>
      )}

      {phase === 'flip' && flipQueue.length > 0 && (
        <div className="mx-auto max-w-2xl">
          <p className="mb-3 text-sm text-slate-400">Lật thẻ & nghe · từ {`${(session?.words.filter(w => w.is_new).length ?? 0) - flipQueue.length + 1}`}/{session?.words.filter(w => w.is_new).length}</p>
          <FlipCard
            key={flipQueue[0].card_id}
            card={flipQueue[0].card}
            isPractice
            onRate={() => handleResult(flipQueue, setFlipQueue, 'flip', 'dictation')(true)}
          />
        </div>
      )}

      {phase === 'dictation' && dictationQueue.length > 0 && (
        <div className="mx-auto max-w-2xl">
          <p className="mb-3 text-sm text-slate-400">Nghe & điền · còn {dictationQueue.length} từ</p>
          <ExerciseCard
            key={`${dictationQueue[0].card_id}-${presented}`}
            card={dictationQueue[0].card}
            mode="dictation"
            onResult={handleResult(dictationQueue, setDictationQueue, 'dictation', 'split')}
          />
        </div>
      )}

      {phase === 'split' && !splitDone && (
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="mb-2 text-center text-xs font-black uppercase text-slate-500">Việt → Anh · còn {leftQueue.length}</p>
            {leftQueue.length > 0 ? (
              <ExerciseCard
                key={`${leftQueue[0].card_id}-${presented}`}
                card={leftQueue[0].card}
                mode="vi_en"
                onResult={handleResult(leftQueue, setLeftQueue, 'vi_en', null)}
              />
            ) : <p className="text-center text-sm text-emerald-300">✅ Xong bên này</p>}
          </div>
          <div>
            <p className="mb-2 text-center text-xs font-black uppercase text-slate-500">Anh → Việt · còn {rightQueue.length}</p>
            {rightQueue.length > 0 ? (
              <ExerciseCard
                key={`${rightQueue[0].card_id}-${presented}`}
                card={rightQueue[0].card}
                mode="en_vi"
                onResult={handleResult(rightQueue, setRightQueue, 'en_vi', null)}
              />
            ) : <p className="text-center text-sm text-emerald-300">✅ Xong bên này</p>}
          </div>
        </div>
      )}

      {phase === 'game' && <p className="text-center text-sm text-slate-400">Game đang được xây dựng…</p>}

      {phase === 'done' && (
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-3xl">🏁</p>
          <p className="text-sm text-slate-400">Hôm nay đã hoàn thành. Hẹn gặp lại ngày mai!</p>
        </div>
      )}
    </div>
  )
}
```

Note for the implementer: `handleResult` reads the queue from the closure — the `key` on `ExerciseCard` includes the `presented` counter so every answer remounts the card (fresh closure and fresh input state, even when the same word is the only one left in the queue). Do not convert to `useCallback`.

- [ ] **Step 2: Register the route**

In `frontend/src/App.tsx` add with the other lazy imports:

```tsx
const DailyPage = lazy(() => import('./pages/DailyPage'))
```

and with the other routes:

```tsx
<Route path="/daily" element={<RequireAuth><DailyPage /></RequireAuth>} />
```

- [ ] **Step 3: Add the Navbar link**

Open `frontend/src/components/Navbar.tsx`, find the existing links (e.g. the one pointing to `/games`) and add one link with the same classes, text `📅 Học hôm nay`, target `/daily`, placed before the games link.

- [ ] **Step 4: Verify build + smoke-test in browser**

Run: `npm run build` — expected: success.
Then start the dev servers (backend + frontend per `start.bat` / launch config), open `/daily`, and verify: session loads, review/flip/dictation/split phases advance, wrong answers requeue, finishing split calls complete-learning and shows the game placeholder.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/DailyPage.tsx frontend/src/App.tsx frontend/src/components/Navbar.tsx
git commit -m "feat(daily): add /daily learning flow page"
```

---

### Task 13: Game UI — WordSearchGrid + DailyGamePanel

**Files:**
- Create: `frontend/src/components/daily/WordSearchGrid.tsx`
- Create: `frontend/src/components/daily/DailyGamePanel.tsx`
- Modify: `frontend/src/pages/DailyPage.tsx` (replace the game placeholder)

**Interfaces:**
- Consumes: `getDailyGame`, `postGameFound`, `postGameHint`, `confirmGame`, `DailyGame`, `GameChip`, `GameConfirmResult`.
- Produces:
  - `<WordSearchGrid grid foundCells onSelect />` — `foundCells: string[]` of `"row-col"` keys; `onSelect({start_row,start_col,end_row,end_col})` fires on a straight-line drag (horizontal/vertical/diagonal, either direction).
  - `<DailyGamePanel onDone? />` — self-contained game screen, also used by GamesPage in Task 14. Calls `onDone` after confirm succeeds.

- [ ] **Step 1: Implement WordSearchGrid**

`frontend/src/components/daily/WordSearchGrid.tsx`:

```tsx
import { useMemo, useState } from 'react'

interface Selection { start_row: number; start_col: number; end_row: number; end_col: number }
interface Props {
  grid: string[][]
  foundCells: string[]
  onSelect: (sel: Selection) => void
}

function pathCells(sr: number, sc: number, er: number, ec: number): string[] | null {
  const dr = Math.sign(er - sr)
  const dc = Math.sign(ec - sc)
  const len = Math.max(Math.abs(er - sr), Math.abs(ec - sc)) + 1
  const straight =
    (dr === 0 && dc !== 0) || (dc === 0 && dr !== 0) ||
    (Math.abs(er - sr) === Math.abs(ec - sc) && dr !== 0)
  if (!straight) return null
  return Array.from({ length: len }, (_, i) => `${sr + dr * i}-${sc + dc * i}`)
}

export default function WordSearchGrid({ grid, foundCells, onSelect }: Props) {
  const [start, setStart] = useState<[number, number] | null>(null)
  const [hover, setHover] = useState<[number, number] | null>(null)
  const found = useMemo(() => new Set(foundCells), [foundCells])
  const active = useMemo(() => {
    if (!start || !hover) return new Set<string>()
    return new Set(pathCells(start[0], start[1], hover[0], hover[1]) ?? [])
  }, [start, hover])

  const finish = () => {
    if (start && hover && pathCells(start[0], start[1], hover[0], hover[1])) {
      onSelect({ start_row: start[0], start_col: start[1], end_row: hover[0], end_col: hover[1] })
    }
    setStart(null)
    setHover(null)
  }

  return (
    <div
      className="inline-block touch-none select-none rounded-2xl border border-white/[.07] bg-white/[.03] p-3"
      onPointerUp={finish}
      onPointerLeave={() => { setStart(null); setHover(null) }}
    >
      {grid.map((row, r) => (
        <div key={r} className="flex">
          {row.map((letter, c) => {
            const key = `${r}-${c}`
            const isFound = found.has(key)
            const isActive = active.has(key)
            return (
              <button
                key={key}
                onPointerDown={() => { setStart([r, c]); setHover([r, c]) }}
                onPointerEnter={() => start && setHover([r, c])}
                className={`m-0.5 flex h-8 w-8 items-center justify-center rounded-md text-sm font-black transition-colors sm:h-9 sm:w-9 ${
                  isFound ? 'bg-emerald-400/30 text-emerald-200'
                  : isActive ? 'bg-cyan-400/40 text-white'
                  : 'bg-black/25 text-slate-300 hover:bg-white/[.08]'
                }`}
              >
                {letter}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Implement DailyGamePanel**

`frontend/src/components/daily/DailyGamePanel.tsx`:

```tsx
import { useEffect, useMemo, useState } from 'react'
import { confirmGame, getDailyGame, postGameFound, postGameHint } from '../../api/daily'
import { useNotification } from '../NotificationProvider'
import type { DailyGame, GameChip, GameConfirmResult } from '../../types'
import WordSearchGrid from './WordSearchGrid'

interface Props { onDone?: () => void }

export default function DailyGamePanel({ onDone }: Props) {
  const { toast } = useNotification()
  const [game, setGame] = useState<DailyGame | null>(null)
  const [found, setFound] = useState<GameChip[]>([])
  const [links, setLinks] = useState<Record<string, string>>({}) // card_id -> token
  const [selectedChip, setSelectedChip] = useState<string | null>(null)
  const [hints, setHints] = useState<Record<string, string>>({}) // token -> hint text
  const [results, setResults] = useState<GameConfirmResult[] | null>(null)
  const [error, setError] = useState<'learning' | 'missing' | null>(null)

  useEffect(() => {
    getDailyGame()
      .then(loaded => { setGame(loaded); setFound(loaded.found) })
      .catch(err => setError(err?.response?.status === 409 ? 'learning' : 'missing'))
  }, [])

  const foundCells = useMemo(
    () => found.flatMap(chip => (chip.cells ?? []).map(([r, c]) => `${r}-${c}`)),
    [found],
  )
  const allFound = game !== null && found.length === game.total_words
  const allLinked = game !== null && Object.keys(links).length === game.total_words

  const handleSelect = (sel: { start_row: number; start_col: number; end_row: number; end_col: number }) => {
    void postGameFound(sel).then(matched => {
      if (!matched) return
      setFound(chips => (chips.some(c => c.card_id === matched.card_id) ? chips : [...chips, matched]))
      toast(`🎉 Tìm thấy: ${matched.word}`, 'success')
    }).catch(() => toast('Không kiểm tra được lựa chọn', 'error'))
  }

  const linkMeaning = (token: string) => {
    if (!selectedChip) return
    setLinks(prev => {
      const next = { ...prev }
      for (const cardId of Object.keys(next)) if (next[cardId] === token) delete next[cardId]
      next[selectedChip] = token
      return next
    })
    setSelectedChip(null)
  }

  const askHint = (token: string) => {
    void postGameHint(token)
      .then(hint => setHints(prev => ({ ...prev, [token]: hint.text })))
      .catch(() => toast('Không lấy được gợi ý', 'error'))
  }

  const confirm = () => {
    const pairs = Object.entries(links).map(([card_id, token]) => ({ card_id, token }))
    void confirmGame(pairs)
      .then(items => { setResults(items); onDone?.() })
      .catch(() => toast('Không xác nhận được kết quả', 'error'))
  }

  if (error === 'learning') return <p className="py-8 text-center text-sm text-amber-300">📚 Học bài xong mới chơi được game nhé!</p>
  if (error === 'missing') return <p className="py-8 text-center text-sm text-slate-400">Hôm nay không có game.</p>
  if (!game) return <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" /></div>

  if (results) {
    const correct = results.filter(item => item.correct).length
    return (
      <div className="mx-auto max-w-2xl rounded-2xl border border-white/[.07] bg-white/[.03] p-5">
        <h2 className="mb-1 text-xl font-black text-white">🏁 Kết quả game</h2>
        <p className="mb-4 text-sm text-slate-400">Đúng {correct}/{results.length} cặp. Các từ sai sẽ quay lại sớm trong lịch ôn tập.</p>
        <ul className="space-y-2">
          {results.map(item => (
            <li key={item.card_id} className={`flex items-center justify-between rounded-xl p-3 text-sm ${item.correct ? 'bg-emerald-400/10 text-emerald-200' : 'bg-rose-400/10 text-rose-200'}`}>
              <span className="font-bold">{item.word}</span>
              <span>{item.meaning}</span>
              <span>{item.correct ? '✅' : '❌'}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const unlinkedChips = found.filter(chip => !(chip.card_id in links))

  return (
    <div className="grid gap-6 lg:grid-cols-[auto,1fr]">
      <div>
        <p className="mb-2 text-xs font-black uppercase text-slate-500">🔍 Tìm từ trong ô chữ ({found.length}/{game.total_words})</p>
        <WordSearchGrid grid={game.grid} foundCells={foundCells} onSelect={handleSelect} />
        {unlinkedChips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {unlinkedChips.map(chip => (
              <button
                key={chip.card_id}
                onClick={() => setSelectedChip(chip.card_id === selectedChip ? null : chip.card_id)}
                className={`rounded-full px-3 py-1 text-sm font-bold ${selectedChip === chip.card_id ? 'bg-cyan-400/40 text-white' : 'bg-white/[.08] text-slate-200'}`}
              >
                {chip.word}
              </button>
            ))}
          </div>
        )}
        {selectedChip && <p className="mt-2 text-xs text-cyan-300">Chọn nghĩa bên phải để nối 👉</p>}
      </div>

      <div>
        <p className="mb-2 text-xs font-black uppercase text-slate-500">🔗 Nối với nghĩa tiếng Việt</p>
        <ul className="space-y-2">
          {game.meanings.map(meaning => {
            const linkedCard = Object.keys(links).find(cardId => links[cardId] === meaning.token)
            const linkedWord = found.find(chip => chip.card_id === linkedCard)?.word
            return (
              <li key={meaning.token}>
                <button
                  onClick={() => linkMeaning(meaning.token)}
                  disabled={!selectedChip && !linkedWord}
                  className={`flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left text-sm ${
                    linkedWord ? 'border-cyan-300/40 bg-cyan-400/10' : 'border-white/[.07] bg-white/[.03]'
                  } ${selectedChip ? 'hover:border-cyan-300/60' : ''}`}
                >
                  <span className="text-slate-200">{meaning.meaning}</span>
                  <span className="flex items-center gap-2">
                    {hints[meaning.token] && <span className="text-xs text-amber-300">💡 {hints[meaning.token]}</span>}
                    {linkedWord && <span className="font-bold text-cyan-200">{linkedWord}</span>}
                  </span>
                </button>
                {!linkedWord && (
                  <button onClick={() => askHint(meaning.token)} className="mt-1 text-xs text-slate-500 hover:text-amber-300">
                    💡 Gợi ý (bị trừ điểm)
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        <button
          onClick={confirm}
          disabled={!allFound || !allLinked}
          className="mt-4 w-full rounded-xl border border-emerald-300/25 bg-emerald-400/10 py-3 text-sm font-black text-emerald-200 disabled:opacity-40"
        >
          ✅ Xác nhận kết quả
        </button>
        {(!allFound || !allLinked) && (
          <p className="mt-2 text-center text-xs text-slate-500">Tìm hết từ và nối hết nghĩa để xác nhận.</p>
        )}
      </div>
    </div>
  )
}
```


- [ ] **Step 3: Wire into DailyPage**

In `frontend/src/pages/DailyPage.tsx` add `import DailyGamePanel from '../components/daily/DailyGamePanel'` and replace:

```tsx
{phase === 'game' && <p className="text-center text-sm text-slate-400">Game đang được xây dựng…</p>}
```

with:

```tsx
{phase === 'game' && <DailyGamePanel onDone={() => undefined} />}
```

- [ ] **Step 4: Verify build + browser smoke test**

Run: `npm run build` — expected: success.
In the browser: finish a learning session, verify the grid renders, drag-select finds words, chips link to meanings, hint buttons show hints, confirm reveals per-pair results.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/daily/WordSearchGrid.tsx frontend/src/components/daily/DailyGamePanel.tsx frontend/src/pages/DailyPage.tsx
git commit -m "feat(daily): add word-search and matching game UI"
```

---

### Task 14: GamesPage gate + HomePage CTA and low-words banner

**Files:**
- Create: `frontend/src/components/daily/DailyCta.tsx`
- Rewrite: `frontend/src/pages/GamesPage.tsx`
- Modify: `frontend/src/pages/HomePage.tsx`

**Interfaces:**
- Consumes: `getDailyStatus`, `DailyGamePanel`.
- Produces: `<DailyCta />` (CTA card + warning banner, used on HomePage).

- [ ] **Step 1: Implement DailyCta**

`frontend/src/components/daily/DailyCta.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDailyStatus } from '../../api/daily'
import type { DailyStatus } from '../../types'

const CTA_TEXT: Record<DailyStatus['session_status'], string> = {
  none: 'Bắt đầu học hôm nay',
  learning: 'Tiếp tục học hôm nay',
  game: 'Chơi game củng cố từ vựng',
  done: 'Hôm nay đã hoàn thành 🎉',
}

export default function DailyCta() {
  const [status, setStatus] = useState<DailyStatus | null>(null)
  useEffect(() => { void getDailyStatus().then(setStatus).catch(() => {}) }, [])
  if (!status) return null

  return (
    <div className="mb-8">
      <Link
        to={status.session_status === 'game' ? '/games' : '/daily'}
        className="flex items-center justify-between rounded-2xl border border-violet-400/30 bg-gradient-to-r from-violet-600/20 to-cyan-500/15 p-5 hover:border-violet-300/50"
      >
        <span>
          <span className="block text-lg font-black text-white">📅 {CTA_TEXT[status.session_status]}</span>
          <span className="mt-1 block text-sm text-slate-400">
            {status.session_status === 'none' || status.session_status === 'learning'
              ? `${status.new_count || 10} từ mới · ${status.due_count} từ cần ôn`
              : 'Giữ vững chuỗi học mỗi ngày nhé'}
          </span>
        </span>
        <span className="text-2xl">→</span>
      </Link>
      {status.low_new_words && (
        <div className="mt-3 flex items-center justify-between rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
          <p className="text-sm text-amber-200">
            ⚠️ Sắp hết từ mới (còn {status.new_remaining} từ) — tạo thêm thẻ hoặc bộ thẻ mới để không gián đoạn.
          </p>
          <Link to="/" className="ml-3 shrink-0 rounded-xl border border-amber-300/40 bg-amber-400/15 px-4 py-2 text-xs font-bold text-amber-100">
            Tạo thẻ mới
          </Link>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Rewrite GamesPage**

Replace the entire content of `frontend/src/pages/GamesPage.tsx` with:

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDailyStatus } from '../api/daily'
import DailyGamePanel from '../components/daily/DailyGamePanel'
import type { DailyStatus } from '../types'

export default function GamesPage() {
  const [status, setStatus] = useState<DailyStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    void getDailyStatus().then(setStatus).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-24"><div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" /></div>

  const state = finished ? 'done' : status?.session_status ?? 'none'

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-black text-white">🎮 Game củng cố từ vựng</h1>

      {state === 'none' && (
        <div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-8 text-center">
          <p className="mb-2 text-3xl">📭</p>
          <p className="mb-4 text-sm text-slate-400">Hôm nay chưa có bài học — tạo thẻ mới để bắt đầu.</p>
          <Link to="/" className="rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-5 py-2.5 text-sm font-bold text-cyan-200">Về trang chủ</Link>
        </div>
      )}

      {state === 'learning' && (
        <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[.06] p-8 text-center">
          <p className="mb-2 text-3xl">📚</p>
          <h2 className="mb-2 text-lg font-black text-white">Học bài rồi mới chơi nhé!</h2>
          <p className="mb-5 text-sm text-slate-400">Hoàn thành phần học hôm nay để mở khóa game ô chữ + nối nghĩa.</p>
          <Link to="/daily" className="rounded-xl border border-violet-300/30 bg-violet-500/15 px-6 py-3 text-sm font-black text-violet-200">
            📖 Học bài ngay
          </Link>
        </div>
      )}

      {state === 'game' && <DailyGamePanel onDone={() => setFinished(true)} />}

      {state === 'done' && !finished && (
        <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[.06] p-8 text-center">
          <p className="mb-2 text-3xl">🎉</p>
          <p className="text-sm text-slate-300">Hôm nay đã hoàn thành cả học lẫn chơi. Quay lại vào ngày mai nhé!</p>
        </div>
      )}
      {state === 'done' && finished && <DailyGamePanel />}
    </div>
  )
}
```

Note: after `confirmGame` succeeds inside `DailyGamePanel` the panel already shows the results screen; `finished` only matters on a later remount, so the simple branch above is fine. When `finished` is true the panel stays mounted showing results — do not unmount it (that is why `state === 'done' && finished` renders the panel; on a fresh page load with `session_status === 'done'` the plain message shows instead).

- [ ] **Step 3: Add CTA to HomePage and warning to DailyPage summary**

In `frontend/src/pages/HomePage.tsx`:
- Add import: `import DailyCta from '../components/daily/DailyCta'`
- Insert `<DailyCta />` immediately after the `<RobotAnimation ... />` line (search for `RobotAnimation isVisible`), before the "Hero banner when there are due cards" block.

In `frontend/src/pages/DailyPage.tsx` (spec: the low-new-words banner also shows on the session summary):
- Add import: `import DailyCta from '../components/daily/DailyCta'`
- In the `phase === 'done'` block, add `<DailyCta />` below the "Hôm nay đã hoàn thành" message.

- [ ] **Step 4: Verify build + browser smoke test**

Run: `npm run build` — expected: success.
Browser: HomePage shows the CTA (and the amber banner when ≤ 30 new words remain); `/games` shows the gate while learning, the game once learning is done, and the completed message after confirm.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/daily/DailyCta.tsx frontend/src/pages/GamesPage.tsx frontend/src/pages/HomePage.tsx
git commit -m "feat(daily): gate games page and add home CTA with low-words warning"
```

---

### Task 15: Remove old mini-games + final verification

**Files:**
- Delete: `backend/app/routers/games.py`, `backend/tests/test_games.py`
- Delete: `frontend/src/components/games/ConceptMatchGame.tsx`, `DictationClozeGame.tsx`, `SentenceBuilderGame.tsx`, `gameUtils.ts` (the whole `frontend/src/components/games/` directory)
- Delete: `frontend/src/api/games.ts`
- Modify: `backend/app/main.py` (drop `games` from the router import and remove `app.include_router(games.router)`)
- Modify: `frontend/src/types/index.ts` (remove `export type GameMode = ...`)

**Interfaces:**
- Consumes: nothing new. GamesPage was already rewritten in Task 14, so nothing imports the deleted modules.

- [ ] **Step 1: Delete backend games router and its test**

```bash
git rm backend/app/routers/games.py backend/tests/test_games.py
```

Edit `backend/app/main.py`: the import line becomes
`from app.routers import articles, cards, daily, decks, dictionary, documents, review, shadowing`
and delete the `app.include_router(games.router)` line.

- [ ] **Step 2: Delete frontend game components and API**

```bash
git rm -r frontend/src/components/games frontend/src/api/games.ts
```

Remove `export type GameMode = 'sentence' | 'cloze' | 'match'` from `frontend/src/types/index.ts`.

- [ ] **Step 3: Hunt for dangling imports**

Search the repo for `components/games`, `api/games`, `GameMode`, `gameUtils` (e.g. `rg -l "GameMode|gameUtils|api/games|components/games" frontend/src backend/app`). Fix any hit (StatsPage may label `reviews_by_source` keys — string labels are fine to keep; only broken imports must be fixed).

- [ ] **Step 4: Full verification**

Run from `backend/`: `python -m pytest`
Expected: all tests pass, no import errors.

Run from `frontend/`: `npm run build`
Expected: success.

Browser smoke test of the whole flow: HomePage CTA → `/daily` → review → flip → dictation → split → game unlock → find words → link meanings → confirm → results; `/games` gate behavior; low-words banner.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(games): remove legacy mini-games in favor of daily game"
```
