import json
from pathlib import Path

from app.models.article import Article
from app.models.article_highlight import ArticleHighlight
from app.models.catalog_article import CatalogArticle
from app.services import readability
from app.services.catalog_import import import_records
from app.services.word_picker import pick_words


def _entry(level: int = 1) -> CatalogArticle:
    return CatalogArticle(
        source="voa", source_url=f"https://example.test/{level}", title=f"Bài bậc {level}",
        content="The turbine spins fast. The generator hums along. People watch the machine work every day.",
        level=level, difficulty_score=10.0 * level, word_count=15, license="public-domain",
        attribution="VOA Learning English", suggested_words=["turbine", "generator"],
    )


def test_core_vocabulary_and_scores_are_usable():
    easy = "The sun is hot. It gives us light. We like a warm day."
    hard = "The unprecedented epistemological ramifications compel a thoroughgoing ontological reappraisal."
    assert len(readability.core_words()) > 1000
    assert readability.hard_ratio(hard) > readability.hard_ratio(easy)
    assert readability.level_for(hard) >= readability.level_for(easy)


def test_catalog_seed_has_all_three_levels():
    scores = [record["difficulty_score"] for path in (Path(__file__).resolve().parents[1] / "data" / "catalog").glob("*.json") for record in json.loads(path.read_text(encoding="utf-8"))]
    levels = {1 if value < readability.LEVEL_2_MIN else 3 if value >= readability.LEVEL_3_MIN else 2 for value in scores}
    assert levels == {1, 2, 3}


def test_word_picker_skips_core_words_and_keeps_study_words():
    assert pick_words("The cloud is cold. The cloud is cold.") == []
    assert "photosynthesis" in pick_words("Photosynthesis feeds the plant. Photosynthesis needs light.")


def test_import_is_idempotent_even_when_one_batch_repeats_a_url(db):
    record = {
        "source": "voa", "source_url": "https://example.test/repeated", "title": "One", "content": "Body.",
        "level": 1, "difficulty_score": 1.0, "word_count": 1, "license": "public-domain",
        "attribution": "VOA", "audio_url": None, "suggested_words": [], "published_at": None,
    }
    assert import_records([record, {**record, "title": "Revised"}], db) == (1, 1)
    assert db.query(CatalogArticle).one().title == "Revised"


def test_catalog_list_adopt_and_preference(client, db):
    entry = _entry()
    db.add(entry)
    db.commit()
    assert client.patch("/api/auth/me/preferences", json={"preferred_level": 2}).json()["preferred_level"] == 2
    assert client.get("/api/catalog?level=1").json()[0]["already_added"] is False
    adopted = client.post(f"/api/catalog/{entry.id}/adopt")
    assert adopted.status_code == 200, adopted.text
    assert adopted.json()["source_type"] == "catalog"
    assert db.query(Article).count() == 1
    assert {row.word for row in db.query(ArticleHighlight).all()} == {"turbine", "generator"}
    assert client.get("/api/catalog?level=1").json()[0]["already_added"] is True


def test_register_gets_a_first_article_and_cards(anon_client, db):
    db.add(_entry())
    db.commit()
    response = anon_client.post("/api/auth/register", json={"email": "starter@test.com", "password": "secret123"})
    assert response.status_code == 201, response.text
    article = db.query(Article).one()
    assert article.source_type == "catalog"
