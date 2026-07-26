import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class UserUnlock(Base):
    __tablename__ = "user_unlocks"
    __table_args__ = (UniqueConstraint("user_id", "unlock_key", name="uq_user_unlock_key"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    unlock_key: Mapped[str] = mapped_column(String(80), nullable=False)
    unlock_type: Mapped[str] = mapped_column(String(30), nullable=False)
    unlocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
