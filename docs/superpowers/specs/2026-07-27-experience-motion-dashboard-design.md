# Nâng trải nghiệm: chuyển động, phản hồi và dashboard

Ngày: 2026-07-27
Trạng thái: đã chốt với chủ sản phẩm
Baseline: `b2bb34b` trên `main`

## Mục tiêu

Giao diện đã gần đúng ý chủ sản phẩm. Việc còn thiếu là **cảm giác khi dùng**:
màn hình đổi trạng thái mà không có chuyển động, thao tác không có phản hồi đã
tay, và trang `/stats` chỉ là bảng số tĩnh.

Đợt này giải quyết ba việc:

1. Dựng một **hệ chuyển động dùng chung** thay cho các giá trị rải rác hiện tại.
2. Dựng một **đường ống phản hồi** (hình + tiếng + rung) để mọi màn học phản hồi
   giống nhau.
3. **Dựng lại `/stats`** thành dashboard trả lời được ba câu hỏi cụ thể, và sửa
   lỗi múi giờ đang làm sai mọi số liệu theo ngày.

Không thêm tính năng học mới. Không đổi hướng thẩm mỹ: giữ nguyên dark glass và
bộ nhận diện hiện tại.

## Bối cảnh và số liệu hiện trạng

Đo trên `frontend/src` tại baseline:

| Chỉ số | Hiện tại | Ý nghĩa |
|---|---|---|
| Khai báo `transition` | 22 | Hầu hết đổi trạng thái là nhảy tức thì |
| Khai báo `animation` | 56 | Dồn hết vào `legacy.css` (games/shadowing cũ) |
| `@keyframes` | 49 | `orb-wrong` định nghĩa trùng ở `legacy.css` và `AiOrb.css` |
| Lần dùng `var(--dur-*)` | 8 | Token thời lượng có nhưng gần như không ai dùng |
| Token easing | 0 | 7 đường cong `cubic-bezier` khác nhau, hardcode toàn bộ |
| Thư viện animation | không có | Toàn bộ là CSS thuần |

Ba vấn đề chủ sản phẩm nêu — "quá ít/khô khan", "phản hồi thao tác yếu",
"không nhất quán" — khớp chính xác với ba dòng trên.

## Quyết định đã chốt

| Quyết định | Chọn | Lý do loại phương án khác |
|---|---|---|
| Chất chuyển động | Hai tầng: **A · điềm đạm** cho thao tác lặp lại, **B · nảy** cho khoảnh khắc thưởng | Chỉ A thì vẫn khô; chỉ B thì lặp vài chục lần mỗi buổi sẽ thành ồn |
| Kỹ thuật | **CSS token + Web Animations API** | Thư viện `motion` tốn ~34 KB gzip và tạo hai hệ chuyển động song song — đúng cái đang muốn sửa |
| Kênh phản hồi | Chuyển động + **âm thanh** + **rung** | Chuẩn hoá toast bị loại khỏi phạm vi đợt này |
| Nguồn âm thanh | **Dùng lại bộ wav đã có** trong `public/audio/`, thêm `levelup.wav` bằng script đã có | Bộ tổng hợp WebAudio từng được đề xuất là thừa — xem "Sửa đổi sau khi rà code" |
| Mục đích dashboard | Động lực + chẩn đoán + lịch sử | "Kho từ của tôi" bị loại |
| Chẩn đoán | "Từ nào tôi hay quên nhất" + "Tôi có đang học đều không" | "Kỹ năng nào tụt lại" và "trí nhớ lên hay xuống" bị loại |
| Lịch sử | Heatmap bấm được **+** panel chi tiết bên cạnh | |
| Phân đợt | Một spec, plan chia 3 đợt | Mỗi đợt xong là dùng thử được ngay |

Chủ sản phẩm chưa nêu được "vài trải nghiệm khác" nên phần đó **nằm ngoài phạm
vi** đợt này; sẽ bổ sung sau khi dùng thử.

## Sửa đổi sau khi rà code (2026-07-27, đã chốt)

Ba giả định trong bản đầu của spec này sai. Bản hiện tại đã sửa; ghi lại ở đây
để không ai khôi phục lại hướng cũ.

