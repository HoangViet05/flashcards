# Nâng trải nghiệm học — Giai đoạn 1: Vỏ & luồng

Ngày: 2026-07-25

## Mục tiêu

Biến app từ "trang quản lý bộ thẻ có kèm chức năng học" thành "app học tiếng Anh
mà việc học là trung tâm": vào app biết ngay phải làm gì, mỗi câu trả lời có
phản hồi tức thì, kết thúc buổi học có tổng kết, và toàn bộ giao diện dùng chung
một bộ token thay vì mỗi màn một kiểu.

Giai đoạn này **không** thêm tính năng học mới và **không** đổi schema DB.

## Bối cảnh

- Người dùng: tác giả + vài người thân/bạn bè. Laptop là chính, điện thoại phải
  dùng được tử tế.
- Hai nhóm mục tiêu: người mất gốc xây vốn từ nền, và đọc tài liệu chuyên ngành.
- Triển khai: frontend Vercel, backend Render, DB + media Supabase. Các tính
  năng AI/Whisper chạy trên máy host của tác giả, **có lúc bật lúc tắt**.
- Nguồn thẻ thật của app là **bài đọc trong Reader**: lưu từ trong bài → sinh
  thẻ; bộ 4000 Essential Words chỉ là thư viện tham chiếu để làm giàu thẻ
  (phiên âm, câu ví dụ, audio, ảnh). Không phải bộ để học tuần tự.
- Buổi học mong muốn: 20–30 phút, học sâu.

## Quyết định đã chốt

| Chủ đề | Quyết định |
|---|---|
| Hướng thẩm mỹ | Giữ dark glass hiện tại nhưng làm sạch: bớt gradient/glow trang trí, tăng tương phản chữ, thống nhất icon. Không đổi sang theme sáng |
| Trang chủ | Trang chủ = buổi học hôm nay, đúng một hành động chính. Đọc/Nói là ô phụ; quản lý bộ thẻ xuống hàng hai |
| Điều hướng | `/` thành trang học; quản lý bộ thẻ chuyển sang `/library`; `/stats` được đưa vào nav; `/games` chuyển hướng về `/daily` |
| Bước nói | Ẩn hoàn toàn khi worker Whisper offline, không hiện bước hụt hẫng |
| Động lực | Tiến độ rõ ràng + phản hồi tức thì + chuỗi ngày. Nhắc nhở **chỉ trong app**, không Web Push, không email. Không bảng xếp hạng |
| Người dùng mới | Chỉ cần màn rỗng có hướng dẫn rõ, không làm wizard onboarding |
| Ô "Trợ lý AI" | Xóa khỏi trang chủ và trang chi tiết bộ thẻ, xóa luôn `RobotAnimation` và hằng `AI_ENABLED` (git giữ lịch sử, khôi phục khi làm tính năng AI) |
| Âm thanh đúng/sai | Mặc định bật, có nút tắt lưu ở `localStorage` |
| Test frontend | Không cài framework test trong giai đoạn này; kiểm chứng bằng chạy app thật trong trình duyệt |

Các hạng mục đã thống nhất nhưng **thuộc giai đoạn sau**, không nằm trong spec
này: `lapses` tích lũy + chèn từ yếu đổi dạng bài + màn "Từ đang yếu" + bước nói
trong buổi học + Reader tô sáng từ đang học (giai đoạn 2); thư viện bài đọc theo
cấp độ từ nguồn mở (VOA Learning English — public domain, Simple English
Wikipedia — CC BY-SA, phải ghi nguồn) và AI sinh bài đọc (giai đoạn 3).

## 1. Nền thị giác

### 1.1 Token

Tạo `frontend/src/styles/tokens.css`, khai báo qua `@theme` của Tailwind v4 và
import từ `index.css`.

