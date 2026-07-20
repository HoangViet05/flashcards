from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class ArticleCreate(BaseModel):
    title: str | None = None
    text: str | None = None
    url: str | None = None
    document_id: str | None = None

    @model_validator(mode="after")
    def exactly_one_source(self):
        if sum(bool(value) for value in (self.text, self.url, self.document_id)) != 1:
            raise ValueError("Cung cấp đúng một nguồn: text, url hoặc document_id")
        return self


class ArticleListItem(BaseModel):
    id: str
    title: str
    source_type: str
    source_url: str | None
    word_count: int
    has_summary: bool = False
    translation_status: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ArticleOut(BaseModel):
    id: str
    title: str
    source_type: str
    content: str
    source_url: str | None
    document_id: str | None
    deck_id: str | None
    summary: str | None
    word_count: int
    created_at: datetime
    translation_status: str | None = None

    model_config = {"from_attributes": True}


class ArticleHighlightCreate(BaseModel):
    word: str
    meaning: str | None = None


class ArticleHighlightOut(BaseModel):
    id: str
    word: str
    meaning: str | None
    created_at: datetime
    anki_match: bool = False
    anki_source_deck: str | None = None

    model_config = {"from_attributes": True}


class ArticleCardCreate(BaseModel):
    word: str = Field(min_length=1, max_length=500)
    back_text: str = Field(min_length=1)
    example_sentence: str | None = None
    pronunciation: str | None = None
    definition: str | None = None
    image_url: str | None = None
    audio_url: str | None = None
    example_audio_url: str | None = None


class HighlightCardsResult(BaseModel):
    deck_id: str
    cards_created: int
    cards_skipped: int
    anki_matches: int


class TranslationRequest(BaseModel):
    force: bool = False


class TranslationSegment(BaseModel):
    source: str = Field(min_length=1, max_length=5000)
    translated: str = Field(min_length=1, max_length=5000)


class ArticleTranslationOut(BaseModel):
    id: str
    article_id: str
    status: str
    translated_content: str | None
    segments: list[TranslationSegment] | None
    error_message: str | None
    requested_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


class TranslationQueueResult(BaseModel):
    queued_count: int
    already_pending_count: int


class LocalWorkerCreate(BaseModel):
    name: str = Field(default="Máy dịch local", min_length=1, max_length=100)


class LocalWorkerOut(BaseModel):
    id: str
    name: str
    created_at: datetime
    last_seen_at: datetime | None

    model_config = {"from_attributes": True}


class LocalWorkerCreated(LocalWorkerOut):
    token: str


class WorkerClaimOut(BaseModel):
    id: str
    article_id: str
    title: str
    content: str


class WorkerComplete(BaseModel):
    translated_content: str = Field(min_length=1, max_length=2_000_000)
    segments: list[TranslationSegment] = Field(min_length=1, max_length=5000)


class WorkerFailure(BaseModel):
    error_message: str = Field(min_length=1, max_length=2000)
