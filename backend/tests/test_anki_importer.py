from app.services.anki_importer import map_generic_note


def test_generic_maps_named_fields():
    n = map_generic_note(
        ["Word", "Meaning", "IPA", "Example", "Extra"],
        ["hello", "xin chào", "/həˈloʊ/", "<i>Hello there!</i>", "[sound:hi.mp3] rồi [sound:hi_ex.mp3] <img src='hi.jpg'>"],
    )
    assert n["keyword"] == "hello"
    assert n["viet"] == "xin chào"
    assert n["pronunciation"] == "/həˈloʊ/"
    assert n["example"] == "Hello there!"
    assert n["word_sound"] == "hi.mp3"
    assert n["example_sound"] == "hi_ex.mp3"
    assert n["image"] == "hi.jpg"


def test_generic_falls_back_to_positional():
    n = map_generic_note(["A", "B"], ["dog", "con chó"])
    assert n["keyword"] == "dog"
    assert n["viet"] == "con chó"


def test_generic_uses_definition_as_back_when_no_back():
    n = map_generic_note(["Front", "Definition"], ["cat", "a small animal"])
    assert n["keyword"] == "cat"
    assert n["viet"] == "a small animal"


def test_generic_skips_empty_note():
    assert map_generic_note(["Front", "Back"], ["<br>", "nghĩa"]) is None
    assert map_generic_note(["OnlyOne"], ["x"]) is None


def test_generic_strips_cloze_and_html():
    n = map_generic_note(["Front", "Back"], ["{{c1::run}}", "<div>chạy&nbsp;</div>"])
    assert n["keyword"] == "run"
    assert n["viet"] == "chạy"
