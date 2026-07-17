from pydantic import BaseModel
from datetime import datetime


class AnkiImportOut(BaseModel):
    entries_imported: int
    entries_skipped: int
    warnings: list[str]


class AnkiLibraryDeleteOut(BaseModel):
    entries_deleted: int


class AnkiLibrarySourceOut(BaseModel):
    name: str
    entry_count: int


class AnkiLibraryEntryOut(BaseModel):
    id: str
    front_text: str
    back_text: str
    pronunciation: str | None
    definition: str | None
    example_sentence: str | None
    image_url: str | None
    audio_url: str | None
    example_audio_url: str | None
    source_deck: str | None
    imported_at: datetime

    model_config = {"from_attributes": True}


class AnkiLibraryOut(BaseModel):
    total: int
    sources: list[AnkiLibrarySourceOut]
    entries: list[AnkiLibraryEntryOut]
