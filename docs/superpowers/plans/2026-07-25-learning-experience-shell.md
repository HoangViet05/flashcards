# Learning Experience Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa việc học lên trung tâm app: trang chủ thành buổi học hôm nay, buổi học có phản hồi tức thì và màn tổng kết, toàn bộ giao diện dùng chung một bộ token.

**Architecture:** Backend thêm đúng một endpoint đọc dữ liệu (`GET /api/daily/home`) gộp số liệu trang chủ, không đổi schema và không đổi logic phiên học. Frontend đổi vai trò route (`/` thành trang học, `/library` nhận phần quản lý bộ thẻ), tách `DailyPage` thành hook + component theo từng bước, và thêm lớp phản hồi (màu/rung/âm/combo) vào `ExerciseCard`.

**Tech Stack:** React 19 + TypeScript + Vite 8 + Tailwind v4 (`@theme`) · FastAPI + SQLAlchemy + Pydantic · pytest.

## Global Constraints

- Spec nguồn: `docs/superpowers/specs/2026-07-25-learning-experience-shell-design.md`. Mọi quyết định lấy từ đó.
- **Không** đổi schema DB, **không** migration, **không** đổi thuật toán SM-2, luật chọn từ hay luật sinh ô chữ.
- **Không** thêm route `/review` và không tạo màn học mới. Lối học duy nhất là `/daily`.
- **Không** cài framework test frontend. Frontend kiểm chứng bằng `npm run build` + chạy app thật trong trình duyệt.
- Python của backend: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe`. Mọi lệnh pytest chạy với cwd = `backend`.
- Toàn bộ chữ hiển thị cho người dùng viết bằng **tiếng Việt**, giọng như phần còn lại của app.
- Màu mới phải dùng token từ `styles/tokens.css`. Không thêm giá trị màu rời rạc kiểu `bg-white/[.045]`.
- Mọi animation mới phải bị vô hiệu trong `@media (prefers-reduced-motion: reduce)`.
- Sau mỗi task: `npm run build` (trong `frontend`) phải xanh, và `python -m pytest -q` (trong `backend`) phải xanh.
- Commit sau mỗi task, một commit một task.

---

### Task 1: Bộ token thị giác

**Files:**
- Create: `frontend/src/styles/tokens.css`
- Modify: `frontend/src/index.css:1` (thêm import), `frontend/src/index.css:19-32` (nền body), `frontend/src/index.css:63-76` (lớp lưới)

**Interfaces:**
- Consumes: không có.
- Produces: các CSS custom property dùng được như utility Tailwind v4: `bg-surface-1`, `bg-surface-2`, `bg-surface-3`, `border-subtle`, `border-strong`, `text-strong`, `text-body`, `text-muted`, `text-correct`, `text-wrong`, `text-warn`, `bg-correct`, `bg-wrong`, `bg-warn`, `text-accent`, `text-accent-2`, và biến `--dur-fast`, `--dur-base`, `--dur-slow`.

- [ ] **Step 1: Tạo file token**

Create `frontend/src/styles/tokens.css`:

```css
@theme {
  /* Bề mặt — đúng 3 tầng, thay cho bg-white/[.03] .04 .045 .05 .07 rải rác.
     Dùng rgba chứ không dùng oklch(from …): cú pháp màu tương đối chưa chắc qua
     được Lightning CSS của Vite 8 và Safari cũ. */
  --color-surface-1: rgba(255, 255, 255, 0.035);
  --color-surface-2: rgba(255, 255, 255, 0.06);
  --color-surface-3: rgba(255, 255, 255, 0.10);

  /* Viền */
  --color-subtle: rgba(255, 255, 255, 0.10);
  --color-strong: rgba(255, 255, 255, 0.18);

  /* Chữ — text-muted phải đạt tương phản >= 4.5:1 trên nền nội dung.
     #94a3b8 (slate-400) trên #0b0d16 đạt ~7:1. slate-500 cũ chỉ ~3:1. */
  --color-strong-text: #f1f5f9;
  --color-body: #cbd5e1;
  --color-muted: #94a3b8;

  /* Trạng thái bài tập */
  --color-correct: #34d399;
  --color-wrong: #fb7185;
  --color-warn: #fbbf24;

  /* Nhấn — giữ đúng nhận diện tím/cyan hiện tại */
  --color-accent: #7c3aed;
  --color-accent-2: #22d3ee;
}

:root {
  --dur-fast: 150ms;
  --dur-base: 250ms;
  --dur-slow: 400ms;
}
```

- [ ] **Step 2: Import token và làm dịu nền**

Trong `frontend/src/index.css`, đổi dòng 1 từ:

```css
@import "tailwindcss";
```

thành:

```css
@import "tailwindcss";
@import "./styles/tokens.css";
```

Thay khối `body` (dòng 19-32) bằng:

```css
body {
  background-color: #05050A;
  color: #cbd5e1;
  min-height: 100vh;
  width: 100%;
  max-width: 100%;
  overflow-x: clip;
  background-image: radial-gradient(circle 900px at 50% -10%, rgba(124, 58, 237, 0.10) 0%, transparent 62%);
  background-attachment: fixed;
}
```

Xóa hẳn khối `body::before` (lưới ô vuông phủ toàn màn, dòng 63-76) và khối `@media (max-width: 640px) { body { background-attachment: scroll; } }` — không còn nhiều lớp nền nên không cần.

- [ ] **Step 3: Kiểm tra build**

Run trong `frontend`: `npm run build`
Expected: `tsc` không lỗi, Vite build thành công, không có cảnh báo về `@theme`.

- [ ] **Step 4: Xác nhận token dùng được**

Run trong `frontend`: `npm run dev`, mở `http://localhost:5173`, đăng nhập, và trong console chạy:

```js
getComputedStyle(document.body).getPropertyValue('--dur-base')
```

Expected: `" 250ms"` (hoặc `"250ms"`). Nếu rỗng thì import token chưa vào.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles/tokens.css frontend/src/index.css
git commit -m "style: add visual design tokens and calm the page background"
```

---

### Task 2: Xóa mã chết của tính năng AI

**Files:**
- Delete: `frontend/src/components/RobotAnimation.tsx`
- Modify: `frontend/src/pages/HomePage.tsx`, `frontend/src/pages/DeckDetailPage.tsx`, `frontend/src/index.css`

**Interfaces:**
- Consumes: không có.
- Produces: `HomePage` và `DeckDetailPage` không còn state/UI liên quan AI. `frontend/src/api/ai.ts` và `backend/app/routers/ai.py` **giữ nguyên**, chỉ bỏ nơi gọi ở UI.

- [ ] **Step 1: Xác minh trước khi xóa**

Run trong repo root:

```bash
grep -rn "RobotAnimation\|animate-fly-into-deck\|animate-letter-flight\|animate-word-card-assemble\|animate-pulse-glow" frontend/src --include=*.tsx
```

Expected: `RobotAnimation` chỉ xuất hiện ở `RobotAnimation.tsx`, `HomePage.tsx:243`, `DeckDetailPage.tsx:311`. Ba class kia xuất hiện ở `DeckCard.tsx`, `WordSearchGrid.tsx`, `DailyGamePanel.tsx`, `StatsPage.tsx` — **những class này phải được giữ lại**.

- [ ] **Step 2: Xóa UI AI khỏi HomePage**

Trong `frontend/src/pages/HomePage.tsx` xóa: import `generateAIBatchStream` và `RobotAnimation`; hằng `AI_ENABLED`; type `RobotAction`; interface `GlobalFlyingCardData`; component `FlyingGlassCard`; state `aiTopic`, `aiCount`, `isGenerating`, `globalFlyingCards`, `robotAction`, `actionTimeoutRef`; hàm `handleGenerateAICard`; khối JSX "Global Flying Cards Layer", `<RobotAnimation …/>` và toàn bộ khối "AI Generator Box" (từ `{/* AI Generator Box */}` đến hết `</div>` đóng của nó).

Giữ lại: `DailyCta`, hàng thống kê, header, nút nhập Anki / thư viện Anki / tạo bộ thẻ, modal tạo bộ thẻ, lưới bộ thẻ.

- [ ] **Step 3: Xóa UI AI khỏi DeckDetailPage**

Trong `frontend/src/pages/DeckDetailPage.tsx` xóa tương tự: import `RobotAnimation` và hàm gọi AI, hằng `AI_ENABLED`, state batch-generate (`isBatchGenerating`, `robotAction`, và state ô nhập chủ đề/số lượng của khối AI), `<RobotAnimation …/>` ở dòng 311, và khối JSX "Tạo lô thẻ AI cho chủ đề này".

- [ ] **Step 4: Xóa file component và CSS chết**

```bash
git rm frontend/src/components/RobotAnimation.tsx
```

Trong `frontend/src/index.css` xóa các keyframes: `aiEnter`, `aiExit`, `aiFloat`, `aiPop`, `aiBump`, `coinPop`, `aiShake`, `aiDot`, `holoFloat`, `holoRing`, `holoFlicker`, `scanlinesMove`, `glyphScan`, `glyphLineIn`, `waveBar`, `matrixStamp`, cùng các dòng comment tiêu đề của chúng (`/* ── AI Generation Animation …`, `/* ── Hologram Robot keyframes ── */`, `/* ── GlyphViz keyframes ── */`).

**Không** xóa: `flyIntoDeck`, `.animate-fly-into-deck`, `letterFlight`, `wordCardAssemble`, `pulse-glow`, `game-stage*`, `daily-status-*`, `app-recovery-*`, `shadowing-*`.

- [ ] **Step 5: Kiểm tra không còn tham chiếu**

```bash
grep -rn "AI_ENABLED\|RobotAnimation\|generateAIBatchStream\|holoFloat\|glyphScan\|matrixStamp" frontend/src
```

Expected: không có kết quả nào (`api/ai.ts` chỉ định nghĩa `generateAIBatchStream`, nên nếu nó hiện ra ở đúng file đó thì bỏ qua; mọi nơi gọi phải sạch).

- [ ] **Step 6: Build**

Run trong `frontend`: `npm run build`
Expected: xanh, không lỗi "unused import" hay "cannot find name".

- [ ] **Step 7: Commit**

```bash
git add -A frontend/src
git commit -m "refactor: drop dead AI generator UI and robot animation"
```

---

### Task 3: Backend `GET /api/daily/home`

**Files:**
- Create: `backend/tests/test_daily_home.py`
- Modify: `backend/app/schemas/daily.py`, `backend/app/services/daily.py`, `backend/app/routers/daily.py`

**Interfaces:**
- Consumes: `daily_service.count_remaining_new`, `daily_service.LOW_NEW_WORDS_THRESHOLD`, `_active_session`, `_close_stale_game_sessions`, `_live_words` (đã có trong `routers/daily.py`).
- Produces:
  - `app.schemas.daily.DailyHomeOut` và `app.schemas.daily.LatestArticleOut`.
  - `app.services.daily.home_counters(db, user_id) -> HomeCounters` với `HomeCounters` là dataclass có các trường `streak: int`, `mastered_cards: int`, `total_cards: int`, `deck_count: int`, `studied_today: bool`, `latest_article: LatestArticleData | None`; `LatestArticleData` là dataclass `(id: str, title: str, unlearned_saved_words: int)`.
  - Endpoint `GET /api/daily/home` trả `DailyHomeOut`.

- [ ] **Step 1: Viết test thất bại**

Create `backend/tests/test_daily_home.py`:

```python
from datetime import date, datetime, timedelta

