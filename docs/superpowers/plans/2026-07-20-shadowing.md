# Shadowing Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Echo-style shadowing (nghe → nói lại → chấm điểm từng từ bằng Whisper local) cho 3 nguồn: câu ví dụ flashcard, bài đọc Reader, video YouTube — theo spec `docs/superpowers/specs/2026-07-19-shadowing-design.md`.

**Architecture:** Một worker FastAPI mới chạy trên máy người dùng (`local_shadowing/`, bind `127.0.0.1:8788`) đảm nhận Whisper + yt-dlp; browser gọi thẳng worker để chấm điểm/lấy phụ đề rồi lưu kết quả JSON lên backend Render. Backend chỉ thêm CRUD thuần (2 bảng mới) + 1 router. Frontend thêm trang `/shadowing` với 3 tab nguồn.

**Tech Stack:** FastAPI, SQLAlchemy 2.0 (SQLite dev / Supabase Postgres prod), faster-whisper (CUDA fp16 → CPU int8 fallback), yt-dlp, React 19 + TypeScript + Tailwind v4, MediaRecorder API, YouTube IFrame API.

## Global Constraints

- **Backend Render KHÔNG được thêm dependency mới** — `backend/requirements.txt` giữ nguyên. Mọi dep ML nằm trong `local_shadowing/requirements.txt`.
- Worker bind **`127.0.0.1:8788`**, CORS allowlist từ env `APP_ORIGINS`, preflight trả header `Access-Control-Allow-Private-Network: true`.
- **Không lưu file ghi âm** ở bất kỳ đâu (worker xoá file tạm ngay sau khi chấm; backend chỉ nhận JSON).
- Quy đổi SM-2: score **≥ 80 → quality 5**, **60–79 → quality 3**, **< 60 → không submit**; `rating_source: "shadowing"`; mỗi thẻ submit **1 lần/phiên với điểm cao nhất, khi rời thẻ**.
- Whisper: model từ env `WHISPER_MODEL` (mặc định `small`), `language="en"`, `vad_filter=True`, `beam_size=5`, lazy-load singleton.
- Copy UI tiếng Việt, style Tailwind glassmorphism theo các trang hiện có.
- Test backend + worker chạy bằng Python của conda env `flashcard`: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe` (Python hệ thống 3.14 không cài được deps). Backend test chạy từ thư mục `backend/`.
- Frontend verify bằng `npm run build` (tsc + vite) trong `frontend/`.
- Worker code phải import được **không cần** faster-whisper/yt-dlp/requests/python-dotenv (import lazy/optional) để test chạy được trong env `flashcard` mà không cài deps ML.
- Commit sau mỗi task, message tiếng Anh, kết thúc bằng `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Worker — thuật toán chấm điểm (`scoring.py`)

**Files:**
- Create: `local_shadowing/scoring.py`
- Create: `local_shadowing/tests/__init__.py` (rỗng)
- Create: `local_shadowing/tests/conftest.py`
- Test: `local_shadowing/tests/test_scoring.py`

**Interfaces:**
- Consumes: không có (stdlib thuần: `re`, `difflib`).
- Produces: `score_transcript(target_text: str, transcript: str) -> dict` trả `{"score": int 0-100, "words": [{"word": str, "status": "correct"|"missed"|"substituted"|"skipped"}]}` — `words` theo đúng thứ tự token hiển thị của `target_text`. Task 3 (server `/score`) và test FE dựa vào shape này.

- [ ] **Step 1: Tạo conftest cho tests của worker**

`local_shadowing/tests/conftest.py`:

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
```

- [ ] **Step 2: Viết test fail**

`local_shadowing/tests/test_scoring.py`:

```python
from scoring import normalize_words, score_transcript


def statuses(result):
    return [word["status"] for word in result["words"]]


def test_exact_match_scores_100():
    result = score_transcript("We need to resolve this issue.", "we need to resolve this issue")
    assert result["score"] == 100
    assert statuses(result) == ["correct"] * 6


def test_case_and_punctuation_ignored():
    result = score_transcript("Hello, world!", "hello world")
    assert result["score"] == 100


def test_contractions_expand_on_both_sides():
    # "I'm" hiển thị là 1 token nhưng khớp với "i am" trong transcript
    result = score_transcript("I'm happy today.", "i am happy")
    assert statuses(result) == ["correct", "correct", "missed"]
    assert result["score"] == 67


def test_missed_word_lowers_score():
    result = score_transcript("The quick brown fox jumps.", "the quick fox jumps")
    assert statuses(result) == ["correct", "correct", "missed", "correct", "correct"]
    assert result["score"] == 80


def test_substituted_word_marked():
    result = score_transcript("She sells sea shells.", "she sells big shells")
    assert statuses(result) == ["correct", "correct", "substituted", "correct"]
    assert result["score"] == 75


def test_extra_spoken_words_do_not_penalize():
    result = score_transcript("Good morning.", "well good morning everyone")
    assert result["score"] == 100


def test_empty_transcript_all_missed():
    result = score_transcript("Try again.", "")
    assert result["score"] == 0
    assert statuses(result) == ["missed", "missed"]


def test_symbol_only_token_is_skipped():
    result = score_transcript("Wait — listen.", "wait listen")
    assert statuses(result) == ["correct", "skipped", "correct"]
    assert result["score"] == 100


def test_normalize_words_handles_curly_apostrophe():
    assert normalize_words("don’t") == ["do", "not"]
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest local_shadowing/tests/test_scoring.py -v` (từ repo root)
Expected: FAIL — `ModuleNotFoundError: No module named 'scoring'`

- [ ] **Step 4: Viết `local_shadowing/scoring.py`**

```python
"""Word-level scoring of a spoken transcript against a target sentence."""

import re
from difflib import SequenceMatcher

CONTRACTIONS = {
    "i'm": "i am", "you're": "you are", "we're": "we are", "they're": "they are",
    "he's": "he is", "she's": "she is", "it's": "it is", "that's": "that is",
    "there's": "there is", "what's": "what is", "let's": "let us",
    "i've": "i have", "you've": "you have", "we've": "we have", "they've": "they have",
    "i'll": "i will", "you'll": "you will", "he'll": "he will", "she'll": "she will",
    "we'll": "we will", "they'll": "they will",
    "i'd": "i would", "you'd": "you would", "he'd": "he would", "she'd": "she would",
    "we'd": "we would", "they'd": "they would",
    "don't": "do not", "doesn't": "does not", "didn't": "did not",
    "isn't": "is not", "aren't": "are not", "wasn't": "was not", "weren't": "were not",
    "can't": "cannot", "won't": "will not", "couldn't": "could not",
    "shouldn't": "should not", "wouldn't": "would not",
    "haven't": "have not", "hasn't": "has not", "hadn't": "had not",
}


def normalize_token(token: str) -> list[str]:
    """One display token -> 0..n normalized words ("I'm" -> ["i", "am"], "—" -> [])."""
    token = token.lower().replace("’", "'")
    token = re.sub(r"[^a-z0-9']", "", token).strip("'")
    if not token:
        return []
    expanded = CONTRACTIONS.get(token)
    return expanded.split() if expanded else [token]


def normalize_words(text: str) -> list[str]:
    words: list[str] = []
    for token in text.split():
        words.extend(normalize_token(token))
    return words


def score_transcript(target_text: str, transcript: str) -> dict:
    display_tokens = target_text.split()
    norm_target: list[str] = []
    owners: list[int] = []  # norm word index -> display token index
    for index, token in enumerate(display_tokens):
        for word in normalize_token(token):
            norm_target.append(word)
            owners.append(index)

    norm_spoken = normalize_words(transcript)
    matched = [False] * len(norm_target)
    substituted = [False] * len(norm_target)
    matcher = SequenceMatcher(a=norm_target, b=norm_spoken, autojunk=False)
    for tag, a_start, a_end, _b_start, _b_end in matcher.get_opcodes():
        if tag == "equal":
            for i in range(a_start, a_end):
                matched[i] = True
        elif tag == "replace":
            for i in range(a_start, a_end):
                substituted[i] = True

    words: list[dict] = []
    correct = missed = subbed = 0
    for index, token in enumerate(display_tokens):
        indices = [i for i, owner in enumerate(owners) if owner == index]
        if not indices:
            words.append({"word": token, "status": "skipped"})
            continue
        if all(matched[i] for i in indices):
            status = "correct"
            correct += 1
        elif any(substituted[i] for i in indices):
            status = "substituted"
            subbed += 1
        else:
            status = "missed"
            missed += 1
        words.append({"word": token, "status": status})

    scored = correct + missed + subbed
    score = round(100 * correct / scored) if scored else 0
    return {"score": score, "words": words}
```

- [ ] **Step 5: Chạy lại test, xác nhận pass**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest local_shadowing/tests/test_scoring.py -v`
Expected: 9 passed

- [ ] **Step 6: Commit**

```bash
git add local_shadowing/
git commit -m "feat(shadowing): add word-level transcript scoring for local worker"
```

---

### Task 2: Worker — parse & ghép phụ đề YouTube (`subtitles.py`)

**Files:**
- Create: `local_shadowing/subtitles.py`
- Test: `local_shadowing/tests/test_subtitles.py`

**Interfaces:**
- Consumes: không có ở test (yt-dlp/requests import lazy bên trong hàm fetch).
- Produces:
  - `fetch_subtitles(url: str) -> dict` trả `{"youtube_id": str, "title": str, "duration_s": int|None, "segments": [{"start": float, "end": float, "text": str}]}` — Task 3 expose qua `GET /subtitles`.
  - `SubtitleError(Exception)` với message tiếng Việt hiển thị thẳng cho user.
  - `parse_json3(data: dict) -> list[dict]`, `parse_vtt(text: str) -> list[dict]`, `merge_fragments(fragments) -> list[dict]` (unit-testable, không mạng).

- [ ] **Step 1: Viết test fail**

`local_shadowing/tests/test_subtitles.py`:

```python
from subtitles import merge_fragments, parse_json3, parse_vtt


def test_parse_json3_flattens_events():
    data = {
        "events": [
            {"tStartMs": 1000, "dDurationMs": 2000, "segs": [{"utf8": "Hello "}, {"utf8": "world."}]},
            {"tStartMs": 3500, "dDurationMs": 1500, "segs": [{"utf8": "[Music]"}]},
            {"tStartMs": 5000, "dDurationMs": 1000, "segs": [{"utf8": "Next line"}]},
            {"aAppend": 1},  # event không có tStartMs -> bỏ qua
        ]
    }
    fragments = parse_json3(data)
    assert fragments == [
        {"start": 1.0, "end": 3.0, "text": "Hello world."},
        {"start": 5.0, "end": 6.0, "text": "Next line"},
    ]


def test_parse_vtt_strips_tags_and_rolling_duplicates():
    vtt = """WEBVTT

00:00:01.000 --> 00:00:03.000
Hello <c>world.</c>

00:00:03.000 --> 00:00:05.000
Hello world.
This is fine.

00:00:05.000 --> 00:00:07.000
This is fine.
Another sentence here.
"""
    fragments = parse_vtt(vtt)
    assert fragments == [
        {"start": 1.0, "end": 3.0, "text": "Hello world."},
        {"start": 3.0, "end": 5.0, "text": "This is fine."},
        {"start": 5.0, "end": 7.0, "text": "Another sentence here."},
    ]


def test_parse_vtt_without_hours():
    vtt = """WEBVTT

00:01.000 --> 00:02.500
Short form timing.
"""
    assert parse_vtt(vtt) == [{"start": 1.0, "end": 2.5, "text": "Short form timing."}]


def test_merge_fragments_joins_until_sentence_end():
    fragments = [
        {"start": 0.0, "end": 1.0, "text": "We need to"},
        {"start": 1.0, "end": 2.0, "text": "resolve this issue."},
        {"start": 2.5, "end": 4.0, "text": "Second sentence!"},
    ]
    assert merge_fragments(fragments) == [
        {"start": 0.0, "end": 2.0, "text": "We need to resolve this issue."},
        {"start": 2.5, "end": 4.0, "text": "Second sentence!"},
    ]


def test_merge_fragments_splits_when_too_long():
    fragments = [{"start": float(i * 4), "end": float(i * 4 + 4), "text": f"chunk {i} no punctuation"} for i in range(5)]
    segments = merge_fragments(fragments)
    assert len(segments) > 1
    assert all(segment["end"] - segment["start"] <= 16.5 for segment in segments)
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest local_shadowing/tests/test_subtitles.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'subtitles'`

- [ ] **Step 3: Viết `local_shadowing/subtitles.py`**

