import re
import unicodedata
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.anki_entry import AnkiEntry
from app.models.article import Article
from app.models.card import Card
from app.models.deck import Deck
from app.models.review import Review
from app.models.user import User


def normalize_word(word: str) -> str:
    return " ".join(unicodedata.normalize("NFKC", word).split()).casefold()


def ensure_article_deck(article: Article, db: Session) -> Deck:
    if article.deck_id:
        deck = db.query(Deck).filter(Deck.id == article.deck_id, Deck.user_id == article.user_id).first()
        if deck:
            return deck

    deck = Deck(
        user_id=article.user_id,
        name=article.title,
        description="Từ vựng lưu từ bài đọc này",
    )
    db.add(deck)
    db.flush()
    article.deck_id = deck.id
    return deck


def _entry_richness(entry: AnkiEntry) -> int:
    return sum(bool(value) for value in (
        entry.pronunciation, entry.definition, entry.example_sentence,
        entry.image_url, entry.audio_url, entry.example_audio_url,
    ))


def find_anki_entry(word: str, user_id: str, db: Session) -> AnkiEntry | None:
    entries = (
        db.query(AnkiEntry)
        .filter(AnkiEntry.user_id == user_id, AnkiEntry.normalized_word == normalize_word(word))
        .all()
    )
    return max(entries, key=lambda entry: (_entry_richness(entry), entry.imported_at), default=None)


def first_sentence_containing(article: Article, word: str) -> str | None:
    pattern = re.compile(rf"(?<![A-Za-z']){re.escape(word)}(?![A-Za-z'])", re.IGNORECASE)
    for sentence in re.split(r"(?<=[.!?])\s+", article.content):
        cleaned = sentence.strip()
        if pattern.search(cleaned):
            return cleaned
    return None


@dataclass
class ArticleCardResult:
    card: Card | None
    duplicate: bool
    used_anki: bool
    deck: Deck


def create_article_card(
    article: Article,
    user: User,
    db: Session,
    *,
    word: str,
    back_text: str,
    example_sentence: str | None = None,
    pronunciation: str | None = None,
    definition: str | None = None,
    image_url: str | None = None,
    audio_url: str | None = None,
    example_audio_url: str | None = None,
) -> ArticleCardResult:
    deck = ensure_article_deck(article, db)
    key = normalize_word(word)
    existing = db.query(Card).filter(Card.deck_id == deck.id).all()
    if any(normalize_word(card.front_text) == key for card in existing):
        return ArticleCardResult(card=None, duplicate=True, used_anki=False, deck=deck)

    anki = find_anki_entry(word, user.id, db)
    if anki:
        card = Card(
            deck_id=deck.id,
            front_text=anki.front_text,
            back_text=anki.back_text,
            pronunciation=anki.pronunciation,
            definition=anki.definition,
            example_sentence=anki.example_sentence,
            image_url=anki.image_url,
            audio_url=anki.audio_url,
            example_audio_url=anki.example_audio_url,
        )
    else:
        card = Card(
            deck_id=deck.id,
            front_text=word.strip(),
            back_text=back_text.strip(),
            example_sentence=example_sentence,
            pronunciation=pronunciation,
            definition=definition,
            image_url=image_url,
            audio_url=audio_url,
            example_audio_url=example_audio_url,
        )
    db.add(card)
    db.flush()
    db.add(Review(card_id=card.id))
    return ArticleCardResult(card=card, duplicate=False, used_anki=anki is not None, deck=deck)