1. **Không xây bộ tổng hợp WebAudio.** `frontend/public/audio/` đã có
   `correct.wav`, `wrong.wav`, `combo.wav`, `complete.wav`, `checkpoint.wav`,
   `ui.wav` (tạo 2026-07-26), kèm `ATTRIBUTION.md` xác nhận là synthesis gốc,
   MIT, và script sinh ra chúng ở `frontend/scripts/generate_original_audio.py`.
   `AudioProvider.feedback()` đã phát chúng; `ExerciseCard` đã gọi. Viết engine
   mới sẽ vứt bỏ tài sản có sẵn để đổi lấy chất tiếng kém hơn.
2. **Không thêm setting mới, nhưng cũng không nối vào `silent`/`reduceEffects`.**
   `UserPreference` đã có sẵn `sfx_enabled`, `haptic_enabled`, `feedback_enabled`,
   `sfx_volume`, `master_volume`. `AudioProvider` đang bỏ qua toàn bộ và hardcode
   `volume = .28`. Phải nối vào đúng các trường này.
3. **`/api/review/heatmap` không dùng được cho vùng Nhịp học.** Endpoint đó chỉ
   đếm `ReviewLog`, trong khi `streak` tính theo `learning_events ∪ ReviewLog`.
   Dùng nó sẽ khiến hai con số trên cùng một trang mâu thuẫn: ngày chỉ đọc bài
   hoặc chỉ shadowing hiện là ngày nghỉ trong khi streak vẫn tính. Cần endpoint
   `GET /api/progress/calendar` riêng.

## Kiến trúc

Ba khối, phụ thuộc một chiều — khối sau dùng khối trước, không có chiều ngược
lại:

```
tokens.css (--dur-*, --ease-*, --dist-*, --scale-*)
    │
    ├── motion.css        lớp tiện ích: hover, stagger, skeleton, chuyển cảnh
    │
    └── lib/motion.ts     helper WAAPI: chạy chuỗi, huỷ được, tôn trọng cờ tắt
            │
            └── useFeedback()   một API phát sự kiện, ba kênh hình/tiếng/rung
                    │
                    └── các màn học và dashboard
```

Nguyên tắc kiểm chứng ranh giới: **không file nào ngoài `tokens.css` được viết
một giá trị thời lượng hay easing dạng số.** Nếu một file cần chuyển động mới mà
token hiện có không diễn tả được, thì thêm token, không hardcode.

---

# Đợt 1 — Nền chuyển động

## 1.1 Bộ token

Thêm vào khối `:root` trong `frontend/src/styles/tokens.css`, cạnh
`--dur-fast/base/slow/ambient` đang có. Không đặt trong `@theme` — khối đó đang
dành cho token màu của Tailwind 4.

Giữ nguyên giá trị của bốn token thời lượng hiện có (`--dur-fast: 150ms`,
`--dur-base: 250ms`, `--dur-slow: 400ms`, `--dur-ambient: 26s`) để không đổi
hành vi 8 chỗ đang dùng chúng. Bổ sung:

```css
/* Tầng A — công cụ. Mọi thao tác lặp lại. */
--dur-instant: 90ms;
--dur-snap:    180ms;
--ease-out:    cubic-bezier(.2, .8, .2, 1);
--ease-inout:  cubic-bezier(.4, 0, .2, 1);
--dist-hover:  2px;
--dist-enter:  8px;
--scale-press: .97;

/* Tầng B — thưởng. Chỉ khoảnh khắc đáng ăn mừng. */
--dur-reward:    320ms;
--dur-celebrate: 520ms;
--ease-spring:   cubic-bezier(.34, 1.56, .64, 1);
--scale-pop:     1.18;

/* Nhịp xếp lớp */
--stagger-step: 45ms;
```

`--ease-spring` chỉ được dùng cùng `--dur-reward` hoặc `--dur-celebrate`. Dùng
easing vượt đà với thời lượng ngắn sẽ ra cảm giác giật, không phải nảy.

## 1.2 Dọn hiện trạng

