import uuid
from datetime import datetime, timezone, date
from sqlalchemy import String, Float, Integer, Date, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (
        CheckConstraint("ease_factor >= 1.3", name="ck_reviews_ease_factor_min"),
        CheckConstraint("interval >= 1", name="ck_reviews_interval_min"),
        CheckConstraint("repetitions >= 0", name="ck_reviews_repetitions_min"),
        CheckConstraint("last_quality IS NULL OR (last_quality >= 0 AND last_quality <= 5)", name="ck_reviews_last_quality_range"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    card_id: Mapped[str] = mapped_column(String(36), ForeignKey("cards.id", ondelete="CASCADE"), nullable=False, unique=True)
    ease_factor: Mapped[float] = mapped_column(Float, default=2.5)
    interval: Mapped[int] = mapped_column(Integer, default=1)
    repetitions: Mapped[int] = mapped_column(Integer, default=0)
    due_date: Mapped[date] = mapped_column(Date, default=date.today)
    last_quality: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    card: Mapped["Card"] = relationship("Card", back_populates="review")
