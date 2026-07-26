# Deep Learning (Giai đoạn 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nhận diện từ hay sai và ôn chúng bằng dạng bài khác, bắt nói ra miệng chính những từ đó, và tô sáng trạng thái từ khi đọc bài.

**Architecture:** Toàn bộ khái niệm "từ yếu" **suy ra từ `review_logs`** — không thêm cột, không migration. Từ yếu được thêm vào phiên học như session word bình thường (`is_new = false`) nên luật một-lần-submit-SM-2 của giai đoạn 1 giữ nguyên; việc phân biệt từ yếu với từ ôn thường nằm ở trường `is_weak` tính lúc trả response. Thứ tự giai đoạn do client quyết định như giai đoạn 1, server không đổi `_current_phase`.

**Tech Stack:** FastAPI + SQLAlchemy + Pydantic + pytest · React 19 + TypeScript + Vite 8 + Tailwind v4.

## Global Constraints

- Spec nguồn: `docs/superpowers/specs/2026-07-25-deep-learning-design.md`.
- **Không thêm cột vào bảng đã tồn tại, không migration.** Dự án không có Alembic; `Base.metadata.create_all` chỉ tạo bảng mới. DB thật ở Supabase.
- Không đổi thuật toán SM-2, luật chọn từ mới, luật sinh ô chữ.
- Không đụng `ShadowingPage`.
- Python backend: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe`, cwd = `backend`.
- Mọi chữ hiển thị bằng **tiếng Việt**. Màu dùng token từ `styles/tokens.css` (`text-muted`, `bg-surface-1`, `text-warn`, …), không thêm giá trị màu rời rạc.
- Code viết **xuống dòng, đọc được** — không dồn component vào một dòng.
- Ngưỡng từ yếu: **≥ 2 lần `quality ≤ 2` trong 5 bản ghi `review_logs` gần nhất** của thẻ.
- Sau mỗi task: `python -m pytest -q` (backend) và `npm run build` (frontend) phải xanh. Ngoại lệ đã biết: `tests/test_articles.py::test_article_card_accepts_a_multi_word_phrase` **đã đỏ từ trước giai đoạn 1** — không phải do việc của bạn, đừng sửa trong plan này.
- Commit sau mỗi task.

---

### Task 1: Dịch vụ nhận diện từ yếu

**Files:**
- Create: `backend/app/services/weak_words.py`, `backend/tests/test_weak_words.py`

**Interfaces:**
- Produces:
  - `WEAK_WINDOW = 5`, `WEAK_MIN_WRONG = 2`, `WEAK_QUALITY = 2`
  - `@dataclass WeakWord: card_id: str; recent_wrong: int; total_reviews: int; last_step: str | None; suggested_step: str`
  - `weak_words(db: Session, user_id: str) -> list[WeakWord]` — sắp xếp `recent_wrong` giảm dần
  - `is_weak(db: Session, card_id: str) -> bool`
  - `suggested_step(db: Session, card_id: str, rng: random.Random | None = None) -> str`

- [ ] **Step 1: Viết test thất bại**

Create `backend/tests/test_weak_words.py`:

```python
from datetime import datetime, timedelta

from app.models.review_log import ReviewLog
from app.models.user import User
from app.services import weak_words


def _user_id(db):
    return db.query(User).filter(User.email == "usera@test.com").one().id


def _card(client, word="alpha"):
    deck = client.post("/api/decks", json={"name": f"Deck {word}"}).json()
    return client.post(f"/api/decks/{deck['id']}/cards",
                       json={"front_text": word, "back_text": f"nghĩa {word}"}).json()


def _log(db, user_id, card_id, quality, days_ago):
    db.add(ReviewLog(user_id=user_id, card_id=card_id, quality=quality, rating_source="daily",
                     reviewed_at=datetime.utcnow() - timedelta(days=days_ago)))


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
    import json

    from app.models.daily_session import DailySession, DailySessionWord

    user_id = _user_id(db)
    card = _card(client)
    session = DailySession(user_id=user_id, session_date=datetime.utcnow().date(), status="done", phase="review")
    db.add(session)
    db.flush()
    db.add(DailySessionWord(session_id=session.id, card_id=card["id"], is_new=False,
                            assigned_step="dictation", steps_done=json.dumps(["dictation"])))
    db.commit()

    for _ in range(10):
        assert weak_words.suggested_step(db, card["id"]) in {"vi_en", "en_vi"}


def test_suggested_step_without_history_is_any_valid_step(client, db):
    card = _card(client)
    assert weak_words.suggested_step(db, card["id"]) in {"dictation", "vi_en", "en_vi"}
```

- [ ] **Step 2: Chạy để chắc chắn fail**

Run trong `backend`: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_weak_words.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.weak_words'`.

> Nếu constructor `DailySessionWord` khác giả định (tên cột `steps_done` lưu JSON string), mở `backend/app/models/daily_session.py` và sửa **test** cho khớp model thật.

- [ ] **Step 3: Viết service**

Create `backend/app/services/weak_words.py`:

