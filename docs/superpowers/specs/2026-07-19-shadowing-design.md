# Shadowing — Luyện nói theo audio (Design Spec)

**Ngày:** 2026-07-19
**Trạng thái:** Đã duyệt qua brainstorming với chủ dự án

## 1. Mục tiêu

Thêm tính năng shadowing kiểu **echo**: nghe một câu → app dừng → người học nói lại →
ghi âm → chấm điểm tự động từng từ → lặp/chuyển câu. Ba nguồn nội dung:

1. **Câu ví dụ flashcard** — audio người bản xứ có sẵn (`cards.example_audio_url`).
2. **Bài đọc trong Reader** — phát bằng TTS trình duyệt (giọng máy).
3. **Video YouTube** — dán link, tự lấy phụ đề EN, luyện theo từng câu với video nhúng.

Kết quả được lưu lịch sử để theo dõi tiến bộ; shadowing câu ví dụ của thẻ flashcard
đạt điểm tốt được tính vào lịch ôn SM-2 (giống 3 mini-game hiện có).

**Ngoài phạm vi (đợt này):** chấm điểm khi dùng từ điện thoại/máy khác (cần job queue —
để phase sau), chấm điểm mức âm vị (phoneme), lưu file ghi âm, chế độ nói đè đồng thời.

## 2. Kiến trúc tổng quan

Hạ tầng production: **FE trên Vercel, BE trên Render (không GPU), DB Supabase Postgres.**
Chấm điểm cần GPU nên chạy trên máy cá nhân của chủ dự án (RTX 4060 Laptop 8GB) theo
mô hình **"công tắc GPU"** — cùng triết lý `local_translator/` đã có, nhưng kết nối
**trực tiếp từ browser vào localhost** thay vì poll qua Render, vì shadowing cần phản
hồi ~1 giây (vòng lặp tương tác), và người luyện bắt buộc ngồi tại máy có mic/loa —
chính là máy có GPU.

```
┌─ Máy người học (laptop RTX 4060) ─────────────────────────────┐
│  Browser (web Vercel)                                          │
│    │  ghi âm MediaRecorder (webm/opus)                         │
│    ├──► http://127.0.0.1:8788/score ──► faster-whisper (CUDA)  │
│    │        ◄── {transcript, score, words}                     │
│    ├──► http://127.0.0.1:8788/subtitles?url= ──► yt-dlp        │
│    │        ◄── {title, segments[{start,end,text}]}            │
│    │                                                           │
│    └──► Render API (JSON, KHÔNG có audio)                      │
│           ├─ lưu shadowing_attempts, shadow_videos ─► Supabase │
│           └─ submit review SM-2 (rating_source="shadowing")    │
│                                                                │
│  local_shadowing\start_shadowing.bat  ← "công tắc"             │
└────────────────────────────────────────────────────────────────┘
```

Lý do các quyết định chính:

- **Audio không bao giờ rời máy** — nhanh, riêng tư, không tốn bandwidth Render.
- **yt-dlp chạy ở máy người dùng (IP dân cư)** — yt-dlp trên IP datacenter của Render
  thường bị YouTube chặn, nên phần lấy phụ đề bắt buộc phải chạy local.
- **Render backend không có dependency ML nào** (không Whisper, không yt-dlp) — chỉ CRUD
  thuần, hợp free tier.
- **Công tắc TẮT vẫn dùng được một phần:** trang shadowing cho nghe – nói – nghe lại giọng
  mình (blob client-side), chỉ ẩn chấm điểm/SM-2/lưu attempt, kèm nhắc bật worker.

## 3. Local GPU worker — `local_shadowing/`

Service FastAPI nhỏ, **bind 127.0.0.1:8788**, cấu trúc thư mục song song `local_translator/`:

