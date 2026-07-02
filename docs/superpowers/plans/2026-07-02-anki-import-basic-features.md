# Anki Import + Basic Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App học từ vựng chạy hoàn chỉnh offline với bộ 4000 Essential English Words - Book 1 (600 từ, 30 units, ảnh + âm thanh); tính năng AI hiển thị "Sắp ra mắt".

**Architecture:** Script Python một lần parse `extracted_anki/collection.anki2` → tạo 30 decks/600 cards/600 reviews trong SQLite, copy media vào `backend/data/media/` được FastAPI serve tại `/media` (Vite proxy). Card model thêm 3 cột nullable (pronunciation, definition, example_audio_url) với auto-migration ALTER TABLE lúc startup. Frontend: FlipCard thêm phiên âm + nút phát âm thanh; tách đếm "thẻ mới" vs "cần ôn"; các entry point AI bị disable kèm badge.

**Tech Stack:** FastAPI + SQLAlchemy 2 + SQLite, React 19 + Vite + TS + Tailwind v4, pytest.

## Global Constraints

- Backend chạy từ thư mục `backend/` (DB path `sqlite:///./flashcards.db` là relative — script import cũng phải chạy từ `backend/`).
- Không thêm dependency Python/npm mới. Không Alembic.
- Không đụng code backend AI (`routers/ai.py`, `ai_service.py`, `routers/documents.py`).
- Copy tiếng Việt trên UI: dùng giọng thân thiện sẵn có; badge AI dùng chữ "Sắp ra mắt ✨".
- Cuối mỗi task: commit với message tiếng Anh dạng conventional (`feat:`, `docs:`...).

---

### Task 1: Anki parser thuần (`anki_parser.py`)

**Files:**
- Create: `backend/app/services/anki_parser.py`
- Test: `backend/tests/test_anki_parser.py`

**Interfaces:**
- Produces: `parse_note(flds: str) -> dict` với keys `order:int, keyword:str, viet:str, pronunciation:str|None, definition:str|None, example:str|None, word_sound:str|None, image:str|None, example_sound:str|None`; các hàm phụ `extract_sound`, `extract_image`, `strip_cloze`, `clean_html`, `split_explanation`.

- [ ] **Step 1: Viết test fail**

```python
# backend/tests/test_anki_parser.py
from app.services.anki_parser import (
    clean_html,
    extract_image,
    extract_sound,
    parse_note,
    split_explanation,
    strip_cloze,
)

FLDS_AFRAID = (
    "1\x1fafraid\x1f<div>a__ __ __ __d</div>\x1fSợ hãi\x1f[sound:4000B1_afraid.mp3]"
    "\x1f<img src='4000B1_001.jpg'>\x1f[ə'freɪd]"
    "\x1f<div>When someone is {{c1::afraid}}, they feel fear.</div>→ &nbsp;The woman was {{c1::afraid}} of what she saw."
    "\x1f[sound:4000B1_afraid_meaning.mp3]\x1f[sound:4000B1_afraid_example.mp3]\x1f<div><i>full viet dict</i></div>"
)


def test_extract_sound():
    assert extract_sound("[sound:4000B1_afraid.mp3]") == "4000B1_afraid.mp3"
    assert extract_sound("") is None


def test_extract_image():
    assert extract_image("<img src='4000B1_001.jpg'>") == "4000B1_001.jpg"
    assert extract_image('<img src="a.png">') == "a.png"
    assert extract_image("") is None


def test_strip_cloze():
    assert strip_cloze("I {{c1::agree}} with you.") == "I agree with you."
    assert strip_cloze("{{c2::hint::extra}} text") == "hint text"


def test_clean_html_collapses_tags_and_entities():
    assert clean_html("<div>A: good.</div>&nbsp; <div>B: yes.</div>") == "A: good. B: yes."


def test_split_explanation():
    definition, example = split_explanation(
        "<div>When someone is {{c1::afraid}}, they feel fear.</div>→ &nbsp;The woman was {{c1::afraid}} of what she saw."
    )
    assert definition == "When someone is afraid, they feel fear."
    assert example == "The woman was afraid of what she saw."


def test_parse_note_full():
    n = parse_note(FLDS_AFRAID)
    assert n["order"] == 1
    assert n["keyword"] == "afraid"
    assert n["viet"] == "Sợ hãi"
    assert n["pronunciation"] == "[ə'freɪd]"
    assert n["definition"] == "When someone is afraid, they feel fear."
    assert n["example"] == "The woman was afraid of what she saw."
    assert n["word_sound"] == "4000B1_afraid.mp3"
    assert n["image"] == "4000B1_001.jpg"
    assert n["example_sound"] == "4000B1_afraid_example.mp3"
```