```python
import json
import random
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.card import Card
from app.models.daily_session import DailySession, DailySessionWord
from app.models.deck import Deck
from app.models.review_log import ReviewLog

WEAK_WINDOW = 5
WEAK_MIN_WRONG = 2
WEAK_QUALITY = 2
STEPS = ("dictation", "vi_en", "en_vi")


@dataclass
class WeakWord:
    card_id: str
    recent_wrong: int
    total_reviews: int
    last_step: str | None
    suggested_step: str


def _recent_logs(db: Session, card_id: str) -> list[ReviewLog]:
    return (
        db.query(ReviewLog)
        .filter(ReviewLog.card_id == card_id)
        .order_by(ReviewLog.reviewed_at.desc(), ReviewLog.id.desc())
        .limit(WEAK_WINDOW)
        .all()
    )


def _wrong_in_window(logs: list[ReviewLog]) -> int:
    return sum(1 for log in logs if log.quality <= WEAK_QUALITY)


def last_step(db: Session, card_id: str) -> str | None:
    """Dạng bài của phiên gần nhất có chứa thẻ này.

    `reviews.last_answer_mode` không dùng được: `complete_learning` không ghi nó.
    """
    row = (
        db.query(DailySessionWord)
        .join(DailySession, DailySessionWord.session_id == DailySession.id)
        .filter(DailySessionWord.card_id == card_id)
        .order_by(DailySession.session_date.desc(), DailySession.created_at.desc())
        .first()
    )
    return row.assigned_step if row else None


def suggested_step(db: Session, card_id: str, rng: random.Random | None = None) -> str:
    rng = rng or random.Random()
    previous = last_step(db, card_id)
    options = [step for step in STEPS if step != previous] or list(STEPS)
    return rng.choice(options)


def is_weak(db: Session, card_id: str) -> bool:
    return _wrong_in_window(_recent_logs(db, card_id)) >= WEAK_MIN_WRONG


def weak_words(db: Session, user_id: str, rng: random.Random | None = None) -> list[WeakWord]:
    rng = rng or random.Random()
    card_ids = [
        row[0] for row in
        db.query(Card.id).join(Deck, Card.deck_id == Deck.id).filter(Deck.user_id == user_id).all()
    ]

    found: list[WeakWord] = []
    for card_id in card_ids:
        logs = _recent_logs(db, card_id)
        wrong = _wrong_in_window(logs)
        if wrong < WEAK_MIN_WRONG:
            continue
        found.append(WeakWord(
            card_id=card_id,
            recent_wrong=wrong,
            total_reviews=db.query(ReviewLog).filter(ReviewLog.card_id == card_id).count(),
            last_step=last_step(db, card_id),
            suggested_step=suggested_step(db, card_id, rng),
        ))

    found.sort(key=lambda item: item.recent_wrong, reverse=True)
    return found


def weak_card_ids(db: Session, user_id: str) -> set[str]:
    return {item.card_id for item in weak_words(db, user_id)}
```

> `json` được import cho các bước sau; nếu linter than phiền vì chưa dùng, bỏ dòng import đó đi.

- [ ] **Step 4: Chạy test**

Run trong `backend`: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_weak_words.py -v`
Expected: 6 PASSED.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/weak_words.py backend/tests/test_weak_words.py
git commit -m "feat(review): derive weak words from review log history"
```

---

### Task 2: API từ yếu

**Files:**
- Create: `backend/tests/test_weak_api.py`
- Modify: `backend/app/schemas/review.py`, `backend/app/routers/review.py`

**Interfaces:**
- Consumes: `app.services.weak_words` (Task 1).
- Produces:
  - `GET /api/review/weak` → `list[WeakWordOut]` với `WeakWordOut{ card: CardOut; recent_wrong: int; total_reviews: int; last_step: str | None; suggested_step: str }`
  - `POST /api/review/weak/{card_id}` body `WeakAnswerIn{ correct: bool }` → `{ "ok": true }`; ghi `ReviewLog(quality=4 nếu đúng, 2 nếu sai, rating_source="weak")` và **không** đụng `Review`.

- [ ] **Step 1: Viết test thất bại**

Create `backend/tests/test_weak_api.py`:

```python
from datetime import datetime, timedelta

from app.models.review import Review
from app.models.review_log import ReviewLog
from app.models.user import User


def _user_id(db):
    return db.query(User).filter(User.email == "usera@test.com").one().id


def _weak_card(client, db, word="alpha"):
    deck = client.post("/api/decks", json={"name": f"Deck {word}"}).json()
    card = client.post(f"/api/decks/{deck['id']}/cards",
                       json={"front_text": word, "back_text": f"nghĩa {word}"}).json()
    user_id = _user_id(db)
    for days_ago, quality in ((3, 1), (2, 2)):
        db.add(ReviewLog(user_id=user_id, card_id=card["id"], quality=quality, rating_source="daily",
                         reviewed_at=datetime.utcnow() - timedelta(days=days_ago)))
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
```

- [ ] **Step 2: Chạy để chắc chắn fail**

Run trong `backend`: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_weak_api.py -v`
Expected: FAIL — 404 vì hai endpoint chưa tồn tại.

- [ ] **Step 3: Thêm schema**

Trong `backend/app/schemas/review.py`, thêm import `from app.schemas.card import CardOut` ở đầu file và thêm vào cuối:

```python
class WeakWordOut(BaseModel):
    card: CardOut
    recent_wrong: int
    total_reviews: int
    last_step: str | None
    suggested_step: str


class WeakAnswerIn(BaseModel):
    correct: bool
