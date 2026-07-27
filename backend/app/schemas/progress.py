from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Skill = Literal["vocabulary", "reading", "listening", "speaking"]


class LearningEventIn(BaseModel):
    event_type: Literal["answer_correct", "answer_corrected", "reading_complete", "shadowing_scored", "shadowing_offline", "duration", "mission_progress"]
    skill: Skill
    idempotency_key: str = Field(min_length=8, max_length=128)
    source_type: str | None = Field(default=None, max_length=40)
    source_id: str | None = Field(default=None, max_length=128)
    duration_seconds: int = Field(default=0, ge=0, le=3600)
    metric_value: int | None = Field(default=None, ge=0, le=10000)
    payload: dict = Field(default_factory=dict)
    occurred_at: datetime | None = None


class EventBatchIn(BaseModel):
    events: list[LearningEventIn] = Field(min_length=1, max_length=50)


class EventResult(BaseModel):
    idempotency_key: str
    accepted: bool
    duplicate: bool = False
    xp_awarded: int = 0
    skill: Skill


class EventBatchOut(BaseModel):
    events: list[EventResult]
    xp_awarded: int
    mission_updates: list[str] = []


class SkillOverview(BaseModel):
    skill: Skill
    xp: int
    level: int
    mastery: int | None
    building_signal: bool


class ProgressOverview(BaseModel):
    server_time: datetime
    effective_date: str
    streak: int
    total_xp: int
    level: int
    study_minutes_today: int
    study_minutes_week: int
    remembered_cards: int
    retention: int | None
    retention_samples: int
    reviews_today: int
    reviews_week: int
    reviews_total: int
    total_cards: int
    learning_cards: int
    due_cards: int
    deck_count: int
    active_days_28: int
    skills: list[SkillOverview]
    heatmap: dict[str, int]
    unlocks: list[str]
