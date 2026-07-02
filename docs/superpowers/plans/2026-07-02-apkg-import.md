# .apkg Web Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upload file `.apkg` (tải từ AnkiWeb) qua modal trên trang chủ → app tự trích xuất decks/cards/media để học thêm.

**Architecture:** Service `anki_importer.py` chứa core `import_collection` (đọc SQLite Anki + media qua callback) với 2 wrapper mỏng: `import_apkg` (zip) và `import_extracted_dir` (thư mục đã giải nén — thay logic cũ của CLI). Endpoint đồng bộ `POST /api/anki/import` nhận multipart. Frontend: modal kéo-thả trên HomePage. Mapper: model `4000BookN` dùng `parse_note` sẵn có; model khác dùng mapper generic đoán field theo tên.

**Tech Stack:** FastAPI + SQLAlchemy + SQLite, zipfile/sqlite3 stdlib, React 19 + TS, pytest.

## Global Constraints

- Backend test/chạy bằng conda env `flashcard`: `conda run -n flashcard python -m pytest` từ thư mục `backend/`.
- Không thêm dependency mới (zip/sqlite3/tempfile là stdlib; python-multipart đã có).
- Không đụng router AI/documents.
- Thông điệp lỗi định dạng mới: `"File xuất từ Anki bản mới. Hãy export lại với tùy chọn 'Support older Anki versions' được tick."`
- Tên deck 4000-series: model `4000Book1` → `"{leaf} · 4000 Essential Words"`; `4000Book{N}` (N≥2) → `"{leaf} · 4000 Essential Words Book {N}"` (giữ idempotency với dữ liệu Book 1 đã import).
- Badge/copy UI tiếng Việt, theo giọng hiện có.
- Commit message tiếng Anh dạng conventional, kết bằng dòng Co-Authored-By Claude.

---

### Task 1: Mapper generic (`map_generic_note`)

**Files:**
- Create: `backend/app/services/anki_importer.py` (bắt đầu với mapper + exception + dataclass)
- Test: `backend/tests/test_anki_importer.py`

**Interfaces:**
- Produces: `map_generic_note(field_names: list[str], field_values: list[str]) -> dict | None` — trả dict cùng shape với `anki_parser.parse_note` (`order, keyword, viet, pronunciation, definition, example, word_sound, image, example_sound`; `order` luôn 0) hoặc `None` nếu note không dùng được; `ApkgFormatError(Exception)`; `@dataclass ImportSummary(decks_created=0, cards_created=0, decks_skipped=0, cards_skipped=0, warnings=list)`.

- [ ] **Step 1: Viết test fail**

```python
# backend/tests/test_anki_importer.py
from app.services.anki_importer import map_generic_note


def test_generic_maps_named_fields():
    n = map_generic_note(
        ["Word", "Meaning", "IPA", "Example", "Extra"],
        ["hello", "xin chào", "/həˈloʊ/", "<i>Hello there!</i>", "[sound:hi.mp3] rồi [sound:hi_ex.mp3] <img src='hi.jpg'>"],
    )
    assert n["keyword"] == "hello"
    assert n["viet"] == "xin chào"
    assert n["pronunciation"] == "/həˈloʊ/"
    assert n["example"] == "Hello there!"
    assert n["word_sound"] == "hi.mp3"
    assert n["example_sound"] == "hi_ex.mp3"
    assert n["image"] == "hi.jpg"


def test_generic_falls_back_to_positional():
    n = map_generic_note(["A", "B"], ["dog", "con chó"])
    assert n["keyword"] == "dog"
    assert n["viet"] == "con chó"


def test_generic_uses_definition_as_back_when_no_back():
    n = map_generic_note(["Front", "Definition"], ["cat", "a small animal"])
    assert n["keyword"] == "cat"
    assert n["viet"] == "a small animal"


def test_generic_skips_empty_note():
    assert map_generic_note(["Front", "Back"], ["<br>", "nghĩa"]) is None
    assert map_generic_note(["OnlyOne"], ["x"]) is None


def test_generic_strips_cloze_and_html():
    n = map_generic_note(["Front", "Back"], ["{{c1::run}}", "<div>chạy&nbsp;</div>"])
    assert n["keyword"] == "run"
    assert n["viet"] == "chạy"
```

- [ ] **Step 2: Chạy fail** — `cd backend && conda run -n flashcard python -m pytest tests/test_anki_importer.py -q` → FAIL (ModuleNotFoundError)
- [ ] **Step 3: Implement**

