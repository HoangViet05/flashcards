"""Reset the configured database for the one-time multi-user schema migration.

Run from backend/:
    python scripts/reset_db.py

For production, set DATABASE_URL explicitly before running this script. After a
reset, register the owner account in the web app and import data with:
    python import_anki.py --user-email you@example.com
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

import app.models  # noqa: F401, E402
from app.database import Base, DATABASE_URL, engine  # noqa: E402


def main() -> None:
    print(f"Database: {DATABASE_URL}")
    print(
        "CẢNH BÁO: Xóa TOÀN BỘ bảng và dữ liệu "
        "(users, decks, cards, reviews, documents, review_logs)."
    )
    answer = input("Gõ YES để tiếp tục: ")
    if answer.strip() != "YES":
        print("Đã hủy.")
        return

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print(
        "Đã reset xong. Bước tiếp theo: đăng ký tài khoản rồi chạy "
        "import_anki.py --user-email <email>."
    )


if __name__ == "__main__":
    main()