- Quy toàn bộ 22 `transition` và 56 `animation` về token. Ánh xạ: `160ms` →
  `var(--dur-fast)` (150ms); `180ms` và `0.2s` → `var(--dur-snap)` (180ms); các
  `cubic-bezier(.2,.8,.2,1)` (mọi biến thể khoảng trắng) → `var(--ease-out)`;
  các đường cong vượt đà rời rạc (`.34,1.56,.64,1`, `.2,1.4,.35,1`,
  `.2,1.35,.3,1`) → `var(--ease-spring)`.
- Gộp `orb-wrong` về một định nghĩa duy nhất trong `AiOrb.css`, xoá bản trong
  `legacy.css`.
- Không đổi hình thức của bất kỳ animation nào đang chạy đúng. Đây là bước quy
  chuẩn, không phải bước thiết kế lại.

## 1.3 Hover

Ba mức, áp theo **vai trò của phần tử**, không áp đồng loạt.

| Vai trò | Hành vi hover | Ví dụ |
|---|---|---|
| Bấm được | `translateY(calc(-1 * var(--dist-hover)))`, nền lên một bậc `--color-surface-*`, viền `--color-subtle` → `--color-strong`, trong `var(--dur-fast) var(--ease-out)` | nút, `DeckCard`, tile, hàng danh sách |
| Chỉ hiển thị | **Không đổi gì khi hover.** Nhận chuyển động lúc vào màn và lúc đổi giá trị | số KPI, nhãn, đoạn mô tả |
| Có thông tin phụ | Tooltip trượt vào trong `var(--dur-fast)`, phần tử không nâng | ô heatmap, chip kỹ năng |

Lý do phân biệt mức 1 và mức 2: nếu mọi thứ đều sáng lên khi rê chuột thì người
dùng mất khả năng đoán cái gì bấm được — hover trở thành nhiễu thay vì chỉ dẫn.

Mọi rule hover bọc trong `@media (hover: hover)`. Thiếu bước này thì trên mobile
trạng thái hover sẽ kẹt lại sau khi chạm.

Trạng thái nhấn: `transform: scale(var(--scale-press))` trong `var(--dur-instant)`,
áp cho mọi phần tử bấm được, kể cả trên touch.

## 1.4 Vào màn xếp lớp

Class `.stagger` trên container; con nhận `animation-delay` tăng dần
`var(--stagger-step)` qua `:nth-child(n)`, **dừng tăng ở phần tử thứ 6**. Từ
phần tử 7 trở đi dùng chung độ trễ của phần tử 6. Danh sách 20 mục mà trễ dần
đều sẽ mất gần một giây mới hiện xong — đó là chậm chạp, không phải sang trọng.

Hiệu ứng vào màn: `opacity 0→1` + `translateY(var(--dist-enter))→0`, dùng
`var(--dur-base) var(--ease-out)`.

## 1.5 Trạng thái chờ

Thay `<div className="page-center"><AiOrb state="loading" /></div>` (đang dùng ở
`StatsPage` và nhiều nơi khác) bằng skeleton giữ đúng khung bố cục của nội dung
sắp hiện. Nhịp thở 1.6s, dùng `--color-surface-1` ↔ `--color-surface-2`.

Xử lý riêng cho Render free tier: backend ngủ dậy mất khoảng 30 giây. Sau **8
giây** kể từ lúc bắt đầu chờ, skeleton hiện thêm dòng "Máy chủ đang thức dậy —
lần đầu trong ngày thường mất khoảng nửa phút". Không có dòng này thì người dùng
sẽ kết luận app hỏng.

## 1.6 Chuyển cảnh giữa trang

Dùng `document.startViewTransition` khi trình duyệt hỗ trợ (Chrome, Edge,
Safari 18+): fade chéo `var(--dur-base)`.

Firefox chưa hỗ trợ View Transitions API. Fallback: fade-in bằng CSS thuần trên
container route. Fallback này là hành vi hợp lệ, không phải lỗi cần sửa.

Không dùng slide theo hướng điều hướng — app có cả rail dọc lẫn nav ngang nên
không tồn tại một trục "tiến/lùi" nhất quán để slide theo.

## 1.7 Tôn trọng cờ tắt hiệu ứng

Hai cờ hiện có:

