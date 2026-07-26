# Flashie Learning OS — Implementation Plan

> **Status update — 2026-07-26:** The first implementation at commit `ad32fe9`
> is functionally broad but visually rejected. Do not rerun this greenfield plan
> against the current tree. Use
> `docs/superpowers/plans/2026-07-26-learning-os-visual-remediation.md`.
> The design spec now contains approved visual sources and mandatory screenshot
> gates that supersede any looser visual wording below.

> **Execution contract:** Work task-by-task on the current `main` branch. Do not
> create a feature branch. Commit only after the task's tests pass. Do not push
> an incomplete phase to a production-connected `main`.

**Goal:** Implement the approved full-app Learning OS redesign in
`docs/superpowers/specs/2026-07-26-learning-os-redesign-design.md`.

**Architecture:** Add Alembic and a small event/progression layer to FastAPI;
keep missions deterministic and lazy-generated; expose aggregate APIs. On the
frontend, introduce semantic theme tokens, an App Shell, preference/audio/orb
providers and route-level lazy loading. Reuse current learning logic while adding
Quick Study, weekly journey and Boss as explicit modes.

**Stack:** React 19, TypeScript 6, Vite 8, Tailwind v4, Vitest, Testing Library,
Playwright · FastAPI, SQLAlchemy 2, Pydantic 2, Alembic, pytest · Vercel,
Render Free, Supabase Postgres/Storage Free.

## Global constraints

- User-facing copy is English only.
- Preserve unrelated user changes, especially untracked
  `.claude/settings.local.json`.
- No branch creation; verify `git branch --show-current` is `main` before work.
- No database reset during development tasks. Production reset occurs only in
  Phase 8 after an explicit target check.
- Never put a drop/reset command in Render startup.
- No Three.js, video background, LLM call, external runtime audio CDN, social,
  leaderboard, currency, hearts or content gate.
- Every color in product UI uses semantic tokens; every motion respects reduced
  motion/Reduce Effects.
- Backend timestamps added in this plan are timezone-aware UTC.
- All mutations are user-scoped and idempotent where retry is possible.
- Frontend route chunks remain lazy; audio is never part of the initial load.
- After each frontend task: `npm.cmd run build` and relevant Vitest.
- After each backend task: full pytest from the configured `flashcard` Python.
- At each phase gate: full backend tests + frontend build + unit tests + relevant
  Playwright projects.

## Known baseline

- `npm.cmd run build` is green on 2026-07-26.
- Backend run reached `107 passed` with 8 setup errors caused by Windows
  `PermissionError` deleting `backend/.pytest_tmp`; fix this test-environment
  issue in Task 1 before treating the suite as a quality gate.
- Existing backend has no migration tool; `create_all` cannot add columns.

---

## Phase 0 — Safety and test foundation

### Task 1: Establish a clean baseline and feature flags

**Files**

- Modify: `frontend/package.json`, `frontend/vite.config.ts`
- Create: `frontend/vitest.config.ts`, `frontend/playwright.config.ts`,
  `frontend/src/test/setup.ts`, `frontend/e2e/smoke.spec.ts`
- Modify: backend pytest configuration/fixtures only where required
- Create: `frontend/src/config/features.ts`

- [ ] Verify current branch is `main`; record `git status --short`.
- [ ] Make pytest use a unique writable temp directory instead of the locked
  repository `.pytest_tmp`; do not delete an unresolved broad path.
- [ ] Add Vitest, jsdom, Testing Library and user-event.
- [ ] Add Playwright with Chromium desktop, mobile Chromium and WebKit projects.
- [ ] Add flags `learningOs`, `progression`, `boss`, `audio` read from Vite env;
  production defaults remain off until Phase 8.
- [ ] Add a smoke test for login redirect and authenticated shell fixture.
- [ ] Run full baseline and record any genuine pre-existing failure in this file.

**Gate:** Build green; pytest has no setup error; Vitest and Playwright smoke run.

**Commit:** `test: establish learning os quality gates`

### Task 2: Add Alembic and guarded reset tooling

**Files**

- Modify: `backend/requirements.txt`, `backend/app/database.py`
- Create: `backend/alembic.ini`, `backend/alembic/env.py`,
  `backend/alembic/versions/0001_current_schema.py`
- Create: `backend/scripts/reset_app_schema.py`
- Modify: `render.yaml`, `docs/DEPLOYMENT.md`
- Create: `backend/tests/test_reset_guard.py`

