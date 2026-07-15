"""Import an English-Vietnamese HND-format dictionary into dictionary_entries.

Usage: python scripts/import_dictionary.py data/dictionaries/anhviet.txt
"""
import re
import sys
from pathlib import Path
from typing import Iterable, Iterator

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

HEAD_RE = re.compile(r"^@(?P<word>[^/]+?)\s*(?P<pron>/[^/]*/)?\s*$")
BATCH_SIZE = 1000


def parse_hnd_format(lines: Iterable[str]) -> Iterator[dict]:
    current: dict | None = None
    body: list[str] = []

    def finish():
        if current is not None and body:
            yield {"word": current["word"], "pronunciation": current["pronunciation"], "content": "\n".join(body).strip()}

    for raw in lines:
        line = raw.rstrip("\n")
        if line.startswith("@"):
            yield from finish()
            match = HEAD_RE.match(line)
            if not match or not match.group("word").strip():
                current, body = None, []
                continue
            current = {"word": match.group("word").strip().lower(), "pronunciation": match.group("pron")}
            body = []
        elif current is not None and line.strip():
            body.append(line.strip())
    yield from finish()


def main() -> None:
    from sqlalchemy.dialects import postgresql, sqlite
    from app.database import Base, SessionLocal, engine
    import app.models  # noqa: F401
    from app.models.dictionary import DictionaryEntry

    if len(sys.argv) != 2:
        print(__doc__)
        raise SystemExit(1)
    source = Path(sys.argv[1])
    if not source.exists():
        print(f"Không thấy file: {source}")
        raise SystemExit(1)
    Base.metadata.create_all(bind=engine)
    insert = postgresql.insert if engine.dialect.name == "postgresql" else sqlite.insert
    db, total, batch = SessionLocal(), 0, []
    try:
        with source.open(encoding="utf-8", errors="replace") as handle:
            for entry in parse_hnd_format(handle):
                if len(entry["word"]) > 100:
                    continue
                batch.append(entry)
                if len(batch) >= BATCH_SIZE:
                    db.execute(insert(DictionaryEntry).values(batch).on_conflict_do_nothing(index_elements=["word"]))
                    db.commit(); total += len(batch); batch = []
        if batch:
            db.execute(insert(DictionaryEntry).values(batch).on_conflict_do_nothing(index_elements=["word"]))
            db.commit(); total += len(batch)
    finally:
        db.close()
    print(f"Hoàn tất: {total} mục từ điển.")


if __name__ == "__main__":
    main()
