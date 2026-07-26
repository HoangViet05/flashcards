# Nâng trải nghiệm học — Giai đoạn 2: Học sâu

Ngày: 2026-07-25

Tiếp nối `2026-07-25-learning-experience-shell-design.md` (giai đoạn 1).

## Mục tiêu

Làm cho từ đã học thực sự "dính": nhận diện những từ hay sai và ôn chúng bằng
dạng bài khác, bắt nói ra miệng chính những từ đó, và cho người học gặp lại từ
trong ngữ cảnh khi đọc bài.

## Ràng buộc nền

- **Không có công cụ migration.** Schema dựng bằng `Base.metadata.create_all`,
  thứ này tạo bảng mới nhưng **không thêm cột vào bảng đã tồn tại**. DB thật
  nằm trên Supabase. Vì vậy giai đoạn này **không thêm cột nào** vào bảng có
  sẵn — mọi thứ suy ra từ dữ liệu đang có.
- Worker Whisper chạy ở máy host của tác giả, lúc bật lúc tắt.
- Giai đoạn 1 đã chốt: mỗi từ chỉ submit SM-2 **một lần** trong một phiên học.

## Quyết định đã chốt

| Chủ đề | Quyết định |
|---|---|
| Lưu "từ yếu" | Suy từ `review_logs` có sẵn, không đụng schema |
| Phạm vi bước nói | Chỉ từ yếu, tối đa 5 từ mỗi buổi |
| Màn "Từ đang yếu" | Route riêng `/weak`, vào từ một ô phụ trên trang chủ |
| Reader tô sáng | 3 trạng thái: đang học / đã thuộc / đang yếu |
| Bước nói khi worker tắt | Ẩn hoàn toàn, không hiện giai đoạn |

Ba điều dưới đây **là giả định của tôi**, người dùng chưa xác nhận — sửa được
mà không ảnh hưởng kiến trúc:

| Chủ đề | Giả định |
|---|---|
| Ngưỡng từ yếu | ≥ 2 lần `quality ≤ 2` trong 5 lần ôn gần nhất của thẻ |
| Vị trí giai đoạn từ yếu | Một giai đoạn riêng, đặt trước phần từ mới |
| Nội dung bước nói | Đọc câu ví dụ; thẻ không có câu ví dụ thì đọc từ đơn |

## 1. Từ yếu

### Định nghĩa

Một thẻ là "yếu" khi trong **5 bản ghi `review_logs` gần nhất** của nó có
**≥ 2 bản ghi `quality ≤ 2`**. Thẻ chưa có đủ 5 bản ghi thì xét trên số bản ghi
đang có.

Nhãn tự gỡ: ôn đúng vài lần thì các lần sai cũ trôi ra khỏi cửa sổ 5 lần và thẻ
rời danh sách. Đây là lý do chọn cửa sổ trượt thay vì đếm dồn từ trước đến nay —
người học phải thấy mình thoát khỏi danh sách được, nếu không nó thành bảng
điểm xấu vĩnh viễn.

### Xoay vòng dạng bài

Từ yếu phải được hỏi bằng **dạng bài khác lần trước**. Nguồn dữ liệu là
`daily_session_words.assigned_step` của phiên gần nhất có chứa thẻ đó — các
phiên cũ vẫn nằm trong DB. (`reviews.last_answer_mode` **không** dùng được:
`complete_learning` không hề ghi cột này, chỉ `POST /api/review/{card_id}` ghi.)

Ba dạng bài là `dictation` / `vi_en` / `en_vi`. Chọn ngẫu nhiên trong hai dạng
còn lại. Không có phiên cũ nào thì chọn ngẫu nhiên cả ba.

### API

`GET /api/review/weak` → `list[WeakWordOut]`

```
WeakWordOut:
  card: CardOut
  recent_wrong: int      # số lần quality <= 2 trong 5 lần gần nhất
  total_reviews: int
  last_step: str | None  # assigned_step của phiên gần nhất
  suggested_step: str    # dạng bài nên dùng lần này
```

Sắp xếp `recent_wrong` giảm dần, rồi `reviewed_at` gần nhất trước.

### Giai đoạn "Từ yếu" trong buổi học

Thứ tự mới: **Ôn tập → Từ yếu → Từ mới (3 màn) → Nói → Game**.

- Khi tạo phiên, ngoài từ due và 10 từ mới, lấy thêm **tối đa 5 từ yếu** chưa
  nằm trong danh sách due (từ due vốn đã được ôn rồi, thêm nữa là học hai lần).
  Chúng được thêm vào `daily_session_words` với `is_new = false` và
  `assigned_step = suggested_step`.
