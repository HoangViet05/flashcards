# Flashie Learning OS — Product, UX & Technical Design

Ngày: 2026-07-26  
Trạng thái: Đã chốt với chủ sản phẩm

Implementation plan:
`../plans/2026-07-26-learning-os-redesign.md`.

Current implementation remediation plan:
`../plans/2026-07-26-learning-os-visual-remediation.md`.

## 0. Visual source of truth — approved

The owner approved the following interactive prototypes on 2026-07-26:

| Surface | Canonical prototype | Approved direction/states |
|---|---|---|
| Today | `C:/Users/Admin/.codex/visualizations/2026/07/26/019f9dab-65a3-7100-a171-d7101f52a773/flashie-today-directions.html` | **A · Orbital Command only**, desktop and mobile |
| Study, Reader, Shadowing | `C:/Users/Admin/.codex/visualizations/2026/07/26/019f9dab-65a3-7100-a171-d7101f52a773/flashie-core-experiences.html` | All three surfaces, all three displayed states, desktop and mobile |

Before changing product code, the remediation agent must copy the approved HTML
fragments and rendered desktop/mobile reference images into
`docs/superpowers/visual-references/` so they are versioned with the repository.
The thread-scoped paths above identify the approved originals; they are not a
substitute for the checked-in copies.

### 0.1 Precedence when sources disagree

1. The approved prototypes control composition, visual hierarchy, density,
   spatial relationships, art direction, interaction emphasis and motion mood.
2. This written spec controls behavior, data, accessibility, performance,
   fallback and free-tier constraints.
3. Existing implementation controls neither. It is evidence of current behavior,
   not a visual reference.
4. B · Quest Console and C · Constellation from the Today comparison are rejected
   as full-page directions. Their elements must not be mixed into A without new
   owner approval.

### 0.2 Non-negotiable visual contracts

**Today — Orbital Command**

- The first viewport is intentionally filled: compact icon rail, greeting/status
  header, dominant Daily Core hero, orb energy system, primary/quick CTA, useful
  live metrics, missions and weekly trajectory.
- The orb is part of the action hierarchy, not decorative content floating in
  empty space.
- The weekly route and four skill levels must read as a game system at a glance.
- Slow backend state preserves the same composition with cached/skeleton content;
  it must never collapse into a blank page with one centered orb.

**Study**

- Active state is an “energy chamber”: session progress, centered exercise,
  responsive orb, one primary answer action and a visible trajectory rail.
- Correct feedback visibly changes the chamber, awards XP/combo/energy and
  confirms the exact answer before continuing.
- Summary makes time, accuracy, XP and streak feel earned; it is not a plain
  statistics card.
- Mobile removes the side trajectory rail but keeps progress and the primary
  learning stage above the fold.

**Reader**

- Reading text is the dominant surface. Global navigation, saved words, audio
  and dictionary controls may support it but never overlap or narrow it
  unpredictably.
- Desktop uses one contextual companion dock. Word definition and audio states
  replace content inside that dock rather than opening competing floating panels.
- Mobile uses a compact dock/sheet and keeps the article readable.
- Motion and glow are calmer than Today/Study, while typography and orbital
  materials keep the same product identity.

**Shadowing**

- The initial viewport contains the target sentence, sample playback, waveform,
  large record control, session progress and worker state.
- Recording visibly transforms the orb/waveform and shows a live transcript.
- Score state highlights word-level results, one actionable pronunciation tip,
  Retry and Next.
- Worker offline changes scoring capability, not the entire visual structure.

### 0.3 Explicitly rejected patterns from the current implementation

- More than half of a normal desktop viewport left as purposeless empty canvas.
- Text-only oversized sidebar with no icon, context or useful status.
- Dot-grid background presented as the primary visual identity.
- A centered loading orb as the only visible content.
- CRUD-style Reader cards without progress, discovery or visual invitation.
- Reader panels/dropdowns overlapping the article or one another.
- Shadowing represented by a small select and button at the top of an empty page.
- Mixed Vietnamese/English UI, emoji used as control icons, raw Tailwind palette
  utilities and legacy dark-only panels.