```

- [ ] **Step 4: Thêm endpoint**

Trong `backend/app/routers/review.py`: thêm `WeakAnswerIn, WeakWordOut` vào import từ `app.schemas.review`, thêm `from app.services import weak_words as weak_service`, rồi thêm hai endpoint. **Đặt chúng TRƯỚC** `@router.post("/{card_id}")` — nếu đặt sau, `/weak/{card_id}` sẽ bị route `/{card_id}` nuốt mất.

```python
@router.get("/weak", response_model=list[WeakWordOut])
def get_weak_words(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    items = weak_service.weak_words(db, user.id)
    cards = {
        card.id: card for card in
        db.query(Card).filter(Card.id.in_([item.card_id for item in items])).all()
    } if items else {}
    return [
        WeakWordOut(
            card=cards[item.card_id],
            recent_wrong=item.recent_wrong,
            total_reviews=item.total_reviews,
            last_step=item.last_step,
            suggested_step=item.suggested_step,
        )
        for item in items if item.card_id in cards
    ]


@router.post("/weak/{card_id}")
def answer_weak_word(card_id: str, body: WeakAnswerIn, db: Session = Depends(get_db),
                     user: User = Depends(get_current_user)):
    card = get_owned_card(card_id, db, user)
    # Chỉ ghi lịch sử: luyện thêm ngoài buổi học không được làm rối lịch SM-2.
    db.add(ReviewLog(user_id=user.id, card_id=card.id, quality=4 if body.correct else 2,
                     rating_source="weak", reviewed_at=datetime.utcnow()))
    db.commit()
    return {"ok": True}
```

> `get_owned_card` đã được import sẵn ở đầu `routers/review.py`. Kiểm chữ ký của nó trong `backend/app/routers/cards.py` — nếu thứ tự tham số khác, gọi cho đúng.

- [ ] **Step 5: Chạy test**

Run trong `backend`: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_weak_api.py -v`
Expected: 5 PASSED.

- [ ] **Step 6: Chạy toàn bộ backend**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest -q`
Expected: chỉ còn đúng 1 fail đã biết ở `test_articles.py`.

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/review.py backend/app/routers/review.py backend/tests/test_weak_api.py
git commit -m "feat(review): expose weak word list and practice logging"
```

---

### Task 3: Đưa từ yếu vào phiên học

**Files:**
- Create: `backend/tests/test_daily_weak_phase.py`
- Modify: `backend/app/routers/daily.py`, `backend/app/schemas/daily.py`

**Interfaces:**
- Consumes: `weak_words.weak_words` (Task 1).
- Produces: `DailyWordOut` thêm `is_weak: bool`; `_create_session` thêm tối đa `WEAK_PER_SESSION = 5` từ yếu chưa due.

- [ ] **Step 1: Viết test thất bại**

Create `backend/tests/test_daily_weak_phase.py`:

```python
from datetime import date, datetime, timedelta

from app.models.review import Review
from app.models.review_log import ReviewLog
from app.models.user import User


def _user_id(db):
    return db.query(User).filter(User.email == "usera@test.com").one().id


def _card(client, deck_id, word):
    return client.post(f"/api/decks/{deck_id}/cards",
                       json={"front_text": word, "back_text": f"nghĩa {word}"}).json()


def _make_weak(db, user_id, card_id):
    for days_ago, quality in ((3, 1), (2, 2)):
        db.add(ReviewLog(user_id=user_id, card_id=card_id, quality=quality, rating_source="daily",
                         reviewed_at=datetime.utcnow() - timedelta(days=days_ago)))


def test_session_includes_weak_cards_that_are_not_due(client, db):
    deck = client.post("/api/decks", json={"name": "Weak"}).json()
    weak = _card(client, deck["id"], "alpha")
    user_id = _user_id(db)

    review = db.query(Review).filter_by(card_id=weak["id"]).one()
    review.repetitions = 2
    review.due_date = date.today() + timedelta(days=6)  # chưa đến hạn
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
```

- [ ] **Step 2: Chạy để chắc chắn fail**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_daily_weak_phase.py -v`
Expected: FAIL — `KeyError: 'is_weak'`.

- [ ] **Step 3: Thêm trường vào schema**

Trong `backend/app/schemas/daily.py`, sửa `DailyWordOut` thành:

```python
class DailyWordOut(BaseModel):
    id: str; card_id: str; is_new: bool; is_weak: bool = False
    assigned_step: str; steps_done: list[str]; wrong_count: int; card: CardOut
```

- [ ] **Step 4: Chọn thêm từ yếu khi tạo phiên**

Trong `backend/app/routers/daily.py`: thêm `from app.services import weak_words as weak_service`, hằng `WEAK_PER_SESSION = 5`, và sửa `_create_session`. Đoạn hiện tại:

```python
    review_cards, new_cards = daily_service.due_review_cards(db, user.id), daily_service.pick_new_cards(db, user.id, rng=rng)
    if not review_cards and not new_cards:
        return None
```

đổi thành:

```python
    review_cards = daily_service.due_review_cards(db, user.id)
    new_cards = daily_service.pick_new_cards(db, user.id, rng=rng)

    # Kéo tối đa 5 từ yếu chưa đến hạn lên học sớm. Từ đã due thì bỏ qua —
    # nó vốn đã nằm trong phần ôn tập, thêm lần nữa là học hai lần cùng một từ.
    due_ids = {card.id for card in review_cards}
    weak_items = [item for item in weak_service.weak_words(db, user.id, rng) if item.card_id not in due_ids]
    weak_items = weak_items[:WEAK_PER_SESSION]
    weak_cards = {
        card.id: card for card in
        db.query(Card).filter(Card.id.in_([item.card_id for item in weak_items])).all()
    } if weak_items else {}

    if not review_cards and not new_cards and not weak_items:
        return None
```

và ngay sau vòng lặp thêm từ ôn tập (`for card in review_cards: ...`), thêm:

```python
    for item in weak_items:
        card = weak_cards.get(item.card_id)
        if card is not None:
            db.add(_make_word(session, card, False, item.suggested_step))
```

- [ ] **Step 5: Điền `is_weak` khi trả response**

Trong `backend/app/routers/daily.py`, hàm `_word_out` hiện dựng `DailyWordOut`. Sửa để nhận thêm tập card_id yếu, và mọi nơi gọi `_session_out` truyền tập đó xuống:

```python
def _word_out(word: DailySessionWord, weak_ids: set[str] | None = None) -> DailyWordOut:
    return DailyWordOut(
        id=word.id, card_id=word.card_id, is_new=word.is_new,
        is_weak=bool(weak_ids and word.card_id in weak_ids),
        assigned_step=word.assigned_step,
        steps_done=json.loads(word.steps_done or "[]"),
        wrong_count=word.wrong_count, card=CardOut.model_validate(word.card),
    )
```

Mở `_session_out` và cho nó tính `weak_ids = weak_service.weak_card_ids(db, user_id)` một lần rồi truyền vào từng `_word_out`. Nếu `_session_out` chưa có `db`/`user_id` trong chữ ký, thêm tham số và cập nhật mọi nơi gọi.

> Đọc kỹ chữ ký `_word_out` và `_session_out` trong file thật trước khi sửa — giữ nguyên các trường khác đúng như đang có.

- [ ] **Step 6: Chạy test**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_daily_weak_phase.py tests/test_daily_flow.py tests/test_daily_home.py -v`
Expected: tất cả PASSED — đặc biệt `test_daily_flow.py` không được đổi kết quả.

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/daily.py backend/app/schemas/daily.py backend/tests/test_daily_weak_phase.py
git commit -m "feat(daily): pull weak words into the session as an extra review batch"
```

---

### Task 4: API trạng thái từ cho Reader

**Files:**
- Create: `backend/tests/test_word_states.py`
- Modify: `backend/app/routers/articles.py`, `backend/app/schemas/article.py`

**Interfaces:**
- Produces: `GET /api/articles/{article_id}/word-states` → `WordStatesOut{ states: dict[str, str] }`, giá trị thuộc `learning` / `mastered` / `weak`.

- [ ] **Step 1: Viết test thất bại**

Create `backend/tests/test_word_states.py`:

```python
from datetime import datetime, timedelta

from app.models.review import Review
from app.models.review_log import ReviewLog
from app.models.user import User


def _user_id(db):
    return db.query(User).filter(User.email == "usera@test.com").one().id


def test_word_states_marks_learning_mastered_and_weak(client, db):
    article = client.post("/api/articles", json={
        "title": "Bài", "source_type": "paste",
        "content": "Alpha and beta and gamma appear here.",
    }).json()

    for word in ("alpha", "beta", "gamma"):
        assert client.post(f"/api/articles/{article['id']}/cards", json={"word": word}).status_code == 200

    user_id = _user_id(db)
    reviews = {
        review.card.front_text.lower(): review
        for review in db.query(Review).all() if review.card is not None
    }

    reviews["alpha"].repetitions = 1          # đang học
    reviews["beta"].repetitions = 4           # đã thuộc
    reviews["gamma"].repetitions = 2          # đang học, nhưng sẽ thành yếu
    for days_ago, quality in ((3, 1), (2, 2)):
        db.add(ReviewLog(user_id=user_id, card_id=reviews["gamma"].card_id, quality=quality,
                         rating_source="daily", reviewed_at=datetime.utcnow() - timedelta(days=days_ago)))
    db.commit()

    states = client.get(f"/api/articles/{article['id']}/word-states").json()["states"]
    assert states["alpha"] == "learning"
    assert states["beta"] == "mastered"
    assert states["gamma"] == "weak"


def test_word_states_skips_never_studied_cards(client, db):
    article = client.post("/api/articles", json={
        "title": "Bài", "source_type": "paste", "content": "Delta appears here.",
    }).json()
    client.post(f"/api/articles/{article['id']}/cards", json={"word": "delta"})

    assert client.get(f"/api/articles/{article['id']}/word-states").json()["states"] == {}
```

- [ ] **Step 2: Chạy để chắc chắn fail**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_word_states.py -v`
Expected: FAIL — 404.

> Nếu payload tạo bài đọc hoặc tạo thẻ từ bài khác giả định, mở `backend/app/routers/articles.py:103` và `:356` lấy đúng tên field rồi sửa **test**.

- [ ] **Step 3: Thêm schema**

Trong `backend/app/schemas/article.py`, thêm:

```python
class WordStatesOut(BaseModel):
    states: dict[str, str]
```

- [ ] **Step 4: Thêm endpoint**

Trong `backend/app/routers/articles.py`, thêm import `from app.services import weak_words as weak_service` và `from app.schemas.article import WordStatesOut`, rồi thêm endpoint cạnh `GET /{article_id}/highlights`:

```python
@router.get("/{article_id}/word-states", response_model=WordStatesOut)
def get_word_states(article_id: str, db: Session = Depends(get_db),
                    user: User = Depends(get_current_user)):
    article = _get_owned_article(article_id, db, user)

    # Chỉ quan tâm những từ vừa có thẻ vừa thật sự xuất hiện trong bài.
    present = {normalize_word(token) for token in re.findall(r"[A-Za-z']+", article.content)}
    weak_ids = weak_service.weak_card_ids(db, user.id)

    rows = (
        db.query(Card, Review)
        .join(Review, Review.card_id == Card.id)
        .join(Deck, Card.deck_id == Deck.id)
        .filter(Deck.user_id == user.id, Review.repetitions >= 1)
        .all()
    )

    states: dict[str, str] = {}
    for card, review in rows:
        word = normalize_word(card.front_text)
        if word not in present:
            continue
        if card.id in weak_ids:
            states[word] = "weak"
        elif review.repetitions >= 3:
            states[word] = "mastered"
        else:
            states[word] = "learning"

    return WordStatesOut(states=states)
```

> Cần `import re`, và `normalize_word` lấy từ `app.services.article_cards`. Tên hàm lấy bài của chủ sở hữu trong file thật có thể khác `_get_owned_article` — mở file, dùng đúng tên đang có. `Card`, `Review`, `Deck` phải nằm trong import của file.

- [ ] **Step 5: Chạy test**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_word_states.py -v`
Expected: 2 PASSED.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/articles.py backend/app/schemas/article.py backend/tests/test_word_states.py
git commit -m "feat(articles): expose per-word study state for reader highlighting"
```

---

### Task 5: Kiểu và API client phía frontend

**Files:**
- Create: `frontend/src/api/weak.ts`
- Modify: `frontend/src/types/index.ts`

**Interfaces:**
- Produces:
  - `type WeakWord = { card: Card; recent_wrong: number; total_reviews: number; last_step: ExerciseStep | null; suggested_step: ExerciseStep }`
  - `DailyWord` thêm `is_weak: boolean`
  - `getWeakWords(): Promise<WeakWord[]>`, `answerWeakWord(cardId: string, correct: boolean): Promise<void>`
  - `getWordStates(articleId: string): Promise<Record<string, 'learning' | 'mastered' | 'weak'>>`

- [ ] **Step 1: Thêm kiểu**

Trong `frontend/src/types/index.ts`: thêm `is_weak: boolean` vào `interface DailyWord`, và thêm:

```ts
export type WordState = 'learning' | 'mastered' | 'weak'

export interface WeakWord {
  card: Card
  recent_wrong: number
  total_reviews: number
  last_step: ExerciseStep | null
  suggested_step: ExerciseStep
}
```

- [ ] **Step 2: Thêm client**

Create `frontend/src/api/weak.ts`:

```ts
import client from './client'
import type { WeakWord, WordState } from '../types'

export const getWeakWords = () => client.get<WeakWord[]>('/review/weak').then(response => response.data)

export const answerWeakWord = (cardId: string, correct: boolean) =>
  client.post(`/review/weak/${cardId}`, { correct }).then(() => undefined)

export const getWordStates = (articleId: string) =>
  client.get<{ states: Record<string, WordState> }>(`/articles/${articleId}/word-states`)
    .then(response => response.data.states)
```

> Mở `frontend/src/api/daily.ts` để xác nhận baseURL đã có tiền tố `/api` (các lời gọi ở đó là `/daily/...`). Nếu không, thêm `/api` vào đường dẫn ở trên.

- [ ] **Step 3: Build**

Run trong `frontend`: `npm run build`
Expected: xanh.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/weak.ts frontend/src/types/index.ts
git commit -m "feat: add weak word and word state clients"
```

---

### Task 6: Giai đoạn "Từ yếu" trong buổi học

**Files:**
- Create: `frontend/src/components/daily/steps/WeakStep.tsx`
- Modify: `frontend/src/hooks/useDailySession.ts`, `frontend/src/pages/DailyPage.tsx`, `frontend/src/components/daily/DailyProgress.tsx`

**Interfaces:**
- Consumes: `DailyWord.is_weak` (Task 5).
- Produces: `Phase` thêm `'weak'`; `QueueName` thêm `'weak'`; `WeakStep({ daily, onCorrectStreak })`.

Thứ tự giai đoạn mới: **review → weak → flip → dictation → split → game**. Server không đổi; client tự tách hàng đợi `review` (từ ôn thường) và `weak` (từ yếu) dựa vào `is_weak`.

- [ ] **Step 1: Sửa hook**

Trong `frontend/src/hooks/useDailySession.ts`:

Đổi hai type:

```ts
export type Phase = 'review' | 'weak' | 'flip' | 'dictation' | 'split' | 'game' | 'done' | 'empty'
export type QueueName = 'review' | 'weak' | 'flip' | 'dictation' | 'left' | 'right'
```

Đổi `EMPTY_QUEUES`:

```ts
const EMPTY_QUEUES: Queues = { review: [], weak: [], flip: [], dictation: [], left: [], right: [] }
```

Trong `setQueues(...)` khi nạp phiên, đổi hai dòng đầu thành:

```ts
          review: loaded.words.filter(word => !word.is_new && !word.is_weak && pending(word, word.assigned_step)),
          weak: loaded.words.filter(word => word.is_weak && pending(word, word.assigned_step)),
```

Đổi `nextPhaseAfter` để chuỗi tự chạy tiếp:

```ts
const nextPhaseAfter = (name: QueueName): Phase | null => {
  if (name === 'weak') return 'flip'
  if (name === 'flip') return 'dictation'
  if (name === 'dictation') return 'split'
  return null
}
```

Đổi `beginNew` để đi qua giai đoạn từ yếu trước:

```ts
  const beginNew = useCallback(() => {
    if (queues.weak.length) setPhase('weak')
    else if (queues.flip.length) setPhase('flip')
    else if (queues.dictation.length) setPhase('dictation')
    else if (!splitDone) setPhase('split')
    else finishLearning()
  }, [queues.weak.length, queues.flip.length, queues.dictation.length, splitDone, finishLearning])
```

Sau khi nạp phiên, nếu `loaded.phase === 'review'` mà không còn từ ôn thường nào đang chờ nhưng vẫn còn từ yếu, đặt `setPhase('weak')`. Thêm ngay sau `setPhase(loaded.phase as Phase)`:

```ts
        const pendingReview = loaded.words.some(word => !word.is_new && !word.is_weak && pending(word, word.assigned_step))
        const pendingWeak = loaded.words.some(word => word.is_weak && pending(word, word.assigned_step))
        if (loaded.phase === 'review' && !pendingReview && pendingWeak) setPhase('weak')
```

`stepsTotal` không đổi: từ yếu là session word `is_new = false` nên đã được tính 1 bước.

- [ ] **Step 2: Tạo component bước**

Create `frontend/src/components/daily/steps/WeakStep.tsx`:

```tsx
import type { useDailySession } from '../../../hooks/useDailySession'
import type { ExerciseStep } from '../../../types'
import ExerciseCard from '../ExerciseCard'

interface Props {
  daily: ReturnType<typeof useDailySession>
  onCorrectStreak?: (streak: number) => void
}

/** Từ hay sai, được kéo lên học sớm và hỏi bằng dạng bài khác lần trước. */
export default function WeakStep({ daily, onCorrectStreak }: Props) {
  const queue = daily.queues.weak

  if (!queue.length) {
    return (
      <div className="text-center">
        <p className="mb-4 text-sm font-bold text-correct">Xong phần từ yếu — tiếp theo là từ mới.</p>
        <button onClick={daily.beginNew} className="min-h-[44px] rounded-xl bg-accent px-6 text-sm font-bold text-white">
          Tiếp tục
        </button>
      </div>
    )
  }

  const word = queue[0]

  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-3 text-sm font-medium text-warn">
        Từ đang yếu · còn {queue.length} từ · hỏi bằng dạng khác lần trước
      </p>
      <ExerciseCard
        key={`${word.card_id}-${daily.presented}`}
        card={word.card}
        mode={word.assigned_step as ExerciseStep}
        onResult={correct => daily.answer('weak', word.assigned_step, correct)}
        onCorrectStreak={onCorrectStreak}
      />
    </div>
  )
}
```

- [ ] **Step 3: Ghép vào trang và nhãn tiến độ**

Trong `frontend/src/components/daily/DailyProgress.tsx`, thêm vào `PHASE_LABEL`:

```ts
  weak: 'Từ đang yếu',
