# Daily Learning Flow — Thiết kế

Ngày: 2026-07-21

## Mục tiêu

Xây dựng flow học tập hàng ngày: mỗi ngày 10 từ mới + toàn bộ từ due theo SM2,
học qua chuỗi bước có chấm điểm, sau đó mở khóa trò chơi kết hợp ô chữ + nối
nghĩa tiếng Việt. Kết quả học và chơi được gộp vào một lần cập nhật SM2 cho mỗi
từ.

## Quyết định đã chốt

| Chủ đề | Quyết định |
|---|---|
| Phạm vi bước học | Từ mới đi đủ 4 bước; từ ôn tập làm 1 bước random |
| Chấm SM2 | Mỗi từ submit SM2 đúng 1 lần: submit khi xong phần học, kết quả game điều chỉnh lại sau (tính từ snapshot) |
| Phiên học | Lưu tiến độ trong DB; thoát giữa chừng quay lại học tiếp; qua ngày chưa xong thì học nốt phiên cũ mới được mở phiên mới |
| Chọn từ mới | Deck tạo trước học trước; deck còn < 10 từ thì học nốt và bù từ deck kế tiếp |
| Cảnh báo hết từ | Tổng từ chưa học ≤ 30 (3 ngày) → banner trên HomePage + màn tổng kết |
| Màn chia đôi | 2 panel cùng lúc: trái Việt→Anh, phải Anh→Việt; 10 từ chia random 5/5, mỗi từ 1 bên |
| Từ cho game | 10 từ mới + tối đa 5 từ ôn tập yếu nhất trong phiên |
| Luật ô chữ | Chỉ hiện nghĩa Việt — người chơi tự nhớ từ Anh để tìm trong lưới |
| Khi bí | Gợi ý theo cấp: cấp 1 chữ cái đầu + số chữ cái, cấp 2 hiện cả từ; gợi ý bị trừ điểm |
| Chấm Anh→Việt | So khớp mềm với back_text; không khớp thì hiện đáp án + tự xác nhận |
| Trả lời sai | Hiện đáp án ngay, từ quay lại cuối hàng đợi của bước đó, tăng wrong_count |
| Game không bắt buộc | Xong phần học là SM2 đã được ghi; game chỉ điều chỉnh thêm |
| Vị trí UI | Trang mới `/daily`; GamesPage thay bằng game mới; xóa 3 game cũ; ReviewPage giữ nguyên |
| Kiến trúc | Phương án A: phiên + tiến độ lưu DB, lưới ô chữ sinh ở backend và lưu theo phiên |

## 1. Dữ liệu & chọn từ

### Bảng mới

**`daily_sessions`**

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | String(36) PK | uuid |
| user_id | FK users.id, index | |
| session_date | Date | ngày mở phiên |
| status | String | `learning` → `game` → `done` |
| phase | String | giai đoạn đang dở: `review` / `flip` / `dictation` / `split` / `game` |
| puzzle_json | Text nullable | lưới ô chữ + vị trí từ, sinh khi xong phần học |
| created_at / completed_at | DateTime | |

Ràng buộc: mỗi user chỉ có tối đa 1 phiên `status == learning`. Chưa xong phần
học thì `GET /session` trả về phiên cũ, không tạo mới dù đã sang ngày. Phiên ở
trạng thái `game` (đã học xong, chưa chơi) khi sang ngày mới sẽ tự chuyển
`done` — game chỉ chơi được trong ngày, bỏ qua thì không điều chỉnh SM2.

**`daily_session_words`**

| Cột | Kiểu | Ghi chú |
|---|---|---|
| id | String(36) PK | |
| session_id | FK daily_sessions.id, index | |
| card_id | FK cards.id | |
| is_new | Boolean | từ mới hay từ ôn tập |
| assigned_step | String | từ ôn tập: bước random (`dictation` / `vi_en` / `en_vi`); từ mới: bên được chia ở màn chia đôi (`vi_en` / `en_vi`) |
| steps_done | String | JSON các bước đã hoàn thành (resume) |
| wrong_count | Integer default 0 | tổng số lần sai qua các bước học |
| hint_count | Integer default 0 | cấp gợi ý đã dùng trong game (0/1/2) |
| learning_quality | Integer nullable | quality đã submit khi xong phần học |
| game_correct | Boolean nullable | kết quả nối sau xác nhận |
| in_game | Boolean | từ có được chọn vào game không |
| prev_ease / prev_interval / prev_reps | Float/Int/Int | snapshot review trước phiên — để game tính lại SM2 |

### Chọn từ khi tạo phiên

- **Từ mới**: thẻ có review `repetitions == 0` và `reviewed_at IS NULL`
  (thẻ chưa có review row thì tạo). Chọn deck theo `Deck.created_at` tăng dần,
  lấy deck cũ nhất còn từ chưa học, random 10 từ trong đó. Nếu deck còn < 10 từ:
  lấy hết rồi bù từ deck kế tiếp cho đủ 10 (ngoại lệ duy nhất của quy tắc
  "cùng 1 bộ thẻ").