```python
# backend/app/services/anki_importer.py
"""Import Anki collections (.apkg or extracted dir) into the app DB."""
from dataclasses import dataclass, field

from app.services.anki_parser import (
    SOUND_RE,
    clean_html,
    extract_image,
    strip_cloze,
)


class ApkgFormatError(Exception):
    """The file is not a readable legacy-format Anki package."""


NEW_FORMAT_MSG = (
    "File xuất từ Anki bản mới. Hãy export lại với tùy chọn "
    "'Support older Anki versions' được tick."
)


@dataclass
class ImportSummary:
    decks_created: int = 0
    cards_created: int = 0
    decks_skipped: int = 0
    cards_skipped: int = 0
    warnings: list[str] = field(default_factory=list)


FRONT_KEYS = ["front", "word", "keyword", "term", "expression", "vocabulary", "question"]
BACK_KEYS = ["back", "meaning", "translation", "answer", "vietnamese", "viet"]
DEF_KEYS = ["definition", "explanation", "gloss"]
PRON_KEYS = ["transcription", "ipa", "pronunciation", "phonetic", "reading"]
EX_KEYS = ["example", "sentence", "usage", "sample"]


def _pick(field_names: list[str], keys: list[str], used: set[int]) -> int | None:
    lowered = [n.casefold() for n in field_names]
    for key in keys:  # exact match first
        for i, name in enumerate(lowered):
            if i not in used and name == key:
                return i
    for key in keys:  # then substring
        for i, name in enumerate(lowered):
            if i not in used and key in name:
                return i
    return None


def map_generic_note(field_names: list[str], field_values: list[str]) -> dict | None:
    used: set[int] = set()

    def take(keys: list[str]) -> str | None:
        i = _pick(field_names, keys, used)
        if i is None or i >= len(field_values):
            return None
        used.add(i)
        return field_values[i]

    front_raw = take(FRONT_KEYS)
    back_raw = take(BACK_KEYS)
    definition_raw = take(DEF_KEYS)
    pron_raw = take(PRON_KEYS)
    example_raw = take(EX_KEYS)

    # positional fallback
    if front_raw is None:
        if 0 in used or not field_values:
            return None
        front_raw = field_values[0]
        used.add(0)
    if back_raw is None and definition_raw is not None:
        back_raw, definition_raw = definition_raw, None
    if back_raw is None:
        if 1 in used or len(field_values) < 2:
            return None
        back_raw = field_values[1]
        used.add(1)

    front = clean_html(strip_cloze(front_raw))
    back = clean_html(strip_cloze(back_raw))
    if not front or not back:
        return None

    sounds = [m for v in field_values for m in SOUND_RE.findall(v)]
    image = next((img for v in field_values if (img := extract_image(v))), None)

    return {
        "order": 0,
        "keyword": front,
        "viet": back,
        "pronunciation": clean_html(pron_raw) or None if pron_raw else None,
        "definition": clean_html(strip_cloze(definition_raw)) or None if definition_raw else None,
        "example": clean_html(strip_cloze(example_raw)) or None if example_raw else None,
        "word_sound": sounds[0] if sounds else None,
        "image": image,
        "example_sound": sounds[1] if len(sounds) > 1 else None,
    }
```

- [ ] **Step 4: Chạy pass** — `conda run -n flashcard python -m pytest tests/test_anki_importer.py -q` → 5 PASS
- [ ] **Step 5: Commit** — `git add backend/app/services/anki_importer.py backend/tests/test_anki_importer.py && git commit -m "feat: add generic Anki note mapper"`

---

### Task 2: Core `import_collection` + wrapper `import_apkg` / `import_extracted_dir` + CLI

**Files:**
- Modify: `backend/app/services/anki_importer.py` (thêm phần đọc collection/zip/media)
- Modify: `backend/import_anki.py` (thành lớp mỏng gọi service)
- Test: `backend/tests/test_anki_importer.py` (thêm fixture builder + tests)

**Interfaces:**
- Consumes: `map_generic_note`, `parse_note`, models Deck/Card/Review, `ImportSummary`, `ApkgFormatError`.
- Produces:
  - `import_collection(collection_path: Path, media_reader: Callable[[str], bytes | None], db: Session, media_dest: Path) -> ImportSummary`
  - `import_apkg(apkg_path: Path, db: Session, media_dest: Path = DEFAULT_MEDIA_DEST) -> ImportSummary`
  - `import_extracted_dir(dir_path: Path, db: Session, media_dest: Path = DEFAULT_MEDIA_DEST) -> ImportSummary`
  - `DEFAULT_MEDIA_DEST = Path(__file__).resolve().parents[2] / "data" / "media"`

- [ ] **Step 1: Viết fixture builder + tests fail** — thêm vào `backend/tests/test_anki_importer.py`:

```python
import json
import sqlite3
import zipfile
from pathlib import Path

import pytest

from app.services.anki_importer import ApkgFormatError, import_apkg


def make_apkg(
    path: Path,
    *,
    model_name: str = "Basic",
    field_names: list[str] | None = None,
    notes: list[tuple[str, ...]] | None = None,
    deck_name: str = "My Deck",
    media_files: dict[str, bytes] | None = None,
    collection_entry: str = "collection.anki2",
) -> Path:
    """Build a minimal legacy-format .apkg for tests."""
    field_names = field_names or ["Front", "Back"]
    notes = notes if notes is not None else [("hello", "xin chào")]
    tmp = path.parent / "collection.tmp"
    con = sqlite3.connect(tmp)
    con.execute("CREATE TABLE col (id INTEGER PRIMARY KEY, models TEXT, decks TEXT)")
    con.execute("CREATE TABLE notes (id INTEGER PRIMARY KEY, mid INTEGER, flds TEXT)")
    con.execute("CREATE TABLE cards (id INTEGER PRIMARY KEY, nid INTEGER, did INTEGER)")
    models = {"1001": {"name": model_name, "flds": [{"name": n, "ord": i} for i, n in enumerate(field_names)]}}
    decks = {"1": {"name": deck_name}}
    con.execute("INSERT INTO col VALUES (1, ?, ?)", (json.dumps(models), json.dumps(decks)))
    for i, flds in enumerate(notes, start=1):
        con.execute("INSERT INTO notes VALUES (?, 1001, ?)", (i, "\x1f".join(flds)))
        con.execute("INSERT INTO cards VALUES (?, ?, 1)", (i, i))
    con.commit()
    con.close()
    with zipfile.ZipFile(path, "w") as zf:
        zf.write(tmp, collection_entry)
        media_map = {}
        for idx, (name, data) in enumerate((media_files or {}).items()):
            zf.writestr(str(idx), data)
            media_map[str(idx)] = name
        zf.writestr("media", json.dumps(media_map))
    tmp.unlink()
    return path


def test_import_apkg_creates_deck_cards_reviews(db, tmp_path):
    from app.models.card import Card
    from app.models.deck import Deck
    from app.models.review import Review

    apkg = make_apkg(
        tmp_path / "deck.apkg",
        field_names=["Word", "Meaning"],
        notes=[("hello [sound:hi.mp3]", "xin chào <img src='hi.jpg'>"), ("cat", "con mèo")],
        deck_name="English::Basics",
        media_files={"hi.mp3": b"MP3DATA", "hi.jpg": b"JPGDATA"},
    )
    summary = import_apkg(apkg, db, media_dest=tmp_path / "media")

    assert summary.decks_created == 1
    assert summary.cards_created == 2
    deck = db.query(Deck).filter(Deck.name == "English · Basics").one()
    cards = db.query(Card).filter(Card.deck_id == deck.id).all()
    assert {c.front_text for c in cards} == {"hello", "cat"}
    hello = next(c for c in cards if c.front_text == "hello")
    assert hello.audio_url == "/media/hi.mp3"
    assert hello.image_url == "/media/hi.jpg"
    assert (tmp_path / "media" / "hi.mp3").read_bytes() == b"MP3DATA"
    assert db.query(Review).count() == 2


def test_import_apkg_idempotent_by_deck_name(db, tmp_path):
    apkg = make_apkg(tmp_path / "deck.apkg")
    import_apkg(apkg, db, media_dest=tmp_path / "media")
    summary2 = import_apkg(apkg, db, media_dest=tmp_path / "media")
    assert summary2.decks_created == 0
    assert summary2.decks_skipped == 1
    assert summary2.cards_created == 0


def test_import_apkg_media_name_collision(db, tmp_path):
    media_dest = tmp_path / "media"
    apkg1 = make_apkg(tmp_path / "a.apkg", deck_name="Deck A",
                      notes=[("one [sound:a.mp3]", "một")], media_files={"a.mp3": b"AAA"})
    apkg2 = make_apkg(tmp_path / "b.apkg", deck_name="Deck B",
                      notes=[("two [sound:a.mp3]", "hai")], media_files={"a.mp3": b"DIFFERENT"})
    import_apkg(apkg1, db, media_dest=media_dest)
    import_apkg(apkg2, db, media_dest=media_dest)

    from app.models.card import Card
    two = db.query(Card).filter(Card.front_text == "two").one()
    assert two.audio_url != "/media/a.mp3"          # đổi tên vì nội dung khác
    assert two.audio_url.startswith("/media/")
    renamed = two.audio_url.removeprefix("/media/")
    assert (media_dest / renamed).read_bytes() == b"DIFFERENT"
    assert (media_dest / "a.mp3").read_bytes() == b"AAA"  # file cũ nguyên vẹn


def test_import_apkg_rejects_new_format(db, tmp_path):
    p = tmp_path / "new.apkg"
    with zipfile.ZipFile(p, "w") as zf:
        zf.writestr("collection.anki21b", b"zstd...")
        zf.writestr("media", b"\x00proto")  # không phải JSON
    with pytest.raises(ApkgFormatError):
        import_apkg(p, db, media_dest=tmp_path / "media")


def test_import_apkg_prefers_anki21(db, tmp_path):
    # zip có cả anki2 (stub 0 notes) lẫn anki21 (dữ liệu thật) -> phải đọc anki21
    stub = make_apkg(tmp_path / "stub.apkg", notes=[], deck_name="Stub")
    real = make_apkg(tmp_path / "real.apkg", notes=[("dog", "con chó")],
                     deck_name="Real Deck", collection_entry="collection.anki21")
    combined = tmp_path / "combo.apkg"
    with zipfile.ZipFile(combined, "w") as zf:
        with zipfile.ZipFile(stub) as zs:
            zf.writestr("collection.anki2", zs.read("collection.anki2"))
        with zipfile.ZipFile(real) as zr:
            zf.writestr("collection.anki21", zr.read("collection.anki21"))
        zf.writestr("media", "{}")
    summary = import_apkg(combined, db, media_dest=tmp_path / "media")
    assert summary.cards_created == 1
```