```

Trong `frontend/src/pages/DailyPage.tsx`, thêm import `WeakStep` và một dòng render ngay sau `ReviewStep`:

```tsx
      {daily.phase === 'weak' && <WeakStep daily={daily} onCorrectStreak={setCombo} />}
```

- [ ] **Step 4: Build**

Run trong `frontend`: `npm run build`
Expected: xanh.

- [ ] **Step 5: Kiểm tra trong trình duyệt**

Cần một tài khoản có từ yếu. Tạo bằng cách học một buổi và cố tình trả lời sai vài từ hai ngày liên tiếp, hoặc chèn `review_logs` trực tiếp. Xác nhận: giai đoạn "Từ đang yếu" hiện sau phần ôn tập; dạng bài khác lần trước; xong thì sang phần từ mới; không có từ yếu thì giai đoạn không xuất hiện.

- [ ] **Step 6: Commit**

```bash
git add -A frontend/src
git commit -m "feat(daily): add a weak-word phase before new words"
```

---

### Task 7: Bước nói (chỉ khi worker bật)

**Files:**
- Create: `frontend/src/components/daily/steps/SpeakStep.tsx`
- Modify: `frontend/src/hooks/useDailySession.ts`, `frontend/src/pages/DailyPage.tsx`, `frontend/src/components/daily/DailyProgress.tsx`

**Interfaces:**
- Consumes: `useShadowingWorker`, `useRecorder`, `scoreRecording`, `createShadowAttempt`, `ScoreDisplay`, `Mp3Player`, `TtsPlayer`.
- Produces: `Phase` thêm `'speak'`; `SpeakStep({ words, onDone }: { words: DailyWord[]; onDone: () => void })`; hook trả thêm `speakWords: DailyWord[]`, `workerOnline: boolean`, `afterSpeak(): void`.

Bước nói **không** đụng SM-2 — những từ này đã được giai đoạn Từ yếu submit một lần.

- [ ] **Step 1: Tạo component**

Create `frontend/src/components/daily/steps/SpeakStep.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'