- [ ] **Step 2: Chạy test, xác nhận fail** — `cd backend && python -m pytest tests/test_anki_parser.py -v` → FAIL (ModuleNotFoundError)

- [ ] **Step 3: Implement**

```python
# backend/app/services/anki_parser.py
"""Parse notes from the 4000 Essential English Words Anki collection.

Field layout of the `4000Book1` note model:
0 №, 1 Keyword, 2 Suggestion, 3 Short Vietnamese, 4 Keyword_Sound,
5 Image, 6 Transcription, 7 Explanation, 8 Meaning_Sound,
9 Example_Sound, 10 Full Vietnamese
"""
import html
import re

FIELD_SEP = "\x1f"

SOUND_RE = re.compile(r"\[sound:([^\]]+)\]")
IMG_RE = re.compile(r"<img[^>]+src=['\"]?([^'\">\s]+)['\"]?")
CLOZE_RE = re.compile(r"\{\{c\d+::(.*?)(?:::[^}]*)?\}\}")
TAG_RE = re.compile(r"<[^>]+>")


def extract_sound(field: str) -> str | None:
    m = SOUND_RE.search(field)
    return m.group(1) if m else None


def extract_image(field: str) -> str | None:
    m = IMG_RE.search(field)
    return m.group(1) if m else None


def strip_cloze(text: str) -> str:
    return CLOZE_RE.sub(r"\1", text)


def clean_html(text: str) -> str:
    text = re.sub(r"<br\s*/?>", " ", text)
    text = TAG_RE.sub(" ", text)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def split_explanation(text: str) -> tuple[str, str]:
    """Explanation field = English definition + '→' + example sentence."""
    text = strip_cloze(text)
    definition, _, example = text.partition("→")
    return clean_html(definition), clean_html(example)


def parse_note(flds: str) -> dict:
    f = flds.split(FIELD_SEP)
    definition, example = split_explanation(f[7])
    order = clean_html(f[0])
    return {
        "order": int(order) if order.isdigit() else 0,
        "keyword": clean_html(f[1]),
        "viet": clean_html(f[3]),
        "pronunciation": clean_html(f[6]) or None,
        "definition": definition or None,
        "example": example or None,
        "word_sound": extract_sound(f[4]),
        "image": extract_image(f[5]),
        "example_sound": extract_sound(f[9]),
    }
```

- [ ] **Step 4: Chạy test pass** — `python -m pytest tests/test_anki_parser.py -v` → 6 PASS
- [ ] **Step 5: Commit** — `git add backend/app/services/anki_parser.py backend/tests/test_anki_parser.py && git commit -m "feat: add Anki note parser for 4000 Essential Words model"`

---

### Task 2: Mở rộng Card model + auto-migration + serve media

**Files:**
- Modify: `backend/app/models/card.py` (thêm 3 cột)
- Modify: `backend/app/database.py` (hàm `ensure_card_columns`)
- Modify: `backend/app/main.py` (gọi migration, mount `/media`)
- Modify: `backend/app/schemas/card.py` (3 field mới)
- Test: `backend/tests/test_cards.py` (thêm 1 test)