- [ ] **Step 2: Chạy fail** — `conda run -n flashcard python -m pytest tests/test_anki_importer.py -q` → FAIL (ImportError import_apkg)
- [ ] **Step 3: Implement** — thêm vào `anki_importer.py`:

```python
import hashlib
import json
import re
import sqlite3
import tempfile
import zipfile
from pathlib import Path
from typing import Callable
from datetime import date

from sqlalchemy.orm import Session

from app.models.card import Card
from app.models.deck import Deck
from app.models.review import Review
from app.services.anki_parser import parse_note

DEFAULT_MEDIA_DEST = Path(__file__).resolve().parents[2] / "data" / "media"
BOOK_MODEL_RE = re.compile(r"4000Book(\d+)")
MAX_WARNINGS = 10


def _deck_display_name(anki_deck_name: str, model_name: str) -> str:
    leaf = anki_deck_name.split("::")[-1].strip()
    m = BOOK_MODEL_RE.fullmatch(model_name)
    if m:
        book = int(m.group(1))
        suffix = "4000 Essential Words" if book == 1 else f"4000 Essential Words Book {book}"
        return f"{leaf} · {suffix}"
    return anki_deck_name.replace("::", " · ").strip()


def _warn(summary: ImportSummary, msg: str) -> None:
    if len(summary.warnings) < MAX_WARNINGS:
        summary.warnings.append(msg)


class _MediaStore:
    """Copies referenced media into media_dest, handling name collisions."""

    def __init__(self, media_reader: Callable[[str], bytes | None], media_dest: Path):
        self._read = media_reader
        self._dest = media_dest
        self._resolved: dict[str, str | None] = {}

    def url_for(self, filename: str | None, summary: ImportSummary) -> str | None:
        if not filename:
            return None
        if filename in self._resolved:
            name = self._resolved[filename]
            return f"/media/{name}" if name else None
        data = self._read(filename)
        if data is None:
            _warn(summary, f"Thiếu file media: {filename}")
            self._resolved[filename] = None
            return None
        safe = Path(filename).name  # chặn zip-slip
        self._dest.mkdir(parents=True, exist_ok=True)
        target = self._dest / safe
        if target.exists() and target.stat().st_size != len(data):
            safe = f"{hashlib.sha1(data).hexdigest()[:8]}_{safe}"
            target = self._dest / safe
        if not target.exists():
            target.write_bytes(data)
        self._resolved[filename] = safe
        return f"/media/{safe}"


def import_collection(
    collection_path: Path,
    media_reader: Callable[[str], bytes | None],
    db: Session,
    media_dest: Path,
) -> ImportSummary:
    summary = ImportSummary()
    con = sqlite3.connect(collection_path)
    try:
        row = con.execute("SELECT models, decks FROM col").fetchone()
        if not row:
            raise ApkgFormatError(NEW_FORMAT_MSG)
        models = json.loads(row[0] or "{}")
        deck_names = {int(k): v["name"] for k, v in json.loads(row[1] or "{}").items()}
        if not models:
            raise ApkgFormatError(NEW_FORMAT_MSG)

        field_names_by_mid = {
            int(mid): [f["name"] for f in sorted(m.get("flds", []), key=lambda f: f.get("ord", 0))]
            for mid, m in models.items()
        }
        model_name_by_mid = {int(mid): m["name"] for mid, m in models.items()}

        notes_by_deck: dict[int, list[tuple[int, str]]] = {}
        seen: set[int] = set()
        for nid, mid, flds, did in con.execute(
            "SELECT n.id, n.mid, n.flds, c.did FROM notes n JOIN cards c ON c.nid = n.id"
        ):
            if nid in seen:
                continue
            seen.add(nid)
            notes_by_deck.setdefault(did, []).append((mid, flds))
    finally:
        con.close()

    store = _MediaStore(media_reader, media_dest)

    for did in sorted(notes_by_deck, key=lambda d: deck_names.get(d, "")):
        rows = notes_by_deck[did]
        anki_name = deck_names.get(did, f"Deck {did}")
        model_name = model_name_by_mid.get(rows[0][0], "")
        deck_name = _deck_display_name(anki_name, model_name)
        if db.query(Deck).filter(Deck.name == deck_name).first():
            summary.decks_skipped += 1
            continue

        mapped: list[dict] = []
        for mid, flds in rows:
            m_name = model_name_by_mid.get(mid, "")
            values = flds.split("\x1f")
            if BOOK_MODEL_RE.fullmatch(m_name):
                note = parse_note(flds)
            else:
                note = map_generic_note(field_names_by_mid.get(mid, []), values)
            if note is None:
                summary.cards_skipped += 1
                continue
            mapped.append(note)
        if not mapped:
            _warn(summary, f"Bỏ qua deck rỗng: {deck_name}")
            continue

        m = BOOK_MODEL_RE.fullmatch(model_name)
        description = (
            f"4000 Essential English Words – Book {m.group(1)} · {len(mapped)} từ kèm hình ảnh & phát âm"
            if m else f"Nhập từ Anki · {len(mapped)} thẻ"
        )
        deck = Deck(name=deck_name, description=description)
        db.add(deck)
        db.flush()

        seen_front: set[str] = set()
        for n in sorted(mapped, key=lambda x: x["order"]):
            key = n["keyword"].casefold()
            if key in seen_front:
                summary.cards_skipped += 1
                continue
            seen_front.add(key)
            card = Card(
                deck_id=deck.id,
                front_text=n["keyword"],
                back_text=n["viet"],
                pronunciation=n["pronunciation"],
                definition=n["definition"],
                example_sentence=n["example"],
                image_url=store.url_for(n["image"], summary),
                audio_url=store.url_for(n["word_sound"], summary),
                example_audio_url=store.url_for(n["example_sound"], summary),
            )
            db.add(card)
            db.flush()
            db.add(Review(card_id=card.id, due_date=date.today()))
            summary.cards_created += 1
        summary.decks_created += 1

    db.commit()
    return summary


def import_apkg(apkg_path: Path, db: Session, media_dest: Path = DEFAULT_MEDIA_DEST) -> ImportSummary:
    try:
        zf = zipfile.ZipFile(apkg_path)
    except zipfile.BadZipFile as e:
        raise ApkgFormatError("File không phải gói .apkg hợp lệ.") from e
    with zf:
        names = set(zf.namelist())
        entry = next((n in names and n for n in ("collection.anki21", "collection.anki2") if n in names), None)
        if not entry:
            raise ApkgFormatError(NEW_FORMAT_MSG)
        media_map: dict[str, str] = {}
        if "media" in names:
            try:
                media_map = json.loads(zf.read("media").decode("utf-8"))
            except (UnicodeDecodeError, json.JSONDecodeError) as e:
                raise ApkgFormatError(NEW_FORMAT_MSG) from e
        reverse = {v: k for k, v in media_map.items()}

        def media_reader(filename: str) -> bytes | None:
            num = reverse.get(filename)
            if num is None or num not in names:
                return None
            return zf.read(num)

        with tempfile.NamedTemporaryFile(suffix=".anki2", delete=False) as tmp:
            tmp.write(zf.read(entry))
            tmp_path = Path(tmp.name)
        try:
            return import_collection(tmp_path, media_reader, db, media_dest)
        finally:
            tmp_path.unlink(missing_ok=True)


def import_extracted_dir(dir_path: Path, db: Session, media_dest: Path = DEFAULT_MEDIA_DEST) -> ImportSummary:
    collection = dir_path / "collection.anki2"
    if not collection.exists():
        raise ApkgFormatError(f"Không thấy collection.anki2 trong {dir_path}")
    media_map: dict[str, str] = {}
    media_file = dir_path / "media"
    if media_file.exists():
        try:
            media_map = json.loads(media_file.read_text(encoding="utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as e:
            raise ApkgFormatError(NEW_FORMAT_MSG) from e
    reverse = {v: k for k, v in media_map.items()}

    def media_reader(filename: str) -> bytes | None:
        named = dir_path / "media_files" / Path(filename).name
        if named.exists():
            return named.read_bytes()
        num = reverse.get(filename)
        if num and (dir_path / num).exists():
            return (dir_path / num).read_bytes()
        return None

    return import_collection(collection, media_reader, db, media_dest)
```

