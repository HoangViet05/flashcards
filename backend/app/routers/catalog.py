import hmac

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.models.catalog_article import CatalogArticle
from app.models.user import User
from app.schemas.article import ArticleOut
from app.schemas.catalog import CatalogDetail, CatalogIngestRequest, CatalogIngestResult, CatalogListItem
from app.services import catalog as catalog_service
from app.services.catalog_import import import_records
from app.services.security import get_current_user

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


def _get_entry(catalog_id: str, db: Session) -> CatalogArticle:
    entry = db.query(CatalogArticle).filter(CatalogArticle.id == catalog_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài trong thư viện")
    return entry


@router.get("", response_model=list[CatalogListItem])
def list_catalog(level: int = Query(1, ge=1, le=3), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    added = catalog_service.adopted_urls(db, user.id)
    return [CatalogListItem(id=entry.id, title=entry.title, level=entry.level, word_count=entry.word_count, source=entry.source, attribution=entry.attribution, audio_url=entry.audio_url, suggested_word_count=len(entry.suggested_words or []), already_added=entry.source_url in added, published_at=entry.published_at) for entry in catalog_service.list_by_level(db, level)]


@router.post("/ingest", response_model=CatalogIngestResult)
def ingest_catalog(body: CatalogIngestRequest, x_catalog_token: str | None = Header(default=None), db: Session = Depends(get_db)):
    configured = get_settings().catalog_ingest_token
    if not configured:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Chưa bật nhận bài từ worker (thiếu CATALOG_INGEST_TOKEN)")
    if not x_catalog_token or not hmac.compare_digest(x_catalog_token, configured):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Mã worker không hợp lệ")
    created, updated = import_records([article.model_dump(mode="json") for article in body.articles], db)
    return CatalogIngestResult(created=created, updated=updated)


@router.get("/{catalog_id}", response_model=CatalogDetail)
def get_catalog_article(catalog_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    entry = _get_entry(catalog_id, db)
    return CatalogDetail(id=entry.id, title=entry.title, content=entry.content, level=entry.level, word_count=entry.word_count, source=entry.source, source_url=entry.source_url, license=entry.license, attribution=entry.attribution, audio_url=entry.audio_url, suggested_words=list(entry.suggested_words or []), already_added=catalog_service.find_adopted(db, user.id, entry.source_url) is not None)


@router.post("/{catalog_id}/adopt", response_model=ArticleOut)
def adopt_catalog_article(catalog_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    entry = _get_entry(catalog_id, db)
    existing = catalog_service.find_adopted(db, user.id, entry.source_url)
    if existing:
        raise HTTPException(status_code=400, detail={"message": "Bài này đã có trong Reader của bạn", "article_id": existing.id})
    article = catalog_service.adopt(entry, user, db)
    db.commit()
    db.refresh(article)
    return article
