"""Idempotently import catalog records by source URL."""
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.catalog_article import CatalogArticle

_FIELDS = ("source", "title", "content", "level", "difficulty_score", "word_count", "license", "attribution", "audio_url", "suggested_words")


def _parse_published_at(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        return None


def import_records(records: list[dict], db: Session) -> tuple[int, int]:
    created = updated = 0
    pending: dict[str, CatalogArticle] = {}
    for record in records:
        source_url = record["source_url"]
        row = pending.get(source_url)
        if row is None:
            row = db.query(CatalogArticle).filter(CatalogArticle.source_url == source_url).first()
        if row is None:
            row = CatalogArticle(source_url=source_url)
            db.add(row)
            pending[source_url] = row
            created += 1
        else:
            updated += 1
        for field in _FIELDS:
            setattr(row, field, record[field])
        row.published_at = _parse_published_at(record.get("published_at"))
    db.commit()
    return created, updated