- `prefers-reduced-motion: reduce` — `motion.css` đang ép mọi animation về
  `.01ms !important`.
- `data-reduce-effects='true'` — do `AppearanceProvider` đặt, lưu về server.

**CSS `!important` không chặn được Web Animations API.** Helper trong
`lib/motion.ts` phải tự kiểm tra cả hai cờ trước khi chạy và trả về một
animation rỗng đã hoàn thành nếu cờ bật.

Khi hiệu ứng bị tắt, **phản hồi vẫn phải xảy ra** — chỉ là đổi màu và đổi nội
dung tức thì thay vì có chuyển động. Không được biến thành không phản hồi gì.

---

# Đợt 2 — Đường ống phản hồi

## 2.1 API

Hook `useFeedback()` trong `frontend/src/hooks/useFeedback.ts`, phát ra **sự
kiện có ý nghĩa**, không phát ra hiệu ứng:

```ts
type FeedbackEvent =
  | { kind: 'correct' }
  | { kind: 'wrong' }
  | { kind: 'saved' }
  | { kind: 'streakKept'; days: number }
  | { kind: 'xpGained'; amount: number; final: boolean }
  | { kind: 'levelUp'; skill: Skill; level: number }
  | { kind: 'sessionComplete'; xp: number; accuracy: number }
```

Nơi gọi chỉ viết `fb.correct()`. Hook tự quyết định tầng nào, tự kích hoạt cả ba
kênh. **Không màn nào được tự viết animation phản hồi riêng nữa** — đây là điều
kiện để tính nhất quán tồn tại về mặt cấu trúc, không chỉ về mặt token.

Các nơi gọi cần chuyển sang dùng hook: `FlipStep`, `ReviewStep`, `DictationStep`,
`SpeakStep`, `SplitStep`, `WeakStep`, `DailySummary`, `WordPopup` (lưu từ),
`ReaderPage` (lưu từ).

## 2.2 Phân bổ hai tầng

| Sự kiện | Tầng | Lý do |
|---|---|---|
| `correct`, `wrong`, `saved` | A | Lặp hàng chục lần mỗi buổi |
| `xpGained` (giữa buổi) | A | Số bay lên + đếm tăng, không nảy |
| `xpGained` (`final: true`) | B | Là kết quả của cả buổi |
| `streakKept` mốc 7/30/100 ngày | B | Mốc hiếm |
| `streakKept` ngày thường | A | |
| `levelUp` | B | |
| `sessionComplete` | B | |

## 2.3 Âm thanh

Dùng lại bộ wav sẵn có trong `frontend/public/audio/`. Ánh xạ sự kiện → asset:

| Sự kiện | Asset | Trạng thái |
|---|---|---|
| `correct` | `correct.wav` | đã có |
| `wrong` | `wrong.wav` | đã có |
| `saved` | `ui.wav` | đã có |
| `streakKept` (mốc) | `checkpoint.wav` | đã có |
| `xpGained` (`final: true`) | `combo.wav` | đã có |
| `sessionComplete` | `complete.wav` | đã có |
| `levelUp` | `levelup.wav` | **cần sinh mới** |

`levelup.wav` sinh bằng chính `frontend/scripts/generate_original_audio.py` —
thêm một dòng `effect(...)` dùng cùng hàm synthesis đã có, rồi cập nhật bảng
SHA-256 trong `ATTRIBUTION.md`. Không thêm asset từ nguồn ngoài.

`xpGained` giữa buổi **không phát tiếng** — chỉ có chuyển động và số đếm. Phát
tiếng ở mỗi câu đúng đã đủ; thêm một tiếng nữa cho XP sẽ thành chồng tiếng.

Hai lỗi hiện có trong `AudioProvider` phải sửa cùng lúc:

- `play()` hardcode `audio.volume = .28`, bỏ qua `sfx_volume` và `master_volume`
  trong `UserPreference`. Phải đổi thành `sfx_volume * master_volume`.
- `new Audio(...)` tạo một đối tượng mới mỗi lần phát. Với nhịp trả lời nhanh sẽ
  sinh hàng chục đối tượng. Dùng một `Map<string, HTMLAudioElement>` cache theo
  tên asset, phát lại bằng `currentTime = 0; play()`.

