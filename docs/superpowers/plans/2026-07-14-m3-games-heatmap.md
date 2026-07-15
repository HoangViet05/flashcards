# M3 Mini-games + Heatmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 3 mini-game (Sentence Builder, Dictation Cloze, Concept Match) lấy thẻ từ deck/thẻ đến hạn và tính kết quả vào lịch SM-2, cùng heatmap học tập kiểu GitHub trên trang Stats.

**Architecture:** Backend thêm 2 endpoint đọc (`/api/games/cards` lọc thẻ đủ điều kiện theo mode, `/api/review/heatmap` aggregate từ `review_logs`) và mở rộng `/api/review/stats`; **không có bảng mới** — kết quả game submit qua `POST /api/review/{card_id}` có sẵn với `rating_source=game_*` (M1 đã ghi `review_logs`). FE thêm trang `/games` điều phối 3 component game + component `StudyHeatmap` SVG tự vẽ.

**Tech Stack:** Không dependency mới (cả backend lẫn frontend). Web Speech API cho fallback audio của Dictation.

**Spec:** `docs/superpowers/specs/2026-07-14-english-learning-completion-design.md` (mục 6)

## Global Constraints

- Python: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe`; pytest cwd = `backend/`: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests -v`
- KHÔNG thêm dependency mới (backend + frontend).
- Tài nguyên không thuộc user → **404**; mọi endpoint mới yêu cầu auth.
- SQL chạy được trên cả SQLite và Postgres (`func.random()`, `func.date()` đều OK hai bên).
- **Mapping quality thống nhất:** đúng ngay lần đầu = **5**, đúng sau ≥1 lần sai = **3**, bỏ qua / xem đáp án = **1**.
- `rating_source` cho game: `game_sentence` | `game_cloze` | `game_match` (cột String(20) — vừa).
- Mỗi phiên game tối đa 10 thẻ.
- Text UI tiếng Việt, style dark glassmorphism hiện có.
- FE API path KHÔNG prefix `/api` (baseURL đã có).
- Interfaces M1 tái dùng: `get_owned_deck(deck_id, db, user)` (`app.routers.decks`), `ReviewLog` (`app.models.review_log`), FE `submitReview(cardId, submission)` (`api/review.ts`), `getDecks()`, `resolveAssetUrl(url)` (`api/config.ts`), `useCachedQuery`, `useNotification`.

---

### Task 1: Backend — `GET /api/games/cards`

**Files:**
- Create: `backend/app/routers/games.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_games.py` (mới)

**Interfaces:**
- Produces: `GET /api/games/cards?mode=sentence|cloze|match&deck_id=&limit=10` → `list[CardOut]` đã lọc đủ điều kiện chơi; hàm `is_eligible(card, mode) -> bool`, `_english_part(example) -> str`, `_clean_front(front) -> str` (FE có bản mirror ở Task 4).

- [ ] **Step 1: Viết failing test — `backend/tests/test_games.py`**

```python
from app.routers.games import is_eligible
from app.models.card import Card


def _card(**kw) -> Card:
    return Card(deck_id="x", front_text=kw.pop("front", "docker"), back_text="nghĩa", **kw)


def test_eligibility_sentence():
    assert is_eligible(_card(example_sentence="Docker ships containers everywhere. (Docker đóng gói...)"), "sentence")
    assert not is_eligible(_card(example_sentence=None), "sentence")
    assert not is_eligible(_card(example_sentence="Too short."), "sentence")  # < 3 từ


def test_eligibility_cloze():
    assert is_eligible(_card(front="docker", example_sentence="I use Docker every day."), "cloze")
    # front không xuất hiện trong câu → loại
    assert not is_eligible(_card(front="kubernetes", example_sentence="I use Docker every day."), "cloze")


def test_eligibility_match():
    assert is_eligible(_card(definition="A platform for containers"), "match")
    assert not is_eligible(_card(definition=None), "match")
    assert not is_eligible(_card(definition="   "), "match")


def _make_deck_with_cards(client):
    deck = client.post("/api/decks", json={"name": "Game Deck"}).json()
    payloads = [
        {"front_text": "docker", "back_text": "n1",
         "example_sentence": "I use docker every single day at work.",
         "definition": "A container platform"},
        {"front_text": "queue", "back_text": "n2",
         "example_sentence": "Messages wait in the queue until processed.",
         "definition": "A FIFO data structure"},
        {"front_text": "noexample", "back_text": "n3"},  # thiếu example + definition
    ]
    for p in payloads:
        client.post(f"/api/decks/{deck['id']}/cards", json=p)
    return deck


def test_games_cards_requires_auth(anon_client):
    assert anon_client.get("/api/games/cards", params={"mode": "sentence"}).status_code == 401


def test_games_cards_invalid_mode(client):
    assert client.get("/api/games/cards", params={"mode": "bogus"}).status_code == 400


def test_games_cards_filters_by_mode(client):
    deck = _make_deck_with_cards(client)
    res = client.get("/api/games/cards", params={"mode": "sentence", "deck_id": deck["id"]})
    assert res.status_code == 200
    fronts = {c["front_text"] for c in res.json()}
    assert fronts == {"docker", "queue"}  # "noexample" bị loại

    match = client.get("/api/games/cards", params={"mode": "match", "deck_id": deck["id"]}).json()
    assert {c["front_text"] for c in match} == {"docker", "queue"}


def test_games_cards_due_scope_default(client):
    _make_deck_with_cards(client)  # thẻ mới tạo → due hôm nay
    res = client.get("/api/games/cards", params={"mode": "sentence"})
    assert len(res.json()) == 2


def test_games_cards_foreign_deck_404(client, user_b_client):
    deck = _make_deck_with_cards(client)
    res = user_b_client.get("/api/games/cards", params={"mode": "sentence", "deck_id": deck["id"]})
    assert res.status_code == 404


def test_games_cards_scoped(client, user_b_client):
    _make_deck_with_cards(client)
    assert user_b_client.get("/api/games/cards", params={"mode": "sentence"}).json() == []
```

- [ ] **Step 2: Chạy, xác nhận fail**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_games.py -v`
Expected: FAIL — module chưa tồn tại.

- [ ] **Step 3: Implement `backend/app/routers/games.py`**

```python
import re
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models.card import Card
from app.models.deck import Deck
from app.models.review import Review
from app.models.user import User
from app.routers.decks import get_owned_deck
from app.schemas.card import CardOut
from app.services.security import get_current_user

