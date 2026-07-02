# Phase 3 — RAG & PDF-Grounded Card Generation

> Design spec for Phase 3 of Flashie. Upload scientific papers (PDF), extract and embed content, then generate vocabulary flashcards with example sentences cited directly from the paper.

---

## 1. Goals & Non-Goals

### Goals

- Upload PDF scientific papers and extract text using swappable extractors (strategy pattern)
- Chunk extracted text and embed into ChromaDB for vector retrieval
- RAG pipeline: retrieve relevant chunks → LLM generates flashcards with citations from paper
- Configurable embedding provider: Ollama (local, free) or OpenAI API
- Independent "Documents" library page for managing uploaded PDFs
- SSE streaming for card generation (reuse Phase 2 pattern)
- Reindex endpoint for re-embedding when switching models
- (Bonus) Semantic search across existing cards

### Non-Goals

- OCR for scanned/image-only PDFs (text-based PDFs only)
- PDF preview/render in browser
- Multi-user / authentication
- Real-time collaborative editing of documents
- Max upload file size: 50MB (configurable via `.env`)

---

## 2. Architecture Overview

```
Frontend (React 19 + Vite)
├── /documents              → Document Library (upload, list, delete)
├── /documents/:id          → Document Detail (gen cards, search in document)
├── /                       → HomePage (unchanged + bonus card search)

Backend (FastAPI)
├── routers/documents.py    → CRUD + upload + generate + search endpoints
├── services/
│   ├── extractors/         → Strategy pattern for PDF extraction
│   │   ├── base.py         → BaseExtractor ABC + ExtractedDocument schema
│   │   ├── pymupdf_extractor.py
│   │   ├── pdfplumber_extractor.py
│   │   └── docling_extractor.py
│   ├── chunk_service.py    → Split pages into chunks (500 tokens, 50 overlap)
│   ├── embedding_service.py → Ollama / OpenAI provider, configurable via .env
│   ├── rag_service.py      → Retrieve chunks + build prompt + gen cards
│   └── ai_service.py       → Unchanged (non-PDF card generation)

Storage
├── SQLite                  → documents table (metadata + status)
├── ChromaDB (embedded)     → doc_{id} collections + cards_global collection
└── uploads/                → Raw PDF files on disk
```

---

## 3. Data Model

### 3.1 `documents` table (new, SQLAlchemy)

| Column           | Type         | Description                                        |
|------------------|--------------|----------------------------------------------------|
| `id`             | String(36) PK | UUID                                              |
| `filename`       | String(500)  | Original uploaded filename                         |
| `file_path`      | String(500)  | Server-side path to stored PDF                     |
| `status`         | String(20)   | `uploading` → `processing` → `ready` → `error`    |
| `extractor_used` | String(50)   | Which extractor processed this document            |
| `page_count`     | Integer      | Number of pages in PDF                             |
| `chunk_count`    | Integer      | Number of chunks after splitting                   |
| `error_message`  | Text, nullable | Error details if processing failed               |
| `created_at`     | DateTime     | Upload timestamp                                   |

### 3.2 ChromaDB Collections

**Per-document collection** — name: `doc_{document_id}`

Each chunk stored as:

```python
{
    "id": "chunk_001",
    "document": "text content of the chunk",
    "metadata": {
        "document_id": "uuid",
        "page_number": 3,
        "chunk_index": 12,
        "source": "filename.pdf"
    },
    "embedding": [0.012, -0.034, ...]
}
```

**Global cards collection** (bonus) — name: `cards_global`

Each card embedded as `front_text + back_text + example_sentence`.

### 3.3 Card model — unchanged

Existing `Card` model stays the same. When generating from PDF, `example_sentence` contains the cited sentence from the paper with page reference (e.g., `[Page 3]`).

---

## 4. PDF Extraction — Strategy Pattern

### 4.1 Interface

```python
class ExtractedDocument(BaseModel):
    pages: list[PageContent]
    total_pages: int
    metadata: dict  # title, author if available

class PageContent(BaseModel):
    page_number: int
    text: str

class BaseExtractor(ABC):
    @abstractmethod
    def extract(self, file_path: str) -> ExtractedDocument:
        """Extract text + metadata from PDF."""
```

