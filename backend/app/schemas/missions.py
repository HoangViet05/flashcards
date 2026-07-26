from datetime import date, datetime
from pydantic import BaseModel


class MissionOut(BaseModel):
    id: str
    period_type: str
    period_start: date
    mission_key: str
    skill: str
    target: int
    progress: int
    completed_at: datetime | None
    rerolled: bool

    model_config = {"from_attributes": True}


class MissionListOut(BaseModel):
    effective_date: str
    daily: list[MissionOut]
    weekly: list[MissionOut]


class JourneyCheckpoint(BaseModel):
    date: str
    active: bool


class JourneyLane(BaseModel):
    skill: str
    checkpoints: list[JourneyCheckpoint]


class JourneyOut(BaseModel):
    week_start: date
    timezone: str
    lanes: list[JourneyLane]
    boss_available: bool
