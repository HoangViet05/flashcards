# M1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Multi-user scoping cho toàn bộ API, bảng `review_logs` append-only, và tối ưu performance (aggregate queries, pagination, FE cache/code-splitting) — nền móng cho M2-M5.

**Architecture:** Thêm `user_id` vào `decks`/`documents` (cards/reviews kế thừa quyền qua deck), mọi router yêu cầu JWT qua `get_current_user` có sẵn. Bảng mới `review_logs` ghi mỗi lần review. `/api/review/stats` và `GET /api/decks` viết lại thành aggregate query. FE thêm route guard, stale-while-revalidate cache, code splitting.

**Tech Stack:** FastAPI + SQLAlchemy 2.0 (backend), React 19 + Vite + TS (frontend), pytest, SQLite (dev/test) / Supabase Postgres (prod).

**Spec:** `docs/superpowers/specs/2026-07-14-english-learning-completion-design.md` (mục 4)

## Global Constraints

- Python chạy qua conda env `flashcard`: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe` (Python hệ thống 3.14 KHÔNG cài được deps).
- Mọi lệnh pytest chạy với cwd = `backend/`: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests -v`
- DB thật khi dev là `backend/flashcards.db` (file `flashcards.db` ở repo root là DB cũ, không đụng).
- Truy cập tài nguyên không thuộc user → trả **404** (không phải 403).
- Giữ cơ chế lightweight migration (`ensure_*` trong `database.py`), KHÔNG thêm Alembic.
- SQL phải chạy được trên cả SQLite và Postgres (dùng `func.date()`, `case()`, không dùng raw SQL đặc thù).
- Không thêm dependency Python/npm mới trong M1.
- Frontend: `cd frontend && npm run dev` (proxy /api + /media có sẵn); verify FE bằng dev server, không thêm test framework FE.
- Text hiển thị cho user (toast, button, label) viết tiếng Việt như phần UI hiện có.

---

### Task 1: Auth test fixtures

Chuyển fixture `client` sang authenticated-by-default để ~40 test hiện có tiếp tục pass khi các router bắt đầu yêu cầu auth, thêm `user_b_client` (kiểm tra cross-user) và `anon_client` (kiểm tra 401).

**Files:**
- Modify: `backend/tests/conftest.py`
- Test: chạy lại toàn bộ suite hiện có

**Interfaces:**
- Produces: fixture `client` (TestClient đã đăng nhập user A `usera@test.com`), `user_b_client` (user B `userb@test.com`, cùng DB), `anon_client` (không token). Các task sau dùng đúng 3 tên fixture này.

- [ ] **Step 1: Viết lại conftest.py**

```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, get_db

TEST_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


def _make_client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    return TestClient(app)


def _register(test_client: TestClient, email: str) -> str:
    res = test_client.post(
        "/api/auth/register",
        json={"email": email, "password": "secret123", "name": email.split("@")[0]},
    )
    assert res.status_code == 201, res.text
    return res.json()["access_token"]


@pytest.fixture
def anon_client(db):
    with _make_client(db) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def client(db):
    """TestClient đã đăng nhập sẵn user A — mặc định cho mọi test."""
    with _make_client(db) as c:
        token = _register(c, "usera@test.com")
        c.headers["Authorization"] = f"Bearer {token}"
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def user_b_client(client, db):
    """TestClient thứ hai đăng nhập user B, dùng chung DB với `client`."""
    with _make_client(db) as c:
        token = _register(c, "userb@test.com")
        c.headers["Authorization"] = f"Bearer {token}"
        yield c
```

Lưu ý: `test_auth.py` hiện dùng `client` để register/login — client có sẵn header Authorization không ảnh hưởng vì các endpoint auth là public. Nếu test nào đăng ký lại `usera@test.com` sẽ nhận 409 — sửa email trong test đó thành địa chỉ khác (kiểm tra khi chạy).

- [ ] **Step 2: Chạy toàn bộ suite, xác nhận vẫn xanh**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests -v` (cwd `backend/`)
Expected: PASS toàn bộ (các router chưa yêu cầu auth nên header thừa vô hại). Nếu test_auth fail vì trùng email → sửa email như ghi chú trên.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/conftest.py backend/tests/test_auth.py
git commit -m "test: authenticated-by-default client fixture + user_b/anon fixtures"
```

---

### Task 2: Models — user_id + ReviewLog + lightweight migration

**Files:**
- Modify: `backend/app/models/deck.py`, `backend/app/models/document.py`, `backend/app/models/review.py`, `backend/app/models/__init__.py`
- Create: `backend/app/models/review_log.py`
- Modify: `backend/app/database.py`, `backend/app/main.py`
- Test: `backend/tests/test_models.py` (mới)

**Interfaces:**
- Produces: `Deck.user_id: str` (FK users.id, NOT NULL, index), `Document.user_id: str` (như trên), model `ReviewLog(id, user_id, card_id nullable, quality, rating_source, response_time_ms nullable, reviewed_at)` bảng `review_logs`, hàm `ensure_owner_columns(engine)` trong `database.py`.

- [ ] **Step 1: Viết failing test**

```python
# backend/tests/test_models.py
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
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_models.py -v`
Expected: FAIL — `ModuleNotFoundError: app.models.review_log` / TypeError `user_id` invalid keyword.

- [ ] **Step 3: Implement models**

`backend/app/models/deck.py` — thêm import `ForeignKey` và cột (sau `id`):

```python
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
```

`backend/app/models/document.py` — thêm import `ForeignKey` và cột tương tự:

```python
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
```

`backend/app/models/review_log.py` (mới):

```python
import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class ReviewLog(Base):
    """Append-only log: một dòng cho mỗi lần review/chơi game — nguồn cho heatmap & streak."""

    __tablename__ = "review_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    # SET NULL để giữ lịch sử học khi card bị xóa
    card_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("cards.id", ondelete="SET NULL"), nullable=True
    )
    quality: Mapped[int] = mapped_column(Integer, nullable=False)
    rating_source: Mapped[str] = mapped_column(String(20), nullable=False, default="flip")
    response_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reviewed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (Index("ix_review_logs_user_reviewed", "user_id", "reviewed_at"),)
```

`backend/app/models/review.py` — thêm index cho cột due_date (query due/stats lọc theo cột này):

```python
    due_date: Mapped[date] = mapped_column(Date, default=date.today, index=True)
```

