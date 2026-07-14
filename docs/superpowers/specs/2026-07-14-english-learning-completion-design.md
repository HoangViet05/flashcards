# Spec: Hoàn thiện Personal English Learning App (Phase 1 + AI cơ bản)

**Ngày:** 2026-07-14
**Trạng thái:** Approved
**Nguồn yêu cầu:** `English Learning App Roadmap.md` (roadmap mới — thay thế roadmap RAG/MCP/Agent trong README làm định hướng chính)

## 1. Bối cảnh & mục tiêu

App flashcards (React 19 + Vite / FastAPI / SQLAlchemy) đã có: CRUD deck/card, SM-2 review,
Anki import, auth JWT, upload PDF, AI tạo card qua Ollama (đang khóa `AI_ENABLED=false`).

Mục tiêu đợt này — hoàn thiện các tính năng học tập cốt lõi + AI cơ bản, tối ưu performance
trên hạ tầng free:

- **FE:** Vercel free · **BE:** Render free (Singapore, đã có Google Apps Script keep-alive)
- **DB:** Supabase Postgres free (500MB) · **Storage media:** Supabase Storage
- **AI:** hybrid — Ollama trên máy local (i7 13650HX + RTX 4060) khi online, Gemini/Groq free tier khi offline

**Người dùng:** chủ app + vài người thân/bạn bè → cần scope dữ liệu theo user, không cần
full multi-tenant (rate limit, quota…).

**Ưu tiên tính năng (user đã chốt):** Tech Reader + tra từ 1-click > Mini-games > Heatmap.
Template Library + Shadowing: **hoãn** (ngoài scope). Sentence Expander: **ngoài scope**.

## 2. Các quyết định đã chốt

| Quyết định | Lựa chọn |
|---|---|
| Định hướng | Roadmap mới (Reader/games/heatmap) là chính; RAG/MCP/Agent gác lại |
| User model | Multi-user nhỏ (bạn bè) — scope theo `user_id`, mọi API sau auth |
| Tra từ | 3 tầng: EN-EN (dictionaryapi.dev) + EN-VI (từ điển offline trong DB) + AI enrich bất đồng bộ |
| AI deploy | Hybrid: ưu tiên Ollama local (qua Cloudflare Tunnel) khi online; mặc định Gemini Flash; fallback Groq |
| AI scope | Tạo card (bật lại code sẵn), enrich nghĩa trong Reader, tóm tắt bài. |
| Reader input | Paste text + URL + PDF đã upload + RSS |
| Games × SRS | Kết quả game tính vào lịch SM-2 (qua endpoint review, phân biệt `rating_source`) |
| Cold start | Đã xử lý bằng Google Apps Script ping — không nằm trong scope |
| DB prod | **Reset schema** + import lại 600 từ (tiến trình học hiện tại bỏ) |
| Từ điển EN-VI | Bộ open-source dạng StarDict (Hồ Ngọc Đức, ~110k mục, ~30-50MB) nạp vào Postgres |
| Migration tool | Giữ cơ chế "lightweight migration" hiện có (`ensure_*_columns`), không thêm Alembic |

## 3. Thứ tự triển khai

```
M1 Foundation ──► M2 Tech Reader ──► M4 AI hybrid ──► M5 RSS
             └──► M3 Games + Heatmap (song song với M2 sau khi M1 xong)
```

Mỗi milestone deploy được độc lập và dùng được ngay.

---

## 4. M1 — Foundation: multi-user, review log, performance

### 4.1 Multi-user scoping

- Thêm cột `user_id: String(36) FK → users.id, nullable=False, index` vào `decks` và `documents`.
  Cards/reviews kế thừa quyền qua deck — không thêm cột.
- Mọi router hiện có (`decks`, `cards`, `review`, `documents`, `anki_import`, `ai`) thêm
  `Depends(get_current_user)`; mọi query filter theo user (cards/reviews join qua deck).
- Truy cập tài nguyên không thuộc user → **404** (không phải 403 — tránh lộ tồn tại).
- Anki import (`/api/anki/import` + CLI `import_anki.py`) gắn deck vào user. CLI thêm
  tham số `--user-email` để chọn tài khoản đích.
