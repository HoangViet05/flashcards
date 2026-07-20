"""Local-only FastAPI worker for pronunciation scoring and YouTube captions."""

import os
import tempfile
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware

import scoring
import transcriber
from subtitles import SubtitleError, fetch_subtitles

origins = [value.strip() for value in os.getenv("APP_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if value.strip()]
app = FastAPI(title="Flashcards Shadowing Worker")
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])


@app.middleware("http")
async def allow_private_network(request: Request, call_next):
    response = await call_next(request)
    if request.method == "OPTIONS":
        response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


@app.get("/health")
def health():
    return {"status": "ok", "model": transcriber.MODEL_NAME, "model_loaded": transcriber.is_loaded(), "device": transcriber.get_device()}


@app.post("/score")
async def score(file: UploadFile = File(...), target_text: str = Form(...)):
    if not target_text.strip():
        raise HTTPException(422, "Thiếu câu gốc để chấm")
    payload = await file.read()
    if not payload:
        raise HTTPException(422, "File ghi âm rỗng")
    suffix = Path(file.filename or "recording.webm").suffix or ".webm"
    temp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        temp.write(payload)
        temp.close()
        transcript = transcriber.transcribe(temp.name)
    finally:
        if not temp.closed:
            temp.close()
        if os.path.exists(temp.name):
            os.unlink(temp.name)
    if not transcript:
        return {"transcript": "", "score": 0, "words": [], "no_speech": True}
    result = scoring.score_transcript(target_text, transcript)
    return {"transcript": transcript, **result, "no_speech": False}


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    """Return a partial transcript while the browser is still recording."""
    payload = await file.read()
    if not payload:
        raise HTTPException(422, "Audio recording is empty")
    suffix = Path(file.filename or "recording.webm").suffix or ".webm"
    temp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        temp.write(payload)
        temp.close()
        transcript = transcriber.transcribe(temp.name)
    finally:
        if not temp.closed:
            temp.close()
        if os.path.exists(temp.name):
            os.unlink(temp.name)
    return {"transcript": transcript}


@app.get("/subtitles")
def subtitles(url: str):
    try:
        return fetch_subtitles(url)
    except SubtitleError as exc:
        raise HTTPException(422, str(exc)) from exc
