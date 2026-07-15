# M2 Tech Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trình đọc bài viết (paste text / URL / PDF đã upload) với tra từ 1-click 2 tầng (EN-EN dictionaryapi.dev + EN-VI offline), lưu từ vào deck kèm câu ngữ cảnh, và TTS đọc bài bằng Web Speech API.

**Architecture:** Bảng mới `articles` (thuộc user) + `dictionary_entries` (dùng chung, nạp 1 lần từ dữ liệu StarDict Hồ Ngọc Đức). Service `article_extractor` tách riêng phần fetch/parse (mock được trong test). FE thêm 2 trang `/reader`, `/reader/:id`; popup tra từ gọi thẳng dictionaryapi.dev từ browser (đỡ round-trip qua Render), nghĩa Việt qua backend.

**Tech Stack:** trafilatura (trích nội dung URL), PyMuPDF (có sẵn — text PDF), httpx (có sẵn — fetch), Web Speech API (browser TTS).

**Spec:** `docs/superpowers/specs/2026-07-14-english-learning-completion-design.md` (mục 5)

## Global Constraints

- Python: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe`; pytest chạy với cwd = `backend/`: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests -v`
- Tài nguyên không thuộc user → **404**. Mọi endpoint mới (trừ dictionary) đều yêu cầu auth qua `get_current_user`.
- `GET /api/dictionary/{word}` cũng yêu cầu auth (nhất quán, tránh thành open proxy).
- SQL chạy được trên cả SQLite và Postgres. Không Alembic — bảng mới tự tạo qua `Base.metadata.create_all`.
- Dependency mới được phép trong M2: **chỉ `trafilatura`** (backend). KHÔNG thêm npm package.
- Text UI tiếng Việt, theo phong cách dark glassmorphism hiện có (tham khảo class Tailwind trong `HomePage.tsx`).
- FE API layer: baseURL đã chứa `/api` — path trong `client.get(...)` KHÔNG có prefix `/api` (xem `frontend/src/api/decks.ts`).
- Interfaces M1 tái sử dụng: `get_owned_deck(deck_id, db, user)` từ `app.routers.decks`; `CardCreate` nhận `front_text, back_text, example_sentence, pronunciation, definition, audio_url`; FE `useCachedQuery(key, fetcher)` từ `frontend/src/hooks/useCachedQuery.ts`.

---

### Task 1: Dependency + model `Article` + schemas

**Files:**
- Modify: `backend/requirements.txt`, `backend/app/models/__init__.py`
- Create: `backend/app/models/article.py`, `backend/app/schemas/article.py`
- Test: `backend/tests/test_models.py` (thêm test)

**Interfaces:**
- Produces: model `Article(id, user_id, title, source_type, content, source_url, document_id, summary, word_count, created_at, updated_at)` bảng `articles`; schemas `ArticleCreate {title?, text?, url?, document_id?}`, `ArticleListItem` (KHÔNG có content — list nhẹ), `ArticleOut` (đủ content).

- [ ] **Step 1: Thêm dep**

`backend/requirements.txt` thêm dòng:

```
trafilatura==1.12.2
```

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pip install trafilatura==1.12.2`
Expected: cài thành công (kéo theo lxml, courlan…).

- [ ] **Step 2: Viết failing test — thêm vào cuối `backend/tests/test_models.py`**

```python
def test_article_model(db):
    from app.models.article import Article

    user = _make_user(db, "article-owner@test.com")
    art = Article(
        user_id=user.id,
        title="Sample",
        source_type="paste",
        content="Hello world. Second sentence.",
        word_count=5,
    )
    db.add(art)
    db.commit()
    saved = db.query(Article).one()
    assert saved.source_type == "paste"
    assert saved.summary is None
    assert saved.source_url is None
```

(Nếu helper `_make_user` trong file hiện nhận email cố định thì dùng đúng signature hiện có.)

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_models.py -v`
Expected: FAIL — `ModuleNotFoundError: app.models.article`.

- [ ] **Step 4: Implement**

`backend/app/models/article.py`:

```python
import uuid
from datetime import datetime
from sqlalchemy import String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Article(Base):
    """Bài đọc trong Tech Reader — nguồn: paste | url | pdf | rss."""

    __tablename__ = "articles"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    source_type: Mapped[str] = mapped_column(String(10), nullable=False, default="paste")
    content: Mapped[str] = mapped_column(Text, nullable=False)  # plain text, đoạn cách nhau \n\n
    source_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    document_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("documents.id", ondelete="SET NULL"), nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)  # cache AI tóm tắt (M4)
    word_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
```

`backend/app/models/__init__.py` thêm:

```python
from app.models.article import Article  # noqa: F401
```

`backend/app/schemas/article.py`:

```python
from datetime import datetime
from pydantic import BaseModel, model_validator


class ArticleCreate(BaseModel):
    """Đúng MỘT trong ba nguồn: text (paste) | url | document_id."""

    title: str | None = None
    text: str | None = None
    url: str | None = None
    document_id: str | None = None

    @model_validator(mode="after")
    def exactly_one_source(self):
        sources = [s for s in (self.text, self.url, self.document_id) if s]
        if len(sources) != 1:
            raise ValueError("Cung cấp đúng một nguồn: text, url hoặc document_id")
        return self


class ArticleListItem(BaseModel):
    id: str
    title: str
    source_type: str
    source_url: str | None
    word_count: int
    has_summary: bool = False
    created_at: datetime

    model_config = {"from_attributes": True}


class ArticleOut(BaseModel):
    id: str
    title: str
    source_type: str
    content: str
    source_url: str | None
    document_id: str | None
    summary: str | None
    word_count: int
    created_at: datetime

    model_config = {"from_attributes": True}
```

- [ ] **Step 5: Chạy test pass + commit**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_models.py -v`
Expected: PASS.

```bash
git add backend/requirements.txt backend/app/models backend/app/schemas/article.py backend/tests/test_models.py
git commit -m "feat: article model and schemas for tech reader"
```

---

### Task 2: Service `article_extractor` — URL + PDF → plain text

**Files:**
- Create: `backend/app/services/article_extractor.py`
- Test: `backend/tests/test_article_extractor.py` (mới)

**Interfaces:**
- Produces: `extract_from_html(html: str, fallback_title: str) -> tuple[str, str]` (title, text — raise `ExtractionError` nếu không trích được), `fetch_url(url: str) -> str` (html — raise `ExtractionError` nếu lỗi mạng/HTTP), `extract_from_pdf_source(file_path: str) -> str` (nhận local path HOẶC http URL — Supabase Storage), `class ExtractionError(Exception)`, `count_words(text: str) -> int`, `normalize_text(text: str) -> str`.

- [ ] **Step 1: Viết failing test — `backend/tests/test_article_extractor.py`**

```python
import fitz
import pytest

from app.services.article_extractor import (
    ExtractionError,
    count_words,
    extract_from_html,
    extract_from_pdf_source,
    normalize_text,
)

