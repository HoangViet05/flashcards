# Phase 3 — RAG & PDF-Grounded Card Generation: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable users to upload scientific PDFs, extract and embed their content, then generate vocabulary flashcards with example sentences cited directly from the paper.

**Architecture:** Monolith + BackgroundTasks approach — PDF processing runs in FastAPI background tasks, text is chunked and embedded into ChromaDB, RAG pipeline retrieves relevant chunks to ground LLM card generation. Strategy pattern for swappable PDF extractors, configurable embedding providers (Ollama/OpenAI).

**Tech Stack:** FastAPI, SQLAlchemy, ChromaDB, PyMuPDF, pdfplumber, tiktoken, Ollama/OpenAI embeddings, React 19, Vite, TypeScript

---

## File Map

### Backend — New Files
- `backend/app/models/document.py` — Document ORM model
- `backend/app/schemas/document.py` — Pydantic request/response schemas for documents
- `backend/app/routers/documents.py` — All document API endpoints
- `backend/app/services/extractors/__init__.py` — Extractor registry
- `backend/app/services/extractors/base.py` — BaseExtractor ABC + data schemas
- `backend/app/services/extractors/pymupdf_extractor.py` — PyMuPDF implementation
- `backend/app/services/extractors/pdfplumber_extractor.py` — pdfplumber implementation
- `backend/app/services/chunk_service.py` — Text chunking with token counting
- `backend/app/services/embedding_service.py` — Ollama/OpenAI embedding provider
- `backend/app/services/rag_service.py` — RAG pipeline (retrieve + generate)
- `backend/tests/test_extractors.py` — Tests for PDF extractors
- `backend/tests/test_chunk_service.py` — Tests for chunking
- `backend/tests/test_embedding_service.py` — Tests for embedding service
- `backend/tests/test_documents.py` — Integration tests for document endpoints
- `backend/tests/test_rag_service.py` — Tests for RAG pipeline
- `backend/uploads/` — PDF file storage directory

### Backend — Modified Files
- `backend/requirements.txt` — Add new dependencies
- `backend/app/main.py` — Register documents router
- `backend/app/models/__init__.py` — Import Document model

### Frontend — New Files
- `frontend/src/api/documents.ts` — Document API client
- `frontend/src/pages/DocumentsPage.tsx` — Document library page
- `frontend/src/pages/DocumentDetailPage.tsx` — Document detail + gen + search

### Frontend — Modified Files
- `frontend/src/types/index.ts` — Add Document type
- `frontend/src/components/Navbar.tsx` — Add "Documents" nav item
- `frontend/src/App.tsx` — Add document routes

---