| Nhóm | Token | Ghi chú |
|---|---|---|
| Bề mặt | `--surface-1/2/3` | Thay cho `bg-white/[.03]`, `[.04]`, `[.045]`, `[.05]`, `[.07]` đang tồn tại song song không lý do |
| Viền | `--border-subtle`, `--border-strong` | |
| Chữ | `--text-strong`, `--text-body`, `--text-muted` | `--text-muted` phải đạt tương phản ≥ 4.5:1 trên nền nội dung. `text-slate-500` hiện tại chỉ ~3:1 — đây là nguyên nhân chính khiến giao diện khó đọc |
| Trạng thái | `--state-correct`, `--state-wrong`, `--state-warn` | Dùng thống nhất ở mọi màn học |
| Nhấn | `--accent` (tím), `--accent-2` (cyan) | Giữ đúng nhận diện hiện tại |
| Chuyển động | `--dur-fast` 150ms, `--dur-base` 250ms, `--dur-slow` 400ms | |

Quy tắc áp dụng: mọi màu mới viết trong giai đoạn này phải dùng token. Không
sửa lại toàn bộ file cũ trong một lần — chỉ đổi những file mà giai đoạn này
vốn đã phải chạm vào (danh sách ở mục 5).

### 1.2 Dọn dẹp

- Xóa `frontend/src/components/RobotAnimation.tsx` (425 dòng) và mọi chỗ dùng.
- Xóa khỏi `index.css` các cụm CSS chỉ phục vụ robot/AI: keyframes `aiEnter`,
  `aiExit`, `aiFloat`, `aiPop`, `aiBump`, `aiShake`, `aiDot`, `coinPop`,
  `holoFloat`, `holoRing`, `holoFlicker`, `scanlinesMove`, `glyphScan`,
  `glyphLineIn`, `waveBar`, `matrixStamp`.
  **Giữ lại** `flyIntoDeck` + `.animate-fly-into-deck` (`DeckCard` đang dùng),
  `letterFlight` (`WordSearchGrid`), `wordCardAssemble` (`DailyGamePanel`),
  `pulse-glow` (`StatsPage`), `game-stage*`, `daily-status-*`, `app-recovery-*`,
  `shadowing-*`.
- Xóa ô "Trợ lý AI tạo thẻ nhanh" ở `HomePage.tsx` và ô "Tạo lô thẻ AI cho chủ
  đề này" ở `DeckDetailPage.tsx`, cùng hằng `AI_ENABLED`, state `aiTopic`,
  `aiCount`, `isGenerating`, `robotAction`, `globalFlyingCards`, component
  `FlyingGlassCard` và hàm `handleGenerateAICard`.
- `frontend/src/api/ai.ts` giữ nguyên (backend `routers/ai.py` không đổi) — chỉ
  bỏ nơi gọi ở UI.
- Nền trang: bỏ 3 lớp `radial-gradient` và lưới ô vuông `body::before` phủ toàn
  màn, thay bằng một lớp nền tĩnh rất nhẹ.
- Emoji trong khung giao diện (nút, tiêu đề, nhãn bước) thay bằng SVG cùng bộ
  với `Navbar` (stroke 1.9, `currentColor`). Emoji chỉ còn ở nội dung ăn mừng
  của màn tổng kết.
- Mở rộng khối `@media (prefers-reduced-motion: reduce)` hiện có để phủ mọi
  animation còn lại sau khi dọn.

## 2. Trang chủ = buổi học hôm nay

### 2.1 Điều hướng

| Route | Trước | Sau |
|---|---|---|
| `/` | Quản lý bộ thẻ | **Trang học** (`HomePage` mới) |
| `/library` | — | Quản lý bộ thẻ: lưới bộ thẻ, tạo bộ thẻ, nhập Anki, thư viện Anki (chuyển từ `HomePage` cũ) |
| `/daily` | Phiên học | Không đổi |
| `/stats` | Có route nhưng không có lối vào | Icon "Tiến độ" trên nav |
| `/games` | Mục trên nav | `Navigate to="/daily" replace`, bỏ khỏi nav (game vốn là bước cuối của phiên) |