SAMPLE_HTML = """
<html><head><title>Docker Explained</title></head><body>
<nav>Menu Home About</nav>
<article>
<h1>Docker Explained</h1>
<p>Docker is a platform for building and running containers. It packages code and dependencies together.</p>
<p>Containers are lightweight and portable across environments, which makes deployment much easier for teams.</p>
</article>
<footer>Copyright 2026</footer>
</body></html>
"""


def test_extract_from_html_returns_title_and_main_text():
    title, text = extract_from_html(SAMPLE_HTML, fallback_title="fallback")
    assert "Docker" in title
    assert "platform for building" in text
    assert "Copyright 2026" not in text  # bỏ boilerplate


def test_extract_from_html_raises_on_empty():
    with pytest.raises(ExtractionError):
        extract_from_html("<html><body></body></html>", fallback_title="x")


def test_extract_from_pdf_local(tmp_path):
    pdf_path = tmp_path / "sample.pdf"
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Kubernetes orchestrates containers at scale.")
    doc.save(str(pdf_path))
    doc.close()

    text = extract_from_pdf_source(str(pdf_path))
    assert "Kubernetes orchestrates" in text


def test_normalize_and_count_words():
    raw = "Line one.\n\n\n\nLine   two.\r\nLine three."
    text = normalize_text(raw)
    assert "\n\n\n" not in text
    assert count_words("one two three") == 3
```

- [ ] **Step 2: Chạy, xác nhận fail**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_article_extractor.py -v`
Expected: FAIL — module chưa tồn tại.

- [ ] **Step 3: Implement `backend/app/services/article_extractor.py`**

```python
"""Trích nội dung bài đọc từ URL (trafilatura) hoặc PDF (PyMuPDF)."""
import re

import fitz
import httpx
import trafilatura

MAX_CONTENT_CHARS = 100_000
FETCH_TIMEOUT = 15.0
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) FlashieReader/1.0"


class ExtractionError(Exception):
    pass


def normalize_text(text: str) -> str:
    """Chuẩn hóa: CRLF → LF, gộp dòng trống thừa, cắt trần độ dài."""
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text[:MAX_CONTENT_CHARS]


def count_words(text: str) -> int:
    return len(text.split())


def fetch_url(url: str) -> str:
    try:
        res = httpx.get(
            url,
            headers={"User-Agent": USER_AGENT},
            timeout=FETCH_TIMEOUT,
            follow_redirects=True,
        )
        res.raise_for_status()
        return res.text
    except httpx.HTTPError as e:
        raise ExtractionError(f"Không tải được trang: {e}") from e


def extract_from_html(html: str, fallback_title: str) -> tuple[str, str]:
    extracted = trafilatura.bare_extraction(html, include_comments=False)
    if not extracted or not (extracted.get("text") or "").strip():
        raise ExtractionError("Không trích được nội dung chính — hãy thử dán trực tiếp văn bản.")
    title = (extracted.get("title") or "").strip() or fallback_title
    return title[:500], normalize_text(extracted["text"])


def extract_from_pdf_source(file_path: str) -> str:
    """file_path là đường dẫn local (dev) hoặc URL Supabase Storage (prod)."""
    try:
        if file_path.startswith(("http://", "https://")):
            res = httpx.get(file_path, timeout=FETCH_TIMEOUT, follow_redirects=True)
            res.raise_for_status()
            pdf = fitz.open(stream=res.content, filetype="pdf")
        else:
            pdf = fitz.open(file_path)
    except (httpx.HTTPError, RuntimeError, fitz.FileNotFoundError) as e:
        raise ExtractionError(f"Không đọc được file PDF: {e}") from e

    try:
        pages = [page.get_text("text") for page in pdf]
    finally:
        pdf.close()

    text = normalize_text("\n\n".join(pages))
    if not text:
        raise ExtractionError("PDF không chứa text (có thể là bản scan).")
    return text
```

Lưu ý phiên bản trafilatura: nếu `bare_extraction` trả object (Document) thay vì dict ở version đã cài, dùng `trafilatura.extract(html, output_format="json")` + `json.loads` với các key `title`, `text` — chạy test để chốt nhánh đúng, giữ một nhánh duy nhất.

- [ ] **Step 4: Chạy test pass + commit**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_article_extractor.py -v`
Expected: PASS.

```bash
git add backend/app/services/article_extractor.py backend/tests/test_article_extractor.py
git commit -m "feat: article extractor service (url via trafilatura, pdf via pymupdf)"
```

---

### Task 3: Articles router

**Files:**
- Create: `backend/app/routers/articles.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_articles.py` (mới)

**Interfaces:**
- Consumes: `Article`, schemas Task 1, extractor Task 2, `get_current_user`, model `Document`.
- Produces: `POST /api/articles` (body `ArticleCreate`, lỗi trích xuất → 422), `GET /api/articles -> list[ArticleListItem]`, `GET /api/articles/{id} -> ArticleOut`, `DELETE /api/articles/{id}`; helper `get_owned_article(article_id, db, user) -> Article` (M4 summarize dùng).

- [ ] **Step 1: Viết failing test — `backend/tests/test_articles.py`**

```python
from unittest.mock import patch

from app.services.article_extractor import ExtractionError

PASTE_BODY = {
    "title": "My Notes",
    "text": "Docker is great. It ships containers.\n\nSecond paragraph here.",
}


def test_articles_require_auth(anon_client):
    assert anon_client.get("/api/articles").status_code == 401


def test_create_article_from_paste(client):
    res = client.post("/api/articles", json=PASTE_BODY)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["title"] == "My Notes"
    assert data["source_type"] == "paste"
    assert data["word_count"] == 10


def test_create_paste_without_title_uses_first_words(client):
    res = client.post("/api/articles", json={"text": "Kubernetes orchestrates containers at massive scale today"})
    assert res.status_code == 200
    assert res.json()["title"].startswith("Kubernetes orchestrates")


def test_create_article_requires_exactly_one_source(client):
    assert client.post("/api/articles", json={"title": "x"}).status_code == 422
    assert client.post("/api/articles", json={"text": "a", "url": "https://x.com"}).status_code == 422


def test_create_article_from_url(client):
    with patch("app.routers.articles.fetch_url", return_value="<html>stub</html>"), \
         patch("app.routers.articles.extract_from_html", return_value=("Fetched Title", "Extracted body text here.")):
        res = client.post("/api/articles", json={"url": "https://example.com/post"})
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "Fetched Title"
    assert data["source_type"] == "url"
    assert data["source_url"] == "https://example.com/post"


def test_create_article_url_extraction_error_422(client):
    with patch("app.routers.articles.fetch_url", side_effect=ExtractionError("boom")):
        res = client.post("/api/articles", json={"url": "https://example.com/broken"})
    assert res.status_code == 422
    assert "boom" in res.json()["detail"]


def test_list_articles_returns_light_items(client):
    client.post("/api/articles", json=PASTE_BODY)
    items = client.get("/api/articles").json()
    assert len(items) == 1
    assert "content" not in items[0]
    assert items[0]["word_count"] == 10
    assert items[0]["has_summary"] is False