- **Từ ôn tập**: mọi thẻ của user có `due_date <= today` và `repetitions > 0`.
- **Từ cho game** (chọn khi xong phần học): 10 từ mới + tối đa 5 từ ôn tập có
  `wrong_count` cao nhất (chỉ lấy từ có wrong_count > 0; hòa nhau thì random).

### API — router `/api/daily`

| Endpoint | Chức năng |
|---|---|
| `GET /session` | Trả phiên chưa xong hiện có, hoặc tạo phiên mới cho hôm nay (chọn từ, random assigned_step). Kèm dữ liệu card đầy đủ để render. |
| `POST /answer` | Ghi kết quả 1 câu: card_id, step, correct, (self_confirm). Cập nhật steps_done / wrong_count. |
| `POST /complete-learning` | Kiểm tra đã xong hết các bước → tính quality, submit SM2 + ReviewLog cho mọi từ, chọn từ cho game, sinh lưới, status → `game`. |
| `GET /game` | Trả lưới + danh sách nghĩa (xáo trộn) + trạng thái đã tìm/đã nối. 409 nếu status còn `learning`. |
| `POST /game/hint` | Tăng hint_count của 1 từ, trả nội dung gợi ý theo cấp. |
| `POST /game/found` | Đánh dấu từ đã tìm thấy trong lưới (server xác nhận đúng vị trí). |
| `POST /game/confirm` | Nhận toàn bộ cặp nối → chấm đúng/sai, điều chỉnh SM2 từ snapshot, status → `done`. Trả kết quả từng cặp. |
| `GET /status` | Số từ mới còn lại toàn bộ deck, trạng thái phiên hôm nay — cho HomePage banner + CTA. |

Xóa router `/api/games` và 3 component game cũ (SentenceBuilder, DictationCloze,
ConceptMatch).

## 2. Flow học

Thứ tự giai đoạn trong phiên: **Ôn tập → Từ mới (3 màn) → Game**.

### Giai đoạn ôn tập

Mỗi từ due làm đúng 1 bước, random sẵn khi tạo phiên (lưu `assigned_step` để
resume không đổi đề): nghe & điền / Việt→Anh / Anh→Việt.

### Giai đoạn từ mới — 10 từ, 3 màn tuần tự

1. **Lật thẻ & nghe**: dùng lại FlipCard, tự phát audio. Không chấm điểm.
2. **Nghe & điền**: phát audio, gõ lại từ tiếng Anh.
3. **Màn chia đôi**: trái = nghĩa Việt → gõ từ Anh; phải = từ Anh → gõ nghĩa
   Việt. 10 từ chia random 5/5 theo `assigned_step`.

### Chấm từng câu

- **Gõ từ tiếng Anh** (nghe & điền, Việt→Anh): so sánh sau chuẩn hóa
  (lowercase, trim, bỏ dấu câu thừa) với `front_text` đã làm sạch.
- **Gõ nghĩa Việt** (Anh→Việt): chuẩn hóa dấu/hoa thường rồi so khớp mềm với
  `back_text` (khớp một phần cũng tính). Không khớp → hiện đáp án + hỏi
  "Bạn có đúng không?" để tự xác nhận (`self_confirm`).
- **Audio**: `audio_url` nếu có, fallback `speechSynthesis` (pattern đã dùng ở
  DictationClozeGame).
- **Sai**: hiện đáp án đúng ngay, từ xếp lại cuối hàng đợi của bước hiện tại,
  làm đến khi đúng. Mỗi lần sai +1 `wrong_count`. Tự xác nhận "sai" cũng tính
  là 1 lần sai.

### Tính quality khi xong phần học

| wrong_count | quality |
|---|---|
| 0 | 5 |
| 1 | 4 |
| 2 | 3 |
| ≥ 3 | 2 |

`POST /complete-learning` submit SM2 (compute_sm2 hiện có) + ghi ReviewLog cho
mọi từ trong phiên — heatmap và streak hoạt động không đổi. Snapshot
prev_ease/prev_interval/prev_reps đã lưu từ lúc tạo phiên.

## 3. Game — ô chữ + nối nghĩa (một màn hình)

### Sinh lưới (backend, lưu `puzzle_json`)

- Chuẩn hóa từ: viết hoa, bỏ khoảng trắng/gạch nối (`give up` → `GIVEUP`),
  bỏ ký tự không phải chữ cái. Hai từ trùng nhau sau chuẩn hóa → chỉ lấy 1 vào
  game.
- Kích thước: cạnh = max(độ dài từ dài nhất, ⌈√(tổng chữ cái × 2)⌉), tối đa 13.
  Không bắt buộc vuông n×n — có thể bớt hàng nếu thừa.
