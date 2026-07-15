from datetime import datetime

from pydantic import BaseModel, model_validator


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
    created_at: datetime

    model_config = {"from_attributes": True}


class ArticleOut(BaseModel):
    id: str
    title: str
    source_type: str
    content: str
    source_url: str | None
    document_id: str | None
    summary: str | None
    word_count: int
    created_at: datetime

    model_config = {"from_attributes": True}