def test_articles_scoped_per_user(client, user_b_client):
    art = client.post("/api/articles", json=PASTE_BODY).json()
    assert user_b_client.get("/api/articles").json() == []
    assert user_b_client.get(f"/api/articles/{art['id']}").status_code == 404
    assert user_b_client.delete(f"/api/articles/{art['id']}").status_code == 404


def test_delete_article(client):
    art = client.post("/api/articles", json=PASTE_BODY).json()
    assert client.delete(f"/api/articles/{art['id']}").status_code == 200
    assert client.get(f"/api/articles/{art['id']}").status_code == 404
```

- [ ] **Step 2: Chạy, xác nhận fail**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_articles.py -v`
Expected: FAIL — 404 route not found.

- [ ] **Step 3: Implement `backend/app/routers/articles.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.article import Article
from app.models.document import Document
from app.models.user import User
from app.schemas.article import ArticleCreate, ArticleListItem, ArticleOut
from app.services.article_extractor import (
    ExtractionError,
    count_words,
    extract_from_html,
    extract_from_pdf_source,
    fetch_url,
    normalize_text,
)
from app.services.security import get_current_user

router = APIRouter(prefix="/api/articles", tags=["articles"])


def get_owned_article(article_id: str, db: Session, user: User) -> Article:
    article = db.query(Article).filter(Article.id == article_id, Article.user_id == user.id).first()
    if not article:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài đọc")
    return article


def _default_title(text: str) -> str:
    return " ".join(text.split()[:8])[:500] or "Bài đọc"


@router.post("", response_model=ArticleOut)
def create_article(body: ArticleCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    try:
        if body.text is not None:
            content = normalize_text(body.text)
            if not content:
                raise ExtractionError("Văn bản trống.")
            article = Article(
                user_id=user.id,
                title=(body.title or _default_title(content)),
                source_type="paste",
                content=content,
            )
        elif body.url is not None:
            html = fetch_url(body.url)
            title, content = extract_from_html(html, fallback_title=body.title or body.url)
            article = Article(
                user_id=user.id,
                title=body.title or title,
                source_type="url",
                content=content,
                source_url=body.url,
            )
        else:
            doc = db.query(Document).filter(
                Document.id == body.document_id, Document.user_id == user.id
            ).first()
            if not doc:
                raise HTTPException(status_code=404, detail="Không tìm thấy tài liệu")
            content = extract_from_pdf_source(doc.file_path)
            article = Article(
                user_id=user.id,
                title=body.title or doc.filename,
                source_type="pdf",
                content=content,
                document_id=doc.id,
            )
    except ExtractionError as e:
        raise HTTPException(status_code=422, detail=str(e))

    article.word_count = count_words(article.content)
    db.add(article)
    db.commit()
    db.refresh(article)
    return article


@router.get("", response_model=list[ArticleListItem])
def list_articles(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = (
        db.query(Article)
        .filter(Article.user_id == user.id)
        .order_by(Article.created_at.desc())
        .all()
    )
    return [
        ArticleListItem(
            id=a.id,
            title=a.title,
            source_type=a.source_type,
            source_url=a.source_url,
            word_count=a.word_count,
            has_summary=a.summary is not None,
            created_at=a.created_at,
        )
        for a in rows
    ]


@router.get("/{article_id}", response_model=ArticleOut)
def get_article(article_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return get_owned_article(article_id, db, user)


@router.delete("/{article_id}")
def delete_article(article_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    article = get_owned_article(article_id, db, user)
    db.delete(article)
    db.commit()
    return {"status": "success"}
```

`backend/app/main.py` — thêm import + include:

```python
from app.routers import articles
...
app.include_router(articles.router)
```

- [ ] **Step 4: Chạy test pass + full suite + commit**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests -v`
Expected: PASS toàn bộ.

```bash
git add backend/app/routers/articles.py backend/app/main.py backend/tests/test_articles.py
git commit -m "feat: articles API - create from paste/url/pdf, list, get, delete"
```

---

### Task 4: Từ điển EN-VI — model + script import

**Files:**
- Create: `backend/app/models/dictionary.py`, `backend/scripts/import_dictionary.py`
- Modify: `backend/app/models/__init__.py`, `.gitignore`
- Test: `backend/tests/test_dictionary_import.py` (mới)

**Interfaces:**
- Produces: model `DictionaryEntry(word PK lowercase, pronunciation, content)` bảng `dictionary_entries`; hàm `parse_hnd_format(lines: Iterable[str]) -> Iterator[dict]` (parse định dạng text Hồ Ngọc Đức) export từ `scripts.import_dictionary`; CLI `python scripts/import_dictionary.py <file.txt>`.

- [ ] **Step 1: Viết failing test — `backend/tests/test_dictionary_import.py`**

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.import_dictionary import parse_hnd_format

SAMPLE = """@abandon /ə'bændən/
*  danh từ
- sự bỏ, sự từ bỏ
*  ngoại động từ
- bỏ, từ bỏ
@abandoned /ə'bændənd/
*  tính từ
- bị bỏ rơi, bị ruồng bỏ
@zigzag
- đường chữ chi
"""


def test_parse_hnd_format():
    entries = list(parse_hnd_format(SAMPLE.splitlines()))
    assert len(entries) == 3

    first = entries[0]
    assert first["word"] == "abandon"
    assert first["pronunciation"] == "/ə'bændən/"
    assert "sự bỏ, sự từ bỏ" in first["content"]
    assert "ngoại động từ" in first["content"]

    # Từ không có phiên âm
    assert entries[2]["word"] == "zigzag"
    assert entries[2]["pronunciation"] is None


def test_parse_skips_garbage_lines():
    entries = list(parse_hnd_format(["random noise", "@valid /v/", "- nghĩa"]))
    assert len(entries) == 1
    assert entries[0]["word"] == "valid"
```

- [ ] **Step 2: Chạy, xác nhận fail**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_dictionary_import.py -v`
Expected: FAIL — module/hàm chưa có.

- [ ] **Step 3: Implement**

`backend/app/models/dictionary.py`:

```python
from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class DictionaryEntry(Base):
    """Từ điển Anh-Việt offline (nạp 1 lần bằng scripts/import_dictionary.py) — dùng chung mọi user."""

    __tablename__ = "dictionary_entries"

    word: Mapped[str] = mapped_column(String(100), primary_key=True)  # lowercase
    pronunciation: Mapped[str | None] = mapped_column(String(200), nullable=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)  # nghĩa VI, giữ cấu trúc dòng