```
local_shadowing/
├── server.py            # FastAPI app + CORS + PNA
├── scoring.py           # Whisper singleton + thuật toán chấm điểm
├── subtitles.py         # yt-dlp fetch + ghép phụ đề thành câu
├── requirements.txt     # faster-whisper, yt-dlp, fastapi, uvicorn, python-multipart
├── install_shadowing.bat
├── start_shadowing.bat  # công tắc BẬT (đóng cửa sổ / Ctrl+C = TẮT)
├── .env.example         # WHISPER_MODEL, APP_ORIGINS
└── README.md
```

### Endpoints

| Endpoint | Vào | Ra |
|---|---|---|
| `GET /health` | — | `{status, device: "cuda"\|"cpu", model, model_loaded: bool}` |
| `POST /score` | multipart: `file` (webm/opus ≤20s), `target_text` | `{transcript, score: 0-100, words: [{word, status}], no_speech: bool}` |
| `GET /subtitles?url=` | link YouTube | `{youtube_id, title, duration_s, segments: [{start, end, text}]}` |

### Whisper

- `faster-whisper`, model cấu hình qua env `WHISPER_MODEL` (mặc định `small`, ~460MB tải
  lần đầu). Load lazy ở request `/score` đầu tiên, singleton.
- Device: thử CUDA float16 → nếu init lỗi (thiếu cuDNN...) tự fallback CPU int8, log warning.
- Tham số transcribe: `language="en"`, `vad_filter=True`, `beam_size=5`.
- faster-whisper decode webm/opus qua PyAV — không cần cài ffmpeg riêng. File audio ghi ra
  file tạm và xoá ngay sau khi chấm.

### Thuật toán chấm điểm (`scoring.py`)

1. Chuẩn hoá cả câu gốc lẫn transcript: lowercase, bỏ dấu câu (giữ apostrophe), mở rộng
   các viết tắt phổ biến (*I'm → I am, don't → do not, ...*) ở cả hai vế.
2. Align theo từ bằng `difflib.SequenceMatcher`:
   - `equal` → từ gốc `correct`
   - `replace` → từ gốc `substituted` (nói thành từ khác)
   - `delete` → từ gốc `missed` (không nói)
   - `insert` (từ thừa) → không trừ điểm, không hiển thị lên câu gốc
3. `score = round(100 * số_từ_correct / tổng_từ_câu_gốc)`.
4. Transcript rỗng/chỉ im lặng → `no_speech=true`, score bỏ qua (FE nhắc thu lại,
   **không** lưu attempt).
5. Hạn chế đã biết (chấp nhận): số viết bằng chữ số vs chữ ("25" vs "twenty-five") có thể
   bị chấm lệch; không chấm ngữ điệu/trọng âm.

### Ghép phụ đề YouTube (`subtitles.py`)

- yt-dlp lấy metadata + phụ đề EN: ưu tiên phụ đề tay (`en`), fallback phụ đề auto.
- Phụ đề auto dạng mảnh trượt (trùng lặp) → khử trùng, ghép mảnh thành câu theo dấu câu;
  giới hạn 1 segment ≤ ~15 giây; bỏ segment rỗng/toàn ký hiệu nhạc.
- Không có phụ đề EN / video private / lỗi mạng → trả lỗi có `detail` tiếng Việt rõ ràng.

### CORS + Private Network Access

- CORS allowlist qua env `APP_ORIGINS` (mặc định: domain Vercel của app + `http://localhost:5173`).
- Trả header `Access-Control-Allow-Private-Network: true` cho preflight (Chrome PNA).
- Trang HTTPS gọi `http://127.0.0.1` là hợp lệ (localhost = secure origin); Chrome sẽ hỏi
  quyền **Local Network Access một lần** — README hướng dẫn bấm Allow. Khuyến nghị
  Chrome/Edge; Safari/Firefox không đảm bảo.
- Không cần token: bind 127.0.0.1 + CORS allowlist là đủ cho dữ liệu ít nhạy cảm này.
  (Hardening tương lai: shared token trong `.env` + localStorage.)

## 4. Backend Render — router `app/routers/shadowing.py`

