from pydantic import BaseModel
from datetime import datetime
from .review import ReviewOut


class CardCreate(BaseModel):
    front_text: str
    back_text: str
    example_sentence: str | None = None
    pronunciation: str | None = None
    definition: str | None = None
    image_url: str | None = None
    audio_url: str | None = None
    example_audio_url: str | None = None


class CardUpdate(BaseModel):
    front_text: str | None = None
    back_text: str | None = None
    example_sentence: str | None = None
    pronunciation: str | None = None
    definition: str | None = None
    image_url: str | None = None
    audio_url: str | None = None
    example_audio_url: str | None = None


class CardOut(BaseModel):
    id: str
    deck_id: str
    front_text: str
    back_text: str
    example_sentence: str | None
    pronunciation: str | None
    definition: str | None
    image_url: str | None
    audio_url: str | None
    example_audio_url: str | None
    source_type: str | None
    source_name: str | None
    created_at: datetime
    updated_at: datetime
    review: ReviewOut | None = None

    model_config = {"from_attributes": True}
