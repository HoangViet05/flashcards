"""Parse notes from the 4000 Essential English Words Anki collection.

Field layout of the `4000Book1` note model:
0 №, 1 Keyword, 2 Suggestion, 3 Short Vietnamese, 4 Keyword_Sound,
5 Image, 6 Transcription, 7 Explanation, 8 Meaning_Sound,
9 Example_Sound, 10 Full Vietnamese
"""
import html
import re

FIELD_SEP = "\x1f"

SOUND_RE = re.compile(r"\[sound:([^\]]+)\]")
IMG_RE = re.compile(r"<img[^>]+src=['\"]?([^'\">\s]+)['\"]?")
CLOZE_RE = re.compile(r"\{\{c\d+::(.*?)(?:::[^}]*)?\}\}")
TAG_RE = re.compile(r"<[^>]+>")


def extract_sound(field: str) -> str | None:
    m = SOUND_RE.search(field)
    return m.group(1) if m else None


def extract_image(field: str) -> str | None:
    m = IMG_RE.search(field)
    return m.group(1) if m else None


def strip_cloze(text: str) -> str:
    return CLOZE_RE.sub(r"\1", text)


def clean_html(text: str) -> str:
    text = re.sub(r"<br\s*/?>", " ", text)
    text = TAG_RE.sub(" ", text)
    text = html.unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def split_explanation(text: str) -> tuple[str, str]:
    """Explanation field = English definition + '→' + example sentence."""
    text = strip_cloze(text)
    definition, _, example = text.partition("→")
    return clean_html(definition), clean_html(example)


def parse_note(flds: str) -> dict:
    f = flds.split(FIELD_SEP)
    definition, example = split_explanation(f[7])
    order = clean_html(f[0])
    return {
        "order": int(order) if order.isdigit() else 0,
        "keyword": clean_html(f[1]),
        "viet": clean_html(f[3]),
        "pronunciation": clean_html(f[6]) or None,
        "definition": definition or None,
        "example": example or None,
        "word_sound": extract_sound(f[4]),
        "image": extract_image(f[5]),
        "example_sound": extract_sound(f[9]),
    }
