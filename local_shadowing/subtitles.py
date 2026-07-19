"""Fetch YouTube captions and normalize them into shadowing segments."""

import re

MAX_SEGMENT_SECONDS = 15.0
SENTENCE_END = re.compile(r"[.!?][\"')\]]*$")
NOISE = re.compile(r"^[\[(♪].*[\])♪]$")
PREFERRED_LANGS = ("en", "en-US", "en-GB", "en-orig")
TIMING_LINE = re.compile(r"(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})")
TAG = re.compile(r"<[^>]+>")


class SubtitleError(Exception):
    """A Vietnamese, user-facing subtitle error."""


def _extract_info(url: str) -> dict:
    import yt_dlp
    try:
        with yt_dlp.YoutubeDL({"skip_download": True, "quiet": True, "no_warnings": True}) as ydl:
            return ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as exc:
        raise SubtitleError("Không mở được video — kiểm tra link, video có thể private, hoặc chạy 'pip install -U yt-dlp'") from exc


def _pick_track(info: dict) -> dict | None:
    for source in (info.get("subtitles") or {}, info.get("automatic_captions") or {}):
        for language in PREFERRED_LANGS:
            formats = source.get(language) or []
            for extension in ("json3", "vtt"):
                for item in formats:
                    if item.get("ext") == extension and item.get("url"):
                        return item
    return None


def fetch_subtitles(url: str) -> dict:
    import requests
    info = _extract_info(url)
    track = _pick_track(info)
    if track is None:
        raise SubtitleError("Video không có phụ đề tiếng Anh")
    response = requests.get(track["url"], timeout=30)
    response.raise_for_status()
    fragments = parse_json3(response.json()) if track["ext"] == "json3" else parse_vtt(response.text)
    segments = merge_fragments(fragments)
    if not segments:
        raise SubtitleError("Không đọc được phụ đề của video này")
    return {"youtube_id": info["id"], "title": info.get("title") or "Video YouTube", "duration_s": int(info["duration"]) if info.get("duration") else None, "segments": segments}


def parse_json3(data: dict) -> list[dict]:
    fragments = []
    for event in data.get("events") or []:
        start_ms = event.get("tStartMs")
        if start_ms is None:
            continue
        text = " ".join("".join(segment.get("utf8", "") for segment in event.get("segs") or []).split())
        if text and not NOISE.match(text):
            duration_ms = event.get("dDurationMs") or 0
            fragments.append({"start": start_ms / 1000, "end": (start_ms + duration_ms) / 1000, "text": text})
    return fragments


def _to_seconds(hours, minutes, seconds, millis) -> float:
    return int(hours or 0) * 3600 + int(minutes) * 60 + int(seconds) + int(millis) / 1000


def parse_vtt(text: str) -> list[dict]:
    fragments, previous_lines, lines, index = [], [], text.splitlines(), 0
    while index < len(lines):
        match = TIMING_LINE.search(lines[index])
        if not match:
            index += 1
            continue
        start, end = _to_seconds(*match.groups()[:4]), _to_seconds(*match.groups()[4:])
        cue_lines = []
        index += 1
        while index < len(lines) and lines[index].strip():
            line = " ".join(TAG.sub("", lines[index]).split())
            if line:
                cue_lines.append(line)
            index += 1
        new_lines = [line for line in cue_lines if line not in previous_lines]
        previous_lines = cue_lines
        cue = " ".join(new_lines)
        if cue and not NOISE.match(cue):
            fragments.append({"start": start, "end": end, "text": cue})
    return fragments


def merge_fragments(fragments: list[dict]) -> list[dict]:
    segments, parts, start, end = [], [], None, 0.0

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