from app.models.review import Review
from app.models.review_log import ReviewLog

WORDS = ["apple", "banana", "cherry", "dragon", "eagle", "falcon", "grape", "honey", "island", "jungle"]


def _deck_with_words(client, name="Home", words=WORDS):
    deck = client.post("/api/decks", json={"name": name}).json()
    for word in words:
        assert client.post(
            f"/api/decks/{deck['id']}/cards",
            json={"front_text": word, "back_text": f"nghĩa {word}"},
        ).status_code == 200
    return deck


def test_home_for_empty_user(client):
    res = client.get("/api/daily/home")
    assert res.status_code == 200
    body = res.json()
    assert body["total_cards"] == 0
    assert body["deck_count"] == 0
    assert body["mastered_cards"] == 0
    assert body["streak"] == 0
    assert body["studied_today"] is False
    assert body["latest_article"] is None
    assert body["session_status"] == "none"
    assert body["steps_total"] == 0
    assert body["steps_done"] == 0


def test_home_counts_cards_and_decks(client):
    _deck_with_words(client)
    body = client.get("/api/daily/home").json()
    assert body["total_cards"] == 10
    assert body["deck_count"] == 1


def test_home_reports_learning_session_progress(client):
    _deck_with_words(client)
    session = client.get("/api/daily/session").json()["session"]
    body = client.get("/api/daily/home").json()
    assert body["session_status"] == "learning"
    assert body["new_count"] == 10
    assert body["due_count"] == 0
    # 10 từ mới x 3 bước (flip, dictation, bước được chia) = 30
    assert body["steps_total"] == 30
    assert body["steps_done"] == 0

    word = session["words"][0]
    assert client.post(
        "/api/daily/answer",
        json={"card_id": word["card_id"], "step": "flip", "correct": True},
    ).status_code == 200
    assert client.get("/api/daily/home").json()["steps_done"] == 1


def test_home_matches_stats_for_streak_and_mastered(client, db):
    _deck_with_words(client)
    card_id = client.get("/api/daily/session").json()["session"]["words"][0]["card_id"]
    review = db.query(Review).filter_by(card_id=card_id).one()
    review.repetitions = 4
    db.add(ReviewLog(user_id=review.card.deck.user_id, card_id=card_id, quality=5,
                     rating_source="daily", reviewed_at=datetime.utcnow()))
    db.commit()

    home = client.get("/api/daily/home").json()
    stats = client.get("/api/review/stats").json()
    assert home["mastered_cards"] == stats["mastered_cards"] == 1
    assert home["streak"] == stats["streak"] == 1
    assert home["studied_today"] is True


def test_home_reports_latest_article_and_unlearned_saved_words(client, db):
    client.post("/api/articles", json={"title": "Bài cũ", "source_type": "paste",
                                      "content": "The engine will abandon the plan."})
    newer = client.post("/api/articles", json={"title": "Bài mới", "source_type": "paste",
                                               "content": "She will abandon the old plan today."}).json()
    assert client.post(f"/api/articles/{newer['id']}/cards",
                       json={"word": "abandon"}).status_code == 200

    latest = client.get("/api/daily/home").json()["latest_article"]
    assert latest["id"] == newer["id"]
    assert latest["title"] == "Bài mới"
    assert latest["unlearned_saved_words"] == 1
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run trong `backend`: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_daily_home.py -v`
Expected: FAIL — tất cả test lỗi `404 Not Found` vì `/api/daily/home` chưa có.

> Nếu `test_home_reports_latest_article_and_unlearned_saved_words` fail vì payload tạo bài đọc hoặc tạo thẻ từ bài đọc khác với giả định trên, hãy mở `backend/app/schemas/article.py` và `backend/app/routers/articles.py:103` + `:356` để lấy đúng tên field, rồi sửa test cho khớp API thật — **không** sửa API.

- [ ] **Step 3: Thêm schema**

Trong `backend/app/schemas/daily.py`, thêm vào cuối file:

```python
class LatestArticleOut(BaseModel):
    id: str; title: str; unlearned_saved_words: int


class DailyHomeOut(BaseModel):
    new_count: int; due_count: int; session_status: str
    steps_total: int; steps_done: int
    streak: int; studied_today: bool
    mastered_cards: int; total_cards: int; deck_count: int
    low_new_words: bool; new_remaining: int
    latest_article: LatestArticleOut | None
```

- [ ] **Step 4: Thêm hàm gom số liệu vào service**

Trong `backend/app/services/daily.py`, thêm import và hàm:

```python
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import func

from app.models.article import Article
from app.models.deck import Deck
from app.models.review import Review
from app.models.review_log import ReviewLog


@dataclass
class LatestArticleData:
    id: str
    title: str
    unlearned_saved_words: int


@dataclass
class HomeCounters:
    streak: int
    mastered_cards: int
    total_cards: int
    deck_count: int
    studied_today: bool
    latest_article: LatestArticleData | None


def home_counters(db: Session, user_id: str) -> HomeCounters:
    total_cards = (
        db.query(func.count(Card.id)).join(Deck, Card.deck_id == Deck.id)
        .filter(Deck.user_id == user_id).scalar() or 0
    )
    deck_count = db.query(func.count(Deck.id)).filter(Deck.user_id == user_id).scalar() or 0
    mastered_cards = (
        db.query(func.count(Review.id))
        .join(Card, Review.card_id == Card.id).join(Deck, Card.deck_id == Deck.id)
        .filter(Deck.user_id == user_id, Review.repetitions >= 3).scalar() or 0
    )

    today = date.today()
    since = datetime.combine(today - timedelta(days=400), datetime.min.time())
    day_rows = (
        db.query(func.date(ReviewLog.reviewed_at), func.count(ReviewLog.id))
        .filter(ReviewLog.user_id == user_id, ReviewLog.reviewed_at >= since)
        .group_by(func.date(ReviewLog.reviewed_at)).all()
    )
    counts_by_day = {str(day): int(count) for day, count in day_rows}
    streak, check = 0, today
    while counts_by_day.get(check.isoformat(), 0) > 0:
        streak += 1
        check -= timedelta(days=1)

    article = (
        db.query(Article).filter(Article.user_id == user_id)
        .order_by(Article.created_at.desc()).first()
    )
    latest = None
    if article is not None:
        unlearned = 0
        if article.deck_id:
            unlearned = (
                db.query(func.count(Card.id))
                .outerjoin(Review, Review.card_id == Card.id)
                .filter(Card.deck_id == article.deck_id,
                        (Review.id.is_(None)) | (Review.repetitions == 0))
                .scalar() or 0
            )
        latest = LatestArticleData(id=article.id, title=article.title,
                                  unlearned_saved_words=int(unlearned))

    return HomeCounters(
        streak=streak, mastered_cards=int(mastered_cards), total_cards=int(total_cards),
        deck_count=int(deck_count), studied_today=counts_by_day.get(today.isoformat(), 0) > 0,
        latest_article=latest,
    )
