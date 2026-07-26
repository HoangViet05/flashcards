"""learning os persistence"""
from alembic import op
import app.models  # noqa: F401
from app.database import Base

revision = "0002_learning_os"
down_revision = "0001_current_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    learning_os = ("user_preferences", "learning_events", "skill_progress", "mission_assignments", "boss_attempts", "user_unlocks")
    Base.metadata.create_all(op.get_bind(), tables=[Base.metadata.tables[name] for name in learning_os])
    inspector = __import__("sqlalchemy").inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("daily_sessions")} if inspector.has_table("daily_sessions") else set()
    if "mode" not in columns:
        op.add_column("daily_sessions", __import__("sqlalchemy").Column("mode", __import__("sqlalchemy").String(length=10), nullable=False, server_default="full"))
    if "started_at" not in columns:
        op.add_column("daily_sessions", __import__("sqlalchemy").Column("started_at", __import__("sqlalchemy").DateTime(timezone=True), nullable=True))
    if "duration_seconds" not in columns:
        op.add_column("daily_sessions", __import__("sqlalchemy").Column("duration_seconds", __import__("sqlalchemy").Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    pass