**Interfaces:**
- Produces: cột `Card.pronunciation` (String(100)), `Card.definition` (Text), `Card.example_audio_url` (String(500)) — đều nullable; `ensure_card_columns(engine)`; static mount `/media` → `backend/data/media/`.

- [ ] **Step 1: Viết test fail** — thêm vào `backend/tests/test_cards.py`:

```python
def test_create_card_with_media_fields(client):
    deck = client.post("/api/decks", json={"name": "Unit test"}).json()
    resp = client.post(
        f"/api/decks/{deck['id']}/cards",
        json={
            "front_text": "afraid",
            "back_text": "Sợ hãi",
            "pronunciation": "[ə'freɪd]",
            "definition": "When someone is afraid, they feel fear.",
            "example_sentence": "The woman was afraid of what she saw.",
            "image_url": "/media/4000B1_001.jpg",
            "audio_url": "/media/4000B1_afraid.mp3",
            "example_audio_url": "/media/4000B1_afraid_example.mp3",
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["pronunciation"] == "[ə'freɪd]"
    assert data["definition"] == "When someone is afraid, they feel fear."
    assert data["example_audio_url"] == "/media/4000B1_afraid_example.mp3"
```

(Trước khi viết, xem endpoint tạo deck trong `test_decks.py` để dùng đúng path/payload hiện có.)

- [ ] **Step 2: Chạy fail** — `python -m pytest tests/test_cards.py -v` → FAIL (422 hoặc thiếu field trong response)
- [ ] **Step 3: Implement**

`models/card.py` — thêm sau `example_sentence`:
```python
    pronunciation: Mapped[str | None] = mapped_column(String(100), nullable=True)
    definition: Mapped[str | None] = mapped_column(Text, nullable=True)
```
và sau `audio_url`:
```python
    example_audio_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
```

`schemas/card.py` — thêm vào cả `CardCreate`, `CardUpdate`, `CardOut`:
```python
    pronunciation: str | None = None
    definition: str | None = None
    example_audio_url: str | None = None
```
(trong `CardOut` khai báo `pronunciation: str | None` v.v. cùng kiểu.)

`database.py` — thêm cuối file:
```python
from sqlalchemy import text

CARD_EXTRA_COLUMNS = {
    "pronunciation": "VARCHAR(100)",
    "definition": "TEXT",
    "example_audio_url": "VARCHAR(500)",
}


def ensure_card_columns(engine_) -> None:
    """Lightweight migration: add new nullable Card columns to existing DBs."""
    with engine_.connect() as conn:
        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(cards)"))}
        for name, ddl in CARD_EXTRA_COLUMNS.items():
            if existing and name not in existing:
                conn.execute(text(f"ALTER TABLE cards ADD COLUMN {name} {ddl}"))
        conn.commit()
```

`main.py` — sau `Base.metadata.create_all(...)`:
```python
from pathlib import Path
from fastapi.staticfiles import StaticFiles
from app.database import ensure_card_columns

ensure_card_columns(engine)

MEDIA_DIR = Path(__file__).resolve().parent.parent / "data" / "media"
MEDIA_DIR.mkdir(parents=True, exist_ok=True)
```
và sau các `include_router`:
```python
app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")
```

- [ ] **Step 4: Chạy toàn bộ backend tests pass** — `python -m pytest -v` → PASS hết
- [ ] **Step 5: Commit** — `git commit -m "feat: extend Card with pronunciation/definition/example audio, serve media statically"`

---

### Task 3: Script import `backend/import_anki.py`

**Files:**
- Create: `backend/import_anki.py`

**Interfaces:**
- Consumes: `parse_note` (Task 1), `ensure_card_columns` (Task 2), models Deck/Card/Review.
- Produces: 30 decks tên `Unit NN · 4000 Essential Words`, 600 cards + 600 reviews (`due_date=today`, `repetitions=0`), media copy vào `backend/data/media/`. Idempotent theo tên deck.

- [ ] **Step 1: Viết script**