Prefix `/api/shadowing`, mọi endpoint yêu cầu đăng nhập (`get_current_user`), schemas mới
ở `app/schemas/shadowing.py`. **Không thêm dependency nào vào `requirements.txt` của backend.**

### 2 bảng mới (SQLAlchemy `create_all` tự tạo — không cần migration tay)

**`shadow_videos`** — video YouTube đã import:

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | String(36) PK | uuid |
| `user_id` | FK users, CASCADE, index | |
| `youtube_id` | String(20) | unique cùng user_id |
| `title` | String(500) | |
| `duration_s` | Integer, nullable | |
| `segments` | JSON | `[{start, end, text}]` |
| `created_at`, `updated_at` | DateTime | |

**`shadowing_attempts`** — mỗi lần chấm điểm 1 dòng:

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | String(36) PK | |
| `user_id` | FK users, CASCADE, index | |
| `source_type` | String(10) | `card` \| `article` \| `youtube` |
| `card_id` | FK cards, SET NULL, nullable | xoá thẻ vẫn giữ lịch sử |
| `article_id` | FK articles, SET NULL, nullable | |
| `video_id` | FK shadow_videos, SET NULL, nullable | |
| `segment_index` | Integer, nullable | câu thứ mấy trong bài/video |
| `target_text` | Text | câu gốc |
| `transcript` | Text | Whisper nghe được |
| `score` | Integer | 0–100 |
| `word_results` | JSON | `[{word, status}]` |
| `created_at` | DateTime, index cùng user_id | |

**Không lưu file ghi âm** ở bất cứ đâu.

### Endpoints

| Endpoint | Chức năng |
|---|---|
| `GET /cards?deck_id=&due_only=` | Thẻ của user có `example_sentence` + `example_audio_url` khác NULL; `due_only=true` join Review `due_date <= today`. Trả các field FE cần (id, front_text, example_sentence, example_audio_url, pronunciation). |
| `POST /videos` | Body `{youtube_id, title, duration_s, segments}` (FE lấy từ local worker). Validate: shape segments, ≤ 2000 segments, text ≤ 1000 ký tự/segment. Upsert theo `(user_id, youtube_id)`. |
| `GET /videos` | Danh sách (không kèm segments): id, youtube_id, title, duration_s, segment_count, created_at. |
| `GET /videos/{id}` | Chi tiết kèm segments. |
| `DELETE /videos/{id}` | Xoá (kiểm tra ownership). |
| `POST /attempts` | Body `{source_type, card_id?, article_id?, video_id?, segment_index?, target_text, transcript, score, word_results}`. Validate score 0–100, ownership của ref tương ứng. |
| `GET /stats` | `{total_attempts, attempts_7d, avg_score_7d, by_day: [{date, count, avg_score}]}` (7 ngày gần nhất). |

Attempt do FE tự báo (điểm chấm ở máy người dùng) — chấp nhận được vì là dữ liệu học tập
của chính user, không có yếu tố cạnh tranh.

### SM-2 — không sửa backend

FE gọi endpoint sẵn có `POST /api/review/{card_id}` với `rating_source: "shadowing"`
(trường này nhận chuỗi tự do, thống kê `reviews_by_source` trên Stats tự gộp). Quy đổi:

| Score | Quality |
|---|---|
| ≥ 80 | 5 |
| 60–79 | 3 |
| < 60 | **không** submit SM-2 (chỉ lưu attempt) — phát âm chưa tốt không phá lịch nhớ từ |

Mỗi thẻ chỉ submit SM-2 **một lần mỗi phiên, với điểm cao nhất** trong các lần thử của
thẻ đó. Thời điểm submit: khi rời khỏi thẻ (chuyển câu khác hoặc kết thúc phiên) — tránh
spam review khi bấm "thử lại" nhiều lần và đảm bảo lần thử tốt nhất được ghi nhận.

## 5. Frontend

### Trang `/shadowing` (`pages/ShadowingPage.tsx`) + link 🎤 trên Navbar

