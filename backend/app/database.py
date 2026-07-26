import sqlite3

from sqlalchemy import create_engine, event, inspect, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase

from app.config import get_settings


@event.listens_for(Engine, "connect")
def _enable_sqlite_foreign_keys(dbapi_connection, _connection_record) -> None:
    """Make SQLite honor FK actions such as ReviewLog.card_id SET NULL."""
    if isinstance(dbapi_connection, sqlite3.Connection):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


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
    "source_type": "VARCHAR(50)",
    "source_name": "VARCHAR(500)",
}

REVIEW_EXTRA_COLUMNS = {
    "last_auto_quality": "INTEGER",
    "last_rating_source": "VARCHAR(20)",
    "last_response_time_ms": "INTEGER",
    "last_flip_count": "INTEGER",
    "last_audio_play_count": "INTEGER",
    "last_answer_mode": "VARCHAR(30)",
    "last_answer_correct": "BOOLEAN",
    "last_attempt_count": "INTEGER",
}

OWNER_COLUMN_TABLES = ("decks", "documents")

ARTICLE_EXTRA_COLUMNS = {
    "deck_id": "VARCHAR(36)",
}

USER_EXTRA_COLUMNS = {
    "preferred_level": "INTEGER",
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


def ensure_review_columns(engine_) -> None:
    """Lightweight migration: add review telemetry columns to existing DBs."""
    inspector = inspect(engine_)
    if not inspector.has_table("reviews"):
        return

    existing = {column["name"] for column in inspector.get_columns("reviews")}
    with engine_.connect() as conn:
        for name, ddl in REVIEW_EXTRA_COLUMNS.items():
            if name not in existing:
                conn.execute(text(f'ALTER TABLE reviews ADD COLUMN "{name}" {ddl}'))
        conn.commit()


def ensure_owner_columns(engine_) -> None:
    """Add nullable owner columns to legacy DBs before an explicit data reset."""
    inspector = inspect(engine_)
    with engine_.connect() as conn:
        for table in OWNER_COLUMN_TABLES:
            if not inspector.has_table(table):
                continue
            existing = {column["name"] for column in inspector.get_columns(table)}
            if "user_id" not in existing:
                conn.execute(text(f'ALTER TABLE {table} ADD COLUMN "user_id" VARCHAR(36)'))
        conn.commit()


def ensure_article_columns(engine_) -> None:
    """Add the article-to-deck link for databases created before reader decks."""
    inspector = inspect(engine_)
    if not inspector.has_table("articles"):
        return
    existing = {column["name"] for column in inspector.get_columns("articles")}
    with engine_.connect() as conn:
        for name, ddl in ARTICLE_EXTRA_COLUMNS.items():
            if name not in existing:
                conn.execute(text(f'ALTER TABLE articles ADD COLUMN "{name}" {ddl}'))
        conn.commit()


def ensure_user_columns(engine_) -> None:
    """Add nullable user preferences to legacy databases."""
    inspector = inspect(engine_)
    if not inspector.has_table("users"):
        return
    existing = {column["name"] for column in inspector.get_columns("users")}
    with engine_.connect() as conn:
        for name, ddl in USER_EXTRA_COLUMNS.items():
            if name not in existing:
                conn.execute(text(f'ALTER TABLE users ADD COLUMN "{name}" {ddl}'))
        conn.commit()
