# Flashcard App — Design Spec
**Date:** 2026-04-07

## Overview

A web-based English vocabulary flashcard application with spaced repetition, media support (image + audio), and a backend designed for future AI agent integration.

**Stack:**
- Frontend: React 18 + Vite + TypeScript + TailwindCSS + shadcn/ui
- Backend: FastAPI + SQLAlchemy + Alembic + Python
- Database: PostgreSQL
- Media storage: MinIO (self-hosted S3-compatible)
- AI (future): OpenAI API / LangChain

---

## Architecture

Monorepo with Docker Compose orchestrating all services:

```
flashcards/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── api/           # axios client
│   ├── index.html
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── routers/       # cards, decks, review, ai
│   │   ├── models/        # SQLAlchemy ORM models
│   │   ├── schemas/       # Pydantic request/response schemas
│   │   └── services/      # business logic (sm2, storage, ai/)
│   ├── alembic/           # DB migrations
│   └── requirements.txt
├── docker-compose.yml
└── .env
```

Services in docker-compose:
- `frontend` — Vite dev server (port 5173)
- `backend` — FastAPI with uvicorn (port 8000)
- `db` — PostgreSQL 16
- `minio` — MinIO object storage (port 9000, console 9001)

---

## Database Schema

### `decks`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| name | VARCHAR | required |
| description | TEXT | optional |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### `cards`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| deck_id | UUID | FK → decks |
| front_text | VARCHAR | English word/phrase |
| back_text | TEXT | Vietnamese meaning + explanation |
| example_sentence | TEXT | optional |
| image_url | VARCHAR | MinIO URL, optional |
| audio_url | VARCHAR | MinIO URL, optional |
| created_at | TIMESTAMP | |
| updated_at | TIMESTAMP | |

### `reviews`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| card_id | UUID | FK → cards |
| ease_factor | FLOAT | SM-2, default 2.5 |
| interval | INT | days until next review |
| repetitions | INT | successful review count |
| due_date | DATE | next scheduled review |
| last_quality | INT (0-5) | quality of last review |
| reviewed_at | TIMESTAMP | |

New cards default to `due_date = today` and `interval = 1`.

Note: The `reviews` table stores the **current SM-2 state** per card (one row per card, upserted after each review), not a history log. Review history is not needed for v1.

---

## API Endpoints

### Decks
```
GET    /api/decks              # list all decks
POST   /api/decks              # create deck
GET    /api/decks/{id}         # get deck detail
PUT    /api/decks/{id}         # update deck
DELETE /api/decks/{id}         # delete deck (cascade cards)
```

### Cards
```
GET    /api/decks/{id}/cards   # list cards in deck
POST   /api/decks/{id}/cards   # create card
PUT    /api/cards/{id}         # update card
DELETE /api/cards/{id}         # delete card
```

### Media Upload
```
POST   /api/upload/image       # upload image → MinIO, returns url
POST   /api/upload/audio       # upload audio → MinIO, returns url
```

### Review (Spaced Repetition)
```
GET    /api/review/due         # get cards due today (across all decks)
POST   /api/review/{card_id}   # submit review result { quality: 0-5 }
GET    /api/review/stats       # progress stats (streak, total, upcoming)
```

### AI (placeholder)
```
POST   /api/ai/generate-card   # word → full card data (501 until implemented)
POST   /api/ai/suggest         # suggest next words to learn (501)
POST   /api/ai/chat            # chat about a card/word (501)
```

All `/api/ai/*` routes return HTTP 501 Not Implemented initially, preserving the interface contract.

---

## Spaced Repetition (SM-2 Algorithm)

After each review, user rates quality 0–5:
- **0** — Complete blackout
- **1** — Wrong but familiar
- **3** — Correct with difficulty (mapped from "Khó" button)
- **5** — Perfect recall (mapped from "Dễ" button)

UI shows 4 buttons: **Không nhớ (0) / Khó (1) / Ổn (3) / Dễ (5)**

SM-2 update rules:
- If quality < 3: reset repetitions to 0, interval to 1
- If quality ≥ 3: increment repetitions, recalculate interval and ease_factor
- `ease_factor` minimum clamped at 1.3

---

## Frontend Pages

### `/` — Home
- Grid of deck cards showing name, card count, due count
- "Create deck" button
- Banner: total cards due today

### `/decks/:id` — Deck Detail
- List of cards with front text preview
- Add card button (opens form with manual entry + AI generate toggle)
- "Start review" button (only shows due cards)

### `/review` — Review Session
- 3D flip card animation (CSS perspective transform)
- Front: English word
- Back: meaning, example sentence, image (if any), audio play button
- 4 rating buttons below after flip
- Progress bar: X / Y cards completed today

### `/stats` — Statistics
- Study streak counter
- Cards learned over time (chart)
- Upcoming due cards by day (next 7 days)

---

## UI Design System

- **Theme:** Dark mode only
- **Background:** `#0f0f0f` (page), `#1a1a1a` (cards/panels)
- **Accent:** `#7c3aed` (purple) primary, `#06b6d4` (cyan) secondary
- **Font:** Inter (Google Fonts)
- **Component library:** shadcn/ui (dark theme configured)
- **Animations:** flip card with `transform-style: preserve-3d`, smooth transitions

---

## AI Integration Architecture (Future)

```
backend/app/services/
├── sm2.py           # SM-2 algorithm (implement in v1)
├── storage.py       # MinIO upload/download (implement in v1)
└── ai/
    ├── __init__.py
    ├── generator.py # word → card data via OpenAI
    ├── suggester.py # recommend next words based on history
    └── chat.py      # conversational context about vocabulary
```

**AI generate-card flow:**
1. User types a word (e.g. "ephemeral")
2. POST `/api/ai/generate-card` → OpenAI returns structured JSON
3. Response auto-fills the card creation form
4. User reviews and confirms before saving

---

## Out of Scope (v1)

- User authentication / multi-user
- Mobile app
- Offline support / PWA
- AI features (stubs only)
- Social/sharing features
