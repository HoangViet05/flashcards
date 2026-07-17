import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AnkiEntry(Base):
    """A user-owned source record imported from an Anki package.

    Entries are reference data only.  A separate study Card is created when a
    reader word is explicitly saved into one of the user's decks.
    """

    __tablename__ = "anki_entries"
    __table_args__ = (UniqueConstraint("user_id", "fingerprint", name="uq_anki_entry_fingerprint"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    normalized_word: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    front_text: Mapped[str] = mapped_column(String(500), nullable=False)
    back_text: Mapped[str] = mapped_column(Text, nullable=False)
    pronunciation: Mapped[str | None] = mapped_column(String(100), nullable=True)
    definition: Mapped[str | None] = mapped_column(Text, nullable=True)
    example_sentence: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    audio_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    example_audio_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    source_deck: Mapped[str | None] = mapped_column(String(500), nullable=True)
    source_model: Mapped[str | None] = mapped_column(String(255), nullable=True)
    fingerprint: Mapped[str] = mapped_column(String(64), nullable=False)
    imported_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