```python
"""Fetch YouTube subtitles via yt-dlp and normalize them into shadowing segments."""

import re

MAX_SEGMENT_SECONDS = 15.0
SENTENCE_END = re.compile(r"[.!?][\"')\]]*$")
NOISE = re.compile(r"^[\[(♪].*[\])♪]$")  # [Music], (applause), ♪ lyrics ♪
PREFERRED_LANGS = ("en", "en-US", "en-GB", "en-orig")
TIMING_LINE = re.compile(r"(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})")
TAG = re.compile(r"<[^>]+>")


class SubtitleError(Exception):
    """Raised with a Vietnamese, user-facing message."""


def fetch_subtitles(url: str) -> dict:
    import requests  # lazy: unit tests don't need it

    info = _extract_info(url)
    fmt = _pick_track(info)
    if fmt is None:
        raise SubtitleError("Video không có phụ đề tiếng Anh")
    response = requests.get(fmt["url"], timeout=30)
    response.raise_for_status()
    fragments = parse_json3(response.json()) if fmt["ext"] == "json3" else parse_vtt(response.text)
    segments = merge_fragments(fragments)
    if not segments:
        raise SubtitleError("Không đọc được phụ đề của video này")
    return {
        "youtube_id": info["id"],
        "title": info.get("title") or "Video YouTube",
        "duration_s": int(info["duration"]) if info.get("duration") else None,
        "segments": segments,
    }


def _extract_info(url: str) -> dict:
    import yt_dlp  # lazy: unit tests don't need it

    options = {"skip_download": True, "quiet": True, "no_warnings": True}
    try:
        with yt_dlp.YoutubeDL(options) as ydl:
            return ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as exc:
        raise SubtitleError(
            "Không mở được video — kiểm tra link, video có thể private, hoặc chạy 'pip install -U yt-dlp'"
        ) from exc


def _pick_track(info: dict) -> dict | None:
    """Manual subs first, then auto captions; json3 preferred over vtt."""
    for source in (info.get("subtitles") or {}, info.get("automatic_captions") or {}):
        for lang in PREFERRED_LANGS:
            formats = source.get(lang) or []
            for preferred_ext in ("json3", "vtt"):
                for fmt in formats:
                    if fmt.get("ext") == preferred_ext and fmt.get("url"):
                        return fmt
    return None


def parse_json3(data: dict) -> list[dict]:
    fragments = []
    for event in data.get("events") or []:
        start_ms = event.get("tStartMs")
        if start_ms is None:
            continue
        text = "".join(seg.get("utf8", "") for seg in event.get("segs") or [])
        text = " ".join(text.split())
        if not text or NOISE.match(text):
            continue
        duration_ms = event.get("dDurationMs") or 0
        fragments.append({"start": start_ms / 1000, "end": (start_ms + duration_ms) / 1000, "text": text})
    return fragments


def _to_seconds(hours, minutes, seconds, millis) -> float:
    return int(hours or 0) * 3600 + int(minutes) * 60 + int(seconds) + int(millis) / 1000


def parse_vtt(text: str) -> list[dict]:
    fragments = []
    lines = text.splitlines()
    index = 0
    previous_lines: list[str] = []
    while index < len(lines):
        match = TIMING_LINE.search(lines[index])
        if not match:
            index += 1
            continue
        groups = match.groups()
        start = _to_seconds(*groups[:4])
        end = _to_seconds(*groups[4:])
        cue_lines: list[str] = []
        index += 1
        while index < len(lines) and lines[index].strip():
            line = " ".join(TAG.sub("", lines[index]).split())
            if line:
                cue_lines.append(line)
            index += 1
        # Auto captions roll: each cue repeats the previous cue's lines. Keep only new lines.
        new_lines = [line for line in cue_lines if line not in previous_lines]
        previous_lines = cue_lines
        cue = " ".join(new_lines)
        if cue and not NOISE.match(cue):
            fragments.append({"start": start, "end": end, "text": cue})
    return fragments


def merge_fragments(fragments: list[dict]) -> list[dict]:
    """Join caption fragments into sentence-sized segments (<= ~15s each)."""
    segments: list[dict] = []
    parts: list[str] = []
    start: float | None = None
    end = 0.0

    def flush() -> None:
        nonlocal start, parts
        text = " ".join(" ".join(parts).split())
        if start is not None and text:
            segments.append({"start": round(start, 2), "end": round(end, 2), "text": text[:1000]})
        start, parts = None, []

    for fragment in fragments:
        if start is None:
            start = fragment["start"]
        parts.append(fragment["text"])
        end = fragment["end"]
        if SENTENCE_END.search(fragment["text"]) or end - start >= MAX_SEGMENT_SECONDS:
            flush()
    flush()
    return segments
```

- [ ] **Step 4: Chạy lại test, xác nhận pass**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest local_shadowing/tests/test_subtitles.py -v`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add local_shadowing/subtitles.py local_shadowing/tests/test_subtitles.py
git commit -m "feat(shadowing): parse and merge YouTube subtitles into segments"
```

---

### Task 3: Worker — FastAPI server, Whisper wrapper, scripts cài đặt

**Files:**
- Create: `local_shadowing/transcriber.py`
- Create: `local_shadowing/server.py`
- Create: `local_shadowing/requirements.txt`
- Create: `local_shadowing/.env.example`
- Create: `local_shadowing/install_shadowing.bat`
- Create: `local_shadowing/start_shadowing.bat`
- Create: `local_shadowing/README.md`
- Test: `local_shadowing/tests/test_server.py`

**Interfaces:**
- Consumes: `scoring.score_transcript` (Task 1), `subtitles.fetch_subtitles` + `SubtitleError` (Task 2).
- Produces (FE Task 8 gọi các endpoint này):
  - `GET /health` → `{"status": "ok", "model": str, "model_loaded": bool, "device": "cuda"|"cpu"|null}`
  - `POST /score` (multipart `file`, form `target_text`) → `{"transcript": str, "score": int, "words": [...], "no_speech": bool}`
  - `GET /subtitles?url=` → kết quả `fetch_subtitles`; lỗi → 422 `{"detail": "<tiếng Việt>"}`
  - `transcriber.transcribe(path) -> str`, `transcriber.is_loaded() -> bool`, `transcriber.get_device() -> str|None`, `transcriber.MODEL_NAME`

- [ ] **Step 1: Viết test fail**

`local_shadowing/tests/test_server.py`:

```python
from fastapi.testclient import TestClient

import server
from subtitles import SubtitleError

client = TestClient(server.app)


def test_health_reports_model_state():
    response = client.get("/health")
    body = response.json()
    assert response.status_code == 200
    assert body["status"] == "ok"
    assert body["model_loaded"] is False
    assert body["device"] is None


def test_score_returns_word_marks(monkeypatch):
    monkeypatch.setattr(server.transcriber, "transcribe", lambda path: "i am happy")
    response = client.post(
        "/score",
        files={"file": ("recording.webm", b"fake-audio-bytes", "audio/webm")},
        data={"target_text": "I'm happy today."},
    )
    body = response.json()
    assert response.status_code == 200
    assert body["no_speech"] is False
    assert body["score"] == 67
    assert [w["status"] for w in body["words"]] == ["correct", "correct", "missed"]
    assert body["transcript"] == "i am happy"


def test_score_empty_transcript_flags_no_speech(monkeypatch):
    monkeypatch.setattr(server.transcriber, "transcribe", lambda path: "")
    response = client.post(
        "/score",
        files={"file": ("recording.webm", b"fake-audio-bytes", "audio/webm")},
        data={"target_text": "Hello there."},
    )
    body = response.json()
    assert response.status_code == 200
    assert body["no_speech"] is True
    assert body["score"] == 0


def test_score_rejects_empty_file():
    response = client.post(
        "/score",
        files={"file": ("recording.webm", b"", "audio/webm")},
        data={"target_text": "Hello."},
    )
    assert response.status_code == 422


def test_subtitles_maps_error_to_422(monkeypatch):
    def boom(url):
        raise SubtitleError("Video không có phụ đề tiếng Anh")

    monkeypatch.setattr(server, "fetch_subtitles", boom)
    response = client.get("/subtitles", params={"url": "https://youtu.be/x"})
    assert response.status_code == 422
    assert response.json()["detail"] == "Video không có phụ đề tiếng Anh"


def test_preflight_allows_private_network():
    response = client.options(
        "/score",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Private-Network": "true",
        },
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert response.headers["access-control-allow-private-network"] == "true"
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest local_shadowing/tests/test_server.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'server'`

- [ ] **Step 3: Viết `local_shadowing/transcriber.py`**

```python
"""Lazy-loaded faster-whisper singleton with CUDA -> CPU fallback."""

import importlib.util
import logging
import os
import threading

log = logging.getLogger("shadowing-worker")

MODEL_NAME = os.getenv("WHISPER_MODEL", "small")
_lock = threading.Lock()
_model = None
_device: str | None = None


def is_loaded() -> bool:
    return _model is not None


def get_device() -> str | None:
    return _device


def _add_cuda_dll_dirs() -> None:
    """Let ctranslate2 find pip-installed cuBLAS/cuDNN DLLs on Windows."""
    for module in ("nvidia.cublas", "nvidia.cudnn"):
        spec = importlib.util.find_spec(module)
        locations = list(spec.submodule_search_locations or []) if spec else []
        for location in locations:
            bin_dir = os.path.join(location, "bin")
            if os.path.isdir(bin_dir):
                os.add_dll_directory(bin_dir)


def _load() -> None:
    global _model, _device
    from faster_whisper import WhisperModel  # lazy: tests never load the real model

    try:
        _add_cuda_dll_dirs()
        _model = WhisperModel(MODEL_NAME, device="cuda", compute_type="float16")
        _device = "cuda"
        log.info("Whisper '%s' chạy trên CUDA", MODEL_NAME)
    except Exception as exc:
        log.warning("Không dùng được CUDA (%s) — chuyển sang CPU int8", exc)
        _model = WhisperModel(MODEL_NAME, device="cpu", compute_type="int8")
        _device = "cpu"


def transcribe(audio_path: str) -> str:
    with _lock:
        if _model is None:
            _load()
    segments, _info = _model.transcribe(audio_path, language="en", vad_filter=True, beam_size=5)
    return " ".join(segment.text.strip() for segment in segments).strip()
```

- [ ] **Step 4: Viết `local_shadowing/server.py`**

```python
"""Local GPU worker: chấm điểm shadowing + lấy phụ đề YouTube cho web Flashie.

Chạy bằng start_shadowing.bat. Chỉ bind 127.0.0.1 — không nhận kết nối từ máy khác.
"""

import logging
import os
import tempfile
from pathlib import Path

try:  # .env là tiện ích khi chạy thật; tests không cần python-dotenv
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent / ".env")
except ImportError:
    pass

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware

import scoring
import transcriber
from subtitles import SubtitleError, fetch_subtitles

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(message)s", datefmt="%H:%M:%S")

DEFAULT_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
origins = [origin.strip() for origin in os.getenv("APP_ORIGINS", DEFAULT_ORIGINS).split(",") if origin.strip()]

app = FastAPI(title="Flashie Shadowing Worker")
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])


@app.middleware("http")
async def allow_private_network(request: Request, call_next):
    """Chrome Private Network Access: chấp nhận preflight từ trang public HTTPS."""
    response = await call_next(request)
    if request.method == "OPTIONS":
        response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": transcriber.MODEL_NAME,
        "model_loaded": transcriber.is_loaded(),
        "device": transcriber.get_device(),
    }


@app.post("/score")
async def score(file: UploadFile = File(...), target_text: str = Form(...)):
    if not target_text.strip():
        raise HTTPException(status_code=422, detail="Thiếu câu gốc để chấm")
    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=422, detail="File ghi âm rỗng")
    suffix = Path(file.filename or "recording.webm").suffix or ".webm"
    temp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    try:
        temp.write(payload)
        temp.close()
        transcript = transcriber.transcribe(temp.name)
    finally:
        if not temp.closed:
            temp.close()
        os.unlink(temp.name)
    if not transcript:
        return {"transcript": "", "score": 0, "words": [], "no_speech": True}
    result = scoring.score_transcript(target_text, transcript)
    return {"transcript": transcript, "score": result["score"], "words": result["words"], "no_speech": False}


@app.get("/subtitles")
def subtitles(url: str):
    try:
        return fetch_subtitles(url)
    except SubtitleError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
```

- [ ] **Step 5: Chạy lại test, xác nhận pass**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest local_shadowing/tests -v`
Expected: 20 passed (9 scoring + 5 subtitles + 6 server)

- [ ] **Step 6: Viết requirements + .env.example**

`local_shadowing/requirements.txt`:

```
fastapi>=0.111,<1
uvicorn[standard]>=0.29,<1
python-multipart>=0.0.9,<1
python-dotenv>=1.0,<2
requests>=2.32,<3
faster-whisper>=1.0,<2
yt-dlp>=2025.1.1
nvidia-cublas-cu12>=12.4; sys_platform == 'win32'
nvidia-cudnn-cu12>=9,<10; sys_platform == 'win32'
```

`local_shadowing/.env.example`:

```
# Model Whisper: tiny | base | small | medium (small khuyen nghi cho RTX 4060)
WHISPER_MODEL=small
# Cac origin web duoc phep goi worker (them domain Vercel cua ban vao day)
APP_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://your-app.vercel.app
```

- [ ] **Step 7: Viết 2 file .bat (mẫu theo `local_translator/`)**

`local_shadowing/install_shadowing.bat`:

```bat
@echo off
setlocal
cd /d "%~dp0"

if not exist .venv\Scripts\python.exe (
  echo Dang tao moi truong Python rieng cho shadowing worker...
  if exist "%USERPROFILE%\anaconda3\envs\flashcard\python.exe" (
    "%USERPROFILE%\anaconda3\envs\flashcard\python.exe" -m venv .venv
  ) else (
    py -3.12 -m venv .venv
  )
  if errorlevel 1 (
    echo Khong tao duoc .venv. Can Python 3.10 - 3.13.
    pause
    exit /b 1
  )
)

