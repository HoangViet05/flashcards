from pydantic import BaseModel

class AIGenerateRequest(BaseModel):
    word: str

class AIGenerateResponse(BaseModel):
    front_text: str
    back_text: str
    example_sentence: str | None = None

class AIBatchGenerateRequest(BaseModel):
    topic: str
    count: int = 5

class AIBatchGenerateResponse(BaseModel):
    cards: list[AIGenerateResponse]