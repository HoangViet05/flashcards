from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.dictionary import DictionaryEntry
from app.schemas.dictionary import DictionaryOut
from app.services.security import get_current_user

router = APIRouter(prefix="/api/dictionary", tags=["dictionary"], dependencies=[Depends(get_current_user)])


def lookup_candidates(word: str) -> list[str]:
    value = word.strip().lower()
    candidates = [value]
    for suffix in ("'s", "es", "s", "ed", "ing"):
        if value.endswith(suffix) and len(value) - len(suffix) >= 2:
            stem = value[:-len(suffix)]
            candidates.append(stem)
            if suffix in ("ed", "ing"):
                candidates.append(stem + "e")
                if len(stem) >= 2 and stem[-1] == stem[-2]:
                    candidates.append(stem[:-1])
    return list(dict.fromkeys(candidates))


@router.get("/{word}", response_model=DictionaryOut)
def lookup(word: str, db: Session = Depends(get_db)):
    candidates = lookup_candidates(word)
    by_word = {entry.word: entry for entry in db.query(DictionaryEntry).filter(DictionaryEntry.word.in_(candidates)).all()}
    for candidate in candidates:
        if candidate in by_word:
            entry = by_word[candidate]
            return DictionaryOut(word=word, matched_word=entry.word, pronunciation=entry.pronunciation, content=entry.content)
    raise HTTPException(status_code=404, detail="Không có trong từ điển")
