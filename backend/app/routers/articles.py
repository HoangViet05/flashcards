import re
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, Response, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.article import Article
from app.models.article_highlight import ArticleHighlight
from app.models.article_translation import ArticleTranslation
from app.models.card import Card
from app.models.deck import Deck
from app.models.document import Document
from app.models.review import Review
from app.models.translation_worker import TranslationWorker
from app.models.user import User
from app.schemas.article import (
    ArticleCardCreate, ArticleCreate, ArticleHighlightCreate, ArticleHighlightOut, ArticleListItem, ArticleOut,
    HighlightCardMetadata, HighlightCardsCreate, HighlightCardsResult,
    ArticleTranslationOut, LocalWorkerCreate, LocalWorkerCreated, LocalWorkerOut, TranslationQueueResult,
    TranslationRequest, WorkerClaimOut, WorkerComplete, WorkerFailure,
    WordStatesOut,
)
from app.schemas.card import CardOut
from app.services.article_cards import create_article_card, ensure_article_deck, find_anki_entries, first_sentence_containing, normalize_word
from app.services.article_extractor import (
    ExtractionError, count_words, extract_from_html, extract_from_pdf_source, fetch_url, normalize_text,
)
from app.services.security import get_current_user
from app.services import weak_words as weak_service

router = APIRouter(prefix="/api/articles", tags=["articles"])


