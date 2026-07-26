"""Import committed catalog JSON files. This script never calls external services."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.catalog_import import import_records

CATALOG_DIR = Path(__file__).resolve().parents[1] / "data" / "catalog"


def main() -> None:
    from app.database import Base, SessionLocal, engine
    import app.models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        total_created = total_updated = 0
        for path in sorted(CATALOG_DIR.glob("*.json")):
            created, updated = import_records(json.loads(path.read_text(encoding="utf-8")), db)
            print(f"{path.name}: created {created}, updated {updated}")
            total_created += created
            total_updated += updated
        print(f"Total: created {total_created}, updated {total_updated}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
