# Nâng trải nghiệm: chuyển động, phản hồi, dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng một hệ chuyển động và phản hồi dùng chung cho toàn app, rồi dựng lại `/stats` thành dashboard trả lời được ba câu hỏi cụ thể — kèm sửa lỗi gom ngày theo UTC đang làm sai streak và heatmap.

**Architecture:** Ba lớp phụ thuộc một chiều. `tokens.css` giữ toàn bộ giá trị thời lượng/easing/khoảng cách. `motion.css` và `lib/motion.ts` chỉ tiêu thụ token. `useFeedback()` là API duy nhất mà màn học gọi để phát phản hồi; không màn nào tự viết animation phản hồi riêng. Backend thêm một hàm quy đổi múi giờ dùng chung, rồi hai endpoint đọc mới xây trên đó.

**Tech Stack:** React 19 + TypeScript 6 + Vite 8 + Tailwind 4 (CSS thuần, không thư viện animation), Web Animations API; FastAPI + SQLAlchemy + pytest; vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-27-experience-motion-dashboard-design.md`
**Baseline:** `0aa0480` trên `main`

## Global Constraints

- Làm thẳng trên `main`. Không tạo branch. Không push khi một đợt chưa xong.
- **Không file nào ngoài `frontend/src/styles/tokens.css` được viết giá trị thời lượng hay easing dạng số.** Cần chuyển động mới mà token hiện có không diễn tả được thì thêm token, không hardcode.
- Chỉ animate `transform` và `opacity`. Không animate `filter`, `box-shadow`, `width`, `height`, `top`, `left`.
- Mọi rule `:hover` phải bọc trong `@media (hover: hover)`.
- Không thêm dependency mới vào `frontend/package.json`. Không thêm framework test frontend mới.
- Không thêm file audio từ nguồn ngoài. Asset mới phải sinh bằng `frontend/scripts/generate_original_audio.py`.
- Backend chạy bằng conda env `flashcard`: `C:\Users\Admin\anaconda3\envs\flashcard\python.exe -m pytest ...`. Python hệ thống 3.14 không cài được deps đã ghim.
- DB thật là `backend/flashcards.db`. Test dùng `backend/test.db` qua `conftest.py`, không đụng DB thật.
- Không đổi hướng thẩm mỹ. Giữ dark glass và bộ nhận diện hiện tại.
- Giá trị token thời lượng hiện có giữ nguyên: `--dur-fast: 150ms`, `--dur-base: 250ms`, `--dur-slow: 400ms`, `--dur-ambient: 26s`.
- Trường `heatmap` trong `ProgressOverview` giữ đúng 28 phần tử. `backend/tests/test_learning_os.py` khẳng định điều này.

---

## File Structure

**Đợt 1 — nền chuyển động**

| File | Trách nhiệm |
|---|---|
| `frontend/src/styles/tokens.css` (sửa) | Nguồn duy nhất của mọi giá trị thời lượng, easing, khoảng cách, tỉ lệ |
| `frontend/src/styles/motion.css` (viết lại) | Lớp tiện ích CSS: hover, press, stagger, enter, skeleton, chuyển cảnh |
| `frontend/src/lib/motion.ts` (mới) | Helper WAAPI: đọc token, kiểm tra cờ tắt, chạy animation huỷ được |
| `frontend/src/lib/motion.test.ts` (mới) | Test cho helper trên |
| `frontend/src/components/shell/RouteTransition.tsx` (mới) | Bọc `<Outlet />`, gọi View Transitions API, fallback fade |
| `frontend/src/components/shell/Skeleton.tsx` (mới) | Khối skeleton + thông báo "máy chủ đang thức dậy" sau 8 giây |

**Đợt 2 — phản hồi**

| File | Trách nhiệm |
|---|---|
| `frontend/scripts/generate_original_audio.py` (sửa) | Thêm một dòng sinh `levelup.wav` |
| `frontend/public/audio/levelup.wav` (mới, sinh ra) | Asset âm báo lên level |
| `frontend/public/audio/ATTRIBUTION.md` (sửa) | Thêm dòng SHA-256 cho asset mới |
| `frontend/src/providers/AudioProvider.tsx` (sửa) | Nối đúng preference, dùng đúng âm lượng, cache `HTMLAudioElement` |
| `frontend/src/lib/haptics.ts` (mới) | Bọc `navigator.vibrate` an toàn |
| `frontend/src/hooks/useFeedback.ts` (mới) | API sự kiện duy nhất; điều phối hình + tiếng + rung |
| `frontend/src/hooks/useFeedback.test.tsx` (mới) | Test cờ tắt và ánh xạ sự kiện → kênh |
| `frontend/src/hooks/useCountUp.ts` (mới) | Đếm số từ giá trị cũ lên giá trị mới |
| `frontend/src/hooks/useCountUp.test.tsx` (mới) | Test dừng đúng giá trị cuối |
| `frontend/src/pages/SettingsPage.tsx` (sửa) | Thêm control cho `sfx_enabled`, `haptic_enabled`, `feedback_enabled`, `sfx_volume` |

**Đợt 3 — dashboard**

| File | Trách nhiệm |
|---|---|
| `backend/app/services/progression.py` (sửa) | Hàm quy đổi múi giờ dùng chung; sửa `overview_data`; thêm `total_xp`/`level`; dữ liệu cho hai endpoint mới |
| `backend/app/schemas/progress.py` (sửa) | `CalendarDay`, `DayDetail`, `DaySkillBreakdown`, `DayArticle`; thêm trường vào `ProgressOverview` |
| `backend/app/routers/progress.py` (sửa) | `GET /api/progress/calendar`, `GET /api/progress/day/{date}` |
| `backend/app/routers/review.py` (sửa) | `/api/review/heatmap` dùng hàm múi giờ dùng chung |
| `backend/tests/test_progress_timezone.py` (mới) | Test ranh giới múi giờ |
| `backend/tests/test_progress_calendar.py` (mới) | Test hai endpoint mới |
| `frontend/src/api/progress.ts` (sửa) | `getCalendar`, `getDayDetail` |
| `frontend/src/types/index.ts` (sửa) | Kiểu cho hai response mới + hai trường mới |
| `frontend/src/pages/StatsPage.tsx` (viết lại) | Chỉ bố cục + nạp dữ liệu |
| `frontend/src/components/stats/MotivationRing.tsx` (mới) | Vùng 1 |
| `frontend/src/components/stats/RhythmPanel.tsx` (mới) | Vùng 2 |
| `frontend/src/components/stats/WeakWordsPanel.tsx` (mới) | Vùng 3 |
| `frontend/src/components/stats/DayHeatmap.tsx` (mới) | Vùng 4 trái |
| `frontend/src/components/stats/DayDetailPanel.tsx` (mới) | Vùng 4 phải |
| `frontend/src/components/stats/LibraryStrip.tsx` (mới) | Dải phụ cuối trang |
| `frontend/src/components/stats/Stats.css` (mới) | Style riêng của dashboard |

Mỗi thành phần `stats/` nhận dữ liệu đã tính sẵn qua props và không tự gọi API, trừ `DayDetailPanel`.

---

# ĐỢT 1 — NỀN CHUYỂN ĐỘNG

## Task 1: Bộ token chuyển động và quy chuẩn giá trị hardcode

**Files:**
- Modify: `frontend/src/styles/tokens.css` (khối `:root`, dòng 29–40)
- Modify: `frontend/src/styles/legacy.css`, `frontend/src/styles/components.css`, `frontend/src/components/core/CoreExperiences.css`, `frontend/src/components/orb/AiOrb.css`, `frontend/src/components/home/TodayOrbitalCommand.css`, `frontend/src/components/home/TodayOrbitalCommandStates.css`, `frontend/src/components/home/TodayOrbitalCommandMobile.css`

**Interfaces:**
- Consumes: không
- Produces: các CSS custom property `--dur-instant`, `--dur-snap`, `--ease-out`, `--ease-inout`, `--ease-spring`, `--dur-reward`, `--dur-celebrate`, `--dist-hover`, `--dist-enter`, `--scale-press`, `--scale-pop`, `--stagger-step`. Mọi task sau đều dùng.

- [ ] **Step 1: Thêm token vào `:root` trong `tokens.css`**

Chèn ngay sau dòng `--dur-fast: 150ms; --dur-base: 250ms; --dur-slow: 400ms; --dur-ambient: 26s;`:

```css
  /* Tầng A — công cụ. Mọi thao tác lặp lại. */
  --dur-instant: 90ms; --dur-snap: 180ms;
  --ease-out: cubic-bezier(.2, .8, .2, 1); --ease-inout: cubic-bezier(.4, 0, .2, 1);
  --dist-hover: 2px; --dist-enter: 8px; --scale-press: .97;

  /* Tầng B — thưởng. Chỉ khoảnh khắc đáng ăn mừng. */
  --dur-reward: 320ms; --dur-celebrate: 520ms;
  --ease-spring: cubic-bezier(.34, 1.56, .64, 1); --scale-pop: 1.18;

  /* Nhịp xếp lớp */
  --stagger-step: 45ms;
```

Không sửa các token đang có.

- [ ] **Step 2: Liệt kê mọi giá trị hardcode còn lại**

Chạy trong `frontend`:

```bash
grep -rnoE '(transition|animation)[^;]*' src --include=*.css | grep -E '[0-9.]+m?s|cubic-bezier'
```

Ghi lại danh sách. Kết quả mong đợi tại baseline: 22 khai báo `transition` và 56 khai báo `animation`, trong đó có 12 lần `160ms`, 11 lần `180ms`, 8 lần `0.2s`, và 7 đường cong `cubic-bezier` khác nhau.

- [ ] **Step 3: Thay từng giá trị theo bảng ánh xạ**

| Giá trị cũ | Thay bằng |
|---|---|
| `160ms` | `var(--dur-fast)` |
| `180ms`, `0.2s`, `200ms` | `var(--dur-snap)` |
| `250ms` | `var(--dur-base)` |
| `400ms` | `var(--dur-slow)` |
| `cubic-bezier(.2, .8, .2, 1)` và `cubic-bezier(.2,.8,.2,1)` | `var(--ease-out)` |
| `cubic-bezier(.42,0,.58,1)` | `var(--ease-inout)` |
| `cubic-bezier(0.34, 1.56, 0.64, 1)`, `cubic-bezier(.2, 1.4, .35, 1)`, `cubic-bezier(.2, 1.35, .3, 1)`, `cubic-bezier(.15, .7, .35, 1)` | `var(--ease-spring)` |

Giá trị nào không có trong bảng thì làm tròn về token gần nhất trong cùng tầng, đừng thêm token mới ở task này.

- [ ] **Step 4: Gộp keyframe trùng**

`orb-wrong` đang được định nghĩa hai lần: trong `frontend/src/styles/legacy.css` và trong `frontend/src/components/orb/AiOrb.css`. Xoá định nghĩa trong `legacy.css`, giữ bản trong `AiOrb.css`. Kiểm tra không còn chỗ nào dùng `orb-wrong` mà không nạp `AiOrb.css`:

```bash
grep -rn "orb-wrong" src
```

- [ ] **Step 5: Kiểm chứng không còn hardcode**

```bash
grep -rnoE '(transition|animation)[^;]*' src --include=*.css | grep -E '[0-9]+m?s|cubic-bezier'
```

Expected: chỉ còn các dòng trong `tokens.css` (định nghĩa token) và các khai báo `@keyframes` có `--dur-ambient`. Không còn số thời lượng trần trong file component.

- [ ] **Step 6: Build và kiểm tra mắt**

```bash
npm run build
```

Expected: build thành công, không lỗi TypeScript.

Sau đó chạy dev server và mở `/`, `/daily`, `/shadowing`. Các animation hiện có phải trông **giống hệt trước**. Đây là bước quy chuẩn, không phải bước thiết kế lại. Nếu thấy khác, đã ánh xạ sai một giá trị.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/styles frontend/src/components
git commit -m "refactor(motion): quy toàn bộ thời lượng và easing về token"
```

---

## Task 2: Helper Web Animations API

**Files:**
- Create: `frontend/src/lib/motion.ts`
- Test: `frontend/src/lib/motion.test.ts`

**Interfaces:**
- Consumes: token từ Task 1
- Produces:
  - `motionDisabled(): boolean`
  - `duration(token: DurationToken): number` với `type DurationToken = 'instant' | 'fast' | 'snap' | 'base' | 'slow' | 'reward' | 'celebrate'`
  - `animate(el: Element, keyframes: Keyframe[], token: DurationToken, easing?: 'out' | 'inout' | 'spring'): Animation`
  - `pop(el: Element): Animation`
  - `flyUp(el: Element): Animation`

- [ ] **Step 1: Viết test thất bại**

