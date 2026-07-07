"""Import Anki collections (.apkg or extracted dir) into the app DB."""
import hashlib
import json
import re
import sqlite3
import tempfile
import zipfile
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Callable

from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.card import Card
from app.models.deck import Deck
from app.models.review import Review
from app.services.anki_parser import (
    SOUND_RE,
    clean_html,
    extract_image,
    parse_note,
    strip_cloze,
)

DEFAULT_MEDIA_DEST = get_settings().media_dir
BOOK_MODEL_RE = re.compile(r"4000Book(\d+)")
MAX_WARNINGS = 10


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
    """Best-effort mapping for note models we don't know.

    Returns the same dict shape as anki_parser.parse_note, or None when the
    note has no usable front/back.
    """
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

    def clean_text(raw: str) -> str:
        return clean_html(strip_cloze(SOUND_RE.sub("", raw)))

    front = clean_text(front_raw)
    back = clean_text(back_raw)
    if not front or not back:
        return None

    sounds = [m for v in field_values for m in SOUND_RE.findall(v)]
    image = next((img for v in field_values if (img := extract_image(v))), None)

    return {
        "order": 0,
        "keyword": front,
        "viet": back,
        "pronunciation": (clean_text(pron_raw) or None) if pron_raw else None,
        "definition": (clean_text(definition_raw) or None) if definition_raw else None,
        "example": (clean_text(example_raw) or None) if example_raw else None,
        "word_sound": sounds[0] if sounds else None,
        "image": image,
        "example_sound": sounds[1] if len(sounds) > 1 else None,
    }


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
    except sqlite3.DatabaseError as e:
        raise ApkgFormatError(NEW_FORMAT_MSG) from e
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
        entry = None
        for candidate in ("collection.anki21", "collection.anki2"):
            if candidate in names:
                entry = candidate
                break
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