Lưu ý dòng chọn entry — viết rõ ràng thay vì one-liner khó đọc:

```python
        entry = None
        for candidate in ("collection.anki21", "collection.anki2"):
            if candidate in names:
                entry = candidate
                break
```

- [ ] **Step 4: Viết lại `backend/import_anki.py` thành lớp mỏng**

```python
"""Import Anki data into the app DB.

Run from the backend/ directory (same cwd as uvicorn):
    python import_anki.py                          # thư mục ../extracted_anki (mặc định)
    python import_anki.py --anki-dir <dir>         # thư mục apkg đã giải nén
    python import_anki.py --apkg <file.apkg>       # file .apkg tải từ AnkiWeb
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.database import Base, SessionLocal, engine, ensure_card_columns
from app.services.anki_importer import ApkgFormatError, import_apkg, import_extracted_dir

BACKEND_DIR = Path(__file__).resolve().parent


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--anki-dir", type=Path, default=None)
    parser.add_argument("--apkg", type=Path, default=None)
    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)
    ensure_card_columns(engine)

    db = SessionLocal()
    try:
        if args.apkg:
            summary = import_apkg(args.apkg, db)
        else:
            summary = import_extracted_dir(args.anki_dir or BACKEND_DIR.parent / "extracted_anki", db)
    except ApkgFormatError as e:
        print(f"Lỗi: {e}")
        sys.exit(1)
    finally:
        db.close()

    print(f"Decks mới: {summary.decks_created} (bỏ qua {summary.decks_skipped})")
    print(f"Cards mới: {summary.cards_created} (bỏ qua {summary.cards_skipped})")
    for w in summary.warnings:
        print(f"[!] {w}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Chạy toàn bộ test + CLI smoke** —
  - `conda run -n flashcard python -m pytest -q` → PASS hết
  - `conda run -n flashcard python import_anki.py` (từ `backend/`) → phải in `Decks mới: 0 (bỏ qua 30)` (idempotent với DB thật, xác nhận naming Book 1 giữ nguyên)
- [ ] **Step 6: Commit** — `git commit -m "feat: import Anki collections from .apkg or extracted dir via shared service"`

---

### Task 3: API `POST /api/anki/import`

**Files:**
- Create: `backend/app/routers/anki_import.py`
- Create: `backend/app/schemas/anki_import.py`
- Modify: `backend/app/main.py` (include router)
- Test: `backend/tests/test_anki_import_api.py`

**Interfaces:**
- Consumes: `import_apkg(apkg_path, db)` (media_dest mặc định), `ApkgFormatError`, fixture `make_apkg` (import từ `tests.test_anki_importer`).
- Produces: endpoint `POST /api/anki/import` (multipart field `file`) → JSON `{decks_created, cards_created, decks_skipped, cards_skipped, warnings}`.

- [ ] **Step 1: Viết test fail**

```python
# backend/tests/test_anki_import_api.py
from tests.test_anki_importer import make_apkg