```

`backend/app/models/__init__.py` thêm:

```python
from app.models.dictionary import DictionaryEntry  # noqa: F401
```

`backend/scripts/import_dictionary.py`:

```python
"""Nạp từ điển Anh-Việt (định dạng text Hồ Ngọc Đức) vào bảng dictionary_entries.

Định dạng nguồn (mỗi mục bắt đầu bằng @):
    @abandon /ə'bændən/
    *  danh từ
    - sự bỏ, sự từ bỏ

Cách dùng (cwd = backend/):
    python scripts/import_dictionary.py data/dictionaries/anhviet.txt
    # Prod: set DATABASE_URL=<supabase-url> trước khi chạy

Nguồn dữ liệu: bản text từ điển Anh-Việt ~109k mục của Hồ Ngọc Đức (GPL),
tìm trên GitHub với từ khóa "anhviet109K" hoặc trang gốc informatik.uni-leipzig.de/~duc/Dict/.
Lưu file vào backend/data/dictionaries/ (đã gitignore).
"""
import re
import sys
from pathlib import Path
from typing import Iterable, Iterator

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

HEAD_RE = re.compile(r"^@(?P<word>[^/]+?)\s*(?P<pron>/[^/]*/)?\s*$")
BATCH_SIZE = 1000


def parse_hnd_format(lines: Iterable[str]) -> Iterator[dict]:
    """Parse định dạng Hồ Ngọc Đức, yield {word, pronunciation, content}."""
    current: dict | None = None
    body: list[str] = []

    def finish():
        if current is not None and body:
            yield {
                "word": current["word"],
                "pronunciation": current["pronunciation"],
                "content": "\n".join(body).strip(),
            }

    for raw in lines:
        line = raw.rstrip("\n")
        if line.startswith("@"):
            yield from finish()
            m = HEAD_RE.match(line)
            if not m or not m.group("word").strip():
                current, body = None, []
                continue
            current = {
                "word": m.group("word").strip().lower(),
                "pronunciation": m.group("pron"),
            }
            body = []
        elif current is not None and line.strip():
            body.append(line.strip())
    yield from finish()


def main() -> None:
    from sqlalchemy.dialects import postgresql, sqlite

    from app.database import Base, SessionLocal, engine, DATABASE_URL
    import app.models  # noqa: F401
    from app.models.dictionary import DictionaryEntry

    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    source = Path(sys.argv[1])
    if not source.exists():
        print(f"Không thấy file: {source}")
        sys.exit(1)

    Base.metadata.create_all(bind=engine)
    print(f"Database: {DATABASE_URL}")

    is_postgres = engine.dialect.name == "postgresql"
    insert = postgresql.insert if is_postgres else sqlite.insert

    db = SessionLocal()
    total = 0
    batch: list[dict] = []
    try:
        with source.open(encoding="utf-8", errors="replace") as f:
            for entry in parse_hnd_format(f):
                if len(entry["word"]) > 100:
                    continue
                batch.append(entry)
                if len(batch) >= BATCH_SIZE:
                    stmt = insert(DictionaryEntry).values(batch).on_conflict_do_nothing(index_elements=["word"])
                    db.execute(stmt)
                    db.commit()
                    total += len(batch)
                    batch = []
                    print(f"\r  Đã nạp {total} mục...", end="")
        if batch:
            stmt = insert(DictionaryEntry).values(batch).on_conflict_do_nothing(index_elements=["word"])
            db.execute(stmt)
            db.commit()
            total += len(batch)
    finally:
        db.close()
    print(f"\nHoàn tất: {total} mục từ điển.")


if __name__ == "__main__":
    main()
```

`.gitignore` (repo root) thêm dòng:

```
backend/data/dictionaries/
```

- [ ] **Step 4: Chạy test pass + commit**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_dictionary_import.py -v`
Expected: PASS.

```bash
git add backend/app/models/dictionary.py backend/app/models/__init__.py backend/scripts/import_dictionary.py .gitignore backend/tests/test_dictionary_import.py
git commit -m "feat: offline EN-VI dictionary model + HND-format import script"
```

- [ ] **Step 5: Tải dữ liệu thật + nạp local (thao tác 1 lần)**

1. Tìm và tải bản text từ điển Anh-Việt Hồ Ngọc Đức (~109k mục): tìm GitHub `anhviet109K.txt` (hoặc trang gốc informatik.uni-leipzig.de/~duc/Dict/). Lưu về `backend/data/dictionaries/anhviet.txt`.
2. Mở file kiểm tra 20 dòng đầu — nếu format khác mẫu `@word /pron/` thì điều chỉnh `HEAD_RE`/parser cho khớp (chạy lại unit test).
3. Run (cwd backend): `C:\Users\Admin\anaconda3\envs\flashcard\python.exe scripts\import_dictionary.py data\dictionaries\anhviet.txt`
Expected: in "Hoàn tất: ~109000 mục". Verify nhanh: `python -c` query từ "abandon" có nghĩa VI.
Nếu không tải được dữ liệu từ nguồn nào → DỪNG hỏi user cung cấp file, không tự bịa dữ liệu.

---

### Task 5: Dictionary lookup API + stemming nhẹ

**Files:**
- Create: `backend/app/routers/dictionary.py`, `backend/app/schemas/dictionary.py`
- Modify: `backend/app/main.py`
- Test: `backend/tests/test_dictionary_api.py` (mới)

**Interfaces:**
- Consumes: `DictionaryEntry` Task 4.
- Produces: `GET /api/dictionary/{word}` → `{word, matched_word, pronunciation, content}` (404 nếu miss); hàm `lookup_candidates(word: str) -> list[str]`.

- [ ] **Step 1: Viết failing test — `backend/tests/test_dictionary_api.py`**

```python
import pytest

from app.models.dictionary import DictionaryEntry
from app.routers.dictionary import lookup_candidates


@pytest.fixture
def seeded_dict(db):
    db.add_all([
        DictionaryEntry(word="abandon", pronunciation="/ə'bændən/", content="- bỏ, từ bỏ"),
        DictionaryEntry(word="make", pronunciation="/meik/", content="- làm, chế tạo"),
        DictionaryEntry(word="run", pronunciation="/rʌn/", content="- chạy"),
    ])
    db.commit()


def test_lookup_requires_auth(anon_client):
    assert anon_client.get("/api/dictionary/abandon").status_code == 401


def test_lookup_exact(client, seeded_dict):
    res = client.get("/api/dictionary/Abandon")
    assert res.status_code == 200
    data = res.json()
    assert data["matched_word"] == "abandon"
    assert "từ bỏ" in data["content"]


def test_lookup_stemming(client, seeded_dict):
    # abandoned -> abandon (bỏ 'ed'), making -> make (+e), running -> run (bỏ phụ âm đôi)
    assert client.get("/api/dictionary/abandoned").json()["matched_word"] == "abandon"
    assert client.get("/api/dictionary/making").json()["matched_word"] == "make"
    assert client.get("/api/dictionary/running").json()["matched_word"] == "run"


def test_lookup_miss_404(client, seeded_dict):
    assert client.get("/api/dictionary/xyzzy").status_code == 404


def test_lookup_candidates_order():
    cands = lookup_candidates("Running")
    assert cands[0] == "running"
    assert "run" in cands
```

- [ ] **Step 2: Chạy, xác nhận fail**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests/test_dictionary_api.py -v`
Expected: FAIL.

- [ ] **Step 3: Implement**

`backend/app/schemas/dictionary.py`:

```python
from pydantic import BaseModel