- [ ] Add Alembic using `Base.metadata` as target metadata.
- [ ] Build a baseline migration for the current app-owned schema. Every later
  task that changes the schema adds its own forward migration; a fresh database
  reaches the final target by running the whole chain.
- [ ] Configure a small Postgres pool (`pool_size=5`, `max_overflow=2`,
  `pool_pre_ping=True`) without breaking SQLite tests.
- [ ] Reset script must refuse SQLite, localhost, missing expected Supabase
  project ref, or missing exact confirmation phrase.
- [ ] Script may drop only known app tables in `public`; it must never touch
  Supabase `auth`, `storage`, extensions or storage objects.
- [ ] Render startup may run `alembic upgrade head`; it must never run reset.
- [ ] Document dry-run, snapshot, target verification, reset and migration order.

**Gate:** Migration upgrades an empty Postgres-compatible test schema; guard
tests prove wrong target/phrase cannot drop.

**Commit:** `build: add migrations and guarded schema reset`

---

## Phase 1 — Preferences, events and progression backend

### Task 3: User preferences and onboarding API

**Files**

- Create: `backend/app/models/user_preference.py`
- Create: `backend/alembic/versions/0002_user_preferences.py`
- Modify: `backend/app/models/__init__.py`, `backend/app/schemas/auth.py`,
  `backend/app/routers/auth.py`
- Create: `backend/tests/test_preferences.py`

- [ ] Implement every preference field from the spec with validated enums/ranges.
- [ ] Create default preference lazily for old/missing users.
- [ ] Add `GET` and `PATCH /api/auth/me/preferences`; partial updates only.
- [ ] Return preference data with `/api/auth/me` to avoid an extra bootstrap
  request where practical.
- [ ] Store Silent profile as validated JSON; never trust arbitrary keys.
- [ ] Store voice name/locale as best effort and speech rate in a safe range.

**Gate:** Defaults, partial patch, invalid enum/range, user isolation and
onboarding completion tests pass.

**Commit:** `feat: add synced learning preferences`

### Task 4: Activity event, XP and mastery services

**Files**

- Create: `backend/app/models/learning_event.py`,
  `backend/app/models/skill_progress.py`
- Create: `backend/alembic/versions/0003_progression.py`
- Create: `backend/app/schemas/progress.py`,
  `backend/app/services/progression.py`,
  `backend/app/routers/progress.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_progression.py`,
  `backend/tests/test_event_batch.py`

- [ ] Add `learning_events` and four-row-per-user `skill_progress`.
- [ ] Centralize XP rules/caps/level formula in `progression.py`.
- [ ] Implement `POST /api/events/batch`, maximum 50 events.
- [ ] In one transaction: dedupe event, derive XP server-side, update skill XP,
  then notify mission progress.
- [ ] Reject impossible duration/metric payloads; clamp focus duration.
- [ ] Implement `GET /api/progress/overview` with the three primary KPIs,
  four skill levels/mastery and “building signal” state.
- [ ] Use aggregate queries and required indexes; no query per day or skill.

**Gate:** Retry does not double-count; caps and level thresholds hold; user
scoping and 30-day boundaries pass.

**Commit:** `feat: add idempotent learning progression`

### Task 5: Mission and weekly journey engine

**Files**

- Create: `backend/app/models/mission_assignment.py`
- Create: `backend/alembic/versions/0004_missions.py`
- Create: `backend/app/schemas/missions.py`,
  `backend/app/services/missions.py`,
  `backend/app/routers/missions.py`
- Create: `backend/tests/test_missions.py`,
  `backend/tests/test_journey.py`

- [ ] Define mission templates as data/config, not route conditionals.
- [ ] Lazy-generate exactly 3 daily and 3 weekly assignments.
- [ ] Seed selection deterministically by user + period; save assignments.
- [ ] Filter by cards, articles and worker/capability availability.
- [ ] Implement one daily reroll, excluding completed/current mission.
- [ ] Update progress from accepted learning events and auto-award XP once.
- [ ] Implement `GET /api/journey/week` with four lanes, seven checkpoints and
  server-derived Boss availability.
- [ ] Handle timezone/DST through `zoneinfo`; default Asia/Ho_Chi_Minh.

**Gate:** Friday/Sunday/Monday boundaries, missed days, unavailable capability,
reroll limit and duplicate events pass.