```python
# backend/import_anki.py
"""One-time import: 4000 Essential English Words - Book 1 (Anki) -> app DB.

Run from the backend/ directory (same cwd as uvicorn):
    python import_anki.py [--anki-dir ../extracted_anki]
"""
import argparse
import json
import shutil
import sqlite3
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.database import Base, SessionLocal, engine, ensure_card_columns
from app.models.card import Card
from app.models.deck import Deck
from app.models.review import Review
from app.services.anki_parser import parse_note

BACKEND_DIR = Path(__file__).resolve().parent
MEDIA_DEST = BACKEND_DIR / "data" / "media"
MODEL_NAME = "4000Book1"


def load_units(anki_dir: Path) -> dict[str, list[dict]]:
    """Return {unit_name: [parsed notes]} from the Anki collection."""
    con = sqlite3.connect(anki_dir / "collection.anki2")
    try:
        models_json, decks_json = con.execute("SELECT models, decks FROM col").fetchone()
        models = json.loads(models_json)
        mid = next(m for m, v in models.items() if v["name"] == MODEL_NAME)
        deck_names = {int(k): v["name"] for k, v in json.loads(decks_json).items()}

        units: dict[str, list[dict]] = {}
        seen_notes: set[int] = set()
        rows = con.execute(
            "SELECT n.id, n.flds, c.did FROM notes n JOIN cards c ON c.nid = n.id WHERE n.mid = ?",
            (int(mid),),
        )
        for nid, flds, did in rows:
            if nid in seen_notes:
                continue
            seen_notes.add(nid)
            full_name = deck_names.get(did, "")
            unit = full_name.split("::")[-1].strip()  # "Unit 01"
            units.setdefault(unit, []).append(parse_note(flds))
        return units
    finally:
        con.close()


def copy_media(anki_dir: Path, filenames: set[str]) -> tuple[int, list[str]]:
    src_dir = anki_dir / "media_files"
    MEDIA_DEST.mkdir(parents=True, exist_ok=True)
    copied, missing = 0, []
    for name in sorted(filenames):
        src = src_dir / name
        dst = MEDIA_DEST / name
        if not src.exists():
            missing.append(name)
            continue
        if not dst.exists():
            shutil.copy2(src, dst)
        copied += 1
    return copied, missing


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--anki-dir", type=Path, default=BACKEND_DIR.parent / "extracted_anki")
    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)
    ensure_card_columns(engine)

    units = load_units(args.anki_dir)
    referenced: set[str] = set()
    created_decks = created_cards = 0

    db = SessionLocal()
    try:
        for unit_name in sorted(units):
            notes = sorted(units[unit_name], key=lambda n: n["order"])
            deck_name = f"{unit_name} · 4000 Essential Words"
            if db.query(Deck).filter(Deck.name == deck_name).first():
                print(f"[skip] {deck_name} (đã tồn tại)")
                continue
            deck = Deck(
                name=deck_name,
                description=f"4000 Essential English Words – Book 1 · {len(notes)} từ kèm hình ảnh & phát âm",
            )
            db.add(deck)
            db.flush()
            for n in notes:
                card = Card(
                    deck_id=deck.id,
                    front_text=n["keyword"],
                    back_text=n["viet"],
                    pronunciation=n["pronunciation"],
                    definition=n["definition"],
                    example_sentence=n["example"],
                    image_url=f"/media/{n['image']}" if n["image"] else None,
                    audio_url=f"/media/{n['word_sound']}" if n["word_sound"] else None,
                    example_audio_url=f"/media/{n['example_sound']}" if n["example_sound"] else None,
                )
                db.add(card)
                db.flush()
                db.add(Review(card_id=card.id, due_date=date.today()))
                referenced.update(x for x in (n["image"], n["word_sound"], n["example_sound"]) if x)
                created_cards += 1
            created_decks += 1
            print(f"[ok]   {deck_name}: {len(notes)} thẻ")
        db.commit()
    finally:
        db.close()

    copied, missing = copy_media(args.anki_dir, referenced)
    print(f"\nDecks mới: {created_decks} · Cards mới: {created_cards}")
    print(f"Media copy: {copied}/{len(referenced)} file -> {MEDIA_DEST}")
    if missing:
        print(f"Thiếu {len(missing)} file: {missing[:10]}{'...' if len(missing) > 10 else ''}")


if __name__ == "__main__":
    main()
```