def test_import_endpoint_success(client, tmp_path, monkeypatch):
    from app.services import anki_importer
    monkeypatch.setattr(anki_importer, "DEFAULT_MEDIA_DEST", tmp_path / "media")
    from app.routers import anki_import as router_module
    monkeypatch.setattr(router_module, "MEDIA_DEST", tmp_path / "media", raising=False)

    apkg = make_apkg(tmp_path / "deck.apkg", notes=[("hello", "xin chào")], deck_name="API Deck")
    with open(apkg, "rb") as f:
        resp = client.post("/api/anki/import", files={"file": ("deck.apkg", f, "application/octet-stream")})
    assert resp.status_code == 200
    data = resp.json()
    assert data["decks_created"] == 1
    assert data["cards_created"] == 1


def test_import_endpoint_rejects_wrong_extension(client):
    resp = client.post("/api/anki/import", files={"file": ("notes.txt", b"hi", "text/plain")})
    assert resp.status_code == 400


def test_import_endpoint_rejects_invalid_zip(client):
    resp = client.post("/api/anki/import", files={"file": ("fake.apkg", b"not a zip", "application/octet-stream")})
    assert resp.status_code == 400
```

(Nếu monkeypatch 2 chỗ rườm rà, thiết kế router nhận media_dest qua `anki_importer.DEFAULT_MEDIA_DEST` tra cứu **lúc gọi** — xem Step 3 — thì chỉ cần patch 1 chỗ `anki_importer.DEFAULT_MEDIA_DEST`.)

- [ ] **Step 2: Chạy fail** — `conda run -n flashcard python -m pytest tests/test_anki_import_api.py -q` → FAIL 404
- [ ] **Step 3: Implement**

```python
# backend/app/schemas/anki_import.py
from pydantic import BaseModel