**Commit:** `feat: add missions and weekly journey`

### Task 6: Boss backend

**Files**

- Create: `backend/app/models/boss_attempt.py`,
  `backend/app/models/user_unlock.py`
- Create: `backend/alembic/versions/0005_boss_and_unlocks.py`
- Create: `backend/app/schemas/boss.py`, `backend/app/services/boss.py`,
  `backend/app/routers/boss.py`
- Create: `backend/tests/test_boss.py`

- [ ] Build a deterministic 10–15 minute challenge from owned cards, weak words,
  a short article/listening source and speaking capability.
- [ ] Return a snapshot/token so completion can be verified and retried.
- [ ] Normalize score when speaking is unscored/offline.
- [ ] Store all attempts, return best attempt, and award only medal delta.
- [ ] Unlock cosmetic/title keys transactionally and idempotently.
- [ ] Never block access based on checkpoint completion or prior failure.

**Gate:** Availability window, offline worker, replay, medal upgrade, idempotency
and cross-user access tests pass.

**Commit:** `feat: add weekly boss progression`

---

## Phase 2 — Design system and app shell

### Task 7: Rebuild theme tokens and ambient background

**Files**

- Rewrite: `frontend/src/styles/tokens.css`
- Refactor: `frontend/src/index.css`
- Create: `frontend/src/providers/AppearanceProvider.tsx`,
  `frontend/src/components/shell/AmbientBackground.tsx`
- Create: `frontend/src/providers/AppearanceProvider.test.tsx`

- [ ] Define semantic light/dark tokens and four accent presets.
- [ ] First visit follows system; manual choice syncs server and caches locally.
- [ ] Implement animated mesh + pattern with at most two active ambient layers.
- [ ] Add Reduce Effects, reduced-motion and `backdrop-filter` fallback.
- [ ] Remove hard-coded black body and obsolete decorative CSS.
- [ ] Add a development-only token showcase route or Story fixture.

**Gate:** Contrast audit and screenshots for 8 theme/accent combinations; no
black/white absolute canvas; no horizontal overflow at 320px.

**Commit:** `style: introduce liquid glass theme system`

### Task 8: Build responsive App Shell and navigation

**Files**

- Create: `frontend/src/components/shell/AppShell.tsx`,
  `DesktopSidebar.tsx`, `MobileNav.tsx`, `MoreSheet.tsx`
- Refactor: `frontend/src/components/Navbar.tsx`, `frontend/src/App.tsx`
- Create: `frontend/src/components/shell/AppShell.test.tsx`

- [ ] Desktop uses collapsible left sidebar; mobile uses four-item bottom nav.
- [ ] More sheet contains Library, Weak Words, Settings, Account and Sign out.
- [ ] Add `/settings`, `/onboarding`, `/daily/quick`, `/boss`.
- [ ] Keep current primary URLs and lazy-load every page.
- [ ] Respect iPhone safe area and browser back behavior.
- [ ] Feature flag can fall back to existing shell until rollout.

**Gate:** Keyboard navigation, active route, direct refresh, 320/390/768/1440
layouts and Safari safe area pass.

**Commit:** `feat: add responsive learning os shell`

### Task 9: Implement the AI orb state machine

**Files**

- Create: `frontend/src/components/orb/AiOrb.tsx`,
  `frontend/src/components/orb/orbMessages.ts`,
  `frontend/src/components/orb/AiOrb.test.tsx`
- Modify: shared motion styles only through orb-scoped classes

- [ ] Implement all states and deterministic, non-repeating short English copy.
- [ ] Expose size/compact/state props; no page-specific fork.
- [ ] Announce meaningful loading/offline state to screen readers without
  announcing decorative reactions.
- [ ] Stop ambient loops in reduced mode and when component is offscreen.

**Gate:** State snapshots/behavior pass; no LLM/network call; wrong animation
≤300ms and main celebration ≤2.5s.

**Commit:** `feat: add reactive ai orb companion`

### Task 10: Audio, speech and Silent mode engine

**Files**

- Create: `frontend/src/providers/AudioProvider.tsx`,
  `frontend/src/utils/audioEngine.ts`, `frontend/src/utils/speech.ts`,
  `frontend/src/hooks/useHaptics.ts`
- Refactor: `frontend/src/utils/feedbackSound.ts`,
  `frontend/src/utils/audio.ts`
