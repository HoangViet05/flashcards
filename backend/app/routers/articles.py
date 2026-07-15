from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.article import Article
from app.models.article_highlight import ArticleHighlight
from app.models.document import Document
from app.models.user import User
from app.schemas.article import ArticleCreate, ArticleHighlightCreate, ArticleHighlightOut, ArticleListItem, ArticleOut
from app.services.article_extractor import (
    ExtractionError, count_words, extract_from_html, extract_from_pdf_source, fetch_url, normalize_text,
)
from app.services.security import get_current_user

router = APIRouter(prefix="/api/articles", tags=["articles"])


def get_owned_article(article_id: str, db: Session, user: User) -> Article:
    article = db.query(Article).filter(Article.id == article_id, Article.user_id == user.id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài đọc")
    return article


def _default_title(text: str) -> str:
    return " ".join(text.split()[:8])[:500] or "Bài đọc"


@router.post("", response_model=ArticleOut)
def create_article(body: ArticleCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        if body.text is not None:
            content = normalize_text(body.text)
            if not content:
                raise ExtractionError("Văn bản trống.")
            article = Article(user_id=user.id, title=body.title or _default_title(content), source_type="paste", content=content)
        elif body.url is not None:
            title, content = extract_from_html(fetch_url(body.url), body.title or body.url)
            article = Article(user_id=user.id, title=body.title or title, source_type="url", content=content, source_url=body.url)
        else:
            document = db.query(Document).filter(Document.id == body.document_id, Document.user_id == user.id).first()
            if not document:
                raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")
            article = Article(
                user_id=user.id, title=body.title or document.filename, source_type="pdf",
                content=extract_from_pdf_source(document.file_path), document_id=document.id,
            )
    except ExtractionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    article.word_count = count_words(article.content)
    db.add(article)
    db.commit()
    db.refresh(article)
    return article


@router.get("", response_model=list[ArticleListItem])
def list_articles(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(Article).filter(Article.user_id == user.id).order_by(Article.created_at.desc()).all()
    return [ArticleListItem(id=a.id, title=a.title, source_type=a.source_type, source_url=a.source_url,
                            word_count=a.word_count, has_summary=a.summary is not None, created_at=a.created_at) for a in rows]


@router.get("/{article_id}", response_model=ArticleOut)
def get_article(article_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return get_owned_article(article_id, db, user)


@router.get("/{article_id}/highlights", response_model=list[ArticleHighlightOut])
def list_highlights(article_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    article = get_owned_article(article_id, db, user)
    return (
        db.query(ArticleHighlight)
        .filter(ArticleHighlight.article_id == article.id)
        .order_by(ArticleHighlight.created_at.desc())
        .all()
    )


@router.post("/{article_id}/highlights", response_model=ArticleHighlightOut)
def save_highlight(
    article_id: str,
    body: ArticleHighlightCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    article = get_owned_article(article_id, db, user)
    word = body.word.strip().lower()
    if not word or len(word) > 100:
        raise HTTPException(status_code=422, detail="Từ cần đánh dấu không hợp lệ")

    highlight = (
        db.query(ArticleHighlight)
        .filter(ArticleHighlight.article_id == article.id, ArticleHighlight.word == word)
        .first()
    )
    if highlight:
        highlight.meaning = body.meaning
    else:
        highlight = ArticleHighlight(article_id=article.id, word=word, meaning=body.meaning)
        db.add(highlight)
    db.commit()
    db.refresh(highlight)
    return highlight


@router.delete("/{article_id}/highlights/{word}")
def delete_highlight(article_id: str, word: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    article = get_owned_article(article_id, db, user)
    highlight = (
        db.query(ArticleHighlight)
        .filter(ArticleHighlight.article_id == article.id, ArticleHighlight.word == word.strip().lower())
        .first()
    )
    if not highlight:
        raise HTTPException(status_code=404, detail="Không tìm thấy từ đã đánh dấu")
    db.delete(highlight)
    db.commit()
    return {"status": "success"}


@router.delete("/{article_id}")
def delete_article(article_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.delete(get_owned_article(article_id, db, user))
    db.commit()
    return {"status": "success"}
