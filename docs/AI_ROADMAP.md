# AI Integration Roadmap — Flashie

Lộ trình tích hợp AI vào dự án, từ cơ bản đến production-grade.
Được thiết kế cho AI Engineer muốn thực hành công nghệ thực tế và có **metrics rõ ràng** để chứng minh trên CV.

## 3 mục tiêu cốt lõi của lộ trình

1. **RAG** — Sinh flashcard từ tài liệu tiếng Anh thực tế (sách, novel, articles, transcript)
2. **MCP** — Biến app thành MCP server, để các IDE/tool bên ngoài (Claude Desktop, Cursor) cũng dùng được
3. **Daily English Tutor Agent** — Agent đồng hành học tiếng Anh hàng ngày: nhắc ôn, gợi ý từ mới, chat tự nhiên, phân tích lỗi

Mọi phase đều phục vụ một trong ba mục tiêu trên hoặc tạo nền tảng (foundation/eval) cho chúng.

---

## Phase 1 — Foundation ✅ Done

App nền: SM-2, CRUD, UI, Ollama gen card cơ bản. Xem README để biết chi tiết.

---

## Phase 2 — Enhanced AI + Evaluation Foundation 🔨

> **Mục đích:** Trước khi xây thêm bất kỳ tính năng AI nào, phải có hạ tầng **đo lường** chất lượng. Mọi phase sau dựa vào Phase 2 để chứng minh "có cải thiện" thay vì cảm tính.

### Structured Output / Function Calling ✅
- **Tech:** Ollama / OpenAI `response_format: json_schema`, Pydantic validation
- **Kỹ năng:** prompt engineering, schema validation, error handling

### SSE Streaming ✅
- **Tech:** FastAPI `StreamingResponse` + `EventSource` ở frontend
- **Kỹ năng:** async streaming, real-time UI

### Batch Generation ✅
- **Tech:** Bulk prompt + parallel generation
- **Kỹ năng:** throughput optimization

### Smart Prompting ✅
- **Tech:** Context injection (existing cards) vào system prompt
- **Kỹ năng:** prompt engineering, deduplication

### Rich Card Media (Schema + UI) 🔨
- **Tại sao đưa lên Phase 2:** Anki dataset có sẵn ảnh + audio chất lượng. Nếu schema/UI chưa support, import dataset cũng vô nghĩa. Đây là foundation cho cả Phase 2 ingestion và Phase 7 generation sau này.
- **Backend:**
  - Migration thêm `Card.image_path: str | None` và `Card.audio_path: str | None`
  - Static asset endpoint: `GET /api/assets/{card_id}/image` và `/audio`
  - Lưu file tại `data/assets/{deck_id}/{card_id}.{ext}` (không lưu blob trong DB)
- **Frontend:**
  - `FlipCard` hiển thị image (front) + nút play audio (header card)
  - Edit form upload/replace image & audio
- **Kỹ năng:** schema migration, file storage strategy, audio UI

### Anki Dataset Ingestion (with Assets) 🔨
- **Tech:** Parse `extracted_anki/` → 2,400+ cặp Anh-Việt **kèm ảnh + audio MP3**
- **Pipeline:**
  1. Đọc card metadata (front/back/example) từ Anki export
  2. Match từng card với asset MP3 / image trong `extracted_anki/`
  3. Copy assets vào `data/assets/anki_seed/`
  4. Insert vào DB với `image_path` và `audio_path` đã set
- **Output:**
  - (a) Seed deck mặc định cho user mới (có ngay 2,400 card đẹp với media)
  - (b) **Golden eval set** cho LLM-as-judge (text only, dùng đo generation quality)
- **Kỹ năng:** data pipeline, asset matching, dataset curation, schema mapping

### Evaluation Pipeline 🔨
- **Tech:** LLM-as-judge (GPT-4o làm judge) + golden set + pytest
- **Tính năng:**
  - Mỗi prompt change → chạy regression test trên golden set
  - Score 1-5 trên các tiêu chí: accuracy, naturalness, example quality
  - Báo cáo HTML với diff vs. baseline
- **Kỹ năng:** LLM evaluation, regression testing, CI integration
- **Metric:** LLM-judge score ≥ 4.0/5 trên golden set

### LLM Observability 🔨
- **Tech:** Langfuse self-hosted (Docker)
- **Tính năng:** trace mọi LLM call — latency, token cost, prompt version, user session
- **Kỹ năng:** observability, distributed tracing
- **Metric:** p95 latency, cost/1K cards, error rate