- FE: axios interceptor đã gắn JWT — bổ sung route guard: chưa đăng nhập → redirect `/login`;
  response 401 → xóa token + redirect.

### 4.2 Bảng mới `review_logs` (append-only)

```
id            String(36) PK uuid
user_id       String(36) FK users, index
card_id       String(36) FK cards (ondelete SET NULL, nullable — giữ log khi xóa card)
quality       Integer (0-5)
rating_source String(20)  -- flip | game_sentence | game_cloze | game_match
response_time_ms Integer nullable
reviewed_at   DateTime, index (composite index (user_id, reviewed_at))
```

- `POST /api/review/{card_id}` sau khi cập nhật SM-2 ghi thêm 1 dòng log.
- Bảng `reviews` giữ nguyên vai trò: trạng thái SM-2 hiện tại của thẻ.

### 4.3 Performance backend

- **`GET /api/review/stats` viết lại** — tối đa 3 query:
  1. Aggregate trên `reviews`: total, due_today, new_cards (1 query có `CASE WHEN`).
  2. `review_logs` GROUP BY `date(reviewed_at)` cho 90 ngày gần nhất → tính streak +
     reviewed_today trong Python (1 query).
  3. `reviews` GROUP BY `due_date` cho 7 ngày tới (1 query).
- **`GET /api/decks`**: 1 query JOIN + GROUP BY trả kèm `card_count`, `due_count`
  (hiện đang N+1 per deck).
- Thêm `GZipMiddleware` (minimum_size=1000).
- Index: `reviews.due_date`, `decks.user_id`, `documents.user_id`,
  `review_logs(user_id, reviewed_at)`.
- Pagination cho `GET /api/decks/{id}/cards` (limit/offset, default 50) — DeckDetailPage
  load theo trang.

### 4.4 Performance frontend

- Cache stale-while-revalidate cho GET decks/stats: hiển thị ngay bản localStorage,
  refetch ngầm rồi cập nhật. Tự viết hook nhỏ (`useCachedQuery`) — không thêm react-query
  để giữ bundle nhỏ (trừ khi agent thấy chi phí tương đương thì được phép dùng
  @tanstack/react-query).
- Code-splitting theo route (`React.lazy` + `Suspense`) cho mọi page.
- Skeleton UI thay spinner toàn trang.

### 4.5 Migration / reset prod

- Script `backend/scripts/reset_db.py`: drop toàn bộ bảng + tạo lại theo schema mới
  (chạy tay với `DATABASE_URL` trỏ Supabase; yêu cầu gõ `YES` xác nhận).
- Sau reset: tạo tài khoản chủ app → chạy `import_anki.py --user-email ...` import lại
  600 từ (media đã ở Supabase Storage, giữ nguyên URL).

---

## 5. M2 — Tech Reader

### 5.1 Model mới `articles`

```
id           String(36) PK uuid
user_id      String(36) FK users, index
title        String(500)
source_type  String(10)  -- paste | url | pdf | rss
content      Text        -- plain text, đoạn cách nhau bằng \n\n
source_url   String(1000) nullable
document_id  String(36) FK documents nullable (khi source_type=pdf)
summary      Text nullable  -- AI tóm tắt (M4), cache tại đây
word_count   Integer
created_at / updated_at
```

### 5.2 API

- `POST /api/articles` — body `{title?, text}` (paste) hoặc `{url}` (backend fetch +
  `trafilatura` trích nội dung chính + title; lỗi trích xuất → 422 kèm message gợi ý paste tay)
  hoặc `{document_id}` (PyMuPDF trích text từ PDF đã upload).
- `GET /api/articles` (list, mới nhất trước, kèm word_count) / `GET /api/articles/{id}` /
  `DELETE /api/articles/{id}`.
- `GET /api/dictionary/{word}` — tra bảng `dictionary_entries` (lowercase, strip); trả
  `{word, pronunciation?, meanings_vi}`; miss → 404.

### 5.3 Từ điển EN-VI offline

- Bảng `dictionary_entries`: `word (String(100) PK, lowercase)`, `pronunciation nullable`,
  `content Text` (nghĩa VI, giữ cấu trúc dòng của StarDict).
