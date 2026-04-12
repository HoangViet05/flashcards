"""
Seed sample data for testing.
Run: conda activate flashcard && cd backend && python seed.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from datetime import date, timedelta
from app.database import SessionLocal, Base, engine
from app.models.deck import Deck
from app.models.card import Card
from app.models.review import Review

Base.metadata.create_all(bind=engine)

DECKS = [
    {
        "name": "IELTS Vocabulary",
        "description": "Từ vựng thường gặp trong IELTS",
        "cards": [
            ("abundant", "dồi dào, phong phú", "The region has abundant natural resources."),
            ("ambiguous", "mơ hồ, không rõ ràng", "The instructions were ambiguous and confusing."),
            ("coherent", "mạch lạc, nhất quán", "She gave a coherent explanation of the problem."),
            ("deteriorate", "xấu đi, suy giảm", "Air quality continues to deteriorate in major cities."),
            ("ephemeral", "tạm thời, ngắn ngủi", "Fame can be ephemeral in the age of social media."),
            ("fluctuate", "dao động, biến động", "Prices fluctuate depending on supply and demand."),
            ("inevitable", "không thể tránh khỏi", "Change is inevitable in a fast-moving world."),
            ("mitigate", "giảm nhẹ, làm dịu", "We must mitigate the effects of climate change."),
        ],
    },
    {
        "name": "Business English",
        "description": "Từ vựng tiếng Anh thương mại",
        "cards": [
            ("acquisition", "sự mua lại, thâu tóm", "The acquisition of the startup cost $50 million."),
            ("benchmark", "tiêu chuẩn, mốc so sánh", "This report sets a new benchmark for the industry."),
            ("leverage", "đòn bẩy, tận dụng lợi thế", "We can leverage our existing network to grow faster."),
            ("stakeholder", "các bên liên quan", "All stakeholders must approve the new policy."),
            ("synergy", "sức mạnh tổng hợp", "The merger created synergy between the two teams."),
            ("viable", "khả thi, có thể thực hiện được", "Is this business model financially viable?"),
        ],
    },
    {
        "name": "Daily Conversation",
        "description": "Từ vựng hội thoại hàng ngày",
        "cards": [
            ("catch up", "bắt kịp, cập nhật tin tức", "Let's catch up over coffee sometime."),
            ("hang out", "đi chơi, tụ tập", "We used to hang out every weekend."),
            ("figure out", "tìm ra, hiểu được", "I can't figure out how to fix this bug."),
            ("bring up", "đề cập, nhắc đến", "She brought up an interesting point in the meeting."),
            ("look forward to", "mong chờ, trông đợi", "I'm looking forward to the weekend."),
        ],
    },
]

def seed():
    db = SessionLocal()
    try:
        # Clear existing data
        db.query(Review).delete()
        db.query(Card).delete()
        db.query(Deck).delete()
        db.commit()

        today = date.today()
        card_count = 0

        for deck_data in DECKS:
            deck = Deck(name=deck_data["name"], description=deck_data["description"])
            db.add(deck)
            db.flush()

            for i, (front, back, example) in enumerate(deck_data["cards"]):
                card = Card(
                    deck_id=deck.id,
                    front_text=front,
                    back_text=back,
                    example_sentence=example,
                )
                db.add(card)
                db.flush()

                # Vary due dates: some due today, some in the past (overdue), some future
                if i % 3 == 0:
                    due = today  # due today
                elif i % 3 == 1:
                    due = today - timedelta(days=i)  # overdue
                else:
                    due = today + timedelta(days=i * 2)  # future

                review = Review(
                    card_id=card.id,
                    due_date=due,
                    ease_factor=2.5,
                    interval=1 if due <= today else i * 2,
                    repetitions=0 if due <= today else i,
                )
                db.add(review)
                card_count += 1

        db.commit()
        print(f"✅ Seeded {len(DECKS)} decks and {card_count} cards successfully.")

    except Exception as e:
        db.rollback()
        print(f"❌ Error: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed()
