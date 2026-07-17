"""Import Anki data into the app DB.

Run from the backend/ directory (same cwd as uvicorn):
    python import_anki.py --user-email you@example.com
    python import_anki.py --user-email you@example.com --anki-dir <dir>
    python import_anki.py --user-email you@example.com --apkg <file.apkg>
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.database import Base, SessionLocal, engine, ensure_card_columns, ensure_owner_columns
from app.models.user import User
import app.models  # noqa: F401
from app.services.anki_importer import ApkgFormatError, import_apkg, import_extracted_dir

BACKEND_DIR = Path(__file__).resolve().parent


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--anki-dir", type=Path, default=None)
    parser.add_argument("--apkg", type=Path, default=None)
    parser.add_argument("--user-email", required=True, help="Email tài khoản sở hữu deck import vào")
    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)
    ensure_card_columns(engine)
    ensure_owner_columns(engine)

    db = SessionLocal()
    try:
        email = args.user_email.strip().lower()
        owner = db.query(User).filter(User.email == email).first()
        if not owner:
            print(f"Lỗi: không tìm thấy user {email} — đăng ký tài khoản trên web trước.")
            sys.exit(1)
        if args.apkg:
            summary = import_apkg(args.apkg, db, owner.id)
        else:
            summary = import_extracted_dir(
                args.anki_dir or BACKEND_DIR.parent / "extracted_anki",
                db,
                owner.id,
            )
    except ApkgFormatError as e:
        print(f"Lỗi: {e}")
        sys.exit(1)
    finally:
        db.close()

    print(f"Dữ liệu từ mới: {summary.entries_imported} (bỏ qua {summary.entries_skipped})")
    for w in summary.warnings:
        print(f"[!] {w}")


if __name__ == "__main__":
    main()