---

## Phase 3 — RAG over English Learning Content 🔨

> **Mục đích:** Sinh flashcard có **căn cứ** (grounded) từ tài liệu user đang đọc — không phải hallucinate. Đây là một trong 3 mục tiêu cốt lõi.

> **Lưu ý use-case:** Tài liệu là **English learning content** (novel, articles, news, song lyrics, subtitles, sách giáo khoa) — KHÔNG phải academic papers, vì người học tiếng Anh không đọc paper.

### Multi-format Ingestion
- **Tech:** PyMuPDF (PDF) + ebooklib (EPUB) + BeautifulSoup (URL) + pysrt (subtitles)
- **Pattern:** Strategy/Factory để swap extractor dễ dàng
- **Kỹ năng:** document parsing, design patterns

### Chunking & Vector Embeddings
- **Tech:** ChromaDB embedded + Ollama `nomic-embed-text` hoặc OpenAI `text-embedding-3-small` (configurable qua `.env`)
- **Tính năng:**
  - Chunk ~500 tokens, overlap 50
  - Mỗi document → 1 ChromaDB collection
  - Reindex endpoint khi đổi embedding model
- **Kỹ năng:** chunking strategy, embedding pipeline

### RAG Card Generation
- **Tech:** ChromaDB retriever → top-K chunks → context injection vào LLM → SSE stream card về frontend
- **Tính năng:**
  - User chọn document + chủ đề → retrieve → gen card
  - Example sentence trích dẫn `[Source: Title, Page X]`
- **Kỹ năng:** RAG pipeline, citation, context window management

### Cross-encoder Re-ranking
- **Tech:** `cross-encoder/ms-marco-MiniLM-L-6-v2` (small, chạy local nhanh)
- **Tính năng:** Re-rank top-K từ retriever bằng cross-encoder để tăng precision
- **Kỹ năng:** retrieval depth — phân biệt với basic RAG
- **Metric:** MRR@5 và NDCG@10 trước/sau re-rank

### Semantic Search
- **Trong document:** tìm passage theo nghĩa
- **Trên cards (cards_global collection):** tìm card xuyên deck theo nghĩa
- **Kỹ năng:** vector search UX

### Document Library UI
- **Tech:** React 19, trang `/documents` và `/documents/:id`
- **Tính năng:** upload với extractor selector, status tracking, gen card từ document, semantic search

### Metrics Phase 3
- Retrieval **MRR@5**, **NDCG@10** trên query set hand-labeled (~50 query)
- Citation accuracy: % example sentence đúng nguồn (manual audit 100 sample)
- Generation latency với và không có RAG

---

## Phase 4 — MCP Server 🔮

> **Mục đích:** Biến Flashie thành **Model Context Protocol server** — external clients (Claude Desktop, Cursor, Zed) có thể đọc/ghi deck của user. Đây là 1 trong 3 mục tiêu cốt lõi và là tiền đề cho Phase 5.

### MCP Server Skeleton
- **Tech:** Python `mcp` SDK chính thức, packaged riêng với FastAPI (deploy độc lập)
- **Transport:** stdio (cho Claude Desktop) + SSE (cho remote clients)
- **Kỹ năng:** MCP protocol, transport layers

### Resources
| URI | Nội dung |
|---|---|
| `card://{id}` | Card detail dạng JSON |
| `deck://{id}` | Deck với danh sách card |
| `document://{id}` | Document content + chunks |

### Tools
| Tool | Input | Output |
|---|---|---|
| `search_cards` | query, limit | list of cards |
| `create_card` | deck_id, front, back, example | created card |
| `get_due_cards` | deck_id, limit | list of due cards |
| `record_review` | card_id, quality (0-5) | next interval |
| `get_stats` | (none) | streak, totals, due count |
| `generate_from_topic` | topic, count, deck_id | list of generated cards |
| `search_in_document` | document_id, query | relevant chunks |

### Prompts
- "Drill me on weak cards"
- "Explain card {id} with mnemonics"
- "Generate cards from {document_id} on topic {topic}"

### Auth & Scoping
- **Tech:** API token per-user; MCP server kiểm tra scope khi gọi tool
- **Kỹ năng:** MCP authorization patterns

### Metrics Phase 4
- Tool call success rate
- End-to-end demo: Claude Desktop tạo card vào DB thật → screenshot/video lên CV

