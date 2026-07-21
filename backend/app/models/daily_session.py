import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DailySession(Base):
    __tablename__ = "daily_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    session_date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="learning")
    phase: Mapped[str] = mapped_column(String(20), nullable=False, default="review")
    puzzle_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    words: Mapped[list["DailySessionWord"]] = relationship(
        "DailySessionWord", back_populates="session", cascade="all, delete-orphan"
    )


class DailySessionWord(Base):
    __tablename__ = "daily_session_words"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id: Mapped[str] = mapped_column(String(36), ForeignKey("daily_sessions.id"), nullable=False, index=True)
    card_id: Mapped[str] = mapped_column(String(36), ForeignKey("cards.id"), nullable=False)
    is_new: Mapped[bool] = mapped_column(Boolean, nullable=False)
    assigned_step: Mapped[str] = mapped_column(String(20), nullable=False)
    steps_done: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    wrong_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    hint_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    learning_quality: Mapped[int | None] = mapped_column(Integer, nullable=True)
    in_game: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    game_found: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    game_correct: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    prev_ease: Mapped[float] = mapped_column(Float, nullable=False)
    prev_interval: Mapped[int] = mapped_column(Integer, nullable=False)
    prev_reps: Mapped[int] = mapped_column(Integer, nullable=False)

    session: Mapped["DailySession"] = relationship("DailySession", back_populates="words")
    card: Mapped["Card"] = relationship("Card")


from app.models.card import Card  # noqa: E402,F401