`backend/app/models/__init__.py` — thêm dòng import theo pattern hiện có:

```python
from app.models.review_log import ReviewLog  # noqa: F401
```

`backend/app/database.py` — thêm cuối file:

```python
OWNER_COLUMN_TABLES = ("decks", "documents")


def ensure_owner_columns(engine_) -> None:
    """Lightweight migration: thêm cột user_id (nullable trong DDL — DB cũ nên reset bằng scripts/reset_db.py)."""
    inspector = inspect(engine_)
    with engine_.connect() as conn:
        for table in OWNER_COLUMN_TABLES:
            if not inspector.has_table(table):
                continue
            existing = {column["name"] for column in inspector.get_columns(table)}
            if "user_id" not in existing:
                conn.execute(text(f'ALTER TABLE {table} ADD COLUMN "user_id" VARCHAR(36)'))
        conn.commit()
```

`backend/app/main.py` — cập nhật import và gọi sau `ensure_review_columns(engine)`:

```python
from app.database import Base, engine, ensure_card_columns, ensure_review_columns, ensure_owner_columns
...
ensure_owner_columns(engine)
```

- [ ] **Step 4: Chạy test mới, xác nhận pass; chạy full suite**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests -v`
Expected: `test_models.py` PASS. **Các test decks/cards/review/anki sẽ FAIL** (tạo Deck không có user_id → NOT NULL violation) — đây là expected, các task 3-8 sẽ sửa router + test tương ứng. Ghi lại danh sách file test đang đỏ để đối chiếu ở task cuối.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models backend/app/database.py backend/app/main.py backend/tests/test_models.py
git commit -m "feat: user_id on decks/documents + append-only review_logs table"
```

---

### Task 3: Decks router — auth scoping + counts trong 1 query

**Files:**
- Modify: `backend/app/routers/decks.py`, `backend/app/schemas/deck.py`
- Test: `backend/tests/test_decks.py`

**Interfaces:**
- Consumes: fixtures Task 1, `Deck.user_id` Task 2, `get_current_user` từ `app.services.security`.
- Produces: `DeckOut` thêm `card_count: int`, `due_count: int`, `new_count: int`; helper `deck_counts_query(db, user_id, deck_id=None)` và `deck_to_out(row) -> DeckOut` export từ `app.routers.decks` (Task 4 dùng lại khi cần trả deck kèm counts).

- [ ] **Step 1: Viết failing tests — thêm vào cuối `test_decks.py`**

```python
def test_decks_require_auth(anon_client):
    assert anon_client.get("/api/decks").status_code == 401


def test_deck_isolated_between_users(client, user_b_client):
    created = client.post("/api/decks", json={"name": "Private"}).json()
    # User B không thấy trong list
    assert user_b_client.get("/api/decks").json() == []
    # User B truy cập trực tiếp → 404 (không lộ tồn tại)
    assert user_b_client.get(f"/api/decks/{created['id']}").status_code == 404
    assert user_b_client.put(f"/api/decks/{created['id']}", json={"name": "Hack"}).status_code == 404
    assert user_b_client.delete(f"/api/decks/{created['id']}").status_code == 404


def test_deck_list_returns_counts(client):
    deck = client.post("/api/decks", json={"name": "Counted"}).json()
    client.post(f"/api/decks/{deck['id']}/cards", json={"front_text": "hello", "back_text": "xin chào"})
    listed = client.get("/api/decks").json()
    assert listed[0]["card_count"] == 1
    # Card mới tạo có review due hôm nay, repetitions=0 → là "new"
    assert listed[0]["new_count"] == 1
    assert listed[0]["due_count"] == 0
```

- [ ] **Step 2: Chạy, xác nhận fail**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_decks.py -v`
Expected: FAIL (401 chưa có, counts chưa có; các test cũ fail vì NOT NULL user_id).

- [ ] **Step 3: Implement — viết lại toàn bộ `backend/app/routers/decks.py`**

```python
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.card import Card
from app.models.deck import Deck
from app.models.review import Review
from app.models.user import User
from app.schemas.deck import DeckCreate, DeckUpdate, DeckOut
from app.services.security import get_current_user

router = APIRouter(prefix="/api/decks", tags=["decks"])


def deck_counts_query(db: Session, user_id: str, deck_id: str | None = None):
    """1 query: deck + card_count + due_count + new_count (thay cho N+1)."""
    today = date.today()
    query = (
        db.query(
            Deck,
            func.count(Card.id).label("card_count"),
            func.coalesce(
                func.sum(case(((Review.due_date <= today) & (Review.repetitions > 0), 1), else_=0)), 0
            ).label("due_count"),
            func.coalesce(
                func.sum(case(((Review.due_date <= today) & (Review.repetitions == 0), 1), else_=0)), 0
            ).label("new_count"),
        )
        .outerjoin(Card, Card.deck_id == Deck.id)
        .outerjoin(Review, Review.card_id == Card.id)
        .filter(Deck.user_id == user_id)
        .group_by(Deck.id)
        .order_by(Deck.name.asc())
    )
    if deck_id is not None:
        query = query.filter(Deck.id == deck_id)
    return query


def deck_to_out(row) -> DeckOut:
    deck, card_count, due_count, new_count = row
    return DeckOut(
        id=deck.id,
        name=deck.name,
        description=deck.description,
        created_at=deck.created_at,
        updated_at=deck.updated_at,
        card_count=card_count or 0,
        due_count=due_count or 0,
        new_count=new_count or 0,
    )


