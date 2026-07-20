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


def find_anki_entries(words: list[str], user_id: str, db: Session) -> dict[str, AnkiEntry]:
    """Return the best imported Anki record for each normalized word."""
    keys = {normalize_word(word) for word in words if normalize_word(word)}
    if not keys:
        return {}
    matches: dict[str, AnkiEntry] = {}
    # Chunk the IN query to stay below SQLite's parameter limit for long articles.
    ordered_keys = sorted(keys)
    for start in range(0, len(ordered_keys), 500):
        entries = (
            db.query(AnkiEntry)
            .filter(
                AnkiEntry.user_id == user_id,
                AnkiEntry.normalized_word.in_(ordered_keys[start:start + 500]),
            )
            .all()
        )
        for entry in entries:
            current = matches.get(entry.normalized_word)
            if current is None or (_entry_richness(entry), entry.imported_at) > (_entry_richness(current), current.imported_at):
                matches[entry.normalized_word] = entry
    return matches


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
            back_text=back_text.strip() or anki.back_text,
            pronunciation=anki.pronunciation,
            definition=anki.definition,
            example_sentence=anki.example_sentence,
            image_url=anki.image_url,
            audio_url=anki.audio_url,
            example_audio_url=anki.example_audio_url,
            source_type="anki_library",
            source_name=anki.source_deck,
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
            source_type="reader",
        )
    db.add(card)
    db.flush()
    db.add(Review(card_id=card.id))
    return ArticleCardResult(card=card, duplicate=False, used_anki=anki is not None, deck=deck)
