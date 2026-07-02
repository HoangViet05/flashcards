# Design: Flashie hoạt động hoàn chỉnh với bộ dữ liệu Anki (pending AI)

**Date:** 2026-07-02
**Status:** Approved
**Goal:** Người dùng có thể học tiếng Anh hàng ngày với các tính năng cơ bản (học từ mới, ôn tập SM-2, thống kê) trên bộ dữ liệu *4000 Essential English Words - Book 1* trích xuất từ Anki. Các tính năng AI tạm hoãn, hiển thị "Sắp ra mắt".

## Bối cảnh

- Repo đã có: CRUD deck/card, review SM-2, stats/streak, UI hoàn thiện (React 19 + FastAPI + SQLite).
- `extracted_anki/` chứa: `collection.anki2` (600 notes, 30 units), `media` (JSON map), `media_files/` (2401 files ~121MB: 1800 mp3, 600 jpg, 1 png).
- Note model `4000Book1` fields: `№, Keyword, Suggestion, Short Vietnamese, Keyword_Sound, Image, Transcription, Explanation, Meaning_Sound, Example_Sound, Full Vietnamese`.
- `Explanation` = câu giải thích tiếng Anh + `→` + câu ví dụ, chứa cloze `{{c1::word}}` và HTML.

## Quyết định của người dùng

1. **Cấu trúc deck:** 30 decks theo Unit (mỗi unit 20 từ).
2. **AI features:** giữ trên UI nhưng disable + badge "Sắp ra mắt".
3. **Nhịp học:** người dùng tự chọn deck để học từ mới, không giới hạn cứng.
4. **Mặt sau thẻ:** nghĩa tiếng Việt ngắn + giải thích tiếng Anh + ví dụ + ảnh.

## Thiết kế

### 1. Script import: `backend/import_anki.py`

Chạy một lần, idempotent (deck đã tồn tại theo tên → bỏ qua):

- Đọc `extracted_anki/collection.anki2`: join `notes` với `cards`+`col.decks` để map note → unit deck.
- Mỗi unit → Deck: name `Unit NN · 4000 Essential Words`, description ghi nguồn + số từ.
- Mỗi note → Card:
  - `front_text` = Keyword
  - `pronunciation` = Transcription
  - `back_text` = Short Vietnamese
  - `definition` = phần trước `→` của Explanation (làm sạch cloze + HTML)
  - `example_sentence` = phần sau `→` (làm sạch cloze + HTML)
  - `image_url` = `/media/<file>` từ field Image (`<img src='...'>`)
  - `audio_url` = `/media/<file>` từ Keyword_Sound (`[sound:...]`)
  - `example_audio_url` = `/media/<file>` từ Example_Sound
- Thứ tự insert theo field `№`.
- Copy các media file được tham chiếu từ `extracted_anki/media_files/` → `backend/data/media/`.
- Tạo `Review(card_id, due_date=today, repetitions=0)` cho mỗi card (khớp luồng "Học từ mới" hiện có).
- Bỏ qua: Suggestion, Meaning_Sound, Full Vietnamese.

Hàm parse (clean cloze, strip HTML, tách explanation/example, extract sound/img filename) tách riêng, có pytest.

### 2. Schema Card: thêm 3 cột nullable

- `pronunciation: str | None` — phiên âm IPA
- `definition: str | None` — giải thích tiếng Anh
- `example_audio_url: str | None` — audio câu ví dụ

Auto-migration nhẹ lúc startup (PRAGMA table_info → ALTER TABLE ADD COLUMN nếu thiếu), không dùng Alembic. Cập nhật Pydantic schemas tương ứng.

### 3. Serve media + UI phát âm thanh

- `app.mount("/media", StaticFiles(directory="data/media"))` trong `main.py` (tạo thư mục nếu chưa có).
- Frontend helper `mediaUrl(path)` ghép origin backend (từ base URL của axios client) với đường dẫn `/media/...`.
- FlipCard:
  - Mặt trước: dòng phiên âm dưới từ; nút loa 🔊 phát `audio_url` (click, không autoplay).
  - Mặt sau: nghĩa Việt (to, đậm) → `definition` tiếng Anh → khung ví dụ (kèm nút loa phát `example_audio_url`) → ảnh.
  - Nút loa dùng `stopPropagation` để không lật thẻ khi bấm.

### 4. AI "Sắp ra mắt"

- HomePage: khung AI generator disable (input/nút không tương tác) + badge "Sắp ra mắt ✨".
- Navbar/Documents: mục Documents gắn badge tương tự, trang Documents hiển thị thông báo coming soon thay vì UI upload.
- Backend routers AI/documents giữ nguyên, không đụng.

### 5. Stats phân biệt thẻ mới vs đến hạn ôn

- `StatsOut` thêm `new_cards` (Review có `repetitions == 0`).
- `due_today` chỉ đếm `due_date <= today AND repetitions > 0`.
- `total_reviewed_today` giữ nguyên. StatsPage/HomePage hiển thị thêm số thẻ mới.

### 6. README + start.bat

- README viết lại: mô tả app học từ vựng offline hoàn chỉnh với bộ 4000 từ; AI chuyển thành mục Roadmap/Coming soon; Quick Start thêm bước `python import_anki.py`.
- Kiểm tra `start.bat` hoạt động.

### 7. Kiểm chứng

- pytest cho hàm parse của import script; chạy toàn bộ test backend.
- `npm run build` để typecheck frontend.
- Chạy app thật, xác nhận: import xong 30 decks/600 cards, học từ mới theo deck, lật thẻ có phiên âm/nghĩa/ví dụ/ảnh, phát được âm thanh, đánh giá SM-2, stats đúng.

## Ngoài phạm vi

- Giới hạn thẻ mới/ngày, import .apkg tổng quát, hiển thị Full Vietnamese, mọi tính năng AI (generate, PDF/RAG), Alembic, PostgreSQL.