import { createShadowAttempt } from '../../../api/shadowing'
import { scoreRecording } from '../../../api/shadowingWorker'
import { useNotification } from '../../NotificationProvider'
import ScoreDisplay from '../../shadowing/ScoreDisplay'
import { Mp3Player, TtsPlayer, type PlayerHandle } from '../../shadowing/SegmentPlayer'
import { useRecorder } from '../../shadowing/useRecorder'
import type { DailyWord, ShadowScore } from '../../../types'

interface Props {
  words: DailyWord[]
  onDone: () => void
}

export default function SpeakStep({ words, onDone }: Props) {
  const { toast } = useNotification()
  const recorder = useRecorder()
  const playerRef = useRef<PlayerHandle | null>(null)

  const [index, setIndex] = useState(0)
  const [result, setResult] = useState<ShadowScore | null>(null)
  const [scoring, setScoring] = useState(false)

  const word = words[index]
  const target = word?.card.example_sentence?.trim() || word?.card.front_text || ''

  useEffect(() => {
    if (!recorder.blob || !target) return

    setScoring(true)
    void scoreRecording(recorder.blob, target)
      .then(score => {
        setResult(score)
        if (!score.no_speech) {
          void createShadowAttempt({
            source_type: 'card', card_id: word.card_id, article_id: null, video_id: null,
            segment_index: null, target_text: target, transcript: score.transcript,
            score: score.score, word_results: score.words,
          }).catch(() => undefined)
        }
      })
      .catch(() => toast('Không chấm được điểm — kiểm tra máy chấm', 'error'))
      .finally(() => setScoring(false))
  }, [recorder.blob]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!word) return null

  const next = () => {
    playerRef.current?.stop()
    recorder.reset()
    setResult(null)
    if (index + 1 < words.length) setIndex(index + 1)
    else onDone()
  }

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted">Nói lại · câu {index + 1}/{words.length}</p>
        <button onClick={onDone} className="text-xs font-bold text-muted underline">Bỏ qua bước nói</button>
      </div>

      {word.card.example_audio_url
        ? <Mp3Player ref={playerRef} src={word.card.example_audio_url} rate={1} />
        : <TtsPlayer ref={playerRef} text={target} rate={1} />}

      <div className="rounded-2xl border border-subtle bg-surface-1 p-5 text-center">
        <p className="text-lg font-bold leading-8 text-strong-text">{target}</p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => playerRef.current?.play()}
            className="min-h-[44px] rounded-xl border border-subtle bg-surface-2 px-4 text-sm font-bold text-accent-2"
          >
            Nghe mẫu
          </button>
          <button
            disabled={scoring}
            onClick={() => (recorder.recording ? recorder.stop() : void recorder.start())}
            className="min-h-[44px] rounded-xl bg-accent px-5 text-sm font-bold text-white disabled:opacity-40"
          >
            {recorder.recording ? 'Dừng' : 'Nói'}
          </button>
        </div>
        {recorder.error && <p className="mt-3 text-sm text-wrong">{recorder.error}</p>}
      </div>

      {scoring && <div className="h-20 animate-pulse rounded-2xl bg-surface-2" />}
      {result && !scoring && <ScoreDisplay result={result} />}

      <button onClick={next} className="min-h-[44px] w-full rounded-xl border border-subtle bg-surface-2 text-sm font-bold text-body">
        {index + 1 < words.length ? 'Câu tiếp' : 'Xong phần nói'}
      </button>
    </section>
  )
}
```

> Mở `frontend/src/components/shadowing/SegmentPlayer.tsx` và `useRecorder.ts` để xác nhận tên export và props (`src`, `text`, `rate`, `recording`, `blob`, `reset`, `error`). Nếu khác, sửa code trên cho khớp file thật.

- [ ] **Step 2: Thêm giai đoạn vào hook**

Trong `frontend/src/hooks/useDailySession.ts`: thêm `'speak'` vào `Phase`; thêm import `useShadowingWorker`; trong hook gọi `const worker = useShadowingWorker()`; và đổi `nextPhaseAfter` cho `'weak'`:

```ts
  if (name === 'weak') return 'speak'