Ba phase theo pattern `GamesPage`:

**Setup** — badge trạng thái worker (🟢 GPU sẵn sàng / 🔴 Công tắc đang tắt) + 3 tab:
- *Flashcards*: chọn "Thẻ đến hạn hôm nay" hoặc deck cụ thể (chỉ thẻ có audio câu ví dụ).
- *Bài đọc*: danh sách bài Reader; chọn bài → FE tách câu bằng util `sentenceParts`
  sẵn có của ReaderPage (refactor util này ra file dùng chung nếu đang nằm trong page).
- *YouTube*: ô dán link + nút import (gọi worker `/subtitles` → POST `/videos` lên Render;
  disable kèm giải thích khi worker offline) + danh sách video đã import.

**Practice** — luyện từng câu:
- Câu hiện to, tiến độ "Câu i/n", nút ⏮ ⏭, danh sách câu để nhảy nhanh.
- Nghe: nút ▶ + tốc độ 0.75x/1x qua 3 player cùng interface
  (`components/shadowing/SegmentPlayer`):
  - `Mp3Player` — `new Audio(resolveAssetUrl(example_audio_url))`
  - `TtsPlayer` — `speechSynthesis`, tái dùng logic chọn giọng của Reader
  - `YouTubePlayer` — YouTube IFrame API: `seekTo(start)`, tự pause tại `end`
    (poll `getCurrentTime`), nút 🔁 lặp lại đoạn hiện tại
- Nói: nút 🎤 toggle thu (tối đa 20s) qua hook `useRecorder`
  (getUserMedia + MediaRecorder).
- Điểm: gửi blob → worker `/score` → hiển thị % + câu gốc tô màu
  (xanh `correct` / đỏ `missed` / vàng `substituted`) + "Whisper nghe thấy: ..." +
  nút nghe lại giọng mình (blob) / nghe bản gốc / 🔄 thử lại. Song song POST attempt
  lên Render; nếu nguồn là thẻ và đạt ngưỡng → submit SM-2, hiện badge
  "✓ đã tính vào lịch ôn".
- Worker offline: vẫn nghe – thu – nghe lại giọng mình; ẩn chấm điểm; banner hướng dẫn
  bật `start_shadowing.bat`.

**Done** — điểm trung bình phiên, số câu đã luyện, danh sách câu điểm thấp nhất + nút
luyện lại các câu đó.

### Query params & lối tắt

- `/shadowing?card={id}` — vào thẳng practice với 1 thẻ (từ nút 🎤 mới cạnh audio câu
  ví dụ ở mặt sau `FlipCard`).
- `/shadowing?deck={id}` — practice cả deck.
- `/shadowing?article={id}` — practice bài đọc (từ nút "🎤 Shadow" mới trên toolbar
  ReaderPage).

### Files mới FE

```
src/api/shadowing.ts          # gọi Render (videos, attempts, cards, stats)
src/api/shadowingWorker.ts    # gọi localhost worker; base URL từ
                              # VITE_SHADOWING_WORKER_URL (mặc định http://127.0.0.1:8788)
src/hooks/useShadowingWorker.ts  # ping /health khi vào trang + mỗi 15s → online/offline
src/components/shadowing/
├── useRecorder.ts
├── SegmentPlayer.tsx         # 3 biến thể player cùng interface
├── YouTubePlayer.tsx
└── ScoreDisplay.tsx
src/pages/ShadowingPage.tsx
```

### Trang Stats

Thêm card "🎤 Luyện nói": tổng lượt, số lượt + điểm trung bình 7 ngày (từ
`GET /api/shadowing/stats`). Ôn tập qua shadowing tự xuất hiện trong biểu đồ
`reviews_by_source` sẵn có.

## 6. Xử lý lỗi

