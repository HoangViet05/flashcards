from pydantic import BaseModel


class DictionaryOut(BaseModel):
    word: str
    matched_word: str
    pronunciation: str | None
    content: str