```

Thêm vào giá trị trả về: `speakWords: session?.words.filter(word => word.is_weak) ?? []`, và `workerOnline: worker.status === 'online'`.

Trong `beginNew`, chèn nhánh `speak` giữa `weak` và `flip`:

```ts
    if (queues.weak.length) setPhase('weak')
    else if (worker.status === 'online' && session?.words.some(word => word.is_weak)) setPhase('speak')
    else if (queues.flip.length) setPhase('flip')
```

Vì `nextPhaseAfter('weak')` giờ trả `'speak'`, phải chặn khi worker tắt. Sửa chỗ dùng nó trong `answer`:

```ts
        let next = nextPhaseAfter(name)
        if (next === 'speak' && worker.status !== 'online') next = 'flip'
        if (!following.length && next) setPhase(next)
```

- [ ] **Step 3: Ghép vào trang**

Trong `DailyProgress.tsx` thêm `speak: 'Nói lại'` vào `PHASE_LABEL`.

Trong `DailyPage.tsx` thêm import `SpeakStep` và:

```tsx
      {daily.phase === 'speak' && (
        <SpeakStep words={daily.speakWords} onDone={() => daily.afterSpeak()} />
      )}
```

Không gọi `daily.beginNew()` ở đây: nó ưu tiên giai đoạn `speak` nên sẽ quay lại chính bước vừa xong. Thêm vào hook một hàm đi tiếp riêng và trả nó ra cùng `speakWords`:

```ts
  const afterSpeak = useCallback(() => {
    if (queues.flip.length) setPhase('flip')
    else if (queues.dictation.length) setPhase('dictation')
    else if (!splitDone) setPhase('split')
    else finishLearning()
  }, [queues.flip.length, queues.dictation.length, splitDone, finishLearning])
