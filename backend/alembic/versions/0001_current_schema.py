"""baseline current app schema"""
from alembic import op
import app.models  # noqa: F401
from app.database import Base

revision = "0001_current_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    baseline = (
        "cards", "decks", "documents", "articles", "article_highlights", "article_translations",
        "dictionary_entries", "reviews", "review_logs", "users", "translation_workers", "anki_entries",
        "shadow_videos", "shadowing_attempts", "daily_sessions", "daily_session_words", "catalog_articles",
    )
    Base.metadata.create_all(op.get_bind(), tables=[Base.metadata.tables[name] for name in baseline])


def downgrade() -> None:
    # Baseline intentionally preserves pre-existing app tables on downgrade.
    pass