call .venv\Scripts\activate.bat
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install -r requirements.txt

if errorlevel 1 (
  echo Cai dat thu vien that bai. Kiem tra Internet roi chay lai file nay.
  pause
  exit /b 1
)

if not exist .env copy .env.example .env

echo.
echo Cai dat xong. Bam dup start_shadowing.bat de bat cong tac cham diem.
pause
```

`local_shadowing/start_shadowing.bat`:

```bat
@echo off
cd /d "%~dp0"
if not exist .venv\Scripts\python.exe (
  echo Chua cai worker. Hay chay install_shadowing.bat truoc.
  pause
  exit /b 1
)
call .venv\Scripts\activate.bat
echo Cong tac cham diem shadowing dang BAT tai http://127.0.0.1:8788 — dong cua so nay de TAT.
.venv\Scripts\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8788
pause
```

- [ ] **Step 8: Viết `local_shadowing/README.md`**

```markdown
# Shadowing Worker — công tắc chấm điểm bằng RTX 4060

Service nhỏ chạy trên máy bạn, chỉ bind `127.0.0.1:8788`. Trang web (Vercel) gọi thẳng
vào đây để chấm điểm phát âm (Whisper) và lấy phụ đề YouTube (yt-dlp) — audio ghi âm
không bao giờ rời máy và không được lưu lại.

## Cài một lần

1. Chạy `install_shadowing.bat` (tạo `.venv` riêng, cài faster-whisper + yt-dlp).
2. Mở file `.env`, thêm domain Vercel của bạn vào `APP_ORIGINS`.

## Dùng hằng ngày

1. Bấm đúp `start_shadowing.bat` — thấy dòng "đang BẬT" là xong; trang Shadowing trên
   web sẽ hiện badge 🟢 GPU sẵn sàng.
2. Lần chấm điểm đầu tiên sẽ tải model Whisper (~460MB) — chỉ 1 lần.
3. Đóng cửa sổ (hoặc Ctrl+C) để tắt công tắc.

## Lưu ý

- Lần đầu web gọi vào worker, Chrome sẽ hỏi quyền **Local Network Access** — bấm Allow.
- Nếu import YouTube báo lỗi, chạy: `.venv\Scripts\python.exe -m pip install -U yt-dlp`.
- Không có GPU/CUDA lỗi → worker tự chuyển CPU (chậm hơn, ~1–3s mỗi câu).
```

- [ ] **Step 9: Commit**

```bash
git add local_shadowing/
git commit -m "feat(shadowing): local worker server with whisper scoring and subtitles endpoints"
```

---

### Task 4: Backend — models `ShadowVideo` + `ShadowingAttempt`

**Files:**
- Create: `backend/app/models/shadow_video.py`
- Create: `backend/app/models/shadowing_attempt.py`
- Modify: `backend/app/models/__init__.py`
- Test: `backend/tests/test_shadowing_models.py`

**Interfaces:**
- Consumes: `app.database.Base`; các model `User`, `Card`, `Article` hiện có.
- Produces: ORM class `ShadowVideo` (bảng `shadow_videos`) và `ShadowingAttempt` (bảng `shadowing_attempts`) — Task 5–7 import từ `app.models.shadow_video` / `app.models.shadowing_attempt`. Bảng tự tạo qua `Base.metadata.create_all` (không cần migration tay).

- [ ] **Step 1: Viết test fail**

`backend/tests/test_shadowing_models.py`:

```python
from app.models.card import Card
from app.models.deck import Deck
from app.models.shadow_video import ShadowVideo
from app.models.shadowing_attempt import ShadowingAttempt
from app.models.user import User


def test_attempt_keeps_history_after_card_delete(client, db):
    # client fixture đã đăng ký user A
    user = db.query(User).first()
    deck = Deck(name="Shadow deck", user_id=user.id)
    db.add(deck)
    db.flush()
    card = Card(deck_id=deck.id, front_text="resolve", back_text="giải quyết")
    db.add(card)
    db.flush()
    attempt = ShadowingAttempt(
        user_id=user.id,
        source_type="card",
        card_id=card.id,
        target_text="We need to resolve this.",
        transcript="we need to resolve this",
        score=100,
        word_results=[{"word": "We", "status": "correct"}],
    )
    db.add(attempt)
    db.commit()

    db.delete(card)
    db.commit()
    db.refresh(attempt)
    assert attempt.card_id is None
    assert attempt.score == 100


def test_shadow_video_stores_segments_json(client, db):
    user = db.query(User).first()
    video = ShadowVideo(
        user_id=user.id,
        youtube_id="dQw4w9WgXcQ",
        title="Test video",
        duration_s=212,
        segments=[{"start": 1.0, "end": 3.5, "text": "Never gonna give you up."}],
    )
    db.add(video)
    db.commit()
    db.refresh(video)
    assert video.segments[0]["text"] == "Never gonna give you up."
    assert video.created_at is not None
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run (từ `backend/`): `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_shadowing_models.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.models.shadow_video'`

- [ ] **Step 3: Viết `backend/app/models/shadow_video.py`**