router = APIRouter(prefix="/api/games", tags=["games"])

GAME_MODES = ("sentence", "cloze", "match")
CANDIDATE_POOL = 60  # lấy dư rồi lọc eligibility trong Python (scale cá nhân — đủ nhanh)


def _clean_front(front: str) -> str:
    """Bỏ phiên âm/ký tự thừa, lấy phần chữ tiếng Anh của mặt trước thẻ."""
    m = re.match(r"[A-Za-z][A-Za-z\s'-]*", front or "")
    return (m.group(0) if m else (front or "")).strip().lower()


def _english_part(example: str) -> str:
    """Cắt phần dịch tiếng Việt trong ngoặc ở cuối câu ví dụ (format dữ liệu 4000 Words)."""
    return re.sub(r"\s*\([^)]*\)\s*$", "", example or "").strip()


def is_eligible(card: Card, mode: str) -> bool:
    if mode == "sentence":
        if not card.example_sentence:
            return False
        return 3 <= len(_english_part(card.example_sentence).split()) <= 30
    if mode == "cloze":
        if not card.example_sentence:
            return False
        front = _clean_front(card.front_text)
        return bool(front) and front in _english_part(card.example_sentence).lower()
    if mode == "match":
        return bool(card.definition and card.definition.strip())
    return False