## 2.4 Rung

`navigator.vibrate`: `correct` → `10`, `wrong` → `[15, 40, 15]`, `levelUp` →
`[20, 30, 20, 30, 40]`.

**iOS Safari không hỗ trợ `navigator.vibrate`** và không có lộ trình hỗ trợ.
Trên iPhone sẽ không rung. Đây là giới hạn nền tảng đã biết, không phải lỗi cần
điều tra. Vẫn làm vì chi phí gần bằng không trên Android.

Gọi `navigator.vibrate` phải bọc kiểm tra tồn tại — một số trình duyệt desktop
có thuộc tính này nhưng ném lỗi khi gọi.

## 2.5 Công tắc

`UserPreference` **đã có sẵn** bốn trường cho việc này, nhưng `AudioProvider`
đang bỏ qua toàn bộ. Nối đúng:

| Trường | Điều khiển |
|---|---|
| `sfx_enabled` | Âm báo học (correct/wrong/levelUp/…) |
| `haptic_enabled` | Rung |
| `sfx_volume` × `master_volume` | Âm lượng phát |
| `feedback_enabled` | Toàn bộ phản hồi thưởng, kể cả phần hình |

`silent_mode` giữ nguyên vai trò cũ: tắt tất cả, kể cả nhạc nền. Kiểm tra theo
thứ tự `silent_mode` → `feedback_enabled` → `sfx_enabled`.

`SettingsPage` hiện **không có control nào** cho bốn trường trên — phải thêm.
Nhãn "Silent mode" cũng phải viết lại vì hiện chỉ nói về nhạc nền và phát âm.

---

# Đợt 3 — Dashboard `/stats`

## 3.1 Sửa lỗi múi giờ (làm trước mọi việc khác trong đợt này)

`backend/app/services/progression.py` gom ngày bằng `func.date(occurred_at)`
theo **UTC**, trong khi người dùng ở `Asia/Ho_Chi_Minh` (UTC+7). Hệ quả: buổi
học từ **0h đến 7h sáng giờ Việt Nam bị tính vào ngày hôm trước**. Sai này lan
sang `streak`, `heatmap`, `active_days_28`, `study_minutes_today` và
`reviews_today`.

Cách sửa: quy đổi mốc ngày theo `user.preferences.timezone` (mặc định
`Asia/Ho_Chi_Minh`) trước khi so sánh, thay vì dùng `datetime.min.time()` với
`timezone.utc`. Áp cho `overview_data`, cho endpoint `/api/review/heatmap` đang
có (cũng đang gom theo UTC), và cho hai endpoint mới ở 3.2.4 và 3.2.5.

Đặt một hàm dùng chung trong `progression.py` thay vì lặp phép quy đổi ở từng
chỗ — đây là nguyên nhân gốc khiến lỗi lan ra nhiều chỉ số cùng lúc.

Phải có test bao trường hợp sự kiện lúc 23:30 UTC ngày N (tức 06:30 giờ VN ngày
N+1) rơi đúng vào ngày N+1.

Không sửa việc này thì mọi biểu đồ trong đợt 3 đều đang vẽ số sai.

## 3.2 Bố cục bốn vùng

### Vùng 1 · Động lực

Vòng level tổng + streak + phút hôm nay/tuần. Mọi số đếm tăng từ 0 khi vào màn;
vòng level vẽ dần bằng `stroke-dashoffset`.

Cần thêm hai trường vào `ProgressOverview`: `total_xp` (tổng XP cả 4 kỹ năng) và
`level` (`level_for_xp(total_xp)`, hàm đã có trong `progression.py`).

### Vùng 2 · Nhịp học

Trả lời "tôi có đang học đều không". Dữ liệu lấy từ
`GET /api/progress/calendar?days=84` (endpoint mới, xem 3.2.5) — **không** dùng
`/api/review/heatmap`, vì endpoint đó chỉ đếm `ReviewLog` còn `streak` tính theo
`learning_events ∪ ReviewLog`; hai con số trên cùng một trang sẽ mâu thuẫn.

Một lần gọi phục vụ cả vùng 2 và vùng 4. Vùng 2 dùng 56 ngày cuối của dãy 84.

