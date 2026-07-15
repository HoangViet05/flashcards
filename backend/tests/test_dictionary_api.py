from app.models.dictionary import DictionaryEntry
from app.routers.dictionary import lookup_candidates


def test_lookup_requires_auth(anon_client):
    assert anon_client.get("/api/dictionary/abandon").status_code == 401


def test_lookup_exact_and_stems(client, db):
    db.add_all([
        DictionaryEntry(word="abandon", pronunciation="/ə'bændən/", content="- bỏ, từ bỏ"),
        DictionaryEntry(word="make", pronunciation=None, content="- làm"),
        DictionaryEntry(word="run", pronunciation=None, content="- chạy"),
    ])
    db.commit()
    assert client.get("/api/dictionary/Abandon").json()["matched_word"] == "abandon"
    assert client.get("/api/dictionary/abandoned").json()["matched_word"] == "abandon"
    assert client.get("/api/dictionary/making").json()["matched_word"] == "make"
    assert client.get("/api/dictionary/running").json()["matched_word"] == "run"
    assert client.get("/api/dictionary/xyzzy").status_code == 404
    assert lookup_candidates("Running")[0] == "running"
