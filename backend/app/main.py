from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import get_settings
from app.database import Base, engine, ensure_card_columns
from app.routers import decks, cards, review, documents
from app.routers import ai
from app.routers import anki_import

settings = get_settings()

Base.metadata.create_all(bind=engine)
ensure_card_columns(engine)

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
)

app.include_router(decks.router)
app.include_router(cards.router)
app.include_router(review.router)
app.include_router(ai.router)
app.include_router(documents.router)
app.include_router(anki_import.router)

app.mount("/media", StaticFiles(directory=MEDIA_DIR), name="media")


@app.get("/health")
def health():
    return {"status": "ok"}
