import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CatalogArticle(Base):
    """Open-licensed, shared reading content; adopted copies belong to users."""

    __tablename__ = "catalog_articles"
    __table_args__ = (Index("ix_catalog_level_published", "level", "published_at"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    source: Mapped[str] = mapped_column(String(20), nullable=False)
    source_url: Mapped[str] = mapped_column(String(1000), nullable=False, unique=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    level: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    difficulty_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    word_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    license: Mapped[str] = mapped_column(String(30), nullable=False)
    attribution: Mapped[str] = mapped_column(String(500), nullable=False)
    audio_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    suggested_words: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    published_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