(Trước khi chạy: đọc `backend/app/models/deck.py` và `review.py` để xác nhận tên field/defaults khớp — nếu Review yêu cầu thêm tham số, bổ sung đúng defaults như `routers/cards.py` đang làm.)

- [ ] **Step 2: Chạy import** — `cd backend && python import_anki.py`
Expected: 30 dòng `[ok] Unit NN ...`, `Decks mới: 30 · Cards mới: 600`, `Media copy: 1800/1800`.
- [ ] **Step 3: Kiểm tra idempotent** — chạy lại `python import_anki.py` → 30 dòng `[skip]`, `Cards mới: 0`.
- [ ] **Step 4: Xác nhận dữ liệu** — query nhanh:
```
python -c "import sqlite3; c=sqlite3.connect('flashcards.db'); print(c.execute('select count(*) from decks').fetchone(), c.execute('select count(*) from cards').fetchone(), c.execute('select count(*) from reviews').fetchone())"
```
Expected: decks ≥ 30, cards ≥ 600, reviews ≥ 600. Lưu ý xác minh DB nằm ở `backend/flashcards.db` (cwd của uvicorn theo start.bat).
- [ ] **Step 5: Commit** — `git add backend/import_anki.py && git commit -m "feat: add one-time Anki dataset import script"` (KHÔNG commit `backend/data/` và `*.db` — thêm vào `.gitignore` nếu chưa có).

---

### Task 4: Stats tách "thẻ mới" vs "cần ôn"

**Files:**
- Modify: `backend/app/routers/review.py:44-56` (get_stats)
- Modify: `backend/app/schemas/review.py` (StatsOut)
- Test: `backend/tests/test_review.py` (file mới)

**Interfaces:**
- Produces: `StatsOut.new_cards: int`; `due_today` giờ chỉ đếm review có `repetitions > 0`.

- [ ] **Step 1: Test fail**

```python
# backend/tests/test_review.py
from app.models.review import Review


def _make_deck_with_cards(client, n=2):
    deck = client.post("/api/decks", json={"name": "Stats deck"}).json()
    cards = [
        client.post(f"/api/decks/{deck['id']}/cards", json={"front_text": f"w{i}", "back_text": "x"}).json()
        for i in range(n)
    ]
    return deck, cards


def test_stats_splits_new_and_due(client, db):
    _, cards = _make_deck_with_cards(client, n=2)
    review = db.query(Review).filter(Review.card_id == cards[1]["id"]).first()
    review.repetitions = 2
    db.commit()

    stats = client.get("/api/review/stats").json()
    assert stats["new_cards"] == 1
    assert stats["due_today"] == 1
    assert stats["total_cards"] == 2
```

- [ ] **Step 2: Chạy fail** — `python -m pytest tests/test_review.py -v` → FAIL (KeyError `new_cards` / due_today == 2)
- [ ] **Step 3: Implement** — trong `get_stats` thay `due_today` và thêm `new_cards`:

```python
    due_today = db.query(Review).filter(Review.due_date <= today, Review.repetitions > 0).count()
    new_cards = db.query(Review).filter(Review.due_date <= today, Review.repetitions == 0).count()
```
và trả `new_cards=new_cards` trong `StatsOut(...)`. Schema:
```python
class StatsOut(BaseModel):
    streak: int
    total_cards: int
    total_reviewed_today: int
    due_today: int
    new_cards: int
    due_upcoming: dict[str, int]
```

- [ ] **Step 4: Toàn bộ backend tests pass** — `python -m pytest -v`
- [ ] **Step 5: Commit** — `git commit -m "feat: split new cards from due reviews in stats"`