- Vì chúng là session word bình thường nên `complete_learning` submit SM-2 cho
  chúng đúng một lần như mọi từ khác — giữ nguyên luật của giai đoạn 1. Tác
  dụng thật: từ yếu được kéo lên học sớm hơn lịch SM-2 của nó.
- Phân biệt từ yếu với từ ôn thường trong API: `DailyWordOut` thêm trường
  **tính lúc trả response** `is_weak: bool`. Đây là thay đổi schema Pydantic,
  không phải schema DB.
- Không có từ yếu nào → giai đoạn này biến mất khỏi stepper.

### Màn `/weak`

- Danh sách từ yếu: từ, nghĩa, số lần sai gần đây, dạng bài gợi ý.
- Nút "Luyện ngay" chạy đúng `ExerciseCard` của buổi học, lần lượt hết danh sách.
- **Không đụng lịch SM-2** (không đổi `due_date`, `interval`, `ease_factor`):
  luyện thêm ngoài buổi học không được phép làm rối lịch, và luật một-lần-submit
  của phiên phải giữ nguyên.
- **Có ghi `ReviewLog`** với `rating_source = "weak"`. Nhờ vậy làm đúng nhiều
  lần thì thẻ tự rời danh sách yếu, và hoạt động vẫn tính vào chuỗi ngày/heatmap.
- Endpoint: `POST /api/review/weak/{card_id}` body `{ correct: bool }` → ghi
  `ReviewLog` với `quality = 4` nếu đúng, `2` nếu sai.
- Lối vào: một ô phụ trên trang chủ ("{n} từ đang yếu") cạnh ô "Đang đọc" và
  "Luyện nói". Không thêm mục nav — giai đoạn 1 vừa chốt nav gọn 4 mục.

## 2. Bước nói trong buổi học

- **Vị trí**: sau giai đoạn Từ yếu, trước phần từ mới. Áp cho đúng những từ yếu
  của phiên (tối đa 5).
- **Điều kiện hiện**: `useShadowingWorker()` trả `status === 'online'`. Offline
  thì giai đoạn không tồn tại, stepper không hiện, không có thông báo hụt hẫng.
- **Nội dung đọc**: `card.example_sentence`; rỗng thì đọc `card.front_text`.
- **Audio mẫu**: `example_audio_url` → `Mp3Player`; không có → `TtsPlayer`
  (cả hai đã có trong `components/shadowing/SegmentPlayer`).
- **Chấm**: `scoreRecording(blob, target)` của worker, hiện `ScoreDisplay`, ghi
  `createShadowAttempt({ source_type: 'card', card_id, target_text, transcript,
  score, word_results })`.
- **Không đụng SM-2**: từ đó đã được giai đoạn Từ yếu submit một lần rồi. Điểm
  nói chỉ để người học thấy và để thống kê shadowing.
- **Bỏ qua được**: nút "Bỏ qua bước nói" chuyển thẳng sang phần từ mới. Micro
  bị từ chối quyền → hiện lỗi của `useRecorder` và cho bỏ qua.

## 3. Reader tô sáng trạng thái từ

### API

`GET /api/articles/{article_id}/word-states` → `{ states: dict[str, str] }`

Khóa là từ đã chuẩn hóa (`article_cards.normalize_word`), giá trị là một trong
`learning` / `mastered` / `weak`. Chỉ trả những từ **vừa có thẻ của user vừa
xuất hiện trong bài** để payload không phình theo cả bộ sưu tập.

Thứ tự ưu tiên khi một từ thỏa nhiều điều kiện: `weak` > `mastered` > `learning`.

| Trạng thái | Điều kiện |
|---|---|
| `mastered` | `reviews.repetitions >= 3` — đúng định nghĩa `mastered_cards` đang dùng ở `/api/review/stats`, không phát minh ngưỡng mới |
| `learning` | có thẻ và `repetitions >= 1`, chưa đạt `mastered` |
| `weak` | theo định nghĩa mục 1 |

Thẻ mới lưu chưa học lần nào (`repetitions == 0`) **không** được tô — chúng đã
có dấu vàng "Từ cần nhớ" sẵn trong bài, tô thêm sẽ thành hai lớp nhiễu.

### UI

- `ReaderPage` đã tách token và có `cleanToken`; thêm nền nhạt theo trạng thái:
  `learning` → `--color-accent-2`, `mastered` → `--color-correct`, `weak` →
  `--color-warn`, tất cả ở độ mờ thấp để không cản việc đọc.
