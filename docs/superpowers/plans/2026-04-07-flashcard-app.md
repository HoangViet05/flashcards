# Flashcard App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dark-mode web flashcard app for English vocabulary with spaced repetition (SM-2), image/audio support, and a FastAPI backend ready for future AI integration.

**Architecture:** React + Vite + TypeScript frontend communicating with a FastAPI backend via REST API, PostgreSQL for data, MinIO for media storage, all orchestrated with Docker Compose in a monorepo.

**Tech Stack:** React 18, Vite, TypeScript, TailwindCSS, shadcn/ui, FastAPI, SQLAlchemy, Alembic, PostgreSQL 16, MinIO, Docker Compose, pytest, vitest

---

## File Map

### Infrastructure
- `docker-compose.yml` — all 4 services (frontend, backend, db, minio)
- `.env` — environment variables (DB URL, MinIO credentials)
- `.env.example` — template for env vars

### Backend
- `backend/requirements.txt` — Python dependencies
- `backend/app/main.py` — FastAPI app entry point, router registration, CORS
- `backend/app/database.py` — SQLAlchemy engine, session, Base
- `backend/app/models/deck.py` — Deck ORM model
- `backend/app/models/card.py` — Card ORM model
- `backend/app/models/review.py` — Review ORM model (SM-2 state)
- `backend/app/schemas/deck.py` — Pydantic schemas for Deck
- `backend/app/schemas/card.py` — Pydantic schemas for Card
- `backend/app/schemas/review.py` — Pydantic schemas for Review
- `backend/app/routers/decks.py` — CRUD endpoints for decks
- `backend/app/routers/cards.py` — CRUD endpoints for cards
- `backend/app/routers/upload.py` — image/audio upload to MinIO
- `backend/app/routers/review.py` — due cards, submit review, stats
- `backend/app/routers/ai.py` — AI stub endpoints (501)
- `backend/app/services/sm2.py` — SM-2 algorithm
- `backend/app/services/storage.py` — MinIO upload helper
- `backend/alembic/` — migration config (auto-generated)
- `backend/tests/test_sm2.py` — unit tests for SM-2
- `backend/tests/test_decks.py` — integration tests for deck endpoints
- `backend/tests/test_cards.py` — integration tests for card endpoints
- `backend/tests/test_review.py` — integration tests for review endpoints
- `backend/tests/conftest.py` — pytest fixtures (test DB, client)

### Frontend
- `frontend/package.json` — dependencies
- `frontend/vite.config.ts` — Vite config with proxy to backend
- `frontend/tailwind.config.ts` — dark mode config, custom colors
- `frontend/src/main.tsx` — React entry point
- `frontend/src/App.tsx` — Router setup
- `frontend/src/api/client.ts` — axios instance with base URL
- `frontend/src/api/decks.ts` — deck API calls
- `frontend/src/api/cards.ts` — card API calls
- `frontend/src/api/review.ts` — review API calls
- `frontend/src/types/index.ts` — shared TypeScript types
- `frontend/src/pages/HomePage.tsx` — deck grid + due banner
- `frontend/src/pages/DeckDetailPage.tsx` — card list + add card form
- `frontend/src/pages/ReviewPage.tsx` — flip card + rating buttons
- `frontend/src/pages/StatsPage.tsx` — streak + charts
- `frontend/src/components/DeckCard.tsx` — deck grid item
- `frontend/src/components/FlipCard.tsx` — 3D flip card animation
- `frontend/src/components/RatingButtons.tsx` — 4 SM-2 rating buttons
- `frontend/src/components/Navbar.tsx` — top navigation
- `frontend/src/components/AddCardForm.tsx` — form with image/audio upload

---

## Task 1: Project Scaffold & Docker Compose

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `.env`
- Create: `backend/requirements.txt`
- Create: `backend/Dockerfile`
- Create: `frontend/Dockerfile`

- [ ] **Step 1: Create `.env.example`**

```
POSTGRES_DB=flashcards
POSTGRES_USER=flashcards
POSTGRES_PASSWORD=flashcards
DATABASE_URL=postgresql://flashcards:flashcards@db:5432/flashcards
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
MINIO_ENDPOINT=minio:9000
MINIO_BUCKET=flashcards
```

- [ ] **Step 2: Copy `.env.example` to `.env`**

```bash
cp .env.example .env
```

- [ ] **Step 3: Create `docker-compose.yml`**

```yaml
version: "3.9"

services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - miniodata:/data

  backend:
    build: ./backend
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    environment:
      DATABASE_URL: ${DATABASE_URL}
      MINIO_ENDPOINT: ${MINIO_ENDPOINT}
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
      MINIO_BUCKET: ${MINIO_BUCKET}
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
    depends_on:
      - db
      - minio

  frontend:
    build: ./frontend
    command: npm run dev -- --host
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    depends_on:
      - backend

volumes:
  pgdata:
  miniodata:
```

- [ ] **Step 4: Create `backend/requirements.txt`**

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy==2.0.30
alembic==1.13.1
psycopg2-binary==2.9.9
pydantic==2.7.1
pydantic-settings==2.2.1
python-multipart==0.0.9
minio==7.2.7
pytest==8.2.0
httpx==0.27.0
pytest-asyncio==0.23.6
```

- [ ] **Step 5: Create `backend/Dockerfile`**

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
```

- [ ] **Step 6: Create `frontend/Dockerfile`**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
```

- [ ] **Step 7: Commit**

```bash
git init
git add docker-compose.yml .env.example backend/requirements.txt backend/Dockerfile frontend/Dockerfile
git commit -m "feat: project scaffold with Docker Compose"
```

---

## Task 2: Backend — Database Setup & Models

**Files:**
- Create: `backend/app/__init__.py`
- Create: `backend/app/database.py`
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/deck.py`
- Create: `backend/app/models/card.py`
- Create: `backend/app/models/review.py`

- [ ] **Step 1: Create `backend/app/database.py`**

```python
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = os.environ["DATABASE_URL"]

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

- [ ] **Step 2: Create `backend/app/models/deck.py`**

```python
import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Deck(Base):
    __tablename__ = "decks"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    cards: Mapped[list["Card"]] = relationship("Card", back_populates="deck", cascade="all, delete-orphan")
```

- [ ] **Step 3: Create `backend/app/models/card.py`**

```python
import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Card(Base):
    __tablename__ = "cards"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    deck_id: Mapped[str] = mapped_column(String, ForeignKey("decks.id"), nullable=False)
    front_text: Mapped[str] = mapped_column(String, nullable=False)
    back_text: Mapped[str] = mapped_column(Text, nullable=False)
    example_sentence: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String, nullable=True)
    audio_url: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    deck: Mapped["Deck"] = relationship("Deck", back_populates="cards")
    review: Mapped["Review | None"] = relationship("Review", back_populates="card", uselist=False, cascade="all, delete-orphan")