## Task 1: Install Dependencies & Create uploads Directory

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/uploads/.gitkeep`

- [ ] **Step 1: Add new Python dependencies**

Add to `backend/requirements.txt`:

```
chromadb
pymupdf
pdfplumber
python-multipart
tiktoken
```

- [ ] **Step 2: Create uploads directory**

```bash
mkdir -p backend/uploads
touch backend/uploads/.gitkeep
```

- [ ] **Step 3: Add uploads to .gitignore**

Add to `.gitignore`:

```
backend/uploads/*.pdf
```

- [ ] **Step 4: Install dependencies**

```bash
cd backend
pip install -r requirements.txt
```

Expected: All packages install successfully.

- [ ] **Step 5: Commit**

```bash
git add backend/requirements.txt backend/uploads/.gitkeep .gitignore
git commit -m "feat: add Phase 3 dependencies and uploads directory"
```

---

## Task 2: Document Model & Schema

**Files:**
- Create: `backend/app/models/document.py`
- Create: `backend/app/schemas/document.py`
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: Write the Document ORM model**

Create `backend/app/models/document.py`:

```python
import uuid
from datetime import datetime
from sqlalchemy import String, Text, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    filename: Mapped[str] = mapped_column(String(500), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="uploading")
    extractor_used: Mapped[str] = mapped_column(String(50), default="pymupdf")
    page_count: Mapped[int] = mapped_column(Integer, default=0)
    chunk_count: Mapped[int] = mapped_column(Integer, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

- [ ] **Step 2: Register model in __init__**

Modify `backend/app/models/__init__.py` — add:

```python
from app.models.document import Document
```

- [ ] **Step 3: Write Pydantic schemas**

Create `backend/app/schemas/document.py`:

```python
from pydantic import BaseModel
from datetime import datetime


class DocumentOut(BaseModel):
    id: str
    filename: str
    status: str
    extractor_used: str
    page_count: int
    chunk_count: int
    error_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DocumentGenerateRequest(BaseModel):
    topic: str
    count: int = 5
    deck_id: str
    excluded_words: list[str] = []
    top_k: int = 10
```

- [ ] **Step 4: Verify model loads with app**

```bash
cd backend
python -c "from app.models.document import Document; print('Document model OK')"
python -c "from app.schemas.document import DocumentOut, DocumentGenerateRequest; print('Schemas OK')"
```

Expected: Both print OK without errors.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/document.py backend/app/models/__init__.py backend/app/schemas/document.py
git commit -m "feat: add Document model and Pydantic schemas"
```

---

## Task 3: PDF Extractors — Strategy Pattern

**Files:**
- Create: `backend/app/services/extractors/__init__.py`
- Create: `backend/app/services/extractors/base.py`
- Create: `backend/app/services/extractors/pymupdf_extractor.py`
- Create: `backend/app/services/extractors/pdfplumber_extractor.py`
- Create: `backend/tests/test_extractors.py`

- [ ] **Step 1: Write base extractor interface**

Create `backend/app/services/extractors/base.py`:

```python
from abc import ABC, abstractmethod
from pydantic import BaseModel


class PageContent(BaseModel):
    page_number: int
    text: str


class ExtractedDocument(BaseModel):
    pages: list[PageContent]
    total_pages: int
    metadata: dict = {}


class BaseExtractor(ABC):
    @abstractmethod
    def extract(self, file_path: str) -> ExtractedDocument:
        """Extract text and metadata from a PDF file."""
```

- [ ] **Step 2: Write PyMuPDF extractor**

Create `backend/app/services/extractors/pymupdf_extractor.py`:

```python
import fitz
from .base import BaseExtractor, ExtractedDocument, PageContent


class PyMuPDFExtractor(BaseExtractor):
    def extract(self, file_path: str) -> ExtractedDocument:
        doc = fitz.open(file_path)
        pages = []
        for i, page in enumerate(doc):
            text = page.get_text()
            if text.strip():
                pages.append(PageContent(page_number=i + 1, text=text))
        metadata = dict(doc.metadata) if doc.metadata else {}
        total_pages = len(doc)
        doc.close()
        return ExtractedDocument(pages=pages, total_pages=total_pages, metadata=metadata)
```

- [ ] **Step 3: Write pdfplumber extractor**

Create `backend/app/services/extractors/pdfplumber_extractor.py`:

```python
import pdfplumber
from .base import BaseExtractor, ExtractedDocument, PageContent


class PdfPlumberExtractor(BaseExtractor):
    def extract(self, file_path: str) -> ExtractedDocument:
        pages = []
        total_pages = 0
        metadata = {}
        with pdfplumber.open(file_path) as pdf:
            total_pages = len(pdf.pages)
            metadata = pdf.metadata or {}
            for i, page in enumerate(pdf.pages):
                text = page.extract_text() or ""
                if text.strip():
                    pages.append(PageContent(page_number=i + 1, text=text))
        return ExtractedDocument(pages=pages, total_pages=total_pages, metadata=metadata)
```

- [ ] **Step 4: Write extractor registry**

Create `backend/app/services/extractors/__init__.py`:

```python
from .base import BaseExtractor, ExtractedDocument, PageContent
from .pymupdf_extractor import PyMuPDFExtractor
from .pdfplumber_extractor import PdfPlumberExtractor

EXTRACTOR_REGISTRY: dict[str, type[BaseExtractor]] = {
    "pymupdf": PyMuPDFExtractor,
    "pdfplumber": PdfPlumberExtractor,
}


def get_extractor(name: str = "pymupdf") -> BaseExtractor:
    cls = EXTRACTOR_REGISTRY.get(name)
    if not cls:
        raise ValueError(f"Unknown extractor: {name}. Available: {list(EXTRACTOR_REGISTRY.keys())}")
    return cls()
```

- [ ] **Step 5: Write tests for extractors**

Create `backend/tests/test_extractors.py`:

```python
import os
import pytest
from app.services.extractors import get_extractor, EXTRACTOR_REGISTRY
from app.services.extractors.base import ExtractedDocument

# Create a minimal test PDF using PyMuPDF
import fitz

@pytest.fixture
def sample_pdf(tmp_path):
    """Create a simple 2-page PDF for testing."""
    path = str(tmp_path / "test.pdf")
    doc = fitz.open()
    page1 = doc.new_page()
    page1.insert_text((72, 72), "Machine learning is a subset of artificial intelligence.")
    page2 = doc.new_page()
    page2.insert_text((72, 72), "Neural networks are inspired by the human brain.")
    doc.save(path)
    doc.close()
    return path


def test_get_extractor_pymupdf():
    ext = get_extractor("pymupdf")
    assert ext is not None


def test_get_extractor_pdfplumber():
    ext = get_extractor("pdfplumber")
    assert ext is not None


def test_get_extractor_unknown():
    with pytest.raises(ValueError, match="Unknown extractor"):
        get_extractor("nonexistent")


def test_pymupdf_extract(sample_pdf):
    ext = get_extractor("pymupdf")
    result = ext.extract(sample_pdf)
    assert isinstance(result, ExtractedDocument)
    assert result.total_pages == 2
    assert len(result.pages) == 2
    assert "machine learning" in result.pages[0].text.lower()
    assert result.pages[0].page_number == 1


def test_pdfplumber_extract(sample_pdf):
    ext = get_extractor("pdfplumber")
    result = ext.extract(sample_pdf)
    assert isinstance(result, ExtractedDocument)
    assert result.total_pages == 2
    assert len(result.pages) >= 1
    assert result.pages[0].page_number == 1
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd backend
pytest tests/test_extractors.py -v
```

Expected: All 5 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/extractors/ backend/tests/test_extractors.py
git commit -m "feat: add PDF extractors with strategy pattern (PyMuPDF, pdfplumber)"
```

---

## Task 4: Chunk Service

**Files:**
- Create: `backend/app/services/chunk_service.py`
- Create: `backend/tests/test_chunk_service.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_chunk_service.py`:

```python
from app.services.chunk_service import ChunkService, Chunk


def test_chunk_single_page():
    service = ChunkService(chunk_size=50, overlap=10)
    pages = [{"page_number": 1, "text": "Word " * 100}]
    chunks = service.chunk_pages(pages)
    assert len(chunks) > 1
    assert all(isinstance(c, Chunk) for c in chunks)
    assert all(c.page_number == 1 for c in chunks)


def test_chunk_preserves_page_number():
    service = ChunkService(chunk_size=50, overlap=10)
    pages = [
        {"page_number": 1, "text": "First page content. " * 30},
        {"page_number": 2, "text": "Second page content. " * 30},
    ]
    chunks = service.chunk_pages(pages)
    page_numbers = [c.page_number for c in chunks]
    assert 1 in page_numbers
    assert 2 in page_numbers


def test_chunk_short_text_single_chunk():
    service = ChunkService(chunk_size=500, overlap=50)
    pages = [{"page_number": 1, "text": "Short text."}]
    chunks = service.chunk_pages(pages)
    assert len(chunks) == 1
    assert chunks[0].text == "Short text."
    assert chunks[0].page_number == 1


def test_chunk_index_increments():
    service = ChunkService(chunk_size=50, overlap=10)
    pages = [{"page_number": 1, "text": "Word " * 100}]
    chunks = service.chunk_pages(pages)
    indices = [c.chunk_index for c in chunks]
    assert indices == list(range(len(chunks)))
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
pytest tests/test_chunk_service.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.chunk_service'`

- [ ] **Step 3: Write chunk service implementation**

Create `backend/app/services/chunk_service.py`:

```python
import tiktoken
from pydantic import BaseModel


class Chunk(BaseModel):
    text: str
    page_number: int
    chunk_index: int


class ChunkService:
    def __init__(self, chunk_size: int = 500, overlap: int = 50):
        self.chunk_size = chunk_size
        self.overlap = overlap
        self.encoder = tiktoken.get_encoding("cl100k_base")

    def _token_count(self, text: str) -> int:
        return len(self.encoder.encode(text))

    def _split_text(self, text: str, page_number: int, start_index: int) -> list[Chunk]:
        """Split text into chunks respecting sentence boundaries."""
        sentences = []
        for s in text.replace("\n", " ").split(". "):
            s = s.strip()
            if s:
                sentences.append(s if s.endswith(".") else s + ".")

        chunks = []
        current_sentences: list[str] = []
        current_tokens = 0

        for sentence in sentences:
            sentence_tokens = self._token_count(sentence)

            if current_tokens + sentence_tokens > self.chunk_size and current_sentences:
                chunk_text = " ".join(current_sentences)
                chunks.append(Chunk(
                    text=chunk_text,
                    page_number=page_number,
                    chunk_index=start_index + len(chunks),
                ))
                # Keep overlap: retain last few sentences
                overlap_sentences: list[str] = []
                overlap_tokens = 0
                for s in reversed(current_sentences):
                    t = self._token_count(s)
                    if overlap_tokens + t > self.overlap:
                        break
                    overlap_sentences.insert(0, s)
                    overlap_tokens += t
                current_sentences = overlap_sentences
                current_tokens = overlap_tokens

            current_sentences.append(sentence)
            current_tokens += sentence_tokens

        if current_sentences:
            chunk_text = " ".join(current_sentences)
            chunks.append(Chunk(
                text=chunk_text,
                page_number=page_number,
                chunk_index=start_index + len(chunks),
            ))

        return chunks

    def chunk_pages(self, pages: list[dict]) -> list[Chunk]:
        """Chunk a list of pages. Each page is {page_number: int, text: str}."""
        all_chunks: list[Chunk] = []
        for page in pages:
            page_chunks = self._split_text(
                page["text"],
                page["page_number"],
                start_index=len(all_chunks),
            )
            all_chunks.extend(page_chunks)
        return all_chunks
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
pytest tests/test_chunk_service.py -v
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/chunk_service.py backend/tests/test_chunk_service.py
git commit -m "feat: add ChunkService with token-based splitting and overlap"
```

---

## Task 5: Embedding Service

**Files:**
- Create: `backend/app/services/embedding_service.py`
- Create: `backend/tests/test_embedding_service.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_embedding_service.py`:

```python
import pytest
from unittest.mock import patch, MagicMock
from app.services.embedding_service import EmbeddingService


def test_init_ollama():
    service = EmbeddingService(provider="ollama", model="nomic-embed-text")
    assert service.provider == "ollama"
    assert service.model == "nomic-embed-text"


def test_init_openai():
    service = EmbeddingService(provider="openai", model="text-embedding-3-small")
    assert service.provider == "openai"


def test_init_invalid_provider():
    with pytest.raises(ValueError, match="Unknown provider"):
        EmbeddingService(provider="unknown", model="test")


@patch("app.services.embedding_service.ollama")
def test_embed_ollama(mock_ollama):
    mock_ollama.embed.return_value = {"embeddings": [[0.1, 0.2, 0.3], [0.4, 0.5, 0.6]]}
    service = EmbeddingService(provider="ollama", model="nomic-embed-text")
    result = service.embed(["hello", "world"])
    assert len(result) == 2
    assert result[0] == [0.1, 0.2, 0.3]
    mock_ollama.embed.assert_called_once_with(model="nomic-embed-text", input=["hello", "world"])


@patch("app.services.embedding_service.OpenAI")
def test_embed_openai(mock_openai_cls):
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_embedding_1 = MagicMock()
    mock_embedding_1.embedding = [0.1, 0.2]
    mock_embedding_2 = MagicMock()
    mock_embedding_2.embedding = [0.3, 0.4]
    mock_client.embeddings.create.return_value.data = [mock_embedding_1, mock_embedding_2]

    service = EmbeddingService(provider="openai", model="text-embedding-3-small")
    result = service.embed(["hello", "world"])
    assert len(result) == 2
    assert result[0] == [0.1, 0.2]
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
pytest tests/test_embedding_service.py -v
```

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Write embedding service implementation**

Create `backend/app/services/embedding_service.py`:

```python
import os
import logging
import ollama
from openai import OpenAI

logger = logging.getLogger(__name__)

VALID_PROVIDERS = ("ollama", "openai")


class EmbeddingService:
    def __init__(
        self,
        provider: str | None = None,
        model: str | None = None,
    ):
        self.provider = provider or os.getenv("EMBEDDING_PROVIDER", "ollama")
        self.model = model or os.getenv("EMBEDDING_MODEL", "nomic-embed-text")

        if self.provider not in VALID_PROVIDERS:
            raise ValueError(f"Unknown provider: {self.provider}. Available: {list(VALID_PROVIDERS)}")

        if self.provider == "openai":
            api_key = os.getenv("OPENAI_API_KEY")
            self.model = model or os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small")
            self._openai_client = OpenAI(api_key=api_key)

    def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of texts, return list of vectors."""
        if self.provider == "ollama":
            return self._embed_ollama(texts)
        else:
            return self._embed_openai(texts)

    def _embed_ollama(self, texts: list[str]) -> list[list[float]]:
        response = ollama.embed(model=self.model, input=texts)
        return response["embeddings"]

    def _embed_openai(self, texts: list[str]) -> list[list[float]]:
        response = self._openai_client.embeddings.create(model=self.model, input=texts)
        return [item.embedding for item in response.data]


# Singleton instance — initialized from env vars
embedding_service = EmbeddingService()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
pytest tests/test_embedding_service.py -v
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/embedding_service.py backend/tests/test_embedding_service.py
git commit -m "feat: add EmbeddingService with Ollama and OpenAI providers"
```

---

## Task 6: Document Router — Upload, List, Detail, Delete

**Files:**
- Create: `backend/app/routers/documents.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_documents.py`

- [ ] **Step 1: Write integration tests**

Create `backend/tests/test_documents.py`:

```python
import io
import fitz
import pytest


@pytest.fixture
def sample_pdf_bytes():
    """Create a minimal PDF as bytes for upload testing."""
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Artificial intelligence is transforming the world.")
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def test_upload_document(client, sample_pdf_bytes):
    response = client.post(
        "/api/documents/upload?extractor=pymupdf",
        files={"file": ("test.pdf", io.BytesIO(sample_pdf_bytes), "application/pdf")},
    )
    assert response.status_code == 202
    data = response.json()
    assert data["filename"] == "test.pdf"
    assert data["status"] in ("uploading", "processing", "ready")
    assert data["extractor_used"] == "pymupdf"


def test_list_documents(client, sample_pdf_bytes):
    # Upload one document first
    client.post(
        "/api/documents/upload",
        files={"file": ("test.pdf", io.BytesIO(sample_pdf_bytes), "application/pdf")},
    )
    response = client.get("/api/documents")
    assert response.status_code == 200
    docs = response.json()
    assert len(docs) >= 1


def test_get_document(client, sample_pdf_bytes):
    upload = client.post(
        "/api/documents/upload",
        files={"file": ("test.pdf", io.BytesIO(sample_pdf_bytes), "application/pdf")},
    )
    doc_id = upload.json()["id"]
    response = client.get(f"/api/documents/{doc_id}")
    assert response.status_code == 200
    assert response.json()["id"] == doc_id


def test_get_document_not_found(client):
    response = client.get("/api/documents/nonexistent-id")
    assert response.status_code == 404


def test_delete_document(client, sample_pdf_bytes):
    upload = client.post(
        "/api/documents/upload",
        files={"file": ("test.pdf", io.BytesIO(sample_pdf_bytes), "application/pdf")},
    )
    doc_id = upload.json()["id"]
    response = client.delete(f"/api/documents/{doc_id}")
    assert response.status_code == 200

    # Verify deleted
    response = client.get(f"/api/documents/{doc_id}")
    assert response.status_code == 404


def test_upload_non_pdf(client):
    response = client.post(
        "/api/documents/upload",
        files={"file": ("test.txt", io.BytesIO(b"not a pdf"), "text/plain")},
    )
    assert response.status_code == 400


def test_upload_invalid_extractor(client, sample_pdf_bytes):
    response = client.post(
        "/api/documents/upload?extractor=nonexistent",
        files={"file": ("test.pdf", io.BytesIO(sample_pdf_bytes), "application/pdf")},
    )
    assert response.status_code == 400
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
pytest tests/test_documents.py -v
```

Expected: FAIL — route not found (404 for all).

- [ ] **Step 3: Write document router**

Create `backend/app/routers/documents.py`:

```python
import os
import uuid
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.document import Document
from app.schemas.document import DocumentOut
from app.services.extractors import get_extractor, EXTRACTOR_REGISTRY

logger = logging.getLogger(__name__)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

router = APIRouter(prefix="/api/documents", tags=["documents"])


def process_document(document_id: str, file_path: str, extractor_name: str):
    """Background task: extract PDF, chunk, embed into ChromaDB."""
    from app.database import SessionLocal
    from app.services.chunk_service import ChunkService
    from app.services.embedding_service import embedding_service
    import chromadb

    db = SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            return
        doc.status = "processing"
        db.commit()

        # Extract
        extractor = get_extractor(extractor_name)
        extracted = extractor.extract(file_path)
        doc.page_count = extracted.total_pages

        # Chunk
        chunk_service = ChunkService()
        pages_data = [{"page_number": p.page_number, "text": p.text} for p in extracted.pages]
        chunks = chunk_service.chunk_pages(pages_data)
        doc.chunk_count = len(chunks)

        if not chunks:
            doc.status = "ready"
            db.commit()
            return

        # Embed & store in ChromaDB
        chroma_client = chromadb.PersistentClient(path=os.path.join(UPLOAD_DIR, ".chromadb"))
        collection_name = f"doc_{document_id}"
        collection = chroma_client.get_or_create_collection(name=collection_name)

        # Batch embed (20 at a time)
        batch_size = 20
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i + batch_size]
            texts = [c.text for c in batch]
            embeddings = embedding_service.embed(texts)
            collection.add(
                ids=[f"chunk_{c.chunk_index:04d}" for c in batch],
                documents=texts,
                embeddings=embeddings,
                metadatas=[{
                    "document_id": document_id,
                    "page_number": c.page_number,
                    "chunk_index": c.chunk_index,
                    "source": doc.filename,
                } for c in batch],
            )

        doc.status = "ready"
        db.commit()
        logger.info(f"Document {document_id} processed: {doc.page_count} pages, {doc.chunk_count} chunks")

    except Exception as e:
        logger.error(f"Error processing document {document_id}: {e}")
        doc = db.query(Document).filter(Document.id == document_id).first()
        if doc:
            doc.status = "error"
            doc.error_message = str(e)
            db.commit()
    finally:
        db.close()


@router.post("/upload", response_model=DocumentOut, status_code=202)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    extractor: str = "pymupdf",
    db: Session = Depends(get_db),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    if extractor not in EXTRACTOR_REGISTRY:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown extractor: {extractor}. Available: {list(EXTRACTOR_REGISTRY.keys())}",
        )

    doc_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")

    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    document = Document(
        id=doc_id,
        filename=file.filename,
        file_path=file_path,
        status="uploading",
        extractor_used=extractor,
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    background_tasks.add_task(process_document, doc_id, file_path, extractor)

    return document


@router.get("", response_model=list[DocumentOut])
def list_documents(db: Session = Depends(get_db)):
    return db.query(Document).order_by(Document.created_at.desc()).all()


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(document_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.delete("/{document_id}", response_model=DocumentOut)
def delete_document(document_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete PDF file
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)

    # Delete ChromaDB collection
    try:
        import chromadb
        chroma_client = chromadb.PersistentClient(path=os.path.join(UPLOAD_DIR, ".chromadb"))
        chroma_client.delete_collection(f"doc_{document_id}")
    except Exception:
        pass  # Collection may not exist yet

    db.delete(doc)
    db.commit()
    return doc
```

- [ ] **Step 4: Register router in main.py**

Modify `backend/app/main.py` — add import and include:

```python
from app.routers import decks, cards, review, ai, documents
```

```python
app.include_router(documents.router)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend
pytest tests/test_documents.py -v
```

Expected: All 7 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/documents.py backend/app/main.py backend/tests/test_documents.py
git commit -m "feat: add document CRUD endpoints with background PDF processing"
```

---

## Task 7: RAG Service — Retrieve + Generate Cards

**Files:**
- Create: `backend/app/services/rag_service.py`
- Create: `backend/tests/test_rag_service.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_rag_service.py`:

```python
from unittest.mock import patch, MagicMock
from app.services.rag_service import RAGService


@patch("app.services.rag_service.embedding_service")
@patch("app.services.rag_service.chromadb")
def test_retrieve_chunks(mock_chromadb, mock_embed):
    mock_embed.embed.return_value = [[0.1, 0.2, 0.3]]

    mock_collection = MagicMock()
    mock_collection.query.return_value = {
        "documents": [["chunk text 1", "chunk text 2"]],
        "metadatas": [[
            {"page_number": 1, "chunk_index": 0, "source": "test.pdf"},
            {"page_number": 2, "chunk_index": 1, "source": "test.pdf"},
        ]],
        "distances": [[0.1, 0.2]],
    }
    mock_client = MagicMock()
    mock_client.get_collection.return_value = mock_collection
    mock_chromadb.PersistentClient.return_value = mock_client

    service = RAGService()
    chunks = service.retrieve_chunks("doc_123", "machine learning", top_k=5)
    assert len(chunks) == 2
    assert chunks[0]["text"] == "chunk text 1"
    assert chunks[0]["page_number"] == 1


def test_build_prompt():
    service = RAGService()
    chunks = [
        {"text": "AI is transforming healthcare.", "page_number": 1},
        {"text": "Deep learning enables image recognition.", "page_number": 3},
    ]
    prompt = service.build_prompt("artificial intelligence", chunks, ["neural"])
    assert "AI is transforming healthcare." in prompt
    assert "[Trang 1]" in prompt
    assert "artificial intelligence" in prompt
    assert "neural" in prompt
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
pytest tests/test_rag_service.py -v
```

Expected: FAIL — `ModuleNotFoundError`

- [ ] **Step 3: Write RAG service implementation**

Create `backend/app/services/rag_service.py`:

```python
import os
import logging
import chromadb
from app.services.embedding_service import embedding_service
from app.services.ai_service import AIservice, FlashcardSchema

logger = logging.getLogger(__name__)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads")


class RAGService:
    def __init__(self):
        self.chroma_client = chromadb.PersistentClient(path=os.path.join(UPLOAD_DIR, ".chromadb"))

    def retrieve_chunks(
        self, document_id: str, query: str, top_k: int = 10, threshold: float = 0.3
    ) -> list[dict]:
        """Retrieve top-K relevant chunks from a document's ChromaDB collection."""
        collection = self.chroma_client.get_collection(name=f"doc_{document_id}")
        query_embedding = embedding_service.embed([query])[0]

        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
        )

        chunks = []
        for i in range(len(results["documents"][0])):
            distance = results["distances"][0][i]
            # ChromaDB returns L2 distance by default — lower is better
            # Skip chunks that are too far from the query
            if distance > (1 - threshold) * 2:  # approximate conversion
                continue
            chunks.append({
                "text": results["documents"][0][i],
                "page_number": results["metadatas"][0][i]["page_number"],
                "chunk_index": results["metadatas"][0][i]["chunk_index"],
                "distance": distance,
            })

        # Sort by page number to preserve paper order
        chunks.sort(key=lambda c: c["page_number"])
        return chunks

    def build_prompt(self, topic: str, chunks: list[dict], excluded_words: list[str] = None) -> str:
        """Build the RAG prompt with retrieved chunks as context."""
        context_parts = []
        for chunk in chunks:
            context_parts.append(f"[Trang {chunk['page_number']}] {chunk['text']}")
        context = "\n\n".join(context_parts)

        exclusion = ""
        if excluded_words:
            exclusion = f"\nCÁC TỪ ĐÃ CÓ (không được tạo lại): {', '.join(excluded_words)}"

        return f"""Bạn là trợ lý tạo flashcard từ vựng tiếng Anh cho người học, làm việc từ bài báo khoa học.

TÀI LIỆU THAM KHẢO:
---
{context}
---

NHIỆM VỤ: Tạo flashcard từ vựng cho chủ đề "{topic}" dựa HOÀN TOÀN trên tài liệu trên.

YÊU CẦU:
- front_text: Từ vựng tiếng Anh (kèm phiên âm)
- back_text: Nghĩa tiếng Việt ngắn gọn
- example_sentence: PHẢI là câu trích dẫn trực tiếp từ tài liệu, kèm ghi chú [Trang X]
- KHÔNG ĐƯỢC bịa câu ví dụ. Nếu không tìm thấy câu phù hợp, hãy chọn từ khác.
{exclusion}

Chỉ trả về 1 chuỗi JSON duy nhất, không sinh thêm chữ nào bên ngoài JSON."""

    def generate_card_from_document(
        self, document_id: str, topic: str, excluded_words: list[str] = None, top_k: int = 10
    ) -> dict | None:
        """Generate a single flashcard using RAG from a document."""
        chunks = self.retrieve_chunks(document_id, topic, top_k=top_k)
        if not chunks:
            logger.warning(f"No relevant chunks found for topic '{topic}' in document {document_id}")
            return None

        prompt = self.build_prompt(topic, chunks, excluded_words)

        ai = AIservice()
        try:
            response = ai.client.beta.chat.completions.parse(
                model=ai.model_name,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                response_format=FlashcardSchema,
            )
            parsed = response.choices[0].message.parsed
            return parsed.model_dump() if parsed else None
        except Exception as e:
            logger.error(f"RAG generation error: {e}")
            return None

    def generate_batch_stream(
        self, document_id: str, topic: str, count: int = 5,
        excluded_words: list[str] = None, top_k: int = 10
    ):
        """Generator: yield cards one by one for SSE streaming."""
        excluded = list(excluded_words) if excluded_words else []
        success_count = 0
        attempts = 0
        max_attempts = count * 3

        while success_count < count and attempts < max_attempts:
            attempts += 1
            card = self.generate_card_from_document(document_id, topic, excluded, top_k)

            if card and "front_text" in card:
                from app.services.ai_service import AIservice
                ai = AIservice()
                clean_word = ai._extract_clean_word(card["front_text"])

                if clean_word and clean_word not in [ai._extract_clean_word(w) for w in excluded]:
                    excluded.append(card["front_text"])
                    success_count += 1
                    card["is_duplicate"] = False
                    yield card
                else:
                    card["is_duplicate"] = True
                    yield card

        if success_count < count:
            logger.warning(f"RAG: Only generated {success_count}/{count} cards after {max_attempts} attempts")


rag_service = RAGService()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd backend
pytest tests/test_rag_service.py -v
```

Expected: All 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/rag_service.py backend/tests/test_rag_service.py
git commit -m "feat: add RAGService with chunk retrieval and grounded card generation"
```

---

## Task 8: Generate & Search Endpoints

**Files:**
- Modify: `backend/app/routers/documents.py`

- [ ] **Step 1: Add generate endpoint to documents router**

Add to `backend/app/routers/documents.py`:

```python
import json
from fastapi.responses import StreamingResponse
from app.schemas.document import DocumentGenerateRequest
from app.services.rag_service import rag_service


@router.post("/{document_id}/generate")
def generate_cards_from_document(
    document_id: str,
    body: DocumentGenerateRequest,
    db: Session = Depends(get_db),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.status != "ready":
        raise HTTPException(status_code=400, detail=f"Document not ready. Current status: {doc.status}")

    def event_stream():
        for card in rag_service.generate_batch_stream(
            document_id=document_id,
            topic=body.topic,
            count=body.count,
            excluded_words=body.excluded_words,
            top_k=body.top_k,
        ):
            yield f"data: {json.dumps(card, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
```

- [ ] **Step 2: Add search endpoint**

Add to `backend/app/routers/documents.py`:

```python
@router.get("/{document_id}/search")
def search_document(
    document_id: str,
    q: str = "",
    top_k: int = 5,
    db: Session = Depends(get_db),
):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.status != "ready":
        raise HTTPException(status_code=400, detail=f"Document not ready. Current status: {doc.status}")
    if not q.strip():
        raise HTTPException(status_code=400, detail="Query parameter 'q' is required")

    chunks = rag_service.retrieve_chunks(document_id, q, top_k=top_k)
    return {"query": q, "results": chunks}
```

- [ ] **Step 3: Add reindex endpoint**

Add to `backend/app/routers/documents.py`:

```python
@router.post("/reindex", status_code=202)
def reindex_all_documents(
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    docs = db.query(Document).filter(Document.status == "ready").all()
    for doc in docs:
        background_tasks.add_task(process_document, doc.id, doc.file_path, doc.extractor_used)
    return {"message": f"Re-indexing {len(docs)} documents in background"}
```

**Important:** The `reindex` endpoint must be registered BEFORE `/{document_id}` routes to avoid FastAPI treating "reindex" as a document_id. Move it above those routes in the file.

- [ ] **Step 4: Run all document tests**

```bash
cd backend
pytest tests/test_documents.py tests/test_rag_service.py -v
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/routers/documents.py
git commit -m "feat: add RAG generate, semantic search, and reindex endpoints"
```

---

## Task 9: Frontend — Document Types & API Client

**Files:**
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/api/documents.ts`

- [ ] **Step 1: Add Document type**

Add to `frontend/src/types/index.ts`:

```typescript
export interface Document {
  id: string
  filename: string
  status: 'uploading' | 'processing' | 'ready' | 'error'
  extractor_used: string
  page_count: number
  chunk_count: number
  error_message: string | null
  created_at: string
}

export interface SearchResult {
  text: string
  page_number: number
  chunk_index: number
  distance: number
}
```

- [ ] **Step 2: Write document API client**

Create `frontend/src/api/documents.ts`:

```typescript
import client from './client'
import type { Document, SearchResult } from '../types'
import type { AIGenerateResponse } from './ai'

export const uploadDocument = async (file: File, extractor: string = 'pymupdf'): Promise<Document> => {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await client.post<Document>(`/documents/upload?extractor=${extractor}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export const getDocuments = async (): Promise<Document[]> => {
  const { data } = await client.get<Document[]>('/documents')
  return data
}

export const getDocument = async (id: string): Promise<Document> => {
  const { data } = await client.get<Document>(`/documents/${id}`)
  return data
}

export const deleteDocument = async (id: string): Promise<Document> => {
  const { data } = await client.delete<Document>(`/documents/${id}`)
  return data
}

export const searchDocument = async (id: string, query: string, topK: number = 5): Promise<{ query: string, results: SearchResult[] }> => {
  const { data } = await client.get(`/documents/${id}/search`, { params: { q: query, top_k: topK } })
  return data
}

export const generateFromDocument = async (
  documentId: string,
  topic: string,
  count: number,
  deckId: string,
  excludedWords: string[] = [],
  topK: number = 10,
  onCardGenerated: (card: AIGenerateResponse) => void
): Promise<void> => {
  const response = await fetch(`/api/documents/${documentId}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      topic,
      count,
      deck_id: deckId,
      excluded_words: excludedWords,
      top_k: topK,
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to start RAG generation stream')
  }

  const reader = response.body?.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  if (reader) {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const parts = buffer.split('\n\n')
      buffer = parts.pop() || ''

      for (const part of parts) {
        if (part.startsWith('data: ')) {
          const dataStr = part.replace('data: ', '').trim()
          if (dataStr === '[DONE]') return
          try {
            const card = JSON.parse(dataStr)
            onCardGenerated(card)
          } catch (e) {
            console.error('Error parsing SSE data:', e)
          }
        }
      }
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/api/documents.ts
git commit -m "feat: add Document types and API client for frontend"
```

---

## Task 10: Frontend — DocumentsPage (Library)

**Files:**
- Create: `frontend/src/pages/DocumentsPage.tsx`

- [ ] **Step 1: Write DocumentsPage component**

Create `frontend/src/pages/DocumentsPage.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getDocuments, uploadDocument, deleteDocument } from '../api/documents'
import { useNotification } from '../components/NotificationProvider'
import type { Document } from '../types'

const STATUS_CONFIG: Record<string, { label: string; color: string; border: string; bg: string }> = {
  uploading: { label: 'Uploading...', color: 'text-yellow-300', border: 'border-yellow-500/40', bg: 'bg-yellow-500/20' },
  processing: { label: 'Processing...', color: 'text-blue-300', border: 'border-blue-500/40', bg: 'bg-blue-500/20' },
  ready: { label: 'Ready', color: 'text-emerald-300', border: 'border-emerald-500/40', bg: 'bg-emerald-500/20' },
  error: { label: 'Error', color: 'text-red-300', border: 'border-red-500/40', bg: 'bg-red-500/20' },
}

const EXTRACTORS = ['pymupdf', 'pdfplumber', 'docling']

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([])
  const [extractor, setExtractor] = useState('pymupdf')
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast, confirm } = useNotification()

  const load = async () => {
    const data = await getDocuments()
    setDocs(data)
  }

  useEffect(() => { load() }, [])

  // Poll for processing documents
  useEffect(() => {
    const hasProcessing = docs.some(d => d.status === 'uploading' || d.status === 'processing')
    if (!hasProcessing) return
    const interval = setInterval(load, 3000)
    return () => clearInterval(interval)
  }, [docs])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    try {
      await uploadDocument(file, extractor)
      toast(`Uploaded "${file.name}" — processing with ${extractor}`, 'success')
      load()
    } catch (err: any) {
      toast('Upload failed. Please try again.', 'error')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDelete = (doc: Document) => {
    confirm({
      title: 'Confirm Delete',
      message: `Delete "${doc.filename}"? This will remove the PDF and all embedded data.`,
      confirmText: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        await deleteDocument(doc.id)
        toast('Document deleted', 'success')
        load()
      },
    })
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 tracking-tight">
            Tài liệu
          </h1>
          {docs.length > 0 && (
            <p className="text-gray-500 text-sm mt-1.5 font-medium">{docs.length} tài liệu</p>
          )}
        </div>
      </div>

      {/* Upload Box */}
      <div className="mb-10 relative rounded-[2rem] p-[1px] animate-fade-in-up">
        <div className="absolute inset-0 bg-gradient-to-r from-teal-600/50 via-blue-500/30 to-cyan-500/40 opacity-70 blur-md pointer-events-none" />
        <div className="relative glass rounded-[2rem] p-6 sm:p-7 overflow-hidden bg-[#0f172a]/60 backdrop-blur-xl border border-white/10">
          <div className="flex flex-col gap-4 relative z-10">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(20,184,166,0.3)]">
                📄
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">Upload PDF</h2>
            </div>
            <p className="text-gray-400 text-sm">
              Upload a scientific paper (PDF). Choose an extraction method and the system will process it in the background.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-1">
              <select
                value={extractor}
                onChange={e => setExtractor(e.target.value)}
                className="bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3.5 text-teal-100 font-medium focus:border-teal-500/50 transition-all outline-none"
              >
                {EXTRACTORS.map(ex => (
                  <option key={ex} value={ex}>{ex}</option>
                ))}
              </select>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="btn-primary bg-teal-600 hover:bg-teal-500 px-8 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(20,184,166,0.3)] hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {isUploading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>Upload PDF 📤</>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Document Grid */}
      {docs.length === 0 ? (
        <div className="text-center py-20 animate-fade-in relative">
          <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-tr from-teal-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center text-5xl mx-auto mb-6">
            📭
          </div>
          <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 mb-2">
            No documents yet
          </h3>
          <p className="text-gray-500 max-w-sm mx-auto">Upload your first PDF to start generating flashcards from scientific papers.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map((doc, i) => {
            const status = STATUS_CONFIG[doc.status] || STATUS_CONFIG.error
            return (
              <div
                key={doc.id}
                className="glass rounded-[1.5rem] p-5 bg-gradient-to-br from-teal-500/10 to-cyan-500/5 border border-teal-500/20 hover:border-teal-500/40 hover:scale-[1.02] transition-all duration-300 animate-fade-in-up flex flex-col gap-3"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-lg shrink-0">
                      📄
                    </div>
                    <div className="min-w-0">
                      <p className="text-white font-bold text-sm truncate">{doc.filename}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{doc.extractor_used}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${status.color} ${status.border} ${status.bg} whitespace-nowrap`}>
                    {status.label}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>{doc.page_count} pages</span>
                  <span>{doc.chunk_count} chunks</span>
                </div>

                {doc.error_message && (
                  <p className="text-red-400 text-xs truncate">{doc.error_message}</p>
                )}

                <div className="flex gap-2 mt-auto pt-2">
                  {doc.status === 'ready' && (
                    <Link
                      to={`/documents/${doc.id}`}
                      className="flex-1 text-center btn-primary bg-teal-600 hover:bg-teal-500 px-4 py-2 rounded-xl text-xs font-bold"
                    >
                      Open
                    </Link>
                  )}
                  <button
                    onClick={() => handleDelete(doc)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/30 transition-all"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/DocumentsPage.tsx
git commit -m "feat: add DocumentsPage with upload, list, and delete"
```

---

## Task 11: Frontend — DocumentDetailPage

**Files:**
- Create: `frontend/src/pages/DocumentDetailPage.tsx`

- [ ] **Step 1: Write DocumentDetailPage component**

Create `frontend/src/pages/DocumentDetailPage.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getDocument, searchDocument, generateFromDocument } from '../api/documents'
import { getDecks } from '../api/decks'
import { getCards, createCard } from '../api/cards'
import { useNotification } from '../components/NotificationProvider'
import RobotAnimation from '../components/RobotAnimation'
import type { Document, Deck, SearchResult } from '../types'

type RobotAction = 'thinking' | 'add' | 'throw'

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useNotification()

  const [doc, setDoc] = useState<Document | null>(null)
  const [decks, setDecks] = useState<Deck[]>([])

  // Generate state
  const [topic, setTopic] = useState('')
  const [count, setCount] = useState(5)
  const [deckId, setDeckId] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [robotAction, setRobotAction] = useState<RobotAction>('thinking')
  const [genLog, setGenLog] = useState<string[]>([])
  const actionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    if (!id) return
    getDocument(id).then(setDoc).catch(() => navigate('/documents'))
    getDecks().then(d => {
      setDecks(d)
      if (d.length > 0) setDeckId(d[0].id)
    })
  }, [id, navigate])

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !topic.trim() || !deckId) return

    setIsGenerating(true)
    setRobotAction('thinking')
    setGenLog([])

    try {
      const existingCards = await getCards(deckId)
      const excludedWords = existingCards.map(c => c.front_text)
      let successCount = 0

      await generateFromDocument(id, topic.trim(), count, deckId, excludedWords, 10, async (card) => {
        try {
          const word = card.front_text || topic
          if (card.is_duplicate) {
            setGenLog(prev => [...prev, `🚫 Skipped duplicate: ${word}`])
            if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current)
            setRobotAction('throw')
            actionTimeoutRef.current = setTimeout(() => setRobotAction('thinking'), 1000)
          } else {
            await createCard(deckId, {
              front_text: word,
              back_text: card.back_text || '',
              example_sentence: card.example_sentence || undefined,
            })
            successCount++
            setGenLog(prev => [...prev, `✅ Created: ${word}`])
            if (actionTimeoutRef.current) clearTimeout(actionTimeoutRef.current)
            setRobotAction('add')
            actionTimeoutRef.current = setTimeout(() => setRobotAction('thinking'), 1000)
          }
        } catch (err) {
          console.warn('Error adding card:', err)
        }
      })

      if (successCount > 0) {
        toast(`Created ${successCount} cards from document for "${topic.trim()}"`, 'success')
      } else {
        toast('No cards created. Try a different topic.', 'info')
      }
    } catch (err) {
      toast('Generation failed. Check connection.', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !searchQuery.trim()) return
    setIsSearching(true)
    try {
      const data = await searchDocument(id, searchQuery.trim())
      setSearchResults(data.results)
    } catch {
      toast('Search failed.', 'error')
    } finally {
      setIsSearching(false)
    }
  }

  if (!doc) return null

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      <RobotAnimation isVisible={isGenerating} action={robotAction} />

      {/* Document Info */}
      <div className="mb-8 animate-fade-in-up">
        <button onClick={() => navigate('/documents')} className="text-gray-400 hover:text-white text-sm mb-4 inline-flex items-center gap-1 transition-colors">
          ← Back to Documents
        </button>
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 tracking-tight mb-2">
          {doc.filename}
        </h1>
        <div className="flex flex-wrap gap-3 text-sm text-gray-400">
          <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">{doc.extractor_used}</span>
          <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">{doc.page_count} pages</span>
          <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">{doc.chunk_count} chunks</span>
        </div>
      </div>

      {/* Generate Section */}
      <div className="mb-10 relative rounded-[2rem] p-[1px] animate-fade-in-up" style={{ animationDelay: '60ms' }}>
        <div className="absolute inset-0 bg-gradient-to-r from-teal-600/50 via-blue-500/30 to-cyan-500/40 opacity-70 blur-md pointer-events-none" />
        <div className="relative glass rounded-[2rem] p-6 sm:p-7 overflow-hidden bg-[#0f172a]/60 backdrop-blur-xl border border-white/10">
          <div className="flex flex-col gap-4 relative z-10">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-xl">✨</span>
              <h2 className="text-xl font-bold text-white">Generate Cards from Document</h2>
            </div>

            <form onSubmit={handleGenerate} className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  placeholder="Topic or keyword (e.g., machine learning)"
                  className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-5 py-3.5 text-teal-100 font-medium placeholder-gray-500 focus:border-teal-500/50 transition-all outline-none"
                  disabled={isGenerating}
                />
                <select
                  value={deckId}
                  onChange={e => setDeckId(e.target.value)}
                  className="bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3.5 text-teal-100 font-medium focus:border-teal-500/50 transition-all outline-none"
                  disabled={isGenerating}
                >
                  {decks.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-center bg-white/[0.03] border border-white/10 rounded-xl p-1.5">
                  <span className="text-gray-500 text-sm font-medium ml-3 mr-2">Cards:</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setCount(prev => Math.max(1, prev - 1))} disabled={isGenerating || count <= 1}
                      className="w-9 h-9 rounded-[0.6rem] bg-white/[0.05] hover:bg-white/10 flex items-center justify-center text-teal-400 font-bold disabled:opacity-30 transition-all">–</button>
                    <span className="w-8 text-center text-teal-100 font-bold text-lg">{count}</span>
                    <button type="button" onClick={() => setCount(prev => Math.min(20, prev + 1))} disabled={isGenerating || count >= 20}
                      className="w-9 h-9 rounded-[0.6rem] bg-white/[0.05] hover:bg-white/10 flex items-center justify-center text-teal-400 font-bold disabled:opacity-30 transition-all">+</button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isGenerating || !topic.trim() || !deckId}
                  className="btn-primary bg-teal-600 hover:bg-teal-500 px-8 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(20,184,166,0.3)] hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {isGenerating ? (
                    <><div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" /> Generating...</>
                  ) : (
                    <>Generate from PDF 🪄</>
                  )}
                </button>
              </div>
            </form>

            {/* Generation Log */}
            {genLog.length > 0 && (
              <div className="mt-3 max-h-40 overflow-y-auto bg-black/30 rounded-xl p-3 border border-white/5">
                {genLog.map((log, i) => (
                  <p key={i} className="text-xs text-gray-300 py-0.5">{log}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search Section */}
      <div className="relative rounded-[2rem] p-[1px] animate-fade-in-up" style={{ animationDelay: '120ms' }}>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/40 via-violet-500/20 to-cyan-500/30 opacity-60 blur-md pointer-events-none" />
        <div className="relative glass rounded-[2rem] p-6 sm:p-7 overflow-hidden bg-[#0f172a]/60 backdrop-blur-xl border border-white/10">
          <div className="flex flex-col gap-4 relative z-10">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-xl">🔍</span>
              <h2 className="text-xl font-bold text-white">Search in Document</h2>
            </div>

            <form onSubmit={handleSearch} className="flex gap-3">
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by meaning (e.g., emotions, algorithms)"
                className="flex-1 bg-white/[0.03] border border-white/10 rounded-xl px-5 py-3.5 text-blue-100 font-medium placeholder-gray-500 focus:border-blue-500/50 transition-all outline-none"
              />
              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="btn-primary bg-blue-600 hover:bg-blue-500 px-6 py-3.5 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </button>
            </form>

            {searchResults.length > 0 && (
              <div className="flex flex-col gap-2 mt-2">
                {searchResults.map((r, i) => (
                  <div key={i} className="bg-black/30 rounded-xl p-4 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-blue-400">Page {r.page_number}</span>
                      <span className="text-[10px] text-gray-500">distance: {r.distance.toFixed(3)}</span>
                    </div>
                    <p className="text-sm text-gray-300 leading-relaxed">{r.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/DocumentDetailPage.tsx
git commit -m "feat: add DocumentDetailPage with RAG generation and semantic search"
```

---

## Task 12: Frontend — Routes & Navbar

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/Navbar.tsx`

- [ ] **Step 1: Update App.tsx with new routes**

Add imports and routes to `frontend/src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import HomePage from './pages/HomePage'
import DeckDetailPage from './pages/DeckDetailPage'
import ReviewPage from './pages/ReviewPage'
import StatsPage from './pages/StatsPage'
import DocumentsPage from './pages/DocumentsPage'
import DocumentDetailPage from './pages/DocumentDetailPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen">
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/decks/:id" element={<DeckDetailPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/documents" element={<DocumentsPage />} />
          <Route path="/documents/:id" element={<DocumentDetailPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}
```

- [ ] **Step 2: Add Documents to Navbar**

Update `NAV_ITEMS` in `frontend/src/components/Navbar.tsx`:

```typescript
const NAV_ITEMS = [
  { to: '/', label: 'Bộ thẻ', icon: '🗂️' },
  { to: '/documents', label: 'Tài liệu', icon: '📄' },
  { to: '/review', label: 'Ôn tập', icon: '🧠' },
  { to: '/stats', label: 'Thống kê', icon: '📊' },
]
```

- [ ] **Step 3: Start dev servers and test manually**

```bash
# Terminal 1: Backend
cd backend
uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm run dev
```

Test:
1. Navigate to `/documents` — should see empty state
2. Upload a PDF — should show status badge, then change to "ready"
3. Click "Open" on a ready document — should see detail page
4. Enter topic + select deck + generate — should stream cards via SSE
5. Search in document — should return relevant chunks
6. Delete document — should remove from list

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/Navbar.tsx
git commit -m "feat: add document routes and navbar link"
```

---

## Task 13: Final Integration Test & Cleanup

- [ ] **Step 1: Run full backend test suite**

```bash
cd backend
pytest -v
```

Expected: All tests PASS (existing + new).

- [ ] **Step 2: Run frontend build check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: No TypeScript errors.

- [ ] **Step 3: Update .env.example with new vars**

Add to `.env.example`:

```env
# Embedding config (Phase 3)
EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=nomic-embed-text
OPENAI_API_KEY=
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

- [ ] **Step 4: Final commit**

```bash
git add .env.example
git commit -m "feat: complete Phase 3 — RAG & PDF-Grounded Card Generation"
```
