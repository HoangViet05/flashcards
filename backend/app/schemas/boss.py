from datetime import date
from pydantic import BaseModel, Field


class BossCurrentOut(BaseModel):
    available: bool
    week_start: date
    snapshot_token: str | None = None
    challenge: dict | None = None
    best_score: int | None = None
    best_medal: str | None = None


class BossCompleteIn(BaseModel):
    snapshot_token: str = Field(min_length=20)
    idempotency_key: str = Field(min_length=8, max_length=128)
    vocabulary_correct: int = Field(ge=0, le=10)
    reading_correct: int = Field(ge=0, le=10)
    listening_correct: int = Field(ge=0, le=10)
    speaking_score: int | None = Field(default=None, ge=0, le=100)
    duration_seconds: int = Field(default=0, ge=0, le=1800)


class BossCompleteOut(BaseModel):
    score: int
    medal: str | None
    best_score: int
    best_medal: str | None
    xp_awarded: int
    unlocks: list[str]
    replay_available: bool = True