class AnkiImportOut(BaseModel):
    decks_created: int
    cards_created: int
    decks_skipped: int
    cards_skipped: int
    warnings: list[str]
```

```python
# backend/app/routers/anki_import.py
import shutil
import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.anki_import import AnkiImportOut
from app.services import anki_importer
from app.services.anki_importer import ApkgFormatError, import_apkg

router = APIRouter(prefix="/api/anki", tags=["anki"])


@router.post("/import", response_model=AnkiImportOut)
def import_anki_package(file: UploadFile = File(...), db: Session = Depends(get_db)):
    name = (file.filename or "").lower()
    if not name.endswith((".apkg", ".zip")):
        raise HTTPException(status_code=400, detail="Vui lòng chọn file .apkg xuất từ Anki.")

    with tempfile.NamedTemporaryFile(suffix=".apkg", delete=False) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = Path(tmp.name)
    try:
        summary = import_apkg(tmp_path, db, media_dest=anki_importer.DEFAULT_MEDIA_DEST)
    except ApkgFormatError as e:
        raise HTTPException(status_code=400, detail=str(e))
    finally:
        tmp_path.unlink(missing_ok=True)

    return AnkiImportOut(
        decks_created=summary.decks_created,
        cards_created=summary.cards_created,
        decks_skipped=summary.decks_skipped,
        cards_skipped=summary.cards_skipped,
        warnings=summary.warnings,
    )
```

`main.py`: thêm `from app.routers import anki_import` và `app.include_router(anki_import.router)` cạnh các include hiện có.

- [ ] **Step 4: Chạy toàn bộ test pass** — `conda run -n flashcard python -m pytest -q`
- [ ] **Step 5: Commit** — `git commit -m "feat: add POST /api/anki/import endpoint for apkg upload"`

---

### Task 4: Frontend — modal "Nhập từ Anki"

**Files:**
- Create: `frontend/src/api/anki.ts`
- Create: `frontend/src/components/ImportAnkiModal.tsx`
- Modify: `frontend/src/pages/HomePage.tsx` (nút mở modal + refresh sau import)

**Interfaces:**
- Consumes: endpoint Task 3.
- Produces: `importApkg(file: File): Promise<AnkiImportResult>`; `<ImportAnkiModal open onClose onImported />`.

- [ ] **Step 1: API client**

```ts
// frontend/src/api/anki.ts
import client from './client'

export interface AnkiImportResult {
  decks_created: number
  cards_created: number
  decks_skipped: number
  cards_skipped: number
  warnings: string[]
}

export const importApkg = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return client
    .post<AnkiImportResult>('/anki/import', form, { timeout: 0 })
    .then(r => r.data)
}
```

- [ ] **Step 2: Modal component**

```tsx
// frontend/src/components/ImportAnkiModal.tsx
import { useRef, useState } from 'react'
import { importApkg, type AnkiImportResult } from '../api/anki'

interface Props {
  open: boolean
  onClose: () => void
  onImported: () => void
}