def get_owned_article(article_id: str, db: Session, user: User) -> Article:
    article = db.query(Article).filter(Article.id == article_id, Article.user_id == user.id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài đọc")
    return article


def serialize_highlights(highlights: list[ArticleHighlight], user: User, db: Session) -> list[ArticleHighlightOut]:
    anki_entries = find_anki_entries([highlight.word for highlight in highlights], user.id, db)
    return [
        ArticleHighlightOut(
            id=highlight.id,
            word=highlight.word,
            meaning=highlight.meaning,
            created_at=highlight.created_at,
            anki_match=(entry := anki_entries.get(normalize_word(highlight.word))) is not None,
            anki_source_deck=entry.source_deck if entry else None,
        )
        for highlight in highlights
    ]


def _default_title(text: str) -> str:
    return " ".join(text.split()[:8])[:500] or "Bài đọc"


def _translation_status(article_id: str, db: Session) -> str | None:
    row = db.query(ArticleTranslation.status).filter(ArticleTranslation.article_id == article_id).first()
    return row[0] if row else None


def _queue_translation(article: Article, db: Session, force: bool = False) -> tuple[ArticleTranslation, bool]:
    """Queue one article unless it is already completed or being worked on."""
    now = datetime.utcnow()
    job = db.query(ArticleTranslation).filter(ArticleTranslation.article_id == article.id).first()
    if job is None:
        job = ArticleTranslation(article_id=article.id, user_id=article.user_id, status="queued", requested_at=now)
        db.add(job)
        return job, True
    if job.status in {"queued", "processing"} and not force:
        return job, False
    if job.status == "completed" and not force:
        return job, False

    job.status = "queued"
    job.worker_id = None
    job.translated_content = None
    job.segments = None
    job.error_message = None
    job.requested_at = now
    job.started_at = None
    job.completed_at = None
    job.lease_expires_at = None
    return job, True


def _get_local_worker(
    x_translation_worker_token: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> TranslationWorker:
    if not x_translation_worker_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Thiếu mã kết nối worker")
    worker = (
        db.query(TranslationWorker)
        .filter(TranslationWorker.token_hash == TranslationWorker.hash_token(x_translation_worker_token.strip()))
        .first()
    )
    if not worker:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Mã kết nối worker không hợp lệ")
    return worker


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
    deck = Deck(user_id=user.id, name=article.title, description="Từ vựng lưu từ bài đọc này")
    db.add(deck)
    db.flush()
    article.deck_id = deck.id
    db.add(article)
    db.commit()
    db.refresh(article)
    return article


@router.post("/translation-jobs/untranslated", response_model=TranslationQueueResult)
def queue_all_untranslated_articles(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Queue every article without a finished Vietnamese translation for the paired local worker."""
    articles = db.query(Article).filter(Article.user_id == user.id).all()
    queued_count = 0
    already_pending_count = 0
    for article in articles:
        job, queued = _queue_translation(article, db)
        if queued:
            queued_count += 1
        elif job.status in {"queued", "processing"}:
            already_pending_count += 1
    db.commit()
    return TranslationQueueResult(queued_count=queued_count, already_pending_count=already_pending_count)


@router.post("/{article_id}/translation-jobs", response_model=ArticleTranslationOut)
def queue_article_translation(
    article_id: str,
    body: TranslationRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    article = get_owned_article(article_id, db, user)
    job, _ = _queue_translation(article, db, force=body.force)
    db.commit()
    db.refresh(job)
    return job


@router.get("", response_model=list[ArticleListItem])
def list_articles(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(Article).filter(Article.user_id == user.id).order_by(Article.created_at.desc()).all()
    statuses = {
        row.article_id: row.status
        for row in db.query(ArticleTranslation.article_id, ArticleTranslation.status).filter(ArticleTranslation.user_id == user.id)
    }
    return [ArticleListItem(id=a.id, title=a.title, source_type=a.source_type, source_url=a.source_url,
                            word_count=a.word_count, has_summary=a.summary is not None,
                            translation_status=statuses.get(a.id), created_at=a.created_at) for a in rows]


@router.get("/{article_id}", response_model=ArticleOut)
def get_article(article_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    article = get_owned_article(article_id, db, user)
    result = ArticleOut.model_validate(article)
    result.translation_status = _translation_status(article.id, db)
    return result


@router.get("/{article_id}/translation", response_model=ArticleTranslationOut)
def get_article_translation(article_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    article = get_owned_article(article_id, db, user)
    translation = db.query(ArticleTranslation).filter(ArticleTranslation.article_id == article.id).first()
    if not translation:
        raise HTTPException(status_code=404, detail="Bài đọc chưa có bản dịch")
    return translation


@router.post("/translation-workers", response_model=LocalWorkerCreated, status_code=status.HTTP_201_CREATED)
def create_translation_worker(
    body: LocalWorkerCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    token = TranslationWorker.new_token()
    worker = TranslationWorker(user_id=user.id, name=body.name.strip(), token_hash=TranslationWorker.hash_token(token))
    db.add(worker)
    db.commit()
    db.refresh(worker)
    return LocalWorkerCreated(
        id=worker.id,
        name=worker.name,
        created_at=worker.created_at,
        last_seen_at=worker.last_seen_at,
        token=token,
    )


@router.get("/translation-workers/status", response_model=list[LocalWorkerOut])
def list_translation_workers(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return (
        db.query(TranslationWorker)
        .filter(TranslationWorker.user_id == user.id)
        .order_by(TranslationWorker.created_at.desc())
        .all()
    )


@router.delete("/translation-workers/{worker_id}")
def delete_translation_worker(worker_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    worker = db.query(TranslationWorker).filter(TranslationWorker.id == worker_id, TranslationWorker.user_id == user.id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Không tìm thấy worker local")
    db.delete(worker)
    db.commit()
    return {"status": "success"}


@router.post("/local-translation/claim", response_model=WorkerClaimOut, responses={204: {"description": "Không có bài đang chờ"}})
def claim_translation_job(
    worker: TranslationWorker = Depends(_get_local_worker),
    db: Session = Depends(get_db),
):
    now = datetime.utcnow()
    job = (
        db.query(ArticleTranslation)
        .filter(
            ArticleTranslation.user_id == worker.user_id,
            or_(
                ArticleTranslation.status == "queued",
                (ArticleTranslation.status == "processing") & (ArticleTranslation.lease_expires_at < now),
            ),
        )
        .order_by(ArticleTranslation.requested_at.asc())
        .first()
    )
    worker.last_seen_at = now
    if not job:
        db.commit()
        # Return a Response object so FastAPI does not validate None against
        # WorkerClaimOut and turn a normal empty queue into HTTP 500.
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    job.status = "processing"
    job.worker_id = worker.id
    job.started_at = now
    job.lease_expires_at = now + timedelta(minutes=20)
    job.attempt_count += 1
    db.commit()
    article = db.query(Article).filter(Article.id == job.article_id).first()
    return WorkerClaimOut(id=job.id, article_id=article.id, title=article.title, content=article.content)


@router.post("/local-translation/{job_id}/complete")
def complete_translation_job(
    job_id: str,
    body: WorkerComplete,
    worker: TranslationWorker = Depends(_get_local_worker),
    db: Session = Depends(get_db),
):
    job = (
        db.query(ArticleTranslation)
        .filter(ArticleTranslation.id == job_id, ArticleTranslation.user_id == worker.user_id, ArticleTranslation.worker_id == worker.id)
        .first()
    )
    if not job or job.status != "processing":
        raise HTTPException(status_code=404, detail="Không tìm thấy job đang được worker xử lý")
    now = datetime.utcnow()
    job.status = "completed"
    job.translated_content = body.translated_content.strip()
    job.segments = [segment.model_dump() for segment in body.segments]
    job.error_message = None
    job.completed_at = now
    job.lease_expires_at = None
    worker.last_seen_at = now
    db.commit()
    return {"status": "success"}


@router.post("/local-translation/{job_id}/fail")
def fail_translation_job(
    job_id: str,
    body: WorkerFailure,
    worker: TranslationWorker = Depends(_get_local_worker),
    db: Session = Depends(get_db),
):
    job = (
        db.query(ArticleTranslation)
        .filter(ArticleTranslation.id == job_id, ArticleTranslation.user_id == worker.user_id, ArticleTranslation.worker_id == worker.id)
        .first()
    )
    if not job or job.status != "processing":
        raise HTTPException(status_code=404, detail="Không tìm thấy job đang được worker xử lý")
    job.status = "failed"
    job.error_message = body.error_message.strip()
    job.lease_expires_at = None
    worker.last_seen_at = datetime.utcnow()
    db.commit()
    return {"status": "success"}


@router.get("/{article_id}/highlights", response_model=list[ArticleHighlightOut])
def list_highlights(article_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    article = get_owned_article(article_id, db, user)
    highlights = (
        db.query(ArticleHighlight)
        .filter(ArticleHighlight.article_id == article.id)
        .order_by(ArticleHighlight.created_at.desc())
        .all()
    )
    return serialize_highlights(highlights, user, db)


@router.get("/{article_id}/word-states", response_model=WordStatesOut)
def get_word_states(
    article_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    article = get_owned_article(article_id, db, user)
    present = {
        normalize_word(token)
        for token in re.findall(r"[A-Za-z']+", article.content)
    }
    weak_ids = weak_service.weak_card_ids(db, user.id)
    rows = (
        db.query(Card, Review)
        .join(Review, Review.card_id == Card.id)
        .join(Deck, Card.deck_id == Deck.id)
        .filter(Deck.user_id == user.id, Review.repetitions >= 1)
        .all()
    )
    states: dict[str, str] = {}
    for card, review in rows:
        word = normalize_word(card.front_text)
        if word not in present:
            continue
        if card.id in weak_ids:
            states[word] = "weak"
        elif review.repetitions >= 3:
            states[word] = "mastered"
        else:
            states[word] = "learning"
    return WordStatesOut(states=states)


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
    return serialize_highlights([highlight], user, db)[0]


@router.post("/{article_id}/cards", response_model=CardOut)
def save_article_card(
    article_id: str,
    body: ArticleCardCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    article = get_owned_article(article_id, db, user)
    result = create_article_card(article, user, db, **body.model_dump())
    if result.duplicate:
        raise HTTPException(status_code=400, detail="Từ này đã có trong bộ thẻ của bài đọc")
    db.commit()
    db.refresh(result.card)
    return result.card


@router.post("/{article_id}/highlights/to-deck", response_model=HighlightCardsResult)
def save_highlights_to_article_deck(
    article_id: str,
    body: HighlightCardsCreate | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    article = get_owned_article(article_id, db, user)
    highlights = (
        db.query(ArticleHighlight)
        .filter(ArticleHighlight.article_id == article.id)
        .order_by(ArticleHighlight.created_at.asc())
        .all()
    )
    deck = ensure_article_deck(article, db)
    metadata_by_word: dict[str, HighlightCardMetadata] = {
        normalize_word(metadata.word): metadata
        for metadata in (body.cards if body else [])
    }
    cards_created = 0
    cards_skipped = 0
    anki_matches = 0
    for highlight in highlights:
        metadata = metadata_by_word.get(normalize_word(highlight.word))
        result = create_article_card(
            article,
            user,
            db,
            word=highlight.word,
            back_text=highlight.meaning or "Chưa có nghĩa Việt",
            example_sentence=first_sentence_containing(article, highlight.word),
            pronunciation=metadata.pronunciation if metadata else None,
            definition=metadata.definition if metadata else None,
            audio_url=metadata.audio_url if metadata else None,
        )
        if result.duplicate:
            cards_skipped += 1
        else:
            cards_created += 1
            anki_matches += int(result.used_anki)
    db.commit()
    return HighlightCardsResult(
        deck_id=deck.id,
        cards_created=cards_created,
        cards_skipped=cards_skipped,
        anki_matches=anki_matches,
    )


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
