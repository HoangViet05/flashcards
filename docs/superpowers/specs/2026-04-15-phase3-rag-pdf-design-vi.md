# Phase 3 — RAG & Tạo Flashcard từ PDF

> Spec thiết kế Phase 3 của Flashie. Upload bài báo khoa học (PDF), trích xuất và embed nội dung, sau đó tạo flashcard từ vựng với câu ví dụ trích dẫn trực tiếp từ paper.

---

## 1. Mục tiêu & Ngoài phạm vi

### Mục tiêu

- Upload PDF bài báo khoa học và trích xuất text bằng các extractor hoán đổi được (strategy pattern)
- Chia nhỏ text đã trích xuất thành chunks và embed vào ChromaDB để tìm kiếm vector
- Pipeline RAG: truy xuất chunks liên quan → LLM tạo flashcard với trích dẫn từ paper
- Provider embedding linh hoạt: Ollama (local, miễn phí) hoặc OpenAI API
- Trang "Tài liệu" độc lập để quản lý các PDF đã upload
- SSE streaming cho việc tạo card (tái sử dụng pattern Phase 2)
- Endpoint reindex để embed lại khi đổi model
- (Bonus) Tìm kiếm ngữ nghĩa trên các card đã tạo

### Ngoài phạm vi

- OCR cho PDF scan/chỉ có hình ảnh (chỉ hỗ trợ PDF có text)
- Xem trước/render PDF trong trình duyệt
- Đa người dùng / xác thực
- Chỉnh sửa tài liệu cộng tác real-time
- Giới hạn upload: 50MB (cấu hình qua `.env`)

---

## 2. Tổng quan kiến trúc

```
Frontend (React 19 + Vite)
├── /documents              → Thư viện tài liệu (upload, danh sách, xóa)
├── /documents/:id          → Chi tiết tài liệu (tạo card, tìm kiếm trong tài liệu)
├── /                       → Trang chủ (giữ nguyên + bonus tìm kiếm card)

Backend (FastAPI)
├── routers/documents.py    → Các endpoint CRUD + upload + generate + search
├── services/
│   ├── extractors/         → Strategy pattern cho trích xuất PDF
│   │   ├── base.py         → BaseExtractor ABC + ExtractedDocument schema
│   │   ├── pymupdf_extractor.py
│   │   ├── pdfplumber_extractor.py
│   │   └── docling_extractor.py
│   ├── chunk_service.py    → Chia text thành chunks (500 tokens, 50 overlap)
│   ├── embedding_service.py → Provider Ollama / OpenAI, cấu hình qua .env
│   ├── rag_service.py      → Truy xuất chunks + xây prompt + tạo card
│   └── ai_service.py       → Giữ nguyên (tạo card không cần PDF)

Lưu trữ
├── SQLite                  → Bảng documents (metadata + status)
├── ChromaDB (embedded)     → Collection doc_{id} + collection cards_global
└── uploads/                → File PDF gốc trên ổ đĩa
```

---

## 3. Data Model

### 3.1 Bảng `documents` (mới, SQLAlchemy)

| Cột              | Kiểu         | Mô tả                                             |
|------------------|--------------|----------------------------------------------------|
| `id`             | String(36) PK | UUID                                              |
| `filename`       | String(500)  | Tên file gốc khi upload                           |
| `file_path`      | String(500)  | Đường dẫn lưu file PDF trên server                |
| `status`         | String(20)   | `uploading` → `processing` → `ready` → `error`    |
| `extractor_used` | String(50)   | Extractor nào đã xử lý tài liệu này              |
| `page_count`     | Integer      | Số trang trong PDF                                 |
| `chunk_count`    | Integer      | Số chunks sau khi chia nhỏ                         |
| `error_message`  | Text, nullable | Chi tiết lỗi nếu xử lý thất bại                 |
| `created_at`     | DateTime     | Thời điểm upload                                   |

### 3.2 ChromaDB Collections

**Collection theo từng tài liệu** — tên: `doc_{document_id}`

Mỗi chunk được lưu:

```python
{
    "id": "chunk_001",
    "document": "nội dung text của chunk",
    "metadata": {
        "document_id": "uuid",
        "page_number": 3,
        "chunk_index": 12,
        "source": "filename.pdf"
    },
    "embedding": [0.012, -0.034, ...]
}
```

**Collection cards toàn cục** (bonus) — tên: `cards_global`

Mỗi card được embed dưới dạng `front_text + back_text + example_sentence`.

### 3.3 Model Card — giữ nguyên

Model `Card` hiện tại không thay đổi. Khi tạo card từ PDF, `example_sentence` chứa câu trích dẫn từ paper kèm tham chiếu trang (VD: `[Trang 3]`).

---

## 4. Trích xuất PDF — Strategy Pattern

### 4.1 Interface

```python
class ExtractedDocument(BaseModel):
    pages: list[PageContent]
    total_pages: int
    metadata: dict  # tiêu đề, tác giả nếu có

class PageContent(BaseModel):
    page_number: int
    text: str

class BaseExtractor(ABC):
    @abstractmethod
    def extract(self, file_path: str) -> ExtractedDocument:
        """Trích xuất text + metadata từ PDF."""
```