- “Audio system” represented only by a short oscillator tone with no approved
  music/SFX assets.

### 0.4 Visual implementation rule

Passing build/unit tests is necessary but not sufficient. A surface is incomplete
until its required screenshots have passed the visual QA gate in section 16 and
the owner has approved the phase evidence. Coding agents must not reinterpret
the prototypes into a simpler dashboard for implementation convenience.

## 1. Mục tiêu

Thiết kế lại toàn bộ Flashie thành một **Learning OS** bằng tiếng Anh: trưởng
thành, premium, có chất liệu Liquid Glass, light/dark theme, nền có chiều sâu và
chuyển động nhẹ. Người học phải có cảm giác đang chơi một game tiến triển dài
hạn, nhưng không bị phạt hoặc bị khóa khỏi việc học.

Ba kết quả sản phẩm ưu tiên:

1. Người học quay lại hằng ngày.
2. Thời lượng học tăng.
3. Số từ thực sự ghi nhớ tăng.

Đối tượng chính là người đi làm bị mất gốc, muốn đọc, nghe và giao tiếp tiếng
Anh phục vụ công việc. Quy mô hiện tại là chủ dự án và một nhóm nhỏ.

## 2. Bối cảnh và ràng buộc

- Frontend: React 19 + TypeScript + Vite 8 + Tailwind v4, deploy Vercel Hobby.
- Backend: FastAPI + SQLAlchemy, deploy Render Free.
- Database và media: Supabase Postgres/Storage Free.
- Render có script giữ thức, nhưng UI vẫn phải chịu được response chậm.
- Desktop chiếm khoảng 60%, mobile 40%.
- Trình duyệt chính: Chrome và Safari bản hiện đại.
- Làm trực tiếp trên nhánh `main`; chia thành phase hoàn chỉnh và kiểm thử trước
  khi push/deploy.
- Có thể đổi API, schema và luồng. Dữ liệu ứng dụng hiện tại sẽ bị reset để xây
  lại từ đầu.
- Không dùng leaderboard, social, push notification hoặc email reminder.
- Không phụ thuộc LLM/API AI để vận hành UI, orb, mission, XP hay Boss.
- Không dùng Three.js, video nền hoặc animation canvas nặng.

## 3. Quyết định đã chốt

| Chủ đề | Quyết định |
|---|---|
| Hướng mỹ thuật | Learning OS, premium, không hoạt hình trẻ con |
| Chất liệu | Liquid Glass tương tự iOS; có fallback khi `backdrop-filter` không khả dụng |
| Theme | Light/Dark thủ công; lần đầu theo hệ điều hành; nhớ lựa chọn |
| Accent | 4 preset: Violet–Cyan, Blue–Emerald, Amber–Rose, Graphite–Ice |
| Nền | Không đen/trắng tuyệt đối; có họa tiết và animation chậm, nhẹ |
| Nhân vật | AI orb trừu tượng, phản ứng bằng ánh sáng/chuyển động và câu chữ viết sẵn |
| Giọng orb | Không triển khai; orb không dùng TTS |
| Game hóa | Mức 10/10, nhưng không hearts, paywall, chờ hoặc khóa nội dung |
| Tiến triển | XP/level riêng cho Vocabulary, Reading, Listening, Speaking |
| Hành trình | 4 tuyến kỹ năng song song, hợp lại ở Boss cuối tuần |
| Mission | 3 daily, 3 weekly; được đổi 1 daily mission mỗi ngày |
| Boss | Mở thứ Sáu–Chủ nhật; chơi lại tự do; giữ điểm tốt nhất |
| Phần thưởng | Orb evolution, title/badge, accent/theme cosmetic, map/celebration |
| Home | Command Center, một CTA chính để tiếp tục hành trình |
| Study | Quick Study 5 phút và Full Session 20–30 phút |
| Mobile | Bottom nav, ưu tiên một tay, gesture có vùng rõ ràng |
| Desktop | Sidebar trái thu gọn |
| Audio | Đủ music/SFX/feedback/pronunciation/haptic; music mặc định tắt |
| Silent mode | Một nút nhanh, có cấu hình từng nhóm; không có lịch tự động |
| Voice | Chọn nhiều voice hệ thống, bấm mới đọc, chỉnh tốc độ |
| Đồng bộ | Progression, mission, theme/audio preference đồng bộ tài khoản |
| Ngôn ngữ | Toàn bộ UI là tiếng Anh |
| Onboarding | Khoảng 2 phút, không placement test, có Skip |
| DB hiện tại | Reset toàn bộ bảng dữ liệu ứng dụng; không reset schema hệ thống Supabase |