```

- [ ] **Step 4: Build**

Run trong `frontend`: `npm run build`
Expected: xanh.

- [ ] **Step 5: Kiểm tra cả hai trạng thái worker**

Với worker **tắt**: đi hết buổi học, xác nhận sau giai đoạn Từ yếu nhảy thẳng sang Lật thẻ, stepper không có "Nói lại".
Với worker **bật** (`local_shadowing/start_shadowing.bat`): xác nhận bước nói hiện ra, nghe mẫu chạy, ghi âm chấm được điểm, "Bỏ qua bước nói" nhảy đúng sang phần từ mới.

- [ ] **Step 6: Commit**

```bash
git add -A frontend/src
git commit -m "feat(daily): add a speaking step for weak words when the worker is up"
```

---

### Task 8: Trang `/weak` và ô phụ ở trang chủ

**Files:**
- Create: `frontend/src/pages/WeakWordsPage.tsx`
- Modify: `frontend/src/App.tsx`, `frontend/src/components/home/HomeSideTiles.tsx`, `frontend/src/pages/HomePage.tsx`

**Interfaces:**
- Consumes: `getWeakWords`, `answerWeakWord` (Task 5).
- Produces: route `/weak`; `HomeSideTiles` nhận thêm prop `weakCount: number`.

- [ ] **Step 1: Tạo trang**

Create `frontend/src/pages/WeakWordsPage.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { answerWeakWord, getWeakWords } from '../api/weak'
import ExerciseCard from '../components/daily/ExerciseCard'
import { useNotification } from '../components/NotificationProvider'
import type { WeakWord } from '../types'

