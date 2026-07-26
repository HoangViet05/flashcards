"""Pick useful study words and resolve their offline Vietnamese meanings."""
from collections import Counter

from sqlalchemy.orm import Session

from app.models.dictionary import DictionaryEntry
from app.services.article_cards import find_anki_entry
from app.services.dictionary_lookup import lookup_candidates
from app.services.readability import SENTENCE_SPLIT_RE, WORD_RE, core_words, trim_suffix

MIN_WORD_LENGTH = 4
NO_MEANING = "Chưa có nghĩa Việt"


def _sentence_initial_words(text: str) -> set[str]:
    initials: set[str] = set()
    for sentence in SENTENCE_SPLIT_RE.split(text):
        match = WORD_RE.search(sentence)
        if match:
            initials.add(match.group(0))
    return initials


def pick_words(text: str, limit: int = 10) -> list[str]:
    known = core_words()
    initials = _sentence_initial_words(text)
    counts: Counter[str] = Counter()
    first_seen: dict[str, int] = {}
    for position, token in enumerate(WORD_RE.findall(text)):
        if len(token) < MIN_WORD_LENGTH or (token[0].isupper() and token not in initials):
            continue
        stem = trim_suffix(token)
        if stem in known:
            continue
        counts[stem] += 1
        first_seen.setdefault(stem, position)
    return sorted(counts, key=lambda stem: (-counts[stem], first_seen[stem]))[:limit]


def resolve_meaning(word: str, user_id: str, db: Session) -> str:
    entry = find_anki_entry(word, user_id, db)
    if entry and entry.back_text.strip():
        return entry.back_text.strip()
    candidates = lookup_candidates(word)
    rows = {row.word: row for row in db.query(DictionaryEntry).filter(DictionaryEntry.word.in_(candidates)).all()}
    for candidate in candidates:
        row = rows.get(candidate)
        if row and row.content.strip():
            return row.content.strip().splitlines()[0].strip()
    return NO_MEANING