@router.get("/cards", response_model=list[CardOut])
def get_game_cards(
    mode: str = Query(...),
    deck_id: str | None = Query(default=None),
    limit: int = Query(default=10, ge=1, le=20),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if mode not in GAME_MODES:
        raise HTTPException(status_code=400, detail="mode phải là sentence | cloze | match")

    query = (
        db.query(Card)
        .join(Deck, Card.deck_id == Deck.id)
        .filter(Deck.user_id == user.id)
        .options(joinedload(Card.review))
    )
    if deck_id:
        get_owned_deck(deck_id, db, user)
        query = query.filter(Card.deck_id == deck_id)
    else:
        # Mặc định: thẻ đến hạn hôm nay
        query = query.join(Review, Review.card_id == Card.id).filter(Review.due_date <= date.today())

    candidates = query.order_by(func.random()).limit(CANDIDATE_POOL).all()
    return [c for c in candidates if is_eligible(c, mode)][:limit]
```

`backend/app/main.py` thêm:

```python
from app.routers import games
...
app.include_router(games.router)
```

- [ ] **Step 4: Chạy test pass + commit**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_games.py -v`
Expected: PASS.

```bash
git add backend/app/routers/games.py backend/app/main.py backend/tests/test_games.py
git commit -m "feat: games cards endpoint with per-mode eligibility filtering"
```

---

### Task 2: Backend — heatmap endpoint

**Files:**
- Modify: `backend/app/routers/review.py`, `backend/app/schemas/review.py`
- Test: `backend/tests/test_review.py` (thêm test)

**Interfaces:**
- Produces: `GET /api/review/heatmap?days=365` → `list[{date: "YYYY-MM-DD", count: int}]` (chỉ ngày có review, FE tự fill ngày trống); schema `HeatmapDay(date: str, count: int)`.

- [ ] **Step 1: Viết failing test — thêm vào cuối `backend/tests/test_review.py`**

```python
def test_heatmap_requires_auth(anon_client):
    assert anon_client.get("/api/review/heatmap").status_code == 401


def test_heatmap_counts_by_day(client, db):
    from datetime import datetime, timedelta
    from app.models.review_log import ReviewLog
    from app.models.user import User

    user = db.query(User).filter(User.email == "usera@test.com").one()
    now = datetime.utcnow()
    for days_ago, n in ((0, 3), (1, 1)):
        for _ in range(n):
            db.add(ReviewLog(user_id=user.id, card_id=None, quality=4,
                             reviewed_at=now - timedelta(days=days_ago)))
    db.commit()

    data = client.get("/api/review/heatmap").json()
    counts = {d["date"]: d["count"] for d in data}
    today = now.date().isoformat()
    assert counts[today] == 3
    assert sum(counts.values()) == 4


def test_heatmap_scoped_per_user(client, user_b_client, db):
    from datetime import datetime
    from app.models.review_log import ReviewLog
    from app.models.user import User

    user = db.query(User).filter(User.email == "usera@test.com").one()
    db.add(ReviewLog(user_id=user.id, card_id=None, quality=4, reviewed_at=datetime.utcnow()))
    db.commit()
    assert user_b_client.get("/api/review/heatmap").json() == []
```

- [ ] **Step 2: Chạy, xác nhận fail**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_review.py -k heatmap -v`
Expected: FAIL — 404/405.

- [ ] **Step 3: Implement**

`backend/app/schemas/review.py` thêm:

```python
class HeatmapDay(BaseModel):
    date: str  # YYYY-MM-DD
    count: int
```

`backend/app/routers/review.py` — thêm import `Query` (fastapi), `HeatmapDay`, và endpoint (đặt TRƯỚC `submit_review` để nhóm các GET với nhau; không có xung đột route vì submit là POST `/{card_id}`):

```python
@router.get("/heatmap", response_model=list[HeatmapDay])
def get_heatmap(
    days: int = Query(default=365, ge=7, le=730),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    since = datetime.combine(date.today() - timedelta(days=days - 1), datetime.min.time())
    rows = (
        db.query(func.date(ReviewLog.reviewed_at), func.count(ReviewLog.id))
        .filter(ReviewLog.user_id == user.id, ReviewLog.reviewed_at >= since)
        .group_by(func.date(ReviewLog.reviewed_at))
        .order_by(func.date(ReviewLog.reviewed_at))
        .all()
    )
    # func.date trả str trên SQLite, date object trên Postgres
    return [HeatmapDay(date=str(d), count=c) for d, c in rows]
```

- [ ] **Step 4: Chạy test pass + commit**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_review.py -v`
Expected: PASS.

```bash
git add backend/app/routers/review.py backend/app/schemas/review.py backend/tests/test_review.py
git commit -m "feat: review heatmap endpoint from review_logs"
```

---

### Task 3: Backend — mở rộng stats (mastered, total_reviews, phân bố nguồn)

**Files:**
- Modify: `backend/app/routers/review.py` (hàm `get_stats`), `backend/app/schemas/review.py` (StatsOut)
- Test: `backend/tests/test_review.py` (thêm test)

**Interfaces:**
- Produces: `StatsOut` thêm `mastered_cards: int` (repetitions ≥ 3), `total_reviews: int` (all-time từ review_logs), `reviews_by_source: dict[str, int]`.

- [ ] **Step 1: Viết failing test — thêm vào cuối `test_review.py`**

```python
def test_stats_mastered_and_sources(client, db):
    from app.models.review import Review as ReviewModel

    card = _make_card(client, "Mastered Deck")
    # 2 lần review qua flip, 1 lần qua game
    client.post(f"/api/review/{card['id']}", json={"quality": 5, "rating_source": "manual"})
    client.post(f"/api/review/{card['id']}", json={"quality": 5, "rating_source": "game_cloze"})
    client.post(f"/api/review/{card['id']}", json={"quality": 5, "rating_source": "game_cloze"})

    stats = client.get("/api/review/stats").json()
    assert stats["total_reviews"] == 3
    assert stats["reviews_by_source"] == {"manual": 1, "game_cloze": 2}
    # 3 lần quality=5 liên tiếp → repetitions >= 3 → mastered
    assert db.query(ReviewModel).one().repetitions >= 3
    assert stats["mastered_cards"] == 1
```

(Helper `_make_card` đã có trong file từ M1.)

- [ ] **Step 2: Chạy, xác nhận fail**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_review.py -k mastered -v`
Expected: FAIL — KeyError `total_reviews`.

- [ ] **Step 3: Implement**

`backend/app/schemas/review.py` — `StatsOut` thêm 3 field:

```python
class StatsOut(BaseModel):
    streak: int
    total_cards: int
    total_reviewed_today: int
    due_today: int
    new_cards: int
    due_upcoming: dict[str, int]
    mastered_cards: int = 0
    total_reviews: int = 0
    reviews_by_source: dict[str, int] = {}
```

`backend/app/routers/review.py` — trong `get_stats`:

1. Query totals hiện có thêm 1 cột `mastered`:

```python
    totals = (
        db.query(
            func.count(Review.id),
            func.coalesce(func.sum(case(((Review.due_date <= today) & (Review.repetitions > 0), 1), else_=0)), 0),
            func.coalesce(func.sum(case(((Review.due_date <= today) & (Review.repetitions == 0), 1), else_=0)), 0),
            func.coalesce(func.sum(case((Review.repetitions >= 3, 1), else_=0)), 0),
        )
        .select_from(Review)
        .join(Card, Review.card_id == Card.id)
        .join(Deck, Card.deck_id == Deck.id)
        .filter(Deck.user_id == user.id)
        .one()
    )
    total_cards, due_today, new_cards, mastered_cards = (int(x) for x in totals)
```

2. Thêm 1 query nhỏ phân bố nguồn (all-time, nhẹ vì group theo vài giá trị):

```python
    source_rows = (
        db.query(ReviewLog.rating_source, func.count(ReviewLog.id))
        .filter(ReviewLog.user_id == user.id)
        .group_by(ReviewLog.rating_source)
        .all()
    )
    reviews_by_source = {src: cnt for src, cnt in source_rows}
    total_reviews = sum(reviews_by_source.values())
```

3. Return bổ sung `mastered_cards=mastered_cards, total_reviews=total_reviews, reviews_by_source=reviews_by_source`.

- [ ] **Step 4: Chạy full suite backend + commit**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests -v`
Expected: PASS toàn bộ.

```bash
git add backend/app/routers/review.py backend/app/schemas/review.py backend/tests/test_review.py
git commit -m "feat: stats adds mastered cards, all-time reviews, source distribution"
```

---

### Task 4: FE — types, API layer, game utils

**Files:**
- Modify: `frontend/src/types/index.ts`, `frontend/src/api/review.ts`
- Create: `frontend/src/api/games.ts`, `frontend/src/components/games/gameUtils.ts`

**Interfaces:**
- Produces:
  - types: `GameMode = 'sentence' | 'cloze' | 'match'`; `HeatmapDay {date, count}`; `Stats` thêm `mastered_cards/total_reviews/reviews_by_source`; `ReviewSubmission.rating_source` mở rộng thêm `'game_sentence' | 'game_cloze' | 'game_match'`.
  - `getGameCards(mode, opts?)`, `getHeatmap(days?)`.
  - gameUtils: `englishPart(example)`, `cleanFront(front)`, `shuffle<T>(arr)`, `qualityFor(attempts, correct): 5|3|1`, `interface GameOutcome { cardId: string; quality: 5|3|1; attempts: number; correct: boolean; timeMs: number }`, `RATING_SOURCE: Record<GameMode, ReviewSubmission['rating_source']>`.

- [ ] **Step 1: Types — `frontend/src/types/index.ts`**

Sửa `ReviewSubmission.rating_source`:

```typescript
  rating_source?: 'manual' | 'auto' | 'game_sentence' | 'game_cloze' | 'game_match'
```

Interface `Stats` (đang có streak, total_cards, …) thêm:

```typescript
  mastered_cards: number
  total_reviews: number
  reviews_by_source: Record<string, number>
```

Thêm mới:

```typescript
export type GameMode = 'sentence' | 'cloze' | 'match'

export interface HeatmapDay {
  date: string // YYYY-MM-DD
  count: number
}
```

- [ ] **Step 2: API — `frontend/src/api/games.ts` (mới)**

```typescript
import client from './client'
import type { Card, GameMode } from '../types'

export const getGameCards = (mode: GameMode, opts: { deckId?: string; limit?: number } = {}) =>
  client
    .get<Card[]>('/games/cards', { params: { mode, deck_id: opts.deckId, limit: opts.limit ?? 10 } })
    .then(r => r.data)
```

`frontend/src/api/review.ts` thêm:

```typescript
import type { HeatmapDay } from '../types'

export const getHeatmap = (days = 365) =>
  client.get<HeatmapDay[]>('/review/heatmap', { params: { days } }).then(r => r.data)
```

- [ ] **Step 3: `frontend/src/components/games/gameUtils.ts` (mới)**

```typescript
import type { GameMode, ReviewSubmission } from '../../types'

/** Cắt phần dịch tiếng Việt trong ngoặc ở cuối câu ví dụ (mirror logic backend). */
export const englishPart = (example: string) => example.replace(/\s*\([^)]*\)\s*$/, '').trim()

/** Lấy phần chữ tiếng Anh của mặt trước thẻ (bỏ phiên âm nếu có). */
export const cleanFront = (front: string) =>
  front.match(/[A-Za-z][A-Za-z\s'-]*/)?.[0].trim().toLowerCase() ?? front.trim().toLowerCase()

export function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Mapping quality thống nhất: đúng ngay = 5, đúng sau khi sai = 3, bỏ cuộc = 1. */
export const qualityFor = (attempts: number, correct: boolean): 5 | 3 | 1 =>
  !correct ? 1 : attempts <= 1 ? 5 : 3

export interface GameOutcome {
  cardId: string
  quality: 5 | 3 | 1
  attempts: number
  correct: boolean
  timeMs: number
}

export const RATING_SOURCE: Record<GameMode, NonNullable<ReviewSubmission['rating_source']>> = {
  sentence: 'game_sentence',
  cloze: 'game_cloze',
  match: 'game_match',
}
```

- [ ] **Step 4: Verify build + commit**

Run: `cd frontend && npm run build`
Expected: build sạch (types mới chưa được dùng — OK).

```bash
git add frontend/src/types/index.ts frontend/src/api/games.ts frontend/src/api/review.ts frontend/src/components/games/gameUtils.ts
git commit -m "feat: game types, api layer and shared game utils"
```

---

### Task 5: FE — SentenceBuilderGame

**Files:**
- Create: `frontend/src/components/games/SentenceBuilderGame.tsx`

**Interfaces:**
- Consumes: gameUtils Task 4.
- Produces: `<SentenceBuilderGame card={Card} onFinish={(o: Omit<GameOutcome, 'cardId'>) => void} />` — component 1 thẻ; GamesPage (Task 8) điều phối chuyển thẻ. Câu > 12 từ: cố định phần đầu/cuối, chỉ xáo cửa sổ 8 từ giữa.

- [ ] **Step 1: Implement `SentenceBuilderGame.tsx`**

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Card } from '../../types'
import { englishPart, qualityFor, shuffle, type GameOutcome } from './gameUtils'

interface Props {
  card: Card
  onFinish: (outcome: Omit<GameOutcome, 'cardId'>) => void
}

/** Câu > MAX_FREE từ: chỉ xáo cửa sổ 8 từ giữa, phần còn lại cố định. */
const MAX_FREE = 12
const WINDOW = 8

export default function SentenceBuilderGame({ card, onFinish }: Props) {
  const words = useMemo(() => englishPart(card.example_sentence ?? '').split(/\s+/), [card])
  const movableRange = useMemo(() => {
    if (words.length <= MAX_FREE) return { start: 0, end: words.length }
    const start = Math.floor((words.length - WINDOW) / 2)
    return { start, end: start + WINDOW }
  }, [words])

  const answer = useMemo(() => words.slice(movableRange.start, movableRange.end), [words, movableRange])
  const [pool, setPool] = useState<{ word: string; key: number }[]>([])
  const [placed, setPlaced] = useState<{ word: string; key: number }[]>([])
  const [attempts, setAttempts] = useState(0)
  const [wrongFlash, setWrongFlash] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const startedAt = useRef(Date.now())

  useEffect(() => {
    setPool(shuffle(answer.map((word, i) => ({ word, key: i }))))
    setPlaced([])
    setAttempts(0)
    setRevealed(false)
    startedAt.current = Date.now()
  }, [card.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (item: { word: string; key: number }) => {
    setPool(p => p.filter(x => x.key !== item.key))
    setPlaced(p => [...p, item])
  }
  const unpick = (item: { word: string; key: number }) => {
    setPlaced(p => p.filter(x => x.key !== item.key))
    setPool(p => [...p, item])
  }

  const check = () => {
    const next = attempts + 1
    setAttempts(next)
    if (placed.map(x => x.word).join(' ') === answer.join(' ')) {
      onFinish({ quality: qualityFor(next, true), attempts: next, correct: true, timeMs: Date.now() - startedAt.current })
    } else {
      setWrongFlash(true)
      setTimeout(() => setWrongFlash(false), 500)
    }
  }

  const giveUp = () => {
    setRevealed(true)
    setTimeout(
      () => onFinish({ quality: 1, attempts: attempts + 1, correct: false, timeMs: Date.now() - startedAt.current }),
      2200,
    )
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
      <p className="mb-1 text-xs font-black uppercase text-slate-500">Xếp từ thành câu ví dụ của:</p>
      <h3 className="mb-4 text-lg font-black text-cyan-300">{card.front_text}</h3>

      {/* Vùng câu đang xếp */}
      <div className={`mb-4 min-h-[3.5rem] rounded-xl border p-3 text-[15px] leading-8 transition ${wrongFlash ? 'animate-pulse border-rose-400/60 bg-rose-500/10' : 'border-white/10 bg-black/25'}`}>
        {movableRange.start > 0 && <span className="text-slate-400">{words.slice(0, movableRange.start).join(' ')} </span>}
        {revealed
          ? <span className="font-bold text-emerald-300">{answer.join(' ')}</span>
          : placed.map(item => (
              <button key={item.key} onClick={() => unpick(item)} className="mx-0.5 rounded-lg bg-cyan-400/15 px-2 py-0.5 font-bold text-cyan-200 hover:bg-cyan-400/25">
                {item.word}
              </button>
            ))}
        {!revealed && placed.length < answer.length && <span className="mx-1 text-slate-600">___</span>}
        {movableRange.end < words.length && <span className="text-slate-400"> {words.slice(movableRange.end).join(' ')}</span>}
      </div>

      {/* Pool từ */}
      <div className="mb-5 flex flex-wrap gap-2">
        {pool.map(item => (
          <button key={item.key} onClick={() => pick(item)} className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-sm font-bold text-slate-100 transition hover:border-cyan-300/30 hover:bg-white/[0.1]">
            {item.word}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={check}
          disabled={placed.length !== answer.length || revealed}
          className="flex-1 rounded-xl border border-emerald-300/25 bg-emerald-400/10 py-2.5 text-sm font-bold text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-40"
        >
          Kiểm tra
        </button>
        <button onClick={giveUp} disabled={revealed} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-400 transition hover:text-rose-300 disabled:opacity-40">
          Bỏ qua
        </button>
      </div>
      {attempts > 0 && !revealed && <p className="mt-2 text-xs text-rose-300/80">Chưa đúng — bấm vào từ đã xếp để bỏ ra, thử lại nhé ({attempts} lần sai)</p>}
    </div>
  )
}
```

Lưu ý so sánh theo **chuỗi từ** (không theo key) — hai từ trùng nhau đổi chỗ vẫn tính đúng.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/games/SentenceBuilderGame.tsx
git commit -m "feat: sentence builder game component"
```

(Verify bằng dev server gộp ở Task 8 khi có trang /games.)

---

### Task 6: FE — DictationClozeGame

**Files:**
- Create: `frontend/src/components/games/DictationClozeGame.tsx`

**Interfaces:**
- Consumes: gameUtils, `resolveAssetUrl` từ `api/config.ts`.
- Produces: `<DictationClozeGame card={Card} onFinish={(o: Omit<GameOutcome, 'cardId'>) => void} />` — phát audio câu (example_audio_url, fallback TTS), điền từ bị khuyết.

- [ ] **Step 1: Implement `DictationClozeGame.tsx`**

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { resolveAssetUrl } from '../../api/config'
import type { Card } from '../../types'
import { cleanFront, englishPart, qualityFor, type GameOutcome } from './gameUtils'

interface Props {
  card: Card
  onFinish: (outcome: Omit<GameOutcome, 'cardId'>) => void
}

export default function DictationClozeGame({ card, onFinish }: Props) {
  const sentence = useMemo(() => englishPart(card.example_sentence ?? ''), [card])
  const target = useMemo(() => cleanFront(card.front_text), [card])
  // Che từ vựng trong câu (giữ nguyên hoa/thường phần còn lại)
  const clozed = useMemo(() => {
    const re = new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    return sentence.replace(re, '_____')
  }, [sentence, target])

  const [typed, setTyped] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [wrongFlash, setWrongFlash] = useState(false)
  const startedAt = useRef(Date.now())
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    setTyped(''); setAttempts(0); setRevealed(false)
    startedAt.current = Date.now()
    play() // tự phát khi vào thẻ
    return () => {
      audioRef.current?.pause()
      window.speechSynthesis.cancel()
    }
  }, [card.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const play = () => {
    const url = resolveAssetUrl(card.example_audio_url)
    if (url) {
      audioRef.current?.pause()
      audioRef.current = new Audio(url)
      audioRef.current.play()
    } else {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(sentence)
      u.lang = 'en-US'
      u.rate = 0.9
      window.speechSynthesis.speak(u)
    }
  }

  const check = () => {
    const next = attempts + 1
    setAttempts(next)
    if (typed.trim().toLowerCase() === target) {
      onFinish({ quality: qualityFor(next, true), attempts: next, correct: true, timeMs: Date.now() - startedAt.current })
    } else {
      setWrongFlash(true)
      setTimeout(() => setWrongFlash(false), 500)
    }
  }

  const giveUp = () => {
    setRevealed(true)
    setTimeout(
      () => onFinish({ quality: 1, attempts: attempts + 1, correct: false, timeMs: Date.now() - startedAt.current }),
      2200,
    )
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
      <p className="mb-4 text-xs font-black uppercase text-slate-500">Nghe và điền từ còn thiếu</p>

      <button onClick={play} className="mb-4 flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200 transition hover:bg-cyan-400/20">
        🔊 Nghe lại
      </button>

      <p className="mb-4 rounded-xl bg-black/25 p-3 text-[15px] leading-7 text-slate-200">
        {revealed ? sentence.replace('_____', target) : clozed}
        {revealed && <span className="ml-2 font-bold text-emerald-300">← {target}</span>}
      </p>

      <input
        value={typed}
        onChange={e => setTyped(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && typed.trim() && !revealed && check()}
        placeholder="Gõ từ còn thiếu..."
        autoFocus
        className={`mb-4 w-full rounded-xl border bg-black/30 px-3 py-2.5 text-white placeholder:text-slate-500 transition ${wrongFlash ? 'animate-pulse border-rose-400/60' : 'border-white/10'}`}
      />

      <div className="flex gap-2">
        <button onClick={check} disabled={!typed.trim() || revealed} className="flex-1 rounded-xl border border-emerald-300/25 bg-emerald-400/10 py-2.5 text-sm font-bold text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-40">
          Kiểm tra
        </button>
        <button onClick={giveUp} disabled={revealed} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-400 transition hover:text-rose-300 disabled:opacity-40">
          Bỏ qua
        </button>
      </div>
      {attempts > 0 && !revealed && <p className="mt-2 text-xs text-rose-300/80">Chưa đúng, nghe lại và thử tiếp ({attempts} lần sai)</p>}
    </div>
  )
}
```

Lưu ý: `clozed` thay bằng regex đã escape ký tự đặc biệt của `target`. Nếu câu hiển thị vẫn chứa từ gốc (backend đã đảm bảo front nằm trong câu qua eligibility, nhưng phòng khác dạng hoa/thường đã có flag `i`).

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/games/DictationClozeGame.tsx
git commit -m "feat: dictation cloze game component"
```

---

### Task 7: FE — ConceptMatchGame

**Files:**
- Create: `frontend/src/components/games/ConceptMatchGame.tsx`

**Interfaces:**
- Consumes: gameUtils.
- Produces: `<ConceptMatchGame cards={Card[]} onComplete={(outcomes: GameOutcome[]) => void} />` — 1 vòng tối đa 5 cặp từ ↔ định nghĩa EN; outcome per card: sai lần đầu cho cặp đó → 3, đúng ngay → 5 (không có bỏ cuộc — vòng kết thúc khi nối hết).

- [ ] **Step 1: Implement `ConceptMatchGame.tsx`**

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Card } from '../../types'
import { shuffle, type GameOutcome } from './gameUtils'

interface Props {
  cards: Card[] // tối đa 5 thẻ mỗi vòng
  onComplete: (outcomes: GameOutcome[]) => void
}

export default function ConceptMatchGame({ cards, onComplete }: Props) {
  const [leftSel, setLeftSel] = useState<string | null>(null) // card.id
  const [solved, setSolved] = useState<Set<string>>(new Set())
  const [fails, setFails] = useState<Record<string, number>>({})
  const [shakeId, setShakeId] = useState<string | null>(null)
  const startedAt = useRef(Date.now())
  const roundKey = useMemo(() => cards.map(c => c.id).join(','), [cards])

  const rightItems = useMemo(
    () => shuffle(cards.map(c => ({ id: c.id, definition: c.definition ?? '' }))),
    [roundKey], // eslint-disable-line react-hooks/exhaustive-deps
  )

  useEffect(() => {
    setLeftSel(null); setSolved(new Set()); setFails({})
    startedAt.current = Date.now()
  }, [roundKey])

  const pickRight = (rightId: string) => {
    if (!leftSel || solved.has(rightId)) return
    if (rightId === leftSel) {
      const nextSolved = new Set(solved).add(rightId)
      setSolved(nextSolved)
      setLeftSel(null)
      if (nextSolved.size === cards.length) {
        const timeMs = Date.now() - startedAt.current
        onComplete(
          cards.map(c => {
            const failCount = fails[c.id] ?? 0
            return {
              cardId: c.id,
              quality: failCount === 0 ? 5 : 3,
              attempts: failCount + 1,
              correct: true,
              timeMs: Math.round(timeMs / cards.length),
            }
          }),
        )
      }
    } else {
      setFails(f => ({ ...f, [leftSel]: (f[leftSel] ?? 0) + 1 }))
      setShakeId(rightId)
      setTimeout(() => setShakeId(null), 400)
    }
  }

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
      <p className="mb-4 text-xs font-black uppercase text-slate-500">
        Nối từ với định nghĩa · {solved.size}/{cards.length}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {cards.map(c => (
            <button
              key={c.id}
              onClick={() => !solved.has(c.id) && setLeftSel(c.id)}
              disabled={solved.has(c.id)}
              className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm font-bold transition ${
                solved.has(c.id)
                  ? 'border-emerald-300/20 bg-emerald-400/5 text-emerald-300/50'
                  : leftSel === c.id
                    ? 'border-cyan-300/50 bg-cyan-400/15 text-cyan-200'
                    : 'border-white/10 bg-white/[0.05] text-slate-100 hover:border-cyan-300/25'
              }`}
            >
              {c.front_text}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {rightItems.map(item => (
            <button
              key={item.id}
              onClick={() => pickRight(item.id)}
              disabled={solved.has(item.id)}
              className={`w-full rounded-xl border px-3 py-2.5 text-left text-xs leading-5 transition ${
                shakeId === item.id
                  ? 'animate-pulse border-rose-400/60 bg-rose-500/10 text-rose-200'
                  : solved.has(item.id)
                    ? 'border-emerald-300/20 bg-emerald-400/5 text-emerald-300/50'
                    : 'border-white/10 bg-white/[0.05] text-slate-300 hover:border-cyan-300/25'
              }`}
            >
              {item.definition}
            </button>
          ))}
        </div>
      </div>
      {!leftSel && solved.size < cards.length && (
        <p className="mt-3 text-center text-xs text-slate-500">Chọn một từ bên trái trước, rồi chọn định nghĩa khớp bên phải</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/games/ConceptMatchGame.tsx
git commit -m "feat: concept match game component"
```

---

### Task 8: FE — GamesPage điều phối + route + Navbar

**Files:**
- Create: `frontend/src/pages/GamesPage.tsx`
- Modify: `frontend/src/App.tsx`, `frontend/src/components/Navbar.tsx`

**Interfaces:**
- Consumes: 3 game component (Task 5-7), `getGameCards` (Task 4), `submitReview`, `getDecks`, `RATING_SOURCE`/`GameOutcome` từ gameUtils.
- Produces: route `/games` (RequireAuth + lazy); flow: setup (chọn game + phạm vi) → playing → màn kết quả; mỗi outcome submit `POST /api/review/{card_id}` với `rating_source`, `response_time_ms`, `attempt_count`, `answer_correct`.

- [ ] **Step 1: Implement `frontend/src/pages/GamesPage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { getGameCards } from '../api/games'
import { getDecks } from '../api/decks'
import { submitReview } from '../api/review'
import { useNotification } from '../components/NotificationProvider'
import SentenceBuilderGame from '../components/games/SentenceBuilderGame'
import DictationClozeGame from '../components/games/DictationClozeGame'
import ConceptMatchGame from '../components/games/ConceptMatchGame'
import { RATING_SOURCE, type GameOutcome } from '../components/games/gameUtils'
import type { Card, Deck, GameMode } from '../types'

const GAMES: { mode: GameMode; title: string; desc: string; icon: string }[] = [
  { mode: 'sentence', title: 'Sentence Builder', desc: 'Xếp từ thành câu ví dụ hoàn chỉnh', icon: '🧩' },
  { mode: 'cloze', title: 'Dictation Cloze', desc: 'Nghe câu và điền từ vựng còn thiếu', icon: '🎧' },
  { mode: 'match', title: 'Concept Match', desc: 'Nối từ vựng với định nghĩa tiếng Anh', icon: '🔗' },
]

type Phase = 'setup' | 'loading' | 'playing' | 'done'
const MATCH_ROUND_SIZE = 5

export default function GamesPage() {
  const { toast } = useNotification()
  const [phase, setPhase] = useState<Phase>('setup')
  const [mode, setMode] = useState<GameMode>('sentence')
  const [scope, setScope] = useState<string>('due') // 'due' | deck id
  const [decks, setDecks] = useState<Deck[]>([])
  const [cards, setCards] = useState<Card[]>([])
  const [index, setIndex] = useState(0) // sentence/cloze: index thẻ; match: index vòng
  const [outcomes, setOutcomes] = useState<GameOutcome[]>([])

  useEffect(() => { getDecks().then(setDecks) }, [])

  const start = async (m: GameMode) => {
    setMode(m)
    setPhase('loading')
    try {
      const fetched = await getGameCards(m, { deckId: scope === 'due' ? undefined : scope, limit: 10 })
      if (fetched.length === 0) {
        toast('Không có thẻ phù hợp cho game này trong phạm vi đã chọn', 'error')
        setPhase('setup')
        return
      }
      setCards(fetched)
      setIndex(0)
      setOutcomes([])
      setPhase('playing')
    } catch {
      toast('Không tải được thẻ', 'error')
      setPhase('setup')
    }
  }

  const submit = (outcome: GameOutcome) => {
    // Không await để game mượt; lỗi mạng chỉ log toast
    submitReview(outcome.cardId, {
      quality: outcome.quality,
      rating_source: RATING_SOURCE[mode],
      response_time_ms: outcome.timeMs,
      attempt_count: outcome.attempts,
      answer_correct: outcome.correct,
    }).catch(() => toast('Không lưu được kết quả 1 thẻ', 'error'))
  }

  const handleSingleFinish = (o: Omit<GameOutcome, 'cardId'>) => {
    const outcome: GameOutcome = { ...o, cardId: cards[index].id }
    submit(outcome)
    setOutcomes(prev => [...prev, outcome])
    if (index + 1 < cards.length) setIndex(index + 1)
    else setPhase('done')
  }

  const handleMatchComplete = (roundOutcomes: GameOutcome[]) => {
    roundOutcomes.forEach(submit)
    setOutcomes(prev => [...prev, ...roundOutcomes])
    const nextRoundStart = (index + 1) * MATCH_ROUND_SIZE
    if (nextRoundStart < cards.length) setIndex(index + 1)
    else setPhase('done')
  }

  const cardById = (id: string) => cards.find(c => c.id === id)

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-black text-white">🎮 Mini-games</h1>

      {phase === 'setup' && (
        <>
          <div className="mb-5 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
            <label className="mb-2 block text-xs font-black uppercase text-slate-500">Phạm vi thẻ</label>
            <select value={scope} onChange={e => setScope(e.target.value)} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white">
              <option value="due">🔥 Thẻ đến hạn hôm nay</option>
              {decks.map(d => <option key={d.id} value={d.id}>{d.name} ({d.card_count} thẻ)</option>)}
            </select>
          </div>
          <div className="space-y-3">
            {GAMES.map(g => (
              <button key={g.mode} onClick={() => start(g.mode)} className="flex w-full items-center gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 text-left transition hover:border-cyan-300/25 hover:bg-white/[0.06]">
                <span className="text-3xl">{g.icon}</span>
                <span>
                  <span className="block font-black text-slate-100">{g.title}</span>
                  <span className="block text-sm text-slate-400">{g.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {phase === 'loading' && <div className="h-48 animate-pulse rounded-2xl bg-white/[0.05]" />}

      {phase === 'playing' && mode !== 'match' && (
        <>
          <p className="mb-3 text-sm text-slate-400">Thẻ {index + 1}/{cards.length}</p>
          {mode === 'sentence'
            ? <SentenceBuilderGame key={cards[index].id} card={cards[index]} onFinish={handleSingleFinish} />
            : <DictationClozeGame key={cards[index].id} card={cards[index]} onFinish={handleSingleFinish} />}
        </>
      )}

      {phase === 'playing' && mode === 'match' && (
        <>
          <p className="mb-3 text-sm text-slate-400">
            Vòng {index + 1}/{Math.ceil(cards.length / MATCH_ROUND_SIZE)}
          </p>
          <ConceptMatchGame
            key={index}
            cards={cards.slice(index * MATCH_ROUND_SIZE, (index + 1) * MATCH_ROUND_SIZE)}
            onComplete={handleMatchComplete}
          />
        </>
      )}

      {phase === 'done' && (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
          <h2 className="mb-1 text-xl font-black text-white">🏁 Kết quả</h2>
          <p className="mb-4 text-sm text-slate-400">
            Đúng ngay: {outcomes.filter(o => o.quality === 5).length} · Đúng sau khi sai: {outcomes.filter(o => o.quality === 3).length} · Bỏ qua: {outcomes.filter(o => o.quality === 1).length}
          </p>
          <ul className="mb-5 space-y-1.5 text-sm">
            {outcomes.map(o => (
              <li key={o.cardId + String(o.timeMs)} className="flex items-center justify-between rounded-lg bg-black/20 px-3 py-1.5">
                <span className="font-bold text-slate-200">{cardById(o.cardId)?.front_text ?? '—'}</span>
                <span className={o.quality === 5 ? 'text-emerald-300' : o.quality === 3 ? 'text-amber-300' : 'text-rose-300'}>
                  {o.quality === 5 ? '✓ Đúng ngay' : o.quality === 3 ? `✓ Sau ${o.attempts} lần` : '✗ Bỏ qua'}
                </span>
              </li>
            ))}
          </ul>
          <p className="mb-4 text-xs text-slate-500">Kết quả đã được tính vào lịch ôn tập SM-2.</p>
          <div className="flex gap-2">
            <button onClick={() => start(mode)} className="flex-1 rounded-xl border border-cyan-300/25 bg-cyan-400/10 py-2.5 text-sm font-bold text-cyan-200 transition hover:bg-cyan-400/20">
              🔄 Chơi tiếp
            </button>
            <button onClick={() => setPhase('setup')} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-400 hover:text-white">
              Chọn game khác
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Route + Navbar**

`frontend/src/App.tsx`:

```tsx
const GamesPage = lazy(() => import('./pages/GamesPage'))
...
<Route path="/games" element={<RequireAuth><GamesPage /></RequireAuth>} />
```

`frontend/src/components/Navbar.tsx`: thêm vào `NAV_ITEMS` mục `{ to: '/games', label: 'Games', icon: <icon phù hợp theo pattern hiện có> }`. Đếm lại tổng item và cập nhật class mobile `grid-cols-N` cho khớp (sau M2 là 5, thêm games thành 6 → cân nhắc `grid-cols-3` cho mobile 2 hàng nếu 6 cột quá chật — quyết định theo kết quả nhìn thực tế ở Step 3).

- [ ] **Step 3: Verify bằng dev server**

- `/games`: chọn phạm vi deck 4000 Words unit bất kỳ → chơi đủ 3 game.
- Sentence: xếp đúng ngay → kết quả "Đúng ngay"; xếp sai 1 lần rồi đúng → "Sau 2 lần"; Bỏ qua → hiện đáp án xanh rồi tự chuyển.
- Cloze: audio phát (thẻ 4000 Words có example_audio_url); thẻ tự tạo không audio → TTS đọc.
- Match: nối sai → ô rung đỏ; nối hết → sang vòng/kết quả.
- Mở DevTools Network: mỗi thẻ xong có POST `/api/review/{id}` với `rating_source: game_*`.
- StatsPage: reviewed_today tăng đúng số thẻ đã chơi.
- Mobile viewport (390px): pool từ wrap đẹp, 2 cột match không tràn, Navbar không vỡ.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/GamesPage.tsx frontend/src/App.tsx frontend/src/components/Navbar.tsx
git commit -m "feat: games page orchestrating 3 games with SM-2 submission"
```

---

### Task 9: FE — StudyHeatmap + nâng cấp StatsPage

**Files:**
- Create: `frontend/src/components/StudyHeatmap.tsx`
- Modify: `frontend/src/pages/StatsPage.tsx`

**Interfaces:**
- Consumes: `getHeatmap` (Task 4), `Stats` fields mới (Task 3/4), pattern `useCachedQuery` hiện có của StatsPage.
- Produces: `<StudyHeatmap data={HeatmapDay[]} />` — lưới 53×7 kiểu GitHub, 5 mức màu, tooltip, scroll ngang mobile.

- [ ] **Step 1: Implement `frontend/src/components/StudyHeatmap.tsx`**

```tsx
import { useMemo } from 'react'
import type { HeatmapDay } from '../types'

const CELL = 12
const GAP = 3
const LEVELS = ['#1e293b', '#164e63', '#0e7490', '#06b6d4', '#67e8f9'] // slate-800 → cyan-300

const levelFor = (count: number) => (count === 0 ? 0 : count <= 2 ? 1 : count <= 5 ? 2 : count <= 9 ? 3 : 4)

const MONTH_LABELS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12']

export default function StudyHeatmap({ data }: { data: HeatmapDay[] }) {
  const { weeks, monthTicks, total } = useMemo(() => {
    const counts = new Map(data.map(d => [d.date, d.count]))
    const today = new Date()
    // Bắt đầu từ Chủ nhật của tuần chứa (hôm nay - 364 ngày)
    const start = new Date(today)
    start.setDate(start.getDate() - 364)
    start.setDate(start.getDate() - start.getDay())

    const weeks: { date: string; count: number; inRange: boolean }[][] = []
    const monthTicks: { weekIdx: number; label: string }[] = []
    let cursor = new Date(start)
    let lastMonth = -1

    while (cursor <= today) {
      const week: { date: string; count: number; inRange: boolean }[] = []
      for (let d = 0; d < 7; d++) {
        const iso = cursor.toISOString().slice(0, 10)
        week.push({ date: iso, count: counts.get(iso) ?? 0, inRange: cursor <= today })
        if (cursor.getDate() <= 7 && cursor.getMonth() !== lastMonth && d === 0) {
          lastMonth = cursor.getMonth()
          monthTicks.push({ weekIdx: weeks.length, label: MONTH_LABELS[lastMonth] })
        }
        cursor = new Date(cursor)
        cursor.setDate(cursor.getDate() + 1)
      }
      weeks.push(week)
    }
    return { weeks, monthTicks, total: data.reduce((s, d) => s + d.count, 0) }
  }, [data])

  const width = weeks.length * (CELL + GAP)
  const height = 7 * (CELL + GAP) + 16

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-black uppercase text-slate-400">🗓 Lịch sử học 12 tháng</h3>
        <span className="text-xs text-slate-500">{total} lượt ôn</span>
      </div>
      <div className="overflow-x-auto pb-1">
        <svg width={width} height={height} className="block">
          {monthTicks.map(t => (
            <text key={t.weekIdx} x={t.weekIdx * (CELL + GAP)} y={10} className="fill-slate-500" fontSize={9}>
              {t.label}
            </text>
          ))}
          {weeks.map((week, wi) =>
            week.map((day, di) =>
              day.inRange ? (
                <rect
                  key={day.date}
                  x={wi * (CELL + GAP)}
                  y={16 + di * (CELL + GAP)}
                  width={CELL}
                  height={CELL}
                  rx={2.5}
                  fill={LEVELS[levelFor(day.count)]}
                >
                  <title>{`${day.date}: ${day.count} lượt ôn`}</title>
                </rect>
              ) : null,
            ),
          )}
        </svg>
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-slate-500">
        Ít {LEVELS.map(c => <span key={c} className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c }} />)} Nhiều
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Tích hợp vào `StatsPage.tsx`**

- Mở rộng fetcher của `useCachedQuery` hiện có: `Promise.all([getStats(), getHeatmap()])` trả `{ stats, heatmap }` (key cache giữ dạng `stats:${user.id}` — data shape đổi nên bump key thành `statsv2:${user.id}`).
- Render `<StudyHeatmap data={heatmap} />` dưới khối chỉ số hiện có.
- Thêm hàng chỉ số mới (theo style ô số liệu hiện có của trang): `✅ Đã thuộc: {stats.mastered_cards}` (tooltip/chú thích "ôn đúng ≥ 3 lần liên tiếp"), `📚 Tổng lượt ôn: {stats.total_reviews}`, và dòng nhỏ phân bố: `🃏 Flip {reviews_by_source.manual ?? 0} · 🧩 {reviews_by_source.game_sentence ?? 0} · 🎧 {reviews_by_source.game_cloze ?? 0} · 🔗 {reviews_by_source.game_match ?? 0}`.

- [ ] **Step 3: Verify bằng dev server**

StatsPage: heatmap hiện ô hôm nay có màu (đã có review từ Task 8 verify); hover ô → tooltip ngày + số; mobile 390px → scroll ngang mượt, không vỡ layout; chỉ số mới hiển thị đúng với số liệu vừa chơi game.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/StudyHeatmap.tsx frontend/src/pages/StatsPage.tsx
git commit -m "feat: github-style study heatmap + mastered/source stats on stats page"
```

---

### Task 10: Verify end-to-end M3 + docs

- [ ] **Step 1: Full backend suite + FE build**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests -v` (cwd backend) và `npm run build` (cwd frontend).
Expected: PASS / build sạch.

- [ ] **Step 2: Smoke E2E**

Flow: chơi 1 phiên Sentence Builder từ deck 4000 Words → StatsPage: heatmap ô hôm nay đậm hơn, total_reviews tăng, phân bố nguồn có 🧩; mở ReviewPage xác nhận thẻ chơi đúng-ngay đã lùi lịch (không còn trong due hôm nay).

- [ ] **Step 3: Cập nhật README (mục Features: 3 mini-games + heatmap) + commit**

```bash
git add README.md
git commit -m "docs: mini-games and study heatmap"
```
