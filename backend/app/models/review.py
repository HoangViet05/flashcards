import uuid
from datetime import datetime, date
from sqlalchemy import String, Float, Integer, Date, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Review(Base):
    __tablename__ = "reviews"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    card_id: Mapped[str] = mapped_column(String(36), ForeignKey("cards.id"), nullable=False, unique=True)
    ease_factor: Mapped[float] = mapped_column(Float, default=2.5)
    interval: Mapped[int] = mapped_column(Integer, default=1)
    repetitions: Mapped[int] = mapped_column(Integer, default=0)
    due_date: Mapped[date] = mapped_column(Date, default=date.today)
    last_quality: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_auto_quality: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_rating_source: Mapped[str | None] = mapped_column(String(20), nullable=True)
    last_response_time_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_flip_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_audio_play_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    last_answer_mode: Mapped[str | None] = mapped_column(String(30), nullable=True)
    last_answer_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    last_attempt_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    card: Mapped["Card"] = relationship("Card", back_populates="review")