- Một chú thích nhỏ ba màu ở đầu bài, kèm nút bật/tắt tô sáng lưu ở
  `localStorage` khóa `flashie:reader-highlight`. Mặc định bật.
- Không đụng lớp highlight vàng "Từ cần nhớ" hiện có — đó là từ người dùng tự
  đánh dấu trong bài, khác khái niệm.

## 4. Phạm vi không làm

- Không thêm cột vào bảng đã có, không migration, không đổi thuật toán SM-2,
  luật chọn từ mới hay luật sinh ô chữ.
- Không đụng `ShadowingPage` — trang luyện nói riêng giữ nguyên.
- Không làm nhắc nhở đẩy, không bảng xếp hạng (đã loại từ giai đoạn 1).
- Không đụng nguồn bài đọc theo cấp độ — đó là giai đoạn 3.

## 5. File thay đổi

**Backend**

- Thêm: `services/weak_words.py` (định nghĩa từ yếu, xoay vòng dạng bài),
  `tests/test_weak_words.py`, `tests/test_daily_weak_phase.py`.
- Sửa: `routers/review.py` (+ `GET /weak`, `POST /weak/{card_id}`),
  `schemas/review.py` (+ `WeakWordOut`), `services/daily.py` (chọn thêm từ yếu
  khi tạo phiên), `schemas/daily.py` (+ `is_weak` trong `DailyWordOut`),
  `routers/daily.py` (điền `is_weak`), `routers/articles.py`
  (+ `GET /{id}/word-states`), `schemas/article.py` (+ `WordStatesOut`).

**Frontend**

- Thêm: `pages/WeakWordsPage.tsx`, `components/daily/steps/WeakStep.tsx`,
  `components/daily/steps/SpeakStep.tsx`, `api/weak.ts`.
- Sửa: `App.tsx` (route `/weak`), `hooks/useDailySession.ts` (hai giai đoạn
  mới), `pages/DailyPage.tsx`, `components/daily/DailyProgress.tsx` (nhãn giai
  đoạn mới), `components/home/HomeSideTiles.tsx` (ô "từ đang yếu"),
  `pages/ReaderPage.tsx` (tô sáng), `types/index.ts`.

## 6. Kiểm thử (pytest)

- **Định nghĩa từ yếu**: 2/5 lần sai gần nhất → yếu; 1/5 → không; sai cũ bị đẩy
  ra khỏi cửa sổ 5 lần → hết yếu; thẻ chưa có log nào → không yếu.
- **Xoay vòng dạng bài**: `suggested_step` khác `assigned_step` của phiên gần
  nhất; chưa có phiên cũ → nằm trong ba dạng hợp lệ.
- **Chọn từ cho phiên**: tối đa 5 từ yếu; từ đã nằm trong danh sách due không bị
  lấy lại; không có từ yếu → phiên như giai đoạn 1.
- **`is_weak`**: đúng cho từ yếu, sai cho từ due thường và từ mới.
- **`POST /weak/{card_id}`**: ghi `ReviewLog` với `rating_source="weak"`, và
  `reviews.due_date` / `interval` / `ease_factor` **không đổi**.
- **`word-states`**: chỉ trả từ có trong bài; ưu tiên `weak` > `mastered` >
  `learning`; thẻ `repetitions == 0` không xuất hiện.
- Toàn bộ test hiện có phải tiếp tục xanh, trừ
  `test_articles.py::test_article_card_accepts_a_multi_word_phrase` vốn **đã
  đỏ từ trước** giai đoạn 1 (đã xác minh ở commit `1d26f7b`) — không thuộc phạm
  vi giai đoạn này.

## 7. Rủi ro

| Rủi ro | Xử lý |
|---|---|
| Truy vấn "5 log gần nhất mỗi thẻ" tốn kém khi nhiều thẻ | Chỉ tính trên thẻ của user và giới hạn cửa sổ thời gian; `review_logs` đã có index `(user_id, reviewed_at)` |
| Kéo từ yếu lên học sớm làm rối cảm nhận về lịch ôn | Tối đa 5 từ/buổi, và chỉ lấy từ **không** due hôm nay |
| Buổi học dài thêm vượt 30 phút | Từ yếu ≤ 5 câu, bước nói ≤ 5 câu và bỏ qua được; đo lại sau vài buổi thật |
| Worker bật giữa buổi học | Trạng thái worker đọc một lần lúc dựng phiên trên client; bật muộn thì buổi sau mới có bước nói — chấp nhận, đổi lại không có giai đoạn nhảy ra giữa chừng |
| Tô sáng làm bài đọc rối mắt | Nền rất nhạt, có nút tắt, và không tô thẻ chưa học lần nào |
