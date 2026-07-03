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
