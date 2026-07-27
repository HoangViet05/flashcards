from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import get_settings
import app.models  # noqa: F401 - registers every SQLAlchemy model before metadata creation
from app.database import Base, engine, ensure_article_columns, ensure_card_columns, ensure_daily_session_columns, ensure_owner_columns, ensure_review_columns, ensure_user_columns
from app.routers import articles, cards, catalog, daily, decks, dictionary, documents, review, shadowing
from app.routers import ai
from app.routers import anki_import
from app.routers import auth
from app.routers import boss, missions, progress

settings = get_settings()

Base.metadata.create_all(bind=engine)
ensure_card_columns(engine)
ensure_review_columns(engine)
ensure_owner_columns(engine)
ensure_article_columns(engine)
ensure_user_columns(engine)
ensure_daily_session_columns(engine)

MEDIA_DIR = settings.media_dir
MEDIA_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Flashcard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.parsed_cors_origins,
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

app.include_router(decks.router)
app.include_router(cards.router)
app.include_router(review.router)
app.include_router(daily.router)
app.include_router(ai.router)
app.include_router(documents.router)
app.include_router(anki_import.router)
app.include_router(auth.router)
app.include_router(articles.router)
app.include_router(catalog.router)
app.include_router(dictionary.router)
app.include_router(shadowing.router)
app.include_router(progress.router)
app.include_router(missions.router)
app.include_router(boss.router)

app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")


@app.get("/health")
def health():
    return {"status": "ok"}