- Create: `frontend/public/audio/ATTRIBUTION.md`,
  `frontend/src/providers/AudioProvider.test.tsx`

- [ ] Implement buses, volumes, fast Silent toggle and saved Silent profile.
- [ ] Unlock AudioContext after gesture; handle suspended context on Safari.
- [ ] Add duck/pause rules for sample playback and microphone.
- [ ] Add device voice resolution and rate; never autoplay pronunciation.
- [ ] Add vibration as optional no-op.
- [ ] Add only licensed/original, compressed, hashed audio assets; lazy-load.
- [ ] Provide WebAudio correct/wrong fallback and a fully silent fallback.

**Gate:** Music is absent from initial network requests; toggles persist/sync;
Safari audio unlock and no-audio flow pass.

**Commit:** `feat: add adaptive learning audio system`

---

## Phase 3 — Onboarding, Settings and Command Center

### Task 11: Redesign Auth, onboarding and Settings

**Files**

- Refactor: `frontend/src/pages/AuthPage.tsx`,
  `frontend/src/pages/AccountPage.tsx`, `frontend/src/auth/AuthContext.tsx`
- Create: `frontend/src/pages/OnboardingPage.tsx`,
  `frontend/src/pages/SettingsPage.tsx`
- Create: `frontend/src/api/preferences.ts`
- Tests beside pages/providers

- [ ] Convert all copy to English and apply shared form/control primitives.
- [ ] Implement five onboarding steps with Skip and audio preview.
- [ ] Settings sections: Appearance, Sound/Silent, Speech, Motion, Goal,
  Timezone, Account.
- [ ] Current users without preferences get a non-blocking Today banner.
- [ ] Voice missing on another device resolves gracefully.

**Gate:** Register → onboarding → Today; skip; reload; cross-device preference
fixture; form errors and mobile keyboard pass.

**Commit:** `feat: add learning os onboarding and settings`

### Task 12: Command Center, slow-backend cache and journey UI

**Files**

- Extend: `backend/app/schemas/daily.py`,
  `backend/app/services/daily.py`, `backend/app/routers/daily.py`
- Create/refactor: `frontend/src/pages/HomePage.tsx`,
  `frontend/src/components/home/CommandHero.tsx`,
  `SkillOverview.tsx`, `MissionList.tsx`, `WeeklyJourney.tsx`
- Create: `frontend/src/api/progress.ts`, `missions.ts`, `events.ts`
- Create: `frontend/src/hooks/useBackendState.ts`,
  `frontend/src/cache/offlineQueue.ts`
- Tests: backend home aggregate + frontend states

- [ ] Expand home response or add one aggregate endpoint so Home makes one data
  call plus capability health.
- [ ] Render shell immediately; after 1.2s show orb loading message.
- [ ] Persist last Command Center and last article in IndexedDB.
- [ ] Disable mutation while disconnected and show last-sync time.
- [ ] Implement one primary Continue CTA and Quick Study secondary CTA.
- [ ] Implement four skills, three daily missions, weekly map and compact streak.
- [ ] Empty account offers first reading/import and only feasible missions.

**Gate:** warm, slow, error, offline-cache, empty and completed-day states pass;
Home request count stays within budget.

**Commit:** `feat: build today command center`

---

## Phase 4 — Core study loop

### Task 13: Add independent Quick Study backend sessions

**Files**

- Modify: `backend/app/models/daily_session.py`,
  `backend/app/services/daily.py`, `backend/app/routers/daily.py`,
  `backend/app/schemas/daily.py`
- Create: `backend/alembic/versions/0006_daily_session_modes.py`
- Create: `backend/tests/test_quick_session.py`

- [ ] Add `mode`, `started_at`, `duration_seconds` from baseline migration.
- [ ] Full and Quick active sessions are selected independently.
- [ ] Quick selection: due → weak → one listening-capable item; target 5 minutes.
- [ ] Quick completion counts streak/events but not Full completion.
- [ ] Resume works across device and duplicate completion is idempotent.
- [ ] Preserve SM-2 one-submit-per-card-per-session rule.

**Gate:** quick/full coexist, selection priority, resume, repeat request and daily
status semantics pass.

**Commit:** `feat: add five minute quick study`

### Task 14: Rebuild Full/Quick Study UI and feedback

**Files**