---

### Task 5: Frontend — types, proxy media, FlipCard (phiên âm + âm thanh)

**Files:**
- Modify: `frontend/src/types/index.ts` (Card + Stats)
- Modify: `frontend/vite.config.ts` (proxy `/media`)
- Modify: `frontend/src/components/FlipCard.tsx`

**Interfaces:**
- Consumes: field mới từ Task 2/4.
- Produces: `Card` type có `pronunciation, definition, example_audio_url`; `Stats` có `new_cards`; FlipCard hiển thị phiên âm + definition + 2 nút phát âm thanh.

- [ ] **Step 1: types** — `Card` thêm `pronunciation: string | null`, `definition: string | null`, `example_audio_url: string | null`; `Stats` thêm `new_cards: number`.
- [ ] **Step 2: vite proxy**
```ts
    proxy: {
      '/api': 'http://localhost:8000',
      '/media': 'http://localhost:8000',
    },
```
- [ ] **Step 3: FlipCard** — thêm component nội bộ + sửa 2 mặt:

```tsx
function AudioButton({ src, small }: { src: string; small?: boolean }) {
  const play = (e: React.MouseEvent) => {
    e.stopPropagation()
    new Audio(src).play().catch(() => {})
  }
  return (
    <button
      onClick={play}
      className={`${small ? 'w-8 h-8 text-sm' : 'w-11 h-11 text-lg'} rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center transition-all hover:scale-110 active:scale-95 shrink-0`}
      title="Phát âm thanh"
    >
      🔊
    </button>
  )
}
```

Mặt trước — dưới `front_text`:
```tsx
{card.pronunciation && (
  <p className="text-cyan-200/70 text-xl font-medium tracking-wide">{card.pronunciation}</p>
)}
{card.audio_url && <AudioButton src={card.audio_url} />}
```

Mặt sau — sau `back_text` thêm definition; khung ví dụ thành flex kèm nút loa nhỏ:
```tsx
{card.definition && (
  <p className="text-gray-300 text-base text-center leading-relaxed max-w-md relative z-10">{card.definition}</p>
)}
{card.example_sentence && (
  <div className="mt-2 px-5 py-3 rounded-xl bg-white/5 border border-white/8 max-w-sm flex items-center gap-3">
    <p className="text-gray-400 text-sm italic text-center leading-relaxed flex-1">
      "{card.example_sentence}"
    </p>
    {card.example_audio_url && <AudioButton src={card.example_audio_url} small />}
  </div>
)}
```
Tăng `minHeight` của container flip từ `260px` → `440px` để chứa đủ nội dung (chỉnh cả 2 mặt nếu cần, ảnh giữ `max-h-28`).

- [ ] **Step 4: Typecheck** — `cd frontend && npm run build` → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: show pronunciation, definition and audio playback on flip card"`

---

### Task 6: HomePage + DeckCard — tách đếm "từ mới" vs "cần ôn"

**Files:**
- Modify: `frontend/src/pages/HomePage.tsx`
- Modify: `frontend/src/components/DeckCard.tsx`

**Interfaces:**
- Produces: `DeckCard` prop mới `newCount?: number`.