def get_owned_deck(deck_id: str, db: Session, user: User) -> Deck:
    deck = db.query(Deck).filter(Deck.id == deck_id, Deck.user_id == user.id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    return deck


@router.get("", response_model=list[DeckOut])
def list_decks(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return [deck_to_out(row) for row in deck_counts_query(db, user.id).all()]


@router.post("", response_model=DeckOut)
def create_deck(body: DeckCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    deck = Deck(name=body.name, description=body.description, user_id=user.id)
    db.add(deck)
    db.commit()
    db.refresh(deck)
    return deck_to_out((deck, 0, 0, 0))


@router.get("/{deck_id}", response_model=DeckOut)
def get_deck(deck_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    row = deck_counts_query(db, user.id, deck_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Deck not found")
    return deck_to_out(row)


@router.put("/{deck_id}", response_model=DeckOut)
def update_deck(deck_id: str, body: DeckUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    deck = get_owned_deck(deck_id, db, user)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(deck, field, value)
    db.commit()
    row = deck_counts_query(db, user.id, deck_id).first()
    return deck_to_out(row)


@router.delete("/{deck_id}", response_model=DeckOut)
def delete_deck(deck_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    deck = get_owned_deck(deck_id, db, user)
    out = deck_to_out((deck, 0, 0, 0))
    db.delete(deck)
    db.commit()
    return out
```

`backend/app/schemas/deck.py` — `DeckOut` thêm 3 field:

```python
class DeckOut(BaseModel):
    id: str
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime
    card_count: int = 0
    due_count: int = 0
    new_count: int = 0

    model_config = {"from_attributes": True}
```

- [ ] **Step 4: Chạy test_decks, xác nhận pass**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_decks.py -v`
Expected: PASS toàn bộ (test cũ pass vì `client` giờ authenticated và router tự gán user_id).

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/decks.py backend/app/schemas/deck.py backend/tests/test_decks.py
git commit -m "feat: scope decks per user + single-query counts in deck list"
```

---

### Task 4: Cards router — scoping qua deck + pagination

**Files:**
- Modify: `backend/app/routers/cards.py`
- Test: `backend/tests/test_cards.py`

**Interfaces:**
- Consumes: `get_owned_deck` từ `app.routers.decks` (Task 3), fixtures Task 1.
- Produces: `GET /api/decks/{deck_id}/cards?limit=&offset=` (default limit 50, max 200) trả `list[CardOut]` + header `X-Total-Count`; helper `get_owned_card(card_id, db, user) -> Card` export từ `app.routers.cards` (Task 5 dùng).

- [ ] **Step 1: Viết failing tests — thêm vào cuối `test_cards.py`**

```python
def _create_deck_with_cards(client, n):
    deck = client.post("/api/decks", json={"name": f"Deck {n} cards"}).json()
    for i in range(n):
        client.post(
            f"/api/decks/{deck['id']}/cards",
            json={"front_text": f"word-{i}", "back_text": f"nghĩa {i}"},
        )
    return deck


def test_cards_require_auth(anon_client):
    assert anon_client.get("/api/decks/any-id/cards").status_code == 401


def test_cards_isolated_between_users(client, user_b_client):
    deck = _create_deck_with_cards(client, 1)
    card = client.get(f"/api/decks/{deck['id']}/cards").json()[0]
    assert user_b_client.get(f"/api/decks/{deck['id']}/cards").status_code == 404
    assert user_b_client.put(f"/api/cards/{card['id']}", json={"front_text": "hack"}).status_code == 404
    assert user_b_client.delete(f"/api/cards/{card['id']}").status_code == 404


def test_cards_pagination(client):
    deck = _create_deck_with_cards(client, 5)
    res = client.get(f"/api/decks/{deck['id']}/cards", params={"limit": 2, "offset": 0})
    assert res.status_code == 200
    assert len(res.json()) == 2
    assert res.headers["X-Total-Count"] == "5"
    res2 = client.get(f"/api/decks/{deck['id']}/cards", params={"limit": 2, "offset": 4})
    assert len(res2.json()) == 1
```

- [ ] **Step 2: Chạy, xác nhận fail**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_cards.py -v`
Expected: FAIL (401/404/pagination chưa có).

- [ ] **Step 3: Implement — viết lại toàn bộ `backend/app/routers/cards.py`**

```python
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.card import Card
from app.models.deck import Deck
from app.models.review import Review
from app.models.user import User
from app.routers.decks import get_owned_deck
from app.schemas.card import CardCreate, CardUpdate, CardOut
from app.services.security import get_current_user

router = APIRouter(tags=["cards"])


def get_owned_card(card_id: str, db: Session, user: User) -> Card:
    card = (
        db.query(Card)
        .join(Deck, Card.deck_id == Deck.id)
        .filter(Card.id == card_id, Deck.user_id == user.id)
        .first()
    )
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


@router.get("/api/decks/{deck_id}/cards", response_model=list[CardOut])
def list_cards(
    deck_id: str,
    response: Response,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    get_owned_deck(deck_id, db, user)
    base = db.query(Card).filter(Card.deck_id == deck_id)
    response.headers["X-Total-Count"] = str(base.count())
    return base.order_by(Card.created_at.asc()).offset(offset).limit(limit).all()


@router.post("/api/decks/{deck_id}/cards", response_model=CardOut)
def create_card(
    deck_id: str,
    body: CardCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    get_owned_deck(deck_id, db, user)

    # Kiểm tra trùng lặp
    existing = db.query(Card).filter(
        Card.deck_id == deck_id,
        Card.front_text == body.front_text.strip(),
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Thẻ này đã tồn tại trong bộ bài!")

    card = Card(deck_id=deck_id, **body.model_dump())
    db.add(card)
    db.flush()
    review = Review(card_id=card.id, due_date=date.today())
    db.add(review)
    db.commit()
    db.refresh(card)
    return card


@router.put("/api/cards/{card_id}", response_model=CardOut)
def update_card(
    card_id: str,
    body: CardUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    card = get_owned_card(card_id, db, user)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(card, field, value)
    db.commit()
    db.refresh(card)
    return card


@router.delete("/api/cards/{card_id}", response_model=CardOut)
def delete_card(
    card_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    card = get_owned_card(card_id, db, user)
    db.delete(card)
    db.commit()
    return card
```

- [ ] **Step 4: Chạy test_cards, xác nhận pass**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_cards.py -v`
Expected: PASS. Lưu ý: nếu test cũ trong file này đọc list cards với >50 thẻ thì thêm `params={"limit": 200}` — kiểm tra khi chạy.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/cards.py backend/tests/test_cards.py
git commit -m "feat: scope cards via deck ownership + pagination with X-Total-Count"
```

---

### Task 5: Review router — scoping + ghi ReviewLog

**Files:**
- Modify: `backend/app/routers/review.py` (chỉ `get_due_cards` + `submit_review`; `get_stats` để Task 6)
- Test: `backend/tests/test_review.py`

**Interfaces:**
- Consumes: `ReviewLog` (Task 2), `get_owned_card` (Task 4), fixtures Task 1.
- Produces: `POST /api/review/{card_id}` ghi thêm 1 dòng `review_logs` mỗi lần submit (quality, rating_source, response_time_ms, user_id); `GET /api/review/due` chỉ trả thẻ của user.

- [ ] **Step 1: Viết failing tests — thêm vào cuối `test_review.py`**

```python
from app.models.review_log import ReviewLog


def _make_card(client, deck_name="RLog Deck"):
    deck = client.post("/api/decks", json={"name": deck_name}).json()
    client.post(f"/api/decks/{deck['id']}/cards", json={"front_text": "log-word", "back_text": "nghĩa"})
    return client.get(f"/api/decks/{deck['id']}/cards").json()[0]


def test_review_due_requires_auth(anon_client):
    assert anon_client.get("/api/review/due").status_code == 401


def test_due_cards_scoped_per_user(client, user_b_client):
    _make_card(client)
    assert len(client.get("/api/review/due").json()) == 1
    assert user_b_client.get("/api/review/due").json() == []


def test_submit_review_writes_log(client, db):
    card = _make_card(client, "Log Deck 2")
    res = client.post(
        f"/api/review/{card['id']}",
        json={"quality": 5, "rating_source": "flip", "response_time_ms": 1200},
    )
    assert res.status_code == 200
    logs = db.query(ReviewLog).all()
    assert len(logs) == 1
    assert logs[0].card_id == card["id"]
    assert logs[0].quality == 5
    assert logs[0].rating_source == "flip"
    assert logs[0].response_time_ms == 1200


def test_submit_review_foreign_card_404(client, user_b_client):
    card = _make_card(client, "Log Deck 3")
    res = user_b_client.post(f"/api/review/{card['id']}", json={"quality": 5})
    assert res.status_code == 404
```

- [ ] **Step 2: Chạy, xác nhận fail**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_review.py -v`
Expected: FAIL.

- [ ] **Step 3: Implement — sửa `backend/app/routers/review.py`**

Thêm imports:

```python
from app.models.deck import Deck
from app.models.review_log import ReviewLog
from app.models.user import User
from app.routers.cards import get_owned_card
from app.services.security import get_current_user
```

Thay `get_due_cards`:

```python
@router.get("/due", response_model=list[ReviewOut])
def get_due_cards(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    today = date.today()
    return (
        db.query(Review)
        .join(Card, Review.card_id == Card.id)
        .join(Deck, Card.deck_id == Deck.id)
        .filter(Deck.user_id == user.id, Review.due_date <= today)
        .all()
    )
```

Thay `submit_review` — thêm param `user: User = Depends(get_current_user)`, thay đoạn tìm review, và ghi log trước `db.commit()`:

```python
@router.post("/{card_id}", response_model=ReviewOut)
def submit_review(card_id: str, body: ReviewSubmit, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if body.quality < 0 or body.quality > 5:
        raise HTTPException(status_code=400, detail="Quality must be 0-5")
    if body.auto_quality is not None and (body.auto_quality < 0 or body.auto_quality > 5):
        raise HTTPException(status_code=400, detail="Auto quality must be 0-5")
    get_owned_card(card_id, db, user)  # 404 nếu không phải thẻ của user
    review = db.query(Review).filter(Review.card_id == card_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    # ... (giữ nguyên toàn bộ đoạn compute_sm2 + gán các field hiện có) ...
    review.reviewed_at = datetime.utcnow()
    db.add(ReviewLog(
        user_id=user.id,
        card_id=card_id,
        quality=body.quality,
        rating_source=body.rating_source or "flip",
        response_time_ms=body.response_time_ms,
    ))
    db.commit()
    db.refresh(review)
    return review
```

(Chỉ chèn `get_owned_card`, param `user`, và `db.add(ReviewLog(...))` — logic SM-2 giữ nguyên từng dòng.)

- [ ] **Step 4: Chạy test_review (trừ stats), xác nhận pass**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_review.py -v`
Expected: PASS các test due/submit/log. Test stats cũ có thể vẫn đỏ (chưa auth) — Task 6 xử lý.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/review.py backend/tests/test_review.py
git commit -m "feat: scope review endpoints per user + append review_logs on submit"
```

---

### Task 6: Stats viết lại — 3 aggregate query

**Files:**
- Modify: `backend/app/routers/review.py` (hàm `get_stats`)
- Test: `backend/tests/test_review.py`

**Interfaces:**
- Consumes: `ReviewLog` (Task 2), scoping pattern Task 5.
- Produces: `GET /api/review/stats` — schema `StatsOut` giữ nguyên field, streak tính từ `review_logs`.

- [ ] **Step 1: Viết failing tests — thêm vào cuối `test_review.py`**

```python
def test_stats_scoped_and_aggregated(client, user_b_client):
    card = _make_card(client, "Stats Deck")
    client.post(f"/api/review/{card['id']}", json={"quality": 5})

    stats = client.get("/api/review/stats").json()
    assert stats["total_cards"] == 1
    assert stats["total_reviewed_today"] == 1
    assert stats["streak"] == 1
    assert len(stats["due_upcoming"]) == 7

    stats_b = user_b_client.get("/api/review/stats").json()
    assert stats_b["total_cards"] == 0
    assert stats_b["streak"] == 0


def test_stats_streak_from_logs(client, db):
    """Streak = số ngày liên tục có log, tính lùi từ hôm nay."""
    from datetime import datetime, timedelta
    from app.models.review_log import ReviewLog
    from app.models.user import User

    user = db.query(User).filter(User.email == "usera@test.com").one()
    now = datetime.utcnow()
    for days_ago in (0, 1, 2, 4):  # đứt quãng ở ngày 3
        db.add(ReviewLog(user_id=user.id, card_id=None, quality=4, reviewed_at=now - timedelta(days=days_ago)))
    db.commit()

    stats = client.get("/api/review/stats").json()
    assert stats["streak"] == 3
```

- [ ] **Step 2: Chạy, xác nhận fail**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_review.py -k stats -v`
Expected: FAIL (stats chưa auth-scoped, streak vẫn đọc từ `reviews.reviewed_at`).

- [ ] **Step 3: Implement — thay toàn bộ `get_stats` trong `review.py`**

Thêm import: `from sqlalchemy import case, func`.

```python
@router.get("/stats", response_model=StatsOut)
def get_stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    today = date.today()

    # Query 1: tổng số thẻ + due + new (1 aggregate trên reviews của user)
    totals = (
        db.query(
            func.count(Review.id),
            func.coalesce(func.sum(case(((Review.due_date <= today) & (Review.repetitions > 0), 1), else_=0)), 0),
            func.coalesce(func.sum(case(((Review.due_date <= today) & (Review.repetitions == 0), 1), else_=0)), 0),
        )
        .select_from(Review)
        .join(Card, Review.card_id == Card.id)
        .join(Deck, Card.deck_id == Deck.id)
        .filter(Deck.user_id == user.id)
        .one()
    )
    total_cards, due_today, new_cards = int(totals[0]), int(totals[1]), int(totals[2])

    # Query 2: số review theo ngày (365 ngày) từ review_logs → streak + reviewed_today
    since = datetime.combine(today - timedelta(days=365), datetime.min.time())
    day_rows = (
        db.query(func.date(ReviewLog.reviewed_at), func.count(ReviewLog.id))
        .filter(ReviewLog.user_id == user.id, ReviewLog.reviewed_at >= since)
        .group_by(func.date(ReviewLog.reviewed_at))
        .all()
    )
    # func.date trả str trên SQLite, date trên Postgres → chuẩn hóa về str ISO
    counts_by_day = {str(day): count for day, count in day_rows}

    total_reviewed_today = counts_by_day.get(today.isoformat(), 0)
    streak = 0
    check = today
    while counts_by_day.get(check.isoformat(), 0) > 0:
        streak += 1
        check -= timedelta(days=1)

    # Query 3: lịch due 7 ngày tới (1 GROUP BY thay vì 7 query)
    upcoming_rows = (
        db.query(Review.due_date, func.count(Review.id))
        .join(Card, Review.card_id == Card.id)
        .join(Deck, Card.deck_id == Deck.id)
        .filter(Deck.user_id == user.id, Review.due_date > today, Review.due_date <= today + timedelta(days=7))
        .group_by(Review.due_date)
        .all()
    )
    upcoming_counts = {d.isoformat() if hasattr(d, "isoformat") else str(d): c for d, c in upcoming_rows}
    due_upcoming = {
        (today + timedelta(days=i)).isoformat(): upcoming_counts.get((today + timedelta(days=i)).isoformat(), 0)
        for i in range(1, 8)
    }

    return StatsOut(
        streak=streak,
        total_cards=total_cards,
        total_reviewed_today=total_reviewed_today,
        due_today=due_today,
        new_cards=new_cards,
        due_upcoming=due_upcoming,
    )
```

- [ ] **Step 4: Chạy full suite backend**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests -v`
Expected: PASS tất cả TRỪ `test_anki_import_api.py` / `test_anki_importer.py` / `test_documents*` (nếu có) — Task 7-8 xử lý.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/review.py backend/tests/test_review.py
git commit -m "perf: rewrite stats as 3 aggregate queries, streak from review_logs"
```

---

### Task 7: Documents + AI routers — auth scoping

**Files:**
- Modify: `backend/app/routers/documents.py`, `backend/app/routers/ai.py`
- Test: `backend/tests/test_documents.py` (mới)

**Interfaces:**
- Consumes: `Document.user_id` (Task 2), fixtures Task 1.
- Produces: mọi endpoint documents filter theo user; router AI yêu cầu auth (router-level dependency).

- [ ] **Step 1: Viết failing test — `backend/tests/test_documents.py` (mới)**

```python
import io


def _upload_pdf(test_client):
    # PDF tối giản hợp lệ (1 trang trắng)
    pdf_bytes = (
        b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
        b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n"
        b"xref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n"
        b"0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n164\n%%EOF"
    )
    return test_client.post(
        "/api/documents/upload",
        files={"file": ("test.pdf", io.BytesIO(pdf_bytes), "application/pdf")},
    )


def test_documents_require_auth(anon_client):
    assert anon_client.get("/api/documents").status_code == 401


def test_documents_scoped_per_user(client, user_b_client):
    res = _upload_pdf(client)
    assert res.status_code == 200, res.text
    doc_id = res.json()["id"]

    assert len(client.get("/api/documents").json()) == 1
    assert user_b_client.get("/api/documents").json() == []
    assert user_b_client.get(f"/api/documents/{doc_id}").status_code == 404
    assert user_b_client.delete(f"/api/documents/{doc_id}").status_code == 404


def test_ai_requires_auth(anon_client):
    res = anon_client.post("/api/ai/generate", json={"word": "test"})
    assert res.status_code == 401
```

- [ ] **Step 2: Chạy, xác nhận fail**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_documents.py -v`
Expected: FAIL (chưa auth).

- [ ] **Step 3: Implement**

`backend/app/routers/documents.py`:
- Thêm imports: `from app.models.user import User`, `from app.services.security import get_current_user`.
- Mỗi endpoint thêm param `user: User = Depends(get_current_user)`.
- `list_documents`: `db.query(Document).filter(Document.user_id == user.id).order_by(...)`.
- `get_document` / `delete_document`: filter thêm `Document.user_id == user.id`.
- `upload_pdf`: `Document(..., user_id=user.id)`.

`backend/app/routers/ai.py` — chỉ đổi khai báo router:

```python
from fastapi import APIRouter, Depends, HTTPException
from app.services.security import get_current_user

router = APIRouter(prefix="/api/ai", tags=["ai"], dependencies=[Depends(get_current_user)])
```

- [ ] **Step 4: Chạy, xác nhận pass**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_documents.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/documents.py backend/app/routers/ai.py backend/tests/test_documents.py
git commit -m "feat: scope documents per user, require auth on AI endpoints"
```

---

### Task 8: Anki importer — gắn user + CLI --user-email

**Files:**
- Modify: `backend/app/services/anki_importer.py`, `backend/app/routers/anki_import.py`, `backend/import_anki.py`
- Test: `backend/tests/test_anki_importer.py`, `backend/tests/test_anki_import_api.py`

**Interfaces:**
- Consumes: `Deck.user_id` (Task 2).
- Produces: `import_collection(collection_path, media_reader, db, user_id, ...)`, `import_apkg(apkg_path, db, user_id, media_dest=...)`, `import_extracted_dir(dir_path, db, user_id, media_dest=...)` — tham số `user_id: str` bắt buộc, vị trí sau `db`. CLI `python import_anki.py --user-email <email>` (bắt buộc).

- [ ] **Step 1: Cập nhật tests hiện có thành failing tests**

Trong `test_anki_importer.py`: các call `import_apkg(path, db)` / `import_extracted_dir(dir, db)` / `import_collection(...)` thêm `user_id`. Tạo helper đầu file:

```python
from app.models.user import User


def _owner(db) -> str:
    user = User(email="importer@test.com", password_hash="x")
    db.add(user)
    db.commit()
    return user.id
```

và sửa mỗi call thành dạng `import_apkg(path, db, user_id)` với `user_id = _owner(db)` (tạo 1 lần mỗi test). Thêm assertion vào 1 test import thành công:

```python
    deck = db.query(Deck).first()
    assert deck.user_id == user_id
```

Trong `test_anki_import_api.py`: giữ nguyên (client đã authenticated) — thêm 1 test:

```python
def test_import_requires_auth(anon_client):
    res = anon_client.post("/api/anki/import", files={"file": ("x.apkg", b"zz", "application/zip")})
    assert res.status_code == 401
```

- [ ] **Step 2: Chạy, xác nhận fail**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_anki_importer.py tests/test_anki_import_api.py -v`
Expected: FAIL — TypeError (signature chưa có user_id) / NOT NULL user_id.

- [ ] **Step 3: Implement**

`backend/app/services/anki_importer.py`:
- `import_collection(collection_path, media_reader, db, user_id: str, ...)` — thêm param, dòng tạo deck (dòng ~260) thành `deck = Deck(name=deck_name, description=description, user_id=user_id)`.
- Kiểm tra deck trùng tên (skip-logic hiện có): thêm filter `Deck.user_id == user_id` vào query tìm deck theo tên để mỗi user import độc lập.
- `import_apkg(apkg_path, db, user_id, media_dest=DEFAULT_MEDIA_DEST)` và `import_extracted_dir(dir_path, db, user_id, media_dest=DEFAULT_MEDIA_DEST)` — thêm param, truyền xuống `import_collection`.

`backend/app/routers/anki_import.py`:

```python
from app.models.user import User
from app.services.security import get_current_user
```

endpoint thêm `user: User = Depends(get_current_user)` và gọi `import_apkg(tmp_path, db, user.id, media_dest=anki_importer.DEFAULT_MEDIA_DEST)`.

`backend/import_anki.py` — thêm argument và lookup:

```python
    parser.add_argument("--user-email", required=True, help="Email tài khoản sở hữu deck import vào")
```

sau `ensure_card_columns(engine)` thêm `ensure_owner_columns(engine)` (import từ `app.database`), và trong `main()`:

```python
    from app.models.user import User

    db = SessionLocal()
    try:
        owner = db.query(User).filter(User.email == args.user_email).first()
        if not owner:
            print(f"Lỗi: không tìm thấy user {args.user_email} — đăng ký tài khoản trên web trước.")
            sys.exit(1)
        if args.apkg:
            summary = import_apkg(args.apkg, db, owner.id)
        else:
            summary = import_extracted_dir(args.anki_dir or BACKEND_DIR.parent / "extracted_anki", db, owner.id)
```

- [ ] **Step 4: Chạy full suite, xác nhận toàn bộ xanh**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests -v`
Expected: PASS 100% — đối chiếu với danh sách test đỏ ghi ở Task 2 Step 4, không còn file nào đỏ.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/anki_importer.py backend/app/routers/anki_import.py backend/import_anki.py backend/tests/test_anki_importer.py backend/tests/test_anki_import_api.py
git commit -m "feat: anki import assigns decks to owner, CLI requires --user-email"
```

---

### Task 9: GZip middleware + script reset DB prod

**Files:**
- Modify: `backend/app/main.py`
- Create: `backend/scripts/reset_db.py`, `backend/scripts/__init__.py` (file rỗng nếu chưa có — đã có thư mục `app/scripts`, đây là `backend/scripts` mới ở cạnh `app/`)
- Test: verify thủ công (script chạy tay, có confirm gate)

**Interfaces:**
- Produces: response API > 1000 bytes được gzip; script `python scripts/reset_db.py` (cwd backend) drop + recreate toàn bộ bảng theo `DATABASE_URL`.

- [ ] **Step 1: Thêm GZipMiddleware vào `main.py`**

```python
from fastapi.middleware.gzip import GZipMiddleware
...
app.add_middleware(GZipMiddleware, minimum_size=1000)
```

(đặt ngay sau `app.add_middleware(CORSMiddleware, ...)`)

- [ ] **Step 2: Viết `backend/scripts/reset_db.py`**

```python
"""Reset toàn bộ database theo DATABASE_URL — DÙNG CHO LẦN MIGRATE SANG SCHEMA MULTI-USER.

Cách dùng (cwd = backend/):
    # Local (backend/flashcards.db):
    python scripts/reset_db.py
    # Prod Supabase:
    DATABASE_URL=postgresql://... python scripts/reset_db.py

Sau khi reset:
    1. Mở web, đăng ký tài khoản chủ app.
    2. python import_anki.py --user-email <email>   # import lại 600 từ
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import Base, engine, DATABASE_URL
import app.models  # noqa: F401 — nạp toàn bộ model vào Base.metadata


def main() -> None:
    print(f"Database: {DATABASE_URL}")
    print("CẢNH BÁO: Xóa TOÀN BỘ bảng và dữ liệu (users, decks, cards, reviews, documents, review_logs).")
    answer = input("Gõ YES để tiếp tục: ")
    if answer.strip() != "YES":
        print("Đã hủy.")
        sys.exit(0)

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("Đã reset xong. Bước tiếp theo: đăng ký tài khoản rồi chạy import_anki.py --user-email <email>.")


if __name__ == "__main__":
    main()
```

Kiểm tra `backend/app/models/__init__.py` đã import đủ Deck, Card, Review, ReviewLog, User, Document (nếu thiếu cái nào thì thêm) — để `drop_all/create_all` thấy đủ bảng.

- [ ] **Step 3: Verify thủ công trên DB tạm**

Run (cwd backend): `set DATABASE_URL=sqlite:///./tmp_reset.db&& echo YES | C:\Users\Admin\anaconda3\envs\flashcard\python.exe scripts\reset_db.py` — hoặc chạy tay và gõ YES.
Expected: in "Đã reset xong..."; xóa file `tmp_reset.db` sau khi verify. KHÔNG chạy với DATABASE_URL prod trong task này (việc reset prod là bước vận hành sau khi deploy M1, do user quyết định thời điểm).

- [ ] **Step 4: Chạy full suite (đảm bảo GZip không phá test)**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests -v`
Expected: PASS 100%.

- [ ] **Step 5: Commit**

```bash
git add backend/app/main.py backend/scripts/reset_db.py
git commit -m "feat: gzip responses + reset_db script for multi-user migration"
```

---

### Task 10: FE — dùng counts từ API, bỏ N+1 ở HomePage, pagination DeckDetail

**Files:**
- Modify: `frontend/src/types/index.ts` (hoặc file types chứa `Deck`), `frontend/src/api/decks.ts`, `frontend/src/api/cards.ts`, `frontend/src/pages/HomePage.tsx`, `frontend/src/pages/DeckDetailPage.tsx`

**Interfaces:**
- Consumes: `DeckOut.card_count/due_count/new_count` (Task 3), `X-Total-Count` + `limit/offset` (Task 4).
- Produces: type `Deck` thêm `card_count: number; due_count: number; new_count: number`; `getCards(deckId, opts?: {limit?: number; offset?: number}) => Promise<{items: Card[]; total: number}>`.

- [ ] **Step 1: Cập nhật types + API layer**

Type `Deck` (tìm trong `frontend/src/types/`) thêm:

```typescript
  card_count: number
  due_count: number
  new_count: number
```

`frontend/src/api/cards.ts` — sửa hàm list (giữ các hàm create/update/delete nguyên):

```typescript
export async function getCards(
  deckId: string,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ items: Card[]; total: number }> {
  const res = await client.get<Card[]>(`/api/decks/${deckId}/cards`, {
    params: { limit: opts.limit ?? 100, offset: opts.offset ?? 0 },
  })
  return { items: res.data, total: Number(res.headers['x-total-count'] ?? res.data.length) }
}
```

- [ ] **Step 2: HomePage — xóa N+1**

Trong `HomePage.tsx` hàm `load()` (dòng ~123-145): xóa toàn bộ đoạn `await Promise.all(d.map(async deck => { const cards = await getCards(deck.id) ... }))` và 3 state `cardCounts/dueCounts/newCounts`; đọc trực tiếp từ deck:

```typescript
  const load = async () => {
    const [d, r] = await Promise.all([getDecks(), getDueCards()])
    setDecks(d)
    setDueReviews(r)
  }
```

Chỗ render `<DeckCard ... cardCount={cardCounts[deck.id] ?? 0} dueCount={...} newCount={...}>` đổi thành `cardCount={deck.card_count} dueCount={deck.due_count} newCount={deck.new_count}`. Nếu nơi khác trong file còn dùng `getCards` cho AI generate (tìm deck đích) thì cập nhật theo signature mới (`(await getCards(id)).items`).

- [ ] **Step 3: DeckDetailPage — load theo trang**

- State mới: `const [total, setTotal] = useState(0)`; load đầu: `const { items, total } = await getCards(id, { limit: 100, offset: 0 })`.
- Nút "Tải thêm" hiển thị khi `cards.length < total`, bấm gọi `getCards(id, { limit: 100, offset: cards.length })` rồi `setCards(prev => [...prev, ...items])`.
- Badge "X thẻ" dùng `total` thay `cards.length`. Badge "cần ôn" (dòng ~339) đổi từ tính trên `cards` sang fetch deck (`getDeck(id)`) và dùng `deck.due_count`.
- Mọi chỗ khác trong file gọi `getCards(...)` cập nhật destructure `.items`.

- [ ] **Step 4: Verify bằng dev server**

Chạy backend + frontend dev server (launch config `backend`, `frontend` trong `.claude/launch.json`). Đăng nhập → HomePage: mở DevTools Network xác nhận KHÔNG còn loạt request `/api/decks/{id}/cards` (chỉ 2 request: decks + due). Deck detail: hiện 100 thẻ đầu + nút "Tải thêm" với deck 600 từ... (deck unit chỉ 20 thẻ — tạo deck test hoặc xác nhận nút không hiện khi total ≤ 100). Xác nhận tạo/sửa/xóa deck + card vẫn hoạt động, review 1 thẻ vẫn hoạt động.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "perf: use server-side deck counts, remove HomePage N+1, paginate deck detail"
```

---

### Task 11: FE — RequireAuth route guard + code splitting

**Files:**
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `useAuth()` từ `frontend/src/auth/AuthContext.tsx` (đã có field `token`).
- Produces: mọi route trừ `/login`, `/register` yêu cầu đăng nhập; mỗi page là lazy chunk riêng.

- [ ] **Step 1: Viết lại `App.tsx`**

```tsx
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import { useAuth } from './auth/AuthContext'

const HomePage = lazy(() => import('./pages/HomePage'))
const DeckDetailPage = lazy(() => import('./pages/DeckDetailPage'))
const ReviewPage = lazy(() => import('./pages/ReviewPage'))
const StatsPage = lazy(() => import('./pages/StatsPage'))
const DocumentListPage = lazy(() => import('./pages/DocumentListPage'))
const DocumentDetailPage = lazy(() => import('./pages/DocumentDetailPage'))
const AuthPage = lazy(() => import('./pages/AuthPage'))
const AccountPage = lazy(() => import('./pages/AccountPage'))

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  const location = useLocation()
  if (!token) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-500 border-t-transparent" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen">
        <Navbar />
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/register" element={<AuthPage mode="register" />} />
            <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
            <Route path="/decks/:id" element={<RequireAuth><DeckDetailPage /></RequireAuth>} />
            <Route path="/review" element={<RequireAuth><ReviewPage /></RequireAuth>} />
            <Route path="/stats" element={<RequireAuth><StatsPage /></RequireAuth>} />
            <Route path="/documents" element={<RequireAuth><DocumentListPage /></RequireAuth>} />
            <Route path="/documents/:id" element={<RequireAuth><DocumentDetailPage /></RequireAuth>} />
            <Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  )
}
```

Lưu ý: kiểm tra `main.tsx` — `AuthProvider` phải bọc ngoài `App` (nếu đang bọc trong App thì giữ nguyên vị trí sao cho `useAuth` dùng được trong `RequireAuth`). Nếu `AuthPage` không có default export thì điều chỉnh cú pháp lazy tương ứng.

- [ ] **Step 2: Verify bằng dev server**

- Logout → truy cập `/` → bị đẩy về `/login`.
- Login → về `/` bình thường; điều hướng giữa các trang thấy chunk JS tải riêng (Network tab, filter JS).
- `npm run build` (cwd frontend) chạy sạch, output có nhiều chunk per-page.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx frontend/src/main.tsx
git commit -m "feat: route guard for authenticated pages + per-route code splitting"
```

---

### Task 12: FE — useCachedQuery (stale-while-revalidate)

**Files:**
- Create: `frontend/src/hooks/useCachedQuery.ts`
- Modify: `frontend/src/pages/HomePage.tsx`, `frontend/src/pages/StatsPage.tsx`, `frontend/src/auth/AuthContext.tsx`

**Interfaces:**
- Produces: `useCachedQuery<T>(key: string | null, fetcher: () => Promise<T>) => { data: T | null; loading: boolean; stale: boolean; refresh: () => Promise<void> }` — key `null` tắt hook (chờ user id); helper `clearQueryCache()` xóa mọi key `swr:*` (gọi khi logout).

- [ ] **Step 1: Viết hook `frontend/src/hooks/useCachedQuery.ts`**

```typescript
import { useCallback, useEffect, useRef, useState } from 'react'

const PREFIX = 'swr:'

function readCache<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/** Xóa toàn bộ cache SWR — gọi khi logout để không lộ dữ liệu giữa các tài khoản. */
export function clearQueryCache() {
  const keys: string[] = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i)
    if (k?.startsWith(PREFIX)) keys.push(k)
  }
  keys.forEach(k => window.localStorage.removeItem(k))
}

/**
 * Stale-while-revalidate: trả ngay bản cache localStorage (nếu có) rồi refetch ngầm.
 * key nên chứa user id (vd `decks:${user.id}`); truyền null để chờ.
 */
export function useCachedQuery<T>(key: string | null, fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(() => (key ? readCache<T>(key) : null))
  const [loading, setLoading] = useState(key !== null && data === null)
  const [stale, setStale] = useState(data !== null)
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher

  const refresh = useCallback(async () => {
    if (!key) return
    try {
      const fresh = await fetcherRef.current()
      setData(fresh)
      setStale(false)
      try {
        window.localStorage.setItem(PREFIX + key, JSON.stringify(fresh))
      } catch {
        /* quota đầy — bỏ qua, chỉ mất cache */
      }
    } finally {
      setLoading(false)
    }
  }, [key])

  useEffect(() => {
    if (!key) return
    const cached = readCache<T>(key)
    setData(cached)
    setStale(cached !== null)
    setLoading(cached === null)
    refresh()
  }, [key, refresh])

  return { data, loading, stale, refresh }
}
```

- [ ] **Step 2: Áp dụng vào HomePage + StatsPage**

`HomePage.tsx`:

```typescript
const { user } = useAuth()
const decksQuery = useCachedQuery(user ? `home:${user.id}` : null, async () => {
  const [d, r] = await Promise.all([getDecks(), getDueCards()])
  return { decks: d, due: r }
})
const decks = decksQuery.data?.decks ?? []
const dueReviews = decksQuery.data?.due ?? []
```

thay cho state `decks`/`dueReviews` + `load()`; các handler đang gọi `load()` sau mutation đổi thành `decksQuery.refresh()`. Khi `decksQuery.loading` → render skeleton grid (div bo tròn `animate-pulse` cùng kích thước DeckCard, 6 ô) thay vì spinner toàn trang.

`StatsPage.tsx`: tương tự — `useCachedQuery(user ? `stats:${user.id}` : null, getStats)`; loading → skeleton các ô số liệu.

`AuthContext.tsx` — trong `logout` callback thêm:

```typescript
import { clearQueryCache } from '../hooks/useCachedQuery'
...
clearQueryCache()
```

- [ ] **Step 3: Verify bằng dev server**

- Mở HomePage lần 1 → thấy data. Reload trang → deck grid hiện NGAY (từ cache, không chờ API) rồi tự cập nhật.
- DevTools → Application → localStorage: có key `swr:home:<uid>`, `swr:stats:<uid>`.
- Tạo deck mới → grid cập nhật (refresh sau mutation hoạt động).
- Logout → localStorage không còn key `swr:*`. Login lại account khác (nếu có) không thấy data account cũ.
- `npm run build` sạch.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/hooks/useCachedQuery.ts frontend/src/pages/HomePage.tsx frontend/src/pages/StatsPage.tsx frontend/src/auth/AuthContext.tsx
git commit -m "perf: stale-while-revalidate localStorage cache for home and stats"
```

---

### Task 13: Verify end-to-end M1 + cập nhật docs

**Files:**
- Modify: `README.md` (mục Quick Start: thêm `--user-email` vào lệnh import, ghi chú cần đăng ký tài khoản trước)

- [ ] **Step 1: Full backend suite**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests -v` (cwd backend)
Expected: PASS 100%.

- [ ] **Step 2: Reset DB local + import lại (diễn tập quy trình prod)**

Cwd backend, chạy lần lượt (env `flashcard`):
1. `python scripts/reset_db.py` → gõ YES (DB local `backend/flashcards.db`)
2. Mở app (dev servers), đăng ký tài khoản test.
3. `python import_anki.py --user-email <email vừa đăng ký>`
Expected: import in "Decks mới: 30", app hiện 30 deck với đúng card_count=20, due badge hoạt động.

- [ ] **Step 3: Smoke test flows chính qua dev server**

Học 1 thẻ mới + review → StatsPage streak=1, reviewed_today tăng; user thứ hai đăng ký → HomePage trống (không thấy deck user 1).

- [ ] **Step 4: Cập nhật README + commit**

Sửa mục Quick Start bước import: `python import_anki.py --user-email you@example.com` + ghi chú "đăng ký tài khoản trong app trước khi import".

```bash
git add README.md
git commit -m "docs: import requires --user-email after multi-user scoping"
```

---

## Ghi chú triển khai prod (sau khi merge M1 — thao tác tay của user, không phải task agent)

1. Deploy backend mới lên Render (schema mới tự tạo bảng `review_logs`, cột user_id qua `ensure_owner_columns`).
2. Chạy local: `set DATABASE_URL=<supabase-url>` → `python scripts/reset_db.py` → gõ YES.
3. Mở web prod, đăng ký tài khoản chủ app.
4. Local: `set DATABASE_URL=<supabase-url>` → `python import_anki.py --user-email <email>` (media đã ở Supabase Storage, import chỉ ghi DB).
