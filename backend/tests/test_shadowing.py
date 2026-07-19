from datetime import date

from app.models.card import Card
from app.models.deck import Deck
from app.models.shadow_video import ShadowVideo
from app.models.shadowing_attempt import ShadowingAttempt
from app.models.user import User


def make_deck_and_card(client):
    deck = client.post('/api/decks', json={'name': 'Shadow deck', 'description': None}).json()
    card = client.post(f"/api/decks/{deck['id']}/cards", json={'front_text': 'resolve', 'back_text': 'giải quyết', 'example_sentence': 'We need to resolve this.', 'example_audio_url': '/media/example.mp3'}).json()
    return deck, card


def test_models_keep_attempt_history_after_card_delete(client, db):
    user = db.query(User).first(); deck = Deck(name='Model deck', user_id=user.id); db.add(deck); db.flush(); card = Card(deck_id=deck.id, front_text='a', back_text='b'); db.add(card); db.flush()
    attempt = ShadowingAttempt(user_id=user.id, source_type='card', card_id=card.id, target_text='Hi', transcript='hi', score=100, word_results=[]); video = ShadowVideo(user_id=user.id, youtube_id='abc', title='Test', duration_s=1, segments=[{'start': 0, 'end': 1, 'text': 'Hi'}]); db.add_all([attempt, video]); db.commit(); db.delete(card); db.commit(); db.refresh(attempt)
    assert attempt.card_id is None and video.segments[0]['text'] == 'Hi'


def test_cards_videos_and_attempts(client):
    deck, card = make_deck_and_card(client)
    assert client.get('/api/shadowing/cards', params={'deck_id': deck['id']}).json()[0]['id'] == card['id']
    payload = {'youtube_id': 'dQw4w9WgXcQ', 'title': 'Test video', 'duration_s': 212, 'segments': [{'start': 1, 'end': 3.5, 'text': 'Never gonna give you up.'}]}
    video = client.post('/api/shadowing/videos', json=payload); assert video.status_code == 201; video_id = video.json()['id']; assert client.get('/api/shadowing/videos').json()[0]['segment_count'] == 1
    attempt = {'source_type': 'card', 'card_id': card['id'], 'target_text': 'We need to resolve this.', 'transcript': 'we need to resolve this', 'score': 85, 'word_results': [{'word': 'We', 'status': 'correct'}]}
    assert client.post('/api/shadowing/attempts', json=attempt).status_code == 201
    stats = client.get('/api/shadowing/stats').json(); assert stats['total_attempts'] == 1 and stats['by_day'][-1]['date'] == date.today().isoformat()
    assert client.delete(f'/api/shadowing/videos/{video_id}').status_code == 204


def test_shadowing_ownership_and_validation(client, user_b_client):
    _, card = make_deck_and_card(client)
    assert user_b_client.post('/api/shadowing/attempts', json={'source_type': 'card', 'card_id': card['id'], 'target_text': 'Hi', 'transcript': 'hi', 'score': 80, 'word_results': []}).status_code == 404
    assert client.post('/api/shadowing/videos', json={'youtube_id': 'x', 'title': 'x', 'segments': []}).status_code == 422