## 4. Nguyên tắc trải nghiệm

1. **One obvious next action.** Mỗi màn học có đúng một hành động chính.
2. **Reward effort, never gate learning.** Sai làm mất combo/năng lượng tạm thời,
   không mất lượt hay bị chặn.
3. **Progress is always legible.** Người học biết đang ở đâu trong buổi, tuần và
   bốn kỹ năng.
4. **Delight is layered.** Màu → chuyển động → âm thanh → celebration; mọi lớp
   đều có thể giảm/tắt.
5. **Workplace safe.** Mọi chức năng có thể dùng trong Silent mode; không có
   thông tin chỉ truyền bằng âm thanh hoặc rung.
6. **Free-tier first.** Không polling dày, không asset tải sớm, không query N+1,
   không cần job server nền để progression hoạt động.
7. **Honest offline/slow states.** Cache giúp xem nhanh nhưng không giả vờ đã lưu
   tiến trình khi backend chưa xác nhận.

## 5. Information architecture

### 5.1 Navigation

Desktop sidebar:

- Today → `/`
- Read → `/reader`
- Speak → `/shadowing`
- Progress → `/stats`
- More group: Library `/library`, Weak Words `/weak`, Settings `/settings`,
  Account `/account`

Mobile bottom navigation:

- Today
- Read
- Speak
- Progress
- More mở bottom sheet chứa Library, Weak Words, Settings, Account và Sign out

Giữ các route kỹ thuật hiện tại để giảm rủi ro. `/daily` tiếp tục là Full
Session; thêm `/daily/quick`, `/boss` và `/onboarding`.

### 5.2 App shell

- Sidebar rộng 240px khi mở, 72px khi thu; trạng thái lưu theo thiết bị.
- Mobile bottom nav nằm trong safe area, target tối thiểu 44×44px.
- Nội dung chừa safe area, không bị nav hoặc bàn phím ảo che.
- Page transition chỉ dùng opacity/transform 150–250ms; không chặn thao tác.
- Auth pages vẫn dùng cùng theme/background/orb nhưng không render app nav.

## 6. Visual system

### 6.1 Theme tokens

Token phải có semantic pair cho cả light/dark:

- Canvas: `--bg-canvas`, `--bg-depth`, `--bg-elevated`
- Glass: `--glass-fill`, `--glass-fill-strong`, `--glass-border`,
  `--glass-highlight`, `--glass-shadow`
- Text: `--text-primary`, `--text-secondary`, `--text-muted`, `--text-on-accent`
- Accent: `--accent-primary`, `--accent-secondary`, `--accent-soft`
- State: success, error, warning, info, focus
- Motion: fast 150ms, base 250ms, slow 400ms, ambient 18–40s
- Radius, spacing, z-index, safe-area và blur scale

Không thêm màu trực tiếp trong JSX. Mỗi preset accent phải đạt WCAG AA cho text
và control state trong cả hai theme.

### 6.2 Background

Dark dùng navy/indigo sâu thay vì `#000`; light dùng pearl/blue-gray thay vì
trắng tuyệt đối. Mỗi theme có:

- Một gradient mesh rất chậm.
- Một lớp họa tiết constellation/dot/grid mờ.
- Tối đa hai vùng glow lớn.
- Tối đa hai layer ambient cùng animation.