Nav còn 4 mục: **Học hôm nay** (`/`) · **Đọc** (`/reader`) · **Nói**
(`/shadowing`) · **Thư viện** (`/library`); bên phải là icon Tiến độ (`/stats`),
tài khoản, đăng xuất. Chuỗi ngày **không** hiện trên nav — nav hiện không gọi API
nào, thêm số liệu vào đó sẽ buộc mọi trang phải tải thêm; chuỗi ngày chỉ hiện ở
hero trang chủ và màn tổng kết.

`GamesPage.tsx` bị xóa; `DailyGamePanel` vẫn được `/daily` dùng như hiện tại.

### 2.2 Nội dung trang chủ

Bốn khối, xếp dọc:

1. **Hero buổi học** — vòng tiến độ % hôm nay; tiêu đề "Hôm nay có {N} từ chờ
   bạn"; dòng phụ "{new} từ mới · {due} từ ôn · ~{phút} phút · chuỗi {streak}
   ngày"; nút chính **Bắt đầu buổi học** → `/daily`. Nhãn nút đổi theo trạng
   thái phiên: `learning` → "Học tiếp", `game` → "Vào phần chơi", `done` →
   "Đã xong hôm nay". Ước lượng phút = `new × 60s + due × 20s`, làm tròn lên 5.
2. **Hai ô phụ**
   - *Đang đọc*: tên bài đọc gần nhất + số từ đã lưu từ bài đó mà chưa học →
     `/reader/{id}`. Chưa có bài nào → "Chưa có bài đọc" + nút sang `/reader`.
   - *Luyện nói*: gọi `getWorkerHealth()` (timeout 3s, đã có sẵn). Online → nút
     vào `/shadowing`. Offline/lỗi → thẻ mờ, nhãn "Máy chấm đang tắt", không
     bấm được. Không hiện spinner quá 3s.
3. **Banner** (tối đa một cái, theo thứ tự ưu tiên)
   - Chuỗi đang có ≥ 1 ngày và hôm nay chưa học xong → "Sắp mất chuỗi {n} ngày".
   - `low_new_words` (đã có trong `DailyStatusOut`) → "Sắp hết từ mới (còn {n})"
     + nút sang `/reader`.
4. **Chân trang**: "Đã thuộc {mastered}/{total} từ · {decks} bộ thẻ" + link
   sang `/library`.

### 2.3 Màn rỗng

Khi `total_cards == 0`: thay toàn bộ hero bằng một khối hướng dẫn ba bước
(chọn bài đọc → bấm vào từ chưa biết để lưu → quay lại đây học), nút chính
"Chọn bài đọc" → `/reader`. Không làm wizard nhiều bước.

### 2.4 API — `GET /api/daily/home`

Endpoint mới trong `routers/daily.py`. Lý do gộp: trang chủ hiện phải gọi 3
request rời (`getDecks`, `getAnkiLibrary`, `daily/status`) mà vẫn thiếu số "đã
thuộc" và bài đọc gần nhất.

```
DailyHomeOut:
  new_count: int              # từ mới của phiên hôm nay
  due_count: int              # từ đến hạn
  session_status: str         # none | learning | game | done
  steps_total: int            # tổng số bước chấm điểm của phiên
  steps_done: int             # số bước đã hoàn thành → % vòng tiến độ
  streak: int
  studied_today: bool
  mastered_cards: int
  total_cards: int
  deck_count: int
  low_new_words: bool
  new_remaining: int
  latest_article: { id: str, title: str, unlearned_saved_words: int } | None
```

Dùng lại `services/daily.py` cho phần phiên và `routers/review.py::stats` cho
`streak` / `mastered_cards` / `total_cards`; `latest_article` lấy bài `Article`
mới nhất của user, đếm thẻ sinh từ bài đó có `repetitions == 0`.

`GET /api/daily/status` giữ nguyên, không xóa: đã có test phủ và `/home` chỉ bọc
thêm chứ không thay thế.

## 3. Buổi học

### 3.1 Tách `DailyPage`

`DailyPage.tsx` hiện là 35 dòng nhưng mỗi dòng dài hàng nghìn ký tự, gộp cả
tải phiên, 5 hàng đợi, điều phối giai đoạn và render. Tách thành:

| File | Trách nhiệm |
|---|---|
| `hooks/useDailySession.ts` | Tải phiên, dựng 5 hàng đợi, resume, gửi `postDailyAnswer`, chuyển giai đoạn, đếm `steps_done/steps_total` |
| `components/daily/DailyProgress.tsx` | Thanh tiến độ + tên giai đoạn + nút Tạm dừng |
| `components/daily/steps/ReviewStep.tsx` | Giai đoạn ôn tập |
| `components/daily/steps/FlipStep.tsx` | Lật thẻ & nghe |
| `components/daily/steps/DictationStep.tsx` | Nghe & điền |
| `components/daily/steps/SplitStep.tsx` | Màn chia đôi |
| `components/daily/DailySummary.tsx` | Màn tổng kết cuối buổi |
| `pages/DailyPage.tsx` | Chỉ còn ghép các mảnh trên theo `phase` |

Hành vi chấm điểm, thứ tự giai đoạn, luật đẩy từ sai xuống cuối hàng đợi và
mọi lời gọi API **giữ nguyên** — đây là tách cấu trúc, không đổi logic.

### 3.2 Phản hồi tức thì (`ExerciseCard`)

Hiện trả lời đúng thì chuyển câu im lặng, không có gì xác nhận. Thêm:

- Trạng thái `correct`: viền + nhãn theo `--state-correct`, hiện ~700ms rồi tự
  sang câu sau. Trong lúc đó khóa ô nhập để không gõ nhầm sang câu mới.
- Trạng thái sai: rung ngang nhẹ (≤ 300ms) + viền `--state-wrong`, giữ nguyên
  luồng hiện có (hiện đáp án, nút Tiếp tục).
- **Combo**: đếm chuỗi đúng liên tiếp trong phiên, hiện chip ở mốc 3/5/10; sai
  một câu là về 0. Chỉ là hiển thị, không ảnh hưởng SM-2.
- **Âm thanh**: hai tiếng ngắn đúng/sai tạo bằng WebAudio `OscillatorNode`
  (không thêm file media). Mặc định bật; nút tắt/bật đặt cạnh nút Tạm dừng,
  lưu `localStorage` khóa `flashie:sound`. Khởi tạo `AudioContext` sau tương
  tác đầu tiên để không bị trình duyệt chặn.
- Mọi hiệu ứng trên tôn trọng `prefers-reduced-motion` (bỏ rung, giữ màu).

### 3.3 Tiến độ và điểm dừng

- Thanh tiến độ tính theo **số bước đã hoàn thành / tổng số bước của phiên**,
  lấy từ `steps_done` của từng `DailyWord`, để câu trả lời sai (bị đẩy lại cuối
  hàng) không làm thanh tụt lùi.
  `steps_total` = (số từ ôn × 1) + (số từ mới × 3).
- Nút **Tạm dừng** ở mọi bước → quay về `/`. Backend đã hỗ trợ resume; hiện chỉ
  thiếu lối ra ở UI.
- Giữa các giai đoạn có màn chuyển ngắn nêu rõ vừa xong gì, sắp tới gì.

### 3.4 Màn tổng kết

Hiện sau khi xong phần học, `phase` chuyển thẳng sang `game`. Chèn `DailySummary`
trước đó, hiển thị: số từ đã học, độ chính xác (`đúng lần đầu / tổng lượt`),
thời gian buổi học (đo ở client từ lúc mở phiên), chuỗi ngày sau khi cập nhật,
"đã thuộc X/Y từ", danh sách tối đa 5 từ sai nhiều nhất, và hai nút: "Chơi ô
chữ" (nếu `status == game`) hoặc "Về trang chủ".

`DailySummary` thay phần hiện đang render ở `phase === 'done'` (hiện là
`DailyStatusHero kind="complete"` + `DailyCta`). `DailyStatusHero` **giữ lại**
cho `phase === 'empty'` (hôm nay không có từ nào để học).

### 3.5 Mobile

