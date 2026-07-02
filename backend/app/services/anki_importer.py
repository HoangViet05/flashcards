"""Import Anki collections (.apkg or extracted dir) into the app DB."""
from dataclasses import dataclass, field

from app.services.anki_parser import (
    SOUND_RE,
    clean_html,
    extract_image,
    strip_cloze,
)


class ApkgFormatError(Exception):
    """The file is not a readable legacy-format Anki package."""


NEW_FORMAT_MSG = (
    "File xuất từ Anki bản mới. Hãy export lại với tùy chọn "
    "'Support older Anki versions' được tick."
)


@dataclass
class ImportSummary:
    decks_created: int = 0
    cards_created: int = 0
    decks_skipped: int = 0
    cards_skipped: int = 0
    warnings: list[str] = field(default_factory=list)


FRONT_KEYS = ["front", "word", "keyword", "term", "expression", "vocabulary", "question"]
BACK_KEYS = ["back", "meaning", "translation", "answer", "vietnamese", "viet"]
DEF_KEYS = ["definition", "explanation", "gloss"]
PRON_KEYS = ["transcription", "ipa", "pronunciation", "phonetic", "reading"]
EX_KEYS = ["example", "sentence", "usage", "sample"]


def _pick(field_names: list[str], keys: list[str], used: set[int]) -> int | None:
    lowered = [n.casefold() for n in field_names]
    for key in keys:  # exact match first
        for i, name in enumerate(lowered):
            if i not in used and name == key:
                return i
    for key in keys:  # then substring
        for i, name in enumerate(lowered):
            if i not in used and key in name:
                return i
    return None


def map_generic_note(field_names: list[str], field_values: list[str]) -> dict | None:
    """Best-effort mapping for note models we don't know.

    Returns the same dict shape as anki_parser.parse_note, or None when the
    note has no usable front/back.
    """
    used: set[int] = set()

    def take(keys: list[str]) -> str | None:
        i = _pick(field_names, keys, used)
        if i is None or i >= len(field_values):
            return None
        used.add(i)
        return field_values[i]

    front_raw = take(FRONT_KEYS)
    back_raw = take(BACK_KEYS)
    definition_raw = take(DEF_KEYS)
    pron_raw = take(PRON_KEYS)
    example_raw = take(EX_KEYS)

    if front_raw is None:
        if 0 in used or not field_values:
            return None
        front_raw = field_values[0]
        used.add(0)
    if back_raw is None and definition_raw is not None:
        back_raw, definition_raw = definition_raw, None
    if back_raw is None:
        if 1 in used or len(field_values) < 2:
            return None
        back_raw = field_values[1]
        used.add(1)

    front = clean_html(strip_cloze(front_raw))
    back = clean_html(strip_cloze(back_raw))
    if not front or not back:
        return None

    sounds = [m for v in field_values for m in SOUND_RE.findall(v)]
    image = next((img for v in field_values if (img := extract_image(v))), None)

    return {
        "order": 0,
        "keyword": front,
        "viet": back,
        "pronunciation": (clean_html(pron_raw) or None) if pron_raw else None,
        "definition": (clean_html(strip_cloze(definition_raw)) or None) if definition_raw else None,
        "example": (clean_html(strip_cloze(example_raw)) or None) if example_raw else None,
        "word_sound": sounds[0] if sounds else None,
        "image": image,
        "example_sound": sounds[1] if len(sounds) > 1 else None,
    }
