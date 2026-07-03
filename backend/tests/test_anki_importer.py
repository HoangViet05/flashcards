import json
import sqlite3
import zipfile
from pathlib import Path

import pytest

from app.services.anki_importer import ApkgFormatError, import_apkg, map_generic_note


def make_apkg(
    path: Path,
    *,
    model_name: str = "Basic",
    field_names: list[str] | None = None,
    notes: list[tuple[str, ...]] | None = None,
    deck_name: str = "My Deck",
    media_files: dict[str, bytes] | None = None,
    collection_entry: str = "collection.anki2",
) -> Path:
    """Build a minimal legacy-format .apkg for tests."""
    field_names = field_names or ["Front", "Back"]
    notes = notes if notes is not None else [("hello", "xin chào")]
    tmp = path.parent / f"{path.stem}.collection.tmp"
    con = sqlite3.connect(tmp)
    con.execute("CREATE TABLE col (id INTEGER PRIMARY KEY, models TEXT, decks TEXT)")
    con.execute("CREATE TABLE notes (id INTEGER PRIMARY KEY, mid INTEGER, flds TEXT)")
    con.execute("CREATE TABLE cards (id INTEGER PRIMARY KEY, nid INTEGER, did INTEGER)")
    models = {"1001": {"name": model_name, "flds": [{"name": n, "ord": i} for i, n in enumerate(field_names)]}}
    decks = {"1": {"name": deck_name}}
    con.execute("INSERT INTO col VALUES (1, ?, ?)", (json.dumps(models), json.dumps(decks)))
    for i, flds in enumerate(notes, start=1):
        con.execute("INSERT INTO notes VALUES (?, 1001, ?)", (i, "\x1f".join(flds)))
        con.execute("INSERT INTO cards VALUES (?, ?, 1)", (i, i))
    con.commit()
    con.close()
    with zipfile.ZipFile(path, "w") as zf:
        zf.write(tmp, collection_entry)
        media_map = {}
        for idx, (name, data) in enumerate((media_files or {}).items()):
            zf.writestr(str(idx), data)
            media_map[str(idx)] = name
        zf.writestr("media", json.dumps(media_map))
    tmp.unlink()
    return path


def test_import_apkg_creates_deck_cards_reviews(db, tmp_path):
    from app.models.card import Card
    from app.models.deck import Deck
    from app.models.review import Review

    apkg = make_apkg(
        tmp_path / "deck.apkg",
        field_names=["Word", "Meaning"],
        notes=[("hello [sound:hi.mp3]", "xin chào <img src='hi.jpg'>"), ("cat", "con mèo")],
        deck_name="English::Basics",
        media_files={"hi.mp3": b"MP3DATA", "hi.jpg": b"JPGDATA"},
    )
    summary = import_apkg(apkg, db, media_dest=tmp_path / "media")

    assert summary.decks_created == 1
    assert summary.cards_created == 2
    deck = db.query(Deck).filter(Deck.name == "English · Basics").one()
    cards = db.query(Card).filter(Card.deck_id == deck.id).all()
    assert {c.front_text for c in cards} == {"hello", "cat"}
    hello = next(c for c in cards if c.front_text == "hello")
    assert hello.audio_url == "/media/hi.mp3"
    assert hello.image_url == "/media/hi.jpg"
    assert (tmp_path / "media" / "hi.mp3").read_bytes() == b"MP3DATA"
    assert db.query(Review).count() == 2


def test_import_apkg_idempotent_by_deck_name(db, tmp_path):
    apkg = make_apkg(tmp_path / "deck.apkg")
    import_apkg(apkg, db, media_dest=tmp_path / "media")
    summary2 = import_apkg(apkg, db, media_dest=tmp_path / "media")
    assert summary2.decks_created == 0
    assert summary2.decks_skipped == 1
    assert summary2.cards_created == 0


def test_import_apkg_media_name_collision(db, tmp_path):
    media_dest = tmp_path / "media"
    apkg1 = make_apkg(tmp_path / "a.apkg", deck_name="Deck A",
                      notes=[("one [sound:a.mp3]", "một")], media_files={"a.mp3": b"AAA"})
    apkg2 = make_apkg(tmp_path / "b.apkg", deck_name="Deck B",
                      notes=[("two [sound:a.mp3]", "hai")], media_files={"a.mp3": b"DIFFERENT"})
    import_apkg(apkg1, db, media_dest=media_dest)
    import_apkg(apkg2, db, media_dest=media_dest)

    from app.models.card import Card
    two = db.query(Card).filter(Card.front_text == "two").one()
    assert two.audio_url != "/media/a.mp3"
    assert two.audio_url.startswith("/media/")
    renamed = two.audio_url.removeprefix("/media/")
    assert (media_dest / renamed).read_bytes() == b"DIFFERENT"
    assert (media_dest / "a.mp3").read_bytes() == b"AAA"


def test_import_apkg_rejects_new_format(db, tmp_path):
    p = tmp_path / "new.apkg"
    with zipfile.ZipFile(p, "w") as zf:
        zf.writestr("collection.anki21b", b"zstd...")
        zf.writestr("media", b"\x00proto")
    with pytest.raises(ApkgFormatError):
        import_apkg(p, db, media_dest=tmp_path / "media")


def test_import_apkg_prefers_anki21(db, tmp_path):
    # zip có cả anki2 (stub 0 notes) lẫn anki21 (dữ liệu thật) -> phải đọc anki21
    stub = make_apkg(tmp_path / "stub.apkg", notes=[], deck_name="Stub")
    real = make_apkg(tmp_path / "real.apkg", notes=[("dog", "con chó")],
                     deck_name="Real Deck", collection_entry="collection.anki21")
    combined = tmp_path / "combo.apkg"
    with zipfile.ZipFile(combined, "w") as zf:
        with zipfile.ZipFile(stub) as zs:
            zf.writestr("collection.anki2", zs.read("collection.anki2"))
        with zipfile.ZipFile(real) as zr:
            zf.writestr("collection.anki21", zr.read("collection.anki21"))
        zf.writestr("media", "{}")
    summary = import_apkg(combined, db, media_dest=tmp_path / "media")
    assert summary.cards_created == 1


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