class DictionaryOut(BaseModel):
    word: str            # từ user tra
    matched_word: str    # mục từ điển khớp (sau stemming)
    pronunciation: str | None
    content: str
```

`backend/app/routers/dictionary.py`:

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.dictionary import DictionaryEntry
from app.schemas.dictionary import DictionaryOut
from app.services.security import get_current_user

router = APIRouter(prefix="/api/dictionary", tags=["dictionary"], dependencies=[Depends(get_current_user)])


def lookup_candidates(word: str) -> list[str]:
    """Từ gốc + các dạng bỏ hậu tố đơn giản (không cần NLP lib)."""
    w = word.strip().lower()
    cands = [w]
    for suffix in ("'s", "es", "s", "ed", "ing"):
        if w.endswith(suffix) and len(w) - len(suffix) >= 2:
            stem = w[: -len(suffix)]
            cands.append(stem)
            if suffix in ("ed", "ing"):
                cands.append(stem + "e")  # making -> make
                if len(stem) >= 2 and stem[-1] == stem[-2]:
                    cands.append(stem[:-1])  # running -> run
    return list(dict.fromkeys(cands))


@router.get("/{word}", response_model=DictionaryOut)
def lookup(word: str, db: Session = Depends(get_db)):
    candidates = lookup_candidates(word)
    entry = (
        db.query(DictionaryEntry)
        .filter(DictionaryEntry.word.in_(candidates))
        .all()
    )
    by_word = {e.word: e for e in entry}
    for cand in candidates:  # ưu tiên theo thứ tự candidate
        if cand in by_word:
            e = by_word[cand]
            return DictionaryOut(
                word=word, matched_word=e.word, pronunciation=e.pronunciation, content=e.content
            )
    raise HTTPException(status_code=404, detail="Không có trong từ điển")
```

`backend/app/main.py` thêm:

```python
from app.routers import dictionary
...
app.include_router(dictionary.router)
```

- [ ] **Step 4: Chạy full suite + commit**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests -v`
Expected: PASS toàn bộ.

```bash
git add backend/app/routers/dictionary.py backend/app/schemas/dictionary.py backend/app/main.py backend/tests/test_dictionary_api.py
git commit -m "feat: EN-VI dictionary lookup API with light stemming"
```

---

### Task 6: FE — API layer, types, routes, Navbar

**Files:**
- Create: `frontend/src/api/articles.ts`, `frontend/src/api/dictionary.ts`
- Modify: `frontend/src/types/index.ts`, `frontend/src/App.tsx`, `frontend/src/components/Navbar.tsx`

**Interfaces:**
- Produces: types `ArticleListItem`, `Article`, `DictionaryResult`, `EnDictResult`; API `getArticles()`, `getArticle(id)`, `createArticle(input)`, `deleteArticle(id)`, `lookupViDictionary(word)` (null khi 404), `lookupEnDictionary(word)` (dictionaryapi.dev + cache localStorage, null khi miss); routes `/reader`, `/reader/:id` (RequireAuth + lazy); Navbar item "Đọc".

- [ ] **Step 1: Types — thêm vào `frontend/src/types/index.ts`**

```typescript
export interface ArticleListItem {
  id: string
  title: string
  source_type: 'paste' | 'url' | 'pdf' | 'rss'
  source_url: string | null
  word_count: number
  has_summary: boolean
  created_at: string
}

export interface Article {
  id: string
  title: string
  source_type: 'paste' | 'url' | 'pdf' | 'rss'
  content: string
  source_url: string | null
  document_id: string | null
  summary: string | null
  word_count: number
  created_at: string
}

export interface DictionaryResult {
  word: string
  matched_word: string
  pronunciation: string | null
  content: string
}

/** Kết quả rút gọn từ dictionaryapi.dev */
export interface EnDictResult {
  word: string
  phonetic: string | null
  audioUrl: string | null
  meanings: { partOfSpeech: string; definitions: string[] }[]
}
```

- [ ] **Step 2: `frontend/src/api/articles.ts`**

```typescript
import client from './client'
import type { Article, ArticleListItem } from '../types'

export type ArticleInput =
  | { title?: string; text: string }
  | { title?: string; url: string }
  | { title?: string; document_id: string }

export const getArticles = () => client.get<ArticleListItem[]>('/articles').then(r => r.data)
export const getArticle = (id: string) => client.get<Article>(`/articles/${id}`).then(r => r.data)
export const createArticle = (input: ArticleInput) => client.post<Article>('/articles', input).then(r => r.data)
export const deleteArticle = (id: string) => client.delete(`/articles/${id}`)
```

- [ ] **Step 3: `frontend/src/api/dictionary.ts`**

```typescript
import axios from 'axios'
import client from './client'
import type { DictionaryResult, EnDictResult } from '../types'

/** EN-VI: backend (từ điển offline). null nếu không có mục. */
export async function lookupViDictionary(word: string): Promise<DictionaryResult | null> {
  try {
    return (await client.get<DictionaryResult>(`/dictionary/${encodeURIComponent(word)}`)).data
  } catch {
    return null
  }
}

const EN_CACHE_PREFIX = 'endict:'
const EN_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 ngày