Tạo `frontend/src/lib/motion.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { animate, duration, motionDisabled } from './motion'

function setReduceEffects(value: boolean) {
  document.documentElement.dataset.reduceEffects = String(value)
}

function stubMatchMedia(reduced: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: reduced && query.includes('reduce'),
    media: query, onchange: null,
    addListener: () => undefined, removeListener: () => undefined,
    addEventListener: () => undefined, removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }))
}

afterEach(() => { setReduceEffects(false); vi.unstubAllGlobals() })

describe('motionDisabled', () => {
  it('is false by default', () => {
    stubMatchMedia(false)
    expect(motionDisabled()).toBe(false)
  })

  it('is true when the user asked for reduced motion', () => {
    stubMatchMedia(true)
    expect(motionDisabled()).toBe(true)
  })

  it('is true when the app-level reduce-effects flag is on', () => {
    stubMatchMedia(false)
    setReduceEffects(true)
    expect(motionDisabled()).toBe(true)
  })
})

describe('duration', () => {
  it('reads the value from the CSS token, not from a literal', () => {
    document.documentElement.style.setProperty('--dur-reward', '320ms')
    expect(duration('reward')).toBe(320)
  })

  it('falls back to a safe value when the token is missing', () => {
    document.documentElement.style.removeProperty('--dur-celebrate')
    expect(duration('celebrate')).toBeGreaterThan(0)
  })
})

describe('animate', () => {
  it('returns an already-finished animation when motion is disabled', async () => {
    stubMatchMedia(false)
    setReduceEffects(true)
    const el = document.createElement('div')
    document.body.append(el)
    const animation = animate(el, [{ opacity: 0 }, { opacity: 1 }], 'base')
    await expect(animation.finished).resolves.toBeDefined()
    expect(animation.playState).toBe('finished')
  })
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

```bash
cd frontend && npx vitest run src/lib/motion.test.ts
```

Expected: FAIL — `Failed to resolve import "./motion"`.

- [ ] **Step 3: Viết implementation tối thiểu**

Tạo `frontend/src/lib/motion.ts`:

```ts
export type DurationToken = 'instant' | 'fast' | 'snap' | 'base' | 'slow' | 'reward' | 'celebrate'
export type EasingToken = 'out' | 'inout' | 'spring'

const FALLBACK_MS: Record<DurationToken, number> = {
  instant: 90, fast: 150, snap: 180, base: 250, slow: 400, reward: 320, celebrate: 520,
}
const FALLBACK_EASE: Record<EasingToken, string> = {
  out: 'cubic-bezier(.2, .8, .2, 1)',
  inout: 'cubic-bezier(.4, 0, .2, 1)',
  spring: 'cubic-bezier(.34, 1.56, .64, 1)',
}