```python
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ShadowVideo(Base):
    """A YouTube video imported for shadowing practice; one row per (user, video)."""

    __tablename__ = "shadow_videos"
    __table_args__ = (UniqueConstraint("user_id", "youtube_id", name="uq_shadow_videos_user_youtube"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    youtube_id: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    duration_s: Mapped[int | None] = mapped_column(Integer, nullable=True)
    segments: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

- [ ] **Step 4: Viết `backend/app/models/shadowing_attempt.py`**

```python
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ShadowingAttempt(Base):
    """One scored shadowing recording. The audio itself is never stored."""

    __tablename__ = "shadowing_attempts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    source_type: Mapped[str] = mapped_column(String(10), nullable=False)  # card | article | youtube
    card_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("cards.id", ondelete="SET NULL"), nullable=True)
    article_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("articles.id", ondelete="SET NULL"), nullable=True)
    video_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("shadow_videos.id", ondelete="SET NULL"), nullable=True)
    segment_index: Mapped[int | None] = mapped_column(Integer, nullable=True)
    target_text: Mapped[str] = mapped_column(Text, nullable=False)
    transcript: Mapped[str] = mapped_column(Text, nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    word_results: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
```

- [ ] **Step 5: Đăng ký model trong `backend/app/models/__init__.py`** — thêm 2 dòng vào cuối:

```python
from app.models.shadow_video import ShadowVideo  # noqa: F401
from app.models.shadowing_attempt import ShadowingAttempt  # noqa: F401
```

- [ ] **Step 6: Chạy lại test, xác nhận pass**

Run (từ `backend/`): `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_shadowing_models.py -v`
Expected: 2 passed

- [ ] **Step 7: Chạy toàn bộ test backend đảm bảo không vỡ gì**

Run (từ `backend/`): `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests -q`
Expected: tất cả pass

- [ ] **Step 8: Commit**

```bash
git add backend/app/models/ backend/tests/test_shadowing_models.py
git commit -m "feat(shadowing): add ShadowVideo and ShadowingAttempt models"
```

---

### Task 5: Backend — schemas + router `/api/shadowing` với `GET /cards`

**Files:**
- Create: `backend/app/schemas/shadowing.py`
- Create: `backend/app/routers/shadowing.py`
- Modify: `backend/app/main.py` (import + include router)
- Test: `backend/tests/test_shadowing_cards.py`

**Interfaces:**
- Consumes: models Task 4; `get_owned_deck` (routers/decks), `get_current_user`, `Card`, `Deck`, `Review`.
- Produces:
  - `GET /api/shadowing/cards?deck_id=&card_id=&due_only=&limit=` → `list[ShadowCardOut]` với field `id, front_text, example_sentence, example_audio_url, pronunciation`.
  - Toàn bộ Pydantic schemas trong `app/schemas/shadowing.py` mà Task 6–7 dùng: `ShadowSegment`, `ShadowVideoCreate`, `ShadowVideoListItem`, `ShadowVideoOut`, `ShadowWordResult`, `ShadowAttemptCreate`, `ShadowAttemptOut`, `ShadowingDayStat`, `ShadowingStatsOut`, `ShadowCardOut`.
  - Router object `router` (prefix `/api/shadowing`) đã include trong `main.py`.

- [ ] **Step 1: Viết test fail**

`backend/tests/test_shadowing_cards.py`:

```python
def make_deck(client, name="Shadow deck"):
    response = client.post("/api/decks", json={"name": name})
    assert response.status_code in (200, 201), response.text
    return response.json()["id"]


def make_card(client, deck_id, front_text="resolve", **overrides):
    payload = {
        "front_text": front_text,
        "back_text": "nghĩa",
        "example_sentence": "We need to resolve this issue quickly.",
        "example_audio_url": "/media/resolve_example.mp3",
    }
    payload.update(overrides)
    response = client.post(f"/api/decks/{deck_id}/cards", json=payload)
    assert response.status_code in (200, 201), response.text
    return response.json()


def test_returns_only_cards_with_example_audio(client):
    deck_id = make_deck(client)
    good = make_card(client, deck_id, front_text="alpha")
    make_card(client, deck_id, front_text="beta", example_audio_url=None)
    make_card(client, deck_id, front_text="gamma", example_sentence=None)

    response = client.get("/api/shadowing/cards", params={"deck_id": deck_id})
    body = response.json()
    assert response.status_code == 200
    assert [card["id"] for card in body] == [good["id"]]
    assert body[0]["example_sentence"] == "We need to resolve this issue quickly."
    assert body[0]["example_audio_url"] == "/media/resolve_example.mp3"


def test_card_id_filter_returns_single_card(client):
    deck_id = make_deck(client)
    first = make_card(client, deck_id, front_text="alpha")
    make_card(client, deck_id, front_text="beta")

    response = client.get("/api/shadowing/cards", params={"card_id": first["id"]})
    assert response.status_code == 200
    assert [card["id"] for card in response.json()] == [first["id"]]


def test_due_only_includes_new_cards(client):
    # Thẻ mới tạo có Review due hôm nay nên xuất hiện trong due_only
    deck_id = make_deck(client)
    card = make_card(client, deck_id)
    response = client.get("/api/shadowing/cards", params={"due_only": "true"})
    assert response.status_code == 200
    assert card["id"] in [item["id"] for item in response.json()]


def test_other_users_cards_are_hidden(client, user_b_client):
    deck_id = make_deck(client)
    make_card(client, deck_id)
    response = user_b_client.get("/api/shadowing/cards")
    assert response.status_code == 200
    assert response.json() == []


def test_requires_auth(anon_client):
    assert anon_client.get("/api/shadowing/cards").status_code == 401
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run (từ `backend/`): `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_shadowing_cards.py -v`
Expected: FAIL — 404 Not Found (router chưa tồn tại)

- [ ] **Step 3: Viết `backend/app/schemas/shadowing.py`** (đầy đủ cho cả Task 6–7)

```python
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class ShadowCardOut(BaseModel):
    id: str
    front_text: str
    example_sentence: str
    example_audio_url: str
    pronunciation: str | None

    model_config = {"from_attributes": True}


class ShadowSegment(BaseModel):
    start: float = Field(ge=0)
    end: float = Field(ge=0)
    text: str = Field(min_length=1, max_length=1000)


class ShadowVideoCreate(BaseModel):
    youtube_id: str = Field(min_length=1, max_length=20)
    title: str = Field(min_length=1, max_length=500)
    duration_s: int | None = None
    segments: list[ShadowSegment] = Field(min_length=1, max_length=2000)


class ShadowVideoListItem(BaseModel):
    id: str
    youtube_id: str
    title: str
    duration_s: int | None
    segment_count: int
    created_at: datetime


class ShadowVideoOut(ShadowVideoListItem):
    segments: list[ShadowSegment]


class ShadowWordResult(BaseModel):
    word: str
    status: Literal["correct", "missed", "substituted", "skipped"]


class ShadowAttemptCreate(BaseModel):
    source_type: Literal["card", "article", "youtube"]
    card_id: str | None = None
    article_id: str | None = None
    video_id: str | None = None
    segment_index: int | None = None
    target_text: str = Field(min_length=1)
    transcript: str
    score: int = Field(ge=0, le=100)
    word_results: list[ShadowWordResult]


class ShadowAttemptOut(BaseModel):
    id: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ShadowingDayStat(BaseModel):
    date: str
    count: int
    avg_score: float | None


class ShadowingStatsOut(BaseModel):
    total_attempts: int
    attempts_7d: int
    avg_score_7d: float | None
    by_day: list[ShadowingDayStat]
```

- [ ] **Step 4: Viết `backend/app/routers/shadowing.py`** (task này mới có `/cards`)

```python
from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.card import Card
from app.models.deck import Deck
from app.models.review import Review
from app.models.user import User
from app.routers.decks import get_owned_deck
from app.schemas.shadowing import ShadowCardOut
from app.services.security import get_current_user

router = APIRouter(prefix="/api/shadowing", tags=["shadowing"])


@router.get("/cards", response_model=list[ShadowCardOut])
def get_shadow_cards(
    deck_id: str | None = Query(default=None),
    card_id: str | None = Query(default=None),
    due_only: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = (
        db.query(Card)
        .join(Deck, Card.deck_id == Deck.id)
        .filter(
            Deck.user_id == user.id,
            Card.example_sentence.isnot(None),
            Card.example_sentence != "",
            Card.example_audio_url.isnot(None),
            Card.example_audio_url != "",
        )
    )
    if card_id:
        query = query.filter(Card.id == card_id)
    if deck_id:
        get_owned_deck(deck_id, db, user)
        query = query.filter(Card.deck_id == deck_id)
    if due_only:
        query = query.join(Review, Review.card_id == Card.id).filter(Review.due_date <= date.today())
    return query.order_by(Card.created_at).limit(limit).all()
```

- [ ] **Step 5: Đăng ký router trong `backend/app/main.py`**

Thêm import (cạnh các import router hiện có):

```python
from app.routers import shadowing
```

Thêm include (cạnh các `include_router` hiện có):

```python
app.include_router(shadowing.router)
```

- [ ] **Step 6: Chạy lại test, xác nhận pass**

Run (từ `backend/`): `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_shadowing_cards.py -v`
Expected: 5 passed

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/shadowing.py backend/app/routers/shadowing.py backend/app/main.py backend/tests/test_shadowing_cards.py
git commit -m "feat(shadowing): shadowing router with practice-card listing"
```

---

### Task 6: Backend — CRUD `shadow_videos`

**Files:**
- Modify: `backend/app/routers/shadowing.py`
- Test: `backend/tests/test_shadowing_videos.py`

**Interfaces:**
- Consumes: `ShadowVideo` model (Task 4), schemas `ShadowVideoCreate/ShadowVideoListItem/ShadowVideoOut` (Task 5).
- Produces (FE Task 13 gọi):
  - `POST /api/shadowing/videos` (body `ShadowVideoCreate`) → 201 `ShadowVideoOut`, upsert theo `(user_id, youtube_id)`
  - `GET /api/shadowing/videos` → `list[ShadowVideoListItem]` (không kèm segments)
  - `GET /api/shadowing/videos/{video_id}` → `ShadowVideoOut`
  - `DELETE /api/shadowing/videos/{video_id}` → 204

- [ ] **Step 1: Viết test fail**

`backend/tests/test_shadowing_videos.py`:

```python
VIDEO = {
    "youtube_id": "dQw4w9WgXcQ",
    "title": "Test video",
    "duration_s": 212,
    "segments": [
        {"start": 1.0, "end": 3.5, "text": "Never gonna give you up."},
        {"start": 3.5, "end": 6.0, "text": "Never gonna let you down."},
    ],
}


def test_create_and_get_video(client):
    created = client.post("/api/shadowing/videos", json=VIDEO)
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["segment_count"] == 2
    assert body["segments"][0]["text"] == "Never gonna give you up."

    listing = client.get("/api/shadowing/videos").json()
    assert len(listing) == 1
    assert "segments" not in listing[0]
    assert listing[0]["segment_count"] == 2

    detail = client.get(f"/api/shadowing/videos/{body['id']}").json()
    assert len(detail["segments"]) == 2


def test_same_youtube_id_upserts(client):
    first = client.post("/api/shadowing/videos", json=VIDEO).json()
    updated = {**VIDEO, "title": "Updated title", "segments": VIDEO["segments"][:1]}
    second = client.post("/api/shadowing/videos", json=updated).json()
    assert second["id"] == first["id"]
    assert second["title"] == "Updated title"
    assert second["segment_count"] == 1
    assert len(client.get("/api/shadowing/videos").json()) == 1


def test_delete_video(client):
    video_id = client.post("/api/shadowing/videos", json=VIDEO).json()["id"]
    assert client.delete(f"/api/shadowing/videos/{video_id}").status_code == 204
    assert client.get("/api/shadowing/videos").json() == []


def test_video_ownership_enforced(client, user_b_client):
    video_id = client.post("/api/shadowing/videos", json=VIDEO).json()["id"]
    assert user_b_client.get(f"/api/shadowing/videos/{video_id}").status_code == 404
    assert user_b_client.delete(f"/api/shadowing/videos/{video_id}").status_code == 404
    assert user_b_client.get("/api/shadowing/videos").json() == []


def test_rejects_empty_segments(client):
    assert client.post("/api/shadowing/videos", json={**VIDEO, "segments": []}).status_code == 422
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run (từ `backend/`): `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_shadowing_videos.py -v`
Expected: FAIL — 404/405 (endpoint chưa có)

- [ ] **Step 3: Thêm endpoints vào `backend/app/routers/shadowing.py`**

Thêm vào import ở đầu file:

```python
from datetime import datetime

from fastapi import HTTPException, Response

from app.models.shadow_video import ShadowVideo
from app.schemas.shadowing import ShadowVideoCreate, ShadowVideoListItem, ShadowVideoOut
```

Thêm vào cuối file:

```python
def _get_owned_video(video_id: str, db: Session, user: User) -> ShadowVideo:
    video = db.query(ShadowVideo).filter(ShadowVideo.id == video_id, ShadowVideo.user_id == user.id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return video


def _video_out(video: ShadowVideo) -> dict:
    return {
        "id": video.id,
        "youtube_id": video.youtube_id,
        "title": video.title,
        "duration_s": video.duration_s,
        "segment_count": len(video.segments),
        "created_at": video.created_at,
        "segments": video.segments,
    }


@router.post("/videos", response_model=ShadowVideoOut, status_code=201)
def create_video(body: ShadowVideoCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    segments = [segment.model_dump() for segment in body.segments]
    video = (
        db.query(ShadowVideo)
        .filter(ShadowVideo.user_id == user.id, ShadowVideo.youtube_id == body.youtube_id)
        .first()
    )
    if video:
        video.title = body.title
        video.duration_s = body.duration_s
        video.segments = segments
        video.updated_at = datetime.utcnow()
    else:
        video = ShadowVideo(
            user_id=user.id,
            youtube_id=body.youtube_id,
            title=body.title,
            duration_s=body.duration_s,
            segments=segments,
        )
        db.add(video)
    db.commit()
    db.refresh(video)
    return _video_out(video)


@router.get("/videos", response_model=list[ShadowVideoListItem])
def list_videos(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    videos = (
        db.query(ShadowVideo)
        .filter(ShadowVideo.user_id == user.id)
        .order_by(ShadowVideo.created_at.desc())
        .all()
    )
    return [_video_out(video) for video in videos]


@router.get("/videos/{video_id}", response_model=ShadowVideoOut)
def get_video(video_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return _video_out(_get_owned_video(video_id, db, user))


@router.delete("/videos/{video_id}", status_code=204)
def delete_video(video_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.delete(_get_owned_video(video_id, db, user))
    db.commit()
    return Response(status_code=204)
```

- [ ] **Step 4: Chạy lại test, xác nhận pass**

Run (từ `backend/`): `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_shadowing_videos.py -v`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/shadowing.py backend/tests/test_shadowing_videos.py
git commit -m "feat(shadowing): shadow video CRUD with per-user upsert"
```

---

### Task 7: Backend — `POST /attempts` + `GET /stats`

**Files:**
- Modify: `backend/app/routers/shadowing.py`
- Test: `backend/tests/test_shadowing_attempts.py`

**Interfaces:**
- Consumes: `ShadowingAttempt` model, `get_owned_card` (routers/cards), `Article` model, `_get_owned_video` (Task 6), schemas `ShadowAttemptCreate/ShadowAttemptOut/ShadowingStatsOut`.
- Produces (FE Task 8/11 gọi):
  - `POST /api/shadowing/attempts` → 201 `{"id", "created_at"}`; 400 nếu thiếu ref khớp `source_type`; 404 nếu ref không thuộc user.
  - `GET /api/shadowing/stats` → `ShadowingStatsOut` (7 ngày gần nhất, `by_day` đủ 7 phần tử cũ→mới).

- [ ] **Step 1: Viết test fail**

`backend/tests/test_shadowing_attempts.py`:

```python
from datetime import date

from tests.test_shadowing_cards import make_card, make_deck


def make_attempt_payload(card_id, score=85):
    return {
        "source_type": "card",
        "card_id": card_id,
        "target_text": "We need to resolve this issue quickly.",
        "transcript": "we need to resolve this issue quickly",
        "score": score,
        "word_results": [{"word": "We", "status": "correct"}],
    }


def test_create_card_attempt(client):
    deck_id = make_deck(client)
    card = make_card(client, deck_id)
    response = client.post("/api/shadowing/attempts", json=make_attempt_payload(card["id"]))
    assert response.status_code == 201, response.text
    assert response.json()["id"]


def test_attempt_requires_matching_ref(client):
    payload = make_attempt_payload(None)
    payload.pop("card_id")
    assert client.post("/api/shadowing/attempts", json=payload).status_code == 400


def test_attempt_rejects_foreign_card(client, user_b_client):
    deck_id = make_deck(client)
    card = make_card(client, deck_id)
    response = user_b_client.post("/api/shadowing/attempts", json=make_attempt_payload(card["id"]))
    assert response.status_code == 404


def test_attempt_rejects_out_of_range_score(client):
    deck_id = make_deck(client)
    card = make_card(client, deck_id)
    assert client.post("/api/shadowing/attempts", json=make_attempt_payload(card["id"], score=150)).status_code == 422


def test_stats_aggregates_last_7_days(client):
    deck_id = make_deck(client)
    card = make_card(client, deck_id)
    for score in (60, 80, 100):
        assert client.post("/api/shadowing/attempts", json=make_attempt_payload(card["id"], score=score)).status_code == 201

    stats = client.get("/api/shadowing/stats").json()
    assert stats["total_attempts"] == 3
    assert stats["attempts_7d"] == 3
    assert stats["avg_score_7d"] == 80.0
    assert len(stats["by_day"]) == 7
    today = stats["by_day"][-1]
    assert today["date"] == date.today().isoformat()
    assert today["count"] == 3
    assert today["avg_score"] == 80.0


def test_stats_empty(client):
    stats = client.get("/api/shadowing/stats").json()
    assert stats["total_attempts"] == 0
    assert stats["avg_score_7d"] is None
    assert all(day["count"] == 0 for day in stats["by_day"])
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run (từ `backend/`): `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_shadowing_attempts.py -v`
Expected: FAIL — 404/405

- [ ] **Step 3: Thêm endpoints vào `backend/app/routers/shadowing.py`**

Thêm vào import:

```python
from datetime import timedelta

from sqlalchemy import func

from app.models.article import Article
from app.models.shadowing_attempt import ShadowingAttempt
from app.routers.cards import get_owned_card
from app.schemas.shadowing import ShadowAttemptCreate, ShadowAttemptOut, ShadowingDayStat, ShadowingStatsOut
```

Thêm vào cuối file:

```python
@router.post("/attempts", response_model=ShadowAttemptOut, status_code=201)
def create_attempt(body: ShadowAttemptCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if body.source_type == "card":
        if not body.card_id:
            raise HTTPException(status_code=400, detail="card_id là bắt buộc với source_type=card")
        get_owned_card(body.card_id, db, user)
    elif body.source_type == "article":
        if not body.article_id:
            raise HTTPException(status_code=400, detail="article_id là bắt buộc với source_type=article")
        owned = db.query(Article).filter(Article.id == body.article_id, Article.user_id == user.id).first()
        if not owned:
            raise HTTPException(status_code=404, detail="Article not found")
    else:  # youtube
        if not body.video_id:
            raise HTTPException(status_code=400, detail="video_id là bắt buộc với source_type=youtube")
        _get_owned_video(body.video_id, db, user)

    attempt = ShadowingAttempt(
        user_id=user.id,
        source_type=body.source_type,
        card_id=body.card_id,
        article_id=body.article_id,
        video_id=body.video_id,
        segment_index=body.segment_index,
        target_text=body.target_text,
        transcript=body.transcript,
        score=body.score,
        word_results=[word.model_dump() for word in body.word_results],
    )
    db.add(attempt)
    db.commit()
    db.refresh(attempt)
    return attempt


@router.get("/stats", response_model=ShadowingStatsOut)
def get_shadowing_stats(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    today = date.today()
    since = datetime.combine(today - timedelta(days=6), datetime.min.time())

    total_attempts = (
        db.query(func.count(ShadowingAttempt.id)).filter(ShadowingAttempt.user_id == user.id).scalar() or 0
    )
    rows = (
        db.query(
            func.date(ShadowingAttempt.created_at),
            func.count(ShadowingAttempt.id),
            func.avg(ShadowingAttempt.score),
        )
        .filter(ShadowingAttempt.user_id == user.id, ShadowingAttempt.created_at >= since)
        .group_by(func.date(ShadowingAttempt.created_at))
        .all()
    )
    by_date = {str(day): (int(count), float(avg)) for day, count, avg in rows}
    by_day = []
    for offset in range(6, -1, -1):
        key = (today - timedelta(days=offset)).isoformat()
        count, avg = by_date.get(key, (0, None))
        by_day.append(ShadowingDayStat(date=key, count=count, avg_score=round(avg, 1) if avg is not None else None))

    attempts_7d = sum(day.count for day in by_day)
    weighted = sum(day.count * day.avg_score for day in by_day if day.avg_score is not None)
    avg_score_7d = round(weighted / attempts_7d, 1) if attempts_7d else None

    return ShadowingStatsOut(
        total_attempts=int(total_attempts),
        attempts_7d=attempts_7d,
        avg_score_7d=avg_score_7d,
        by_day=by_day,
    )
```

- [ ] **Step 4: Chạy lại test shadowing + toàn bộ backend**

Run (từ `backend/`): `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests -q`
Expected: tất cả pass (kể cả 6 test mới)

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/shadowing.py backend/tests/test_shadowing_attempts.py
git commit -m "feat(shadowing): attempt logging and 7-day stats endpoints"
```

---

### Task 8: FE — types, API clients, hook phát hiện worker

**Files:**
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/api/shadowing.ts`
- Create: `frontend/src/api/shadowingWorker.ts`
- Create: `frontend/src/hooks/useShadowingWorker.ts`

**Interfaces:**
- Consumes: axios `client` (`src/api/client.ts`), backend endpoints Task 5–7, worker endpoints Task 3.
- Produces (Task 9–14 dùng):
  - Types: `ShadowSegment`, `ShadowVideoListItem`, `ShadowVideo`, `ShadowVideoCreateInput`, `ShadowWordStatus`, `ShadowWordResult`, `ShadowScore`, `ShadowCard`, `ShadowAttemptInput`, `ShadowingDayStat`, `ShadowingStats`; `ReviewSubmission.rating_source` thêm `'shadowing'`.
  - `api/shadowing.ts`: `getShadowCards(params?)`, `createShadowVideo(input)`, `getShadowVideos()`, `getShadowVideo(id)`, `deleteShadowVideo(id)`, `createShadowAttempt(input)`, `getShadowingStats()`.
  - `api/shadowingWorker.ts`: `WORKER_BASE_URL`, `WorkerHealth`, `WorkerSubtitles`, `getWorkerHealth()`, `scoreRecording(blob, targetText)`, `fetchWorkerSubtitles(url)`.
  - `useShadowingWorker(pollMs?)` → `{ status: 'checking'|'online'|'offline', health: WorkerHealth|null, refresh }`.

- [ ] **Step 1: Thêm types vào `frontend/src/types/index.ts`** (cuối file):

```ts
export interface ShadowSegment {
  start: number
  end: number
  text: string
}

export interface ShadowVideoListItem {
  id: string
  youtube_id: string
  title: string
  duration_s: number | null
  segment_count: number
  created_at: string
}

export interface ShadowVideo extends ShadowVideoListItem {
  segments: ShadowSegment[]
}

export interface ShadowVideoCreateInput {
  youtube_id: string
  title: string
  duration_s: number | null
  segments: ShadowSegment[]
}

export type ShadowWordStatus = 'correct' | 'missed' | 'substituted' | 'skipped'

export interface ShadowWordResult {
  word: string
  status: ShadowWordStatus
}

export interface ShadowScore {
  transcript: string
  score: number
  words: ShadowWordResult[]
  no_speech: boolean
}

export interface ShadowCard {
  id: string
  front_text: string
  example_sentence: string
  example_audio_url: string
  pronunciation: string | null
}

export interface ShadowAttemptInput {
  source_type: 'card' | 'article' | 'youtube'
  card_id: string | null
  article_id: string | null
  video_id: string | null
  segment_index: number | null
  target_text: string
  transcript: string
  score: number
  word_results: ShadowWordResult[]
}

export interface ShadowingDayStat {
  date: string
  count: number
  avg_score: number | null
}

export interface ShadowingStats {
  total_attempts: number
  attempts_7d: number
  avg_score_7d: number | null
  by_day: ShadowingDayStat[]
}
```

Và sửa union `rating_source` trong `ReviewSubmission` (dòng ~52):

```ts
  rating_source?: 'manual' | 'auto' | 'game_sentence' | 'game_cloze' | 'game_match' | 'shadowing'
```

- [ ] **Step 2: Viết `frontend/src/api/shadowing.ts`**

```ts
import client from './client'
import type {
  ShadowAttemptInput,
  ShadowCard,
  ShadowingStats,
  ShadowVideo,
  ShadowVideoCreateInput,
  ShadowVideoListItem,
} from '../types'

export const getShadowCards = (params: { deckId?: string; cardId?: string; dueOnly?: boolean } = {}) =>
  client
    .get<ShadowCard[]>('/shadowing/cards', {
      params: { deck_id: params.deckId, card_id: params.cardId, due_only: params.dueOnly },
    })
    .then(r => r.data)

export const createShadowVideo = (input: ShadowVideoCreateInput) =>
  client.post<ShadowVideo>('/shadowing/videos', input).then(r => r.data)

export const getShadowVideos = () => client.get<ShadowVideoListItem[]>('/shadowing/videos').then(r => r.data)

export const getShadowVideo = (id: string) => client.get<ShadowVideo>(`/shadowing/videos/${id}`).then(r => r.data)

export const deleteShadowVideo = (id: string) => client.delete(`/shadowing/videos/${id}`)

export const createShadowAttempt = (input: ShadowAttemptInput) =>
  client.post<{ id: string }>('/shadowing/attempts', input).then(r => r.data)

export const getShadowingStats = () => client.get<ShadowingStats>('/shadowing/stats').then(r => r.data)
```

- [ ] **Step 3: Viết `frontend/src/api/shadowingWorker.ts`**

```ts
import axios from 'axios'
import type { ShadowScore, ShadowSegment } from '../types'

export const WORKER_BASE_URL = (import.meta.env.VITE_SHADOWING_WORKER_URL || 'http://127.0.0.1:8788').replace(/\/+$/, '')

const worker = axios.create({ baseURL: WORKER_BASE_URL })

export interface WorkerHealth {
  status: string
  model: string
  model_loaded: boolean
  device: 'cuda' | 'cpu' | null
}

export interface WorkerSubtitles {
  youtube_id: string
  title: string
  duration_s: number | null
  segments: ShadowSegment[]
}

export const getWorkerHealth = () => worker.get<WorkerHealth>('/health', { timeout: 3000 }).then(r => r.data)

// Timeout dài vì lần chấm đầu tiên worker phải tải + nạp model Whisper.
export const scoreRecording = (blob: Blob, targetText: string) => {
  const form = new FormData()
  form.append('file', blob, 'recording.webm')
  form.append('target_text', targetText)
  return worker.post<ShadowScore>('/score', form, { timeout: 120000 }).then(r => r.data)
}

export const fetchWorkerSubtitles = (url: string) =>
  worker.get<WorkerSubtitles>('/subtitles', { params: { url }, timeout: 60000 }).then(r => r.data)
```

- [ ] **Step 4: Viết `frontend/src/hooks/useShadowingWorker.ts`**

```ts
import { useCallback, useEffect, useState } from 'react'
import { getWorkerHealth, type WorkerHealth } from '../api/shadowingWorker'

export type WorkerStatus = 'checking' | 'online' | 'offline'

export function useShadowingWorker(pollMs = 15000) {
  const [status, setStatus] = useState<WorkerStatus>('checking')
  const [health, setHealth] = useState<WorkerHealth | null>(null)

  const refresh = useCallback(async () => {
    try {
      const value = await getWorkerHealth()
      setHealth(value)
      setStatus('online')
    } catch {
      setHealth(null)
      setStatus('offline')
    }
  }, [])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), pollMs)
    return () => window.clearInterval(id)
  }, [refresh, pollMs])

  return { status, health, refresh }
}
```

- [ ] **Step 5: Verify bằng build**

Run (từ `frontend/`): `npm run build`
Expected: exit 0, không lỗi TypeScript

- [ ] **Step 6: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/api/shadowing.ts frontend/src/api/shadowingWorker.ts frontend/src/hooks/useShadowingWorker.ts
git commit -m "feat(shadowing): frontend types, api clients and worker-detection hook"
```

---

### Task 9: FE — hook ghi âm + component hiển thị điểm

**Files:**
- Create: `frontend/src/components/shadowing/useRecorder.ts`
- Create: `frontend/src/components/shadowing/ScoreDisplay.tsx`

**Interfaces:**
- Consumes: types `ShadowScore` (Task 8); browser API `MediaRecorder`/`getUserMedia`.
- Produces (Task 11 dùng):
  - `useRecorder(maxSeconds?: number)` → `{ recording: boolean, blob: Blob | null, error: string | null, start: () => Promise<void>, stop: () => void, reset: () => void }` — `blob` được set khi dừng thu; `reset` hủy blob và không phát sinh blob mới.
  - `<ScoreDisplay result={ShadowScore} />` — render điểm %, câu gốc tô màu theo `status`, transcript; hoặc thông báo khi `no_speech`.

- [ ] **Step 1: Viết `frontend/src/components/shadowing/useRecorder.ts`**

```ts
import { useCallback, useEffect, useRef, useState } from 'react'

export function useRecorder(maxSeconds = 20) {
  const [recording, setRecording] = useState(false)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const timerRef = useRef<number | null>(null)

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const stop = useCallback(() => {
    clearTimer()
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
  }, [])

  const start = useCallback(async () => {
    setError(null)
    setBlob(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : undefined
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      const chunks: BlobPart[] = []
      recorder.ondataavailable = event => {
        if (event.data.size) chunks.push(event.data)
      }
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop())
        setRecording(false)
        setBlob(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }))
      }
      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
      timerRef.current = window.setTimeout(stop, maxSeconds * 1000)
    } catch {
      setError('Không truy cập được micro. Hãy cho phép quyền micro trong trình duyệt rồi thử lại.')
    }
  }, [maxSeconds, stop])

  // Hủy bản ghi hiện tại mà KHÔNG phát sinh blob mới (dùng khi chuyển câu).
  const reset = useCallback(() => {
    clearTimer()
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => recorder.stream.getTracks().forEach(track => track.stop())
      recorder.stop()
      setRecording(false)
    }
    setBlob(null)
    setError(null)
  }, [])

  useEffect(() => () => reset(), [reset])

  return { recording, blob, error, start, stop, reset }
}
```

- [ ] **Step 2: Viết `frontend/src/components/shadowing/ScoreDisplay.tsx`**

```tsx
import type { ShadowScore, ShadowWordStatus } from '../../types'

