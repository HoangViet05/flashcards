from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import get_settings


def _normalize_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        return url.replace("postgres://", "postgresql+psycopg://", 1)
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


DATABASE_URL = _normalize_database_url(get_settings().database_url)
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


CARD_EXTRA_COLUMNS = {
    "pronunciation": "VARCHAR(100)",
    "definition": "TEXT",
    "example_audio_url": "VARCHAR(500)",
}


def ensure_card_columns(engine_) -> None:
    """Lightweight migration: add new nullable Card columns to existing DBs."""
    inspector = inspect(engine_)
    if not inspector.has_table("cards"):
        return

    existing = {column["name"] for column in inspector.get_columns("cards")}
    with engine_.connect() as conn:
        for name, ddl in CARD_EXTRA_COLUMNS.items():
            if name not in existing:
                conn.execute(text(f'ALTER TABLE cards ADD COLUMN "{name}" {ddl}'))
        conn.commit()
