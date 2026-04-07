import uuid
from datetime import datetime, timezone
from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class Card(Base):
    __tablename__ = "cards"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    deck_id: Mapped[str] = mapped_column(String(36), ForeignKey("decks.id", ondelete="CASCADE"), nullable=False)
    front_text: Mapped[str] = mapped_column(String(500), nullable=False)
    back_text: Mapped[str] = mapped_column(Text, nullable=False)
    example_sentence: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    audio_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    deck: Mapped["Deck"] = relationship("Deck", back_populates="cards")
    review: Mapped["Review | None"] = relationship("Review", back_populates="card", uselist=False, cascade="all, delete-orphan")
