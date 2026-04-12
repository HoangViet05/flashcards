from pydantic import BaseModel

class AIGenerateRequest(BaseModel):
    word: str

class AIGenerateResponse(BaseModel):
    front_text: str
    back_text: str
    example_sentence: str | None = None