Chỉ animate `transform` và `opacity`; duration 18–40 giây; không follow cursor
trên mobile. `prefers-reduced-motion`, Save-Data hoặc chế độ Reduce Effects sẽ
đóng băng layer ở frame tĩnh. Safari không có API battery saver ổn định nên việc
giảm theo pin chỉ là best-effort, không phải acceptance criterion.

### 6.3 Liquid Glass

- Card quan trọng dùng translucent fill, viền sáng một cạnh, blur vừa đủ và
  shadow mềm.
- Không bọc mọi thứ trong card; hierarchy vẫn dựa trên khoảng trắng.
- `backdrop-filter` có `-webkit-` prefix cho Safari.
- Fallback `@supports not (backdrop-filter: blur(...))` dùng surface gần đục,
  không làm mất tương phản.
- Light mode tránh glass trắng trên nền trắng; luôn có tint và border rõ.

### 6.4 AI orb

Orb có một component duy nhất với state machine:

`idle`, `thinking`, `loading`, `correct`, `wrong`, `combo`, `listening`,
`recording`, `processing`, `success`, `offline`.

- State đổi màu, halo, waveform và microcopy; không dùng emoji/mascot mặt người.
- Microcopy lấy từ danh sách cố định, tránh lặp liên tục.
- Khi API chậm quá 1.2 giây: `loading` với “Starting your learning space…”.
- Orb không nói và không phụ thuộc API AI.
- Không loop animation mạnh; wrong phản hồi ≤300ms, celebration chính ≤2.5s.

## 7. Audio, speech và haptic

### 7.1 Audio buses

Một `AudioProvider` quản lý:

- Master/Silent
- Music
- UI SFX
- Correct/Wrong feedback
- Pronunciation
- Haptic

Mỗi nhóm có toggle và volume riêng; Silent mode ghi nhớ cấu hình nhóm cần tắt.
Music mặc định off; SFX/feedback/pronunciation/haptic mặc định on nếu thiết bị hỗ
trợ. Browser audio chỉ unlock sau tương tác đầu tiên.

### 7.2 Sound direction

| Không gian | Âm thanh |
|---|---|
| Today | ambient điện tử rất nhẹ |
| Full/Quick Study | focus pulse tăng nhẹ theo combo |
| Reader | lo-fi/ambient không lời |
| Shadowing | không nhạc trong lúc phát mẫu hoặc ghi âm |
| Boss | cinematic synth tiết chế |
| Celebration | layer rõ, ngắn, không gây giật mình |

Phiên bản đầu có tối đa 3–4 track. Track và SFX là asset có quyền phân phối,
được phục vụ từ Vercel static assets với tên hash, lazy-load khi người dùng bấm
Play và HTTP cache dài hạn. Repository phải có `public/audio/ATTRIBUTION.md`.
Không gọi CDN âm thanh bên thứ ba lúc chạy. File lỗi thì music im lặng; feedback
cơ bản fallback sang WebAudio.

### 7.3 Pronunciation

- Dùng audio của card khi có; fallback Web Speech API.
- Voice picker liệt kê voice khả dụng trên thiết bị, ưu tiên `en-US`/`en-GB`.
- Đồng bộ locale, tên voice mong muốn và rate; nếu thiết bị khác không có voice
  đó thì chọn voice cùng locale rồi voice English mặc định.
- Chỉ phát khi người dùng bấm/nhấn giữ; không autoplay.

### 7.4 Haptic

`navigator.vibrate` dùng best-effort cho correct/wrong/complete trên browser hỗ
trợ. iOS Safari hiện không đảm bảo hỗ trợ; no-op không được xem là lỗi.

## 8. Game loop

### 8.1 XP và level

XP được tính ở backend từ activity đã xác nhận; client không gửi số XP. Mỗi event
có `idempotency_key` để retry không cộng hai lần.

