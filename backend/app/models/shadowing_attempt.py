import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ShadowingAttempt(Base):
    __tablename__ = "shadowing_attempts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    source_type: Mapped[str] = mapped_column(String(10), nullable=False)
    card_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("cards.id", ondelete="SET NULL"), nullable=True)
    article_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("articles.id", ondelete="SET NULL"), nullable=True)
    video_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("shadow_videos.id", ondelete="SET NULL"), nullable=True)
    segment_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_text: Mapped[str] = mapped_column(Text, nullable=False)
    transcript: Mapped[str] = mapped_column(Text, nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    word_results: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