- Refactor: `frontend/src/pages/DailyPage.tsx`,
  `frontend/src/hooks/useDailySession.ts`,
  `frontend/src/components/daily/**`
- Create: `frontend/src/hooks/useSwipeAction.ts`,
  `frontend/src/hooks/useActivityTimer.ts`
- Add unit/E2E tests for both modes

- [ ] Use one responsive stage component for full and quick.
- [ ] Add energy/combo/orb reactions, audio and haptic through providers.
- [ ] Wrong never locks the user; progress never moves backward.
- [ ] Add scoped swipe gestures away from viewport edges.
- [ ] Ensure focused input scrolls above virtual keyboard.
- [ ] Queue duration/completion events; flush on pause/complete/reconnect.
- [ ] Summary reports time, words, accuracy, XP and mission deltas.
- [ ] Replace all Vietnamese copy and page-specific raw colors/icons.

**Gate:** keyboard-only, touch, reduced motion, silent mode, reload/resume,
duplicate submit and 320px layout pass.

**Commit:** `feat: redesign study as a game loop`

---

## Phase 5 — Reading, speaking and support surfaces

### Task 15: Redesign Reader list and focused Reader

**Files**

- Refactor: `frontend/src/pages/ReaderListPage.tsx`,
  `frontend/src/pages/ReaderPage.tsx`,
  `frontend/src/components/reader/**`
- Extend API only where reading completion/time metadata is required
- Add Reader unit/E2E tests

- [ ] Add focused typography, progress, bilingual toggle and status legend.
- [ ] Tap word, long-press pronunciation, swipe article with Safari-safe edges.
- [ ] Add orb mini reaction only at save/checkpoint.
- [ ] Track start/complete/focused time through event queue.
- [ ] Duck music for article audio and preserve source attribution.
- [ ] Cache only the last article and translation needed for slow start.

**Gate:** catalog/paste/url/pdf flows, save word, audio, translation, cached
article, attribution and mobile gestures pass.

**Commit:** `feat: redesign focused reading experience`

### Task 16: Redesign Shadowing with online/offline parity

**Files**

- Refactor: `frontend/src/pages/ShadowingPage.tsx`,
  `frontend/src/components/shadowing/**`,
  `frontend/src/hooks/useShadowingWorker.ts`
- Extend backend events integration
- Add Shadowing unit/E2E tests with mocked media/worker

- [ ] Explicit online listen-record-score flow.
- [ ] Offline listen-record-self-compare flow without fake score.
- [ ] Orb waveform states; pause music during sample/microphone.
- [ ] Permission-denied recovery and skip/exit.
- [ ] Speaking XP/events follow scored/offline rules.

**Gate:** online, offline, worker timeout, no-speech, permission denied, retry and
mobile recording controls pass.

**Commit:** `feat: redesign resilient shadowing flow`

### Task 17: Rebuild Progress

**Files**

- Refactor: `frontend/src/pages/StatsPage.tsx`,
  `frontend/src/components/StudyHeatmap.tsx`,
  `frontend/src/components/ProgressRing.tsx`
- Add progress API adapter and tests

- [ ] Primary KPI order is streak/return, time, remembered/retention.
- [ ] Add four level/mastery panels with Building signal.
- [ ] Add accessible weekly/monthly charts, heatmap, mission and Boss history.
- [ ] Never infer missing score as zero.
- [ ] Remove emoji and direct gradient/color values.

**Gate:** empty, partial and rich histories; screen-reader summaries; light/dark
chart contrast; mobile labels do not overlap.

**Commit:** `feat: rebuild learning progress dashboard`

### Task 18: Finish whole-app visual/copy migration

**Files**

- Refactor: `frontend/src/pages/LibraryPage.tsx`,
  `DeckDetailPage.tsx`, `WeakWordsPage.tsx`
- Refactor: `frontend/src/components/DeckCard.tsx`,
  import/library modals, notifications and error boundary
- Audit: all `frontend/src/**/*.{tsx,css}`

- [ ] Apply productivity-style glass to CRUD surfaces without excessive game
  chrome.
- [ ] Convert every remaining user-facing string to English.
- [ ] Replace emoji controls with one consistent SVG icon set.
- [ ] Replace hard-coded colors and obsolete CSS with semantic primitives.
- [ ] Ensure destructive CRUD retains confirmation and clear recovery wording.

**Gate:** `rg` copy/color audit, all routes manually reachable, no mixed visual
language, all dialogs work at 320px.

