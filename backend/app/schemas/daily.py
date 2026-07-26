from datetime import date
from pydantic import BaseModel
from app.schemas.card import CardOut

class DailyWordOut(BaseModel):
    id: str; card_id: str; is_new: bool; is_weak: bool = False; assigned_step: str; steps_done: list[str]; wrong_count: int; card: CardOut
class DailySessionOut(BaseModel):
    id: str; session_date: date; status: str; phase: str; words: list[DailyWordOut]
class DailySessionResponse(BaseModel): session: DailySessionOut | None
class AnswerIn(BaseModel): card_id: str; step: str; correct: bool
class GameMeaning(BaseModel): token: str; meaning: str; hint_level: int
class GameWordChip(BaseModel): card_id: str; word: str; cells: list[list[int]] | None
class GameOut(BaseModel): size: int; grid: list[list[str]]; meanings: list[GameMeaning]; found: list[GameWordChip]; total_words: int; status: str
class FoundIn(BaseModel): start_row: int; start_col: int; end_row: int; end_col: int
class FoundOut(BaseModel): matched: GameWordChip | None
class HintIn(BaseModel): token: str
class HintOut(BaseModel): level: int; text: str
class MatchPair(BaseModel): card_id: str; token: str
class ConfirmIn(BaseModel): pairs: list[MatchPair]
class ConfirmResultItem(BaseModel): card_id: str; word: str; meaning: str; correct: bool; quality_after: int | None
class ConfirmOut(BaseModel): results: list[ConfirmResultItem]
class DailyStatusOut(BaseModel):
    new_remaining: int; low_new_words: bool; session_status: str; session_date: date | None; new_count: int; due_count: int

class LatestArticleOut(BaseModel):
    id: str; title: str; unlearned_saved_words: int

class DailyHomeOut(BaseModel):
    new_count: int; due_count: int; session_status: str
    steps_total: int; steps_done: int
    streak: int; studied_today: bool
    mastered_cards: int; total_cards: int; deck_count: int
    low_new_words: bool; new_remaining: int
    latest_article: LatestArticleOut | None
