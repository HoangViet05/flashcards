from pydantic import BaseModel
from datetime import date, datetime


class ReviewSubmit(BaseModel):
    quality: int  # 0-5


class ReviewOut(BaseModel):
    id: str
    card_id: str
    ease_factor: float
    interval: int
    repetitions: int
    due_date: date
    last_quality: int | None
    reviewed_at: datetime | None

    model_config = {"from_attributes": True}


class StatsOut(BaseModel):
    streak: int
    total_cards: int
    total_reviewed_today: int
    due_today: int
    due_upcoming: dict[str, int]