```

- [ ] **Step 4: Create `backend/app/models/review.py`**

```python
import uuid
from datetime import datetime, date
from sqlalchemy import String, Float, Integer, Date, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    card_id: Mapped[str] = mapped_column(String, ForeignKey("cards.id"), nullable=False, unique=True)
    ease_factor: Mapped[float] = mapped_column(Float, default=2.5)
    interval: Mapped[int] = mapped_column(Integer, default=1)
    repetitions: Mapped[int] = mapped_column(Integer, default=0)
    due_date: Mapped[date] = mapped_column(Date, default=date.today)
    last_quality: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    card: Mapped["Card"] = relationship("Card", back_populates="review")
```

- [ ] **Step 5: Create empty `__init__.py` files**

```bash
touch backend/app/__init__.py backend/app/models/__init__.py
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/
git commit -m "feat: SQLAlchemy models for deck, card, review"
```

---

## Task 3: Backend — Alembic Migrations

**Files:**
- Create: `backend/alembic.ini` (auto-generated)
- Create: `backend/alembic/` directory (auto-generated)

- [ ] **Step 1: Initialize Alembic inside backend container**

```bash
docker compose run --rm backend alembic init alembic
```

- [ ] **Step 2: Update `backend/alembic/env.py` to use app models**

Find the line `target_metadata = None` and replace the relevant section:

```python
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.database import Base
from app.models.deck import Deck
from app.models.card import Card
from app.models.review import Review

target_metadata = Base.metadata
```

Also update the `get_url()` / `sqlalchemy.url` line in `alembic.ini` — set it to a placeholder and override in `env.py`:

In `env.py`, in `run_migrations_offline()` and `run_migrations_online()`, use:
```python
url = os.environ["DATABASE_URL"]
```

- [ ] **Step 3: Generate initial migration**

```bash
docker compose run --rm backend alembic revision --autogenerate -m "initial schema"
```

Expected: creates `backend/alembic/versions/xxxx_initial_schema.py`

- [ ] **Step 4: Run migration**

```bash
docker compose run --rm backend alembic upgrade head
```

Expected: `Running upgrade -> xxxx, initial schema`

- [ ] **Step 5: Commit**

```bash
git add backend/alembic/
git commit -m "feat: alembic initial migration for decks, cards, reviews"
```

---

## Task 4: Backend — SM-2 Service

**Files:**
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/sm2.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_sm2.py`

- [ ] **Step 1: Write failing tests in `backend/tests/test_sm2.py`**

```python
from app.services.sm2 import compute_sm2


def test_quality_below_3_resets_repetitions():
    result = compute_sm2(ease_factor=2.5, interval=6, repetitions=3, quality=2)
    assert result["repetitions"] == 0
    assert result["interval"] == 1


def test_quality_below_3_keeps_ease_factor_unchanged():
    result = compute_sm2(ease_factor=2.5, interval=6, repetitions=3, quality=2)
    assert result["ease_factor"] == 2.5


def test_first_successful_review_sets_interval_to_6():
    result = compute_sm2(ease_factor=2.5, interval=1, repetitions=1, quality=5)
    assert result["interval"] == 6
    assert result["repetitions"] == 2


def test_subsequent_interval_multiplied_by_ease_factor():
    result = compute_sm2(ease_factor=2.5, interval=6, repetitions=2, quality=5)
    assert result["interval"] == 15  # round(6 * 2.5)


def test_ease_factor_decreases_on_hard_quality():
    result = compute_sm2(ease_factor=2.5, interval=1, repetitions=1, quality=3)
    # new_ef = 2.5 + (0.1 - (5-3)*(0.08 + (5-3)*0.02)) = 2.5 - 0.14 = 2.36
    assert abs(result["ease_factor"] - 2.36) < 0.01


def test_ease_factor_minimum_clamped_at_1_3():
    result = compute_sm2(ease_factor=1.3, interval=1, repetitions=1, quality=3)
    assert result["ease_factor"] >= 1.3


def test_zero_repetitions_sets_interval_to_1():
    result = compute_sm2(ease_factor=2.5, interval=1, repetitions=0, quality=5)
    assert result["interval"] == 1
    assert result["repetitions"] == 1
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
docker compose run --rm backend pytest tests/test_sm2.py -v
```

