from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, DeclarativeBase

DATABASE_URL = "sqlite:///./flashcards.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
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
    with engine_.connect() as conn:
        existing = {row[1] for row in conn.execute(text("PRAGMA table_info(cards)"))}
        for name, ddl in CARD_EXTRA_COLUMNS.items():
            if existing and name not in existing:
                conn.execute(text(f"ALTER TABLE cards ADD COLUMN {name} {ddl}"))
        conn.commit()
