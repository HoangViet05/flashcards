from datetime import datetime

from pydantic import BaseModel, Field


class CatalogListItem(BaseModel):
    id: str
    title: str
    level: int
    word_count: int
    source: str
    attribution: str
    audio_url: str | None
    suggested_word_count: int
    already_added: bool
    published_at: datetime | None


class CatalogDetail(BaseModel):
    id: str
    title: str
    content: str
    level: int
    word_count: int
    source: str
    source_url: str
    license: str
    attribution: str
    audio_url: str | None
    suggested_words: list[str]
    already_added: bool


class CatalogIngestArticle(BaseModel):
    source: str = Field(max_length=20)
    source_url: str = Field(max_length=1000)
    title: str = Field(max_length=500)
    content: str = Field(min_length=1)
    level: int = Field(ge=1, le=3)
    difficulty_score: float
    word_count: int
    license: str = Field(max_length=30)
    attribution: str = Field(max_length=500)
    audio_url: str | None = None
    suggested_words: list[str] = Field(default_factory=list)
    published_at: datetime | None = None


class CatalogIngestRequest(BaseModel):
    articles: list[CatalogIngestArticle] = Field(min_length=1, max_length=500)


class CatalogIngestResult(BaseModel):
    created: int
    updated: int