- Từ > 13 chữ cái không vào lưới: tự đánh dấu "đã tìm thấy", chỉ cần nối nghĩa.
- Hướng đặt: ngang trái→phải, dọc trên→xuống, chéo xuống-phải. Không có từ
  ngược. Ô trống lấp chữ cái ngẫu nhiên.
- Thuật toán: đặt từ dài trước, thử vị trí ngẫu nhiên có tận dụng ô giao nhau;
  không đặt nổi → tăng kích thước (đến 13) rồi thử lại; vẫn không được → từ đó
  chuyển sang dạng "chỉ nối nghĩa".

### Màn chơi

- Trái: lưới ô chữ, kéo chọn dãy ô. Phải: danh sách nghĩa tiếng Việt xáo trộn —
  **không hiện từ tiếng Anh**.
- Tìm đúng từ → dãy ô sáng, từ thành chip trong khay "đã tìm thấy"
  (`POST /game/found`, server xác nhận vị trí).
- Kéo chip thả vào nghĩa để nối; nối lại tự do trước khi xác nhận. Chưa biết
  đúng/sai cho đến khi xác nhận.
- Gợi ý mỗi nghĩa: cấp 1 = chữ cái đầu + số chữ cái; cấp 2 = hiện cả từ tiếng
  Anh. Lưu `hint_count`.
- **Xác nhận** bật khi mọi từ đã tìm thấy và đã nối. Sau xác nhận hiện
  đúng/sai từng cặp + màn tổng kết phiên.

### Điều chỉnh SM2 sau xác nhận

Tính lại từ snapshot (prev_*) và ghi đè review — giữ nguyên tắc mỗi từ chỉ có
1 lần submit hiệu lực:

| Kết quả game | Điều chỉnh |
|---|---|
| Nối đúng, không gợi ý | Giữ nguyên kết quả phần học |
| Dùng gợi ý cấp 1 | recompute từ snapshot với quality = learning_quality − 1 (min 1) |
| Nối sai hoặc gợi ý cấp 2 | recompute từ snapshot với quality = 2 (due ngày mai, học lại) |

ReviewLog đã ghi ở phần học giữ nguyên (chỉ phục vụ heatmap/đếm).
Không chơi game → không điều chỉnh gì; phiên vẫn được tính hoàn thành phần học.

## 4. UI

- **Trang mới `/daily` — "Học hôm nay"**: stepper các giai đoạn
  (Ôn tập → Lật thẻ → Nghe & điền → Chia đôi → Game), resume đúng chỗ dở.
- **HomePage**: card CTA "Học hôm nay" (số từ mới + số từ due, trạng thái
  phiên). Banner vàng khi tổng từ chưa học ≤ 30: "Sắp hết từ mới (còn X) —
  tạo thêm thẻ hoặc deck mới" + nút tạo. Banner cũng hiện ở màn tổng kết phiên.
- **GamesPage**: phiên hôm nay chưa xong phần học → thông báo "Học bài rồi mới
  chơi" + nút "Học bài ngay" → `/daily`. Xong rồi → vào thẳng game (cùng
  component với bước game trong `/daily`).
- **ReviewPage**: giữ nguyên. Ôn tự do trước chỉ làm giảm số từ due của phiên
  hôm sau.

## 5. Edge case

- Hết sạch từ mới → phiên chỉ có ôn tập; game dùng tối đa 15 từ ôn tập (ưu
  tiên wrong_count cao).
- Không có từ due → phiên chỉ có 10 từ mới.
- Không có cả hai → màn "Hôm nay hết bài" + gợi ý tạo deck.
- Thẻ bị xóa giữa phiên → bỏ qua từ đó khi resume (session word mồ côi không
  chặn complete).
- Thẻ không có audio → speechSynthesis.
- Phiên cũ chưa xong nhưng thẻ due mới xuất hiện hôm nay → không thêm vào
  phiên cũ; sẽ vào phiên kế tiếp.

## 6. Testing (pytest backend)

- Chọn từ: deck cũ nhất trước, bù deck kế tiếp khi < 10, không lặp từ đã học.
- Sinh lưới: mọi từ đặt được và tìm lại được đúng vị trí; kích thước ≤ 13;
  từ quá dài rơi về "chỉ nối nghĩa"; từ trùng chuẩn hóa bị khử.
- Quality: mapping wrong_count → quality; submit đúng 1 lần; ReviewLog ghi đủ.
- Game: điều chỉnh SM2 từ snapshot đúng bảng trên; `GET /game` trả 409 khi
  chưa complete-learning; confirm chấm đúng cặp nối.
- Session: resume giữ nguyên assigned_step; phiên `learning` qua ngày vẫn chặn
  phiên mới; phiên `game` qua ngày tự chuyển `done` và cho mở phiên mới.