- Script `backend/scripts/import_dictionary.py`: parse file StarDict/tab-separated
  Anh-Việt (Hồ Ngọc Đức, GPL — chỉ dùng cá nhân) → bulk insert (batch 1000). Chạy 1 lần
  cho local và 1 lần trỏ Supabase.
- Lookup chuẩn hóa: thử nguyên từ → lowercase → dạng gốc đơn giản (bỏ s/es/ed/ing đuôi —
  stemming nhẹ phía backend, không cần thư viện NLP).

### 5.4 Reader UI

- Route `/reader` (danh sách + nút New: 3 tab Paste/URL/PDF) và `/reader/:id` (trang đọc).
- Trang đọc render content thành từng đoạn `<p>`, mỗi từ wrap span clickable
  (tách bằng regex, giữ nguyên dấu câu).
- **Popup tra từ** (click từ): hiện ngay ⏳ → song song:
  - EN-EN: browser gọi thẳng `https://api.dictionaryapi.dev/api/v2/entries/en/{word}`
    (có CORS) — định nghĩa, IPA, audio phát âm. Cache localStorage (key `dict:{word}`, TTL 30 ngày).
  - EN-VI: `GET /api/dictionary/{word}`.
  - Tab **✨ AI** (chỉ hiện khi M4 xong + AI status enabled): `POST /api/ai/enrich`.
- **Lưu vào deck**: chọn deck (dropdown, nhớ lựa chọn gần nhất) → `POST /api/decks/{id}/cards`
  với front = `word /IPA/`, back = nghĩa VI (ưu tiên EN-VI offline, user sửa được trước khi lưu),
  definition = nghĩa EN, example_sentence = **câu chứa từ trong bài** (tự trích),
  audio_url = link audio từ dictionaryapi nếu có. Dùng duplicate check hiện có.
- **TTS đọc bài**: Web Speech API (`speechSynthesis`) — đọc theo câu, highlight câu đang đọc,
  play/pause/stop, chọn tốc độ (0.75/1/1.25) và giọng (en-US/en-GB nếu có). Không cần backend.

## 6. M3 — Mini-games + Heatmap

### 6.1 Khung chung

- Route `/games` — chọn game + phạm vi thẻ: 1 deck hoặc "thẻ đến hạn hôm nay"; mỗi phiên
  tối đa 10 thẻ (lấy từ API hiện có, thêm query param `limit`/`random`).
- Chỉ dùng thẻ đủ dữ liệu cho game đó (ví dụ Sentence Builder cần `example_sentence`);
  backend endpoint `GET /api/games/cards?mode=...&deck_id=...` trả thẻ hợp lệ đã lọc.
- Kết thúc mỗi thẻ: gọi `POST /api/review/{card_id}` với `rating_source=game_*`,
  `answer_mode`, `response_time_ms` — SM-2 cập nhật + ghi `review_logs` (từ M1).
- Mapping quality thống nhất: **đúng ngay = 5, đúng sau ≥1 lần sai = 3, bỏ qua/sai hẳn = 1.**
- Màn kết quả phiên: số câu đúng, thời gian, từ nào cần chú ý.

### 6.2 Ba game

1. **Sentence Builder** — xáo từ của `example_sentence` (phần tiếng Anh, cắt phần dịch
   trong ngoặc), user tap/kéo xếp lại đúng thứ tự. Câu > 12 từ: chỉ xáo 8 từ giữa, phần
   đầu/cuối giữ cố định.
2. **Dictation Cloze** — phát `example_audio_url` (fallback: TTS Web Speech đọc câu);
   hiện câu với từ vựng chính (front_text) bị khuyết `____`; user gõ từ. So sánh
   case-insensitive, trim.
3. **Concept Match** — 5 cặp `front_text` ↔ `definition` (EN) mỗi vòng, 2 cột xáo thứ tự,
   tap để nối. Sai → rung + tính 1 lần sai cho cặp đó.

### 6.3 Heatmap + nâng cấp Stats

- `GET /api/review/heatmap?days=365` → `[{date, count}]` từ `review_logs`
  (1 query GROUP BY, filter user).
- StatsPage: lưới heatmap kiểu GitHub contributions (SVG tự vẽ, 53×7 ô, 5 mức màu,
  tooltip ngày + số review), responsive scroll ngang trên mobile.
