from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ShadowCardOut(BaseModel):
    id: str
    front_text: str
    example_sentence: str
    example_audio_url: str
    pronunciation: str | None
    model_config = {"from_attributes": True}


class ShadowSegment(BaseModel):
    start: float = Field(ge=0)
    end: float = Field(ge=0)
    text: str = Field(min_length=1, max_length=1000)


class ShadowVideoCreate(BaseModel):
    youtube_id: str = Field(min_length=1, max_length=20)
    title: str = Field(min_length=1, max_length=500)
    duration_s: int | None = None
    segments: list[ShadowSegment] = Field(min_length=1, max_length=2000)


class ShadowVideoListItem(BaseModel):
    id: str
    youtube_id: str
    title: str
    duration_s: int | None
    segment_count: int
    created_at: datetime


class ShadowVideoOut(ShadowVideoListItem):
    segments: list[ShadowSegment]


class ShadowWordResult(BaseModel):
    word: str
    status: Literal["correct", "missed", "substituted", "skipped"]


class ShadowAttemptCreate(BaseModel):
    source_type: Literal["card", "article", "youtube"]
    card_id: str | None = None
    article_id: str | None = None
    video_id: str | None = None
    segment_index: int | None = None
    target_text: str = Field(min_length=1)
    transcript: str
    score: int = Field(ge=0, le=100)
    word_results: list[ShadowWordResult]


class ShadowAttemptOut(BaseModel):
    id: str
    created_at: datetime
    model_config = {"from_attributes": True}


class ShadowingDayStat(BaseModel):
    date: str
    count: int
    avg_score: float | None


class ShadowingStatsOut(BaseModel):
    total_attempts: int
    attempts_7d: int
    avg_score_7d: float | None
    by_day: list[ShadowingDayStat]
