"""Pure, VOA-core-vocabulary based English reading difficulty scoring."""
import re
from functools import lru_cache
from pathlib import Path

CORE_WORDS_PATH = Path(__file__).resolve().parents[2] / "data" / "voa_core_words.txt"
WORD_RE = re.compile(r"[A-Za-z']+")
SENTENCE_SPLIT_RE = re.compile(r"[.!?]+")
_SUFFIXES = ("'s", "es", "s", "ed", "ing")


@lru_cache(maxsize=1)
def core_words() -> frozenset[str]:
    return frozenset(
        line.strip().lower() for line in CORE_WORDS_PATH.read_text(encoding="utf-8").splitlines() if line.strip()
    )


def trim_suffix(word: str) -> str:
    lowered = word.lower().strip("'")
    known = core_words()
    if lowered in known:
        return lowered
    for suffix in _SUFFIXES:
        if lowered.endswith(suffix) and len(lowered) - len(suffix) >= 2:
            stem = lowered[:-len(suffix)]
            candidates = (stem, stem + "e", stem[:-1] if len(stem) >= 2 and stem[-1] == stem[-2] else stem)
            for candidate in candidates:
                if candidate in known:
                    return candidate
    return lowered


def hard_ratio(text: str) -> float:
    tokens = WORD_RE.findall(text)
    if not tokens:
        return 0.0
    known = core_words()
    return sum(trim_suffix(token) not in known for token in tokens) / len(tokens)


def avg_sentence_len(text: str) -> float:
    tokens = WORD_RE.findall(text)
    if not tokens:
        return 0.0
    sentences = [part for part in SENTENCE_SPLIT_RE.split(text) if WORD_RE.search(part)]
    return len(tokens) / max(len(sentences), 1)


def score(text: str) -> float:
    return round(100.0 * hard_ratio(text) + avg_sentence_len(text), 2)


# Calibrated against the committed seed collection. Recalibrate from new seeds,
# rather than hand-tuning, whenever the collection changes materially.
LEVEL_2_MIN = 56.87
LEVEL_3_MIN = 59.71


def level_for(text: str) -> int:
    value = score(text)
    if value >= LEVEL_3_MIN:
        return 3
    if value >= LEVEL_2_MIN:
        return 2
    return 1