### 4.2 Các implementation

| Extractor             | Thư viện     | Điểm mạnh                     | Khi nào dùng                |
|-----------------------|--------------|--------------------------------|-----------------------------|
| `PyMuPDFExtractor`    | `PyMuPDF`    | Nhanh, nhẹ                     | Mặc định, paper text đơn giản |
| `PdfPlumberExtractor` | `pdfplumber` | Tốt với bảng/layout            | Paper có nhiều bảng số liệu |
| `DoclingExtractor`    | `docling`    | Nhận diện cấu trúc (heading)   | Paper phức tạp, cần cấu trúc |

### 4.3 Cách chọn extractor

User chọn extractor khi upload qua query param, mặc định `pymupdf`:

```
POST /api/documents/upload?extractor=pymupdf
POST /api/documents/upload?extractor=pdfplumber
POST /api/documents/upload?extractor=docling
```

Thêm extractor mới: tạo class implement `BaseExtractor`, đăng ký vào registry dict.

---

## 5. Chia nhỏ văn bản (Chunking)

### 5.1 ChunkService

- **Kích thước chunk**: ~500 tokens
- **Overlap**: ~50 tokens (giữ liên mạch giữa các chunk)
- Giữ nguyên metadata `page_number` cho từng chunk để trích dẫn chính xác
- Dùng `tiktoken` để đếm token

### 5.2 Luồng xử lý

```
ExtractedDocument.pages
  → ghép nối với đánh dấu trang
  → chia thành chunks tôn trọng ranh giới câu
  → mỗi chunk mang theo page_number từ trang gốc
```

---

## 6. Dịch vụ Embedding

### 6.1 Cấu hình qua `.env`