### 4.2 Implementations

| Extractor             | Library      | Strength                    | Use case                    |
|-----------------------|--------------|-----------------------------|-----------------------------|
| `PyMuPDFExtractor`    | `PyMuPDF`    | Fast, lightweight           | Default, simple text papers |
| `PdfPlumberExtractor` | `pdfplumber` | Good with tables/layout     | Papers with data tables     |
| `DoclingExtractor`    | `docling`    | Structure-aware (headings)  | Complex structured papers   |

### 4.3 Extractor selection

User selects extractor at upload time via query parameter, default `pymupdf`:

```
POST /api/documents/upload?extractor=pymupdf
POST /api/documents/upload?extractor=pdfplumber
POST /api/documents/upload?extractor=docling
```

Adding new extractors: create a class implementing `BaseExtractor`, register in an extractor registry dict.

---

## 5. Chunking

### 5.1 ChunkService

- **Chunk size**: ~500 tokens
- **Overlap**: ~50 tokens (maintains context continuity between chunks)
- Preserves `page_number` metadata per chunk for citation accuracy
- Uses `tiktoken` for token counting

### 5.2 Flow

```
ExtractedDocument.pages
  → concatenate with page markers
  → split into chunks respecting sentence boundaries
  → each chunk carries page_number from source page
```

---

## 6. Embedding Service

### 6.1 Configuration via `.env`