---

## Phase 5 — Daily English Tutor Agent 🔮

> **Mục đích:** Tính năng headline của dự án — agent giúp user học tiếng Anh **hàng ngày**, end-to-end. Xây trên MCP tools từ Phase 4 (single source of truth, không duplicate logic).

### LangGraph Agent Core
- **Tech:** LangGraph + persistent memory (SQLite checkpointer) + per-user profile
- **State:** level (A1-C2), weak topics, study schedule, conversation history
- **Kỹ năng:** agent state machines, persistent memory

### Daily Routine Workflow
- **Trigger:** scheduled (morning) hoặc user mở app
- **Flow:**
  1. Greet user theo timezone
  2. `get_due_cards` → đề xuất review session
  3. `generate_from_topic` → suggest N từ mới theo level + chủ đề user thích
  4. End-of-day: recap hôm nay học gì, weakest cards là gì
- **Kỹ năng:** workflow design, scheduling

### Conversation Mode
- **Flow:** user chat tự nhiên bằng tiếng Anh → agent trò chuyện → silently track từ user dùng sai/không biết → đề xuất tạo card vào cuối session
- **Kỹ năng:** background reasoning, implicit feedback collection

### Error Pattern Analysis
- **Flow:** Định kỳ phân tích review history cross-card → tìm pattern (vd: "user nhầm *affect/effect* 5 lần") → gen mnemonic card chuyên trị
- **Kỹ năng:** pattern mining, structured output reasoning

### Tool Orchestration via MCP
- Agent **không tự query DB** — gọi MCP tools từ Phase 4
- Demo MCP tools dùng được cho cả external client lẫn internal agent

### Conversation Trace UI
- Frontend page visualize agent decisions: nodes, tool calls, intermediate thoughts
- Educational + debugging value

### Metrics Phase 5
- Agent task success rate (LLM-as-judge trên scenario test set)
- Tools-per-task (efficiency)
- % agent-suggested cards user accept (real signal)
- 7-day retention nếu có agent vs. không

---

## Phase 6 — Custom ML 🔮

> **Mục đích:** Chứng minh khả năng AI engineering thực sự, không chỉ call API. Tập trung vào fine-tuning có **mục đích rõ ràng** trong dự án — không phải fine-tune cho có.

### LLM Distillation for Card Generation (Primary)
- **Tại sao task này hợp lý cho dự án:**
  - Có ground truth chất lượng sẵn: Anki 2,400+ cặp + synthetic data từ GPT-4o cho topic Anki chưa cover
  - Giải quyết vấn đề thực: app quảng bá "100% local" nhưng quality tốt vẫn cần model lớn → distill để model nhỏ chạy local đạt chất lượng tương đương
  - Pipeline AI engineering đầy đủ end-to-end
- **Tech:** Llama 3.2 1B/3B hoặc Phi-3 / Qwen 2.5 + LoRA/QLoRA + TRL/Hugging Face
- **Pipeline:**
  1. Data prep: convert Anki + synthetic → JSONL chat format
  2. SFT với LoRA (rank 16-32)
  3. Eval bằng pipeline từ Phase 2 (LLM-judge vs. GPT-4o reference)
  4. Export GGUF → serve qua Ollama → drop-in replace endpoint hiện tại
- **Metric:** BLEU, LLM-judge score ≥ 90% so với GPT-4o reference, latency < 1s, cost $0/card

### Embedding Fine-tuning (Conditional)
- **Khi nào làm:** chỉ khi Phase 3 metrics cho thấy off-the-shelf embedding model retrieval kém (MRR < 0.6)
- **Tech:** Sentence-Transformers + contrastive loss trên (word, definition, example) triples từ Anki
- **Metric:** MRR/NDCG trước/sau fine-tune

### Adaptive Difficulty (thay SM-2)
- **Tech:** Gradient boosting (LightGBM) trên review history features → predict forget probability
- **Features:** EF, last interval, time of day, card length, semantic similarity với card trước, ...
- **A/B Framework:** chạy song song với SM-2, đo retention
- **Kỹ năng:** feature engineering, online evaluation

### Metrics Phase 6
- Distill: BLEU/LLM-judge vs. GPT-4o reference, latency, cost saved
- Embedding: MRR/NDCG lift
- Adaptive: retention rate vs. SM-2 baseline (trên user thật / synthetic users)

---

## Phase 7 — Multimodal (Local-first) 🔮