```env
EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=nomic-embed-text
OPENAI_API_KEY=sk-...
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

### 6.2 Chi tiết provider

| Provider | Model                    | Dimensions | Ghi chú                   |
|----------|--------------------------|------------|---------------------------|
| Ollama   | `nomic-embed-text`       | 768        | Miễn phí, local, chất lượng tốt |
| Ollama   | `mxbai-embed-large`      | 1024       | Nặng hơn, chất lượng cao hơn |
| OpenAI   | `text-embedding-3-small` | 1536       | Cần API key, chất lượng rất tốt |

### 6.3 Interface

```python
class EmbeddingService:
    def __init__(self, provider: str, model: str):
        ...
    def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed một batch texts, trả về list các vector."""
```

### 6.4 Thời điểm embed

- **Khi upload tài liệu**: Background task trích xuất → chia chunks → embed → lưu ChromaDB
- **Khi tạo card**: Embed nội dung card vào collection `cards_global`
- **Endpoint reindex**: Embed lại toàn bộ tài liệu/card (khi đổi model)

---

## 7. Pipeline RAG

### 7.1 Luồng xử lý

```
User chọn tài liệu (status=ready) + deck đích + chủ đề + số lượng
  → EmbeddingService embed câu truy vấn chủ đề
  → ChromaDB tìm kiếm tương đồng trên doc_{id} → top-K chunks liên quan nhất
  → Lọc bỏ chunks có score < 0.3
  → Sắp xếp chunks còn lại theo page_number
  → Đưa chunks vào prompt LLM làm context
  → LLM tạo flashcard với example_sentence trích dẫn từ paper
  → SSE stream từng card về frontend (tái sử dụng pattern generator Phase 2)
```

### 7.2 Prompt template

```
Bạn là trợ lý tạo flashcard từ vựng tiếng Anh cho người học, làm việc từ bài báo khoa học.

TÀI LIỆU THAM KHẢO:
---
{retrieved_chunks}
---

NHIỆM VỤ: Tạo flashcard từ vựng cho chủ đề "{topic}" dựa HOÀN TOÀN trên tài liệu trên.

YÊU CẦU:
- front_text: Từ vựng tiếng Anh (kèm phiên âm)
- back_text: Nghĩa tiếng Việt ngắn gọn
- example_sentence: PHẢI là câu trích dẫn trực tiếp từ tài liệu, kèm ghi chú [Trang X]
- KHÔNG ĐƯỢC bịa câu ví dụ. Nếu không tìm thấy câu phù hợp, hãy chọn từ khác.

CÁC TỪ ĐÃ CÓ (không được tạo lại): {excluded_words}
```

### 7.3 Cấu hình truy xuất

- **top_k**: Mặc định 10 chunks, user có thể tùy chỉnh trong request body
- **Ngưỡng tương đồng**: Loại bỏ chunks có score < 0.3
- Chunks được sắp xếp theo `page_number` trước khi đưa vào prompt (giữ thứ tự logic paper)

---

## 8. API Endpoints

### 8.1 Endpoints tài liệu (mới)

| Phương thức | Đường dẫn                         | Mô tả                                           |
|-------------|-----------------------------------|--------------------------------------------------|
| `POST`      | `/api/documents/upload`           | Upload PDF + chọn extractor. Trả 202, xử lý ngầm |
| `GET`       | `/api/documents`                  | Danh sách tất cả tài liệu + status              |
| `GET`       | `/api/documents/{id}`             | Chi tiết tài liệu (status, số trang, chunks)    |
| `DELETE`    | `/api/documents/{id}`             | Xóa tài liệu + xóa collection ChromaDB          |
| `POST`      | `/api/documents/{id}/generate`    | RAG tạo card → SSE stream                        |
| `GET`       | `/api/documents/{id}/search?q=..` | Tìm kiếm ngữ nghĩa trong tài liệu              |
| `POST`      | `/api/documents/reindex`          | Embed lại toàn bộ tài liệu (đổi model)          |

### 8.2 Endpoint bonus

| Phương thức | Đường dẫn               | Mô tả                                  |
|-------------|-------------------------|-----------------------------------------|
| `GET`       | `/api/search/cards?q=..`| Tìm kiếm ngữ nghĩa trên tất cả cards  |

### 8.3 Request body cho generate

```json
{
    "topic": "machine learning",
    "count": 5,
    "deck_id": "uuid-cua-deck-dich",
    "excluded_words": ["neural", "network"],
    "top_k": 10
}
```

---

## 9. Frontend

### 9.1 Route mới: `/documents`

**Trang Thư viện tài liệu** — grid hiển thị các PDF đã upload:
- Card mỗi tài liệu: tên file, badge status (`processing` / `ready` / `error`), số trang, ngày upload
- Nút upload: file picker (chỉ chấp nhận `.pdf`)
- Dropdown chọn extractor (pymupdf / pdfplumber / docling)
- Nút xóa kèm modal xác nhận

### 9.2 Route mới: `/documents/:id`

**Trang Chi tiết tài liệu**:
- Thông tin tài liệu: tên file, extractor đã dùng, số trang, số chunks, status
- **Khu vực tạo card**: ô nhập chủ đề + dropdown chọn deck đích + bộ chọn số lượng + nút "Tạo" → SSE stream với animation robot (tái sử dụng `RobotAnimation` + `FlyingGlassCard` từ Phase 2)
- **Khu vực tìm kiếm**: thanh tìm kiếm → tìm kiếm ngữ nghĩa trong tài liệu, hiển thị chunks phù hợp với số trang được highlight

### 9.3 Cập nhật Navbar

Thêm link "Tài liệu" vào giữa các link hiện có.

### 9.4 Phong cách UI

Đồng nhất với theme glassmorphism dark hiện tại. Card tài liệu dùng gradient xanh dương/teal để phân biệt với deck card (tím/violet).

---

## 10. Dependencies mới

### Backend (thêm vào requirements.txt)

```
chromadb
pymupdf
pdfplumber
python-multipart
tiktoken
```

`docling` là tùy chọn — cài riêng khi muốn thử nghiệm.

### Frontend

Không cần thêm npm package mới. Tái sử dụng Axios + EventSource hiện có.

---

## 11. Cấu trúc file (mới/sửa đổi)

```
backend/
├── app/
│   ├── models/
│   │   └── document.py           # MỚI - Document ORM model
│   ├── schemas/
│   │   └── document.py           # MỚI - Pydantic schemas
│   ├── routers/
│   │   └── documents.py          # MỚI - Các endpoint tài liệu
│   ├── services/
│   │   ├── extractors/           # MỚI - Trích xuất PDF
│   │   │   ├── __init__.py
│   │   │   ├── base.py
│   │   │   ├── pymupdf_extractor.py
│   │   │   ├── pdfplumber_extractor.py
│   │   │   └── docling_extractor.py
│   │   ├── chunk_service.py      # MỚI - Chia nhỏ văn bản
│   │   ├── embedding_service.py  # MỚI - Embedding Ollama/OpenAI
│   │   └── rag_service.py        # MỚI - Pipeline RAG
│   ├── main.py                   # SỬA - đăng ký documents router
│   └── database.py               # KHÔNG ĐỔI
├── uploads/                      # MỚI - Lưu trữ file PDF
│
frontend/
├── src/
│   ├── api/
│   │   └── documents.ts          # MỚI - API client cho tài liệu
│   ├── pages/
│   │   ├── DocumentsPage.tsx     # MỚI - Thư viện tài liệu
│   │   └── DocumentDetailPage.tsx # MỚI - Chi tiết tài liệu + tạo + tìm kiếm
│   ├── components/
│   │   └── Navbar.tsx            # SỬA - thêm link Tài liệu
│   └── App.tsx                   # SỬA - thêm routes
```

---

## 12. Ưu tiên & Phạm vi

| Tính năng                                          | Ưu tiên |
|----------------------------------------------------|---------|
| Upload PDF + trích xuất (strategy pattern)         | Core    |
| Chia chunks + embed vào ChromaDB                   | Core    |
| RAG tạo card với trích dẫn từ paper                | Core    |
| UI Thư viện tài liệu (CRUD)                       | Core    |
| UI Chi tiết tài liệu (tạo card + tìm kiếm)       | Core    |
| Embedding linh hoạt (Ollama/OpenAI)                | Core    |
| Endpoint reindex                                   | Core    |
| Tìm kiếm ngữ nghĩa trên cards                     | Bonus   |