| Activity | XP |
|---|---:|
| Study answer đúng lần đầu | 4 Vocabulary/Listening XP theo loại bài |
| Đúng sau khi sửa | 1 XP |
| Hoàn thành bài đọc lần đầu trong ngày | 20 + 5/10/15 Reading XP theo level |
| Shadowing có chấm | 5 + `floor(score / 20)` Speaking XP |
| Shadowing offline hoàn thành | 4 Speaking XP |
| Daily mission | 20 XP cho skill liên quan |
| Weekly mission | 75 XP cho skill liên quan |
| Boss medal mới trong tuần | Bronze 100, Silver 150, Gold 250 XP phân theo phase |

Cap chống spam: Full Study 80 XP/phiên, Quick Study 30 XP/phiên, Reading 80
XP/ngày, Speaking 60 XP/ngày. Các giá trị đặt trong backend config, không rải
magic number.

Mỗi skill bắt đầu Level 1. XP tối thiểu để đạt level `L`:

`100 × L × (L - 1) / 2`

Level chỉ tăng và không đổi độ khó/nội dung. Total level không tồn tại; overview
hiển thị bốn level để tránh một số tổng gây hiểu sai.

### 8.2 Mastery 30 ngày

Mastery là 0–100 và có thể tăng/giảm:

- Vocabulary: 70% rolling review accuracy + 30% tỷ lệ card mastered.
- Listening: accuracy của dictation/listening event.
- Speaking: trung bình score của attempt có chấm; offline attempt chỉ tính
  activity, không làm thay đổi score.
- Reading: 50% completion rate + 30% hoàn thành mục tiêu phút + 20% mức bài đọc
  so với preferred level.

Khi không đủ mẫu, hiển thị “Building signal” thay vì `0%`. Service backend tính
theo query aggregate 30 ngày, cache response ngắn; không ghi heartbeat từng giây.

### 8.3 Activity time

Chỉ đếm khi tab visible, window focused và có interaction trong 60 giây gần
nhất. Client queue các delta trong IndexedDB, batch tối đa 50 event và flush khi:

- hoàn thành/tạm dừng activity;
- đủ 5 phút;
- app mở lại hoặc mạng trở lại.

Backend clamp delta, dedupe bằng key và tự tính XP. Không polling để ghi thời
gian.

### 8.4 Missions

- 3 daily + 3 weekly.
- Daily theo timezone user, mặc định `Asia/Ho_Chi_Minh`.
- Tuần bắt đầu thứ Hai.
- Template: complete session, remember N words, read N minutes, save N words,
  complete dictation, complete Shadowing.
- Engine chỉ chọn mission khả dụng theo card/article/worker capability.
- Worker tắt thì mission cần scoring được thay trước khi assign.
- Một daily mission được reroll mỗi ngày; không reroll mission đã hoàn thành.
- Progress cập nhật từ learning events; reward tự nhận, không có Claim button.
- Miss một ngày làm mất streak nhưng không khóa map.

### 8.5 Weekly journey và Boss

- Map có bốn lane: Vocabulary, Reading, Listening, Speaking.
- Bảy checkpoint theo ngày; activity thắp sáng lane tương ứng.
- Boss mở từ 00:00 thứ Sáu đến 23:59:59 Chủ nhật theo timezone user, kể cả khi
  checkpoint chưa đủ.
- Boss dài 10–15 phút, gồm weak vocabulary, short reading, listening và
  speaking.
- Worker offline: speaking chuyển thành listen-and-repeat tự xác nhận, không
  chấm; trọng số score được chuẩn hóa trên phần có chấm.
- Bronze ≥60, Silver ≥75, Gold ≥90. Dưới 60 là “Training complete”, chơi lại
  ngay, không phạt.
- Giữ best score/medal của tuần; chỉ phần nâng hạng mới cộng reward chênh lệch.
- Boss không khóa tuần sau hay nội dung nào.

## 9. Core journeys

### 9.1 Onboarding

Sau đăng ký, `/onboarding` hỏi trong tối đa 2 phút:

1. Work goal: Reading, Listening, Conversation hoặc Balanced.
2. Daily target: 5, 15, 25, 30 phút.
3. Preferred English voice + speech rate.
4. Accent preset + Light/Dark/System.
5. Audio setup và thử SFX/pronunciation.