- [ ] **Step 1: HomePage tính toán** — sau state hiện có:
```tsx
const newReviews = dueReviews.filter(r => r.repetitions === 0)
const dueOnly = dueReviews.filter(r => r.repetitions > 0)
```
Trong `load()`, tách đếm theo deck (thay `dueByDeck` đơn):
```tsx
const dueByDeck: Record<string, number> = {}
const newByDeck: Record<string, number> = {}
// trong Promise.all map:
const cardIds = new Set(cards.map(c => c.id))
dueByDeck[deck.id] = r.filter(rev => cardIds.has(rev.card_id) && rev.repetitions > 0).length
newByDeck[deck.id] = r.filter(rev => cardIds.has(rev.card_id) && rev.repetitions === 0).length
```
(thêm state `newCounts` tương tự `dueCounts`).
- [ ] **Step 2: Hero banner** — dùng `dueOnly`/`newReviews`: tiêu đề `X thẻ đang chờ ôn!` nếu `dueOnly.length > 0`, ngược lại `Y từ mới đang chờ bạn!`; nút link tới `/review?mode=review` hoặc `/review?mode=learn` tương ứng.
- [ ] **Step 3: Stats row 4 ô** — grid `sm:grid-cols-2 lg:grid-cols-4`, thêm ô `{ label: 'Từ mới', value: newReviews.length, icon: '✨', ... }` và đổi 'Cần ôn hôm nay' → `dueOnly.length`.
- [ ] **Step 4: DeckCard badge** — thêm prop `newCount = 0`; thứ tự badge: `cardCount === 0` → "Chưa có thẻ"; `dueCount > 0` → `🔥 {dueCount} cần ôn`; `newCount > 0` → `✨ {newCount} từ mới`; còn lại "Đã xong". HomePage truyền `newCount={newCounts[deck.id] ?? 0}`.
- [ ] **Step 5: Build + commit** — `npm run build` PASS; `git commit -m "feat: separate new-word and due-review counts on home page"`

---

### Task 7: AI "Sắp ra mắt" (HomePage, DeckDetailPage, Documents, Navbar)

**Files:**
- Modify: `frontend/src/pages/HomePage.tsx` (AI Generator Box, dòng ~321-390)
- Modify: `frontend/src/pages/DeckDetailPage.tsx` (AI batch box ~394, nút AI Generate ~465)
- Modify: `frontend/src/pages/DocumentListPage.tsx`
- Modify: `frontend/src/components/Navbar.tsx`

**Interfaces:** không có — chỉ UI.

Badge tái sử dụng (inline mỗi file, không cần component riêng):
```tsx
<span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-full">Sắp ra mắt ✨</span>
```

- [ ] **Step 1: HomePage** — thêm hằng `const AI_ENABLED = false` đầu file; badge cạnh tiêu đề "Trợ lý AI tạo thẻ nhanh"; mọi input/button trong form AI đổi `disabled={...}` thành `disabled={!AI_ENABLED || ...}`; đầu `handleGenerateAICard` thêm `if (!AI_ENABLED) return`; đổi mô tả thành "Tính năng đang được hoàn thiện — sẽ sớm ra mắt. Hiện tại bạn có thể học với bộ 4000 Essential English Words có sẵn."; thêm `opacity-60` cho form.
- [ ] **Step 2: DeckDetailPage** — cùng pattern: `const AI_ENABLED = false`; badge trên box "Tạo lô thẻ AI cho chủ đề này" + disable form; nút "✨ AI Generate" trong panel tạo thẻ: `disabled` + `title="Sắp ra mắt"` + guard đầu `handleGenerateAI`/`handleGenerateAIBatch`.
- [ ] **Step 3: DocumentListPage** — thay toàn bộ nội dung page bằng panel coming-soon (giữ heading trang):
```tsx
export default function DocumentListPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-24 text-center animate-fade-in relative">
      <div className="absolute inset-0 flex justify-center items-center pointer-events-none -z-10">
        <div className="w-64 h-64 bg-amber-500/10 rounded-full blur-[80px]" />
      </div>
      <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-5xl mx-auto mb-8 shadow-[0_0_30px_rgba(245,158,11,0.15)] backdrop-blur-sm">
        📄
      </div>
      <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-full">Sắp ra mắt ✨</span>
      <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-orange-200 mt-4 mb-3">Tài liệu & tạo thẻ từ PDF</h2>
      <p className="text-gray-400 text-lg leading-relaxed max-w-md mx-auto">
        Tải PDF lên và để AI tạo thẻ từ nội dung tài liệu — tính năng này đang được phát triển.
        Trong lúc chờ, hãy học bộ <span className="text-amber-300 font-semibold">4000 Essential English Words</span> nhé!
      </p>
    </div>
  )
}
```
(xoá import không dùng để build không lỗi; giữ nguyên `DocumentDetailPage` và route.)
- [ ] **Step 4: Navbar** — item Tài liệu thêm chấm "soon": `NAV_ITEMS` thêm `soon: true` cho `/documents`, render:
```tsx
{item.soon && <span className="text-[8px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full px-1.5 py-0.5">soon</span>}
```
- [ ] **Step 5: Build + commit** — `npm run build` PASS; `git commit -m "feat: gate AI features behind coming-soon badges"`