Expected: `ModuleNotFoundError` or `ImportError` (sm2 module doesn't exist yet)

- [ ] **Step 3: Create `backend/app/services/sm2.py`**

```python
def compute_sm2(ease_factor: float, interval: int, repetitions: int, quality: int) -> dict:
    """
    Compute next SM-2 state after a review.
    quality: 0-5 (0=blackout, 5=perfect)
    Returns dict with keys: ease_factor, interval, repetitions
    """
    if quality < 3:
        return {
            "ease_factor": ease_factor,
            "interval": 1,
            "repetitions": 0,
        }

    new_ef = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    new_ef = max(1.3, new_ef)

    new_repetitions = repetitions + 1

    if repetitions == 0:
        new_interval = 1
    elif repetitions == 1:
        new_interval = 6
    else:
        new_interval = round(interval * ease_factor)

    return {
        "ease_factor": new_ef,
        "interval": new_interval,
        "repetitions": new_repetitions,
    }
```

- [ ] **Step 4: Create empty init files**

```bash
touch backend/app/services/__init__.py backend/tests/__init__.py
```

- [ ] **Step 5: Create `backend/tests/conftest.py`**

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


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
docker compose run --rm backend pytest tests/test_sm2.py -v
```

Expected: all 7 tests PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/ backend/tests/
git commit -m "feat: SM-2 spaced repetition algorithm with tests"
```

---

## Task 5: Backend — FastAPI App & Schemas

**Files:**
- Create: `backend/app/main.py`
- Create: `backend/app/schemas/__init__.py`
- Create: `backend/app/schemas/deck.py`
- Create: `backend/app/schemas/card.py`
- Create: `backend/app/schemas/review.py`

- [ ] **Step 1: Create `backend/app/schemas/deck.py`**

```python
from pydantic import BaseModel
from datetime import datetime


class DeckCreate(BaseModel):
    name: str
    description: str | None = None


class DeckUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class DeckOut(BaseModel):
    id: str
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 2: Create `backend/app/schemas/card.py`**

```python
from pydantic import BaseModel
from datetime import datetime


class CardCreate(BaseModel):
    front_text: str
    back_text: str
    example_sentence: str | None = None
    image_url: str | None = None
    audio_url: str | None = None


class CardUpdate(BaseModel):
    front_text: str | None = None
    back_text: str | None = None
    example_sentence: str | None = None
    image_url: str | None = None
    audio_url: str | None = None


class CardOut(BaseModel):
    id: str
    deck_id: str
    front_text: str
    back_text: str
    example_sentence: str | None
    image_url: str | None
    audio_url: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 3: Create `backend/app/schemas/review.py`**

```python
from pydantic import BaseModel
from datetime import date, datetime


class ReviewSubmit(BaseModel):
    quality: int  # 0-5


class ReviewOut(BaseModel):
    id: str
    card_id: str
    ease_factor: float
    interval: int
    repetitions: int
    due_date: date
    last_quality: int | None
    reviewed_at: datetime | None

    model_config = {"from_attributes": True}


class StatsOut(BaseModel):
    streak: int
    total_cards: int
    total_reviewed_today: int
    due_today: int
    due_upcoming: dict[str, int]  # "YYYY-MM-DD" -> count
```

- [ ] **Step 4: Create `backend/app/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Flashcard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 5: Create empty `__init__.py`**

```bash
touch backend/app/schemas/__init__.py
```

- [ ] **Step 6: Start backend and verify health endpoint**

```bash
docker compose up backend -d
curl http://localhost:8000/health
```

Expected: `{"status":"ok"}`

- [ ] **Step 7: Commit**

```bash
git add backend/app/main.py backend/app/schemas/
git commit -m "feat: FastAPI app with CORS and Pydantic schemas"
```

---

## Task 6: Backend — Deck & Card Routers

**Files:**
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/routers/decks.py`
- Create: `backend/app/routers/cards.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_decks.py`
- Create: `backend/tests/test_cards.py`

- [ ] **Step 1: Write failing tests in `backend/tests/test_decks.py`**

```python
def test_create_deck(client):
    response = client.post("/api/decks", json={"name": "IELTS Vocab"})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "IELTS Vocab"
    assert "id" in data


def test_list_decks(client):
    client.post("/api/decks", json={"name": "Deck A"})
    client.post("/api/decks", json={"name": "Deck B"})
    response = client.get("/api/decks")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_get_deck(client):
    created = client.post("/api/decks", json={"name": "My Deck"}).json()
    response = client.get(f"/api/decks/{created['id']}")
    assert response.status_code == 200
    assert response.json()["name"] == "My Deck"


def test_get_deck_not_found(client):
    response = client.get("/api/decks/nonexistent-id")
    assert response.status_code == 404


def test_update_deck(client):
    created = client.post("/api/decks", json={"name": "Old Name"}).json()
    response = client.put(f"/api/decks/{created['id']}", json={"name": "New Name"})
    assert response.status_code == 200
    assert response.json()["name"] == "New Name"


def test_delete_deck(client):
    created = client.post("/api/decks", json={"name": "To Delete"}).json()
    response = client.delete(f"/api/decks/{created['id']}")
    assert response.status_code == 200
    assert client.get(f"/api/decks/{created['id']}").status_code == 404
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
docker compose run --rm backend pytest tests/test_decks.py -v
```

Expected: connection error or 404 (routes not registered)

- [ ] **Step 3: Create `backend/app/routers/decks.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.deck import Deck
from app.schemas.deck import DeckCreate, DeckUpdate, DeckOut

router = APIRouter(prefix="/api/decks", tags=["decks"])


@router.get("", response_model=list[DeckOut])
def list_decks(db: Session = Depends(get_db)):
    return db.query(Deck).order_by(Deck.created_at.desc()).all()


@router.post("", response_model=DeckOut)
def create_deck(body: DeckCreate, db: Session = Depends(get_db)):
    deck = Deck(name=body.name, description=body.description)
    db.add(deck)
    db.commit()
    db.refresh(deck)
    return deck


@router.get("/{deck_id}", response_model=DeckOut)
def get_deck(deck_id: str, db: Session = Depends(get_db)):
    deck = db.query(Deck).filter(Deck.id == deck_id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    return deck


@router.put("/{deck_id}", response_model=DeckOut)
def update_deck(deck_id: str, body: DeckUpdate, db: Session = Depends(get_db)):
    deck = db.query(Deck).filter(Deck.id == deck_id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(deck, field, value)
    db.commit()
    db.refresh(deck)
    return deck


@router.delete("/{deck_id}", response_model=DeckOut)
def delete_deck(deck_id: str, db: Session = Depends(get_db)):
    deck = db.query(Deck).filter(Deck.id == deck_id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    db.delete(deck)
    db.commit()
    return deck
```

- [ ] **Step 4: Write failing tests in `backend/tests/test_cards.py`**

```python
def test_create_card(client):
    deck = client.post("/api/decks", json={"name": "Vocab"}).json()
    response = client.post(f"/api/decks/{deck['id']}/cards", json={
        "front_text": "ephemeral",
        "back_text": "tạm thời, ngắn ngủi"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["front_text"] == "ephemeral"
    assert data["deck_id"] == deck["id"]


def test_list_cards(client):
    deck = client.post("/api/decks", json={"name": "Vocab"}).json()
    client.post(f"/api/decks/{deck['id']}/cards", json={"front_text": "a", "back_text": "b"})
    client.post(f"/api/decks/{deck['id']}/cards", json={"front_text": "c", "back_text": "d"})
    response = client.get(f"/api/decks/{deck['id']}/cards")
    assert response.status_code == 200
    assert len(response.json()) == 2


def test_update_card(client):
    deck = client.post("/api/decks", json={"name": "Vocab"}).json()
    card = client.post(f"/api/decks/{deck['id']}/cards", json={"front_text": "old", "back_text": "old"}).json()
    response = client.put(f"/api/cards/{card['id']}", json={"front_text": "new"})
    assert response.status_code == 200
    assert response.json()["front_text"] == "new"


def test_delete_card(client):
    deck = client.post("/api/decks", json={"name": "Vocab"}).json()
    card = client.post(f"/api/decks/{deck['id']}/cards", json={"front_text": "x", "back_text": "y"}).json()
    response = client.delete(f"/api/cards/{card['id']}")
    assert response.status_code == 200
```

- [ ] **Step 5: Create `backend/app/routers/cards.py`**

```python
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.card import Card
from app.models.deck import Deck
from app.models.review import Review
from app.schemas.card import CardCreate, CardUpdate, CardOut

router = APIRouter(tags=["cards"])


@router.get("/api/decks/{deck_id}/cards", response_model=list[CardOut])
def list_cards(deck_id: str, db: Session = Depends(get_db)):
    deck = db.query(Deck).filter(Deck.id == deck_id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    return db.query(Card).filter(Card.deck_id == deck_id).all()


@router.post("/api/decks/{deck_id}/cards", response_model=CardOut)
def create_card(deck_id: str, body: CardCreate, db: Session = Depends(get_db)):
    deck = db.query(Deck).filter(Deck.id == deck_id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    card = Card(deck_id=deck_id, **body.model_dump())
    db.add(card)
    db.flush()
    review = Review(card_id=card.id, due_date=date.today())
    db.add(review)
    db.commit()
    db.refresh(card)
    return card


@router.put("/api/cards/{card_id}", response_model=CardOut)
def update_card(card_id: str, body: CardUpdate, db: Session = Depends(get_db)):
    card = db.query(Card).filter(Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(card, field, value)
    db.commit()
    db.refresh(card)
    return card


@router.delete("/api/cards/{card_id}", response_model=CardOut)
def delete_card(card_id: str, db: Session = Depends(get_db)):
    card = db.query(Card).filter(Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    db.delete(card)
    db.commit()
    return card
```

- [ ] **Step 6: Register routers in `backend/app/main.py`**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import decks, cards

app = FastAPI(title="Flashcard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(decks.router)
app.include_router(cards.router)


@app.get("/health")
def health():
    return {"status": "ok"}
```

- [ ] **Step 7: Create empty `__init__.py`**

```bash
touch backend/app/routers/__init__.py
```

- [ ] **Step 8: Run all tests**

```bash
docker compose run --rm backend pytest tests/test_decks.py tests/test_cards.py -v
```

Expected: all tests PASS

- [ ] **Step 9: Commit**

```bash
git add backend/app/routers/ backend/app/main.py backend/tests/
git commit -m "feat: deck and card CRUD endpoints"
```

---

## Task 7: Backend — MinIO Storage Service

**Files:**
- Create: `backend/app/services/storage.py`
- Create: `backend/app/routers/upload.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Create `backend/app/services/storage.py`**

```python
import os
from minio import Minio
from minio.error import S3Error

MINIO_ENDPOINT = os.environ.get("MINIO_ENDPOINT", "minio:9000")
MINIO_ACCESS_KEY = os.environ.get("MINIO_ROOT_USER", "minioadmin")
MINIO_SECRET_KEY = os.environ.get("MINIO_ROOT_PASSWORD", "minioadmin")
MINIO_BUCKET = os.environ.get("MINIO_BUCKET", "flashcards")


def get_minio_client() -> Minio:
    client = Minio(
        MINIO_ENDPOINT,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=False,
    )
    if not client.bucket_exists(MINIO_BUCKET):
        client.make_bucket(MINIO_BUCKET)
    return client


def upload_file(file_data: bytes, filename: str, content_type: str) -> str:
    """Upload file to MinIO and return public URL."""
    import io
    client = get_minio_client()
    client.put_object(
        MINIO_BUCKET,
        filename,
        io.BytesIO(file_data),
        length=len(file_data),
        content_type=content_type,
    )
    return f"http://{MINIO_ENDPOINT}/{MINIO_BUCKET}/{filename}"
```

- [ ] **Step 2: Create `backend/app/routers/upload.py`**

```python
import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.storage import upload_file

router = APIRouter(prefix="/api/upload", tags=["upload"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_AUDIO_TYPES = {"audio/mpeg", "audio/wav", "audio/ogg", "audio/mp4"}


@router.post("/image")
async def upload_image(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid image type")
    data = await file.read()
    ext = file.filename.split(".")[-1] if file.filename else "jpg"
    filename = f"images/{uuid.uuid4()}.{ext}"
    url = upload_file(data, filename, file.content_type)
    return {"url": url}


@router.post("/audio")
async def upload_audio(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(status_code=400, detail="Invalid audio type")
    data = await file.read()
    ext = file.filename.split(".")[-1] if file.filename else "mp3"
    filename = f"audio/{uuid.uuid4()}.{ext}"
    url = upload_file(data, filename, file.content_type)
    return {"url": url}
```

- [ ] **Step 3: Register upload router in `backend/app/main.py`**

```python
from app.routers import decks, cards, upload

# add after existing include_router calls:
app.include_router(upload.router)
```

- [ ] **Step 4: Start full stack and test upload manually**

```bash
docker compose up -d
curl -F "file=@/path/to/test.jpg" http://localhost:8000/api/upload/image
```

Expected: `{"url": "http://minio:9000/flashcards/images/uuid.jpg"}`

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/storage.py backend/app/routers/upload.py backend/app/main.py
git commit -m "feat: MinIO file upload for images and audio"
```

---

## Task 8: Backend — Review Router (SM-2)

**Files:**
- Create: `backend/app/routers/review.py`
- Create: `backend/app/routers/ai.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_review.py`

- [ ] **Step 1: Write failing tests in `backend/tests/test_review.py`**

```python
from datetime import date


def test_due_cards_includes_new_cards(client):
    deck = client.post("/api/decks", json={"name": "D"}).json()
    client.post(f"/api/decks/{deck['id']}/cards", json={"front_text": "a", "back_text": "b"})
    response = client.get("/api/review/due")
    assert response.status_code == 200
    assert len(response.json()) == 1


def test_submit_review_updates_sm2(client):
    deck = client.post("/api/decks", json={"name": "D"}).json()
    card = client.post(f"/api/decks/{deck['id']}/cards", json={"front_text": "a", "back_text": "b"}).json()
    response = client.post(f"/api/review/{card['id']}", json={"quality": 5})
    assert response.status_code == 200
    data = response.json()
    assert data["repetitions"] == 1
    assert data["last_quality"] == 5


def test_submit_review_quality_below_3_resets(client):
    deck = client.post("/api/decks", json={"name": "D"}).json()
    card = client.post(f"/api/decks/{deck['id']}/cards", json={"front_text": "a", "back_text": "b"}).json()
    response = client.post(f"/api/review/{card['id']}", json={"quality": 1})
    assert response.status_code == 200
    data = response.json()
    assert data["repetitions"] == 0
    assert data["interval"] == 1


def test_stats_returns_expected_shape(client):
    response = client.get("/api/review/stats")
    assert response.status_code == 200
    data = response.json()
    assert "streak" in data
    assert "total_cards" in data
    assert "due_today" in data
    assert "due_upcoming" in data
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
docker compose run --rm backend pytest tests/test_review.py -v
```

Expected: FAIL (routes not registered)

- [ ] **Step 3: Create `backend/app/routers/review.py`**

```python
from datetime import date, timedelta, datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.card import Card
from app.models.review import Review
from app.schemas.review import ReviewSubmit, ReviewOut, StatsOut
from app.services.sm2 import compute_sm2

router = APIRouter(prefix="/api/review", tags=["review"])


@router.get("/due", response_model=list[dict])
def get_due_cards(db: Session = Depends(get_db)):
    today = date.today()
    due_reviews = (
        db.query(Review)
        .filter(Review.due_date <= today)
        .all()
    )
    result = []
    for r in due_reviews:
        card = r.card
        result.append({
            "id": card.id,
            "deck_id": card.deck_id,
            "front_text": card.front_text,
            "back_text": card.back_text,
            "example_sentence": card.example_sentence,
            "image_url": card.image_url,
            "audio_url": card.audio_url,
            "review": {
                "ease_factor": r.ease_factor,
                "interval": r.interval,
                "repetitions": r.repetitions,
                "due_date": r.due_date.isoformat(),
            }
        })
    return result


@router.post("/{card_id}", response_model=ReviewOut)
def submit_review(card_id: str, body: ReviewSubmit, db: Session = Depends(get_db)):
    if body.quality < 0 or body.quality > 5:
        raise HTTPException(status_code=400, detail="quality must be 0-5")

    review = db.query(Review).filter(Review.card_id == card_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review state not found for card")

    result = compute_sm2(
        ease_factor=review.ease_factor,
        interval=review.interval,
        repetitions=review.repetitions,
        quality=body.quality,
    )

    review.ease_factor = result["ease_factor"]
    review.interval = result["interval"]
    review.repetitions = result["repetitions"]
    review.due_date = date.today() + timedelta(days=result["interval"])
    review.last_quality = body.quality
    review.reviewed_at = datetime.utcnow()

    db.commit()
    db.refresh(review)
    return review


@router.get("/stats", response_model=StatsOut)
def get_stats(db: Session = Depends(get_db)):
    today = date.today()
    total_cards = db.query(Card).count()
    due_today = db.query(Review).filter(Review.due_date <= today).count()
    total_reviewed_today = (
        db.query(Review)
        .filter(Review.reviewed_at >= datetime.combine(today, datetime.min.time()))
        .count()
    )

    due_upcoming = {}
    for i in range(1, 8):
        day = today + timedelta(days=i)
        count = db.query(Review).filter(Review.due_date == day).count()
        due_upcoming[day.isoformat()] = count

    return StatsOut(
        streak=0,  # simplified: streak tracking not in v1 scope
        total_cards=total_cards,
        total_reviewed_today=total_reviewed_today,
        due_today=due_today,
        due_upcoming=due_upcoming,
    )
```

- [ ] **Step 4: Create `backend/app/routers/ai.py`**

```python
from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/generate-card")
def generate_card():
    return JSONResponse(status_code=501, content={"detail": "Not implemented"})


@router.post("/suggest")
def suggest():
    return JSONResponse(status_code=501, content={"detail": "Not implemented"})


@router.post("/chat")
def chat():
    return JSONResponse(status_code=501, content={"detail": "Not implemented"})
```

- [ ] **Step 5: Register routers in `backend/app/main.py`**

```python
from app.routers import decks, cards, upload, review, ai

app.include_router(review.router)
app.include_router(ai.router)
```

- [ ] **Step 6: Run all backend tests**

```bash
docker compose run --rm backend pytest tests/ -v
```

Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/routers/review.py backend/app/routers/ai.py backend/app/main.py backend/tests/test_review.py
git commit -m "feat: review endpoints with SM-2 integration and AI stubs"
```

---

## Task 9: Frontend — Scaffold & API Client

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/types/index.ts`
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/api/decks.ts`
- Create: `frontend/src/api/cards.ts`
- Create: `frontend/src/api/review.ts`

- [ ] **Step 1: Initialize frontend with Vite**

```bash
cd frontend
npm create vite@latest . -- --template react-ts
npm install
npm install axios react-router-dom
npm install -D tailwindcss postcss autoprefixer @types/node
npx tailwindcss init -p
```

- [ ] **Step 2: Install shadcn/ui**

```bash
npx shadcn@latest init
# When prompted:
# - Style: Default
# - Base color: Slate
# - CSS variables: Yes
```

- [ ] **Step 3: Update `frontend/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://backend:8000',
        changeOrigin: true,
      },
    },
  },
})
```

- [ ] **Step 4: Update `frontend/tailwind.config.ts`**

```typescript
import type { Config } from 'tailwindcss'

export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0f0f0f',
        surface: '#1a1a1a',
        primary: '#7c3aed',
        accent: '#06b6d4',
      },
    },
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 5: Create `frontend/src/types/index.ts`**

```typescript
export interface Deck {
  id: string
  name: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface Card {
  id: string
  deck_id: string
  front_text: string
  back_text: string
  example_sentence: string | null
  image_url: string | null
  audio_url: string | null
  created_at: string
  updated_at: string
}

export interface ReviewState {
  ease_factor: number
  interval: number
  repetitions: number
  due_date: string
}

export interface DueCard extends Card {
  review: ReviewState
}

export interface Stats {
  streak: number
  total_cards: number
  total_reviewed_today: number
  due_today: number
  due_upcoming: Record<string, number>
}
```

- [ ] **Step 6: Create `frontend/src/api/client.ts`**

```typescript
import axios from 'axios'

const client = axios.create({
  baseURL: '/api',
})

export default client
```

- [ ] **Step 7: Create `frontend/src/api/decks.ts`**

```typescript
import client from './client'
import type { Deck } from '../types'

export const getDecks = () => client.get<Deck[]>('/decks').then(r => r.data)

export const getDeck = (id: string) => client.get<Deck>(`/decks/${id}`).then(r => r.data)

export const createDeck = (name: string, description?: string) =>
  client.post<Deck>('/decks', { name, description }).then(r => r.data)

export const updateDeck = (id: string, data: Partial<Pick<Deck, 'name' | 'description'>>) =>
  client.put<Deck>(`/decks/${id}`, data).then(r => r.data)

export const deleteDeck = (id: string) =>
  client.delete<Deck>(`/decks/${id}`).then(r => r.data)
```

- [ ] **Step 8: Create `frontend/src/api/cards.ts`**

```typescript
import client from './client'
import type { Card } from '../types'

export const getCards = (deckId: string) =>
  client.get<Card[]>(`/decks/${deckId}/cards`).then(r => r.data)

export const createCard = (deckId: string, data: {
  front_text: string
  back_text: string
  example_sentence?: string
  image_url?: string
  audio_url?: string
}) => client.post<Card>(`/decks/${deckId}/cards`, data).then(r => r.data)

export const updateCard = (id: string, data: Partial<Omit<Card, 'id' | 'deck_id' | 'created_at' | 'updated_at'>>) =>
  client.put<Card>(`/cards/${id}`, data).then(r => r.data)

export const deleteCard = (id: string) =>
  client.delete<Card>(`/cards/${id}`).then(r => r.data)

export const uploadImage = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return client.post<{ url: string }>('/upload/image', form).then(r => r.data)
}

export const uploadAudio = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return client.post<{ url: string }>('/upload/audio', form).then(r => r.data)
}
```

- [ ] **Step 9: Create `frontend/src/api/review.ts`**

```typescript
import client from './client'
import type { DueCard, Stats } from '../types'

export const getDueCards = () =>
  client.get<DueCard[]>('/review/due').then(r => r.data)

export const submitReview = (cardId: string, quality: number) =>
  client.post(`/review/${cardId}`, { quality }).then(r => r.data)

export const getStats = () =>
  client.get<Stats>('/review/stats').then(r => r.data)
```

- [ ] **Step 10: Create `frontend/src/App.tsx`**

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import DeckDetailPage from './pages/DeckDetailPage'
import ReviewPage from './pages/ReviewPage'
import StatsPage from './pages/StatsPage'
import Navbar from './components/Navbar'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-white font-sans">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/decks/:id" element={<DeckDetailPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/stats" element={<StatsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
```

- [ ] **Step 11: Update `frontend/src/main.tsx`**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 12: Update `frontend/src/index.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-white;
    font-family: 'Inter', sans-serif;
  }
}
```

- [ ] **Step 13: Commit**

```bash
cd ..
git add frontend/
git commit -m "feat: React frontend scaffold with Vite, Tailwind, shadcn/ui, API client"
```

---

## Task 10: Frontend — Navbar & HomePage

**Files:**
- Create: `frontend/src/components/Navbar.tsx`
- Create: `frontend/src/components/DeckCard.tsx`
- Create: `frontend/src/pages/HomePage.tsx`

- [ ] **Step 1: Create `frontend/src/components/Navbar.tsx`**

```typescript
import { Link, useLocation } from 'react-router-dom'

export default function Navbar() {
  const { pathname } = useLocation()

  const links = [
    { to: '/', label: 'Decks' },
    { to: '/review', label: 'Review' },
    { to: '/stats', label: 'Stats' },
  ]

  return (
    <nav className="border-b border-white/10 bg-surface px-6 py-4 flex items-center gap-8">
      <span className="text-primary font-bold text-lg">FlashCards</span>
      <div className="flex gap-6">
        {links.map(l => (
          <Link
            key={l.to}
            to={l.to}
            className={`text-sm transition-colors ${
              pathname === l.to ? 'text-white font-medium' : 'text-white/50 hover:text-white'
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
```

- [ ] **Step 2: Create `frontend/src/components/DeckCard.tsx`**

```typescript
import { Link } from 'react-router-dom'
import type { Deck } from '../types'

interface Props {
  deck: Deck
  dueCount?: number
  cardCount?: number
}

export default function DeckCard({ deck, dueCount = 0, cardCount = 0 }: Props) {
  return (
    <Link to={`/decks/${deck.id}`}>
      <div className="bg-surface border border-white/10 rounded-xl p-5 hover:border-primary/50 transition-all cursor-pointer">
        <h3 className="font-semibold text-white text-lg mb-1">{deck.name}</h3>
        {deck.description && (
          <p className="text-white/50 text-sm mb-4 line-clamp-2">{deck.description}</p>
        )}
        <div className="flex gap-4 text-sm">
          <span className="text-white/40">{cardCount} cards</span>
          {dueCount > 0 && (
            <span className="text-accent font-medium">{dueCount} due</span>
          )}
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 3: Create `frontend/src/pages/HomePage.tsx`**

```typescript
import { useEffect, useState } from 'react'
import { getDecks, createDeck } from '../api/decks'
import { getStats } from '../api/review'
import DeckCard from '../components/DeckCard'
import type { Deck, Stats } from '../types'

export default function HomePage() {
  const [decks, setDecks] = useState<Deck[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    getDecks().then(setDecks)
    getStats().then(setStats)
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const deck = await createDeck(name.trim(), description.trim() || undefined)
    setDecks(prev => [deck, ...prev])
    setName('')
    setDescription('')
    setShowForm(false)
  }

  return (
    <div>
      {stats && stats.due_today > 0 && (
        <div className="mb-6 p-4 bg-primary/20 border border-primary/30 rounded-xl text-center">
          <span className="text-primary font-medium">{stats.due_today} cards due today</span>
          <a href="/review" className="ml-4 text-white underline text-sm">Start review →</a>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Decks</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + New Deck
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 bg-surface border border-white/10 rounded-xl p-5 flex flex-col gap-3">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Deck name"
            className="bg-background border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/30 focus:outline-none focus:border-primary"
          />
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="bg-background border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/30 focus:outline-none focus:border-primary"
          />
          <div className="flex gap-3">
            <button type="submit" className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium">Create</button>
            <button type="button" onClick={() => setShowForm(false)} className="text-white/50 px-4 py-2 text-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {decks.map(deck => (
          <DeckCard key={deck.id} deck={deck} />
        ))}
      </div>

      {decks.length === 0 && (
        <div className="text-center text-white/30 py-20">
          No decks yet. Create your first deck above.
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify in browser**

```bash
docker compose up -d
```

Open `http://localhost:5173` — should show empty decks page with "New Deck" button.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: Navbar and HomePage with deck grid and create form"
```

---

## Task 11: Frontend — DeckDetailPage & AddCardForm

**Files:**
- Create: `frontend/src/components/AddCardForm.tsx`
- Create: `frontend/src/pages/DeckDetailPage.tsx`

- [ ] **Step 1: Create `frontend/src/components/AddCardForm.tsx`**

```typescript
import { useState } from 'react'
import { createCard, uploadImage, uploadAudio } from '../api/cards'
import type { Card } from '../types'

interface Props {
  deckId: string
  onCreated: (card: Card) => void
  onCancel: () => void
}

export default function AddCardForm({ deckId, onCreated, onCancel }: Props) {
  const [frontText, setFrontText] = useState('')
  const [backText, setBackText] = useState('')
  const [example, setExample] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [uploading, setUploading] = useState(false)

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { url } = await uploadImage(file)
      setImageUrl(url)
    } finally {
      setUploading(false)
    }
  }

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const { url } = await uploadAudio(file)
      setAudioUrl(url)
    } finally {
      setUploading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!frontText.trim() || !backText.trim()) return
    const card = await createCard(deckId, {
      front_text: frontText.trim(),
      back_text: backText.trim(),
      example_sentence: example.trim() || undefined,
      image_url: imageUrl || undefined,
      audio_url: audioUrl || undefined,
    })
    onCreated(card)
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-white/10 rounded-xl p-5 flex flex-col gap-3">
      <input
        value={frontText}
        onChange={e => setFrontText(e.target.value)}
        placeholder="English word or phrase"
        className="bg-background border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/30 focus:outline-none focus:border-primary"
      />
      <textarea
        value={backText}
        onChange={e => setBackText(e.target.value)}
        placeholder="Vietnamese meaning + explanation"
        rows={3}
        className="bg-background border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/30 focus:outline-none focus:border-primary resize-none"
      />
      <input
        value={example}
        onChange={e => setExample(e.target.value)}
        placeholder="Example sentence (optional)"
        className="bg-background border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/30 focus:outline-none focus:border-primary"
      />
      <div className="flex gap-4 text-sm text-white/50">
        <label className="cursor-pointer hover:text-white transition-colors">
          📷 Image
          <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
        </label>
        <label className="cursor-pointer hover:text-white transition-colors">
          🔊 Audio
          <input type="file" accept="audio/*" onChange={handleAudioUpload} className="hidden" />
        </label>
        {imageUrl && <span className="text-accent">✓ Image uploaded</span>}
        {audioUrl && <span className="text-accent">✓ Audio uploaded</span>}
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={uploading || !frontText.trim() || !backText.trim()}
          className="bg-primary disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium"
        >
          Add Card
        </button>
        <button type="button" onClick={onCancel} className="text-white/50 px-4 py-2 text-sm">
          Cancel
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Create `frontend/src/pages/DeckDetailPage.tsx`**

```typescript
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getDeck } from '../api/decks'
import { getCards, deleteCard } from '../api/cards'
import AddCardForm from '../components/AddCardForm'
import type { Deck, Card } from '../types'

export default function DeckDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [deck, setDeck] = useState<Deck | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    if (!id) return
    getDeck(id).then(setDeck)
    getCards(id).then(setCards)
  }, [id])

  const handleCardCreated = (card: Card) => {
    setCards(prev => [...prev, card])
    setShowForm(false)
  }

  const handleDeleteCard = async (cardId: string) => {
    await deleteCard(cardId)
    setCards(prev => prev.filter(c => c.id !== cardId))
  }

  if (!deck) return <div className="text-white/30">Loading...</div>

  return (
    <div>
      <div className="flex items-center gap-4 mb-2">
        <Link to="/" className="text-white/40 hover:text-white text-sm">← Decks</Link>
      </div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{deck.name}</h1>
          {deck.description && <p className="text-white/50 text-sm mt-1">{deck.description}</p>}
        </div>
        <div className="flex gap-3">
          <Link
            to="/review"
            className="bg-accent/20 border border-accent/30 text-accent px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent/30 transition-colors"
          >
            Start Review
          </Link>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-primary hover:bg-primary/80 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            + Add Card
          </button>
        </div>
      </div>

      {showForm && id && (
        <div className="mb-6">
          <AddCardForm deckId={id} onCreated={handleCardCreated} onCancel={() => setShowForm(false)} />
        </div>
      )}

      <div className="flex flex-col gap-3">
        {cards.map(card => (
          <div key={card.id} className="bg-surface border border-white/10 rounded-xl p-4 flex items-start justify-between">
            <div>
              <p className="font-medium text-white">{card.front_text}</p>
              <p className="text-white/50 text-sm mt-1">{card.back_text}</p>
              {card.example_sentence && (
                <p className="text-white/30 text-xs mt-1 italic">{card.example_sentence}</p>
              )}
              <div className="flex gap-3 mt-2">
                {card.image_url && <span className="text-xs text-accent">📷 Image</span>}
                {card.audio_url && <span className="text-xs text-accent">🔊 Audio</span>}
              </div>
            </div>
            <button
              onClick={() => handleDeleteCard(card.id)}
              className="text-white/20 hover:text-red-400 transition-colors text-sm ml-4"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {cards.length === 0 && !showForm && (
        <div className="text-center text-white/30 py-20">No cards yet. Add your first card above.</div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

Navigate to a deck — should show card list and add form with image/audio upload.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/
git commit -m "feat: DeckDetailPage with card list and AddCardForm with media upload"
```

---

## Task 12: Frontend — FlipCard & ReviewPage

**Files:**
- Create: `frontend/src/components/FlipCard.tsx`
- Create: `frontend/src/components/RatingButtons.tsx`
- Create: `frontend/src/pages/ReviewPage.tsx`

- [ ] **Step 1: Create `frontend/src/components/FlipCard.tsx`**

```typescript
import { useState } from 'react'
import type { DueCard } from '../types'

interface Props {
  card: DueCard
  onFlip?: () => void
}

export default function FlipCard({ card, onFlip }: Props) {
  const [flipped, setFlipped] = useState(false)

  const handleFlip = () => {
    setFlipped(true)
    onFlip?.()
  }

  return (
    <div
      className="relative w-full max-w-xl mx-auto cursor-pointer"
      style={{ perspective: '1000px', minHeight: '280px' }}
      onClick={!flipped ? handleFlip : undefined}
    >
      <div
        style={{
          transformStyle: 'preserve-3d',
          transition: 'transform 0.5s',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          position: 'relative',
          width: '100%',
          minHeight: '280px',
        }}
      >
        {/* Front */}
        <div
          style={{ backfaceVisibility: 'hidden' }}
          className="absolute inset-0 bg-surface border border-white/10 rounded-2xl flex flex-col items-center justify-center p-8"
        >
          <p className="text-3xl font-bold text-white text-center">{card.front_text}</p>
          <p className="text-white/30 text-sm mt-6">Click to reveal</p>
        </div>

        {/* Back */}
        <div
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
          className="absolute inset-0 bg-surface border border-primary/30 rounded-2xl flex flex-col p-8 gap-4 overflow-y-auto"
        >
          <p className="text-xl font-semibold text-white">{card.front_text}</p>
          <p className="text-white/80 text-base">{card.back_text}</p>
          {card.example_sentence && (
            <p className="text-white/50 text-sm italic border-l-2 border-primary/50 pl-3">
              {card.example_sentence}
            </p>
          )}
          {card.image_url && (
            <img src={card.image_url} alt="" className="rounded-lg max-h-40 object-contain" />
          )}
          {card.audio_url && (
            <audio controls src={card.audio_url} className="w-full mt-2" />
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `frontend/src/components/RatingButtons.tsx`**

```typescript
interface Props {
  onRate: (quality: number) => void
}

const RATINGS = [
  { label: 'Không nhớ', quality: 0, color: 'border-red-500/50 text-red-400 hover:bg-red-500/10' },
  { label: 'Khó', quality: 1, color: 'border-orange-500/50 text-orange-400 hover:bg-orange-500/10' },
  { label: 'Ổn', quality: 3, color: 'border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10' },
  { label: 'Dễ', quality: 5, color: 'border-green-500/50 text-green-400 hover:bg-green-500/10' },
]

export default function RatingButtons({ onRate }: Props) {
  return (
    <div className="flex gap-3 justify-center mt-8">
      {RATINGS.map(r => (
        <button
          key={r.quality}
          onClick={() => onRate(r.quality)}
          className={`border ${r.color} rounded-xl px-6 py-3 text-sm font-medium transition-all`}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create `frontend/src/pages/ReviewPage.tsx`**

```typescript
import { useEffect, useState } from 'react'
import { getDueCards, submitReview } from '../api/review'
import FlipCard from '../components/FlipCard'
import RatingButtons from '../components/RatingButtons'
import type { DueCard } from '../types'

export default function ReviewPage() {
  const [cards, setCards] = useState<DueCard[]>([])
  const [index, setIndex] = useState(0)
  const [showRating, setShowRating] = useState(false)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getDueCards().then(data => {
      setCards(data)
      setLoading(false)
    })
  }, [])

  const handleFlip = () => setShowRating(true)

  const handleRate = async (quality: number) => {
    const card = cards[index]
    await submitReview(card.id, quality)
    setShowRating(false)
    if (index + 1 >= cards.length) {
      setDone(true)
    } else {
      setIndex(prev => prev + 1)
    }
  }

  if (loading) return <div className="text-white/30 text-center py-20">Loading...</div>

  if (cards.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-2xl font-bold text-white mb-2">All caught up!</p>
        <p className="text-white/40">No cards due today.</p>
      </div>
    )
  }

  if (done) {
    return (
      <div className="text-center py-20">
        <p className="text-2xl font-bold text-white mb-2">Session complete!</p>
        <p className="text-white/40">You reviewed {cards.length} cards.</p>
        <a href="/" className="mt-6 inline-block text-primary underline">Back to decks</a>
      </div>
    )
  }

  const card = cards[index]

  return (
    <div className="max-w-xl mx-auto">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between text-sm text-white/40 mb-2">
          <span>{index + 1} / {cards.length}</span>
          <span>{Math.round(((index) / cards.length) * 100)}%</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${(index / cards.length) * 100}%` }}
          />
        </div>
      </div>

      <FlipCard key={card.id} card={card} onFlip={handleFlip} />

      {showRating && <RatingButtons onRate={handleRate} />}

      {!showRating && (
        <p className="text-center text-white/30 text-sm mt-6">Click the card to reveal the answer</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify in browser**

Navigate to `/review` — flip card should animate, rating buttons appear after flip.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: FlipCard animation and ReviewPage with SM-2 rating"
```

---

## Task 13: Frontend — StatsPage

**Files:**
- Create: `frontend/src/pages/StatsPage.tsx`

- [ ] **Step 1: Create `frontend/src/pages/StatsPage.tsx`**

```typescript
import { useEffect, useState } from 'react'
import { getStats } from '../api/review'
import type { Stats } from '../types'

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    getStats().then(setStats)
  }, [])

  if (!stats) return <div className="text-white/30 text-center py-20">Loading...</div>

  const upcomingEntries = Object.entries(stats.due_upcoming).sort()
  const maxUpcoming = Math.max(...upcomingEntries.map(([, v]) => v), 1)

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-8">Statistics</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        {[
          { label: 'Streak', value: `${stats.streak}d` },
          { label: 'Total Cards', value: stats.total_cards },
          { label: 'Reviewed Today', value: stats.total_reviewed_today },
          { label: 'Due Today', value: stats.due_today },
        ].map(s => (
          <div key={s.label} className="bg-surface border border-white/10 rounded-xl p-5 text-center">
            <p className="text-3xl font-bold text-white">{s.value}</p>
            <p className="text-white/40 text-sm mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-surface border border-white/10 rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Due — Next 7 Days</h2>
        <div className="flex items-end gap-2 h-32">
          {upcomingEntries.map(([dateStr, count]) => {
            const label = new Date(dateStr).toLocaleDateString('vi-VN', { weekday: 'short', day: 'numeric' })
            const height = maxUpcoming > 0 ? (count / maxUpcoming) * 100 : 0
            return (
              <div key={dateStr} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-white/40">{count}</span>
                <div
                  className="w-full bg-primary/60 rounded-t"
                  style={{ height: `${Math.max(height, count > 0 ? 4 : 0)}%` }}
                />
                <span className="text-xs text-white/30 text-center leading-tight">{label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Navigate to `/stats` — should show 4 stat cards and bar chart for upcoming 7 days.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/StatsPage.tsx
git commit -m "feat: StatsPage with summary cards and upcoming review bar chart"
```

---

## Task 14: Final Integration & Smoke Test

- [ ] **Step 1: Start full stack**

```bash
docker compose up -d
```

Wait for all services to be healthy.

- [ ] **Step 2: Run backend migrations**

```bash
docker compose exec backend alembic upgrade head
```

- [ ] **Step 3: Run all backend tests**

```bash
docker compose run --rm backend pytest tests/ -v
```

Expected: all tests PASS

- [ ] **Step 4: Manual smoke test checklist**

- [ ] Open `http://localhost:5173` → decks page loads
- [ ] Create a deck → appears in grid
- [ ] Click deck → detail page loads
- [ ] Add a card with front/back text → card appears in list
- [ ] Upload an image for a card → "✓ Image uploaded" appears
- [ ] Go to `/review` → card appears, click to flip
- [ ] Rate card → progresses to next card
- [ ] Go to `/stats` → numbers update after review
- [ ] AI endpoints return 501: `curl -X POST http://localhost:8000/api/ai/generate-card`

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat: full flashcard app v1 — deck/card CRUD, SM-2 review, media upload, stats"
```