| Tình huống | Hành vi |
|---|---|
| User từ chối quyền mic | Thông báo tiếng Việt + hướng dẫn bật lại trong cài đặt trình duyệt |
| Chrome hỏi/chặn Local Network Access | Fetch localhost fail → banner hướng dẫn bấm Allow (kèm ảnh hướng dẫn trong README worker) |
| Lần chấm đầu (worker tải model ~460MB) | `/health.model_loaded=false` → FE hiện "Engine chấm điểm đang khởi động, lần đầu có thể mất vài phút…"; timeout request `/score` nới 120s |
| GPU init lỗi | Worker tự fallback CPU int8, log warning; `/health.device="cpu"` — FE vẫn hoạt động bình thường |
| Ghi âm im lặng | `no_speech=true` → "Không nghe rõ, thử lại gần mic hơn"; không lưu attempt |
| Worker rớt giữa phiên | Request score fail → toast + badge chuyển 🔴, chuyển chế độ luyện không chấm điểm |
| Video không phụ đề EN / private / yt-dlp lỗi | Hiện `detail` từ worker; README ghi chú `pip install -U yt-dlp` định kỳ |
| Xoá thẻ/bài/video đã luyện | FK `SET NULL` — lịch sử điểm giữ nguyên |

## 7. Testing

**Worker (`local_shadowing/`, pytest):**
- Unit chấm điểm: khớp hoàn toàn; thiếu/thừa/sai từ; dấu câu; hoa-thường; viết tắt.
- Parser phụ đề: fixture phụ đề tay + phụ đề auto (mảnh trùng lặp) → segments đúng.
- Endpoint `/score`, `/subtitles` với Whisper/yt-dlp mock (không tải model khi test).

**Backend Render (pytest + httpx, theo pattern `backend/tests/`):**
- Videos CRUD: validate shape/limit, upsert, ownership, list không kèm segments.
- Attempts: validate score range, ownership từng loại ref, lưu đúng.
- Stats: aggregate đúng theo 7 ngày.
- Cards: lọc example_sentence + example_audio_url, `due_only`.

**E2E thủ công (verification trước khi hoàn thành):**
- Thu âm thật 1 câu → điểm hợp lý, word highlight đúng.
- ReviewLog có `rating_source="shadowing"`; chỉ 1 review/thẻ/phiên.
- Import 1 video YouTube thật → segments hợp lý, click câu tua đúng đoạn.
- Tắt worker giữa phiên → degradation đúng như thiết kế.

## 8. Thứ tự triển khai (phasing trong implementation plan)

1. **Worker + chấm điểm**: `local_shadowing/` với `/health` + `/score`, thuật toán
   scoring + tests. (Giá trị cốt lõi, rủi ro kỹ thuật cao nhất — làm trước.)
2. **Render backend**: 2 model + attempts/cards/stats endpoints + tests.
3. **FE nguồn flashcard end-to-end**: page, recorder, Mp3Player, ScoreDisplay,
   SM-2 mapping, badge worker.
4. **FE nguồn bài đọc**: TtsPlayer + tách câu + lối tắt Reader.
5. **YouTube**: worker `/subtitles` + videos CRUD + YouTubePlayer + tab import.
6. **Hoàn thiện**: Stats card, lối tắt FlipCard, README worker, cập nhật README chính.

## 9. Ghi chú triển khai / vận hành

- Worker cài qua `install_shadowing.bat` (venv riêng hoặc conda env `flashcard`);
  yêu cầu CUDA cho tốc độ tốt nhất, nhưng CPU vẫn chạy được (chậm hơn, ~1–3s/câu).
- FE thêm env `VITE_SHADOWING_WORKER_URL` (không bắt buộc, mặc định
  `http://127.0.0.1:8788`).
- Render: không thay đổi deploy, không dependency mới; bảng mới tự tạo qua `create_all`
  khi khởi động.
- Mở rộng tương lai (ngoài phạm vi): đường job-queue qua Render (giống
  `local_translator`) để chấm điểm khi dùng từ điện thoại — dùng chung 2 bảng dữ liệu,
  không phải đập kiến trúc.
