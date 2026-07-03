from tests.test_anki_importer import make_apkg


def test_import_endpoint_success(client, tmp_path, monkeypatch):
    from app.services import anki_importer
    monkeypatch.setattr(anki_importer, "DEFAULT_MEDIA_DEST", tmp_path / "media")

    apkg = make_apkg(tmp_path / "deck.apkg", notes=[("hello", "xin chào")], deck_name="API Deck")
    with open(apkg, "rb") as f:
        resp = client.post("/api/anki/import", files={"file": ("deck.apkg", f, "application/octet-stream")})
    assert resp.status_code == 200
    data = resp.json()
    assert data["decks_created"] == 1
    assert data["cards_created"] == 1


def test_import_endpoint_rejects_wrong_extension(client):
    resp = client.post("/api/anki/import", files={"file": ("notes.txt", b"hi", "text/plain")})
    assert resp.status_code == 400


def test_import_endpoint_rejects_invalid_zip(client):
    resp = client.post("/api/anki/import", files={"file": ("fake.apkg", b"not a zip", "application/octet-stream")})
    assert resp.status_code == 400
