"""Read the shared catalog and adopt entries as user-owned Reader articles."""
from sqlalchemy.orm import Session

from app.models.article import Article
from app.models.article_highlight import ArticleHighlight
from app.models.catalog_article import CatalogArticle
from app.models.user import User
from app.services.article_cards import create_article_card, ensure_article_deck, first_sentence_containing
from app.services.article_extractor import count_words
from app.services.word_picker import resolve_meaning


def adopted_urls(db: Session, user_id: str) -> set[str]:
    return {row[0] for row in db.query(Article.source_url).filter(Article.user_id == user_id, Article.source_type == "catalog").all() if row[0]}


def list_by_level(db: Session, level: int) -> list[CatalogArticle]:
    return db.query(CatalogArticle).filter(CatalogArticle.level == level).order_by(CatalogArticle.published_at.desc().nullslast(), CatalogArticle.created_at.desc()).all()


def find_adopted(db: Session, user_id: str, source_url: str) -> Article | None:
    return db.query(Article).filter(Article.user_id == user_id, Article.source_type == "catalog", Article.source_url == source_url).first()


def adopt(entry: CatalogArticle, user: User, db: Session) -> Article:
    article = Article(user_id=user.id, title=entry.title, source_type="catalog", content=entry.content, source_url=entry.source_url, word_count=count_words(entry.content))
    db.add(article)
    db.flush()
    ensure_article_deck(article, db)
    for word in entry.suggested_words or []:
        normalized = word.strip().lower()[:100]
        if normalized:
            db.add(ArticleHighlight(article_id=article.id, word=normalized, meaning=resolve_meaning(word, user.id, db)))
    return article


def seed_first_article(user: User, db: Session) -> Article | None:
    entry = db.query(CatalogArticle).filter(CatalogArticle.level == 1).order_by(CatalogArticle.published_at.desc().nullslast(), CatalogArticle.created_at.desc()).first()
    if entry is None:
        return None
    article = adopt(entry, user, db)
    for word in entry.suggested_words or []:
        create_article_card(article, user, db, word=word, back_text=resolve_meaning(word, user.id, db), example_sentence=first_sentence_containing(article, word))
    return article