Có Skip. Nếu preference chưa hoàn tất, user vẫn dùng app và thấy banner nhỏ ở
Today. Không có placement test.

### 9.2 Today — Command Center

Thứ tự:

1. AI orb + greeting/trạng thái.
2. Primary CTA “Continue journey”; secondary “Quick study · 5 min”.
3. Bốn skill level/mastery.
4. Ba daily missions.
5. Weekly map dẫn tới Boss.
6. Streak và compact progress summary.

Empty account ưu tiên “Choose your first reading” và “Import a deck”; mission
engine không tạo nhiệm vụ bất khả thi.

### 9.3 Full và Quick Study

- Full: 20–30 phút, app điều phối Review → Weak → New/Flip → Dictation →
  Split/Meaning → Speak nếu phù hợp → summary/game.
- Quick: khoảng 5 phút, ưu tiên due → weak → một listening item; không đánh dấu
  Full Session hoàn tất nhưng vẫn tính streak, XP và mission.
- Progress bar không lùi khi câu sai.
- Sai: rung nhẹ, mất combo, giảm energy tạm; hiện đáp án/hint rồi cho tiếp.
- Đúng: feedback khoảng 600–700ms, tự chuyển nếu không cần quyết định khác.
- Gesture chỉ hoạt động trong card surface: swipe biết/chưa biết, swipe chuyển
  câu khi phù hợp; không chặn Safari back gesture ở mép màn hình.
- Input scroll vào vùng nhìn khi bàn phím mở.
- Tạm dừng lưu server; resume được trên thiết bị khác.

### 9.4 Reader

- Reading-first layout, typography yên tĩnh hơn game shell.
- Tap word mở nghĩa/lưu; long press phát âm; swipe chuyển bài.
- Reading progress và focused time.
- Bilingual toggle; trạng thái saved/learning/mastered/weak.
- Orb chỉ hiện nhỏ khi lưu từ hoặc qua checkpoint.
- Reader audio có transport lớn, tốc độ và transcript; music tự duck/tắt khi
  audio bài đọc phát.

### 9.5 Shadowing

- Online: listen → record → process → score → retry/next.
- Offline: nghe mẫu và tự ghi âm để so sánh, không score.
- Orb thành waveform ở listening/recording/processing.
- Music luôn pause khi sample/microphone active.
- Permission denied có hướng dẫn và đường Skip/exit rõ.

### 9.6 Progress

Thứ tự KPI:

1. Return days/streak.
2. Study time ngày/tuần.
3. Words remembered/retention.

Sau đó mới tới bốn skill, heatmap, mission history và Boss history. Chart phải có
text alternative, không phụ thuộc màu.

### 9.7 Library, Weak Words, Account, Settings và Auth

- Redesign toàn bộ theo token mới và chuyển mọi copy sang English.
- Library là productivity tool: ít celebration, thao tác CRUD rõ và nhanh.
- Weak Words vẫn là practice surface và dùng feedback chung.
- Settings chứa Appearance, Sound & Silent mode, Speech, Motion, Daily goal,
  Timezone và Account.
- Logo chỉ là wordmark “Flashie” + orb đơn giản.

## 10. Slow backend, cache và error states

- App shell render không chờ backend.
- Sau 1.2 giây chưa có response, orb hiện “Starting your learning space…”.
- Hiện cached Today/Progress/last article với nhãn “Last synced …”.
- Mutation bị vô hiệu khi offline; không optimistic-complete study answer.
- Retry exponential 1s, 2s, 4s, 8s, tối đa 15s; dừng khi tab hidden.
- Cache dùng IndexedDB cho query nhỏ và last article; không biến dự án thành PWA
  hoặc cam kết full offline trong scope này.
- Home dùng endpoint aggregate; worker health có timeout và không polling toàn
  app.

## 11. Backend và data model

Thiết lập Alembic trước khi thêm schema mới. Target schema sau reset:

