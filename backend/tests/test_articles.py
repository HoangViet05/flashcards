from unittest.mock import patch

from app.services.article_extractor import ExtractionError


PASTE_BODY = {"title": "My Notes", "text": "Docker is great. It ships containers.\n\nSecond paragraph here."}


def test_articles_require_auth(anon_client):
    assert anon_client.get("/api/articles").status_code == 401


def test_create_list_and_delete_article(client):
    created = client.post("/api/articles", json=PASTE_BODY)
    assert created.status_code == 200, created.text
    article = created.json()
    assert article["source_type"] == "paste"
    assert article["word_count"] == 9
    listed = client.get("/api/articles").json()
    assert len(listed) == 1 and "content" not in listed[0]
    assert client.delete(f"/api/articles/{article['id']}").status_code == 200
    assert client.get(f"/api/articles/{article['id']}").status_code == 404


def test_article_url_and_user_scope(client, user_b_client):
    with patch("app.routers.articles.fetch_url", return_value="<html/>"), patch("app.routers.articles.extract_from_html", return_value=("Fetched", "Useful extracted text.")):
        created = client.post("/api/articles", json={"url": "https://example.com"})
    assert created.status_code == 200
    assert created.json()["source_url"] == "https://example.com"
    assert user_b_client.get(f"/api/articles/{created.json()['id']}").status_code == 404
    with patch("app.routers.articles.fetch_url", side_effect=ExtractionError("broken")):
        assert client.post("/api/articles", json={"url": "https://bad.example"}).status_code == 422


def test_article_highlights_are_saved_per_article(client, user_b_client):
    article = client.post("/api/articles", json=PASTE_BODY).json()
    url = f"/api/articles/{article['id']}/highlights"
    saved = client.post(url, json={"word": "Containers", "meaning": "vật chứa"})
    assert saved.status_code == 200
    assert saved.json()["word"] == "containers"
    assert saved.json()["meaning"] == "vật chứa"
    assert saved.json()["anki_match"] is False
    assert client.get(url).json()[0]["word"] == "containers"
    assert user_b_client.get(url).status_code == 404
    assert client.delete(f"{url}/containers").status_code == 200
    assert client.get(url).json() == []


def test_article_highlights_report_anki_match_and_allow_meaning_update(client, db):
    from app.models.anki_entry import AnkiEntry
    from app.models.user import User

    article = client.post("/api/articles", json=PASTE_BODY).json()
    user = db.query(User).filter(User.email == "usera@test.com").one()
    db.add(AnkiEntry(
        user_id=user.id,
        normalized_word="docker",
        front_text="Docker",
        back_text="Docker from Anki",
        source_deck="Technical words",
        fingerprint="docker-highlight-match",
    ))
    db.commit()

    url = f"/api/articles/{article['id']}/highlights"
    saved = client.post(url, json={"word": "Docker", "meaning": "Docker tool"})
    assert saved.status_code == 200
    assert saved.json()["anki_match"] is True
    assert saved.json()["anki_source_deck"] == "Technical words"

    updated = client.post(url, json={"word": "Docker", "meaning": "Updated meaning"})
    assert updated.status_code == 200
    assert updated.json()["meaning"] == "Updated meaning"


def test_article_deck_and_bulk_highlights_prefer_anki_data(client, db):
    from app.models.anki_entry import AnkiEntry
    from app.models.user import User

    article = client.post("/api/articles", json=PASTE_BODY).json()
    assert article["deck_id"]
    url = f"/api/articles/{article['id']}/highlights"
    assert client.post(url, json={"word": "Docker", "meaning": "Docker thủ công"}).status_code == 200
    user = db.query(User).filter(User.email == "usera@test.com").one()
    db.add(AnkiEntry(
        user_id=user.id,
        normalized_word="docker",
        front_text="Docker",
        back_text="Docker từ Anki",
        definition="A platform for containers.",
        example_sentence="Docker ships containers.",
        audio_url="/media/docker.mp3",
        fingerprint="docker-test-entry",
    ))
    db.commit()

    saved = client.post(f"/api/articles/{article['id']}/highlights/to-deck")
    assert saved.status_code == 200, saved.text
    assert saved.json() == {
        "deck_id": article["deck_id"], "cards_created": 1, "cards_skipped": 0, "anki_matches": 1,
    }
    cards = client.get(f"/api/decks/{article['deck_id']}/cards").json()
    assert len(cards) == 1
    assert cards[0]["back_text"] == "Docker thủ công"
    assert cards[0]["audio_url"] == "/media/docker.mp3"
    assert cards[0]["source_type"] == "anki_library"

    repeated = client.post(f"/api/articles/{article['id']}/highlights/to-deck")
    assert repeated.status_code == 200
    assert repeated.json()["cards_created"] == 0
    assert repeated.json()["cards_skipped"] == 1


def test_bulk_highlights_keep_dictionary_pronunciation_and_audio(client):
    article = client.post("/api/articles", json=PASTE_BODY).json()
    url = f"/api/articles/{article['id']}/highlights"
    assert client.post(url, json={"word": "containers", "meaning": "vật chứa"}).status_code == 200

    saved = client.post(
        f"/api/articles/{article['id']}/highlights/to-deck",
        json={
            "cards": [{
                "word": "containers",
                "pronunciation": "/kənˈteɪnəz/",
                "definition": "objects used to hold things",
                "audio_url": "https://audio.example/containers.mp3",
            }]
        },
    )
    assert saved.status_code == 200, saved.text
    card = client.get(f"/api/decks/{article['deck_id']}/cards").json()[0]
    assert card["pronunciation"] == "/kənˈteɪnəz/"
    assert card["audio_url"] == "https://audio.example/containers.mp3"


def test_local_translation_worker_claims_only_its_users_jobs(client, user_b_client):
    article = client.post("/api/articles", json=PASTE_BODY).json()
    queued = client.post(f"/api/articles/{article['id']}/translation-jobs", json={})
    assert queued.status_code == 200
    assert queued.json()["status"] == "queued"
    assert client.get("/api/articles").json()[0]["translation_status"] == "queued"

    paired = client.post("/api/articles/translation-workers", json={"name": "Laptop RTX"})
    assert paired.status_code == 201
    token = paired.json()["token"]
    assert client.get("/api/articles/translation-workers/status").status_code == 200
    assert client.post("/api/articles/local-translation/claim").status_code == 401

    claimed = client.post("/api/articles/local-translation/claim", headers={"X-Translation-Worker-Token": token})
    assert claimed.status_code == 200, claimed.text
    job = claimed.json()
    assert job["article_id"] == article["id"]
    assert job["content"] == PASTE_BODY["text"]

    completed = client.post(
        f"/api/articles/local-translation/{job['id']}/complete",
        headers={"X-Translation-Worker-Token": token},
        json={
            "translated_content": "Docker rất tuyệt. Nó vận chuyển các container.",
            "segments": [{"source": PASTE_BODY["text"], "translated": "Docker rất tuyệt. Nó vận chuyển các container."}],
        },
    )
    assert completed.status_code == 200, completed.text
    translation = client.get(f"/api/articles/{article['id']}/translation")
    assert translation.status_code == 200
    assert translation.json()["status"] == "completed"
    assert user_b_client.get(f"/api/articles/{article['id']}/translation").status_code == 404

    all_queued = client.post("/api/articles/translation-jobs/untranslated")
    assert all_queued.status_code == 200
    assert all_queued.json()["queued_count"] == 0
    empty_claim = client.post("/api/articles/local-translation/claim", headers={"X-Translation-Worker-Token": token})
    assert empty_claim.status_code == 204
