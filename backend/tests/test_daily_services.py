import random
from datetime import date, datetime

from app.models.card import Card
from app.models.deck import Deck
from app.models.review import Review
from app.models.user import User
from app.services.daily import count_remaining_new, due_review_cards, pick_new_cards, quality_for_wrong_count
from app.services.word_search import DIRECTIONS, find_placement, generate_puzzle, normalize_word


def test_word_search_normalizes_places_and_resolves_words():
    entries = [{"card_id": "a", "word": "give up"}, {"card_id": "b", "word": "well-known"}, {"card_id": "c", "word": "extraordinarily"}]
    puzzle = generate_puzzle(entries, random.Random(42))
    assert normalize_word("café 123!") == "CAF"
    assert puzzle["size"] <= 13 and puzzle["unplaced"] == ["c"]
    for placement in puzzle["placements"]:
        dr, dc = DIRECTIONS[placement["dir"]]
        last = len(placement["word"]) - 1
        assert find_placement(puzzle, placement["row"], placement["col"], placement["row"] + dr * last, placement["col"] + dc * last) == placement


def test_daily_selection_uses_oldest_deck_and_only_due_learned_cards(db):
    user = User(email="daily-service@test.com", password_hash="x", name="daily")
    db.add(user); db.flush()
    old, new = Deck(user_id=user.id, name="old", created_at=datetime(2026, 1, 1)), Deck(user_id=user.id, name="new", created_at=datetime(2026, 2, 1))
    db.add_all([old, new]); db.flush()
    cards = [Card(deck_id=old.id, front_text=f"old{index}", back_text="x") for index in range(4)] + [Card(deck_id=new.id, front_text=f"new{index}", back_text="x") for index in range(12)]
    db.add_all(cards); db.flush(); db.add_all([Review(card_id=card.id, due_date=date.today()) for card in cards]); db.commit()
    picked = pick_new_cards(db, user.id, rng=random.Random(1))
    assert [card.front_text.startswith("old") for card in picked[:4]] == [True] * 4
    for review in db.query(Review).filter(Review.card_id.in_([cards[0].id, cards[1].id])).all(): review.repetitions, review.reviewed_at = 2, datetime.utcnow()
    db.commit()
    assert count_remaining_new(db, user.id) == 14
    assert {card.id for card in due_review_cards(db, user.id)} == {cards[0].id, cards[1].id}
    assert [quality_for_wrong_count(value) for value in range(4)] == [5, 4, 3, 2]
