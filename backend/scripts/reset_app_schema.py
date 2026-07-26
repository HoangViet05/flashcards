"""Guarded app-only public schema reset for a verified Supabase target."""
import argparse
import os
from urllib.parse import urlparse

from sqlalchemy import create_engine, text

from app.config import get_settings
import app.models  # noqa: F401
from app.database import Base, _normalize_database_url

PHRASE = "RESET FLASHIE APP DATA"


def validate(url: str, project_ref: str, phrase: str) -> None:
    host = (urlparse(url).hostname or "").lower()
    if url.startswith("sqlite") or host in {"localhost", "127.0.0.1", "::1"}:
        raise SystemExit("Refusing local or SQLite database")
    if not project_ref or project_ref not in host:
        raise SystemExit("Supabase project ref does not match database host")
    if phrase != PHRASE:
        raise SystemExit("Confirmation phrase does not match")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-ref", required=True)
    parser.add_argument("--confirm", required=True)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    url = _normalize_database_url(get_settings().database_url)
    validate(url, args.project_ref, args.confirm)
    tables = sorted(Base.metadata.tables)
    print("App tables only:", ", ".join(tables))
    if args.dry_run:
        return
    engine = create_engine(url, pool_pre_ping=True)
    with engine.begin() as connection:
        for table in reversed(tables):
            connection.execute(text(f'DROP TABLE IF EXISTS public."{table}" CASCADE'))
    print("App tables dropped. Run alembic upgrade head next.")


if __name__ == "__main__":
    main()
