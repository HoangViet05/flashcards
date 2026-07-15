from pydantic import BaseModel
from datetime import date, datetime


class ReviewSubmit(BaseModel):
    quality: int  # 0-5
    auto_quality: int | None = None
    rating_source: str = "flip"
    response_time_ms: int | None = None
    flip_count: int | None = None
    audio_play_count: int | None = None
    answer_mode: str | None = None
    answer_correct: bool | None = None
    attempt_count: int | None = None


class ReviewOut(BaseModel):
    id: str
    card_id: str
    ease_factor: float
    interval: int
    repetitions: int
    due_date: date
    last_quality: int | None
    last_auto_quality: int | None
    last_rating_source: str | None
    last_response_time_ms: int | None
    last_flip_count: int | None
    last_audio_play_count: int | None
    last_answer_mode: str | None
    last_answer_correct: bool | None
    last_attempt_count: int | None
    reviewed_at: datetime | None

    model_config = {"from_attributes": True}


class StatsOut(BaseModel):
    streak: int
    total_cards: int
    total_reviewed_today: int
    due_today: int
    new_cards: int
    due_upcoming: dict[str, int]
    mastered_cards: int = 0
    total_reviews: int = 0
    reviews_by_source: dict[str, int] = {}


class HeatmapDay(BaseModel):
    date: str
    count: int