Ba thông tin:

1. Bảy cột thứ Hai → Chủ nhật; chiều cao mỗi cột là tỉ lệ ngày đó có học trong 8
   tuần qua. Mục đích là nói thẳng "bạn hay bỏ Thứ Bảy".
2. Khoảng cách trung bình giữa hai buổi học liên tiếp.
3. Trạng thái chuỗi hôm nay: đã học chưa, còn bao lâu tới nửa đêm theo múi giờ
   người dùng.

### Vùng 3 · Từ hay quên

Trả lời "từ nào tôi hay quên nhất". Dùng lại `GET /api/review/weak` — đã trả sẵn
`recent_wrong`, `total_reviews`, `last_step`, `suggested_step`. Không thêm
endpoint.

Hiện 8 từ đầu, mỗi từ một thanh tỉ lệ sai, và một nút "Học ngay 8 từ này" điều
hướng sang `WeakWordsPage`.

Đây là **vùng duy nhất có hành động**. Dashboard không bấm được gì thì chỉ là
bảng số.

### Vùng 4 · Lịch + chi tiết ngày

Heatmap bên trái, **84 ngày**, lấy từ cùng một lần gọi
`GET /api/progress/calendar?days=84` với vùng 2. Trường `heatmap` trong
`ProgressOverview` giữ nguyên 28 ngày — không đổi, vì test hiện có khẳng định
đúng con số đó và `StudyHeatmap` đang dùng nó.

Mỗi ô là một `<button>` thật —
bấm được bằng chuột, tới được bằng `Tab`, chọn được bằng phím mũi tên trong một
roving tabindex. Ô đang chọn có viền rõ, không chỉ khác màu nền.

Panel bên phải đổi nội dung theo ngày được chọn; mặc định chọn hôm nay. Nội dung:
số phút, số lượt ôn, số từ mới, chia theo 4 kỹ năng, và danh sách bài đọc đã đọc
trong ngày.

**Cần endpoint mới (1/2):** `GET /api/progress/day/{date}`.

- Tham số `date` dạng `YYYY-MM-DD`, hiểu theo múi giờ người dùng.
- Đọc `learning_events` của đúng ngày đó — index `ix_learning_events_user_occurred`
  đã có, truy vấn rẻ.
- Gom theo `skill` và theo `source_type`/`source_id`.
- Tên bài đọc lấy bằng join `source_id` sang bảng `Article` khi
  `source_type == 'article'`. Bài đã bị xoá thì bỏ qua, không hiện dòng trống.
- Ngày không có dữ liệu trả 200 với các số bằng 0, **không** trả 404 — ngày nghỉ
  là một câu trả lời hợp lệ, không phải lỗi.
- Từ chối ngày ở tương lai bằng 400.

### 3.2.5 · Endpoint lịch

**Cần endpoint mới (2/2):** `GET /api/progress/calendar?days=N`
(`N` trong khoảng 7–365, mặc định 84).

Trả về `list[CalendarDay]`, một phần tử cho **mỗi ngày dương lịch** trong cửa sổ
kể cả ngày không có dữ liệu — giống cách `overview_data` đã làm với `heatmap`:

```python
class CalendarDay(BaseModel):
    date: str        # YYYY-MM-DD theo múi giờ người dùng
    seconds: int     # tổng duration_seconds của learning_events trong ngày
    reviews: int     # số ReviewLog trong ngày
    active: bool     # seconds > 0 hoặc reviews > 0
```

`active` phải dùng đúng định nghĩa mà `overview_data` dùng cho `streak`
(`learning_events ∪ ReviewLog`), không phải chỉ `ReviewLog`. Nếu hai chỗ lệch
nhau thì dashboard sẽ tự mâu thuẫn.

### Dải phụ cuối trang

"Retention" và bốn số kho thẻ (`learning_cards`, `remembered_cards`, `due_cards`,
`total_cards`) chuyển xuống một dải nhỏ ở cuối trang. Không xoá — dữ liệu đã có
và vẫn hữu ích khi cần tra — nhưng không còn chiếm nửa màn hình trên vì chủ sản
phẩm không chọn hai mục đích đó.