function readVar(name: string): string {
  if (typeof window === 'undefined') return ''
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

/**
 * The CSS kill switches use `!important`, which the Web Animations API ignores.
 * Every WAAPI call must therefore consult both flags itself.
 */
export function motionDisabled(): boolean {
  if (typeof window === 'undefined') return true
  if (document.documentElement.dataset.reduceEffects === 'true') return true
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

export function duration(token: DurationToken): number {
  const raw = readVar(`--dur-${token}`)
  const parsed = raw.endsWith('ms') ? Number.parseFloat(raw) : raw.endsWith('s') ? Number.parseFloat(raw) * 1000 : Number.NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : FALLBACK_MS[token]
}

export function easing(token: EasingToken): string {
  return readVar(`--ease-${token}`) || FALLBACK_EASE[token]
}

function finished(el: Element): Animation {
  const animation = el.animate([], { duration: 0 })
  animation.finish()
  return animation
}

export function animate(el: Element, keyframes: Keyframe[], token: DurationToken, ease: EasingToken = 'out'): Animation {
  if (motionDisabled()) return finished(el)
  return el.animate(keyframes, { duration: duration(token), easing: easing(ease), fill: 'none' })
}

function scaleToken(name: string, fallback: number): number {
  const parsed = Number.parseFloat(readVar(name))
  return Number.isFinite(parsed) ? parsed : fallback
}

export function pop(el: Element): Animation {
  const peak = scaleToken('--scale-pop', 1.18)
  return animate(el, [{ transform: 'scale(1)' }, { transform: `scale(${peak})` }, { transform: 'scale(1)' }], 'reward', 'spring')
}

export function flyUp(el: Element): Animation {
  return animate(el, [
    { opacity: 0, transform: 'translateY(0)' },
    { opacity: 1, transform: 'translateY(-40%)', offset: .3 },
    { opacity: 0, transform: 'translateY(-140%)' },
  ], 'celebrate', 'out')
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

```bash
cd frontend && npx vitest run src/lib/motion.test.ts
```

Expected: PASS, 6 test.

Nếu `el.animate` không tồn tại trong jsdom, thêm vào đầu `frontend/src/test/setup.ts`:

```ts
if (!Element.prototype.animate) {
  Element.prototype.animate = function () {
    let resolveFinished: (value: unknown) => void = () => undefined
    const finishedPromise = new Promise(resolve => { resolveFinished = resolve })
    const animation = {
      playState: 'running' as AnimationPlayState,
      finished: finishedPromise,
      cancel() { this.playState = 'idle' },
      finish() { this.playState = 'finished'; resolveFinished(this) },
    }
    return animation as unknown as Animation
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/motion.ts frontend/src/lib/motion.test.ts frontend/src/test/setup.ts
git commit -m "feat(motion): helper WAAPI đọc token và tôn trọng cờ tắt hiệu ứng"
```

---

## Task 3: Hệ hover và trạng thái nhấn

**Files:**
- Modify: `frontend/src/styles/motion.css`

**Interfaces:**
- Consumes: token từ Task 1
- Produces: class `.tap` (phần tử bấm được), `.hint` (phần tử có thông tin phụ). Task 18–22 dùng.

- [ ] **Step 1: Thêm lớp hover vào `motion.css`**

Chèn vào `frontend/src/styles/motion.css`, **phía trên** khối `@media (prefers-reduced-motion: reduce)` đang có (khối đó phải luôn đứng cuối để thắng thứ tự):

```css
/* Bấm được: nâng nhẹ, sáng một bậc, viền rõ hơn. */
.tap {
  transition: transform var(--dur-fast) var(--ease-out),
              background-color var(--dur-fast) var(--ease-out),
              border-color var(--dur-fast) var(--ease-out);
}
@media (hover: hover) {
  .tap:hover { transform: translateY(calc(-1 * var(--dist-hover))); background-color: var(--color-surface-2); border-color: var(--color-strong); }
}
.tap:active { transform: scale(var(--scale-press)); transition-duration: var(--dur-instant); }
.tap:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }

/* Có thông tin phụ: tooltip trượt vào, phần tử không nâng. */
.hint { position: relative; }
.hint > [data-tip] {
  position: absolute; bottom: 100%; left: 50%;
  opacity: 0; pointer-events: none;
  transform: translate(-50%, var(--dist-hover));
  transition: opacity var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out);
}
@media (hover: hover) {
  .hint:hover > [data-tip], .hint:focus-visible > [data-tip] { opacity: 1; transform: translate(-50%, calc(-1 * var(--dist-hover))); }
}
```

- [ ] **Step 2: Áp `.tap` cho các phần tử bấm được**

Thêm class `tap` vào phần tử gốc của: `frontend/src/components/DeckCard.tsx`, `frontend/src/components/home/HomeSideTiles.tsx`, `frontend/src/components/reader/CatalogPreview.tsx`, và mọi `<button>` trong `frontend/src/components/shell/DesktopRail.tsx` và `frontend/src/components/shell/MobileNav.tsx`.

**Không** thêm vào phần tử chỉ hiển thị: các thẻ KPI trong `StatsPage`, các nhãn `eyebrow`, các `<small>` mô tả. Nếu mọi thứ đều sáng lên khi rê chuột thì người dùng mất khả năng đoán cái gì bấm được.

- [ ] **Step 3: Kiểm tra mắt trên desktop và mobile**

Chạy dev server, mở `/library`:
- Rê chuột lên một `DeckCard`: nâng 2px, nền sáng lên, viền rõ hơn.
- Nhấn giữ: thu về 97%.
- Nhấn `Tab`: viền focus hiện rõ.

Thu cửa sổ về 375px hoặc bật device toolbar, chạm vào một `DeckCard`: **không được** kẹt lại trạng thái hover sau khi nhấc tay. Nếu kẹt, một rule hover đã lọt ra ngoài `@media (hover: hover)`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/styles/motion.css frontend/src/components
git commit -m "feat(motion): hệ hover ba mức và trạng thái nhấn"
```

---

## Task 4: Vào màn xếp lớp

**Files:**
- Modify: `frontend/src/styles/motion.css`

**Interfaces:**
- Consumes: token từ Task 1
- Produces: class `.stagger` đặt trên container, `.enter` cho phần tử đơn lẻ.

- [ ] **Step 1: Thêm lớp xếp lớp vào `motion.css`**

Chèn phía trên khối `prefers-reduced-motion`:

```css
@keyframes enter-rise {
  from { opacity: 0; transform: translateY(var(--dist-enter)); }
  to   { opacity: 1; transform: none; }
}

.enter { animation: enter-rise var(--dur-base) var(--ease-out) both; }

.stagger > * { animation: enter-rise var(--dur-base) var(--ease-out) both; }
.stagger > :nth-child(1) { animation-delay: 0ms; }
.stagger > :nth-child(2) { animation-delay: var(--stagger-step); }
.stagger > :nth-child(3) { animation-delay: calc(var(--stagger-step) * 2); }
.stagger > :nth-child(4) { animation-delay: calc(var(--stagger-step) * 3); }
.stagger > :nth-child(5) { animation-delay: calc(var(--stagger-step) * 4); }
/* Từ phần tử 6 trở đi dùng chung một độ trễ: danh sách 20 mục mà trễ dần đều
   sẽ mất gần một giây mới hiện xong — đó là chậm chạp, không phải sang trọng. */
.stagger > :nth-child(n + 6) { animation-delay: calc(var(--stagger-step) * 5); }
```

- [ ] **Step 2: Áp `.stagger` cho các lưới nội dung**

Thêm class `stagger` vào container lưới trong: `frontend/src/pages/LibraryPage.tsx` (lưới deck), `frontend/src/pages/ReaderListPage.tsx` (danh sách bài), `frontend/src/components/home/HomeSideTiles.tsx` (nhóm tile).

- [ ] **Step 3: Kiểm tra mắt**

Mở `/library` và tải lại trang. Các thẻ phải hiện lệch nhau rõ ràng nhưng toàn bộ lưới hiện xong trong khoảng 0.5 giây. Nếu chờ lâu hơn, rule `nth-child(n + 6)` chưa ăn.

Bật Settings → Reduce effects, tải lại: mọi thẻ hiện ngay lập tức, không có độ trễ.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/styles/motion.css frontend/src/pages frontend/src/components
git commit -m "feat(motion): nội dung vào màn xếp lớp"
```

---

## Task 5: Skeleton và thông báo máy chủ thức dậy

**Files:**
- Create: `frontend/src/components/shell/Skeleton.tsx`
- Test: `frontend/src/components/shell/Skeleton.test.tsx`
- Modify: `frontend/src/styles/motion.css`

**Interfaces:**
- Consumes: token từ Task 1
- Produces: `<Skeleton lines={number} />` và `<LoadingRegion label={string} lines={number} />`. Task 18 dùng `LoadingRegion` thay cho `<AiOrb state="loading" />`.

- [ ] **Step 1: Viết test thất bại**

Tạo `frontend/src/components/shell/Skeleton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { LoadingRegion } from './Skeleton'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

it('announces the region while it loads', () => {
  render(<LoadingRegion label="Đang tải tiến độ" lines={3} />)
  expect(screen.getByRole('status')).toHaveTextContent('Đang tải tiến độ')
})

it('explains the free-tier cold start only after eight seconds', () => {
  render(<LoadingRegion label="Đang tải tiến độ" lines={3} />)
  expect(screen.queryByText(/thức dậy/)).not.toBeInTheDocument()
  vi.advanceTimersByTime(8000)
  expect(screen.getByText(/thức dậy/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

```bash
cd frontend && npx vitest run src/components/shell/Skeleton.test.tsx
```

Expected: FAIL — `Failed to resolve import "./Skeleton"`.

- [ ] **Step 3: Viết implementation**

Tạo `frontend/src/components/shell/Skeleton.tsx`:

```tsx
import { useEffect, useState } from 'react'

const COLD_START_MS = 8000

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return <div className="skeleton" aria-hidden="true">{Array.from({ length: lines }, (_, index) => <i key={index} />)}</div>
}

/**
 * Render ở đúng khung bố cục của nội dung sắp hiện. Render free tier ngủ dậy mất
 * khoảng 30 giây; không nói ra thì người dùng sẽ kết luận app hỏng.
 */
export function LoadingRegion({ label, lines = 3 }: { label: string; lines?: number }) {
  const [cold, setCold] = useState(false)
  useEffect(() => {
    const timer = window.setTimeout(() => setCold(true), COLD_START_MS)
    return () => window.clearTimeout(timer)
  }, [])
  return (
    <div className="loading-region" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <Skeleton lines={lines} />
      {cold ? <p className="loading-region__cold">Máy chủ đang thức dậy — lần đầu trong ngày thường mất khoảng nửa phút.</p> : null}
    </div>
  )
}
```

- [ ] **Step 4: Thêm style vào `motion.css`**

Chèn phía trên khối `prefers-reduced-motion`:

```css
@keyframes skeleton-breathe { 50% { opacity: .35; } }

.skeleton { display: grid; gap: .625rem; }
.skeleton > i {
  display: block; height: 1rem; border-radius: .5rem;
  background: var(--color-surface-2);
  animation: skeleton-breathe 1.6s var(--ease-inout) infinite;
}
.skeleton > i:nth-child(even) { width: 72%; }
.loading-region__cold { margin-top: .75rem; color: var(--text-muted); font-size: .875rem; }
```

- [ ] **Step 5: Chạy test để xác nhận pass**

```bash
cd frontend && npx vitest run src/components/shell/Skeleton.test.tsx
```

Expected: PASS, 2 test.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/shell/Skeleton.tsx frontend/src/components/shell/Skeleton.test.tsx frontend/src/styles/motion.css
git commit -m "feat(motion): skeleton nhịp thở và thông báo máy chủ thức dậy"
```

---

## Task 6: Chuyển cảnh giữa trang

**Files:**
- Create: `frontend/src/components/shell/RouteTransition.tsx`
- Modify: `frontend/src/components/shell/AppShell.tsx`
- Modify: `frontend/src/styles/motion.css`

**Interfaces:**
- Consumes: `motionDisabled()` từ Task 2
- Produces: `<RouteTransition>{children}</RouteTransition>`

- [ ] **Step 1: Viết component**

Tạo `frontend/src/components/shell/RouteTransition.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { motionDisabled } from '../../lib/motion'

type StartViewTransition = (callback: () => void) => { finished: Promise<void> }

/**
 * View Transitions chạy trên Chrome, Edge và Safari 18+. Firefox chưa hỗ trợ;
 * fallback là fade-in CSS thuần. Đó là hành vi hợp lệ, không phải lỗi.
 */
export default function RouteTransition({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  const [rendered, setRendered] = useState(children)
  const previous = useRef(pathname)

  useEffect(() => {
    if (previous.current === pathname) { setRendered(children); return }
    previous.current = pathname
    const start = (document as Document & { startViewTransition?: StartViewTransition }).startViewTransition
    if (motionDisabled() || typeof start !== 'function') { setRendered(children); return }
    start.call(document, () => { setRendered(children) })
  }, [pathname, children])

  return <div className="route-transition" key={pathname}>{rendered}</div>
}
```

- [ ] **Step 2: Bọc vùng nội dung trong `AppShell`**

Trong `frontend/src/components/shell/AppShell.tsx`, tìm nơi render `<Outlet />` và bọc lại:

```tsx
<RouteTransition><Outlet /></RouteTransition>
```

Thêm import `import RouteTransition from './RouteTransition'`.

- [ ] **Step 3: Thêm style fallback vào `motion.css`**

Chèn phía trên khối `prefers-reduced-motion`:

```css
@keyframes route-fade { from { opacity: 0; } to { opacity: 1; } }

.route-transition { animation: route-fade var(--dur-base) var(--ease-out) both; }

::view-transition-old(root) { animation: route-fade var(--dur-base) var(--ease-out) reverse both; }
::view-transition-new(root) { animation: route-fade var(--dur-base) var(--ease-out) both; }
```

Không dùng slide theo hướng điều hướng: app có cả rail dọc lẫn nav ngang nên không tồn tại một trục tiến/lùi nhất quán.

- [ ] **Step 4: Kiểm tra mắt**

Chạy dev server. Bấm qua lại `/` → `/library` → `/stats`. Nội dung phải mờ chồng chứ không nhảy cụp.

Mở Firefox làm cùng thao tác: phải thấy fade-in đơn giản, không lỗi console.

Bật Settings → Reduce effects: đổi trang tức thì, không có hiệu ứng.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/shell frontend/src/styles/motion.css
git commit -m "feat(motion): chuyển cảnh giữa trang bằng View Transitions"
```

**Điểm dừng đợt 1.** Dùng thử toàn app trước khi sang đợt 2.

---

# ĐỢT 2 — ĐƯỜNG ỐNG PHẢN HỒI

## Task 7: Sinh asset `levelup.wav`

**Files:**
- Modify: `frontend/scripts/generate_original_audio.py`
- Create: `frontend/public/audio/levelup.wav` (sinh ra, không viết tay)
- Modify: `frontend/public/audio/ATTRIBUTION.md`

**Interfaces:**
- Consumes: hàm `effect(name, notes, duration)` đã có trong script
- Produces: asset `/audio/levelup.wav`, Task 8 ánh xạ tới

- [ ] **Step 1: Thêm một dòng vào script**

Trong `frontend/scripts/generate_original_audio.py`, ngay sau dòng `effect('complete.wav', ...)`:

```python
effect('levelup.wav', [(0, 523.25), (.08, 659.25), (.16, 783.99), (.24, 1046.5), (.32, 1318.5)], .68)
```

Dùng đúng hàm `effect` đã có — không viết synthesis mới, không thêm import.

- [ ] **Step 2: Chạy script**

```bash
cd frontend && C:/Users/Admin/anaconda3/envs/flashcard/python.exe scripts/generate_original_audio.py
```

Expected: chạy xong không lỗi. `frontend/public/audio/levelup.wav` tồn tại.

Script ghi đè cả các file cũ. Xác nhận chúng không đổi:

```bash
cd frontend && git status --short public/audio
```

Expected: chỉ `levelup.wav` là file mới; không file wav nào khác bị sửa. Nếu có file khác đổi, synthesis không còn tất định — dừng lại và điều tra trước khi commit.

- [ ] **Step 3: Cập nhật `ATTRIBUTION.md`**

Lấy SHA-256:

```bash
cd frontend && C:/Users/Admin/anaconda3/envs/flashcard/python.exe -c "import hashlib,pathlib;print(hashlib.sha256(pathlib.Path('public/audio/levelup.wav').read_bytes()).hexdigest().upper())"
```

Thêm một dòng vào bảng trong `frontend/public/audio/ATTRIBUTION.md`, giữ đúng thứ tự bảng chữ cái (giữa `combo.wav` và `ui.wav`):

```markdown
| `levelup.wav` | `<giá trị vừa in ra>` |
```

- [ ] **Step 4: Commit**

```bash
git add frontend/scripts/generate_original_audio.py frontend/public/audio
git commit -m "feat(audio): thêm âm báo lên level bằng script synthesis đã có"
```

---

## Task 8: Nối `AudioProvider` vào preference thật

**Files:**
- Modify: `frontend/src/providers/AudioProvider.tsx`
- Test: `frontend/src/providers/AudioProvider.test.tsx`

**Interfaces:**
- Consumes: `UserPreferences` trong `frontend/src/types/index.ts` (đã có `sfx_enabled`, `haptic_enabled`, `feedback_enabled`, `sfx_volume`, `master_volume`, `silent_mode`)
- Produces: `useAudio()` trả thêm `sfx(kind: SfxKind)` với `type SfxKind = 'correct' | 'wrong' | 'combo' | 'complete' | 'checkpoint' | 'levelup' | 'ui'`. Task 9 dùng.

- [ ] **Step 1: Viết test thất bại**

Tạo `frontend/src/providers/AudioProvider.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { AudioProvider, useAudio } from './AudioProvider'
import { AuthContext } from '../auth/AuthContext'
import type { User } from '../types'

const played: Array<{ src: string; volume: number; element: object }> = []

class FakeAudio {
  volume = 1
  currentTime = 0
  constructor(public src: string) {}
  play() { played.push({ src: this.src, volume: this.volume, element: this }); return Promise.resolve() }
  pause() {}
}

function makeUser(overrides: Record<string, unknown>): User {
  return { id: 'u1', email: 'a@b.c', name: 'A', preferences: {
    sfx_enabled: true, haptic_enabled: true, feedback_enabled: true, silent_mode: false,
    sfx_volume: 0.5, master_volume: 0.8,
    ...overrides,
  } } as unknown as User
}

function Probe({ onReady }: { onReady: (api: ReturnType<typeof useAudio>) => void }) {
  onReady(useAudio())
  return null
}

function mount(user: User) {
  let api!: ReturnType<typeof useAudio>
  render(
    <AuthContext.Provider value={{ user, setUser: () => undefined } as never}>
      <AudioProvider><Probe onReady={value => { api = value }} /></AudioProvider>
    </AuthContext.Provider>,
  )
  return api
}

beforeEach(() => { played.length = 0; vi.stubGlobal('Audio', FakeAudio) })

it('plays at sfx_volume multiplied by master_volume', () => {
  mount(makeUser({})).sfx('correct')
  expect(played).toHaveLength(1)
  expect(played[0].src).toContain('/audio/correct.wav')
  expect(played[0].volume).toBeCloseTo(0.4)
})

it('reuses one audio element when the same asset plays twice', () => {
  const api = mount(makeUser({}))
  api.sfx('correct'); api.sfx('correct')
  expect(played).toHaveLength(2)
  expect(played[0].element).toBe(played[1].element)
})

it('stays silent when sfx_enabled is off', () => {
  mount(makeUser({ sfx_enabled: false })).sfx('correct')
  expect(played).toHaveLength(0)
})

it('stays silent when silent_mode is on', () => {
  mount(makeUser({ silent_mode: true })).sfx('correct')
  expect(played).toHaveLength(0)
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

```bash
cd frontend && npx vitest run src/providers/AudioProvider.test.tsx
```

Expected: FAIL — `api.sfx is not a function`.

Nếu lỗi là `AuthContext is not exported`, mở `frontend/src/auth/AuthContext.tsx` và export context object đó (`export const AuthContext = createContext(...)`) — chỉ thêm từ khoá `export`, không đổi gì khác.

- [ ] **Step 3: Sửa `AudioProvider.tsx`**

Thay ba chỗ trong `frontend/src/providers/AudioProvider.tsx`:

1. Thêm kiểu và cache ở đầu file, sau các import:

```tsx
export type SfxKind = 'correct' | 'wrong' | 'combo' | 'complete' | 'checkpoint' | 'levelup' | 'ui'
```

2. Trong `AudioProvider`, thay `play` bằng:

```tsx
  const prefs = user?.preferences
  const cache = useMemo(() => new Map<string, HTMLAudioElement>(), [])
  const volume = Math.max(0, Math.min(1, (prefs?.sfx_volume ?? .7) * (prefs?.master_volume ?? .8)))
  const soundAllowed = !silent && prefs?.silent_mode !== true && prefs?.feedback_enabled !== false && prefs?.sfx_enabled !== false

  // Một đối tượng Audio cho mỗi asset. Trước đây mỗi lần phát tạo một đối tượng
  // mới; với nhịp trả lời nhanh sẽ sinh hàng chục đối tượng trong một buổi học.
  const play = useCallback((asset: string) => {
    if (!soundAllowed || typeof Audio === 'undefined') return
    let element = cache.get(asset)
    if (!element) { element = new Audio(`/audio/${asset}.wav`); cache.set(asset, element) }
    element.volume = volume
    element.currentTime = 0
    void element.play().catch(() => undefined)
  }, [cache, soundAllowed, volume])
```

3. Thêm `sfx` vào giá trị context và vào type `AudioState`:

```tsx
  const sfx = useCallback((kind: SfxKind) => play(kind), [play])
```

Trong `type AudioState`, thêm `sfx: (kind: SfxKind) => void`. Trong `useMemo` trả về value, thêm `sfx` vào cả object lẫn mảng dependency.

Giữ nguyên `feedback`, `ui`, `playAmbient`, `stopAmbient`, `duckAmbient` — có nơi đang gọi chúng.

- [ ] **Step 4: Chạy test để xác nhận pass**

```bash
cd frontend && npx vitest run src/providers/AudioProvider.test.tsx
```

Expected: PASS, 4 test.

- [ ] **Step 5: Chạy toàn bộ test frontend**

```bash
cd frontend && npm test
```

Expected: PASS toàn bộ. Nếu `ExerciseCard` gãy, nó đang gọi `feedback(...)` — hàm đó vẫn còn, kiểm tra lại đã giữ nguyên chưa.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/providers/AudioProvider.tsx frontend/src/providers/AudioProvider.test.tsx frontend/src/auth/AuthContext.tsx
git commit -m "fix(audio): dùng đúng sfx_volume, cache thẻ audio, tôn trọng sfx_enabled"
```

---

## Task 9: Hook `useFeedback`

**Files:**
- Create: `frontend/src/lib/haptics.ts`
- Create: `frontend/src/hooks/useFeedback.ts`
- Test: `frontend/src/hooks/useFeedback.test.tsx`

**Interfaces:**
- Consumes: `useAudio().sfx` (Task 8), `pop`/`flyUp`/`motionDisabled` (Task 2)
- Produces:

```ts
type Skill = 'vocabulary' | 'reading' | 'listening' | 'speaking'
interface Feedback {
  correct(el?: Element | null): void
  wrong(el?: Element | null): void
  saved(el?: Element | null): void
  streakKept(days: number, el?: Element | null): void
  xpGained(amount: number, options?: { final?: boolean; el?: Element | null }): void
  levelUp(skill: Skill, level: number, el?: Element | null): void
  sessionComplete(xp: number, accuracy: number, el?: Element | null): void
}
export function useFeedback(): Feedback
```

Task 10 và Task 22 dùng hook này.

- [ ] **Step 1: Viết `lib/haptics.ts`**

```ts
/**
 * iOS Safari không hỗ trợ navigator.vibrate và không có lộ trình hỗ trợ. Trên
 * iPhone sẽ không rung — đó là giới hạn nền tảng đã biết, không phải lỗi.
 * Một số trình duyệt desktop có thuộc tính này nhưng ném lỗi khi gọi.
 */
export function vibrate(pattern: number | number[]): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false
  try { return navigator.vibrate(pattern) } catch { return false }
}
```

- [ ] **Step 2: Viết test thất bại**

Tạo `frontend/src/hooks/useFeedback.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { useFeedback } from './useFeedback'
import { AudioProvider } from '../providers/AudioProvider'
import { AuthContext } from '../auth/AuthContext'
import type { User } from '../types'

const played: string[] = []
const vibrated: Array<number | number[]> = []

class FakeAudio {
  volume = 1; currentTime = 0
  constructor(public src: string) {}
  play() { played.push(this.src); return Promise.resolve() }
  pause() {}
}

function makeUser(overrides: Record<string, unknown>): User {
  return { id: 'u1', email: 'a@b.c', name: 'A', preferences: {
    sfx_enabled: true, haptic_enabled: true, feedback_enabled: true, silent_mode: false,
    sfx_volume: 1, master_volume: 1, ...overrides,
  } } as unknown as User
}

function mount(user: User) {
  let api!: ReturnType<typeof useFeedback>
  function Probe() { api = useFeedback(); return null }
  render(
    <AuthContext.Provider value={{ user, setUser: () => undefined } as never}>
      <AudioProvider><Probe /></AudioProvider>
    </AuthContext.Provider>,
  )
  return api
}

beforeEach(() => {
  played.length = 0; vibrated.length = 0
  vi.stubGlobal('Audio', FakeAudio)
  vi.stubGlobal('navigator', { ...navigator, vibrate: (pattern: number | number[]) => { vibrated.push(pattern); return true } })
})

it('plays the correct sound and a short buzz on a right answer', () => {
  mount(makeUser({})).correct()
  expect(played.some(src => src.includes('correct.wav'))).toBe(true)
  expect(vibrated).toEqual([10])
})

it('plays the level-up asset on level up', () => {
  mount(makeUser({})).levelUp('vocabulary', 3)
  expect(played.some(src => src.includes('levelup.wav'))).toBe(true)
})

it('stays silent for mid-session xp so it does not stack on the answer sound', () => {
  mount(makeUser({})).xpGained(4)
  expect(played).toHaveLength(0)
})

it('plays the combo asset for end-of-session xp', () => {
  mount(makeUser({})).xpGained(40, { final: true })
  expect(played.some(src => src.includes('combo.wav'))).toBe(true)
})

it('does not vibrate when haptic_enabled is off', () => {
  mount(makeUser({ haptic_enabled: false })).correct()
  expect(vibrated).toHaveLength(0)
})

it('does nothing at all when feedback_enabled is off', () => {
  mount(makeUser({ feedback_enabled: false })).correct()
  expect(played).toHaveLength(0)
  expect(vibrated).toHaveLength(0)
})
```

- [ ] **Step 3: Chạy test để xác nhận thất bại**

```bash
cd frontend && npx vitest run src/hooks/useFeedback.test.tsx
```

Expected: FAIL — `Failed to resolve import "./useFeedback"`.

- [ ] **Step 4: Viết `hooks/useFeedback.ts`**

```ts
import { useCallback, useMemo } from 'react'
import { useAuth } from '../auth/AuthContext'
import { useAudio } from '../providers/AudioProvider'
import type { SfxKind } from '../providers/AudioProvider'
import { vibrate } from '../lib/haptics'
import { animate, flyUp, pop } from '../lib/motion'

export type Skill = 'vocabulary' | 'reading' | 'listening' | 'speaking'

const STREAK_MILESTONES = [7, 30, 100]

/**
 * API duy nhất để phát phản hồi. Nơi gọi phát ra một sự kiện có ý nghĩa; hook tự
 * quyết định tầng chuyển động và tự kích hoạt cả ba kênh. Không màn nào được tự
 * viết animation phản hồi riêng — đó là điều kiện để tính nhất quán tồn tại về
 * mặt cấu trúc chứ không chỉ về mặt token.
 */
export function useFeedback() {
  const { user } = useAuth()
  const { sfx } = useAudio()
  const enabled = user?.preferences?.feedback_enabled !== false && user?.preferences?.silent_mode !== true
  const hapticOn = enabled && user?.preferences?.haptic_enabled !== false

  const fire = useCallback((sound: SfxKind | null, buzz: number | number[] | null, el: Element | null | undefined, tier: 'tool' | 'reward') => {
    if (!enabled) return
    if (sound) sfx(sound)
    if (buzz && hapticOn) vibrate(buzz)
    if (!el) return
    if (tier === 'reward') { pop(el); return }
    animate(el, [{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }], 'snap', 'out')
  }, [enabled, hapticOn, sfx])

  return useMemo(() => ({
    correct: (el?: Element | null) => fire('correct', 10, el, 'tool'),
    wrong: (el?: Element | null) => fire('wrong', [15, 40, 15], el, 'tool'),
    saved: (el?: Element | null) => fire('ui', null, el, 'tool'),
    streakKept: (days: number, el?: Element | null) =>
      STREAK_MILESTONES.includes(days)
        ? fire('checkpoint', [20, 30, 20], el, 'reward')
        : fire(null, null, el, 'tool'),
    // XP giữa buổi không phát tiếng: đã có tiếng cho câu đúng rồi, thêm nữa là chồng tiếng.
    // Phần hình là số bay lên, không phải nhịp scale như các sự kiện khác.
    xpGained: (_amount: number, options?: { final?: boolean; el?: Element | null }) => {
      if (!enabled) return
      if (options?.final) { fire('combo', null, options.el, 'reward'); return }
      if (options?.el) flyUp(options.el)
    },
    levelUp: (_skill: Skill, _level: number, el?: Element | null) => fire('levelup', [20, 30, 20, 30, 40], el, 'reward'),
    sessionComplete: (_xp: number, _accuracy: number, el?: Element | null) => fire('complete', [20, 40, 20], el, 'reward'),
  }), [enabled, fire])
}
```

- [ ] **Step 5: Chạy test để xác nhận pass**

```bash
cd frontend && npx vitest run src/hooks/useFeedback.test.tsx
```

Expected: PASS, 6 test.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/haptics.ts frontend/src/hooks/useFeedback.ts frontend/src/hooks/useFeedback.test.tsx
git commit -m "feat(feedback): một hook điều phối hình, tiếng và rung"
```

---

## Task 10: Nối các màn học vào `useFeedback`

**Files:**
- Modify: `frontend/src/components/daily/steps/FlipStep.tsx`, `ReviewStep.tsx`, `DictationStep.tsx`, `SpeakStep.tsx`, `SplitStep.tsx`, `WeakStep.tsx`
- Modify: `frontend/src/components/daily/ExerciseCard.tsx`
- Modify: `frontend/src/components/daily/DailySummary.tsx`
- Modify: `frontend/src/components/reader/WordPopup.tsx`

**Interfaces:**
- Consumes: `useFeedback()` từ Task 9
- Produces: không có API mới

- [ ] **Step 1: Tìm mọi chỗ đang tự phát phản hồi**

```bash
cd frontend && grep -rn "useAudio\|feedback(" src/components/daily src/components/reader
```

Ghi lại danh sách. `ExerciseCard.tsx:16` đang gọi `const { feedback } = useAudio()`.

- [ ] **Step 2: Thay từng chỗ**

Trong mỗi file trên: bỏ `useAudio()` (trừ `DailyProgress.tsx`, `PageHeader.tsx`, `AppShell.tsx`, `ShadowingPage.tsx` — bốn file này dùng `silent`/`duckAmbient`, không phải phản hồi học), thêm:

```tsx
const fb = useFeedback()
```

Chuyển lời gọi:

| Cũ | Mới |
|---|---|
| `feedback('correct')` | `fb.correct(cardRef.current)` |
| `feedback('wrong')` | `fb.wrong(cardRef.current)` |
| `feedback('complete')` | `fb.sessionComplete(xp, accuracy, cardRef.current)` |
| `feedback('combo')` | `fb.xpGained(amount, { final: true, el: cardRef.current })` |

`cardRef` là `useRef<HTMLDivElement>(null)` gắn vào phần tử thẻ bài tập. Nếu file chưa có ref như vậy thì thêm; nếu không có phần tử phù hợp thì gọi không tham số.

Trong `WordPopup.tsx`, sau khi lưu từ thành công, gọi `fb.saved()`.

- [ ] **Step 3: Xoá mọi animation phản hồi viết tay còn lại**

```bash
cd frontend && grep -rn "answerShake\|orb-success\|orb-wrong" src/components/daily
```

Mọi chỗ tự thêm class animation khi trả lời đúng/sai trong `src/components/daily` phải bị xoá — `useFeedback` đã lo phần đó. Giữ nguyên các animation trong `src/components/orb` và `src/components/games` (chúng thuộc màn khác).

- [ ] **Step 4: Chạy test**

```bash
cd frontend && npm test && npm run build
```

Expected: PASS toàn bộ, build sạch.

- [ ] **Step 5: Kiểm tra bằng tay**

Chạy dev server, vào một buổi học. Với mỗi loại bước (Flip, Review, Dictation, Speak, Split, Weak): trả lời đúng một lần và sai một lần. Cả sáu bước phải cho **cùng một** cảm giác phản hồi. Nếu một bước im lặng hoặc rung khác, chỗ đó chưa được nối.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/daily frontend/src/components/reader
git commit -m "refactor(daily): mọi bước học phát phản hồi qua useFeedback"
```

---

## Task 11: Control âm thanh và rung trong Settings

**Files:**
- Modify: `frontend/src/pages/SettingsPage.tsx`

**Interfaces:**
- Consumes: `updatePreferences` trong `frontend/src/api/auth.ts`, `UserPreferences` trong types
- Produces: không có API mới

- [ ] **Step 1: Thay khối "Sound & speech"**

Trong `frontend/src/pages/SettingsPage.tsx`, thay `<section className="glass-panel"><h2>Sound & speech</h2>…</section>` bằng:

```tsx
<section className="glass-panel">
  <h2>Sound & haptics</h2>
  <label><input checked={prefs.feedback_enabled !== false} onChange={event => save({ feedback_enabled: event.target.checked })} type="checkbox" /> Learning feedback</label>
  <label><input checked={prefs.sfx_enabled !== false} onChange={event => save({ sfx_enabled: event.target.checked })} type="checkbox" /> Answer sounds</label>
  <label><input checked={prefs.haptic_enabled !== false} onChange={event => save({ haptic_enabled: event.target.checked })} type="checkbox" /> Vibration (Android only)</label>
  <label>Sound volume<input max={1} min={0} onChange={event => save({ sfx_volume: Number(event.target.value) })} step={.1} type="range" value={prefs.sfx_volume ?? .7} /></label>
  <button className="button-secondary" onClick={toggleSilent}>{silent ? 'Turn Silent mode off' : 'Turn Silent mode on'}</button>
  <p>Silent mode turns everything off, including background music and pronunciation. Learning feedback covers answer sounds, vibration and reward motion.</p>
</section>
```

Thêm ở đầu component:

```tsx
const prefs = user?.preferences ?? ({} as Partial<UserPreferences>)
const save = (changes: Partial<UserPreferences>) => { void updatePreferences(changes).then(setUser).catch(() => undefined) }
```

và các import cần thiết: `updatePreferences` từ `../api/auth`, `UserPreferences` từ `../types`. Lấy `setUser` từ `useAuth()`.

Nhãn phải nói đúng phạm vi: "Silent mode" cũ chỉ nói về nhạc nền và phát âm, giờ nó tắt cả âm báo học.

- [ ] **Step 2: Kiểm tra bằng tay**

Chạy dev server, mở `/settings`. Tắt "Answer sounds", vào buổi học trả lời một câu: không có tiếng nhưng **vẫn có chuyển động và vẫn rung**. Tắt "Learning feedback": không tiếng, không rung, chỉ đổi màu tức thì. Tải lại trang: cả hai lựa chọn còn nguyên (đã lưu về server).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/SettingsPage.tsx
git commit -m "feat(settings): control cho âm báo học, rung và âm lượng"
```

---

## Task 12: Số đếm tăng

**Files:**
- Create: `frontend/src/hooks/useCountUp.ts`
- Test: `frontend/src/hooks/useCountUp.test.tsx`

**Interfaces:**
- Consumes: `motionDisabled`, `duration` từ Task 2
- Produces: `useCountUp(value: number, token?: DurationToken): number`. Task 18 và 22 dùng.

- [ ] **Step 1: Viết test thất bại**

Tạo `frontend/src/hooks/useCountUp.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useCountUp } from './useCountUp'

function Probe({ value }: { value: number }) { return <span>{useCountUp(value)}</span> }

beforeEach(() => {
  vi.useFakeTimers()
  let now = 0
  vi.stubGlobal('performance', { now: () => now })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    Number(setTimeout(() => { now += 16; callback(now) }, 16)))
  vi.stubGlobal('cancelAnimationFrame', (handle: number) => clearTimeout(handle))
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

it('lands exactly on the target value', () => {
  render(<Probe value={248} />)
  act(() => { vi.advanceTimersByTime(2000) })
  expect(screen.getByText('248')).toBeInTheDocument()
})

it('shows the target immediately when motion is disabled', () => {
  document.documentElement.dataset.reduceEffects = 'true'
  render(<Probe value={99} />)
  expect(screen.getByText('99')).toBeInTheDocument()
  document.documentElement.dataset.reduceEffects = 'false'
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

```bash
cd frontend && npx vitest run src/hooks/useCountUp.test.tsx
```

Expected: FAIL — `Failed to resolve import "./useCountUp"`.

- [ ] **Step 3: Viết implementation**

```ts
import { useEffect, useRef, useState } from 'react'
import { duration, motionDisabled } from '../lib/motion'
import type { DurationToken } from '../lib/motion'

/** Đếm từ giá trị trước lên giá trị mới. Luôn dừng đúng ở giá trị mới. */
export function useCountUp(value: number, token: DurationToken = 'celebrate'): number {
  const [shown, setShown] = useState(() => (motionDisabled() ? value : 0))
  const from = useRef(shown)

  useEffect(() => {
    if (motionDisabled()) { from.current = value; setShown(value); return }
    const start = performance.now()
    const total = duration(token)
    const origin = from.current
    let handle = 0
    const tick = (now: number) => {
      const ratio = Math.min(1, (now - start) / total)
      const eased = 1 - (1 - ratio) ** 3
      setShown(Math.round(origin + (value - origin) * eased))
      if (ratio < 1) handle = requestAnimationFrame(tick)
      else { from.current = value; setShown(value) }
    }
    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [token, value])

  return shown
}
```

- [ ] **Step 4: Chạy test để xác nhận pass**

```bash
cd frontend && npx vitest run src/hooks/useCountUp.test.tsx
```

Expected: PASS, 2 test.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useCountUp.ts frontend/src/hooks/useCountUp.test.tsx
git commit -m "feat(motion): hook đếm số dừng đúng giá trị cuối"
```

**Điểm dừng đợt 2.** Học thử một buổi đầy đủ trước khi sang đợt 3.

---

# ĐỢT 3 — DASHBOARD

## Task 13: Sửa lỗi gom ngày theo múi giờ

**Files:**
- Modify: `backend/app/services/progression.py`
- Modify: `backend/app/routers/review.py:38-43`
- Test: `backend/tests/test_progress_timezone.py`

**Interfaces:**
- Consumes: `UserPreference.timezone` (mặc định `Asia/Ho_Chi_Minh`)
- Produces:
  - `user_timezone(db: Session, user_id: str) -> ZoneInfo`
  - `local_day_bounds(day: date, tz: ZoneInfo) -> tuple[datetime, datetime]` — mốc UTC đầu và cuối của một ngày địa phương
  - `local_date(moment: datetime, tz: ZoneInfo) -> date`
  - `today_local(tz: ZoneInfo) -> date`

Task 14, 15, 16 đều dùng.

- [ ] **Step 1: Viết test thất bại**

Tạo `backend/tests/test_progress_timezone.py`:

```python
from datetime import datetime, timedelta, timezone

from app.models.learning_event import LearningEvent
from app.models.user import User


def _seed(db, minutes_ago_utc: datetime, key: str) -> None:
    user = db.query(User).filter(User.email == "usera@test.com").one()
    db.add(LearningEvent(
        user_id=user.id, event_type="duration", skill="vocabulary",
        source_type="full", source_id="s1", idempotency_key=key,
        duration_seconds=600, payload={}, occurred_at=minutes_ago_utc,
    ))
    db.commit()


def test_an_early_morning_session_counts_for_the_local_day(client, db):
    """23:30 UTC is 06:30 the next morning in Asia/Ho_Chi_Minh (UTC+7)."""
    now = datetime.now(timezone.utc)
    local_today = (now + timedelta(hours=7)).date()
    moment = datetime.combine(local_today, datetime.min.time(), tzinfo=timezone.utc) - timedelta(minutes=30)
    _seed(db, moment, "tz-early-0001")

    body = client.get("/api/progress/overview").json()
    assert body["heatmap"][local_today.isoformat()] == 600
    assert body["study_minutes_today"] == 10
    assert body["streak"] == 1


def test_the_calendar_window_is_anchored_to_the_local_date(client):
    body = client.get("/api/progress/overview").json()
    days = sorted(body["heatmap"])
    assert len(days) == 28
    assert days[-1] == body["effective_date"]
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

```bash
cd backend && C:/Users/Admin/anaconda3/envs/flashcard/python.exe -m pytest tests/test_progress_timezone.py -v
```

Expected: FAIL — sự kiện lúc 23:30 UTC bị gom vào ngày hôm trước, `study_minutes_today` bằng 0.

- [ ] **Step 3: Thêm hàm dùng chung vào `progression.py`**

Thêm import ở đầu file:

```python
from zoneinfo import ZoneInfo

from app.models.user_preference import UserPreference
```

Thêm bốn hàm ngay sau `def utcnow()`:

```python
DEFAULT_TZ = "Asia/Ho_Chi_Minh"


def user_timezone(db: Session, user_id: str) -> ZoneInfo:
    """Mọi mốc ngày phải theo múi giờ người dùng. Gom theo UTC khiến buổi học
    lúc 0h–7h sáng giờ Việt Nam rơi nhầm vào ngày hôm trước, kéo theo sai cả
    streak, heatmap và active days."""
    name = db.query(UserPreference.timezone).filter(UserPreference.user_id == user_id).scalar()
    try:
        return ZoneInfo(name or DEFAULT_TZ)
    except Exception:
        return ZoneInfo(DEFAULT_TZ)


def today_local(tz: ZoneInfo) -> date:
    return datetime.now(tz).date()


def local_date(moment: datetime, tz: ZoneInfo) -> date:
    aware = moment if moment.tzinfo else moment.replace(tzinfo=timezone.utc)
    return aware.astimezone(tz).date()


def local_day_bounds(day: date, tz: ZoneInfo) -> tuple[datetime, datetime]:
    """Trả mốc UTC [đầu, cuối) của một ngày địa phương, dùng trực tiếp trong
    điều kiện WHERE trên cột occurred_at lưu theo UTC."""
    start = datetime.combine(day, datetime.min.time(), tzinfo=tz)
    return start.astimezone(timezone.utc), (start + timedelta(days=1)).astimezone(timezone.utc)
```

- [ ] **Step 4: Sửa `overview_data` dùng các hàm trên**

Trong `overview_data`, thay:

```python
    now = utcnow()
    today = now.date()
```

bằng:

```python
    tz = user_timezone(db, user_id)
    now = utcnow()
    today = today_local(tz)
```

Rồi thay từng mốc thời gian:

- `since = datetime.combine(window_start, datetime.min.time(), tzinfo=timezone.utc)` → `since, _ = local_day_bounds(window_start, tz)`
- `day_start = datetime.combine(today, datetime.min.time(), tzinfo=timezone.utc)` → `day_start, day_end = local_day_bounds(today, tz)`
- `week_start = (now - timedelta(days=now.weekday())).replace(hour=0, …)` → `week_start, _ = local_day_bounds(today - timedelta(days=today.weekday()), tz)`
- Mọi filter `>= day_start` thành `>= day_start, < day_end`.
- Hai truy vấn gom ngày dùng `func.date(...)` (heatmap và `event_days`/`review_days`) **không** gom được ở SQL nữa vì SQLite không biết múi giờ. Đổi sang lấy về rồi gom bằng Python:

```python
    heatmap = {str(window_start + timedelta(days=offset)): 0 for offset in range(28)}
    for (moment, seconds) in db.query(LearningEvent.occurred_at, LearningEvent.duration_seconds).filter(
        LearningEvent.user_id == user_id, LearningEvent.occurred_at >= since
    ).all():
        key = local_date(moment, tz).isoformat()
        if key in heatmap:
            heatmap[key] += int(seconds or 0)

    event_days = {local_date(moment, tz).isoformat() for (moment,) in db.query(LearningEvent.occurred_at).filter(
        LearningEvent.user_id == user_id, LearningEvent.occurred_at >= since).all()}
    review_days = {local_date(moment, tz).isoformat() for (moment,) in db.query(ReviewLog.reviewed_at).filter(
        ReviewLog.user_id == user_id, ReviewLog.reviewed_at >= since).all()}
```

- `"effective_date": now.date().isoformat()` → `"effective_date": today.isoformat()`

Cửa sổ 28 ngày giữ nguyên. Test hiện có khẳng định `len(body["heatmap"]) == 28`.

- [ ] **Step 5: Sửa `/api/review/heatmap`**

Trong `backend/app/routers/review.py`, thay thân hàm `get_heatmap`:

```python
@router.get("/heatmap", response_model=list[HeatmapDay])
def get_heatmap(days: int = Query(default=365, ge=7, le=730), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    tz = progression.user_timezone(db, user.id)
    start = progression.today_local(tz) - timedelta(days=days - 1)
    since, _ = progression.local_day_bounds(start, tz)
    counts: dict[str, int] = {}
    for (moment,) in db.query(ReviewLog.reviewed_at).filter(ReviewLog.user_id == user.id, ReviewLog.reviewed_at >= since).all():
        key = progression.local_date(moment, tz).isoformat()
        counts[key] = counts.get(key, 0) + 1
    return [HeatmapDay(date=day, count=count) for day, count in sorted(counts.items())]
```

Thêm `from app.services import progression` vào import của file nếu chưa có.

- [ ] **Step 6: Chạy test**

```bash
cd backend && C:/Users/Admin/anaconda3/envs/flashcard/python.exe -m pytest tests/test_progress_timezone.py tests/test_learning_os.py tests/test_review.py tests/test_daily_home.py -v
```

Expected: PASS toàn bộ. `test_learning_os.py` phải vẫn xanh — nếu `len(body["heatmap"]) == 28` gãy thì cửa sổ đã bị đổi ngoài ý muốn.

- [ ] **Step 7: Chạy toàn bộ test backend**

```bash
cd backend && C:/Users/Admin/anaconda3/envs/flashcard/python.exe -m pytest -q
```

Expected: PASS toàn bộ.

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/progression.py backend/app/routers/review.py backend/tests/test_progress_timezone.py
git commit -m "fix(progress): gom ngày theo múi giờ người dùng thay vì UTC"
```

---

## Task 14: Thêm `total_xp` và `level` vào overview

**Files:**
- Modify: `backend/app/schemas/progress.py:47-70`
- Modify: `backend/app/services/progression.py` (cuối `overview_data`)
- Modify: `frontend/src/types/index.ts:197`
- Test: `backend/tests/test_progress_timezone.py` (thêm test)

**Interfaces:**
- Consumes: `level_for_xp(xp: int) -> int` đã có trong `progression.py`
- Produces: `ProgressOverview.total_xp: int` và `ProgressOverview.level: int`. Task 18 dùng.

- [ ] **Step 1: Viết test thất bại**

Thêm vào cuối `backend/tests/test_progress_timezone.py`:

```python
def test_overview_reports_a_combined_level(client):
    for index in range(3):
        client.post("/api/events/batch", json={"events": [{
            "event_type": "answer_correct", "skill": "vocabulary",
            "idempotency_key": f"combined-xp-{index:04d}", "source_type": "quick",
        }]})
    body = client.get("/api/progress/overview").json()
    assert body["total_xp"] == sum(skill["xp"] for skill in body["skills"])
    assert body["total_xp"] > 0
    assert body["level"] >= 1
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

```bash
cd backend && C:/Users/Admin/anaconda3/envs/flashcard/python.exe -m pytest tests/test_progress_timezone.py::test_overview_reports_a_combined_level -v
```

Expected: FAIL — `KeyError: 'total_xp'`.

- [ ] **Step 3: Thêm trường vào schema**

Trong `backend/app/schemas/progress.py`, thêm hai dòng vào `class ProgressOverview`, ngay sau `streak: int`:

```python
    total_xp: int
    level: int
```

- [ ] **Step 4: Trả giá trị từ `overview_data`**

Trong `progression.py`, ngay trước `return {...}`:

```python
    total_xp = sum(item["xp"] for item in skills)
```

Thêm vào dict trả về, cạnh `"streak": streak`:

```python
            "total_xp": total_xp, "level": level_for_xp(total_xp),
```

- [ ] **Step 5: Cập nhật kiểu frontend**

Trong `frontend/src/types/index.ts` dòng 197, thêm `total_xp: number; level: number;` vào đầu `interface ProgressOverview`, ngay sau `streak: number;`.

- [ ] **Step 6: Chạy test**

```bash
cd backend && C:/Users/Admin/anaconda3/envs/flashcard/python.exe -m pytest tests/test_progress_timezone.py -v
cd ../frontend && npm run build
```

Expected: pytest PASS; build TypeScript sạch.

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/progress.py backend/app/services/progression.py backend/tests/test_progress_timezone.py frontend/src/types/index.ts
git commit -m "feat(progress): overview trả tổng XP và level chung"
```

---

## Task 15: Endpoint `GET /api/progress/calendar`

**Files:**
- Modify: `backend/app/schemas/progress.py`
- Modify: `backend/app/services/progression.py`
- Modify: `backend/app/routers/progress.py`
- Test: `backend/tests/test_progress_calendar.py`

**Interfaces:**
- Consumes: `user_timezone`, `local_date`, `local_day_bounds`, `today_local` từ Task 13
- Produces:

```python
class CalendarDay(BaseModel):
    date: str
    seconds: int
    reviews: int
    active: bool
```

và `GET /api/progress/calendar?days=84` → `list[CalendarDay]`. Task 19 và 21 dùng.

- [ ] **Step 1: Viết test thất bại**

Tạo `backend/tests/test_progress_calendar.py`:

```python
from datetime import datetime, timedelta, timezone

from app.models.learning_event import LearningEvent
from app.models.user import User


def _event_now(db, key: str, seconds: int = 300) -> None:
    user = db.query(User).filter(User.email == "usera@test.com").one()
    db.add(LearningEvent(
        user_id=user.id, event_type="reading_complete", skill="reading",
        source_type="article", source_id="a1", idempotency_key=key,
        duration_seconds=seconds, payload={}, occurred_at=datetime.now(timezone.utc),
    ))
    db.commit()


def test_calendar_returns_one_entry_per_day_even_when_empty(client):
    body = client.get("/api/progress/calendar?days=84").json()
    assert len(body) == 84
    assert all(entry["active"] is False for entry in body)
    assert body[0]["date"] < body[-1]["date"]


def test_a_reading_only_day_counts_as_active(client, db):
    """/api/review/heatmap misses this case: it only counts ReviewLog rows,
    while the streak counts learning events too."""
    _event_now(db, "calendar-reading-0001")
    body = client.get("/api/progress/calendar?days=84").json()
    today = body[-1]
    assert today["seconds"] == 300
    assert today["reviews"] == 0
    assert today["active"] is True


def test_calendar_rejects_an_out_of_range_window(client):
    assert client.get("/api/progress/calendar?days=1000").status_code == 422


def test_calendar_is_user_scoped(client, user_b_client, db):
    _event_now(db, "calendar-scope-0001")
    body = user_b_client.get("/api/progress/calendar?days=84").json()
    assert all(entry["active"] is False for entry in body)
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

```bash
cd backend && C:/Users/Admin/anaconda3/envs/flashcard/python.exe -m pytest tests/test_progress_calendar.py -v
```

Expected: FAIL — 404 vì endpoint chưa tồn tại.

- [ ] **Step 3: Thêm schema**

Trong `backend/app/schemas/progress.py`, thêm sau `class SkillOverview`:

```python
class CalendarDay(BaseModel):
    date: str
    seconds: int
    reviews: int
    active: bool
```

- [ ] **Step 4: Thêm hàm service**

Trong `backend/app/services/progression.py`, thêm sau `overview_data`:

```python
def calendar_data(db: Session, user_id: str, days: int) -> list[dict]:
    """`active` phải dùng đúng định nghĩa mà streak dùng (learning_events hợp
    ReviewLog). Lệch định nghĩa thì dashboard sẽ tự mâu thuẫn với chính nó."""
    tz = user_timezone(db, user_id)
    today = today_local(tz)
    window_start = today - timedelta(days=days - 1)
    since, _ = local_day_bounds(window_start, tz)

    buckets = {(window_start + timedelta(days=offset)).isoformat(): {"seconds": 0, "reviews": 0} for offset in range(days)}

    for moment, seconds in db.query(LearningEvent.occurred_at, LearningEvent.duration_seconds).filter(
        LearningEvent.user_id == user_id, LearningEvent.occurred_at >= since
    ).all():
        bucket = buckets.get(local_date(moment, tz).isoformat())
        if bucket is not None:
            bucket["seconds"] += int(seconds or 0)

    for (moment,) in db.query(ReviewLog.reviewed_at).filter(
        ReviewLog.user_id == user_id, ReviewLog.reviewed_at >= since
    ).all():
        bucket = buckets.get(local_date(moment, tz).isoformat())
        if bucket is not None:
            bucket["reviews"] += 1

    return [
        {"date": day, "seconds": value["seconds"], "reviews": value["reviews"],
         "active": value["seconds"] > 0 or value["reviews"] > 0}
        for day, value in sorted(buckets.items())
    ]
```

Một ngày chỉ có `LearningEvent` mà không có `ReviewLog` vẫn phải `active = True` — đây chính là trường hợp `/api/review/heatmap` bỏ sót.

- [ ] **Step 5: Thêm route**

Trong `backend/app/routers/progress.py`, thêm import `Query` từ `fastapi` và `CalendarDay` từ schema, rồi thêm:

```python
@router.get("/progress/calendar", response_model=list[CalendarDay])
def calendar(days: int = Query(default=84, ge=7, le=365), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return progression.calendar_data(db, user.id, days)
```

- [ ] **Step 6: Chạy test để xác nhận pass**

```bash
cd backend && C:/Users/Admin/anaconda3/envs/flashcard/python.exe -m pytest tests/test_progress_calendar.py -v
```

Expected: PASS, 4 test.

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas/progress.py backend/app/services/progression.py backend/app/routers/progress.py backend/tests/test_progress_calendar.py
git commit -m "feat(progress): endpoint calendar dùng chung định nghĩa active với streak"
```

---

## Task 16: Endpoint `GET /api/progress/day/{date}`

**Files:**
- Modify: `backend/app/schemas/progress.py`
- Modify: `backend/app/services/progression.py`
- Modify: `backend/app/routers/progress.py`
- Test: `backend/tests/test_progress_calendar.py` (thêm test)

**Interfaces:**
- Consumes: `user_timezone`, `local_day_bounds`, `today_local` từ Task 13; `Article` từ `app.models.article`
- Produces:

```python
class DaySkillBreakdown(BaseModel):
    skill: str
    seconds: int
    events: int

class DayArticle(BaseModel):
    id: str
    title: str

class DayDetail(BaseModel):
    date: str
    seconds: int
    reviews: int
    new_words: int
    skills: list[DaySkillBreakdown]
    articles: list[DayArticle]
```

và `GET /api/progress/day/{date}` → `DayDetail`. Task 21 dùng.

- [ ] **Step 1: Viết test thất bại**

Thêm vào `backend/tests/test_progress_calendar.py`:

```python
def test_day_detail_lists_articles_and_skill_breakdown(client, db):
    article = client.post("/api/articles", json={"title": "Ozone layer", "content": "word " * 120, "source_type": "paste"}).json()
    user = db.query(User).filter(User.email == "usera@test.com").one()
    db.add(LearningEvent(
        user_id=user.id, event_type="reading_complete", skill="reading",
        source_type="article", source_id=article["id"], idempotency_key="day-detail-0001",
        duration_seconds=420, payload={}, occurred_at=datetime.now(timezone.utc),
    ))
    db.commit()

    today = client.get("/api/progress/overview").json()["effective_date"]
    body = client.get(f"/api/progress/day/{today}").json()
    assert body["date"] == today
    assert body["seconds"] == 420
    assert {"skill": "reading", "seconds": 420, "events": 1} in body["skills"]
    assert body["articles"] == [{"id": article["id"], "title": "Ozone layer"}]


def test_a_quiet_day_is_a_valid_answer_not_an_error(client):
    today = client.get("/api/progress/overview").json()["effective_date"]
    quiet = (datetime.fromisoformat(today) - timedelta(days=5)).date().isoformat()
    response = client.get(f"/api/progress/day/{quiet}")
    assert response.status_code == 200
    assert response.json()["seconds"] == 0 and response.json()["articles"] == []


def test_day_detail_rejects_a_future_date(client):
    today = client.get("/api/progress/overview").json()["effective_date"]
    future = (datetime.fromisoformat(today) + timedelta(days=1)).date().isoformat()
    assert client.get(f"/api/progress/day/{future}").status_code == 400
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

```bash
cd backend && C:/Users/Admin/anaconda3/envs/flashcard/python.exe -m pytest tests/test_progress_calendar.py -k day -v
```

Expected: FAIL — 404.

Nếu `POST /api/articles` trả 422, mở `backend/app/routers/articles.py` xem đúng tên trường rồi sửa payload trong test cho khớp. Không đổi endpoint.

- [ ] **Step 3: Thêm schema**

Thêm ba class ở Interfaces phía trên vào `backend/app/schemas/progress.py`.

- [ ] **Step 4: Thêm hàm service**

Trong `progression.py`:

```python
def day_detail_data(db: Session, user_id: str, day: date) -> dict:
    tz = user_timezone(db, user_id)
    start, end = local_day_bounds(day, tz)
    events = db.query(LearningEvent).filter(
        LearningEvent.user_id == user_id,
        LearningEvent.occurred_at >= start, LearningEvent.occurred_at < end,
    ).all()

    by_skill: dict[str, dict] = {}
    for event in events:
        bucket = by_skill.setdefault(event.skill, {"skill": event.skill, "seconds": 0, "events": 0})
        bucket["seconds"] += int(event.duration_seconds or 0)
        bucket["events"] += 1

    article_ids = {event.source_id for event in events if event.source_type == "article" and event.source_id}
    articles = []
    if article_ids:
        rows = db.query(Article.id, Article.title).filter(Article.id.in_(article_ids), Article.user_id == user_id).all()
        # Bài đã bị xoá thì bỏ qua thay vì hiện một dòng trống.
        articles = [{"id": row_id, "title": title} for row_id, title in rows]

    reviews = db.query(func.count(ReviewLog.id)).filter(
        ReviewLog.user_id == user_id, ReviewLog.reviewed_at >= start, ReviewLog.reviewed_at < end,
    ).scalar() or 0
    new_words = db.query(func.count(Card.id)).join(Deck).filter(
        Deck.user_id == user_id, Card.created_at >= start, Card.created_at < end,
    ).scalar() or 0

    return {
        "date": day.isoformat(),
        "seconds": sum(bucket["seconds"] for bucket in by_skill.values()),
        "reviews": int(reviews), "new_words": int(new_words),
        "skills": sorted(by_skill.values(), key=lambda item: item["skill"]),
        "articles": articles,
    }
```

Thêm `from app.models.article import Article` vào import của file.

Nếu `Card` không có cột `created_at`, bỏ phép tính `new_words` và trả `0`, rồi ghi một chú thích một dòng ngay tại đó nêu lý do. Kiểm tra bằng:

```bash
cd backend && grep -n "created_at" app/models/card.py
```

- [ ] **Step 5: Thêm route**

Trong `backend/app/routers/progress.py`:

```python
@router.get("/progress/day/{day}", response_model=DayDetail)
def day_detail(day: date, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    tz = progression.user_timezone(db, user.id)
    if day > progression.today_local(tz):
        raise HTTPException(status_code=400, detail="Ngày ở tương lai chưa có dữ liệu")
    return progression.day_detail_data(db, user.id, day)
```

Thêm import `from datetime import date` và `from fastapi import HTTPException`.

Ngày không có dữ liệu trả 200 với các số bằng 0, **không** trả 404 — ngày nghỉ là một câu trả lời hợp lệ.

- [ ] **Step 6: Chạy test**

```bash
cd backend && C:/Users/Admin/anaconda3/envs/flashcard/python.exe -m pytest tests/test_progress_calendar.py -v
```

Expected: PASS, 7 test.

- [ ] **Step 7: Chạy toàn bộ test backend**

```bash
cd backend && C:/Users/Admin/anaconda3/envs/flashcard/python.exe -m pytest -q
```

Expected: PASS toàn bộ.

- [ ] **Step 8: Commit**

```bash
git add backend/app backend/tests/test_progress_calendar.py
git commit -m "feat(progress): endpoint chi tiết một ngày học"
```

---

## Task 17: Lớp API và kiểu frontend

**Files:**
- Modify: `frontend/src/api/progress.ts`
- Modify: `frontend/src/types/index.ts`

**Interfaces:**
- Consumes: hai endpoint từ Task 15 và 16
- Produces:
  - `getCalendar(days?: number): Promise<CalendarDay[]>`
  - `getDayDetail(day: string): Promise<DayDetail>`
  - kiểu `CalendarDay`, `DayDetail`, `DaySkillBreakdown`, `DayArticle`

- [ ] **Step 1: Thêm kiểu**

Trong `frontend/src/types/index.ts`, thêm cạnh `ProgressOverview`:

```ts
export interface CalendarDay { date: string; seconds: number; reviews: number; active: boolean }
export interface DaySkillBreakdown { skill: 'vocabulary' | 'reading' | 'listening' | 'speaking'; seconds: number; events: number }
export interface DayArticle { id: string; title: string }
export interface DayDetail { date: string; seconds: number; reviews: number; new_words: number; skills: DaySkillBreakdown[]; articles: DayArticle[] }
```

- [ ] **Step 2: Thêm hàm API**

Trong `frontend/src/api/progress.ts`:

```ts
import client from './client'
import type { CalendarDay, DayDetail, ProgressOverview } from '../types'

export const getProgressOverview = () => client.get<ProgressOverview>('/progress/overview').then(result => result.data)
export const getCalendar = (days = 84) => client.get<CalendarDay[]>(`/progress/calendar?days=${days}`).then(result => result.data)
export const getDayDetail = (day: string) => client.get<DayDetail>(`/progress/day/${day}`).then(result => result.data)
```

- [ ] **Step 3: Build**

```bash
cd frontend && npm run build
```

Expected: sạch.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/api/progress.ts frontend/src/types/index.ts
git commit -m "feat(api): client cho calendar và chi tiết ngày"
```

---

## Task 18: Vùng 1 — Động lực

**Files:**
- Create: `frontend/src/components/stats/MotivationRing.tsx`
- Create: `frontend/src/components/stats/Stats.css`
- Test: `frontend/src/components/stats/MotivationRing.test.tsx`

**Interfaces:**
- Consumes: `useCountUp` (Task 12), `ProgressOverview` với `total_xp`/`level` (Task 14)
- Produces: `<MotivationRing overview={ProgressOverview} />`

- [ ] **Step 1: Viết test thất bại**

```tsx
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import MotivationRing from './MotivationRing'
import type { ProgressOverview } from '../../types'

const overview = { total_xp: 248, level: 3, streak: 6, study_minutes_today: 18, study_minutes_week: 96 } as ProgressOverview

it('shows the combined level and the streak', () => {
  document.documentElement.dataset.reduceEffects = 'true'
  render(<MotivationRing overview={overview} />)
  expect(screen.getByText('Level 3')).toBeInTheDocument()
  expect(screen.getByText('248')).toBeInTheDocument()
  expect(screen.getByText('6 ngày')).toBeInTheDocument()
  document.documentElement.dataset.reduceEffects = 'false'
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

```bash
cd frontend && npx vitest run src/components/stats/MotivationRing.test.tsx
```

Expected: FAIL — không resolve được import.

- [ ] **Step 3: Viết component**

```tsx
import { useCountUp } from '../../hooks/useCountUp'
import type { ProgressOverview } from '../../types'

const XP_PER_LEVEL = 100
const CIRCUMFERENCE = 2 * Math.PI * 52

export default function MotivationRing({ overview }: { overview: ProgressOverview }) {
  const xp = useCountUp(overview.total_xp)
  const streak = useCountUp(overview.streak)
  const today = useCountUp(overview.study_minutes_today)
  const week = useCountUp(overview.study_minutes_week)
  const intoLevel = overview.total_xp % XP_PER_LEVEL
  const offset = CIRCUMFERENCE * (1 - intoLevel / XP_PER_LEVEL)

  return (
    <section className="stats-motivation glass-panel enter">
      <div className="stats-motivation__ring">
        <svg aria-hidden="true" viewBox="0 0 120 120">
          <circle className="stats-ring__track" cx="60" cy="60" r="52" />
          <circle className="stats-ring__value" cx="60" cy="60" r="52"
            strokeDasharray={CIRCUMFERENCE} strokeDashoffset={offset} />
        </svg>
        <p><strong>{xp}</strong><span>XP</span></p>
      </div>
      <dl className="stats-motivation__facts">
        <div><dt>Level</dt><dd>Level {overview.level}</dd></div>
        <div><dt>Chuỗi ngày</dt><dd>{streak} ngày</dd></div>
        <div><dt>Hôm nay</dt><dd>{today} phút</dd></div>
        <div><dt>Tuần này</dt><dd>{week} phút</dd></div>
      </dl>
    </section>
  )
}
```

- [ ] **Step 4: Thêm style vào `Stats.css`**

```css
.stats-motivation { display: grid; grid-template-columns: auto 1fr; gap: 1.5rem; align-items: center; }
.stats-motivation__ring { position: relative; width: 7.5rem; }
.stats-motivation__ring svg { width: 100%; transform: rotate(-90deg); }
.stats-ring__track { fill: none; stroke: var(--track); stroke-width: 8; }
.stats-ring__value {
  fill: none; stroke: var(--accent-primary); stroke-width: 8; stroke-linecap: round;
  transition: stroke-dashoffset var(--dur-celebrate) var(--ease-out);
}
.stats-motivation__ring p { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; }
.stats-motivation__ring strong { display: block; font-size: 1.75rem; font-variant-numeric: tabular-nums; }
.stats-motivation__facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr)); gap: 1rem; }
.stats-motivation__facts dt { color: var(--text-muted); font-size: .8125rem; }
.stats-motivation__facts dd { margin: 0; font-size: 1.125rem; font-variant-numeric: tabular-nums; }
@media (max-width: 640px) { .stats-motivation { grid-template-columns: 1fr; justify-items: center; } }
```

Import `./Stats.css` ở đầu `MotivationRing.tsx`.

- [ ] **Step 5: Chạy test**

```bash
cd frontend && npx vitest run src/components/stats/MotivationRing.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/stats
git commit -m "feat(stats): vùng động lực với vòng level và số đếm tăng"
```

---

## Task 19: Vùng 2 — Nhịp học

**Files:**
- Create: `frontend/src/components/stats/RhythmPanel.tsx`
- Test: `frontend/src/components/stats/RhythmPanel.test.tsx`
- Modify: `frontend/src/components/stats/Stats.css`

**Interfaces:**
- Consumes: `CalendarDay[]` từ Task 17
- Produces: `<RhythmPanel days={CalendarDay[]} />` — nhận dãy 84 ngày, tự dùng 56 ngày cuối

- [ ] **Step 1: Viết test thất bại**

```tsx
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import RhythmPanel from './RhythmPanel'
import type { CalendarDay } from '../../types'

function build(activeWeekdays: number[]): CalendarDay[] {
  return Array.from({ length: 84 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 4, 4) + index * 86_400_000)
    const weekday = (date.getUTCDay() + 6) % 7
    const active = activeWeekdays.includes(weekday)
    return { date: date.toISOString().slice(0, 10), seconds: active ? 600 : 0, reviews: 0, active }
  })
}

it('names the weekday the learner keeps skipping', () => {
  render(<RhythmPanel days={build([0, 1, 2, 3, 4, 6])} />)
  expect(screen.getByText(/Thứ Bảy/)).toBeInTheDocument()
})

it('says nothing accusatory when every weekday is even', () => {
  render(<RhythmPanel days={build([0, 1, 2, 3, 4, 5, 6])} />)
  expect(screen.queryByText(/hay bỏ/)).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

```bash
cd frontend && npx vitest run src/components/stats/RhythmPanel.test.tsx
```

Expected: FAIL — không resolve được import.

- [ ] **Step 3: Viết component**

```tsx
import { useMemo } from 'react'
import type { CalendarDay } from '../../types'
import './Stats.css'

const LABELS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật']
const WINDOW = 56
const WEAK_RATIO = .5

function weekdayIndex(iso: string): number {
  return (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7
}

export default function RhythmPanel({ days }: { days: CalendarDay[] }) {
  const recent = useMemo(() => days.slice(-WINDOW), [days])

  const ratios = useMemo(() => LABELS.map((_, weekday) => {
    const matching = recent.filter(day => weekdayIndex(day.date) === weekday)
    if (!matching.length) return 0
    return matching.filter(day => day.active).length / matching.length
  }), [recent])

  const gap = useMemo(() => {
    const activeDays = recent.filter(day => day.active).map(day => Date.parse(`${day.date}T00:00:00Z`))
    if (activeDays.length < 2) return null
    const total = activeDays[activeDays.length - 1] - activeDays[0]
    return Math.round((total / (activeDays.length - 1)) / 86_400_000 * 10) / 10
  }, [recent])

  const weakest = ratios.indexOf(Math.min(...ratios))
  const studiedToday = recent[recent.length - 1]?.active ?? false

  return (
    <section className="stats-rhythm glass-panel enter">
      <h2>Nhịp học</h2>
      <ol className="stats-rhythm__bars">
        {ratios.map((ratio, index) => (
          <li className="hint" key={LABELS[index]}>
            <i style={{ blockSize: `${Math.max(4, Math.round(ratio * 100))}%` }} />
            <span>{LABELS[index].replace('Thứ ', 'T').replace('Chủ nhật', 'CN')}</span>
            <b data-tip>{LABELS[index]}: {Math.round(ratio * 100)}% số tuần có học</b>
          </li>
        ))}
      </ol>
      <p>{ratios[weakest] < WEAK_RATIO ? `Bạn hay bỏ ${LABELS[weakest]}.` : 'Bạn học đều cả bảy ngày.'}</p>
      <p>{gap === null ? 'Chưa đủ dữ liệu để đo khoảng cách giữa các buổi.' : `Trung bình ${gap} ngày giữa hai buổi.`}</p>
      <p>{studiedToday ? 'Hôm nay đã học — chuỗi được giữ.' : 'Hôm nay chưa học. Chuỗi sẽ đứt vào nửa đêm.'}</p>
    </section>
  )
}
```

- [ ] **Step 4: Thêm style vào `Stats.css`**

```css
.stats-rhythm__bars { display: grid; grid-template-columns: repeat(7, 1fr); gap: .5rem; block-size: 7rem; align-items: end; padding: 0; margin: 1rem 0; list-style: none; }
.stats-rhythm__bars li { display: grid; align-content: end; justify-items: center; gap: .375rem; block-size: 100%; }
.stats-rhythm__bars i { inline-size: 100%; border-radius: .375rem .375rem 0 0; background: var(--accent-primary); }
.stats-rhythm__bars span { color: var(--text-muted); font-size: .75rem; }
.stats-rhythm__bars b { inset-block-end: calc(100% + .25rem); padding: .25rem .5rem; border-radius: .375rem; background: var(--glass-fill-strong); font-size: .75rem; font-weight: 400; white-space: nowrap; }
```

- [ ] **Step 5: Chạy test**

```bash
cd frontend && npx vitest run src/components/stats/RhythmPanel.test.tsx
```

Expected: PASS, 2 test.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/stats
git commit -m "feat(stats): vùng nhịp học theo thứ trong tuần"
```

---

## Task 20: Vùng 3 — Từ hay quên

**Files:**
- Create: `frontend/src/components/stats/WeakWordsPanel.tsx`
- Test: `frontend/src/components/stats/WeakWordsPanel.test.tsx`
- Modify: `frontend/src/components/stats/Stats.css`

**Interfaces:**
- Consumes: `getWeakWords` trong `frontend/src/api/weak.ts` (đã có), kiểu `WeakWord` trong types
- Produces: `<WeakWordsPanel words={WeakWord[]} />`

- [ ] **Step 1: Viết test thất bại**

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { expect, it } from 'vitest'
import WeakWordsPanel from './WeakWordsPanel'
import type { WeakWord } from '../../types'

function word(front: string, wrong: number, total: number): WeakWord {
  return { card: { id: front, front_text: front, back_text: 'x' }, recent_wrong: wrong, total_reviews: total, last_step: 'flip', suggested_step: 'dictation' } as unknown as WeakWord
}

it('offers one action for the whole group', () => {
  render(<MemoryRouter><WeakWordsPanel words={[word('abundant', 3, 5)]} /></MemoryRouter>)
  expect(screen.getByRole('link', { name: /Học ngay/ })).toHaveAttribute('href', '/weak')
})

it('invites the learner instead of apologising when nothing is weak', () => {
  render(<MemoryRouter><WeakWordsPanel words={[]} /></MemoryRouter>)
  expect(screen.getByText(/chưa có từ nào/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

```bash
cd frontend && npx vitest run src/components/stats/WeakWordsPanel.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Viết component**

```tsx
import { Link } from 'react-router-dom'
import type { WeakWord } from '../../types'
import './Stats.css'

const LIMIT = 8

export default function WeakWordsPanel({ words }: { words: WeakWord[] }) {
  const top = words.slice(0, LIMIT)
  if (!top.length) return (
    <section className="stats-weak glass-panel enter">
      <h2>Từ hay quên</h2>
      <p>Bạn chưa có từ nào hay quên. Học thêm vài buổi rồi quay lại đây.</p>
    </section>
  )
  return (
    <section className="stats-weak glass-panel enter">
      <div className="section-heading"><h2>Từ hay quên</h2><span>{top.length} từ</span></div>
      <ol className="stats-weak__list stagger">
        {top.map(item => {
          const ratio = item.total_reviews ? item.recent_wrong / item.total_reviews : 0
          return (
            <li key={item.card.id}>
              <strong>{item.card.front_text}</strong>
              <i><b style={{ inlineSize: `${Math.round(ratio * 100)}%` }} /></i>
              <span>{item.recent_wrong}/{item.total_reviews} sai</span>
            </li>
          )
        })}
      </ol>
      <Link className="button-primary tap" to="/weak">Học ngay {top.length} từ này</Link>
    </section>
  )
}
```

- [ ] **Step 4: Thêm style vào `Stats.css`**

```css
.stats-weak__list { display: grid; gap: .625rem; padding: 0; margin: 1rem 0; list-style: none; }
.stats-weak__list li { display: grid; grid-template-columns: minmax(6rem, 1fr) 2fr auto; gap: .75rem; align-items: center; }
.stats-weak__list i { display: block; block-size: .375rem; border-radius: 999px; background: var(--track); }
.stats-weak__list b { display: block; block-size: 100%; border-radius: 999px; background: var(--error); transition: inline-size var(--dur-slow) var(--ease-out); }
.stats-weak__list span { color: var(--text-muted); font-size: .8125rem; font-variant-numeric: tabular-nums; }
```

- [ ] **Step 5: Chạy test**

```bash
cd frontend && npx vitest run src/components/stats/WeakWordsPanel.test.tsx
```

Expected: PASS, 2 test.

Nếu kiểu `WeakWord` không có `card.front_text`, mở `frontend/src/types/index.ts` xem tên trường thật rồi sửa cả component lẫn test cho khớp.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/stats
git commit -m "feat(stats): vùng từ hay quên có hành động học ngay"
```

---

## Task 21: Vùng 4 — Lịch và chi tiết ngày

**Files:**
- Create: `frontend/src/components/stats/DayHeatmap.tsx`
- Create: `frontend/src/components/stats/DayDetailPanel.tsx`
- Test: `frontend/src/components/stats/DayHeatmap.test.tsx`
- Modify: `frontend/src/components/stats/Stats.css`

**Interfaces:**
- Consumes: `CalendarDay[]`, `getDayDetail` (Task 17), `LoadingRegion` (Task 5)
- Produces:
  - `<DayHeatmap days={CalendarDay[]} selected={string} onSelect={(date: string) => void} />`
  - `<DayDetailPanel date={string} />`

- [ ] **Step 1: Viết test thất bại**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import DayHeatmap from './DayHeatmap'
import type { CalendarDay } from '../../types'

const days: CalendarDay[] = Array.from({ length: 84 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 4, 4) + index * 86_400_000).toISOString().slice(0, 10)
  return { date, seconds: index % 3 === 0 ? 900 : 0, reviews: 0, active: index % 3 === 0 }
})

it('exposes every day as a button a keyboard can reach', () => {
  render(<DayHeatmap days={days} onSelect={() => undefined} selected={days[10].date} />)
  expect(screen.getAllByRole('button')).toHaveLength(84)
  expect(screen.getByRole('button', { name: new RegExp(days[10].date) })).toHaveAttribute('tabindex', '0')
  expect(screen.getByRole('button', { name: new RegExp(days[11].date) })).toHaveAttribute('tabindex', '-1')
})

it('moves the selection with the arrow keys', async () => {
  const onSelect = vi.fn()
  render(<DayHeatmap days={days} onSelect={onSelect} selected={days[10].date} />)
  screen.getByRole('button', { name: new RegExp(days[10].date) }).focus()
  await userEvent.keyboard('{ArrowRight}')
  expect(onSelect).toHaveBeenCalledWith(days[11].date)
})

it('names the minutes in the accessible label', () => {
  render(<DayHeatmap days={days} onSelect={() => undefined} selected={days[0].date} />)
  expect(screen.getByRole('button', { name: new RegExp(`${days[0].date}.*15 phút`) })).toBeInTheDocument()
})
```

- [ ] **Step 2: Chạy test để xác nhận thất bại**

```bash
cd frontend && npx vitest run src/components/stats/DayHeatmap.test.tsx
```

Expected: FAIL.

- [ ] **Step 3: Viết `DayHeatmap.tsx`**

```tsx
import type { CSSProperties, KeyboardEvent } from 'react'
import type { CalendarDay } from '../../types'
import './Stats.css'

const STEP: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 }
const FULL_INTENSITY_SECONDS = 900

export default function DayHeatmap({ days, selected, onSelect }: { days: CalendarDay[]; selected: string; onSelect: (date: string) => void }) {
  const index = days.findIndex(day => day.date === selected)

  const move = (event: KeyboardEvent<HTMLOListElement>) => {
    const step = STEP[event.key]
    if (!step) return
    event.preventDefault()
    const next = days[Math.max(0, Math.min(days.length - 1, index + step))]
    if (next) onSelect(next.date)
  }

  return (
    <ol className="stats-heatmap" onKeyDown={move}>
      {days.map(day => {
        const minutes = Math.round(day.seconds / 60)
        const opacity = day.seconds ? Math.max(.25, Math.min(1, day.seconds / FULL_INTENSITY_SECONDS)) : 0
        return (
          <li key={day.date}>
            <button
              aria-label={`${day.date} — ${minutes} phút`}
              aria-pressed={day.date === selected}
              className={day.date === selected ? 'is-selected' : undefined}
              onClick={() => onSelect(day.date)}
              style={opacity ? { '--cell-intensity': String(opacity) } as CSSProperties : undefined}
              tabIndex={day.date === selected ? 0 : -1}
              type="button"
            />
          </li>
        )
      })}
    </ol>
  )
}
```

- [ ] **Step 4: Viết `DayDetailPanel.tsx`**

```tsx
import { getDayDetail } from '../../api/progress'
import { useCachedQuery } from '../../hooks/useCachedQuery'
import { LoadingRegion } from '../shell/Skeleton'
import './Stats.css'

const SKILL_LABELS: Record<string, string> = { vocabulary: 'Từ vựng', reading: 'Đọc', listening: 'Nghe', speaking: 'Nói' }

export default function DayDetailPanel({ date }: { date: string }) {
  const query = useCachedQuery(`progress-day:${date}`, () => getDayDetail(date))
  if (!query.data) return <div className="stats-day glass-panel"><LoadingRegion label={`Đang tải chi tiết ngày ${date}`} lines={4} /></div>
  const detail = query.data
  return (
    <div className="stats-day glass-panel">
      <div className="section-heading"><h2>{detail.date}</h2><span>{Math.round(detail.seconds / 60)} phút</span></div>
      <dl className="stats-day__facts">
        <div><dt>Lượt ôn</dt><dd>{detail.reviews}</dd></div>
        <div><dt>Từ mới</dt><dd>{detail.new_words}</dd></div>
      </dl>
      {detail.skills.length ? (
        <ul className="stats-day__skills">
          {detail.skills.map(skill => <li key={skill.skill}>{SKILL_LABELS[skill.skill] ?? skill.skill}<span>{Math.round(skill.seconds / 60)} phút</span></li>)}
        </ul>
      ) : <p>Ngày này bạn nghỉ.</p>}
      {detail.articles.length ? (
        <ul className="stats-day__articles">{detail.articles.map(article => <li key={article.id}>{article.title}</li>)}</ul>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 5: Thêm style vào `Stats.css`**

```css
.stats-heatmap { display: grid; grid-template-columns: repeat(14, 1fr); gap: .25rem; padding: 0; margin: 0; list-style: none; }
.stats-heatmap button {
  inline-size: 100%; aspect-ratio: 1; padding: 0; border: 1px solid transparent; border-radius: .25rem;
  background: color-mix(in srgb, var(--accent-primary) calc(var(--cell-intensity, 0) * 100%), var(--track));
  cursor: pointer; transition: transform var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
}
@media (hover: hover) { .stats-heatmap button:hover { transform: scale(1.15); } }
.stats-heatmap button.is-selected { border-color: var(--text-primary); }
.stats-heatmap button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.stats-day__facts { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin: 1rem 0; }
.stats-day__facts dt { color: var(--text-muted); font-size: .8125rem; }
.stats-day__facts dd { margin: 0; font-size: 1.25rem; font-variant-numeric: tabular-nums; }
.stats-day__skills, .stats-day__articles { padding: 0; margin: .75rem 0 0; list-style: none; display: grid; gap: .375rem; }
.stats-day__skills li { display: flex; justify-content: space-between; gap: 1rem; }
.stats-day__skills span { color: var(--text-muted); font-variant-numeric: tabular-nums; }
```

Ô đang chọn phải có **viền rõ**, không chỉ khác màu nền — nền đã dùng để mã hoá cường độ học rồi.

- [ ] **Step 6: Chạy test**

```bash
cd frontend && npx vitest run src/components/stats/DayHeatmap.test.tsx
```

Expected: PASS, 3 test.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/stats
git commit -m "feat(stats): lịch 84 ngày bấm được và panel chi tiết ngày"
```

---

## Task 22: Ráp lại `StatsPage`

**Files:**
- Rewrite: `frontend/src/pages/StatsPage.tsx`
- Create: `frontend/src/components/stats/LibraryStrip.tsx`
- Modify: `frontend/src/components/stats/Stats.css`

**Interfaces:**
- Consumes: mọi thành phần từ Task 18–21, `getProgressOverview`, `getCalendar`, `getWeakWords`, `LoadingRegion`
- Produces: `export function LearningStats()` và `export default function StatsPage()` — hai export hiện có phải giữ nguyên tên, có nơi khác đang import

- [ ] **Step 1: Kiểm tra ai đang import**

```bash
cd frontend && grep -rn "LearningStats\|from '../pages/StatsPage'\|from './pages/StatsPage'" src
```

Ghi lại. Cả hai export phải còn.

- [ ] **Step 2: Viết `LibraryStrip.tsx`**

```tsx
import type { ProgressOverview } from '../../types'
import './Stats.css'

export default function LibraryStrip({ overview }: { overview: ProgressOverview }) {
  const items = [
    { label: 'Đang học', value: overview.learning_cards },
    { label: 'Đã nhớ', value: overview.remembered_cards },
    { label: 'Đến hạn', value: overview.due_cards },
    { label: 'Tổng thẻ', value: overview.total_cards },
    { label: 'Retention', value: overview.retention === null ? '—' : `${overview.retention}%` },
  ]
  return (
    <section className="stats-library">
      {items.map(item => <p key={item.label}><span>{item.label}</span><strong>{item.value}</strong></p>)}
    </section>
  )
}
```

- [ ] **Step 3: Viết lại `StatsPage.tsx`**

```tsx
import { useState } from 'react'
import { getCalendar, getProgressOverview } from '../api/progress'
import { getWeakWords } from '../api/weak'
import { useAuth } from '../auth/AuthContext'
import DayDetailPanel from '../components/stats/DayDetailPanel'
import DayHeatmap from '../components/stats/DayHeatmap'
import LibraryStrip from '../components/stats/LibraryStrip'
import MotivationRing from '../components/stats/MotivationRing'
import RhythmPanel from '../components/stats/RhythmPanel'
import WeakWordsPanel from '../components/stats/WeakWordsPanel'
import { LoadingRegion } from '../components/shell/Skeleton'
import { useCachedQuery } from '../hooks/useCachedQuery'
import '../components/stats/Stats.css'

function ProgressContent() {
  const { user } = useAuth()
  const key = user ? user.id : null
  const overview = useCachedQuery(key && `progress:${key}`, getProgressOverview)
  const calendar = useCachedQuery(key && `progress-calendar:${key}`, () => getCalendar(84))
  const weak = useCachedQuery(key && `progress-weak:${key}`, getWeakWords)
  const [selected, setSelected] = useState<string | null>(null)

  if (!overview.data || !calendar.data) {
    return <main className="progress-page"><LoadingRegion label="Đang tải tiến độ của bạn" lines={6} /></main>
  }

  const days = calendar.data
  const today = days[days.length - 1]?.date ?? new Date().toISOString().slice(0, 10)
  const active = selected ?? today

  return (
    <main className="progress-page">
      <header>
        <p className="eyebrow">Tiến độ</p>
        <h1>Việc học của bạn, nhìn thấy được.</h1>
      </header>
      <MotivationRing overview={overview.data} />
      <RhythmPanel days={days} />
      <WeakWordsPanel words={weak.data ?? []} />
      <section className="stats-calendar glass-panel enter">
        <div className="section-heading"><h2>84 ngày gần đây</h2><span>{days.filter(day => day.active).length} ngày có học</span></div>
        <div className="stats-calendar__split">
          <DayHeatmap days={days} onSelect={setSelected} selected={active} />
          <DayDetailPanel date={active} />
        </div>
      </section>
      <LibraryStrip overview={overview.data} />
    </main>
  )
}

export function LearningStats() { return <ProgressContent /> }
export default function StatsPage() { return <ProgressContent /> }
```

- [ ] **Step 4: Thêm style vào `Stats.css`**

```css
.progress-page { display: grid; gap: 1.5rem; }
.stats-calendar__split { display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; align-items: start; }
.stats-library { display: grid; grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr)); gap: 1rem; padding-block-start: 1rem; border-block-start: 1px solid var(--glass-border); }
.stats-library p { margin: 0; display: grid; gap: .25rem; }
.stats-library span { color: var(--text-muted); font-size: .8125rem; }
.stats-library strong { font-size: 1.125rem; font-variant-numeric: tabular-nums; }
@media (max-width: 900px) { .stats-calendar__split { grid-template-columns: 1fr; } }
```

- [ ] **Step 5: Chạy toàn bộ test và build**

```bash
cd frontend && npm test && npm run build
```

Expected: PASS toàn bộ, build sạch.

- [ ] **Step 6: Kiểm tra bằng tay**

Chạy backend và frontend, mở `/stats`:
- Bốn vùng theo đúng thứ tự: động lực → nhịp học → từ hay quên → lịch, rồi dải phụ ở cuối.
- Số XP và số phút đếm tăng khi vào màn.
- Bấm một ô heatmap: panel bên phải đổi nội dung.
- Nhấn `Tab` tới heatmap rồi bấm mũi tên: ô chọn di chuyển, panel đổi theo.
- Bấm "Học ngay N từ này": nhảy sang `/weak`.
- Thu về 375px: vùng lịch xếp dọc, không tràn ngang.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/StatsPage.tsx frontend/src/components/stats
git commit -m "feat(stats): dựng lại dashboard thành bốn vùng"
```

---

## Kiểm tra cuối cùng

- [ ] **Chạy toàn bộ test hai phía**

```bash
cd backend && C:/Users/Admin/anaconda3/envs/flashcard/python.exe -m pytest -q
```

```bash
cd frontend && npm test && npm run build
```

Cả hai phải xanh. Không claim hoàn thành trước khi thấy output thật.

- [ ] **Kiểm chứng ràng buộc token**

```bash
cd frontend && grep -rnoE '(transition|animation)[^;]*' src --include=*.css | grep -E '[0-9]+m?s|cubic-bezier'
```

Expected: chỉ còn dòng trong `tokens.css` và các keyframe dùng `var(--dur-ambient)`.

- [ ] **Kiểm chứng hover không lọt ra ngoài media query**

```bash
cd frontend && grep -rn ":hover" src --include=*.css
```

Mỗi kết quả phải nằm trong một khối `@media (hover: hover)`. Ngoại lệ duy nhất được phép là `:hover` trên `<a>` đổi màu chữ.

- [ ] **Kiểm chứng cờ tắt hiệu ứng**

Mở `/settings`, bật "Reduce effects", rồi vào một buổi học và mở `/stats`:
- Không có chuyển động nào.
- Trả lời đúng/sai **vẫn đổi màu ngay** — phản hồi không được biến mất.
- Số trên `/stats` hiện thẳng giá trị cuối, không đếm.
