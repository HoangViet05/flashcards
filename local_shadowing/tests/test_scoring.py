from scoring import normalize_words, score_transcript


def statuses(result):
    return [word["status"] for word in result["words"]]


def test_exact_match_scores_100():
    result = score_transcript("We need to resolve this issue.", "we need to resolve this issue")
    assert result["score"] == 100 and statuses(result) == ["correct"] * 6


def test_case_and_punctuation_ignored():
    assert score_transcript("Hello, world!", "hello world")["score"] == 100


def test_contractions_expand_on_both_sides():
    result = score_transcript("I'm happy today.", "i am happy")
    assert statuses(result) == ["correct", "correct", "missed"] and result["score"] == 67


def test_missed_and_substituted_words_are_marked():
    assert statuses(score_transcript("The quick brown fox jumps.", "the quick fox jumps")) == ["correct", "correct", "missed", "correct", "correct"]
    assert statuses(score_transcript("She sells sea shells.", "she sells big shells")) == ["correct", "correct", "substituted", "correct"]


def test_extra_and_empty_spoken_words():
    assert score_transcript("Good morning.", "well good morning everyone")["score"] == 100
    assert statuses(score_transcript("Try again.", "")) == ["missed", "missed"]


def test_symbol_only_and_curly_apostrophe():
    assert statuses(score_transcript("Wait — listen.", "wait listen")) == ["correct", "skipped", "correct"]
    assert normalize_words("don’t") == ["do", "not"]
