from app.services.anki_parser import (
    clean_html,
    extract_image,
    extract_sound,
    parse_note,
    split_explanation,
    strip_cloze,
)

FLDS_AFRAID = (
    "1\x1fafraid\x1f<div>a__ __ __ __d</div>\x1fSợ hãi\x1f[sound:4000B1_afraid.mp3]"
    "\x1f<img src='4000B1_001.jpg'>\x1f[ə'freɪd]"
    "\x1f<div>When someone is {{c1::afraid}}, they feel fear.</div>→ &nbsp;The woman was {{c1::afraid}} of what she saw."
    "\x1f[sound:4000B1_afraid_meaning.mp3]\x1f[sound:4000B1_afraid_example.mp3]\x1f<div><i>full viet dict</i></div>"
)


def test_extract_sound():
    assert extract_sound("[sound:4000B1_afraid.mp3]") == "4000B1_afraid.mp3"
    assert extract_sound("") is None


def test_extract_image():
    assert extract_image("<img src='4000B1_001.jpg'>") == "4000B1_001.jpg"
    assert extract_image('<img src="a.png">') == "a.png"
    assert extract_image("") is None


def test_strip_cloze():
    assert strip_cloze("I {{c1::agree}} with you.") == "I agree with you."
    assert strip_cloze("{{c2::hint::extra}} text") == "hint text"


def test_clean_html_collapses_tags_and_entities():
    assert clean_html("<div>A: good.</div>&nbsp; <div>B: yes.</div>") == "A: good. B: yes."


def test_split_explanation():
    definition, example = split_explanation(
        "<div>When someone is {{c1::afraid}}, they feel fear.</div>→ &nbsp;The woman was {{c1::afraid}} of what she saw."
    )
    assert definition == "When someone is afraid, they feel fear."
    assert example == "The woman was afraid of what she saw."


def test_parse_note_full():
    n = parse_note(FLDS_AFRAID)
    assert n["order"] == 1
    assert n["keyword"] == "afraid"
    assert n["viet"] == "Sợ hãi"
    assert n["pronunciation"] == "[ə'freɪd]"
    assert n["definition"] == "When someone is afraid, they feel fear."
    assert n["example"] == "The woman was afraid of what she saw."
    assert n["word_sound"] == "4000B1_afraid.mp3"
    assert n["image"] == "4000B1_001.jpg"
    assert n["example_sound"] == "4000B1_afraid_example.mp3"
