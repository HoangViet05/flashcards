from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class DictionaryEntry(Base):
    """Shared offline English-Vietnamese dictionary entry."""

    __tablename__ = "dictionary_entries"

    word: Mapped[str] = mapped_column(String(100), primary_key=True)
    pronunciation: Mapped[str | None] = mapped_column(String(200), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
