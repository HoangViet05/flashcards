"""Word-level scoring of a spoken transcript against a target sentence."""

import re
from difflib import SequenceMatcher

CONTRACTIONS = {
    "i'm": "i am", "you're": "you are", "we're": "we are", "they're": "they are",
    "he's": "he is", "she's": "she is", "it's": "it is", "that's": "that is",
    "there's": "there is", "what's": "what is", "let's": "let us",
    "i've": "i have", "you've": "you have", "we've": "we have", "they've": "they have",
    "i'll": "i will", "you'll": "you will", "he'll": "he will", "she'll": "she will",
    "we'll": "we will", "they'll": "they will", "i'd": "i would", "you'd": "you would",
    "he'd": "he would", "she'd": "she would", "we'd": "we would", "they'd": "they would",
    "don't": "do not", "doesn't": "does not", "didn't": "did not", "isn't": "is not",
    "aren't": "are not", "wasn't": "was not", "weren't": "were not", "can't": "cannot",
    "won't": "will not", "couldn't": "could not", "shouldn't": "should not",
    "wouldn't": "would not", "haven't": "have not", "hasn't": "has not", "hadn't": "had not",
}


def normalize_token(token: str) -> list[str]:
    token = token.lower().replace("’", "'")
    token = re.sub(r"[^a-z0-9']", "", token).strip("'")
    if not token:
        return []
    return CONTRACTIONS.get(token, token).split()


def normalize_words(text: str) -> list[str]:
    return [word for token in text.split() for word in normalize_token(token)]


def score_transcript(target_text: str, transcript: str) -> dict:
    display_tokens = target_text.split()
    norm_target: list[str] = []
    owners: list[int] = []
    for index, token in enumerate(display_tokens):
        for word in normalize_token(token):
            norm_target.append(word)
            owners.append(index)

    matched = [False] * len(norm_target)
    substituted = [False] * len(norm_target)
    matcher = SequenceMatcher(a=norm_target, b=normalize_words(transcript), autojunk=False)
    for tag, a_start, a_end, _b_start, _b_end in matcher.get_opcodes():
        if tag == "equal":
            for index in range(a_start, a_end):
                matched[index] = True
        elif tag == "replace":
            for index in range(a_start, a_end):
                substituted[index] = True

    words: list[dict] = []
    correct = missed = subbed = 0
    for index, token in enumerate(display_tokens):
        indices = [word_index for word_index, owner in enumerate(owners) if owner == index]
        if not indices:
            words.append({"word": token, "status": "skipped"})
        elif all(matched[word_index] for word_index in indices):
            words.append({"word": token, "status": "correct"})
            correct += 1
        elif any(substituted[word_index] for word_index in indices):
            words.append({"word": token, "status": "substituted"})
            subbed += 1
        else:
            words.append({"word": token, "status": "missed"})
            missed += 1
    scored = correct + missed + subbed
    return {"score": round(100 * correct / scored) if scored else 0, "words": words}