> **Mục đích:** **Tạo MỚI** image/audio cho card không có sẵn assets. Phase 2 đã làm phần *display + import từ Anki*; Phase 7 lo phần *generation* cho card mới (RAG-generated, agent-generated, manual).
>
> **Giữ cam kết "100% local"** (không dùng GPT-4o Vision như đề xuất cũ).

### TTS for New Cards
- **Tech:** Coqui XTTS v2 hoặc OpenVoice (local), hoặc fallback Edge-TTS (online nhưng free)
- **Pipeline:** Card mới được tạo (RAG/agent/manual) không có audio → TTS gen → cache vào `data/assets/{deck_id}/{card_id}.mp3` → set `audio_path`
- **Trigger:** background job khi card created, hoặc on-demand khi user click play lần đầu
- **Kỹ năng:** TTS local, async background tasks, caching strategy

### Image for New Cards
- **Pluggable provider** (chọn 1 hoặc cho user pick):
  - **Stock photo:** Unsplash / Pexels API search bằng từ khóa card front
  - **Synthesized:** Stable Diffusion local (SDXL-Turbo) — đẹp hơn nhưng chậm
- **UX:** gen 3-4 candidate → user pick (hoặc auto-pick top match)
- **Kỹ năng:** API integration, image gen, candidate ranking

### Speech-to-Text + Pronunciation Scoring
- **Tech:** `whisper-cpp` local + phoneme alignment (Montreal Forced Aligner / wav2vec2)
- **Tính năng:** user thu âm → so sánh phoneme-by-phoneme với reference (Anki MP3 hoặc TTS đã cache) → score + highlight âm sai
- **Kỹ năng:** ASR, phoneme alignment, pronunciation assessment

### Vision Card Creation
- **Tech:** Local VLM — Qwen2.5-VL hoặc Llama 3.2 Vision (qua Ollama)
- **Tính năng:** user chụp ảnh vật thể → VLM tự gen vocab card (vật thể tiếng Anh là gì, ví dụ câu, ảnh chính là `image_path`)
- **Kỹ năng:** multimodal prompting, VLM integration

---

## Phase 8 — Production & MLOps 🔮

> **Mục đích:** Đưa dự án từ "demo local" lên "production-grade" để CV-friendly.

### Containerization
- **Tech:** `docker-compose.yml` cho full stack: frontend, backend, Ollama, ChromaDB, Langfuse, MCP server
- **Lưu ý:** vẫn giữ `start.bat` cho dev local nhanh — Docker là cho production deploy

### Model Serving
- **Tech:** Migrate fine-tuned model từ Ollama sang **vLLM** hoặc **TGI** cho throughput cao
- **Kỹ năng:** model serving, batching, quantization

### CI/CD with Eval Gate
- **Tech:** GitHub Actions
- **Pipeline:** lint → unit tests → integration tests → **eval pipeline (Phase 2) phải pass** → merge
- **Kỹ năng:** ML CI/CD, regression prevention

### Monitoring Dashboard
- **Tech:** Grafana + Prometheus, source từ Langfuse + custom metrics
- **Panels:** latency, cost, error rate, agent success rate, daily active users, retention

### Cost Dashboard
- Track $/active user per day across mọi LLM call
- Alert khi vượt threshold

---

## Lộ trình theo tháng (gợi ý)

| Tháng | Phase | Deliverable chính |
|---|---|---|
| 1 | 2 (hoàn thành) + 3 (50%) | Eval pipeline + Langfuse + RAG cơ bản |
| 2 | 3 (hoàn thành) + 4 | RAG đầy đủ + MCP server demo với Claude Desktop |
| 3 | 5 | Daily Tutor Agent MVP |
| 4 | 6 (distillation) | Local model thay GPT-4o với metric chứng minh |
| 5 | 7 | Multimodal local |
| 6 | 8 | Docker + CI/CD + monitoring |

---

## Điểm bắt đầu hiện tại (Apr 2026)

**Đang làm:** Phase 3 (RAG) — PDF upload + Document Library UI đã xong, tiếp theo là chunking + embedding.

**Khuyến nghị làm song song:** Phase 2 — **Evaluation Pipeline + Langfuse**, vì:
- Mọi phase sau cần metric để chứng minh chất lượng (đặc biệt fine-tuning ở Phase 6)
- Không có eval = không có data point cho CV
- Anki dataset 2,400 cặp đã có sẵn → tận dụng làm golden set ngay
