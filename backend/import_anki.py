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