---

### Task 8: StatsPage hiển thị "Từ mới chờ học"

**Files:**
- Modify: `frontend/src/pages/StatsPage.tsx:22-27`

- [ ] **Step 1:** `STAT_CARDS` thêm phần tử `{ label: 'Từ mới chờ học', value: stats.new_cards, icon: '✨', color: 'from-amber-500/20 to-yellow-500/10', border: 'border-amber-500/30', text: 'text-amber-400' }`; grid đổi thành `grid-cols-2 sm:grid-cols-3`.
- [ ] **Step 2: Build + commit** — `npm run build`; `git commit -m "feat: show pending new words on stats page"`

---

### Task 9: README + .gitignore + start.bat

**Files:**
- Modify: `README.md`
- Modify: `.gitignore` (đảm bảo có `backend/data/`, `*.db`)
- Verify: `start.bat`

- [ ] **Step 1: README** — viết lại trung thực:
  - Hero/tagline: app học từ vựng tiếng Anh offline với SM-2, kèm sẵn bộ **4000 Essential English Words – Book 1** (600 từ, 30 units, hình ảnh + phát âm). Bỏ "AI-Powered" khỏi tagline chính.
  - Features "✅ Implemented": SM-2, flip card (thêm phiên âm + audio), deck theo unit, dashboard/streak, quản lý deck/card. Chuyển các mục AI (generation, PDF/RAG) sang khối "🔮 Coming Soon".
  - Quick Start: sau `pip install -r requirements.txt` thêm bước `python import_anki.py  # nạp bộ 4000 từ (chạy 1 lần)`; ghi chú `python seed.py` là tùy chọn dữ liệu mẫu.
  - Architecture tree: thêm `import_anki.py`, `app/services/anki_parser.py`, `data/media/`.
  - Roadmap giữ nguyên các phase (đã là tài liệu định hướng).
- [ ] **Step 2: .gitignore** — kiểm tra/thêm: `backend/data/`, `*.db`.
- [ ] **Step 3: start.bat** — giữ nguyên lệnh; xác nhận không cần sửa (import là bước một lần, không thuộc start).
- [ ] **Step 4: Commit** — `git commit -m "docs: rewrite README around working offline app with Anki dataset"`

---

### Task 10: Kiểm chứng end-to-end

- [ ] **Step 1:** `cd backend && python -m pytest -v` → tất cả PASS.
- [ ] **Step 2:** `cd frontend && npm run build` → PASS.
- [ ] **Step 3:** Chạy backend (port 8000) + frontend (5173) qua preview; xác nhận:
  - Trang chủ hiện ≥30 decks `Unit NN · 4000 Essential Words`, ô "Từ mới" = 600, "Cần ôn hôm nay" = 0.
  - Badge AI "Sắp ra mắt" hiển thị, form disable; trang Tài liệu hiện panel coming-soon.
  - Vào 1 deck → "Học từ mới" → flip card: từ + phiên âm + nút loa; mặt sau: nghĩa Việt + definition + ví dụ (kèm loa) + ảnh hiển thị từ `/media/...`.
  - Đánh giá 1 thẻ (OK/Easy) → quay lại Stats: "Ôn hôm nay" tăng, streak = 1.
  - `GET /media/4000B1_001.jpg` trả 200.
- [ ] **Step 4:** Sửa mọi lỗi phát hiện, chạy lại đến khi sạch.
- [ ] **Step 5:** Commit cuối nếu có sửa; tổng kết.