```env
EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=nomic-embed-text
OPENAI_API_KEY=sk-...
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

### 6.2 Provider details

| Provider | Model                    | Dimensions | Notes                    |
|----------|--------------------------|------------|--------------------------|
| Ollama   | `nomic-embed-text`       | 768        | Free, local, good quality |
| Ollama   | `mxbai-embed-large`      | 1024       | Heavier, higher quality  |
| OpenAI   | `text-embedding-3-small` | 1536       | Needs API key, excellent |

### 6.3 Interface

```python
class EmbeddingService:
    def __init__(self, provider: str, model: str):
        ...
    def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of texts, return list of vectors."""
```

### 6.4 Embedding timing

- **On document upload**: Background task extracts → chunks → embeds → stores in ChromaDB
- **On card creation**: Embed card content into `cards_global` collection
- **Reindex endpoint**: Re-embed all documents/cards (for model switching)

---

## 7. RAG Pipeline

### 7.1 Flow

```
User selects document (status=ready) + target deck + topic + count
  → EmbeddingService embeds the topic query
  → ChromaDB similarity search on doc_{id} → top-K relevant chunks
  → Filter chunks with score < 0.3
  → Sort remaining chunks by page_number
  → Inject chunks into LLM prompt as context
  → LLM generates flashcard with example_sentence cited from paper
  → SSE stream each card to frontend (reuse Phase 2 generator pattern)
```

### 7.2 Prompt template

```
You are a vocabulary flashcard assistant for English learners, working from scientific papers.

REFERENCE DOCUMENT:
---
{retrieved_chunks}
---

TASK: Create a vocabulary flashcard for the topic "{topic}" based ENTIRELY on the document above.

REQUIREMENTS:
- front_text: English vocabulary word (with pronunciation)
- back_text: Concise Vietnamese translation
- example_sentence: MUST be a direct quote from the document, with [Page X] citation
- Do NOT fabricate example sentences. If no suitable sentence exists, pick a different word.

EXCLUDED WORDS (do not generate these): {excluded_words}
```

### 7.3 Retrieval config

- **top_k**: Default 10 chunks, user-configurable in request body
- **Similarity threshold**: Discard chunks with score < 0.3
- Chunks sorted by `page_number` before injection (preserves paper logic flow)

---

## 8. API Endpoints

### 8.1 Document endpoints (new)

| Method   | Path                              | Description                              |
|----------|-----------------------------------|------------------------------------------|
| `POST`   | `/api/documents/upload`           | Upload PDF + select extractor. Returns 202, processes in background |
| `GET`    | `/api/documents`                  | List all documents with status           |
| `GET`    | `/api/documents/{id}`             | Document detail (status, pages, chunks)  |
| `DELETE` | `/api/documents/{id}`             | Delete document + ChromaDB collection    |
| `POST`   | `/api/documents/{id}/generate`    | RAG generate cards → SSE stream          |
| `GET`    | `/api/documents/{id}/search?q=..` | Semantic search within document          |
| `POST`   | `/api/documents/reindex`          | Re-embed all documents (model switch)    |

### 8.2 Bonus endpoint

| Method | Path                    | Description                     |
|--------|-------------------------|---------------------------------|
| `GET`  | `/api/search/cards?q=..`| Semantic search across all cards |

### 8.3 Generate request body

```json
{
    "topic": "machine learning",
    "count": 5,
    "deck_id": "uuid-of-target-deck",
    "excluded_words": ["neural", "network"],
    "top_k": 10
}
```

---

## 9. Frontend

### 9.1 New route: `/documents`

**Document Library page** — grid of uploaded PDFs:
- Each document card: filename, status badge (`processing` / `ready` / `error`), page count, upload date
- Upload button: file picker (accept `.pdf`)
- Extractor selector dropdown (pymupdf / pdfplumber / docling)
- Delete button with confirmation modal

### 9.2 New route: `/documents/:id`

**Document Detail page**:
- Document info: filename, extractor used, page count, chunk count, status
- **Generate section**: topic input + deck selector dropdown + count picker + "Generate" button → SSE stream with robot animation (reuse Phase 2 `RobotAnimation` + `FlyingGlassCard`)
- **Search section**: search bar → semantic search within document, display matching chunks with page numbers highlighted

### 9.3 Navbar update

Add "Documents" link between existing nav items.

### 9.4 UI style

Consistent with existing glassmorphism dark theme. Document cards use blue/teal gradient to differentiate from deck cards (violet/purple).

---

## 10. New Dependencies

### Backend (add to requirements.txt)

```
chromadb
pymupdf
pdfplumber
python-multipart
tiktoken
```

`docling` is optional — install separately when user wants to experiment with it.

### Frontend

No new npm dependencies. Reuses existing Axios + EventSource patterns.

---

## 11. File Structure (new/modified)

```
backend/
├── app/
│   ├── models/
│   │   └── document.py           # NEW - Document ORM model
│   ├── schemas/
│   │   └── document.py           # NEW - Pydantic schemas
│   ├── routers/
│   │   └── documents.py          # NEW - Document endpoints
│   ├── services/
│   │   ├── extractors/           # NEW - PDF extraction
│   │   │   ├── __init__.py
│   │   │   ├── base.py
│   │   │   ├── pymupdf_extractor.py
│   │   │   ├── pdfplumber_extractor.py
│   │   │   └── docling_extractor.py
│   │   ├── chunk_service.py      # NEW - Text chunking
│   │   ├── embedding_service.py  # NEW - Ollama/OpenAI embeddings
│   │   └── rag_service.py        # NEW - RAG pipeline
│   ├── main.py                   # MODIFIED - register documents router
│   └── database.py               # UNCHANGED
├── uploads/                      # NEW - PDF file storage
│
frontend/
├── src/
│   ├── api/
│   │   └── documents.ts          # NEW - Document API client
│   ├── pages/
│   │   ├── DocumentsPage.tsx     # NEW - Document library
│   │   └── DocumentDetailPage.tsx # NEW - Document detail + gen + search
│   ├── components/
│   │   └── Navbar.tsx            # MODIFIED - add Documents link
│   └── App.tsx                   # MODIFIED - add routes
```

---

## 12. Priority & Scope

| Feature                                   | Priority |
|-------------------------------------------|----------|
| PDF upload + extraction (strategy pattern) | Core     |
| Chunking + embedding into ChromaDB        | Core     |
| RAG gen cards with citations from paper    | Core     |
| Document Library UI (CRUD)                | Core     |
| Document Detail UI (gen + search)         | Core     |
| Configurable embedding (Ollama/OpenAI)    | Core     |
| Reindex endpoint                          | Core     |
| Semantic search across cards              | Bonus    |
