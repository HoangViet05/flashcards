from tests.test_anki_importer import make_apkg


def test_import_endpoint_success(client, tmp_path, monkeypatch):
    from app.services import anki_importer
    monkeypatch.setattr(anki_importer, "DEFAULT_MEDIA_DEST", tmp_path / "media")

    apkg = make_apkg(tmp_path / "deck.apkg", notes=[("hello", "xin chào")], deck_name="API Deck")
    with open(apkg, "rb") as f:
        resp = client.post("/api/anki/import", files={"file": ("deck.apkg", f, "application/octet-stream")})
    assert resp.status_code == 200
    data = resp.json()
    assert data["entries_imported"] == 1
    assert data["entries_skipped"] == 0

    library = client.get("/api/anki/library")
    assert library.status_code == 200
    assert library.json()["total"] == 1
    assert library.json()["sources"] == [{"name": "API Deck", "entry_count": 1}]
    assert library.json()["entries"][0]["front_text"] == "hello"


def test_anki_library_search_and_user_scope(client, user_b_client, db):
    from app.models.anki_entry import AnkiEntry
    from app.models.user import User

    user = db.query(User).filter(User.email == "usera@test.com").one()
    db.add(AnkiEntry(
        user_id=user.id,
        normalized_word="library",
        front_text="library",
        back_text="thư viện",
        source_deck="My Anki deck",
        fingerprint="anki-library-scope-test",
    ))
    db.commit()
    assert client.get("/api/anki/library", params={"search": "libr"}).json()["total"] == 1
    assert client.get("/api/anki/library", params={"search": "missing"}).json()["entries"] == []
    assert user_b_client.get("/api/anki/library").json()["total"] == 0


def test_import_endpoint_rejects_wrong_extension(client):
    resp = client.post("/api/anki/import", files={"file": ("notes.txt", b"hi", "text/plain")})
    assert resp.status_code == 400


def test_import_endpoint_rejects_invalid_zip(client):
    resp = client.post("/api/anki/import", files={"file": ("fake.apkg", b"not a zip", "application/octet-stream")})
    assert resp.status_code == 400


def test_import_requires_auth(anon_client):
    resp = anon_client.post(
        "/api/anki/import",
        files={"file": ("x.apkg", b"zz", "application/zip")},
    )
    assert resp.status_code == 401
