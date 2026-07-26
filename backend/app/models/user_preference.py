from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UserPreference(Base):
    __tablename__ = "user_preferences"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    ui_theme: Mapped[str] = mapped_column(String(10), default="system")
    accent_theme: Mapped[str] = mapped_column(String(20), default="violet-cyan")
    reduce_effects: Mapped[bool] = mapped_column(Boolean, default=False)
    daily_goal_minutes: Mapped[int] = mapped_column(Integer, default=15)
    timezone: Mapped[str] = mapped_column(String(64), default="Asia/Ho_Chi_Minh")
    work_goal: Mapped[str] = mapped_column(String(20), default="balanced")
    preferred_voice_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    preferred_voice_locale: Mapped[str | None] = mapped_column(String(16), nullable=True)
    speech_rate: Mapped[float] = mapped_column(Float, default=1.0)
    music_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    sfx_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    feedback_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    pronunciation_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    haptic_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    master_volume: Mapped[float] = mapped_column(Float, default=0.8)
    music_volume: Mapped[float] = mapped_column(Float, default=0.35)
    sfx_volume: Mapped[float] = mapped_column(Float, default=0.7)
    feedback_volume: Mapped[float] = mapped_column(Float, default=0.75)
    pronunciation_volume: Mapped[float] = mapped_column(Float, default=0.85)
    silent_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    silent_profile: Mapped[dict] = mapped_column(JSON, default=dict)
    onboarding_completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