const WORD_STYLES: Record<ShadowWordStatus, string> = {
  correct: 'text-emerald-300',
  missed: 'text-rose-300 underline decoration-rose-400/60',
  substituted: 'text-amber-300 underline decoration-amber-400/60',
  skipped: 'text-slate-500',
}

export default function ScoreDisplay({ result }: { result: ShadowScore }) {
  if (result.no_speech) {
    return (
      <div className="rounded-2xl border border-amber-300/25 bg-amber-400/10 p-4 text-sm font-bold text-amber-200">
        Không nghe rõ giọng bạn — thử lại gần mic hơn nhé.
      </div>
    )
  }
  const tone = result.score >= 80 ? 'text-emerald-300' : result.score >= 60 ? 'text-amber-300' : 'text-rose-300'
  const label = result.score >= 80 ? 'Tuyệt vời' : result.score >= 60 ? 'Khá tốt' : 'Luyện thêm nhé'
  return (
    <div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-4">
      <div className="mb-3 flex items-center gap-3">
        <span className={`text-3xl font-black ${tone}`}>{result.score}%</span>
        <span className="text-xs font-bold uppercase text-slate-500">{label}</span>
      </div>
      <p className="mb-2 text-lg leading-8">
        {result.words.map((word, index) => (
          <span key={index} className={`${WORD_STYLES[word.status]} mr-1.5 font-semibold`}>
            {word.word}
          </span>
        ))}
      </p>
      <p className="text-xs text-slate-500">
        Whisper nghe thấy: <span className="italic text-slate-400">"{result.transcript}"</span>
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

Run (từ `frontend/`): `npm run build`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/shadowing/
git commit -m "feat(shadowing): recorder hook and word-level score display"
```

---

### Task 10: FE — SegmentPlayer (Mp3 + TTS) và util tách câu dùng chung

**Files:**
- Create: `frontend/src/components/shadowing/SegmentPlayer.tsx`
- Modify: `frontend/src/utils/readerText.ts` (thêm `sentenceParts`, `splitSentences`)
- Modify: `frontend/src/pages/ReaderPage.tsx` (xoá bản local, import từ utils)

**Interfaces:**
- Consumes: `resolveAssetUrl` (`src/api/config.ts`), `speechSynthesis`.
- Produces (Task 11/13 dùng):
  - `export interface PlayerHandle { play: () => void; stop: () => void }`
  - `Mp3Player` — `forwardRef<PlayerHandle, { src: string; rate: number }>`, render `null`.
  - `TtsPlayer` — `forwardRef<PlayerHandle, { text: string; rate: number }>`, render `null`.
  - `utils/readerText.ts` export thêm: `sentenceParts(text: string): string[]`, `splitSentences(text: string): string[]`.

- [ ] **Step 1: Chuyển util tách câu sang `frontend/src/utils/readerText.ts`** — thêm vào cuối file:

```ts
export const sentenceParts = (text: string) => text.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [text]

export const splitSentences = (text: string) =>
  sentenceParts(text).map(sentence => sentence.trim()).filter(Boolean)
```

- [ ] **Step 2: Cập nhật `frontend/src/pages/ReaderPage.tsx`**

Xoá 2 định nghĩa local (dòng ~10 `const sentenceParts = ...` và dòng ~19 `const splitSentences = ...`), rồi sửa import hiện có:

```ts
import { sentenceParts, splitSentences, stripTranscriptTimestamps } from '../utils/readerText'
```

- [ ] **Step 3: Verify Reader không vỡ**

Run (từ `frontend/`): `npm run build`
Expected: exit 0

- [ ] **Step 4: Viết `frontend/src/components/shadowing/SegmentPlayer.tsx`**

```tsx
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { resolveAssetUrl } from '../../api/config'

export interface PlayerHandle {
  play: () => void
  stop: () => void
}

export const Mp3Player = forwardRef<PlayerHandle, { src: string; rate: number }>(function Mp3Player({ src, rate }, ref) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  useImperativeHandle(
    ref,
    () => ({
      play: () => {
        const url = resolveAssetUrl(src)
        if (!url) return
        audioRef.current?.pause()
        const audio = new Audio(url)
        audio.playbackRate = rate
        audioRef.current = audio
        void audio.play().catch(() => {})
      },
      stop: () => audioRef.current?.pause(),
    }),
    [src, rate],
  )
  useEffect(() => () => audioRef.current?.pause(), [])
  return null
})

// Dùng lại giọng đọc user đã chọn ở Reader (cùng key localStorage).
const READER_VOICE_KEY = 'reader-speech-voice'

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices()
  const storedUri = window.localStorage.getItem(READER_VOICE_KEY)
  const stored = storedUri ? voices.find(voice => voice.voiceURI === storedUri) : undefined
  return stored ?? voices.find(voice => /^en(?:-|_)/i.test(voice.lang))
}

