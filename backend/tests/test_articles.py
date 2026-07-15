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
    assert client.get(url).json()[0]["word"] == "containers"
    assert user_b_client.get(url).status_code == 404
    assert client.delete(f"{url}/containers").status_code == 200
    assert client.get(url).json() == []