## 3.3 Tách file

`StatsPage.tsx` hiện là một hàm duy nhất trả về một cây JSX dài, viết trên một
dòng. Bốn vùng trên sẽ khiến nó không đọc nổi. Tách thành:

```
pages/StatsPage.tsx              bố cục + nạp dữ liệu
components/stats/MotivationRing.tsx
components/stats/RhythmPanel.tsx
components/stats/WeakWordsPanel.tsx
components/stats/DayHeatmap.tsx
components/stats/DayDetailPanel.tsx
components/stats/LibraryStrip.tsx
```

Mỗi thành phần nhận dữ liệu đã tính sẵn qua props và không tự gọi API, trừ
`DayDetailPanel` gọi `/api/progress/day/{date}` theo ngày được chọn.

---

## Kiểm thử

**Backend** (`backend/tests/`, pytest — đã có sẵn):

- Múi giờ: sự kiện 23:30 UTC rơi đúng ngày hôm sau theo giờ VN; streak tính đúng
  qua ranh giới nửa đêm giờ VN.
- `/api/progress/day/{date}`: ngày có dữ liệu, ngày rỗng trả 200 số 0, ngày
  tương lai trả 400, ngày của người dùng khác không lộ dữ liệu.
- `/api/progress/calendar`: trả đúng `days` phần tử kể cả khi không có dữ liệu;
  `active` bật cho ngày chỉ có `LearningEvent` mà không có `ReviewLog` — đây là
  chính xác trường hợp `/api/review/heatmap` bỏ sót.
- `ProgressOverview` có `total_xp` và `level` đúng, và `heatmap` **vẫn 28 phần
  tử** (test hiện có khẳng định điều này).

**Frontend** (`vitest` + Testing Library — đã có sẵn):

- `useFeedback` gọi đúng ba kênh cho từng sự kiện; không phát tiếng khi
  `sfx_enabled` tắt; không rung khi `haptic_enabled` tắt; không làm gì khi
  `feedback_enabled` hoặc `silent_mode` tắt.
- `AudioProvider` phát đúng âm lượng `sfx_volume * master_volume`, và dùng lại
  cùng một `HTMLAudioElement` khi phát cùng một asset hai lần.
- Helper WAAPI trả animation đã hoàn thành ngay khi `prefers-reduced-motion` bật.
- Số đếm tăng dừng đúng ở giá trị cuối (không lệch do làm tròn).
- Heatmap: điều hướng bàn phím chọn được ô, `aria-label` nêu đúng ngày và số phút.

Không thêm framework test frontend mới — quyết định này đã chốt từ 2026-07-25.

## Ngoài phạm vi

- "Vài trải nghiệm khác" mà chủ sản phẩm chưa nêu được. Bổ sung sau khi dùng thử.
- Chuẩn hoá toast/`NotificationProvider`.
- Chẩn đoán "kỹ năng nào tụt lại" và "trí nhớ lên hay xuống".
- Trang "Kho từ của tôi".
- Đổi hướng thẩm mỹ; thêm thư viện animation; Web Push và email nhắc nhở.

## Rủi ro

| Rủi ro | Xử lý |
|---|---|
| Thêm hover/animation khắp nơi làm tụt FPS trên máy yếu | Chỉ animate `transform` và `opacity`. Không animate `filter`, `box-shadow`, `width`, `height`, `top/left`. Nền dark glass đã dùng `backdrop-filter` — không thêm blur mới |
| Âm báo lặp nhiều lần gây khó chịu | `wrong` trầm và ngắn; tầng B chỉ dùng cho sự kiện hiếm; có công tắc tắt |
| Sửa múi giờ làm streak của tài khoản hiện tại nhảy số | Chấp nhận. Số mới là số đúng; số cũ đang sai |
| View Transitions không chạy trên Firefox | Fallback fade CSS, đã ghi rõ là hành vi hợp lệ |
| Quy chuẩn 78 khai báo transition/animation làm hỏng animation đang đúng | Bước quy chuẩn không được đổi hình thức; đối chiếu ảnh chụp trước/sau ở các màn có animation nặng (`ShadowingPage`, games trong `legacy.css`) |