export const TtsPlayer = forwardRef<PlayerHandle, { text: string; rate: number }>(function TtsPlayer({ text, rate }, ref) {
  useImperativeHandle(
    ref,
    () => ({
      play: () => {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(text)
        const voice = pickVoice()
        utterance.lang = voice?.lang || 'en-US'
        if (voice) utterance.voice = voice
        utterance.rate = rate
        window.speechSynthesis.speak(utterance)
      },
      stop: () => window.speechSynthesis.cancel(),
    }),
    [text, rate],
  )
  useEffect(() => () => window.speechSynthesis.cancel(), [])
  return null
})
```

- [ ] **Step 5: Verify build + commit**

Run (từ `frontend/`): `npm run build` → exit 0

```bash
git add frontend/src/components/shadowing/SegmentPlayer.tsx frontend/src/utils/readerText.ts frontend/src/pages/ReaderPage.tsx
git commit -m "feat(shadowing): mp3/tts segment players and shared sentence splitting"
```

---

### Task 11: FE — trang `/shadowing` (nguồn flashcard + bài đọc) + route + Navbar

**Files:**
- Create: `frontend/src/pages/ShadowingPage.tsx`
- Modify: `frontend/src/App.tsx` (route)
- Modify: `frontend/src/components/Navbar.tsx` (nav item + icon)

**Interfaces:**
- Consumes: mọi thứ Task 8–10 (`getShadowCards`, `createShadowAttempt`, `scoreRecording`, `useShadowingWorker`, `useRecorder`, `ScoreDisplay`, `Mp3Player`, `TtsPlayer`, `PlayerHandle`, `splitSentences`, `stripTranscriptTimestamps`), `getArticle`/`getArticles` (api/articles), `getDecks` (api/decks), `submitReview` (api/review), `useNotification`.
- Produces: route `/shadowing` nhận query `?card=`, `?deck=`, `?article=`; Task 13 mở rộng thêm nguồn youtube; Task 12 link tới trang này.

- [ ] **Step 1: Viết `frontend/src/pages/ShadowingPage.tsx`**

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getArticle, getArticles } from '../api/articles'
import { getDecks } from '../api/decks'
import { submitReview } from '../api/review'
import { createShadowAttempt, getShadowCards } from '../api/shadowing'
import { scoreRecording } from '../api/shadowingWorker'
import { useNotification } from '../components/NotificationProvider'
import ScoreDisplay from '../components/shadowing/ScoreDisplay'
import { Mp3Player, TtsPlayer, type PlayerHandle } from '../components/shadowing/SegmentPlayer'
import { useRecorder } from '../components/shadowing/useRecorder'
import { useShadowingWorker } from '../hooks/useShadowingWorker'
import type { ArticleListItem, Deck, ShadowCard, ShadowScore } from '../types'
import { splitSentences, stripTranscriptTimestamps } from '../utils/readerText'

type Source =
  | { kind: 'card'; cards: ShadowCard[]; label: string }
  | { kind: 'article'; articleId: string; sentences: string[]; label: string }

type Phase = 'setup' | 'loading' | 'practice' | 'done'
type Tab = 'card' | 'article'

const qualityForScore = (score: number): number | null => (score >= 80 ? 5 : score >= 60 ? 3 : null)

export default function ShadowingPage() {
  const { toast } = useNotification()
  const worker = useShadowingWorker()
  const recorder = useRecorder(20)
  const [searchParams] = useSearchParams()

  const [phase, setPhase] = useState<Phase>('setup')
  const [tab, setTab] = useState<Tab>('card')
  const [decks, setDecks] = useState<Deck[]>([])
  const [articles, setArticles] = useState<ArticleListItem[]>([])
  const [deckScope, setDeckScope] = useState('due')
  const [source, setSource] = useState<Source | null>(null)
  const [index, setIndex] = useState(0)
  const [rate, setRate] = useState(1)
  const [scoreResult, setScoreResult] = useState<ShadowScore | null>(null)
  const [scoring, setScoring] = useState(false)
  const [scores, setScores] = useState<Record<number, number>>({})
  const [submitted, setSubmitted] = useState<Record<number, boolean>>({})
  const playerRef = useRef<PlayerHandle | null>(null)
  const ownAudioRef = useRef<HTMLAudioElement | null>(null)
  const autoStarted = useRef(false)

  useEffect(() => {
    void getDecks().then(setDecks).catch(() => {})
    void getArticles().then(setArticles).catch(() => {})
  }, [])

  const sentence = useMemo(() => {
    if (!source) return ''
    return source.kind === 'card' ? (source.cards[index]?.example_sentence ?? '') : (source.sentences[index] ?? '')
  }, [source, index])
  const total = source ? (source.kind === 'card' ? source.cards.length : source.sentences.length) : 0

  const beginPractice = useCallback((next: Source) => {
    setSource(next)
    setIndex(0)
    setScores({})
    setSubmitted({})
    setScoreResult(null)
    setPhase('practice')
  }, [])

  const startCards = useCallback(
    async (options: { deckId?: string; cardId?: string }) => {
      setPhase('loading')
      try {
        const dueOnly = !options.deckId && !options.cardId
        const cards = await getShadowCards({ deckId: options.deckId, cardId: options.cardId, dueOnly })
        if (!cards.length) {
          toast('Không có thẻ nào có audio câu ví dụ phù hợp', 'warning')
          setPhase('setup')
          return
        }
        beginPractice({ kind: 'card', cards, label: 'Flashcards' })
      } catch {
        toast('Không tải được thẻ', 'error')
        setPhase('setup')
      }
    },
    [beginPractice, toast],
  )

  const startArticle = useCallback(
    async (articleId: string) => {
      setPhase('loading')
      try {
        const article = await getArticle(articleId)
        const sentences = splitSentences(stripTranscriptTimestamps(article.content)).filter(
          value => value.split(/\s+/).length >= 3,
        )
        if (!sentences.length) {
          toast('Bài này không có câu phù hợp để luyện', 'warning')
          setPhase('setup')
          return
        }
        beginPractice({ kind: 'article', articleId, sentences, label: article.title })
      } catch {
        toast('Không tải được bài đọc', 'error')
        setPhase('setup')
      }
    },
    [beginPractice, toast],
  )

  // Deep links: /shadowing?card= | ?deck= | ?article=
  useEffect(() => {
    if (autoStarted.current) return
    const cardId = searchParams.get('card')
    const deckId = searchParams.get('deck')
    const articleId = searchParams.get('article')
    if (cardId) {
      autoStarted.current = true
      void startCards({ cardId })
    } else if (deckId) {
      autoStarted.current = true
      void startCards({ deckId })
    } else if (articleId) {
      autoStarted.current = true
      void startArticle(articleId)
    }
  }, [searchParams, startCards, startArticle])

  // Submit SM-2 một lần cho thẻ, với điểm cao nhất, khi rời thẻ.
  const flushCardReview = useCallback(
    (cardIndex: number) => {
      if (!source || source.kind !== 'card' || submitted[cardIndex]) return
      const best = scores[cardIndex]
      const quality = best === undefined ? null : qualityForScore(best)
      if (quality === null) return
      setSubmitted(state => ({ ...state, [cardIndex]: true }))
      void submitReview(source.cards[cardIndex].id, {
        quality,
        rating_source: 'shadowing',
        answer_correct: true,
      }).catch(() => toast('Không lưu được kết quả ôn tập 1 thẻ', 'error'))
    },
    [source, scores, submitted, toast],
  )

  const goTo = (nextIndex: number) => {
    flushCardReview(index)
    playerRef.current?.stop()
    ownAudioRef.current?.pause()
    recorder.reset()
    setScoreResult(null)
    setIndex(nextIndex)
  }

  const finish = () => {
    flushCardReview(index)
    playerRef.current?.stop()
    ownAudioRef.current?.pause()
    recorder.reset()
    setPhase('done')
  }

  const backToSetup = () => {
    playerRef.current?.stop()
    ownAudioRef.current?.pause()
    recorder.reset()
    setSource(null)
    setScoreResult(null)
    setPhase('setup')
  }

  // Tự phát audio khi vào câu mới (đợi player mount).
  useEffect(() => {
    if (phase !== 'practice') return
    const id = window.setTimeout(() => playerRef.current?.play(), 350)
    return () => window.clearTimeout(id)
  }, [phase, index, source])

  // Chấm điểm ngay khi có bản ghi.
  useEffect(() => {
    if (!recorder.blob || !sentence) return
    if (worker.status !== 'online') return
    const blob = recorder.blob
    setScoring(true)
    scoreRecording(blob, sentence)
      .then(result => {
        setScoreResult(result)
        if (result.no_speech || !source) return
        setScores(state => ({ ...state, [index]: Math.max(state[index] ?? 0, result.score) }))
        void createShadowAttempt({
          source_type: source.kind,
          card_id: source.kind === 'card' ? source.cards[index].id : null,
          article_id: source.kind === 'article' ? source.articleId : null,
          video_id: null,
          segment_index: source.kind === 'card' ? null : index,
          target_text: sentence,
          transcript: result.transcript,
          score: result.score,
          word_results: result.words,
        }).catch(() => {})
      })
      .catch(() => toast('Không chấm được điểm — kiểm tra công tắc GPU', 'error'))
      .finally(() => setScoring(false))
  }, [recorder.blob]) // eslint-disable-line react-hooks/exhaustive-deps

  const playOwnRecording = () => {
    if (!recorder.blob) return
    ownAudioRef.current?.pause()
    ownAudioRef.current = new Audio(URL.createObjectURL(recorder.blob))
    void ownAudioRef.current.play().catch(() => {})
  }

  const workerBadge =
    worker.status === 'online' ? (
      <span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">
        🟢 GPU sẵn sàng {worker.health?.device === 'cpu' && '(CPU)'}
        {worker.health && !worker.health.model_loaded && ' — engine sẽ khởi động ở lần chấm đầu'}
      </span>
    ) : worker.status === 'offline' ? (
      <span className="rounded-full border border-rose-300/25 bg-rose-400/10 px-3 py-1 text-xs font-bold text-rose-200">
        🔴 Công tắc đang tắt — bật start_shadowing.bat để chấm điểm
      </span>
    ) : (
      <span className="rounded-full border border-white/10 bg-white/[.05] px-3 py-1 text-xs font-bold text-slate-400">
        Đang kiểm tra worker…
      </span>
    )

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-white">🎤 Shadowing</h1>
        {workerBadge}
      </div>

      {phase === 'setup' && (
        <>
          <div className="mb-5 flex gap-2">
            {(
              [
                { key: 'card', label: '🃏 Flashcards' },
                { key: 'article', label: '📖 Bài đọc' },
              ] as { key: Tab; label: string }[]
            ).map(item => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition ${
                  tab === item.key
                    ? 'border border-cyan-300/25 bg-cyan-400/10 text-cyan-200'
                    : 'border border-white/10 bg-white/[.03] text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {tab === 'card' && (
            <div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-4">
              <label className="mb-2 block text-xs font-black uppercase text-slate-500">Phạm vi thẻ</label>
              <select
                value={deckScope}
                onChange={event => setDeckScope(event.target.value)}
                className="mb-4 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
              >
                <option value="due">🔥 Thẻ đến hạn hôm nay</option>
                {decks.map(deck => (
                  <option key={deck.id} value={deck.id}>
                    {deck.name} ({deck.card_count} thẻ)
                  </option>
                ))}
              </select>
              <button
                onClick={() => void startCards(deckScope === 'due' ? {} : { deckId: deckScope })}
                className="w-full rounded-xl border border-cyan-300/25 bg-cyan-400/10 py-2.5 text-sm font-bold text-cyan-200 hover:bg-cyan-400/20"
              >
                Bắt đầu luyện
              </button>
            </div>
          )}

          {tab === 'article' && (
            <div className="space-y-2">
              {articles.length === 0 && (
                <p className="rounded-2xl border border-white/[.07] bg-white/[.03] p-4 text-sm text-slate-400">
                  Chưa có bài đọc nào. Vào mục Đọc để thêm bài trước nhé.
                </p>
              )}
              {articles.map(article => (
                <button
                  key={article.id}
                  onClick={() => void startArticle(article.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/[.07] bg-white/[.03] p-4 text-left hover:border-cyan-300/25"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-bold text-slate-100">{article.title}</span>
                    <span className="block text-xs text-slate-500">{article.word_count} từ</span>
                  </span>
                  <span className="text-cyan-300">▶</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {phase === 'loading' && <div className="h-48 animate-pulse rounded-2xl bg-white/[.05]" />}

      {phase === 'practice' && source && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span className="truncate font-bold">{source.label}</span>
            <span>
              Câu {index + 1}/{total}
            </span>
          </div>

          {/* Dải nhảy nhanh giữa các câu; tô màu câu đã có điểm */}
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: total }, (_, i) => (
              <button
                key={i}
                onClick={() => i !== index && goTo(i)}
                className={`h-7 min-w-7 rounded-lg px-1.5 text-[11px] font-bold transition ${
                  i === index
                    ? 'border border-cyan-300/40 bg-cyan-400/20 text-cyan-100'
                    : scores[i] !== undefined
                      ? scores[i] >= 80
                        ? 'border border-emerald-300/20 bg-emerald-400/10 text-emerald-200'
                        : 'border border-amber-300/20 bg-amber-400/10 text-amber-200'
                      : 'border border-white/10 bg-white/[.04] text-slate-500 hover:text-slate-300'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          {source.kind === 'card' && (
            <Mp3Player ref={playerRef} src={source.cards[index].example_audio_url} rate={rate} />
          )}
          {source.kind === 'article' && <TtsPlayer ref={playerRef} text={sentence} rate={rate} />}

          <div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-5">
            <p className="mb-1 text-center text-xl font-bold leading-9 text-white">{sentence}</p>
            {source.kind === 'card' && source.cards[index].pronunciation && (
              <p className="mb-3 text-center text-sm text-slate-500">{source.cards[index].pronunciation}</p>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => playerRef.current?.play()}
                className="rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200"
              >
                ▶ Nghe
              </button>
              <button
                onClick={() => setRate(rate === 1 ? 0.75 : 1)}
                className="rounded-xl border border-white/10 bg-white/[.05] px-3 py-2 text-sm font-bold text-slate-300"
              >
                {rate === 1 ? '1x' : '0.75x'}
              </button>
              <button
                onClick={() => (recorder.recording ? recorder.stop() : void recorder.start())}
                disabled={scoring || worker.status !== 'online'}
                className={`rounded-xl px-5 py-2 text-sm font-black transition disabled:opacity-40 ${
                  recorder.recording
                    ? 'border border-rose-300/40 bg-rose-400/20 text-rose-100 animate-pulse'
                    : 'border border-emerald-300/25 bg-emerald-400/10 text-emerald-200'
                }`}
              >
                {recorder.recording ? '⏹ Dừng' : '🎤 Nói'}
              </button>
              {recorder.blob && !recorder.recording && (
                <button
                  onClick={playOwnRecording}
                  className="rounded-xl border border-white/10 bg-white/[.05] px-3 py-2 text-sm font-bold text-slate-300"
                >
                  🔁 Giọng mình
                </button>
              )}
            </div>
            {recorder.error && <p className="mt-3 text-center text-sm font-bold text-rose-300">{recorder.error}</p>}
            {worker.status === 'offline' && (
              <p className="mt-3 text-center text-xs text-slate-500">
                Không có chấm điểm khi công tắc tắt — bạn vẫn có thể nghe và tự luyện.
              </p>
            )}
          </div>

          {scoring && <div className="h-20 animate-pulse rounded-2xl bg-white/[.05]" />}
          {scoreResult && !scoring && <ScoreDisplay result={scoreResult} />}
          {scoreResult && !scoring && source.kind === 'card' && submitted[index] && (
            <p className="text-center text-xs font-bold text-emerald-300">✓ đã tính vào lịch ôn</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => goTo(index - 1)}
              disabled={index === 0}
              className="rounded-xl border border-white/10 bg-white/[.05] px-4 py-2.5 text-sm font-bold text-slate-300 disabled:opacity-40"
            >
              ⏮
            </button>
            {index + 1 < total ? (
              <button
                onClick={() => goTo(index + 1)}
                className="flex-1 rounded-xl border border-cyan-300/25 bg-cyan-400/10 py-2.5 text-sm font-bold text-cyan-200"
              >
                Câu tiếp ⏭
              </button>
            ) : (
              <button
                onClick={finish}
                className="flex-1 rounded-xl border border-emerald-300/25 bg-emerald-400/10 py-2.5 text-sm font-bold text-emerald-200"
              >
                🏁 Kết thúc
              </button>
            )}
            <button onClick={backToSetup} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500">
              Thoát
            </button>
          </div>
        </div>
      )}

      {phase === 'done' && source && (
        <div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-5">
          <h2 className="mb-1 text-xl font-black text-white">🏁 Kết quả phiên luyện</h2>
          {(() => {
            const values = Object.values(scores)
            const average = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null
            const weak = Object.entries(scores)
              .filter(([, value]) => value < 80)
              .map(([key]) => Number(key))
            return (
              <>
                <p className="mb-4 text-sm text-slate-400">
                  Đã chấm {values.length}/{total} câu{average !== null && ` · điểm trung bình ${average}%`}
                </p>
                {weak.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-2 text-xs font-black uppercase text-slate-500">Câu cần luyện thêm (&lt;80%)</p>
                    {weak.map(weakIndex => (
                      <button
                        key={weakIndex}
                        onClick={() => {
                          setPhase('practice')
                          goTo(weakIndex)
                        }}
                        className="mb-1 block w-full truncate rounded-xl border border-amber-300/20 bg-amber-400/5 px-3 py-2 text-left text-sm text-amber-100 hover:bg-amber-400/10"
                      >
                        {scores[weakIndex]}% ·{' '}
                        {source.kind === 'card'
                          ? source.cards[weakIndex].example_sentence
                          : source.sentences[weakIndex]}
                      </button>
                    ))}
                  </div>
                )}
                <button
                  onClick={backToSetup}
                  className="w-full rounded-xl border border-cyan-300/25 bg-cyan-400/10 py-2.5 text-sm font-bold text-cyan-200"
                >
                  Chọn nguồn khác
                </button>
              </>
            )
          })()}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Thêm route vào `frontend/src/App.tsx`**

Thêm lazy import (cạnh các lazy import khác):

```ts
const ShadowingPage = lazy(() => import('./pages/ShadowingPage'))
```

Thêm route (trong `<Routes>`, cạnh `/games`):

```tsx
<Route path="/shadowing" element={<RequireAuth><ShadowingPage /></RequireAuth>} />
```

- [ ] **Step 3: Thêm nav item vào `frontend/src/components/Navbar.tsx`**

Trong `NAV_ITEMS` thêm (sau item Games):

```ts
  { to: '/shadowing', label: 'Nói', icon: 'mic', soon: false },
```

Trong `NavIcon` switch thêm case:

```tsx
    case 'mic':
      return (
        <svg {...common}>
          <rect x="9" y="3.5" width="6" height="11" rx="3" />
          <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
          <path d="M12 18v3" />
        </svg>
      )
```

- [ ] **Step 4: Verify build**

Run (từ `frontend/`): `npm run build`
Expected: exit 0

- [ ] **Step 5: Smoke test thủ công (dev servers)**

Chạy backend + frontend qua `.claude/launch.json` (config `backend` và `frontend`). Mở `http://localhost:5173/shadowing`:
- Badge worker hiện 🔴 (worker chưa chạy) — đúng graceful degradation.
- Tab Flashcards: chọn 1 deck 4000 Essential Words → "Bắt đầu luyện" → câu ví dụ hiện, nút ▶ phát audio mp3.
- Tab Bài đọc: chọn 1 bài → câu hiện, ▶ đọc bằng TTS.
- Nút 🎤 bị disable khi worker offline.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/ShadowingPage.tsx frontend/src/App.tsx frontend/src/components/Navbar.tsx
git commit -m "feat(shadowing): shadowing practice page with card and article sources"
```

---

### Task 12: FE — lối tắt từ FlipCard và ReaderPage

**Files:**
- Modify: `frontend/src/components/FlipCard.tsx`
- Modify: `frontend/src/pages/ReaderPage.tsx`

**Interfaces:**
- Consumes: route `/shadowing?card=` và `?article=` (Task 11).
- Produces: nút 🎤 trên mặt sau FlipCard (cạnh AudioButton của câu ví dụ, dòng ~432) và nút "🎤 Shadow" trên ReaderPage.

- [ ] **Step 1: FlipCard — thêm nút 🎤**

Thêm `Link` vào import react-router-dom của `FlipCard.tsx` (file này chưa import react-router-dom thì thêm mới):

```ts
import { Link } from 'react-router-dom'
```

Trong block câu ví dụ ở mặt sau (dòng ~427-434, chỗ `{card.example_audio_url && <AudioButton ... />}`), thêm ngay sau `AudioButton`:

```tsx
                    {card.example_audio_url && (
                      <Link
                        to={`/shadowing?card=${card.id}`}
                        onClick={event => event.stopPropagation()}
                        className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-sm shrink-0"
                        title="Luyện shadowing câu này"
                      >
                        🎤
                      </Link>
                    )}
```

- [ ] **Step 2: ReaderPage — thêm nút Shadow**

Trong hàng điều khiển TTS của ReaderPage (khu vực render `<select>` chọn giọng đọc và nút điều khiển tốc độ), thêm:

```tsx
              <Link
                to={`/shadowing?article=${id}`}
                className="rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-3 py-1.5 text-xs font-bold text-cyan-200 hover:bg-cyan-400/20"
              >
                🎤 Shadow
              </Link>
```

(`Link` đã được import sẵn trong ReaderPage.)

- [ ] **Step 3: Verify build + smoke**

Run (từ `frontend/`): `npm run build` → exit 0.
Smoke: mở 1 bài Reader → thấy nút "🎤 Shadow" → click → vào thẳng practice bài đó. Vào Ôn tập, lật 1 thẻ có câu ví dụ → thấy nút 🎤 → click → practice đúng thẻ đó.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/FlipCard.tsx frontend/src/pages/ReaderPage.tsx
git commit -m "feat(shadowing): shortcuts from flip card and reader"
```

---

### Task 13: FE — nguồn YouTube (player, import, practice)

**Files:**
- Create: `frontend/src/components/shadowing/YouTubePlayer.tsx`
- Modify: `frontend/src/pages/ShadowingPage.tsx`

**Interfaces:**
- Consumes: `PlayerHandle` (Task 10), `fetchWorkerSubtitles` (Task 8), `createShadowVideo`/`getShadowVideos`/`getShadowVideo`/`deleteShadowVideo` (Task 8), backend Task 6.
- Produces: tab YouTube trong setup; source kind `youtube` trong practice; `YouTubePlayer` — `forwardRef<PlayerHandle, { videoId: string; start: number; end: number; rate: number }>` render iframe 16:9.

- [ ] **Step 1: Viết `frontend/src/components/shadowing/YouTubePlayer.tsx`**

```tsx
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type { PlayerHandle } from './SegmentPlayer'

declare global {
  interface Window {
    YT?: { Player: new (element: HTMLElement, options: object) => YTPlayerInstance }
    onYouTubeIframeAPIReady?: () => void
  }
}

interface YTPlayerInstance {
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  playVideo: () => void
  pauseVideo: () => void
  setPlaybackRate: (rate: number) => void
  getCurrentTime: () => number
  destroy: () => void
}

let apiPromise: Promise<void> | null = null
function loadIframeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve()
  if (!apiPromise) {
    apiPromise = new Promise(resolve => {
      window.onYouTubeIframeAPIReady = () => resolve()
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.head.appendChild(tag)
    })
  }
  return apiPromise
}

export const YouTubePlayer = forwardRef<PlayerHandle, { videoId: string; start: number; end: number; rate: number }>(
  function YouTubePlayer({ videoId, start, end, rate }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const playerRef = useRef<YTPlayerInstance | null>(null)
    const pollRef = useRef<number | null>(null)
    const segmentRef = useRef({ start, end, rate })
    segmentRef.current = { start, end, rate }

    useEffect(() => {
      let cancelled = false
      void loadIframeApi().then(() => {
        if (cancelled || !containerRef.current || !window.YT) return
        playerRef.current = new window.YT.Player(containerRef.current, {
          videoId,
          playerVars: { controls: 1, rel: 0 },
        })
      })
      return () => {
        cancelled = true
        if (pollRef.current) window.clearInterval(pollRef.current)
        playerRef.current?.destroy()
        playerRef.current = null
      }
    }, [videoId])

    useImperativeHandle(
      ref,
      () => ({
        play: () => {
          const player = playerRef.current
          if (!player?.seekTo) return
          const segment = segmentRef.current
          player.setPlaybackRate(segment.rate)
          player.seekTo(segment.start, true)
          player.playVideo()
          if (pollRef.current) window.clearInterval(pollRef.current)
          pollRef.current = window.setInterval(() => {
            if (player.getCurrentTime() >= segmentRef.current.end) {
              player.pauseVideo()
              if (pollRef.current) window.clearInterval(pollRef.current)
            }
          }, 120)
        },
        stop: () => {
          if (pollRef.current) window.clearInterval(pollRef.current)
          playerRef.current?.pauseVideo()
        },
      }),
      [],
    )

    return (
      <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
        <div ref={containerRef} className="h-full w-full" />
      </div>
    )
  },
)
```

- [ ] **Step 2: Mở rộng `ShadowingPage.tsx` cho YouTube**

2a. Thêm import:

```ts
import { createShadowVideo, deleteShadowVideo, getShadowVideo, getShadowVideos } from '../api/shadowing'
import { fetchWorkerSubtitles } from '../api/shadowingWorker'
import { YouTubePlayer } from '../components/shadowing/YouTubePlayer'
import type { ShadowVideo, ShadowVideoListItem } from '../types'
```

(gộp vào các import sẵn có từ `../api/shadowing`, `../api/shadowingWorker`, `../types`.)

2b. Mở rộng type `Source` và `Tab`:

```ts
type Source =
  | { kind: 'card'; cards: ShadowCard[]; label: string }
  | { kind: 'article'; articleId: string; sentences: string[]; label: string }
  | { kind: 'youtube'; video: ShadowVideo; label: string }

type Tab = 'card' | 'article' | 'youtube'
```

2c. Thêm state trong component:

```ts
const [videos, setVideos] = useState<ShadowVideoListItem[]>([])
const [youtubeUrl, setYoutubeUrl] = useState('')
const [importing, setImporting] = useState(false)
```

Và load danh sách video trong `useEffect` đầu trang (thêm dòng):

```ts
void getShadowVideos().then(setVideos).catch(() => {})
```

2d. Cập nhật `sentence` và `total` để nhận nguồn youtube:

```ts
const sentence = useMemo(() => {
  if (!source) return ''
  if (source.kind === 'card') return source.cards[index]?.example_sentence ?? ''
  if (source.kind === 'article') return source.sentences[index] ?? ''
  return source.video.segments[index]?.text ?? ''
}, [source, index])
const total = !source ? 0 : source.kind === 'card' ? source.cards.length : source.kind === 'article' ? source.sentences.length : source.video.segments.length
```

2e. Thêm 2 hàm start/import:

```ts
const startVideo = useCallback(
  async (videoId: string) => {
    setPhase('loading')
    try {
      const video = await getShadowVideo(videoId)
      beginPractice({ kind: 'youtube', video, label: video.title })
    } catch {
      toast('Không tải được video', 'error')
      setPhase('setup')
    }
  },
  [beginPractice, toast],
)

const importVideo = async () => {
  if (!youtubeUrl.trim()) return
  setImporting(true)
  try {
    const subtitles = await fetchWorkerSubtitles(youtubeUrl.trim())
    const video = await createShadowVideo(subtitles)
    setVideos(await getShadowVideos())
    setYoutubeUrl('')
    beginPractice({ kind: 'youtube', video, label: video.title })
  } catch (error) {
    const detail =
      (axios.isAxiosError(error) && (error.response?.data as { detail?: string } | undefined)?.detail) ||
      'Không import được video — kiểm tra công tắc GPU và link'
    toast(detail, 'error')
  } finally {
    setImporting(false)
  }
}
```

(thêm `import axios from 'axios'` đầu file.)

2f. Trong effect chấm điểm (effect phụ thuộc `recorder.blob`), sửa payload `createShadowAttempt` thành nguồn-aware (`flushCardReview` giữ nguyên):

```ts
void createShadowAttempt({
  source_type: source.kind,
  card_id: source.kind === 'card' ? source.cards[index].id : null,
  article_id: source.kind === 'article' ? source.articleId : null,
  video_id: source.kind === 'youtube' ? source.video.id : null,
  segment_index: source.kind === 'card' ? null : index,
  target_text: sentence,
  transcript: result.transcript,
  score: result.score,
  word_results: result.words,
}).catch(() => {})
```

2g. Setup phase — thêm tab vào mảng tab:

```ts
{ key: 'youtube', label: '▶️ YouTube' },
```

và block UI tab youtube (sau block `tab === 'article'`):

```tsx
{tab === 'youtube' && (
  <div className="space-y-3">
    <div className="rounded-2xl border border-white/[.07] bg-white/[.03] p-4">
      <label className="mb-2 block text-xs font-black uppercase text-slate-500">Dán link YouTube</label>
      <div className="flex gap-2">
        <input
          value={youtubeUrl}
          onChange={event => setYoutubeUrl(event.target.value)}
          placeholder="https://www.youtube.com/watch?v=..."
          className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-600"
        />
        <button
          onClick={() => void importVideo()}
          disabled={importing || worker.status !== 'online' || !youtubeUrl.trim()}
          className="rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200 disabled:opacity-40"
        >
          {importing ? 'Đang lấy phụ đề…' : '📥 Import'}
        </button>
      </div>
      {worker.status !== 'online' && (
        <p className="mt-2 text-xs text-slate-500">Cần bật công tắc GPU để lấy phụ đề (yt-dlp chạy trên máy bạn).</p>
      )}
    </div>
    {videos.map(video => (
      <div
        key={video.id}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/[.07] bg-white/[.03] p-4"
      >
        <button onClick={() => void startVideo(video.id)} className="min-w-0 flex-1 text-left">
          <span className="block truncate font-bold text-slate-100">{video.title}</span>
          <span className="block text-xs text-slate-500">{video.segment_count} câu</span>
        </button>
        <button
          onClick={() => {
            void deleteShadowVideo(video.id).then(() => setVideos(items => items.filter(item => item.id !== video.id)))
          }}
          className="text-sm text-slate-500 hover:text-rose-300"
          title="Xoá video"
        >
          🗑
        </button>
      </div>
    ))}
  </div>
)}
```

2h. Practice phase — thêm player youtube (sau 2 dòng player hiện có):

```tsx
{source.kind === 'youtube' && (
  <YouTubePlayer
    ref={playerRef}
    videoId={source.video.youtube_id}
    start={source.video.segments[index].start}
    end={source.video.segments[index].end}
    rate={rate}
  />
)}
```

2i. Done phase — nhánh hiển thị câu yếu thêm youtube:

```ts
: source.kind === 'article'
  ? source.sentences[weakIndex]
  : source.video.segments[weakIndex].text
```

- [ ] **Step 3: Verify build**

Run (từ `frontend/`): `npm run build`
Expected: exit 0

- [ ] **Step 4: Smoke test thủ công**

Bật worker thật (`local_shadowing/start_shadowing.bat` — cần đã chạy `install_shadowing.bat`). Trên trang Shadowing tab YouTube, dán 1 video TED-Ed bất kỳ → Import → thấy video nhúng + câu phụ đề; ▶ tua đúng đoạn và tự dừng cuối câu.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/shadowing/YouTubePlayer.tsx frontend/src/pages/ShadowingPage.tsx
git commit -m "feat(shadowing): youtube source with subtitle import and segment player"
```

---

### Task 14: FE Stats + docs + verify E2E toàn bộ

**Files:**
- Modify: `frontend/src/pages/StatsPage.tsx`
- Modify: `README.md`
- Test: verify E2E thủ công toàn bộ luồng

**Interfaces:**
- Consumes: `getShadowingStats` (Task 8), `useCachedQuery` (hook sẵn có trong StatsPage).
- Produces: card "🎤 Luyện nói" trên trang Stats; README cập nhật.

- [ ] **Step 1: Thêm card Luyện nói vào `StatsPage.tsx`**

Thêm import:

```ts
import { getShadowingStats } from '../api/shadowing'
```

Trong `LearningStats`, cạnh `statsQuery` thêm:

```ts
const shadowQuery = useCachedQuery(user ? `shadowstats:${user.id}` : null, getShadowingStats)
const shadow = shadowQuery.data
```

Sau khối render `STAT_CARDS` grid (cùng cấp với các section khác), thêm:

```tsx
{shadow && shadow.total_attempts > 0 && (
  <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-5">
    <h2 className="mb-2 flex items-center gap-2 text-lg font-black text-white">🎤 Luyện nói (shadowing)</h2>
    <p className="text-sm text-slate-400">
      Tổng cộng <span className="font-bold text-slate-200">{shadow.total_attempts}</span> lượt ·
      7 ngày qua <span className="font-bold text-slate-200">{shadow.attempts_7d}</span> lượt
      {shadow.avg_score_7d !== null && (
        <>
          {' '}· điểm trung bình <span className="font-bold text-emerald-300">{Math.round(shadow.avg_score_7d)}%</span>
        </>
      )}
    </p>
    <div className="mt-3 flex items-end gap-1.5">
      {shadow.by_day.map(day => (
        <div key={day.date} className="flex flex-1 flex-col items-center gap-1" title={`${day.date}: ${day.count} lượt`}>
          <div
            className="w-full rounded-t bg-cyan-400/40"
            style={{ height: `${Math.min(day.count * 8, 48) || 2}px` }}
          />
          <span className="text-[9px] text-slate-600">{day.date.slice(8)}</span>
        </div>
      ))}
    </div>
  </div>
)}
```

- [ ] **Step 2: Verify build**

Run (từ `frontend/`): `npm run build` → exit 0

- [ ] **Step 3: Cập nhật `README.md`**

Trong bảng Features (section "✅ Implemented"), thêm 1 ô mới vào table:

```html
  <tr>
    <td>
      <h4>🎤 Shadowing — luyện nói theo audio</h4>
      <ul>
        <li>Echo mode: nghe câu → nói lại → Whisper local chấm điểm từng từ</li>
        <li>3 nguồn: câu ví dụ flashcard (audio bản xứ), bài đọc Reader (TTS), video YouTube (phụ đề tự động)</li>
        <li>"Công tắc GPU": worker <code>local_shadowing/</code> chạy trên máy có GPU, browser gọi thẳng localhost — audio không rời máy</li>
        <li>Điểm tốt được tính vào lịch ôn SM-2 (<code>rating_source: shadowing</code>)</li>
      </ul>
    </td>
    <td></td>
  </tr>
```

Trong section Architecture (cây thư mục), thêm dưới `local_translator` (hoặc cạnh `backend/`):

```
├── local_shadowing/          # GPU worker: Whisper scoring + yt-dlp subtitles (cổng 8788)
```

Trong Roadmap Phase 7, tick 2 mục:

```markdown
- [x] **Speech-to-Text** — Local Whisper for user-recorded pronunciation
- [x] **Pronunciation Scoring** — Compare user audio vs. reference (word-level Whisper alignment; phoneme-level còn lại là mở rộng tương lai)
```

- [ ] **Step 4: Chạy toàn bộ test tự động lần cuối**

- Backend (từ `backend/`): `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests -q` → tất cả pass
- Worker (từ repo root): `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest local_shadowing/tests -q` → tất cả pass
- FE (từ `frontend/`): `npm run build` → exit 0

- [ ] **Step 5: Verify E2E thủ công theo checklist spec**

Bật backend + frontend (launch.json) + worker (`start_shadowing.bat`):

1. `/shadowing` badge chuyển 🟢 khi worker bật, 🔴 khi tắt cửa sổ worker.
2. Nguồn flashcard: nghe audio → 🎤 nói → điểm hiện với word highlight hợp lý; nói thiếu từ → từ đó đỏ.
3. Kiểm tra DB: `SELECT rating_source FROM review_logs ORDER BY reviewed_at DESC LIMIT 1` = `shadowing`; bấm thử lại nhiều lần trong 1 thẻ rồi chuyển câu → chỉ 1 review log mới cho thẻ đó.
4. Bảng `shadowing_attempts` có row mới với transcript + word_results.
5. Nguồn bài đọc: TTS đọc câu, chấm điểm hoạt động.
6. YouTube: import video TED → click câu tua đúng đoạn, tự dừng; chấm điểm hoạt động; xoá video OK.
7. Tắt worker giữa phiên → toast lỗi chấm điểm + badge 🔴 + nút 🎤 disable; nghe/nghe lại giọng mình vẫn chạy.
8. Nói câu trống (im lặng) → thông báo "Không nghe rõ" và không có attempt mới trong DB.
9. Trang Stats hiện card 🎤 Luyện nói + `reviews_by_source` có mục shadowing.

- [ ] **Step 6: Commit cuối**

```bash
git add frontend/src/pages/StatsPage.tsx README.md
git commit -m "feat(shadowing): stats card and documentation"
```

---

## Ghi chú cho người thực thi

- Task 1–3 (worker) và Task 4–7 (backend) độc lập nhau, có thể làm song song; Task 8+ cần Task 3 + 7 xong.
- Nếu `npm run build` fail vì lỗi type ở file không liên quan, đọc kỹ — nhiều khả năng do sửa `types/index.ts` (Task 8) chạm union `rating_source`.
- Worker chạy thật cần `install_shadowing.bat` một lần (tải faster-whisper ~vài trăm MB); mọi test tự động KHÔNG cần bước này.
- Prod: FE Vercel cần set env `VITE_SHADOWING_WORKER_URL` chỉ khi đổi port; mặc định `http://127.0.0.1:8788` là đúng. `.env` của worker phải thêm domain Vercel vào `APP_ORIGINS`.