export default function WeakWordsPage() {
  const { toast } = useNotification()
  const [words, setWords] = useState<WeakWord[] | null>(null)
  const [index, setIndex] = useState<number | null>(null)
  const [presented, setPresented] = useState(0)

  useEffect(() => {
    getWeakWords().then(setWords).catch(() => toast('Không tải được danh sách từ yếu', 'error'))
  }, [toast])

  if (!words) {
    return <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-muted">Đang tải…</div>
  }

  if (!words.length) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-black text-strong-text">Không có từ nào đang yếu</h1>
        <p className="mt-2 text-sm text-muted">
          Từ được coi là yếu khi sai ít nhất 2 trong 5 lần ôn gần nhất. Cứ học đều là danh sách này trống.
        </p>
        <Link to="/" className="mt-5 inline-flex min-h-[44px] items-center rounded-xl bg-accent px-6 text-sm font-bold text-white">
          Về trang chủ
        </Link>
      </div>
    )
  }

  if (index !== null) {
    const current = words[index]
    const finish = (correct: boolean) => {
      void answerWeakWord(current.card.id, correct).catch(() => toast('Không lưu được kết quả', 'error'))
      setPresented(value => value + 1)
      if (index + 1 < words.length) setIndex(index + 1)
      else setIndex(null)
    }

    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="mb-3 text-sm font-medium text-muted">Luyện từ yếu · {index + 1}/{words.length}</p>
        <ExerciseCard
          key={`${current.card.id}-${presented}`}
          card={current.card}
          mode={current.suggested_step}
          onResult={finish}
        />
        <button onClick={() => setIndex(null)} className="mt-4 text-xs font-bold text-muted underline">
          Dừng luyện
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-black text-strong-text">Từ đang yếu</h1>
      <p className="mt-1 text-sm text-muted">
        {words.length} từ sai ít nhất 2 trong 5 lần ôn gần nhất. Luyện ở đây không làm đổi lịch ôn.
      </p>

      <button
        onClick={() => { setIndex(0); setPresented(0) }}
        className="mt-4 min-h-[44px] rounded-xl bg-accent px-6 text-sm font-bold text-white"
      >
        Luyện ngay
      </button>

      <ul className="mt-6 grid gap-2">
        {words.map(item => (
          <li key={item.card.id} className="flex items-center gap-3 rounded-2xl border border-subtle bg-surface-1 p-4">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-strong-text">{item.card.front_text}</p>
              <p className="truncate text-xs text-muted">{item.card.back_text}</p>
            </div>
            <span className="shrink-0 rounded-full border border-warn/30 bg-warn/10 px-3 py-1 text-xs font-bold text-warn">
              sai {item.recent_wrong}/5 lần gần nhất
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Thêm route**

Trong `frontend/src/App.tsx`: thêm `const WeakWordsPage = lazy(() => import('./pages/WeakWordsPage'))` và route:

```tsx
<Route path="/weak" element={<RequireAuth><WeakWordsPage /></RequireAuth>} />
```

- [ ] **Step 3: Ô phụ ở trang chủ**

Trong `HomeSideTiles.tsx`, thêm `weakCount: number` vào `Props` và một ô thứ ba (đổi lưới thành `sm:grid-cols-3`), chỉ hiện khi `weakCount > 0`:

```tsx
      {weakCount > 0 && (
        <Link to="/weak" className="rounded-2xl border border-warn/30 bg-warn/10 p-4 transition hover:bg-warn/15">
          <p className="text-xs font-black uppercase tracking-wider text-warn">Từ đang yếu</p>
          <p className="mt-1 text-sm font-bold text-strong-text">{weakCount} từ hay sai</p>
          <p className="mt-0.5 text-xs font-medium text-muted">Luyện lại bằng dạng bài khác</p>
        </Link>
      )}
```

Trong `HomePage.tsx`, tải danh sách từ yếu và truyền số lượng xuống:

```tsx
  const weakQuery = useCachedQuery(user ? `weak:${user.id}` : null, getWeakWords)
```

rồi `<HomeSideTiles article={home.latest_article} workerOnline={workerOnline} weakCount={weakQuery.data?.length ?? 0} />`.

- [ ] **Step 4: Build**

Run trong `frontend`: `npm run build`
Expected: xanh.

- [ ] **Step 5: Kiểm tra trong trình duyệt**

Xác nhận: ô "Từ đang yếu" chỉ hiện khi có từ yếu; `/weak` liệt kê đúng; bấm "Luyện ngay" chạy hết danh sách; sau khi luyện đúng vài lần thì từ rơi khỏi danh sách (tải lại trang); và **lịch ôn không đổi** (kiểm bằng `/api/review/due` trước và sau).

- [ ] **Step 6: Commit**

```bash
git add -A frontend/src
git commit -m "feat: add the weak words page and home entry point"
```

---

### Task 9: Tô sáng trạng thái từ trong Reader

**Files:**
- Modify: `frontend/src/pages/ReaderPage.tsx`

**Interfaces:**
- Consumes: `getWordStates` (Task 5).
- Produces: không có export mới.

- [ ] **Step 1: Đọc chỗ render từ**

Mở `frontend/src/pages/ReaderPage.tsx` và tìm nơi nội dung bài được tách thành token (hàm `cleanToken` ở khoảng dòng 154 là đầu mối). Ghi lại chính xác component/đoạn JSX nào render từng từ — mọi thay đổi bên dưới phải cắm vào đúng chỗ đó, **không** dựng lại cơ chế render mới.

- [ ] **Step 2: Tải trạng thái từ**

Thêm state và effect trong component chính của trang:

```tsx
const [wordStates, setWordStates] = useState<Record<string, WordState>>({})
const [highlightOn, setHighlightOn] = useState(() => localStorage.getItem('flashie:reader-highlight') !== 'off')

useEffect(() => {
  if (!articleId) return
  getWordStates(articleId).then(setWordStates).catch(() => setWordStates({}))
}, [articleId])
```

> `articleId` lấy theo đúng tên biến đang có trong file (có thể là `id` từ `useParams`).

- [ ] **Step 3: Tô nền theo trạng thái**

Thêm hàm tra class và áp vào phần tử render mỗi từ:

```tsx
const STATE_CLASS: Record<WordState, string> = {
  learning: 'bg-accent-2/15 rounded-[3px]',
  mastered: 'bg-correct/15 rounded-[3px]',
  weak: 'bg-warn/20 rounded-[3px]',
}

const stateClass = (token: string) => {
  if (!highlightOn) return ''
  const state = wordStates[cleanToken(token).toLowerCase()]
  return state ? STATE_CLASS[state] : ''
}
```

> `cleanToken` đã có sẵn trong file. Khóa từ backend được chuẩn hóa bằng `normalize_word` (casefold + gộp khoảng trắng), nên `.toLowerCase()` ở đây là đủ khớp cho từ đơn.

- [ ] **Step 4: Chú thích và nút tắt**

Thêm ngay trên phần nội dung bài:

```tsx
<div className="mb-4 flex flex-wrap items-center gap-3 text-xs font-medium text-muted">
  <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-accent-2/40" />đang học</span>
  <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-correct/40" />đã thuộc</span>
  <span className="inline-flex items-center gap-1.5"><i className="h-3 w-3 rounded-sm bg-warn/50" />đang yếu</span>
  <button
    onClick={() => {
      const next = !highlightOn
      setHighlightOn(next)
      localStorage.setItem('flashie:reader-highlight', next ? 'on' : 'off')
    }}
    className="rounded-lg border border-subtle bg-surface-1 px-2 py-1 font-bold"
  >
    {highlightOn ? 'Tắt tô sáng' : 'Bật tô sáng'}
  </button>
</div>
```

- [ ] **Step 5: Build**

Run trong `frontend`: `npm run build`
Expected: xanh.

- [ ] **Step 6: Kiểm tra trong trình duyệt**

Mở một bài đã lưu vài từ và đã học: xác nhận ba màu hiện đúng trạng thái, thẻ chưa học lần nào **không** bị tô, dấu vàng "Từ cần nhớ" vẫn hoạt động như cũ, và nút tắt tô sáng có tác dụng sau khi tải lại trang.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/ReaderPage.tsx
git commit -m "feat(reader): highlight words by study state"
```

---

### Task 10: Rà soát cuối

**Files:**
- Modify: những chỗ phát sinh từ việc rà soát

- [ ] **Step 1: Chạy toàn bộ kiểm thử**

Run trong `backend`: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest -q`
Expected: xanh trừ đúng một fail đã biết ở `test_articles.py::test_article_card_accepts_a_multi_word_phrase`.

Run trong `frontend`: `npm run build`
Expected: xanh.

- [ ] **Step 2: Đi trọn một buổi học**

Với worker tắt: Ôn tập → Từ đang yếu → Lật thẻ → Nghe & điền → Chia đôi → Tổng kết → Ô chữ. Kiểm thanh tiến độ không tụt khi trả lời sai, và thoát giữa chừng vào lại đúng chỗ (kể cả khi đang dở giai đoạn Từ yếu).

- [ ] **Step 3: Kiểm khổ điện thoại**

Viewport 375×812 cho `/weak`, giai đoạn Từ yếu và bước nói: không cuộn ngang, nút ≥ 44px.

- [ ] **Step 4: Kiểm không rò rỉ giữa các user**

Đăng nhập tài khoản thứ hai và xác nhận `/api/review/weak` không trả từ của tài khoản thứ nhất.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "fix: polish the weak-word and speaking flows"
```

---

## Ghi chú khi thực thi

- Task 1-4 là backend có TDD thật. Task 5-9 là frontend, không có test tự động — bước kiểm chứng trong trình duyệt là bắt buộc, không được bỏ.
- Nếu code thật khác giả định trong plan (tên hàm lấy bài của chủ sở hữu, props của `SegmentPlayer`/`useRecorder`, chữ ký `_session_out`), **sửa plan theo code thật**, đừng bẻ code cho khớp plan.
- Ba giả định chưa được người dùng xác nhận (ngưỡng 2/5, vị trí giai đoạn từ yếu, bước nói đọc câu ví dụ) đều nằm gọn ở một chỗ: hằng số trong `services/weak_words.py`, `nextPhaseAfter` trong hook, và biến `target` trong `SpeakStep`. Đổi ý thì sửa đúng ba chỗ đó.