```

> `Card`, `Session` đã được import ở đầu `services/daily.py`; chỉ thêm những import còn thiếu, không nhân bản import sẵn có.

- [ ] **Step 5: Thêm endpoint**

Trong `backend/app/routers/daily.py`, thêm `DailyHomeOut, LatestArticleOut` vào khối import từ `app.schemas.daily`, rồi thêm endpoint ngay dưới `get_status`:

```python
@router.get("/home", response_model=DailyHomeOut)
def get_home(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _close_stale_game_sessions(db, user)
    db.commit()

    session = _active_session(db, user)
    if session is None:
        session = db.query(DailySession).filter(
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

    return DailyHomeOut(
        new_count=len(new_words), due_count=len(due_words),
        session_status=session.status if session else "none",
        steps_total=steps_total, steps_done=steps_done,
        streak=counters.streak, studied_today=counters.studied_today,
        mastered_cards=counters.mastered_cards, total_cards=counters.total_cards,
        deck_count=counters.deck_count,
        low_new_words=remaining <= daily_service.LOW_NEW_WORDS_THRESHOLD,
        new_remaining=remaining,
        latest_article=None if counters.latest_article is None else LatestArticleOut(
            id=counters.latest_article.id, title=counters.latest_article.title,
            unlearned_saved_words=counters.latest_article.unlearned_saved_words,
        ),
    )
```

> `steps_done` đọc `word.steps_done` — kiểm tra ở `backend/app/models/daily_session.py` xem cột này lưu JSON string (spec thiết kế phiên mô tả vậy). Nếu nó đã là list, bỏ `json.loads` và dùng `len(word.steps_done or [])`.

- [ ] **Step 6: Chạy test mới**

Run trong `backend`: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_daily_home.py -v`
Expected: 5 PASSED.

- [ ] **Step 7: Chạy toàn bộ test backend**

Run trong `backend`: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest -q`
Expected: toàn bộ xanh — đặc biệt `test_daily_flow.py`, `test_daily_services.py`, `test_review.py` không được đổi kết quả.

- [ ] **Step 8: Commit**

```bash
git add backend/app/schemas/daily.py backend/app/services/daily.py backend/app/routers/daily.py backend/tests/test_daily_home.py
git commit -m "feat(daily): add GET /api/daily/home aggregating home screen counters"
```

---

### Task 4: Kiểu và API client cho trang chủ

**Files:**
- Modify: `frontend/src/types/index.ts`, `frontend/src/api/daily.ts`

**Interfaces:**
- Consumes: `GET /api/daily/home` từ Task 3.
- Produces:
  - `type LatestArticle = { id: string; title: string; unlearned_saved_words: number }`
  - `type DailyHome = { new_count: number; due_count: number; session_status: 'none' | 'learning' | 'game' | 'done'; steps_total: number; steps_done: number; streak: number; studied_today: boolean; mastered_cards: number; total_cards: number; deck_count: number; low_new_words: boolean; new_remaining: number; latest_article: LatestArticle | null }`
  - `getDailyHome(): Promise<DailyHome>` trong `api/daily.ts`.

- [ ] **Step 1: Thêm kiểu**

Trong `frontend/src/types/index.ts`, thêm:

```ts
export interface LatestArticle {
  id: string
  title: string
  unlearned_saved_words: number
}

export interface DailyHome {
  new_count: number
  due_count: number
  session_status: 'none' | 'learning' | 'game' | 'done'
  steps_total: number
  steps_done: number
  streak: number
  studied_today: boolean
  mastered_cards: number
  total_cards: number
  deck_count: number
  low_new_words: boolean
  new_remaining: number
  latest_article: LatestArticle | null
}
```

- [ ] **Step 2: Thêm hàm gọi API**

Trong `frontend/src/api/daily.ts`, thêm (theo đúng kiểu axios client mà các hàm khác trong file đang dùng — mở file để copy đúng pattern `client.get(...).then(r => r.data)`):

```ts
export const getDailyHome = () => client.get<DailyHome>('/api/daily/home').then(response => response.data)
```

và bổ sung `DailyHome` vào khối `import type` từ `../types`.

- [ ] **Step 3: Build**

Run trong `frontend`: `npm run build`
Expected: xanh.

- [ ] **Step 4: Kiểm tra endpoint trả dữ liệu thật**

Với backend đang chạy và đã đăng nhập trong trình duyệt, chạy trong console:

```js
await (await fetch('/api/daily/home', {headers:{Authorization:'Bearer '+localStorage.getItem('token')}})).json()
```

Expected: object có đủ các khóa ở Step 1. Nếu 401, mở `frontend/src/api/client.ts` để lấy đúng tên khóa lưu token và dùng lại.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/api/daily.ts
git commit -m "feat: add DailyHome type and client for the home endpoint"
```

---

### Task 5: Tách `/library` và dựng lại điều hướng

**Files:**
- Create: `frontend/src/pages/LibraryPage.tsx`
- Modify: `frontend/src/App.tsx`, `frontend/src/components/Navbar.tsx`
- Delete: `frontend/src/pages/GamesPage.tsx`

**Interfaces:**
- Consumes: không có từ task trước.
- Produces: route `/library` render `LibraryPage`; `/games` chuyển hướng `/daily`; nav 4 mục + icon Tiến độ. Task 6 sẽ ghi đè `HomePage.tsx`.

- [ ] **Step 1: Tạo LibraryPage từ HomePage hiện tại**

```bash
git mv frontend/src/pages/HomePage.tsx frontend/src/pages/LibraryPage.tsx
```

Trong `LibraryPage.tsx`: đổi `export default function HomePage()` thành `export default function LibraryPage()`; đổi khóa cache `useCachedQuery` từ `home-v2:${user.id}` thành `library-v1:${user.id}`; xóa `<DailyCta />` và import của nó (trang chủ mới sẽ đảm nhiệm việc đó); đổi tiêu đề `<h1>` thành `Thư viện của bạn`.

- [ ] **Step 2: Cập nhật route**

Trong `frontend/src/App.tsx`: xóa dòng `const GamesPage = lazy(...)`, thêm `const LibraryPage = lazy(() => import('./pages/LibraryPage'))`, và đổi khối `<Routes>` thành:

```tsx
<Route path="/login" element={<AuthPage mode="login" />} />
<Route path="/register" element={<AuthPage mode="register" />} />
<Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
<Route path="/library" element={<RequireAuth><LibraryPage /></RequireAuth>} />
<Route path="/decks/:id" element={<RequireAuth><DeckDetailPage /></RequireAuth>} />
<Route path="/daily" element={<RequireAuth><DailyPage /></RequireAuth>} />
<Route path="/stats" element={<RequireAuth><StatsPage /></RequireAuth>} />
<Route path="/reader" element={<RequireAuth><ReaderListPage /></RequireAuth>} />
<Route path="/reader/:id" element={<RequireAuth><ReaderPage /></RequireAuth>} />
<Route path="/games" element={<Navigate to="/daily" replace />} />
<Route path="/shadowing" element={<RequireAuth><ShadowingPage /></RequireAuth>} />
<Route path="/account" element={<RequireAuth><AccountPage /></RequireAuth>} />
<Route path="*" element={<Navigate to="/" replace />} />
```

`HomePage` vẫn được import như cũ — Task 6 tạo lại file này.

- [ ] **Step 3: Tạo HomePage tạm để build không vỡ**

Create `frontend/src/pages/HomePage.tsx`:

```tsx
export default function HomePage() {
  return <div className="mx-auto max-w-5xl px-4 py-10 text-body">Trang học — đang dựng ở Task 6.</div>
}
```

- [ ] **Step 4: Cập nhật nav**

Trong `frontend/src/components/Navbar.tsx`, đổi `NAV_ITEMS` thành:

```ts
const NAV_ITEMS = [
  { to: '/', label: 'Học hôm nay', icon: 'review', soon: false },
  { to: '/reader', label: 'Đọc', icon: 'book', soon: false },
  { to: '/shadowing', label: 'Nói', icon: 'mic', soon: false },
  { to: '/library', label: 'Thư viện', icon: 'deck', soon: false },
] as const
```

Trong `isRouteActive`, đổi nhánh `/` để bộ thẻ không còn làm sáng mục "Học hôm nay":

```ts
function isRouteActive(pathname: string, to: string) {
  if (to === '/') return pathname === '/'
  if (to === '/library') return pathname === '/library' || pathname.startsWith('/decks')
  return pathname === to || pathname.startsWith(`${to}/`)
}
```

Thêm `'chart'` vào union `NavIconName`, thêm nhánh icon:

```tsx
case 'chart':
  return <svg {...common}><path d="M4.5 19.5h15" /><path d="M7 16.5v-5M12 16.5v-9M17 16.5v-3" /></svg>
```

và thêm link Tiến độ vào nhóm bên phải, ngay trước link `/account`:

```tsx
<Link
  to="/stats"
  title="Tiến độ"
  className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-bold transition ${
    pathname === '/stats'
      ? 'border-cyan-300/35 bg-cyan-300/12 text-cyan-100'
      : 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/18 hover:bg-white/[0.07] hover:text-white'
  }`}
>
  <NavIcon name="chart" className="h-4 w-4" />
  <span className="hidden lg:inline">Tiến độ</span>
</Link>
```

Đổi `grid-cols-3` của khối nav items thành `grid-cols-4` (giờ có 4 mục).

- [ ] **Step 5: Xóa GamesPage**

```bash
git rm frontend/src/pages/GamesPage.tsx
```

- [ ] **Step 6: Build**

Run trong `frontend`: `npm run build`
Expected: xanh, không còn tham chiếu `GamesPage`.

- [ ] **Step 7: Kiểm tra trong trình duyệt**

Mở app, đăng nhập, và xác nhận: nav có đúng 4 mục + nút Tiến độ; `/library` hiện lưới bộ thẻ và nút nhập Anki; mở `/games` bị đẩy sang `/daily`; bấm một bộ thẻ vào `/decks/:id` thì mục "Thư viện" sáng chứ không phải "Học hôm nay". Chụp lại nav ở khổ desktop và mobile.

- [ ] **Step 8: Commit**

```bash
git add -A frontend/src
git commit -m "refactor: move deck management to /library and rebuild navigation"
```

---

### Task 6: Trang chủ = buổi học hôm nay

**Files:**
- Modify: `frontend/src/pages/HomePage.tsx` (viết lại hoàn toàn)
- Create: `frontend/src/components/home/HomeHero.tsx`, `frontend/src/components/home/HomeSideTiles.tsx`, `frontend/src/components/home/HomeBanner.tsx`, `frontend/src/components/home/HomeEmptyGuide.tsx`, `frontend/src/components/ProgressRing.tsx`
- Delete: `frontend/src/components/daily/DailyCta.tsx`

**Interfaces:**
- Consumes: `getDailyHome`, `DailyHome`, `LatestArticle` (Task 4); `getWorkerHealth` từ `frontend/src/api/shadowingWorker.ts`.
- Produces:
  - `ProgressRing({ percent, label, sub }: { percent: number; label: string; sub?: string })`
  - `HomeHero({ home }: { home: DailyHome })`
  - `HomeSideTiles({ article, workerOnline }: { article: LatestArticle | null; workerOnline: boolean | null })` — `null` nghĩa là đang dò.
  - `HomeBanner({ home }: { home: DailyHome })` — trả `null` khi không có banner nào cần hiện.
  - `HomeEmptyGuide()`

- [ ] **Step 1: Vòng tiến độ**

Create `frontend/src/components/ProgressRing.tsx`:

```tsx
interface Props { percent: number; label: string; sub?: string }

export default function ProgressRing({ percent, label, sub }: Props) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)))
  const radius = 34
  const circumference = 2 * Math.PI * radius
  return (
    <div className="relative h-24 w-24 shrink-0" role="img" aria-label={`Tiến độ ${clamped}%`}>
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={radius} fill="none" stroke="var(--color-accent-2)" strokeWidth="6"
          strokeLinecap="round" strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          style={{ transition: 'stroke-dashoffset var(--dur-slow) ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-black text-strong-text">{label}</span>
        {sub && <span className="text-[10px] font-semibold text-muted">{sub}</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Hero**

Create `frontend/src/components/home/HomeHero.tsx`:

```tsx
import { Link } from 'react-router-dom'
import ProgressRing from '../ProgressRing'
import type { DailyHome } from '../../types'

const CTA_LABEL: Record<DailyHome['session_status'], string> = {
  none: 'Bắt đầu buổi học',
  learning: 'Học tiếp',
  game: 'Vào phần chơi',
  done: 'Đã xong hôm nay',
}

export function estimateMinutes(newCount: number, dueCount: number) {
  const seconds = newCount * 60 + dueCount * 20
  return Math.max(5, Math.ceil(seconds / 60 / 5) * 5)
}

export default function HomeHero({ home }: { home: DailyHome }) {
  const total = home.new_count + home.due_count
  const percent = home.steps_total === 0 ? 0 : (home.steps_done / home.steps_total) * 100
  const done = home.session_status === 'done'

  return (
    <section className="rounded-[1.5rem] border border-subtle bg-surface-1 p-5 sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <ProgressRing percent={done ? 100 : percent} label={`${done ? 100 : Math.round(percent)}%`} sub="hôm nay" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-black tracking-tight text-strong-text sm:text-2xl">
            {done ? 'Hôm nay bạn đã học xong' : `Hôm nay có ${total} từ chờ bạn`}
          </h1>
          <p className="mt-1.5 text-sm font-medium text-muted">
            {home.new_count} từ mới · {home.due_count} từ ôn · ~{estimateMinutes(home.new_count, home.due_count)} phút
            {home.streak > 0 && ` · chuỗi ${home.streak} ngày`}
          </p>
          <Link
            to="/daily"
            aria-disabled={done}
            className={`mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl px-6 text-sm font-bold transition ${
              done
                ? 'pointer-events-none border border-subtle bg-surface-2 text-muted'
                : 'bg-accent text-white hover:brightness-110'
            }`}
          >
            {CTA_LABEL[home.session_status]}
          </Link>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Hai ô phụ**

Create `frontend/src/components/home/HomeSideTiles.tsx`:

```tsx
import { Link } from 'react-router-dom'
import type { LatestArticle } from '../../types'

interface Props { article: LatestArticle | null; workerOnline: boolean | null }

export default function HomeSideTiles({ article, workerOnline }: Props) {
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <Link
        to={article ? `/reader/${article.id}` : '/reader'}
        className="rounded-2xl border border-subtle bg-surface-1 p-4 transition hover:bg-surface-2"
      >
        <p className="text-xs font-black uppercase tracking-wider text-muted">Đang đọc</p>
        <p className="mt-1 truncate text-sm font-bold text-strong-text">{article ? article.title : 'Chưa có bài đọc'}</p>
        <p className="mt-0.5 text-xs font-medium text-muted">
          {article
            ? article.unlearned_saved_words > 0
              ? `${article.unlearned_saved_words} từ đã lưu chưa học`
              : 'Đã học hết từ đã lưu — đọc tiếp để lưu thêm'
            : 'Chọn một bài để bắt đầu lưu từ'}
        </p>
      </Link>

      {workerOnline ? (
        <Link to="/shadowing" className="rounded-2xl border border-subtle bg-surface-1 p-4 transition hover:bg-surface-2">
          <p className="text-xs font-black uppercase tracking-wider text-muted">Luyện nói</p>
          <p className="mt-1 text-sm font-bold text-strong-text">Máy chấm đang bật</p>
          <p className="mt-0.5 text-xs font-medium text-muted">Nghe câu, nói lại và được chấm điểm từng từ</p>
        </Link>
      ) : (
        <div aria-disabled className="rounded-2xl border border-subtle bg-surface-1 p-4 opacity-60">
          <p className="text-xs font-black uppercase tracking-wider text-muted">Luyện nói</p>
          <p className="mt-1 text-sm font-bold text-body">
            {workerOnline === null ? 'Đang kiểm tra máy chấm…' : 'Máy chấm đang tắt'}
          </p>
          <p className="mt-0.5 text-xs font-medium text-muted">Bật máy host để chấm điểm phát âm</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Banner và màn rỗng**

Create `frontend/src/components/home/HomeBanner.tsx`:

```tsx
import { Link } from 'react-router-dom'
import type { DailyHome } from '../../types'

export default function HomeBanner({ home }: { home: DailyHome }) {
  if (home.streak > 0 && !home.studied_today) {
    return (
      <div className="mb-4 rounded-2xl border border-warn/30 bg-warn/10 px-4 py-3 text-sm font-bold text-warn">
        Sắp mất chuỗi {home.streak} ngày — học hôm nay để giữ chuỗi.
      </div>
    )
  }
  if (home.low_new_words) {
    return (
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-warn/30 bg-warn/10 px-4 py-3">
        <p className="text-sm font-bold text-warn">Sắp hết từ mới (còn {home.new_remaining}).</p>
        <Link to="/reader" className="text-sm font-bold text-accent-2 underline">Đọc bài để lưu thêm từ</Link>
      </div>
    )
  }
  return null
}
```

Create `frontend/src/components/home/HomeEmptyGuide.tsx`:

```tsx
import { Link } from 'react-router-dom'

const STEPS = [
  ['1', 'Chọn một bài đọc', 'Dán đoạn văn, một đường link hoặc tải PDF lên.'],
  ['2', 'Bấm vào từ chưa biết', 'Xem nghĩa, phát âm và lưu từ đó thành thẻ.'],
  ['3', 'Quay lại đây để học', 'Mỗi ngày app sẽ chọn sẵn từ mới và từ cần ôn cho bạn.'],
] as const

export default function HomeEmptyGuide() {
  return (
    <section className="rounded-[1.5rem] border border-subtle bg-surface-1 p-6 sm:p-8">
      <h1 className="text-xl font-black tracking-tight text-strong-text sm:text-2xl">Bắt đầu từ một bài đọc</h1>
      <p className="mt-1.5 text-sm font-medium text-muted">
        Thẻ học của bạn được tạo từ những từ bạn lưu khi đọc, nên bước đầu tiên là chọn một bài.
      </p>
      <ol className="mt-5 grid gap-3 sm:grid-cols-3">
        {STEPS.map(([index, title, detail]) => (
          <li key={index} className="rounded-2xl border border-subtle bg-surface-2 p-4">
            <span className="inline-grid h-6 w-6 place-items-center rounded-full bg-accent/25 text-xs font-black text-strong-text">
              {index}
            </span>
            <p className="mt-2 text-sm font-bold text-strong-text">{title}</p>
            <p className="mt-1 text-xs font-medium text-muted">{detail}</p>
          </li>
        ))}
      </ol>
      <Link to="/reader" className="mt-6 inline-flex min-h-[44px] items-center rounded-xl bg-accent px-6 text-sm font-bold text-white transition hover:brightness-110">
        Chọn bài đọc
      </Link>
    </section>
  )
}
```

- [ ] **Step 5: Ghép trang chủ**

Overwrite `frontend/src/pages/HomePage.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDailyHome } from '../api/daily'
import { getWorkerHealth } from '../api/shadowingWorker'
import { useAuth } from '../auth/AuthContext'
import { useCachedQuery } from '../hooks/useCachedQuery'
import HomeBanner from '../components/home/HomeBanner'
import HomeEmptyGuide from '../components/home/HomeEmptyGuide'
import HomeHero from '../components/home/HomeHero'
import HomeSideTiles from '../components/home/HomeSideTiles'

export default function HomePage() {
  const { user } = useAuth()
  const homeQuery = useCachedQuery(user ? `daily-home:${user.id}` : null, getDailyHome)
  const home = homeQuery.data
  const [workerOnline, setWorkerOnline] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    getWorkerHealth()
      .then(health => { if (alive) setWorkerOnline(health.model_loaded) })
      .catch(() => { if (alive) setWorkerOnline(false) })
    return () => { alive = false }
  }, [])

  if (homeQuery.loading && !home) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="h-44 animate-pulse rounded-[1.5rem] border border-subtle bg-surface-1" />
      </div>
    )
  }

  if (!home) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 text-sm font-medium text-muted sm:px-6">
        Không tải được dữ liệu hôm nay.{' '}
        <button onClick={() => void homeQuery.refresh()} className="font-bold text-accent-2 underline">Thử lại</button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      <HomeBanner home={home} />
      {home.total_cards === 0 ? <HomeEmptyGuide /> : (
        <>
          <HomeHero home={home} />
          <HomeSideTiles article={home.latest_article} workerOnline={workerOnline} />
          <p className="mt-5 text-xs font-medium text-muted">
            Đã thuộc {home.mastered_cards}/{home.total_cards} từ · {home.deck_count} bộ thẻ ·{' '}
            <Link to="/library" className="font-bold text-accent-2 underline">quản lý bộ thẻ</Link>
          </p>
        </>
      )}
    </div>
  )
}
```

> Mở `frontend/src/hooks/useCachedQuery.ts` trước khi viết để dùng đúng tên trường nó trả về (`data`, `loading`, `refresh`). Nếu tên khác, sửa theo file thật.

- [ ] **Step 6: Xóa DailyCta**

`DailyCta` đã bị bỏ khỏi `LibraryPage` ở Task 5; giờ xóa file và nơi dùng còn lại trong `DailyPage.tsx` (khối `phase === 'done'`) bằng cách bỏ import và thẻ `<DailyCta />` ở đó.

```bash
git rm frontend/src/components/daily/DailyCta.tsx
grep -rn "DailyCta" frontend/src
```

Expected: lệnh grep không trả kết quả.

- [ ] **Step 7: Build**

Run trong `frontend`: `npm run build`
Expected: xanh.

- [ ] **Step 8: Kiểm tra trong trình duyệt**

Mở `/` và xác nhận: hero hiện đúng số từ mới/từ ôn và % tiến độ; nút CTA sang `/daily`; ô "Đang đọc" trỏ đúng bài mới nhất; ô "Luyện nói" hiện "Máy chấm đang tắt" khi worker không chạy và không bấm được; chân trang hiện "Đã thuộc X/Y". Sau đó thử màn rỗng bằng cách đăng ký một tài khoản mới và xác nhận hiện `HomeEmptyGuide` với nút "Chọn bài đọc". Chụp cả hai trạng thái ở desktop và mobile.

- [ ] **Step 9: Commit**

```bash
git add -A frontend/src
git commit -m "feat: make the home page the daily study session"
```

---

### Task 7: Tách `DailyPage` thành hook và các bước

**Files:**
- Create: `frontend/src/hooks/useDailySession.ts`, `frontend/src/components/daily/steps/ReviewStep.tsx`, `frontend/src/components/daily/steps/FlipStep.tsx`, `frontend/src/components/daily/steps/DictationStep.tsx`, `frontend/src/components/daily/steps/SplitStep.tsx`
- Modify: `frontend/src/pages/DailyPage.tsx`

**Interfaces:**
- Consumes: `getDailySession`, `postDailyAnswer`, `completeLearning` (`api/daily.ts`); `DailySession`, `DailyWord` (`types`).
- Produces:
  - `useDailySession()` trả về object:
    `{ loading: boolean; session: DailySession | null; phase: Phase; queues: { review: DailyWord[]; flip: DailyWord[]; dictation: DailyWord[]; left: DailyWord[]; right: DailyWord[] }; presented: number; stepsDone: number; stepsTotal: number; startedAt: number; answer(queueName: QueueName, step: string, correct: boolean): void; beginNew(): void; finishLearning(): void; setPhase(phase: Phase): void }`
  - `type Phase = 'review' | 'flip' | 'dictation' | 'split' | 'game' | 'done' | 'empty'`
  - `type QueueName = 'review' | 'flip' | 'dictation' | 'left' | 'right'`
  - Bốn component bước, mỗi cái nhận `{ daily }: { daily: ReturnType<typeof useDailySession> }`.

**Yêu cầu bắt buộc:** đây là tách cấu trúc. Thứ tự giai đoạn, luật đẩy từ trả lời sai xuống cuối hàng đợi, `assigned_step`, và mọi lời gọi API phải **giữ nguyên hành vi** như `DailyPage.tsx` hiện tại.

- [ ] **Step 1: Đọc và ghi lại hành vi hiện tại**

Mở `frontend/src/pages/DailyPage.tsx` và viết ra (trong đầu hoặc nháp) đúng 6 hành vi: (a) nạp phiên và phân 5 hàng đợi theo `is_new` + `assigned_step` + `steps_done`; (b) `status !== 'learning'` thì `phase` là `game` hoặc `done`; (c) `session` null thì `phase = 'empty'`; (d) trả lời đúng thì bỏ từ khỏi hàng, sai thì đẩy xuống cuối; (e) hàng đợi rỗng và có `next` thì chuyển giai đoạn; (f) `split` xong cả hai bên thì tự gọi `completeLearning`. Bản tách phải giữ đúng cả 6.

- [ ] **Step 2: Viết hook**

Create `frontend/src/hooks/useDailySession.ts`:

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { completeLearning, getDailySession, postDailyAnswer } from '../api/daily'
import { useNotification } from '../components/NotificationProvider'
import type { DailySession, DailyWord } from '../types'

export type Phase = 'review' | 'flip' | 'dictation' | 'split' | 'game' | 'done' | 'empty'
export type QueueName = 'review' | 'flip' | 'dictation' | 'left' | 'right'

type Queues = Record<QueueName, DailyWord[]>

const pending = (word: DailyWord, step: string) => !word.steps_done.includes(step)
const EMPTY_QUEUES: Queues = { review: [], flip: [], dictation: [], left: [], right: [] }

export function useDailySession() {
  const { toast } = useNotification()
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<DailySession | null>(null)
  const [phase, setPhase] = useState<Phase>('review')
  const [queues, setQueues] = useState<Queues>(EMPTY_QUEUES)
  const [presented, setPresented] = useState(0)
  const startedAt = useRef(Date.now())

  useEffect(() => {
    getDailySession()
      .then(loaded => {
        setSession(loaded)
        if (!loaded) { setPhase('empty'); return }
        if (loaded.status !== 'learning') { setPhase(loaded.status === 'game' ? 'game' : 'done'); return }
        setQueues({
          review: loaded.words.filter(word => !word.is_new && pending(word, word.assigned_step)),
          flip: loaded.words.filter(word => word.is_new && pending(word, 'flip')),
          dictation: loaded.words.filter(word => word.is_new && pending(word, 'dictation')),
          left: loaded.words.filter(word => word.is_new && word.assigned_step === 'vi_en' && pending(word, 'vi_en')),
          right: loaded.words.filter(word => word.is_new && word.assigned_step === 'en_vi' && pending(word, 'en_vi')),
        })
        setPhase(loaded.phase as Phase)
      })
      .catch(() => toast('Không tải được phiên học hôm nay', 'error'))
      .finally(() => setLoading(false))
  }, [toast])

  const finishLearning = useCallback(() => {
    void completeLearning()
      .then(() => setPhase('game'))
      .catch(() => toast('Không hoàn tất được phần học', 'error'))
  }, [toast])

  const nextPhaseAfter = (name: QueueName): Phase | null =>
    name === 'flip' ? 'dictation' : name === 'dictation' ? 'split' : null

  const answer = useCallback((name: QueueName, step: string, correct: boolean) => {
    const queue = queues[name]
    const [word, ...rest] = queue
    if (!word) return
    void postDailyAnswer(word.card_id, step, correct)
      .then(() => {
        const following = correct ? rest : [...rest, word]
        setQueues(current => ({ ...current, [name]: following }))
        setPresented(value => value + 1)
        const next = nextPhaseAfter(name)
        if (!following.length && next) setPhase(next)
      })
      .catch(() => toast('Không lưu được câu trả lời', 'error'))
  }, [queues, toast])

  const splitDone = queues.left.length === 0 && queues.right.length === 0
  useEffect(() => {
    if (phase === 'split' && splitDone && session) finishLearning()
  }, [phase, splitDone, session, finishLearning])

  const beginNew = useCallback(() => {
    if (queues.flip.length) setPhase('flip')
    else if (queues.dictation.length) setPhase('dictation')
    else if (!splitDone) setPhase('split')
    else finishLearning()
  }, [queues.flip.length, queues.dictation.length, splitDone, finishLearning])

  const { stepsDone, stepsTotal } = useMemo(() => {
    const words = session?.words ?? []
    const total = words.reduce((sum, word) => sum + (word.is_new ? 3 : 1), 0)
    const done = words.reduce((sum, word) => sum + word.steps_done.length, 0)
    return { stepsDone: Math.min(done + presented, total), stepsTotal: total }
  }, [session, presented])

  return { loading, session, phase, queues, presented, stepsDone, stepsTotal,
           startedAt: startedAt.current, answer, beginNew, finishLearning, setPhase }
}
```

> `stepsDone` cộng thêm `presented` vì `session.words` không được tải lại sau mỗi câu; `Math.min` chặn không cho vượt tổng khi một từ bị trả lời sai nhiều lần.

- [ ] **Step 3: Viết bốn component bước**

Create `frontend/src/components/daily/steps/ReviewStep.tsx`:

```tsx
import ExerciseCard from '../ExerciseCard'
import type { useDailySession } from '../../../hooks/useDailySession'
import type { ExerciseStep } from '../../../types'

export default function ReviewStep({ daily }: { daily: ReturnType<typeof useDailySession> }) {
  const queue = daily.queues.review
  if (!queue.length) {
    return (
      <div className="text-center">
        <p className="mb-4 text-sm font-bold text-correct">Xong phần ôn tập — tiếp theo là từ mới.</p>
        <button onClick={daily.beginNew} className="min-h-[44px] rounded-xl bg-accent px-6 text-sm font-bold text-white">
          Tiếp tục
        </button>
      </div>
    )
  }
  const word = queue[0]
  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-3 text-sm font-medium text-muted">Ôn tập · còn {queue.length} từ</p>
      <ExerciseCard
        key={`${word.card_id}-${daily.presented}`}
        card={word.card}
        mode={word.assigned_step as ExerciseStep}
        onResult={correct => daily.answer('review', word.assigned_step, correct)}
      />
    </div>
  )
}
```

Create `frontend/src/components/daily/steps/FlipStep.tsx`:

```tsx
import FlipCard from '../../FlipCard'
import type { useDailySession } from '../../../hooks/useDailySession'

export default function FlipStep({ daily }: { daily: ReturnType<typeof useDailySession> }) {
  const queue = daily.queues.flip
  if (!queue.length) return null
  const word = queue[0]
  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-3 text-sm font-medium text-muted">Lật thẻ &amp; nghe · còn {queue.length} từ</p>
      <FlipCard
        key={word.card_id}
        card={word.card}
        isPractice
        onRate={() => undefined}
        onNext={() => daily.answer('flip', 'flip', true)}
      />
    </div>
  )
}
```

Create `frontend/src/components/daily/steps/DictationStep.tsx`:

```tsx
import ExerciseCard from '../ExerciseCard'
import type { useDailySession } from '../../../hooks/useDailySession'

export default function DictationStep({ daily }: { daily: ReturnType<typeof useDailySession> }) {
  const queue = daily.queues.dictation
  if (!queue.length) return null
  const word = queue[0]
  return (
    <div className="mx-auto max-w-2xl">
      <p className="mb-3 text-sm font-medium text-muted">Nghe &amp; điền · còn {queue.length} từ</p>
      <ExerciseCard
        key={`${word.card_id}-${daily.presented}`}
        card={word.card}
        mode="dictation"
        onResult={correct => daily.answer('dictation', 'dictation', correct)}
      />
    </div>
  )
}
```

Create `frontend/src/components/daily/steps/SplitStep.tsx`:

```tsx
import ExerciseCard from '../ExerciseCard'
import type { useDailySession, QueueName } from '../../../hooks/useDailySession'
import type { ExerciseStep } from '../../../types'

const SIDES: { name: QueueName; step: ExerciseStep; label: string }[] = [
  { name: 'left', step: 'vi_en', label: 'Việt → Anh' },
  { name: 'right', step: 'en_vi', label: 'Anh → Việt' },
]

export default function SplitStep({ daily }: { daily: ReturnType<typeof useDailySession> }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {SIDES.map(({ name, step, label }) => {
        const queue = daily.queues[name]
        return (
          <div key={name} className={queue.length === 0 ? 'hidden md:block' : undefined}>
            <p className="mb-2 text-center text-xs font-black uppercase tracking-wider text-muted">
              {label} · còn {queue.length}
            </p>
            {queue.length ? (
              <ExerciseCard
                key={`${queue[0].card_id}-${daily.presented}`}
                card={queue[0].card}
                mode={step}
                onResult={correct => daily.answer(name, step, correct)}
              />
            ) : (
              <p className="text-center text-sm font-bold text-correct">Xong bên này</p>
            )}
          </div>
        )
      })}
    </div>
  )
}
```

> `hidden md:block` là phần mobile của spec: dưới `md` chỉ hiện panel còn từ chờ.

- [ ] **Step 4: Rút gọn DailyPage**

Overwrite `frontend/src/pages/DailyPage.tsx`:

```tsx
import { Link } from 'react-router-dom'
import DailyGamePanel from '../components/daily/DailyGamePanel'
import DailyStatusHero from '../components/daily/DailyStatusHero'
import DictationStep from '../components/daily/steps/DictationStep'
import FlipStep from '../components/daily/steps/FlipStep'
import ReviewStep from '../components/daily/steps/ReviewStep'
import SplitStep from '../components/daily/steps/SplitStep'
import { useDailySession } from '../hooks/useDailySession'

export default function DailyPage() {
  const daily = useDailySession()

  if (daily.loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    )
  }

  if (daily.phase === 'empty') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <DailyStatusHero kind="empty" primaryTo="/reader" primaryLabel="Đọc bài để lưu thêm từ" secondaryTo="/" secondaryLabel="Về trang chủ" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[90rem] px-4 py-8">
      {daily.phase === 'review' && <ReviewStep daily={daily} />}
      {daily.phase === 'flip' && <FlipStep daily={daily} />}
      {daily.phase === 'dictation' && <DictationStep daily={daily} />}
      {daily.phase === 'split' && <SplitStep daily={daily} />}
      {daily.phase === 'game' && <DailyGamePanel />}
      {daily.phase === 'done' && (
        <div className="mx-auto max-w-4xl">
          <DailyStatusHero kind="complete" primaryTo="/" primaryLabel="Về trang chủ" secondaryTo="/reader" secondaryLabel="Đọc bài" />
          <Link to="/" className="mt-5 inline-block text-sm font-bold text-accent-2 underline">Về trang chủ</Link>
        </div>
      )}
    </div>
  )
}
```

> Thanh tiến độ và màn tổng kết được thêm ở Task 9 và Task 10; task này chỉ tách cấu trúc.

- [ ] **Step 5: Build**

Run trong `frontend`: `npm run build`
Expected: xanh.

- [ ] **Step 6: Kiểm tra hành vi không đổi**

Chạy app và đi hết một phiên: giai đoạn ôn tập → lật thẻ → nghe & điền → chia đôi → game. Kiểm riêng hai điều: trả lời **sai** một từ thì từ đó quay lại cuối hàng đợi và số "còn N từ" không giảm; thoát giữa chừng rồi vào lại `/daily` thì tiếp đúng chỗ dở với cùng dạng bài.

- [ ] **Step 7: Chạy test backend**

Run trong `backend`: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest -q`
Expected: xanh (task này không đụng backend, chạy để chắc chắn không có gì lệch).

- [ ] **Step 8: Commit**

```bash
git add -A frontend/src
git commit -m "refactor(daily): split DailyPage into a session hook and step components"
```

---

### Task 8: Phản hồi tức thì trong `ExerciseCard`

**Files:**
- Create: `frontend/src/utils/feedbackSound.ts`
- Modify: `frontend/src/components/daily/ExerciseCard.tsx`, `frontend/src/index.css`

**Interfaces:**
- Consumes: `ExerciseCard` props hiện có `{ card: Card; mode: ExerciseStep; onResult: (correct: boolean) => void }`.
- Produces:
  - `playFeedback(kind: 'correct' | 'wrong'): void`
  - `isSoundOn(): boolean`, `setSoundOn(value: boolean): void` (lưu `localStorage` khóa `flashie:sound`, mặc định bật)
  - `ExerciseCard` nhận thêm prop tùy chọn `onCorrectStreak?: (streak: number) => void` để Task 9 hiển thị combo.

- [ ] **Step 1: Tiện ích âm thanh**

Create `frontend/src/utils/feedbackSound.ts`:

```ts
const STORAGE_KEY = 'flashie:sound'
let context: AudioContext | null = null

export function isSoundOn() {
  return localStorage.getItem(STORAGE_KEY) !== 'off'
}

export function setSoundOn(value: boolean) {
  localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off')
}

/** Hai tiếng ngắn tạo bằng WebAudio — không cần thêm file media vào bundle. */
export function playFeedback(kind: 'correct' | 'wrong') {
  if (!isSoundOn()) return
  try {
    context = context ?? new AudioContext()
    if (context.state === 'suspended') void context.resume()
    const now = context.currentTime
    const gain = context.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.09, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
    gain.connect(context.destination)

    const osc = context.createOscillator()
    osc.type = kind === 'correct' ? 'sine' : 'triangle'
    osc.frequency.setValueAtTime(kind === 'correct' ? 660 : 300, now)
    osc.frequency.linearRampToValueAtTime(kind === 'correct' ? 990 : 200, now + 0.16)
    osc.connect(gain)
    osc.start(now)
    osc.stop(now + 0.2)
  } catch {
    // Trình duyệt chặn AudioContext trước tương tác đầu tiên — bỏ qua, không làm vỡ bài học.
  }
}
```

- [ ] **Step 2: Keyframe rung**

Thêm vào cuối `frontend/src/index.css` (trước khối `prefers-reduced-motion`):

```css
@keyframes answerShake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-6px); }
  50% { transform: translateX(6px); }
  75% { transform: translateX(-3px); }
}

.animate-answer-shake { animation: answerShake 260ms ease both; }
```

Và thêm `.animate-answer-shake` vào danh sách selector trong khối `@media (prefers-reduced-motion: reduce)` đã có.

- [ ] **Step 3: Thêm trạng thái đúng vào ExerciseCard**

Overwrite `frontend/src/components/daily/ExerciseCard.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import type { Card, ExerciseStep } from '../../types'
import { playCardAudio } from '../../utils/audio'
import { playFeedback } from '../../utils/feedbackSound'

interface Props {
  card: Card
  mode: ExerciseStep
  onResult: (correct: boolean) => void
  onCorrectStreak?: (streak: number) => void
}

const normalizeEn = (value: string) => value.trim().toLowerCase().replace(/[.,!?;:()[\]{}"']/g, '').replace(/\s+/g, ' ')
const normalizeVi = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')
const prompts: Record<ExerciseStep, string> = {
  dictation: 'Nghe và gõ lại từ',
  vi_en: 'Việt → Anh · gõ từ tiếng Anh',
  en_vi: 'Anh → Việt · gõ nghĩa tiếng Việt',
}

const CORRECT_HOLD_MS = 700

export default function ExerciseCard({ card, mode, onResult, onCorrectStreak }: Props) {
  const [typed, setTyped] = useState('')
  const [state, setState] = useState<'answering' | 'correct' | 'wrong' | 'self_confirm'>('answering')
  const streak = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setTyped(''); setState('answering')
    if (mode === 'dictation') playCardAudio(card)
    return () => {
      window.speechSynthesis.cancel()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [card.id, mode])

  const succeed = () => {
    streak.current += 1
    onCorrectStreak?.(streak.current)
    playFeedback('correct')
    setState('correct')
    timer.current = setTimeout(() => onResult(true), CORRECT_HOLD_MS)
  }

  const fail = (next: 'wrong' | 'self_confirm') => {
    streak.current = 0
    onCorrectStreak?.(0)
    playFeedback('wrong')
    setState(next)
  }

  const check = () => {
    if (mode === 'en_vi') {
      const answer = normalizeVi(typed)
      const expected = normalizeVi(card.back_text)
      if (answer.length >= 2 && (expected.includes(answer) || answer.includes(expected))) succeed()
      else fail('self_confirm')
    } else if (normalizeEn(typed) === normalizeEn(card.front_text)) succeed()
    else fail('wrong')
  }

  const answer = mode === 'en_vi' ? card.back_text : card.front_text
  const frame =
    state === 'correct' ? 'border-correct/60 bg-correct/10'
    : state === 'wrong' ? 'border-wrong/60 bg-wrong/10 animate-answer-shake'
    : 'border-subtle bg-surface-1'

  return (
    <div className={`rounded-2xl border p-5 transition-colors ${frame}`}>
      <p className="mb-3 text-xs font-black uppercase tracking-wider text-muted">{prompts[mode]}</p>

      {mode === 'dictation' && (
        <button onClick={() => playCardAudio(card)} className="mb-4 min-h-[44px] rounded-xl border border-subtle bg-surface-2 px-4 text-sm font-bold text-accent-2">
          Nghe lại
        </button>
      )}
      {mode === 'vi_en' && <p className="mb-4 rounded-xl bg-black/25 p-3 text-body">{card.back_text}</p>}
      {mode === 'en_vi' && (
        <p className="mb-4 flex items-center gap-3 rounded-xl bg-black/25 p-3 text-body">
          <b className="text-strong-text">{card.front_text}</b>
          <button onClick={() => playCardAudio(card)} className="text-accent-2" aria-label="Phát âm">Nghe</button>
        </p>
      )}

      {state === 'answering' && (
        <>
          <input
            autoFocus value={typed} onChange={event => setTyped(event.target.value)}
            onFocus={event => event.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })}
            onKeyDown={event => event.key === 'Enter' && typed.trim() && check()}
            placeholder={mode === 'en_vi' ? 'Gõ nghĩa tiếng Việt...' : 'Gõ từ tiếng Anh...'}
            className="mb-4 w-full rounded-xl border border-subtle bg-black/30 px-3 py-3 text-strong-text"
          />
          <button disabled={!typed.trim()} onClick={check} className="min-h-[44px] w-full rounded-xl bg-accent text-sm font-bold text-white disabled:opacity-40">
            Kiểm tra
          </button>
        </>
      )}

      {state === 'correct' && (
        <div className="min-h-[44px] rounded-xl bg-correct/15 px-4 py-3 text-sm font-bold text-correct" role="status">
          Chính xác{streak.current >= 3 ? ` · chuỗi ${streak.current} câu đúng` : ''}
        </div>
      )}

      {state === 'wrong' && (
        <div>
          <p className="mb-2 text-sm font-bold text-wrong">Chưa đúng. Đáp án:</p>
          <p className="mb-4 rounded-xl bg-black/25 p-3 font-bold text-correct">{answer}</p>
          <button autoFocus onClick={() => onResult(false)} onKeyDown={event => event.key === 'Enter' && onResult(false)}
                  className="min-h-[44px] w-full rounded-xl border border-subtle bg-surface-2 text-sm font-bold text-body">
            Tiếp tục
          </button>
        </div>
      )}

      {state === 'self_confirm' && (
        <div>
          <p className="mb-2 text-sm text-body">Đáp án trong thẻ:</p>
          <p className="mb-4 rounded-xl bg-black/25 p-3 font-bold text-correct">{card.back_text}</p>
          <p className="mb-3 text-sm text-muted">Câu trả lời của bạn: “{typed}” — bạn có đúng không?</p>
          <div className="flex gap-2">
            <button onClick={() => onResult(true)} className="min-h-[44px] flex-1 rounded-xl border border-correct/30 bg-correct/10 text-sm font-bold text-correct">
              Tôi đúng
            </button>
            <button onClick={() => onResult(false)} className="min-h-[44px] flex-1 rounded-xl border border-wrong/30 bg-wrong/10 text-sm font-bold text-wrong">
              Tôi sai
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

> Chú ý: `state === 'correct'` khóa ô nhập (input không còn render) đúng như spec, và `onResult(true)` chỉ chạy sau `CORRECT_HOLD_MS`. `streak` là `useRef` nên không gây render lại giữa lúc chờ.

- [ ] **Step 4: Build**

Run trong `frontend`: `npm run build`
Expected: xanh.

- [ ] **Step 5: Kiểm tra trong trình duyệt**

Vào một phiên học và kiểm: trả lời đúng → khung xanh + chữ "Chính xác" + tự sang câu sau sau ~0,7s + có tiếng; trả lời sai → khung đỏ + rung + tiếng khác; nhấn Enter ở màn sai cũng sang câu tiếp; đúng 3 câu liên tiếp thì thấy "chuỗi 3 câu đúng". Bật `prefers-reduced-motion` trong DevTools (Rendering → Emulate CSS prefers-reduced-motion) và xác nhận không còn rung nhưng vẫn đổi màu.

- [ ] **Step 6: Commit**

```bash
git add -A frontend/src
git commit -m "feat(daily): add instant correct/wrong feedback, streak and sound cues"
```

---

### Task 9: Thanh tiến độ, tạm dừng và nút tắt tiếng

**Files:**
- Create: `frontend/src/components/daily/DailyProgress.tsx`
- Modify: `frontend/src/pages/DailyPage.tsx`, `frontend/src/components/daily/steps/ReviewStep.tsx`, `frontend/src/components/daily/steps/DictationStep.tsx`, `frontend/src/components/daily/steps/SplitStep.tsx`

**Interfaces:**
- Consumes: `useDailySession` (Task 7) cho `stepsDone`/`stepsTotal`/`phase`; `isSoundOn`, `setSoundOn` (Task 8).
- Produces: `DailyProgress({ phase, stepsDone, stepsTotal, combo }: { phase: Phase; stepsDone: number; stepsTotal: number; combo: number })`.

- [ ] **Step 1: Component tiến độ**

Create `frontend/src/components/daily/DailyProgress.tsx`:

```tsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { isSoundOn, setSoundOn } from '../../utils/feedbackSound'
import type { Phase } from '../../hooks/useDailySession'

const PHASE_LABEL: Partial<Record<Phase, string>> = {
  review: 'Ôn tập',
  flip: 'Lật thẻ & nghe',
  dictation: 'Nghe & điền',
  split: 'Chia đôi',
  game: 'Ô chữ',
}

interface Props { phase: Phase; stepsDone: number; stepsTotal: number; combo: number }

export default function DailyProgress({ phase, stepsDone, stepsTotal, combo }: Props) {
  const [sound, setSound] = useState(isSoundOn())
  const percent = stepsTotal === 0 ? 0 : Math.round((stepsDone / stepsTotal) * 100)

  const toggleSound = () => {
    const next = !sound
    setSound(next)
    setSoundOn(next)
  }

  return (
    <div className="mb-6">
      <div className="mb-2 flex items-center gap-3">
        <p className="text-sm font-bold text-strong-text">{PHASE_LABEL[phase] ?? 'Học hôm nay'}</p>
        <p className="text-xs font-medium text-muted">{stepsDone}/{stepsTotal} bước</p>
        {combo >= 3 && (
          <span className="rounded-full bg-correct/15 px-2 py-0.5 text-xs font-black text-correct">chuỗi {combo}</span>
        )}
        <div className="flex-1" />
        <button onClick={toggleSound} className="min-h-[36px] rounded-lg border border-subtle bg-surface-1 px-3 text-xs font-bold text-muted hover:text-body">
          {sound ? 'Tắt tiếng' : 'Bật tiếng'}
        </button>
        <Link to="/" className="min-h-[36px] rounded-lg border border-subtle bg-surface-1 px-3 py-2 text-xs font-bold text-muted hover:text-body">
          Tạm dừng
        </Link>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-accent-2"
          style={{ width: `${percent}%`, transition: 'width var(--dur-base) ease' }}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Truyền combo từ các bước lên trang**

Trong `DailyPage.tsx`: thêm state `const [combo, setCombo] = useState(0)`, render `<DailyProgress …/>` ngay trên các bước khi `phase` không phải `done`/`empty`, và truyền `onCorrectStreak={setCombo}` xuống. Để làm được, ba component bước dùng `ExerciseCard` (`ReviewStep`, `DictationStep`, `SplitStep`) nhận thêm prop `onCorrectStreak?: (streak: number) => void` và chuyển thẳng vào `ExerciseCard`.

`DailyPage.tsx` phần thân trở thành:

```tsx
  return (
    <div className="mx-auto max-w-[90rem] px-4 py-8">
      {daily.phase !== 'done' && (
        <DailyProgress phase={daily.phase} stepsDone={daily.stepsDone} stepsTotal={daily.stepsTotal} combo={combo} />
      )}
      {daily.phase === 'review' && <ReviewStep daily={daily} onCorrectStreak={setCombo} />}
      {daily.phase === 'flip' && <FlipStep daily={daily} />}
      {daily.phase === 'dictation' && <DictationStep daily={daily} onCorrectStreak={setCombo} />}
      {daily.phase === 'split' && <SplitStep daily={daily} onCorrectStreak={setCombo} />}
      {daily.phase === 'game' && <DailyGamePanel />}
      {daily.phase === 'done' && (
        <div className="mx-auto max-w-4xl">
          <DailyStatusHero kind="complete" primaryTo="/" primaryLabel="Về trang chủ" secondaryTo="/reader" secondaryLabel="Đọc bài" />
        </div>
      )}
    </div>
  )
```

Trong mỗi component bước, đổi chữ ký thành:

```tsx
export default function ReviewStep({ daily, onCorrectStreak }: { daily: ReturnType<typeof useDailySession>; onCorrectStreak?: (streak: number) => void }) {
```

và thêm `onCorrectStreak={onCorrectStreak}` vào `<ExerciseCard …/>`. Làm y hệt cho `DictationStep` và `SplitStep`.

- [ ] **Step 3: Build**

Run trong `frontend`: `npm run build`
Expected: xanh.

- [ ] **Step 4: Kiểm tra trong trình duyệt**

Vào một phiên và xác nhận: thanh tiến độ tăng khi trả lời đúng và **không tụt** khi trả lời sai; tên giai đoạn đổi theo bước; chip "chuỗi N" hiện từ mốc 3; bấm "Tắt tiếng" thì trả lời không còn tiếng và tải lại trang vẫn tắt; bấm "Tạm dừng" về `/`, vào lại `/daily` tiếp đúng chỗ dở.

- [ ] **Step 5: Commit**

```bash
git add -A frontend/src
git commit -m "feat(daily): add session progress bar, pause and sound toggle"
```

---

### Task 10: Màn tổng kết buổi học

**Files:**
- Create: `frontend/src/components/daily/DailySummary.tsx`
- Modify: `frontend/src/hooks/useDailySession.ts`, `frontend/src/pages/DailyPage.tsx`

**Interfaces:**
- Consumes: `useDailySession` (Task 7), `getDailyHome` (Task 4).
- Produces:
  - `useDailySession` trả thêm `justFinished: boolean` (đúng khi `finishLearning` vừa thành công trong phiên làm việc này) và `setJustFinished(value: boolean)`.
  - `DailySummary({ daily, onContinue }: { daily: ReturnType<typeof useDailySession>; onContinue: () => void })`

- [ ] **Step 1: Cho hook biết vừa học xong**

Trong `frontend/src/hooks/useDailySession.ts`: thêm `const [justFinished, setJustFinished] = useState(false)`, đặt `setJustFinished(true)` trong `.then()` của `finishLearning` **trước** `setPhase('game')`, và trả thêm `justFinished, setJustFinished` trong object return.

- [ ] **Step 2: Component tổng kết**

Create `frontend/src/components/daily/DailySummary.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDailyHome } from '../../api/daily'
import type { DailyHome, DailyWord } from '../../types'
import type { useDailySession } from '../../hooks/useDailySession'

interface Props { daily: ReturnType<typeof useDailySession>; onContinue: () => void }

function accuracy(words: DailyWord[]) {
  const attempts = words.reduce((sum, word) => sum + word.steps_done.length + word.wrong_count, 0)
  const firstTry = words.reduce((sum, word) => sum + word.steps_done.length, 0)
  return attempts === 0 ? 100 : Math.round((firstTry / attempts) * 100)
}

export default function DailySummary({ daily, onContinue }: Props) {
  const [home, setHome] = useState<DailyHome | null>(null)
  const words = daily.session?.words ?? []
  const minutes = Math.max(1, Math.round((Date.now() - daily.startedAt) / 60000))
  const weakest = [...words].filter(word => word.wrong_count > 0)
    .sort((a, b) => b.wrong_count - a.wrong_count).slice(0, 5)

  useEffect(() => { getDailyHome().then(setHome).catch(() => setHome(null)) }, [])

  const stats: [string, string][] = [
    ['Từ đã học', String(words.length)],
    ['Độ chính xác', `${accuracy(words)}%`],
    ['Thời gian', `${minutes} phút`],
    ['Chuỗi ngày', home ? `${home.streak} ngày` : '…'],
  ]

  return (
    <section className="mx-auto max-w-3xl rounded-[1.5rem] border border-subtle bg-surface-1 p-6 sm:p-8">
      <p className="text-4xl" aria-hidden>🎉</p>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-strong-text">Xong phần học hôm nay</h2>
      <p className="mt-1 text-sm font-medium text-muted">
        {home ? `Đã thuộc ${home.mastered_cards}/${home.total_cards} từ.` : 'Đang cập nhật tiến độ…'}
      </p>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-subtle bg-surface-2 p-4">
            <dt className="text-xs font-black uppercase tracking-wider text-muted">{label}</dt>
            <dd className="mt-1 text-xl font-black text-strong-text">{value}</dd>
          </div>
        ))}
      </dl>

      {weakest.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-black uppercase tracking-wider text-muted">Cần để ý</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {weakest.map(word => (
              <li key={word.card_id} className="rounded-full border border-warn/30 bg-warn/10 px-3 py-1 text-sm font-bold text-warn">
                {word.card.front_text} · sai {word.wrong_count} lần
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-7 flex flex-wrap gap-3">
        <button onClick={onContinue} className="min-h-[44px] rounded-xl bg-accent px-6 text-sm font-bold text-white transition hover:brightness-110">
          Chơi ô chữ
        </button>
        <Link to="/" className="min-h-[44px] rounded-xl border border-subtle bg-surface-2 px-6 py-3 text-sm font-bold text-body">
          Về trang chủ
        </Link>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Chèn vào luồng**

Trong `DailyPage.tsx`, đổi nhánh `phase === 'game'` để tổng kết hiện trước game, và ẩn thanh tiến độ khi đang ở màn tổng kết:

```tsx
{daily.phase === 'game' && (
  daily.justFinished
    ? <DailySummary daily={daily} onContinue={() => daily.setJustFinished(false)} />
    : <DailyGamePanel />
)}
```

và đổi điều kiện thanh tiến độ thành:

```tsx
{daily.phase !== 'done' && !daily.justFinished && (
  <DailyProgress … />
)}
```

- [ ] **Step 4: Build**

Run trong `frontend`: `npm run build`
Expected: xanh.

- [ ] **Step 5: Kiểm tra trong trình duyệt**

Đi hết một phiên đến khi xong phần học và xác nhận: màn tổng kết hiện ngay sau bước chia đôi, có 4 ô số liệu, có danh sách "Cần để ý" nếu từng trả lời sai, bấm "Chơi ô chữ" thì vào `DailyGamePanel`. Rồi tải lại `/daily` và xác nhận vào **thẳng** game (vì `justFinished` chỉ đúng trong phiên làm việc vừa rồi) — tổng kết không hiện lại.

- [ ] **Step 6: Commit**

```bash
git add -A frontend/src
git commit -m "feat(daily): add end-of-session summary before the puzzle game"
```

---

### Task 11: Rà soát mobile và chốt hạ

**Files:**
- Modify: những file cần sửa phát sinh từ việc rà soát (ghi rõ trong commit)

**Interfaces:**
- Consumes: toàn bộ Task 1-10.
- Produces: không có API mới.

- [ ] **Step 1: Rà ở khổ điện thoại**

Chạy app, đặt viewport 375×812, đi qua: `/` (có thẻ và rỗng), `/daily` từng bước, màn tổng kết, `/library`, nav. Kiểm 4 điều: không có thanh cuộn ngang; mọi nút cao ≥ 44px; màn chia đôi chỉ hiện một panel; khi bấm vào ô nhập thì ô nhập không bị bàn phím ảo che (dùng emulate touch + focus).

- [ ] **Step 2: Sửa những gì phát hiện**

Sửa tại chỗ. Mỗi chỗ sửa chỉ dùng token màu và giữ nguyên hành vi.

- [ ] **Step 3: Thay emoji trong khung giao diện bằng SVG**

Spec yêu cầu emoji chỉ còn ở nội dung ăn mừng. Các file đã viết lại ở Task 6-10 vốn không còn emoji; còn lại hai chỗ trong `frontend/src/pages/LibraryPage.tsx`: nút `📥 Nhập dữ liệu Anki` và nút `📚 Thư viện Anki`. Xóa hai emoji đó và thêm icon SVG cùng bộ với `Navbar` (stroke 1.9, `currentColor`, `h-4 w-4`):

```tsx
const IconImport = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
    <path d="M12 4.5v9" /><path d="m8.5 10 3.5 3.5L15.5 10" /><path d="M5 16.5v1a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1" />
  </svg>
)
const IconLibrary = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
    <path d="M5 5.5h4v13H5zM11 5.5h3v13h-3zM16.5 6l3 12.5" />
  </svg>
)
```

Giữ nguyên emoji 🎉 ở `DailySummary` và emoji trong `DailyStatusHero` / `DailyGamePanel` (nội dung ăn mừng, ngoài phạm vi giai đoạn này).

- [ ] **Step 4: Mở rộng `prefers-reduced-motion`**

Mở khối `@media (prefers-reduced-motion: reduce)` ở cuối `frontend/src/index.css` và đối chiếu với danh sách `@keyframes` còn lại trong file sau khi Task 2 đã dọn. Mọi class animation còn tồn tại phải nằm trong danh sách selector của khối này — hiện còn thiếu `.animate-fade-in-up`, `.animate-fade-in`, `.animate-pulse-glow`, `.animate-slide-out-next`, `.animate-slide-in-next`, `.animate-slide-out-prev`, `.animate-slide-in-prev`, `.animate-letter-flight`, `.animate-word-card-assemble`, `.animate-fly-into-deck`, `.animate-answer-shake`. Thêm hết vào.

Kiểm bằng cách bật Rendering → Emulate CSS `prefers-reduced-motion: reduce` trong DevTools, mở `/`, `/library`, `/daily` và xác nhận không còn chuyển động nào.

- [ ] **Step 5: Kiểm tra tương phản chữ phụ**

Trong DevTools, chọn một dòng chữ dùng `text-muted` trên nền trang và xác nhận contrast ratio ≥ 4.5:1 (Elements → Accessibility → Contrast). Nếu chưa đạt, làm sáng `--color-muted` trong `tokens.css` rồi build lại.

- [ ] **Step 6: Kiểm tra không còn tham chiếu chết**

```bash
grep -rn "AI_ENABLED\|RobotAnimation\|GamesPage\|DailyCta" frontend/src
grep -rn "text-slate-500" frontend/src/pages/HomePage.tsx frontend/src/pages/DailyPage.tsx frontend/src/components/daily
```

Expected: lệnh đầu không có kết quả; lệnh sau không có kết quả trong các file đã viết lại.

- [ ] **Step 7: Chạy toàn bộ kiểm thử**

Run trong `backend`: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest -q`
Expected: toàn bộ xanh.

Run trong `frontend`: `npm run build`
Expected: xanh.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "fix: polish mobile layout, icons and text contrast across the study flow"
```

---

## Ghi chú khi thực thi

- Task 3 là task duy nhất có TDD thật (backend). Các task frontend không có test tự động theo đúng spec — bù lại mỗi task có bước kiểm chứng trong trình duyệt bắt buộc, **không được bỏ**.
- Task 5 tạo một `HomePage` tạm để build không vỡ; Task 6 ghi đè nó. Nếu chạy Task 6 trước Task 5 thì cả hai đều sai.
- Nếu bất kỳ bước nào phát hiện code thật khác giả định trong plan (tên field API, tên trường `useCachedQuery`, dạng lưu `steps_done`), hãy **sửa plan theo code thật**, đừng sửa code cho khớp plan.