- Thêm chỉ số: tổng từ đã thuộc (`repetitions ≥ 3`), tổng review all-time,
  phân bố theo `rating_source` (flip vs games).

## 7. M4 — AI hybrid

### 7.1 Provider layer (`backend/app/services/ai_providers.py`)

Cả 3 provider dùng **OpenAI-compatible chat completions** → 1 `OpenAI` client, đổi cấu hình:

| Provider | base_url | model (env-driven) | Điều kiện |
|---|---|---|---|
| Ollama local | `OLLAMA_BASE_URL` (Cloudflare Tunnel / localhost) | `OLLAMA_MODEL` | health check OK |
| Gemini | `https://generativelanguage.googleapis.com/v1beta/openai/` | `gemini-flash-latest` | `GEMINI_API_KEY` |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | `GROQ_API_KEY` |

- **Thứ tự:** Ollama (nếu health check pass) → Gemini → Groq. Health check
  `GET {OLLAMA_BASE_URL}/models` timeout 1.5s, kết quả cache 60s trong process.
- Mỗi call: thử provider theo thứ tự, lỗi (timeout/quota/5xx) → provider kế tiếp.
  Hết chuỗi → 503 `"AI tạm thời không khả dụng"`.
- `ai_service.py` refactor để nhận client từ provider layer; giữ nguyên logic prompt/
  structured output/stream. Structured output: Gemini & Groq hỗ trợ `response_format`
  JSON schema; nếu provider từ chối → fallback parse JSON từ text (đã có helper).
- Settings mới trong `config.py` + render.yaml: `AI_ENABLED`, `OLLAMA_BASE_URL`,
  `OLLAMA_MODEL`, `GEMINI_API_KEY`, `GROQ_API_KEY`.

### 7.2 API & FE

- `GET /api/ai/status` → `{enabled, active_provider}` — FE dùng thay hằng `AI_ENABLED`
  hardcode trong HomePage/DeckDetailPage (bỏ badge "Sắp ra mắt" khi enabled).
- Giữ nguyên: `/api/ai/generate`, `/generate-batch`, `/generate-batch-stream`.
- **Mới** `POST /api/ai/enrich` — body `{word, context_sentence}` → structured output
  `{meaning_vi_it, meaning_en, collocations[], example_it}` (nghĩa theo ngữ cảnh IT).
  Hiển thị ở tab ✨ trong popup Reader.
- **Mới** `POST /api/ai/summarize` — body `{article_id}` → 3 bullet tiếng Anh đơn giản,
  lưu vào `articles.summary` (cache — lần sau trả thẳng, có nút regenerate).

## 8. M5 — RSS

- Bảng `feeds` (`id, user_id, url, title, last_fetched_at`) và `feed_items`
  (`id, feed_id, title, link, published_at, read: bool`) — unique (feed_id, link).
- `POST /api/feeds` (validate bằng `feedparser`), `GET /api/feeds` + items,
  `POST /api/feeds/refresh` (fetch tất cả feed của user, insert item mới; gọi khi user
  mở trang + nút refresh; Google Apps Script có thể gọi định kỳ kèm token).
- UI: section trong `/reader` — list bài mới theo feed; click → tạo article từ URL
  (pipeline M2) → mở trang đọc. Feed gợi ý sẵn: Hacker News, TechCrunch, Dev.to.

## 9. Testing

- **pytest (backend):** auth scoping (user A không đọc/ghi được resource user B — decks,
  cards, review, documents, articles); stats/heatmap aggregate đúng với dữ liệu seed;
  review ghi log + SM-2 như cũ; dictionary lookup (+stemming); article từ paste/URL
  (mock HTTP)/PDF; provider fallback chain (mock OpenAI client); enrich/summarize schema.
- **FE:** verify thủ công qua dev server mỗi milestone (không thêm test framework FE).
- Chuẩn hoàn thành mỗi milestone: pytest pass + verify end-to-end trên local + deploy thử.

## 10. Ngoài scope (đợt này)

- Template Library + Shadowing (thu âm) — hoãn theo lựa chọn user.
- Sentence Expander, Whisper STT, đánh giá phát âm (Phase 2/3 roadmap).
- RAG/ChromaDB/MCP/Agent/fine-tuning (roadmap cũ README).
- PWA/offline mode.
