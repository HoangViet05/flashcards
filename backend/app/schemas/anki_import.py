from pydantic import BaseModel


class AnkiImportOut(BaseModel):
    entries_imported: int
    entries_skipped: int
    warnings: list[str]