### `user_preferences`

`user_id` PK/FK, `ui_theme`, `accent_theme`, `reduce_effects`,
`daily_goal_minutes`, `timezone`, `work_goal`, `preferred_voice_name`,
`preferred_voice_locale`, `speech_rate`, volume/toggle cho từng audio bus,
`silent_mode`, `silent_profile` JSON, `onboarding_completed_at`, timestamps.

### `skill_progress`

`user_id`, `skill`, `xp`, timestamps; unique `(user_id, skill)`.

### `learning_events`

`id`, `user_id`, `event_type`, `skill`, `source_type`, `source_id`,
`idempotency_key`, `duration_seconds`, `metric_value`, `payload` JSON,
`occurred_at`; unique `(user_id, idempotency_key)`; index
`(user_id, occurred_at)` và `(user_id, skill, occurred_at)`.

### `mission_assignments`

`id`, `user_id`, `period_type`, `period_start`, `slot`, `mission_key`, `skill`,
`target`, `progress`, `completed_at`, `rerolled`, timestamps; unique
`(user_id, period_type, period_start, slot)`.

### `boss_attempts`

`id`, `user_id`, `week_start`, `score`, `medal`, `breakdown` JSON,
`duration_seconds`, `completed_at`; index `(user_id, week_start)`.

### `user_unlocks`

`id`, `user_id`, `unlock_key`, `unlock_type`, `unlocked_at`; unique
`(user_id, unlock_key)`.

### `daily_sessions`

Giữ bảng hiện tại và thêm `mode` (`full|quick`), `started_at`,
`duration_seconds`. Full và Quick không chiếm active session của nhau. Boss dùng
`boss_attempts`, không giả làm daily session.

Mọi timestamp mới dùng timezone-aware UTC. Quy đổi ngày/tuần qua timezone từ
preference.

## 12. API contract

| Method/path | Mục đích |
|---|---|
| `GET/PATCH /api/auth/me/preferences` | Toàn bộ setting đồng bộ |
| `POST /api/events/batch` | Ghi activity idempotent, trả XP/mission delta |
| `GET /api/progress/overview` | KPI, 4 skill, heatmap, unlock summary |
| `GET /api/missions` | Daily/weekly assignments hiện tại |
| `POST /api/missions/{id}/reroll` | Reroll một daily mission |
| `GET /api/journey/week` | 4 lane, 7 checkpoint, Boss state |
| `GET /api/boss/current` | Boss content/state hiện tại |
| `POST /api/boss/complete` | Chấm và lưu best attempt idempotent |
| `GET /api/daily/session?mode=full|quick` | Resume/tạo session đúng mode |
| `GET /api/daily/home` | Mở rộng thành Command Center aggregate |

API trả server time và timezone-effective date ở response theo ngày để client
không tự đoán reset. Các endpoint cũ giữ tương thích trong lúc feature flag chưa
bật.

## 13. Free-tier và performance budget

- Home sau auth: tối đa 2 request song song (Command Center + capability health).
- Không query từng mission/skill riêng; aggregate ở backend.
- SQLAlchemy Postgres pool nhỏ (`pool_size=5`, `max_overflow=2`, `pool_pre_ping`).
- Không cron bắt buộc; mission tạo lazy khi request đầu tiên trong period.
- Activity gửi batch; không heartbeat API mỗi giây/phút.
- Initial route không tải music, Boss, Shadowing hay Reader chunk.
- Initial JS gzip mục tiêu ≤220KB; CSS gzip ≤35KB; mỗi lazy route ≤80KB gzip,
  không tính audio.
- Shell/cached content xuất hiện ≤1.5s trên mobile tầm trung; LCP ≤2.5s khi
  backend warm và mạng bình thường.
- Animation duy trì gần 60fps; không có long task >200ms do decoration.
- Audio đầu tiên chỉ tải sau thao tác Play; tối đa 3–4 track ở v1.

## 14. Accessibility và browser

