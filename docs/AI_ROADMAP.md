# AI Integration Roadmap — Flashcard App

Lộ trình tích hợp AI vào dự án, từ cơ bản đến production-grade.
Được thiết kế cho AI Engineer muốn thực hành công nghệ thực tế.

---

## Tầng 1 — LLM Integration

### Structured Output / Function Calling
- **Tech:** OpenAI `gpt-4o` + `response_format: json_schema`
- **Kỹ năng:** prompt engineering, schema validation, error handling với LLM
- **Tính năng:** `/api/ai/generate-card` — nhập một từ → AI trả về đầy đủ nghĩa, ví dụ, phiên âm, từ loại, mức độ khó

### Streaming
- **Tech:** FastAPI SSE + `openai.stream()` + frontend `EventSource`
- **Kỹ năng:** async streaming, real-time UI update
- **Tính năng:** chat về từ vựng hiển thị từng chữ như ChatGPT

---

## Tầng 2 — RAG & Vector Search

### Embeddings + Vector DB
- **Tech:** `text-embedding-3-small` + Qdrant hoặc pgvector
- **Kỹ năng:** embedding pipeline, similarity search, chunking strategy
- **Tính năng:**
  - Tìm kiếm ngữ nghĩa ("tìm từ liên quan đến cảm xúc")
  - Gợi ý từ tương tự dựa trên nghĩa

### RAG Pipeline
- **Tech:** LangChain retriever + context injection
- **Kỹ năng:** retrieval-augmented generation, context window management
- **Tính năng:** AI giải thích từ dựa trên những gì user đã học, không giải thích chung chung

---

## Tầng 3 — Agentic AI

### LangGraph Agent
- **Tech:** LangGraph + tool calling
- **Kỹ năng:** agent loop, state machine, tool design
- **Tính năng:** "học thầy AI" — user chat, agent tự quyết định nên tạo thẻ mới, ôn lại thẻ cũ, hay giải thích thêm

### Multi-step Reasoning
- **Tech:** Chain of Thought prompting + structured output
- **Kỹ năng:** CoT, structured reasoning, pattern analysis
- **Tính năng:** phân tích lỗi sai của user — tại sao hay nhầm từ này, pattern lỗi là gì, đề xuất cách ghi nhớ

---

## Tầng 4 — Multimodal

### Speech — Phát âm
- **Tech:** OpenAI Whisper (STT) + `tts-1` (TTS) + WebRTC MediaRecorder
- **Kỹ năng:** audio processing, pronunciation scoring
- **Tính năng:** user đọc từ → AI chấm phát âm + phát lại chuẩn ngay trong flip card

### Vision — Học từ ảnh
- **Tech:** GPT-4o Vision + multimodal prompting
- **Kỹ năng:** image preprocessing, multimodal input
- **Tính năng:** chụp ảnh vật thể → AI tự tạo thẻ từ vựng từ ảnh thực tế

---

## Tầng 5 — ML tự xây

### Adaptive Learning Model
- **Tech:** scikit-learn / PyTorch + online learning
- **Kỹ năng:** feature engineering, model training, A/B testing
- **Tính năng:** thay SM-2 cứng bằng model học từ dữ liệu ôn tập thực tế của user, predict xác suất quên chính xác hơn

### Knowledge Graph
- **Tech:** Neo4j hoặc NetworkX + GNN cơ bản
- **Kỹ năng:** graph construction, graph ML, relationship modeling
- **Tính năng:** xây graph quan hệ giữa các từ (đồng nghĩa, trái nghĩa, cùng gốc, cùng chủ đề) → gợi ý "học từ này xong nên học từ nào tiếp"

---

## Tầng 6 — MLOps & Production

### Observability
- **Tech:** LangSmith hoặc Langfuse
- **Kỹ năng:** LLM tracing, cost tracking, prompt versioning
- **Mục đích:** theo dõi mọi LLM call — latency, cost, quality, lỗi

### Evaluation Pipeline
- **Tech:** LLM-as-judge + pytest + dataset curation
- **Kỹ năng:** LLM evaluation, regression testing, benchmark design
- **Mục đích:** tự động đánh giá chất lượng thẻ được tạo ra, phát hiện prompt regression

### Fine-tuning
- **Tech:** Llama 3 / Mistral + LoRA/QLoRA + Hugging Face
- **Kỹ năng:** dataset preparation, PEFT, model serving
- **Mục đích:** fine-tune model nhỏ chuyên tạo thẻ tiếng Anh-Việt, chạy local không cần API

---

## Lộ trình theo tháng

| Giai đoạn | Nội dung | Kết quả |
|---|---|---|
| Tháng 1 | Tầng 1 + 2 | AI tạo thẻ tự động + tìm kiếm ngữ nghĩa |
| Tháng 2 | Tầng 3 | Agent học tập, chat thông minh |
| Tháng 3 | Tầng 4 | Luyện phát âm + học từ ảnh |
| Tháng 4+ | Tầng 5–6 | ML riêng + production-grade observability |

---

## Điểm bắt đầu được khuyến nghị

Tầng 1 — Structured Output vì:
- Backend đã có sẵn stub `/api/ai/generate-card` trả 501
- Thấy kết quả ngay, không cần infra phức tạp
- Nền tảng cho mọi tầng phía trên
