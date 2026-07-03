from pydantic import BaseModel


class AnkiImportOut(BaseModel):
    decks_created: int
    cards_created: int
    decks_skipped: int
    cards_skipped: int
    warnings: list[str]