export default function ImportAnkiModal({ open, onClose, onImported }: Props) {
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<AnkiImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  if (!open) return null

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.apkg')) {
      setError('Vui lòng chọn file .apkg xuất từ Anki.')
      return
    }
    setBusy(true); setError(null); setResult(null)
    try {
      const res = await importApkg(file)
      setResult(res)
      onImported()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Không thể nhập bộ thẻ. Vui lòng thử lại.')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const close = () => { setResult(null); setError(null); onClose() }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={busy ? undefined : close} />
      <div className="glass rounded-[2rem] p-8 w-full max-w-lg animate-fade-in-up relative overflow-hidden bg-[#0a0a0f] border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-[60px] pointer-events-none -translate-y-1/2 translate-x-1/2" />
        <h3 className="text-2xl font-bold text-white mb-2 flex items-center gap-3 relative z-10">
          <span className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-lg">📥</span>
          Nhập bộ thẻ từ Anki
        </h3>
        <p className="text-gray-400 text-sm mb-6 relative z-10">
          Tải bộ thẻ (.apkg) từ <span className="text-cyan-300">ankiweb.net/shared</span> rồi thả vào đây.
          Bộ 4000 Essential Words các Book khác được hỗ trợ đầy đủ; deck khác sẽ được chuyển đổi tốt nhất có thể.
        </p>

        {busy ? (
          <div className="flex flex-col items-center gap-4 py-10 relative z-10">
            <div className="w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
            <p className="text-cyan-200 font-medium">Đang nhập... file lớn có thể mất một phút</p>
          </div>
        ) : result ? (
          <div className="relative z-10 flex flex-col gap-3">
            <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-5 text-emerald-200">
              <p className="font-bold text-lg mb-2">✅ Nhập xong!</p>
              <ul className="text-sm space-y-1">
                <li>Bộ thẻ mới: <b>{result.decks_created}</b>{result.decks_skipped > 0 && ` (bỏ qua ${result.decks_skipped} đã có)`}</li>
                <li>Thẻ mới: <b>{result.cards_created}</b>{result.cards_skipped > 0 && ` (bỏ qua ${result.cards_skipped})`}</li>
              </ul>
              {result.warnings.length > 0 && (
                <ul className="text-xs text-amber-300 mt-3 space-y-0.5">
                  {result.warnings.map((w, i) => <li key={i}>⚠️ {w}</li>)}
                </ul>
              )}
            </div>
            <button onClick={close} className="btn-primary px-6 py-3 rounded-2xl font-bold self-end">Xong</button>
          </div>
        ) : (
          <div
            className={`relative z-10 rounded-2xl border-2 border-dashed p-10 text-center cursor-pointer transition-all ${
              dragging ? 'border-cyan-400 bg-cyan-500/10' : 'border-white/15 hover:border-cyan-500/50 hover:bg-white/[0.03]'
            }`}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={e => { e.preventDefault(); setDragging(false) }}
            onDrop={e => {
              e.preventDefault(); setDragging(false)
              const f = e.dataTransfer.files?.[0]
              if (f) handleFile(f)
            }}
          >
            <p className="text-4xl mb-3">🗃️</p>
            <p className="text-white font-bold">Kéo thả file .apkg vào đây</p>
            <p className="text-gray-500 text-sm mt-1">hoặc bấm để chọn file</p>
            <input ref={fileRef} type="file" accept=".apkg" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </div>
        )}

        {error && <p className="text-red-300 text-sm mt-4 relative z-10">❌ {error}</p>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: HomePage** — thêm state `showImport`, nút cạnh "+ Tạo bộ thẻ":

```tsx
<button
  onClick={() => setShowImport(true)}
  className="btn-secondary px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 border border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/10 transition-all"
>
  📥 Nhập từ Anki
</button>
```

và render `<ImportAnkiModal open={showImport} onClose={() => setShowImport(false)} onImported={load} />` cạnh modal tạo deck. (Nếu class `btn-secondary` không tồn tại trong `index.css`, dùng luôn chuỗi class border/hover ở trên mà không có `btn-secondary` — kiểm tra bằng grep trước.)

- [ ] **Step 4: Build** — `cd frontend && npm run build` → PASS
- [ ] **Step 5: Commit** — `git commit -m "feat: add Anki import modal on home page"`

---

### Task 5: Kiểm chứng end-to-end + README

**Files:**
- Modify: `README.md` (mục Quick Start + Features: cách thêm bộ thẻ mới)

- [ ] **Step 1:** `conda run -n flashcard python -m pytest -q` → PASS; `npm run build` → PASS.
- [ ] **Step 2:** Đóng gói apkg thật từ dữ liệu có sẵn (PowerShell/Python): zip `extracted_anki/collection.anki2` + `media` + các file số thành `scratchpad/Book1.apkg` (chỉ cần vài file media đầu để nhanh — nhưng đủ 30 deck notes).
- [ ] **Step 3:** Chạy app (preview backend + frontend), mở modal, upload `Book1.apkg` → kết quả phải là **0 deck mới, 30 deck bỏ qua** (idempotent, không đổi gì).
- [ ] **Step 4:** Tạo apkg giả nhỏ (deck "Test Import · Demo", 2-3 thẻ, 1 file mp3 + 1 jpg) bằng script Python nhanh → upload → deck mới hiện trên trang chủ với badge "✨ 3 từ mới"; mở học thử 1 thẻ có audio.
- [ ] **Step 5:** README: mục Quick Start thêm ghi chú "Thêm bộ thẻ khác: tải .apkg từ ankiweb.net/shared → nút 📥 Nhập từ Anki trên trang chủ"; bảng Features cập nhật ô 4000 Words: "+ import thêm bộ .apkg bất kỳ qua UI".
- [ ] **Step 6:** Sửa lỗi phát hiện được, chạy lại đến khi sạch, commit `docs: document apkg import` + commit fix nếu có.