/** EN-EN: gọi thẳng dictionaryapi.dev từ browser (có CORS) + cache localStorage. */
export async function lookupEnDictionary(word: string): Promise<EnDictResult | null> {
  const key = EN_CACHE_PREFIX + word.toLowerCase()
  try {
    const raw = window.localStorage.getItem(key)
    if (raw) {
      const cached = JSON.parse(raw) as { at: number; data: EnDictResult | null }
      if (Date.now() - cached.at < EN_CACHE_TTL_MS) return cached.data
    }
  } catch { /* cache hỏng — bỏ qua */ }

  let result: EnDictResult | null = null
  try {
    const res = await axios.get(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`,
      { timeout: 8000 },
    )
    const entries = res.data as Array<{
      word: string
      phonetic?: string
      phonetics?: { text?: string; audio?: string }[]
      meanings?: { partOfSpeech: string; definitions: { definition: string }[] }[]
    }>
    const first = entries[0]
    if (first) {
      const audio = first.phonetics?.find(p => p.audio)?.audio ?? null
      result = {
        word: first.word,
        phonetic: first.phonetic ?? first.phonetics?.find(p => p.text)?.text ?? null,
        audioUrl: audio,
        meanings: (first.meanings ?? []).slice(0, 3).map(m => ({
          partOfSpeech: m.partOfSpeech,
          definitions: m.definitions.slice(0, 2).map(d => d.definition),
        })),
      }
    }
  } catch {
    result = null // 404 (không có từ) hoặc lỗi mạng — popup vẫn hiện phần EN-VI
  }

  try {
    window.localStorage.setItem(key, JSON.stringify({ at: Date.now(), data: result }))
  } catch { /* quota — bỏ qua */ }
  return result
}
```

- [ ] **Step 4: Routes + Navbar**

`frontend/src/App.tsx` — thêm 2 lazy page + route (theo pattern RequireAuth hiện có):

```tsx
const ReaderListPage = lazy(() => import('./pages/ReaderListPage'))
const ReaderPage = lazy(() => import('./pages/ReaderPage'))
...
<Route path="/reader" element={<RequireAuth><ReaderListPage /></RequireAuth>} />
<Route path="/reader/:id" element={<RequireAuth><ReaderPage /></RequireAuth>} />
```

(Tạm thời tạo 2 file page stub `export default function ReaderListPage() { return null }` để build xanh — Task 7-8 viết thật.)

`frontend/src/components/Navbar.tsx` — thêm vào mảng `NAV_ITEMS` (dòng ~4) mục `{ to: '/reader', label: 'Đọc', icon: <chọn icon có sẵn trong NavIconName hoặc thêm case 'book' vào NavIcon> }` theo đúng shape các item hiện có. Mobile đang `grid grid-cols-4` (dòng ~157) → đổi thành `grid-cols-5` (đếm lại tổng item thực tế sau khi thêm).

- [ ] **Step 5: Verify build + commit**

Run: `cd frontend && npm run build`
Expected: build sạch.

```bash
git add frontend/src
git commit -m "feat: reader routes, articles/dictionary API layer, nav item"
```

---

### Task 7: FE — ReaderListPage (danh sách + modal tạo bài)

**Files:**
- Create: `frontend/src/pages/ReaderListPage.tsx`
- Modify: không

**Interfaces:**
- Consumes: `getArticles/createArticle/deleteArticle` (Task 6), `getDocuments` từ `frontend/src/api/documents.ts` (có sẵn), `useCachedQuery`, `useNotification` từ `components/NotificationProvider`, `useAuth`.

- [ ] **Step 1: Implement `ReaderListPage.tsx`**

```tsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createArticle, deleteArticle, getArticles } from '../api/articles'
import { getDocuments } from '../api/documents'
import { useAuth } from '../auth/AuthContext'
import { useCachedQuery } from '../hooks/useCachedQuery'
import { useNotification } from '../components/NotificationProvider'
import type { Document } from '../types'

const SOURCE_BADGE: Record<string, string> = { paste: '📋 Dán', url: '🔗 Web', pdf: '📄 PDF', rss: '📰 RSS' }

type Tab = 'paste' | 'url' | 'pdf'

export default function ReaderListPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { toast, confirm } = useNotification()
  const articlesQuery = useCachedQuery(user ? `articles:${user.id}` : null, getArticles)
  const articles = articlesQuery.data ?? []

  const [showNew, setShowNew] = useState(false)
  const [tab, setTab] = useState<Tab>('paste')
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [docs, setDocs] = useState<Document[] | null>(null)
  const [docId, setDocId] = useState('')
  const [creating, setCreating] = useState(false)

  const openPdfTab = async () => {
    setTab('pdf')
    if (docs === null) setDocs(await getDocuments())
  }

  const handleCreate = async () => {
    const input =
      tab === 'paste' ? { title: title.trim() || undefined, text }
      : tab === 'url' ? { title: title.trim() || undefined, url: url.trim() }
      : { title: title.trim() || undefined, document_id: docId }
    if ((tab === 'paste' && !text.trim()) || (tab === 'url' && !url.trim()) || (tab === 'pdf' && !docId)) return

    setCreating(true)
    try {
      const article = await createArticle(input)
      toast('Đã tạo bài đọc', 'success')
      navigate(`/reader/${article.id}`)
    } catch (e: any) {
      toast(e?.response?.data?.detail ?? 'Không tạo được bài đọc', 'error')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!(await confirm(`Xóa bài "${name}"?`))) return
    await deleteArticle(id)
    toast('Đã xóa bài đọc', 'success')
    articlesQuery.refresh()
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-black text-white">📖 Bài đọc</h1>
        <button
          onClick={() => setShowNew(true)}
          className="rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200 transition hover:bg-cyan-400/20"
        >
          + Bài mới
        </button>
      </div>

      {articlesQuery.loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/[0.05]" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <p className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-8 text-center text-slate-400">
          Chưa có bài đọc nào — dán một bài báo IT hoặc JD để bắt đầu.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {articles.map(a => (
            <div key={a.id} className="group relative rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 transition hover:border-cyan-300/20 hover:bg-white/[0.05]">
              <Link to={`/reader/${a.id}`} className="block">
                <h3 className="line-clamp-2 font-bold text-slate-100">{a.title}</h3>
                <p className="mt-2 text-xs text-slate-500">
                  {SOURCE_BADGE[a.source_type]} · {a.word_count} từ · {new Date(a.created_at).toLocaleDateString('vi-VN')}
                </p>
              </Link>
              <button
                onClick={() => handleDelete(a.id, a.title)}
                className="absolute right-3 top-3 hidden rounded-lg px-2 py-1 text-xs text-rose-300 hover:bg-rose-500/10 group-hover:block"
              >
                Xóa
              </button>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShowNew(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="mb-4 text-lg font-black text-white">Bài đọc mới</h2>
            <div className="mb-4 flex gap-1 rounded-xl bg-black/30 p-1">
              {([['paste', '📋 Dán text'], ['url', '🔗 URL'], ['pdf', '📄 PDF']] as [Tab, string][]).map(([t, label]) => (
                <button
                  key={t}
                  onClick={() => (t === 'pdf' ? openPdfTab() : setTab(t))}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition ${tab === t ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Tiêu đề (tùy chọn)"
              className="mb-3 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500"
            />
            {tab === 'paste' && (
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                rows={8}
                placeholder="Dán bài báo, JD, tài liệu..."
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
            )}
            {tab === 'url' && (
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://techcrunch.com/..."
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
            )}
            {tab === 'pdf' && (
              docs === null ? (
                <p className="text-sm text-slate-400">Đang tải danh sách tài liệu…</p>
              ) : docs.length === 0 ? (
                <p className="text-sm text-slate-400">
                  Chưa có PDF nào — upload ở trang <Link to="/documents" className="text-cyan-300 underline">Tài liệu</Link> trước.
                </p>
              ) : (
                <select
                  value={docId}
                  onChange={e => setDocId(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
                >
                  <option value="">— Chọn tài liệu —</option>
                  {docs.map(d => <option key={d.id} value={d.id}>{d.filename}</option>)}
                </select>
              )
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowNew(false)} className="rounded-xl px-4 py-2 text-sm font-bold text-slate-400 hover:text-white">Hủy</button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="rounded-xl border border-cyan-300/25 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-50"
              >
                {creating ? 'Đang xử lý…' : 'Tạo bài đọc'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

Kiểm tra type `Document` và hàm `getDocuments` trong `frontend/src/api/documents.ts` — nếu tên khác (vd `listDocuments`) thì dùng đúng tên có sẵn. Kiểm tra signature `confirm` của NotificationProvider (Promise<boolean> hay callback) và dùng đúng.

- [ ] **Step 2: Verify bằng dev server**

Tạo bài từ cả 3 tab (PDF cần có document sẵn; URL thử 1 bài blog thật, ví dụ https://blog.cloudflare.com bài bất kỳ). Xác nhận: list hiện bài, badge nguồn đúng, xóa hoạt động, lỗi URL rác hiện toast chứa message backend.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ReaderListPage.tsx
git commit -m "feat: reader list page with paste/url/pdf creation modal"
```

---

### Task 8: FE — ReaderPage: đọc bài, click-từ, popup tra từ + lưu vào deck

**Files:**
- Create: `frontend/src/pages/ReaderPage.tsx`, `frontend/src/components/reader/WordPopup.tsx`
- Modify: không

**Interfaces:**
- Consumes: `getArticle` (Task 6), `lookupViDictionary`/`lookupEnDictionary` (Task 6), `getDecks` từ `api/decks.ts`, `createCard` từ `api/cards.ts` (signature: `createCard(deckId, {front_text, back_text, example_sentence?, pronunciation?, definition?, audio_url?})` — kiểm tra và mở rộng type param nếu thiếu field `pronunciation`/`definition`).
- Produces: component `WordPopup({ word, sentence, onClose })`; helper export `extractSentence(paragraph: string, wordIndex: number) -> string` (M4 enrich tái dùng context này).

- [ ] **Step 1: Implement `frontend/src/components/reader/WordPopup.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react'
import { lookupEnDictionary, lookupViDictionary } from '../../api/dictionary'
import { getDecks } from '../../api/decks'
import { createCard } from '../../api/cards'
import { useNotification } from '../NotificationProvider'
import type { Deck, DictionaryResult, EnDictResult } from '../../types'

const LAST_DECK_KEY = 'reader.lastDeckId'

interface Props {
  word: string
  sentence: string // câu chứa từ — làm example_sentence
  onClose: () => void
}

export default function WordPopup({ word, sentence, onClose }: Props) {
  const { toast } = useNotification()
  const [vi, setVi] = useState<DictionaryResult | null | 'loading'>('loading')
  const [en, setEn] = useState<EnDictResult | null | 'loading'>('loading')
  const [decks, setDecks] = useState<Deck[]>([])
  const [deckId, setDeckId] = useState(() => window.localStorage.getItem(LAST_DECK_KEY) ?? '')
  const [backText, setBackText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setVi('loading'); setEn('loading')
    lookupViDictionary(word).then(r => {
      setVi(r)
      // Gợi ý mặt sau thẻ: dòng nghĩa đầu tiên của từ điển VI
      if (r) setBackText(r.content.split('\n').find(l => l.startsWith('-'))?.replace(/^-\s*/, '') ?? r.content.slice(0, 120))
    })
    lookupEnDictionary(word).then(setEn)
    getDecks().then(d => {
      setDecks(d)
      if (d.length && !d.some(x => x.id === window.localStorage.getItem(LAST_DECK_KEY))) setDeckId(d[0].id)
    })
  }, [word])

  const ipa = useMemo(() => {
    if (vi !== 'loading' && vi?.pronunciation) return vi.pronunciation
    if (en !== 'loading' && en?.phonetic) return en.phonetic
    return null
  }, [vi, en])

  const playAudio = () => {
    if (en !== 'loading' && en?.audioUrl) new Audio(en.audioUrl).play()
    else {
      const u = new SpeechSynthesisUtterance(word)
      u.lang = 'en-US'
      window.speechSynthesis.speak(u)
    }
  }

  const handleSave = async () => {
    if (!deckId || !backText.trim()) return
    setSaving(true)
    try {
      await createCard(deckId, {
        front_text: word,
        back_text: backText.trim(),
        example_sentence: sentence,
        pronunciation: ipa ?? undefined,
        definition: en !== 'loading' ? en?.meanings[0]?.definitions[0] : undefined,
        audio_url: en !== 'loading' ? en?.audioUrl ?? undefined : undefined,
      })
      window.localStorage.setItem(LAST_DECK_KEY, deckId)
      toast(`Đã lưu "${word}" vào bộ thẻ`, 'success')
      onClose()
    } catch (e: any) {
      toast(e?.response?.data?.detail ?? 'Không lưu được thẻ', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 sm:inset-auto sm:right-6 sm:top-24 sm:w-96">
      <div className="max-h-[70vh] overflow-y-auto rounded-t-2xl border border-white/10 bg-slate-900/95 p-5 shadow-2xl backdrop-blur-xl sm:rounded-2xl">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 className="text-xl font-black text-white">{word}</h3>
            <p className="text-sm text-cyan-300">
              {ipa ?? ''}{' '}
              <button onClick={playAudio} className="ml-1 rounded px-1 hover:bg-white/10" title="Phát âm">🔊</button>
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-400 hover:bg-white/10 hover:text-white">✕</button>
        </div>

        <div className="space-y-3 text-sm">
          <section>
            <h4 className="mb-1 text-xs font-black uppercase text-slate-500">🇻🇳 Anh - Việt</h4>
            {vi === 'loading' ? <p className="animate-pulse text-slate-500">Đang tra…</p>
              : vi ? <pre className="whitespace-pre-wrap font-sans text-slate-200">{vi.content}</pre>
              : <p className="text-slate-500">Không có trong từ điển.</p>}
          </section>
          <section>
            <h4 className="mb-1 text-xs font-black uppercase text-slate-500">🇬🇧 English</h4>
            {en === 'loading' ? <p className="animate-pulse text-slate-500">Đang tra…</p>
              : en ? (
                <div className="space-y-1 text-slate-200">
                  {en.meanings.map((m, i) => (
                    <p key={i}><em className="text-slate-400">{m.partOfSpeech}.</em> {m.definitions.join(' · ')}</p>
                  ))}
                </div>
              ) : <p className="text-slate-500">Không tìm thấy.</p>}
          </section>
          <section className="rounded-xl bg-black/25 p-3">
            <p className="text-xs italic text-slate-400">"{sentence}"</p>
          </section>
        </div>

        <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
          <div className="flex gap-2">
            <select value={deckId} onChange={e => setDeckId(e.target.value)} className="flex-1 rounded-xl border border-white/10 bg-black/30 px-2 py-2 text-sm text-white">
              {decks.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <input
            value={backText}
            onChange={e => setBackText(e.target.value)}
            placeholder="Nghĩa (mặt sau thẻ)"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-500"
          />
          <button
            onClick={handleSave}
            disabled={saving || !deckId || !backText.trim()}
            className="w-full rounded-xl border border-emerald-300/25 bg-emerald-400/10 py-2 text-sm font-bold text-emerald-200 transition hover:bg-emerald-400/20 disabled:opacity-40"
          >
            {saving ? 'Đang lưu…' : '💾 Lưu vào bộ thẻ (kèm câu ngữ cảnh)'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement `frontend/src/pages/ReaderPage.tsx`**

```tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getArticle } from '../api/articles'
import WordPopup from '../components/reader/WordPopup'
import type { Article } from '../types'

/** Tách câu chứa từ tại vị trí wordIndex trong đoạn văn. */
export function extractSentence(paragraph: string, charIndex: number): string {
  const sentences = paragraph.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [paragraph]
  let pos = 0
  for (const s of sentences) {
    pos += s.length
    if (charIndex < pos) return s.trim()
  }
  return sentences[sentences.length - 1]?.trim() ?? paragraph
}

const cleanToken = (t: string) => t.replace(/^[^A-Za-z']+|[^A-Za-z']+$/g, '')

interface TtsState { playing: boolean; sentenceIdx: number }

export default function ReaderPage() {
  const { id } = useParams<{ id: string }>()
  const [article, setArticle] = useState<Article | null>(null)
  const [picked, setPicked] = useState<{ word: string; sentence: string } | null>(null)
  const [rate, setRate] = useState(1)
  const [tts, setTts] = useState<TtsState>({ playing: false, sentenceIdx: -1 })
  const stopRequested = useRef(false)

  useEffect(() => {
    if (id) getArticle(id).then(setArticle)
    return () => window.speechSynthesis.cancel()
  }, [id])

  const paragraphs = useMemo(() => article?.content.split(/\n\n+/).filter(p => p.trim()) ?? [], [article])
  const allSentences = useMemo(
    () => paragraphs.flatMap(p => p.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [p]).map(s => s.trim()).filter(Boolean),
    [paragraphs],
  )

  const speakFrom = (startIdx: number) => {
    window.speechSynthesis.cancel()
    stopRequested.current = false
    const speakNext = (i: number) => {
      if (stopRequested.current || i >= allSentences.length) {
        setTts({ playing: false, sentenceIdx: -1 })
        return
      }
      setTts({ playing: true, sentenceIdx: i })
      const u = new SpeechSynthesisUtterance(allSentences[i])
      u.lang = 'en-US'
      u.rate = rate
      u.onend = () => speakNext(i + 1)
      u.onerror = () => setTts({ playing: false, sentenceIdx: -1 })
      window.speechSynthesis.speak(u)
    }
    speakNext(startIdx)
  }

  const stopTts = () => {
    stopRequested.current = true
    window.speechSynthesis.cancel()
    setTts({ playing: false, sentenceIdx: -1 })
  }

  if (!article) {
    return <div className="mx-auto max-w-3xl px-4 py-8"><div className="h-64 animate-pulse rounded-2xl bg-white/[0.05]" /></div>
  }

  let sentenceCounter = -1

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 pb-40">
      <Link to="/reader" className="text-sm text-slate-400 hover:text-cyan-300">← Danh sách bài đọc</Link>
      <h1 className="mt-2 text-2xl font-black text-white">{article.title}</h1>
      <p className="mb-6 mt-1 text-xs text-slate-500">
        {article.word_count} từ
        {article.source_url && <> · <a href={article.source_url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">nguồn</a></>}
      </p>

      {/* Thanh TTS */}
      <div className="sticky top-20 z-10 mb-6 flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-slate-900/90 p-2 backdrop-blur">
        {tts.playing
          ? <button onClick={stopTts} className="rounded-xl bg-rose-400/10 px-4 py-2 text-sm font-bold text-rose-300">⏹ Dừng</button>
          : <button onClick={() => speakFrom(0)} className="rounded-xl bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-300">▶ Đọc bài</button>}
        <span className="text-xs text-slate-500">Tốc độ:</span>
        {[0.75, 1, 1.25].map(r => (
          <button
            key={r}
            onClick={() => setRate(r)}
            className={`rounded-lg px-2 py-1 text-xs font-bold ${rate === r ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}
          >
            {r}x
          </button>
        ))}
        <span className="ml-auto hidden text-xs text-slate-500 sm:block">💡 Click từ bất kỳ để tra nghĩa</span>
      </div>

      <article className="space-y-4 text-[17px] leading-8 text-slate-200">
        {paragraphs.map((para, pi) => {
          const paraSentences = para.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [para]
          return (
            <p key={pi}>
              {paraSentences.map((sentence, si) => {
                sentenceCounter += 1
                const globalIdx = sentenceCounter
                const highlighted = tts.sentenceIdx === globalIdx
                return (
                  <span key={si} className={highlighted ? 'rounded bg-cyan-400/15' : undefined}>
                    {sentence.split(/(\s+)/).map((token, ti) => {
                      const clean = cleanToken(token)
                      if (!clean || /^\s+$/.test(token)) return token
                      return (
                        <span
                          key={ti}
                          onClick={() => setPicked({ word: clean.toLowerCase(), sentence: sentence.trim() })}
                          className="cursor-pointer rounded-sm transition hover:bg-cyan-400/20"
                        >
                          {token}
                        </span>
                      )
                    })}{' '}
                  </span>
                )
              })}
            </p>
          )
        })}
      </article>

      {picked && <WordPopup word={picked.word} sentence={picked.sentence} onClose={() => setPicked(null)} />}
    </div>
  )
}
```

- [ ] **Step 3: Verify bằng dev server**

- Mở 1 bài đã tạo: text hiện theo đoạn, hover từ có highlight.
- Click từ (vd "container"): popup hiện IPA + nghĩa VI (từ điển đã nạp Task 4 Step 5) + nghĩa EN; nút 🔊 phát âm.
- Chọn deck, sửa nghĩa, Lưu → mở deck xác nhận thẻ mới có example = đúng câu trong bài, có pronunciation/definition/audio.
- Lưu từ trùng trong cùng deck → toast lỗi duplicate từ backend.
- ▶ Đọc bài: câu đang đọc được highlight, đổi tốc độ, ⏹ dừng được. Chuyển trang khi đang đọc → TTS tự dừng (cleanup).
- Reload popup từ đã tra → Network không gọi lại dictionaryapi.dev (cache localStorage).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/ReaderPage.tsx frontend/src/components/reader
git commit -m "feat: reader page with click-to-lookup popup, save-to-deck, sentence TTS"
```

---

### Task 9: Verify end-to-end M2 + docs

- [ ] **Step 1: Full backend suite + FE build**

Run: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest tests -v` (cwd backend) và `npm run build` (cwd frontend).
Expected: PASS / build sạch.

- [ ] **Step 2: Smoke E2E qua dev server**

Flow đầy đủ: tạo bài từ URL thật → đọc → tra 3 từ → lưu 2 từ vào deck → vào Review học thẻ vừa lưu → StatsPage reviewed_today tăng.

- [ ] **Step 3: Cập nhật README (mục Features + Quick Start thêm bước nạp từ điển) + commit**

```bash
git add README.md
git commit -m "docs: tech reader usage + dictionary import step"
```

## Ghi chú triển khai prod (thao tác tay sau merge M2)

1. Deploy backend (bảng `articles`, `dictionary_entries` tự tạo).
2. Nạp từ điển lên Supabase từ máy local: `set DATABASE_URL=<supabase-url>` → `python scripts/import_dictionary.py data/dictionaries/anhviet.txt` (~1-2 phút, chạy 1 lần duy nhất).