**Commit:** `style: complete full app learning os migration`

---

## Phase 6 — Weekly Boss and rewards

### Task 19: Build Boss and cosmetic unlock UI

**Files**

- Create: `frontend/src/pages/BossPage.tsx`,
  `frontend/src/components/boss/BossIntro.tsx`,
  `BossStage.tsx`, `BossResult.tsx`
- Create: `frontend/src/api/boss.ts`
- Extend: Settings cosmetic picker, WeeklyJourney
- Add unit/E2E tests

- [ ] Compose existing exercise primitives rather than duplicate answer logic.
- [ ] Support worker online/offline and normalized score messaging.
- [ ] Show best attempt and Bronze/Silver/Gold; allow immediate replay.
- [ ] Award only new medal delta and unlocks returned by backend.
- [ ] Boss audio lazy-loads on entry/play and obeys Silent mode.
- [ ] Celebration has reduced-motion/static equivalent.

**Gate:** weekend/open state fixtures, failure/replay, all medal tiers, offline
speaking, reward idempotency and deep link pass.

**Commit:** `feat: add weekly boss challenge`

---

## Phase 7 — Hardening

### Task 20: Accessibility, performance and browser hardening

**Files**

- Modify tests/config/components as findings require
- Create: `frontend/e2e/accessibility.spec.ts`,
  `frontend/e2e/responsive.spec.ts`,
  `frontend/e2e/audio.spec.ts`
- Update: `README.md`, `docs/DEPLOYMENT.md`

- [ ] Add axe checks for critical routes and manual keyboard checklist.
- [ ] Test 320, 390, 768, 1440 widths in light/dark.
- [ ] Run Chromium desktop/mobile and WebKit.
- [ ] Measure initial/request/route/audio bundle budgets from the spec.
- [ ] Verify no music request before Play and no background polling storm.
- [ ] Profile ambient animation; freeze offscreen and reduced modes.
- [ ] Test Render slow response, network loss/reconnect and event queue retry.
- [ ] Audit DB query count and indexes for Home, Progress, Missions and Journey.
- [ ] Document local setup, test commands, flags and asset licensing.

**Gate:** All acceptance criteria in spec section 16 pass; no critical/serious
accessibility issue; budgets met or deviation is explicitly approved.

**Commit:** `test: harden learning os experience`

---

## Phase 8 — Production reset and rollout

### Task 21: Deploy backend, reset app data, enable frontend

This task is destructive. Do not combine it with ordinary code tasks.

- [ ] Confirm local `main` clean except known user-owned files.
- [ ] Run all tests and build once more.
- [ ] Push/deploy backend-compatible code with feature flags still off.
- [ ] Export a timestamped Supabase schema/data snapshot.
- [ ] Resolve and display the exact production Supabase host/project ref.
- [ ] Run reset script in dry-run and review the exact app-table list.
- [ ] Run guarded reset with the required project ref and confirmation phrase.
- [ ] Run `alembic upgrade head`; verify only `public` app tables changed.
- [ ] Create a fresh account and run API smoke tests.
- [ ] Enable `learningOs`, then `progression`, `audio`, and `boss` in that order.
- [ ] Run production Chrome/Safari smoke flows on desktop and mobile.
- [ ] Verify Vercel static audio caching, Render logs and Supabase connections.
- [ ] Keep rollback flags documented. Do not restore old data unless the owner
  explicitly requests it.
- [ ] Do not delete Supabase Storage in this task.

**Gate:** Fresh-user onboarding through Boss-capable journey works in production;
no CORS, migration, auth, audio or responsive blocker.

**Commit:** No code commit is required for dashboard-only flag changes; commit
documentation of the completed rollout separately if the repository tracks it.

---

## Final definition of done

- Entire app visually follows Learning OS in both themes and all four accents.
- English-only UI, desktop sidebar and mobile bottom navigation.
- Full/Quick study, missions, four skill levels/mastery, weekly map and Boss work.
- AI orb, layered audio, Silent mode, voice selection and graceful fallbacks work.
- Preferences/progress/session resume across desktop and mobile.
- Three product KPIs are accurately recorded without high-frequency backend load.
- Vercel/Render/Supabase free-tier budgets and performance targets are met.
- Database contains only the new clean app dataset after the guarded reset.
- Build, pytest, Vitest and Playwright Chromium/WebKit gates are green.
