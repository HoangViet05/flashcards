# Design: Nhập bộ thẻ Anki (.apkg) qua giao diện web

**Date:** 2026-07-02
**Status:** Approved
**Goal:** Người dùng tải bộ thẻ từ AnkiWeb (file `.apkg`), upload qua web UI, app tự trích xuất và tạo decks/cards/media để học thêm — ưu tiên chất lượng cao cho series *4000 Essential English Words*, best-effort cho deck khác.

## Quyết định của người dùng

1. **UX:** upload `.apkg` trên web (modal ở trang chủ), không bắt buộc CLI.
2. **Phạm vi deck:** series 4000 Words map đầy đủ; deck khác map best-effort theo heuristic.
3. Deploy: ngoài phạm vi (chỉ tư vấn, làm sau).

## Kiến trúc

Endpoint **đồng bộ**: upload xong server xử lý luôn rồi trả tóm tắt (import 600 thẻ + copy media chỉ vài chục giây trên local). Không dùng bảng status/polling — nâng cấp sau nếu deploy gặp proxy timeout.

## 1. Service dùng chung: `backend/app/services/anki_importer.py`

Tách logic import từ `import_anki.py` thành service, dùng bởi cả API và CLI.

### Đọc file .apkg (zip)

- Ưu tiên entry `collection.anki21`, fallback `collection.anki2` (bản export kép thường để stub "please update" trong `.anki2`).
- Gặp `collection.anki21b` (định dạng mới nén zstd) và không có bản cũ → raise lỗi có thông điệp: *"File xuất từ Anki bản mới. Hãy export lại với tùy chọn 'Support older Anki versions' được tick."*
- File map `media` phải là JSON (`{"0": "tên_thật.mp3", ...}`); parse JSON thất bại → cùng thông điệp lỗi trên.
- Đọc models từ cột `col.models` (JSON). Nếu rỗng/thiếu → lỗi với thông điệp re-export như trên.
- Giải nén SQLite vào file tạm (`tempfile`), đóng và xóa sau khi xong.

### Hai mapper

- **Model tên khớp `4000Book\d*`** → dùng `anki_parser.parse_note` hiện có (phiên âm, nghĩa Việt, definition, ví dụ, 2 audio, ảnh).
- **Model khác — mapper generic** (`map_generic_note(field_names, field_values) -> dict | None`):
  - Ghép tên field (casefold) với từ khóa — khớp chính xác trước, khớp substring sau:
    - front: `front, word, keyword, term, expression, vocabulary, question`
    - back: `back, meaning, translation, answer, vietnamese, viet`
    - definition: `definition, explanation, gloss`
    - pronunciation: `transcription, ipa, pronunciation, phonetic, reading`
    - example: `example, sentence, usage, sample`
  - Fallback: front = field 0, back = field 1 (note < 2 field và không match gì → bỏ qua).
  - Back rỗng nhưng definition có → dùng definition làm back.
  - Mọi giá trị đi qua `strip_cloze` + `clean_html` sẵn có.
  - Media: quét **tất cả** field theo thứ tự — `[sound:...]` thứ nhất → `audio_url`, thứ hai → `example_audio_url`; `<img>` đầu tiên → `image_url`.
  - Sau làm sạch, front hoặc back rỗng → bỏ qua note (đếm vào `cards_skipped`).

### Tên deck & idempotency

- Note → deck qua bảng `cards` của Anki (did của card đầu tiên, mỗi note lấy 1 lần).
- **Series 4000 Words** (model `4000Book1`): giữ đúng quy ước dữ liệu hiện có `"{leaf} · 4000 Essential Words"`; model `4000Book{N}` (N≥2): `"{leaf} · 4000 Essential Words Book {N}"`. → upload lại Book 1 sẽ skip đủ 30 deck.
- **Deck generic:** tên = tên deck Anki đầy đủ, thay `::` bằng ` · `.
- Deck đã tồn tại theo tên → bỏ qua toàn bộ deck đó (đếm `decks_skipped`). Trùng `front_text` trong cùng deck đang tạo → bỏ qua thẻ (đếm `cards_skipped`).
- Mỗi card tạo kèm `Review(due_date=today, repetitions=0)` — vào luồng "Học từ mới".

### Media

- Chỉ giải nén file được thẻ tham chiếu. Tên file lấy `Path(name).name` (chặn zip-slip).
- Đích `backend/data/media/`. Nếu tên đã tồn tại: cùng kích thước → dùng lại; khác → ghi tên mới `{sha1_8}_{tên}` và URL trỏ tới tên mới.

### Kết quả

`ImportSummary` (dataclass): `decks_created, cards_created, decks_skipped, cards_skipped, warnings: list[str]`.

## 2. API: `POST /api/anki/import`

Router mới `backend/app/routers/anki_import.py` (đăng ký trong `main.py`):

- Nhận multipart `file` (UploadFile). Đuôi khác `.apkg`/`.zip` → 400.
- Lưu vào file tạm → gọi `import_apkg` → trả JSON summary (schema Pydantic `AnkiImportOut`).
- Lỗi định dạng (`ApkgFormatError`) → 400 với thông điệp tiếng Việt; lỗi khác → 500 mặc định.
- Không đụng router AI/documents.

## 3. CLI: `backend/import_anki.py`

- Giữ mode cũ `--anki-dir` (thư mục đã giải nén) hoạt động y nguyên.
- Thêm `--apkg <file>` gọi cùng service.
- Cả hai mode chỉ còn là lớp mỏng quanh `anki_importer`.

## 4. Frontend

- HomePage: nút **"📥 Nhập từ Anki"** cạnh "+ Tạo bộ thẻ".
- Modal (component mới `ImportAnkiModal.tsx`): vùng kéo-thả/chọn file `.apkg` → trạng thái "Đang nhập... (file lớn có thể mất một phút)" → kết quả tóm tắt (bộ thẻ mới / thẻ mới / bỏ qua / cảnh báo) → nút đóng; đóng xong gọi `load()` làm mới danh sách deck.
- API client mới `api/anki.ts`: `importApkg(file: File)` — POST multipart, không đặt timeout.
- Lỗi 400/500 → toast đỏ với `detail` từ backend.

## 5. Kiểm thử

- **Unit (pytest):** mapper generic (match tên field, fallback vị trí, nhặt sound/img, bỏ qua note rỗng); helper tạo file `.apkg` giả trong test (SQLite schema tối giản `col/notes/cards` + media map JSON + file media giả) → test `import_apkg` end-to-end vào DB test: tạo deck/card/review, idempotent khi chạy lại, media copy + đổi tên khi trùng.
- **API test:** TestClient upload apkg giả → 200 + summary đúng; file đuôi sai → 400; zip không có collection → 400.
- **E2E thật:** chạy app, đóng gói `extracted_anki/` thành `Book1.apkg` thật, upload qua modal → phải skip 30 deck (idempotent); upload apkg giả nhỏ → deck mới hiện trên trang chủ.

## Ngoài phạm vi

- Cloze nhiều thẻ/note, scheduling/deck options từ Anki, xóa theo đợt import, xử lý nền + polling, định dạng `.colpkg`, media protobuf của Anki 23+.