- WCAG 2.2 AA cho contrast, focus, keyboard, label và status announcement.
- Target 44×44px trên mobile, safe area iPhone.
- `prefers-reduced-motion` và Reduce Effects tắt ambient loop/particles/shake.
- Correct/wrong luôn có text/icon, không chỉ màu/âm/rung.
- Chrome và Safari hai major gần nhất; Playwright Chromium + WebKit.
- Glass fallback và Web Speech/Vibration fallback phải graceful.

## 15. Database reset và rollout

Reset là thao tác rollout một lần, không chạy trong app startup:

1. Hoàn thành và test Alembic target schema.
2. Export snapshot trước reset để có đường phục hồi kỹ thuật.
3. Xác minh hostname/project ref Supabase production.
4. Chỉ drop các bảng do `Base.metadata`/Alembic quản lý trong schema `public`;
   không chạm `auth`, `storage`, extension hoặc schema hệ thống Supabase.
5. Chạy migration `upgrade head`.
6. Tạo tài khoản mới và smoke test.
7. Không tự động xóa Supabase Storage; cleanup bucket là thao tác riêng cần xác
   nhận target.

Frontend dùng feature flags trong khi code đi trực tiếp trên `main`. Backend mới
deploy trước; frontend bật Learning OS sau khi API/migration/smoke test hoàn tất.

## 16. Test và acceptance criteria

- Backend: pytest cho timezone boundary, idempotent event, XP cap, mission
  capability/reroll, Boss medal upgrade, quick/full coexistence và access scope.
- Frontend: Vitest + Testing Library cho provider/reducer/component states.
- E2E: Playwright Chromium desktop, mobile viewport và WebKit.
- Visual QA cho light/dark × 4 accent × 320/390/768/1440px.
- Core flows: register/onboarding, empty account, import/read/save, quick/full,
  worker online/offline Shadowing, mission completion, Boss, silent mode,
  cross-device preference/session resume, slow/offline backend.
- Không còn user-facing Vietnamese string.
- Không có horizontal overflow, keyboard-covered input, unlabeled control,
  autoplay audio hoặc progress duplication.

### 16.1 Mandatory visual QA gate

Required reference sizes:

- Desktop: 1440×900.
- Mobile: 390×844.
- Compact overflow smoke: 320×568.

Required screenshot matrix:

| Surface | States | Themes | Required devices |
|---|---|---|---|
| Today | loaded, slow/cached, empty/new user | dark + light | desktop + mobile |
| Study | active, correct, summary | dark + light | desktop + mobile |
| Reader | focus, word selected, audio reader | dark + light | desktop + mobile |
| Shadowing | ready, recording, score, worker offline | dark + light | desktop + mobile |

For every row:

1. Store implementation screenshots under
   `artifacts/visual-qa/<phase>/<surface>/<theme>-<device>-<state>.png`.
2. Produce a side-by-side contact sheet with the approved prototype reference.
3. Run Playwright assertions for no horizontal overflow, clipped controls,
   overlapping regions, missing focus state and console errors.
4. Run screenshot regression only after the owner approves the first
   implementation screenshot as the baseline.
5. Attach the artifact paths to the phase handoff. “Looks close” without
   screenshots is not evidence.

Immediate reject conditions:

- Any primary content collision/occlusion.
- More than 35% purposeless empty space in the first desktop viewport.
- Primary CTA or active learning content below the first mobile viewport.
- Mixed-language copy, emoji control icons or raw dark-only legacy surfaces.
- Loading longer than 1.2 seconds that replaces the full composition with a
  blank canvas.
- Missing visible state change for correct, recording, processing or score.
- Light mode that is merely color inversion instead of the approved material
  hierarchy.
- Any material divergence from the approved composition without owner approval.

## 17. Ngoài phạm vi

- Social/friends/leaderboard.
- Shop, currency, consumable hearts hoặc phần thưởng ảnh hưởng nội dung.
- Push/email reminder.
- Full offline/PWA.
- AI-generated orb copy hoặc LLM-driven missions.
- Thiết kế logo chuyên sâu.
- Native iOS/Android app.