- Màn chia đôi: `md:grid-cols-2` → dưới `md` xếp dọc, mỗi lần chỉ hiện panel
  đang có từ chờ, có nhãn rõ đang ở bên nào.
- Vùng bấm ≥ 44×44px cho mọi nút trong màn học.
- Ô nhập luôn nằm trên bàn phím ảo (`scrollIntoView` khi focus).

## 4. Phạm vi không làm

- Không đổi thuật toán SM-2, luật chọn từ, luật sinh ô chữ.
- Không đổi schema DB, không migration.
- Không thêm `/review` — hiện **không tồn tại** route này, lối học duy nhất là
  `/daily`. Không phát sinh màn học mới trong giai đoạn này.
- Không đụng `ReaderPage`, `ShadowingPage`, `StatsPage` ngoài việc đổi màu theo
  token nếu đã phải sửa file.
- Không thêm framework test frontend.

## 5. File thay đổi

**Frontend**

- Thêm: `styles/tokens.css`, `pages/LibraryPage.tsx`, `hooks/useDailySession.ts`,
  `components/daily/DailyProgress.tsx`, `components/daily/DailySummary.tsx`,
  `components/daily/steps/{Review,Flip,Dictation,Split}Step.tsx`,
  `utils/feedbackSound.ts`.
- Sửa: `App.tsx` (route), `components/Navbar.tsx` (4 mục + Tiến độ),
  `pages/HomePage.tsx` (viết lại thành trang học), `pages/DailyPage.tsx` (rút
  gọn), `components/daily/ExerciseCard.tsx` (phản hồi), `index.css` (dọn + import
  token), `api/daily.ts` (+ `getDailyHome`), `types/index.ts` (+ `DailyHome`).
- Xóa: `components/RobotAnimation.tsx`, `pages/GamesPage.tsx`,
  `components/daily/DailyCta.tsx` (bị hero mới thay thế).

**Backend**

- Sửa: `routers/daily.py` (+ `GET /home`), `schemas/daily.py` (+ `DailyHomeOut`),
  `services/daily.py` (hàm gom số liệu trang chủ).

## 6. Kiểm thử

**pytest** (`backend/tests/test_daily_home.py` mới):

- User rỗng (không thẻ, không bài đọc) → `total_cards == 0`, `latest_article is
  None`, không lỗi.
- Có phiên `learning` dở → `session_status == "learning"`, `steps_done` khớp số
  bước đã ghi, `steps_total` = ôn×1 + mới×3.
- `mastered_cards`, `streak`, `deck_count` khớp giá trị `/api/review/stats` trả
  về cho cùng user.
- `latest_article` trả bài mới nhất và đếm đúng số thẻ sinh từ bài đó còn
  `repetitions == 0`.
- Toàn bộ test daily hiện có phải tiếp tục xanh (không đổi logic phiên).

**Trình duyệt** — chạy app thật, kiểm và chụp: trang chủ có thẻ / trang chủ rỗng,
buổi học ở từng giai đoạn, trả lời đúng và sai, màn tổng kết, ô "Luyện nói" ở cả
hai trạng thái worker, và toàn bộ luồng ở khổ điện thoại.

## 7. Rủi ro

| Rủi ro | Xử lý |
|---|---|
| Đổi `/` sang trang học làm mất lối vào quen thuộc của bộ thẻ | Link "quản lý bộ thẻ" ở chân trang chủ + mục "Thư viện" trên nav; `/decks/:id` giữ nguyên |
| Tách `DailyPage` làm hỏng resume | Tách trước, không đổi logic; chạy lại toàn bộ test daily; thử tay kịch bản thoát giữa chừng rồi vào lại |
| `getWorkerHealth` chậm làm trang chủ đứng | Gọi tách khỏi luồng tải chính, timeout 3s, mặc định coi là offline |
| Dọn CSS làm vỡ màn chưa đụng tới | Chỉ xóa các cụm đã xác minh không còn nơi dùng (`grep` trước khi xóa); chạy `npm run build` sau mỗi đợt xóa |
