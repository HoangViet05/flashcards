from pydantic import BaseModel
from datetime import datetime


class DeckCreate(BaseModel):
    name: str
    description: str | None = None


class DeckUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class DeckOut(BaseModel):
    id: str
    name: str
    description: str | None
    created_at: datetime
    updated_at: datetime
    card_count: int = 0
    due_count: int = 0
    new_count: int = 0

    model_config = {"from_attributes": True}
