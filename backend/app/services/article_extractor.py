"""Extract readable plain text from web pages and PDF files."""
import re

import fitz
import httpx
import trafilatura

MAX_CONTENT_CHARS = 100_000
FETCH_TIMEOUT = 15.0
USER_AGENT = "Mozilla/5.0 FlashcardsReader/1.0"


class ExtractionError(Exception):
    pass


def normalize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text[:MAX_CONTENT_CHARS]


def count_words(text: str) -> int:
    return len(text.split())


def fetch_url(url: str) -> str:
    try:
        response = httpx.get(url, headers={"User-Agent": USER_AGENT}, timeout=FETCH_TIMEOUT, follow_redirects=True)
        response.raise_for_status()
        return response.text
    except httpx.HTTPError as exc:
        raise ExtractionError(f"Không tải được trang: {exc}") from exc


def extract_from_html(html: str, fallback_title: str) -> tuple[str, str]:
    extracted = trafilatura.bare_extraction(html, include_comments=False)
    if not extracted:
        raise ExtractionError("Không trích xuất được nội dung chính — hãy thử dán trực tiếp văn bản.")
    text = (extracted.get("text") or "").strip()
    if not text:
        raise ExtractionError("Không trích xuất được nội dung chính — hãy thử dán trực tiếp văn bản.")
    html_title = re.search(r"<title[^>]*>\s*(.*?)\s*</title>", html, flags=re.IGNORECASE | re.DOTALL)
    title = extracted.get("title") or (html_title.group(1) if html_title else fallback_title)
    title = re.sub(r"\s+", " ", title).strip()
    return title[:500], normalize_text(text)


def extract_from_pdf_source(file_path: str) -> str:
    try:
        if file_path.startswith(("http://", "https://")):
            response = httpx.get(file_path, timeout=FETCH_TIMEOUT, follow_redirects=True)
            response.raise_for_status()
            pdf = fitz.open(stream=response.content, filetype="pdf")
        else:
            pdf = fitz.open(file_path)
    except (httpx.HTTPError, RuntimeError, OSError, fitz.FileDataError) as exc:
        raise ExtractionError(f"Không đọc được file PDF: {exc}") from exc
    try:
        text = normalize_text("\n\n".join(page.get_text("text") for page in pdf))
    finally:
        pdf.close()
    if not text:
        raise ExtractionError("PDF không chứa text (có thể là bản scan).")
    return text
