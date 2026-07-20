from fastapi.testclient import TestClient

import server
from subtitles import SubtitleError

client = TestClient(server.app)


def test_health_reports_model_state():
    body = client.get("/health").json()
    assert body["status"] == "ok" and body["model_loaded"] is False and body["device"] is None


def test_score_returns_word_marks(monkeypatch):
    monkeypatch.setattr(server.transcriber, "transcribe", lambda path: "i am happy")
    response = client.post("/score", files={"file": ("recording.webm", b"audio", "audio/webm")}, data={"target_text": "I'm happy today."})
    assert response.status_code == 200 and response.json()["score"] == 67


def test_score_empty_and_file_validation(monkeypatch):
    monkeypatch.setattr(server.transcriber, "transcribe", lambda path: "")
    assert client.post("/score", files={"file": ("recording.webm", b"audio", "audio/webm")}, data={"target_text": "Hello there."}).json()["no_speech"] is True
    assert client.post("/score", files={"file": ("recording.webm", b"", "audio/webm")}, data={"target_text": "Hello."}).status_code == 422


def test_partial_transcript(monkeypatch):
    monkeypatch.setattr(server.transcriber, "transcribe", lambda path: "speaking live")
    response = client.post("/transcribe", files={"file": ("recording.webm", b"audio", "audio/webm")})
    assert response.status_code == 200 and response.json() == {"transcript": "speaking live"}


def test_subtitles_error_and_private_network(monkeypatch):
    monkeypatch.setattr(server, "fetch_subtitles", lambda url: (_ for _ in ()).throw(SubtitleError("Video không có phụ đề tiếng Anh")))
    assert client.get("/subtitles", params={"url": "https://youtu.be/x"}).status_code == 422
    response = client.options("/score", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST", "Access-Control-Request-Private-Network": "true"})
    assert response.status_code == 200 and response.headers["access-control-allow-private-network"] == "true"
