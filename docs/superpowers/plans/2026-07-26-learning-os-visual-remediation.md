# Flashie Learning OS — Visual Remediation Plan

Date: 2026-07-26  
Baseline: `ad32fe9` on `main`  
Spec: `docs/superpowers/specs/2026-07-26-learning-os-redesign-design.md`

## Objective

Replace the visually rejected first implementation with the approved Orbital
Command experience without discarding backend work that is already useful.
Today, Study, Reader and Shadowing must match their approved prototypes in
composition and emotional impact before the remaining screens receive polish.

This is a remediation plan for the existing tree, not a greenfield rewrite.

## Execution contract

- Work directly on `main`; do not create a branch.
- Keep commits small and phase-scoped. Do not use another catch-all `refactor`
  commit.
- Do not push a partially completed visual phase to production-connected `main`.
- Do not reset or migrate the production database in this plan.
- Preserve working backend progression/mission/Boss behavior unless a documented
  UI contract requires an API adjustment.
- Preserve unrelated `.claude/settings.local.json`.
- No phase advances past a visual approval gate without owner approval.
- Build/tests alone cannot approve a visual phase.

## Approved visual sources

- Today, **A · Orbital Command only**:
  `C:/Users/Admin/.codex/visualizations/2026/07/26/019f9dab-65a3-7100-a171-d7101f52a773/flashie-today-directions.html`
- Study, Reader, Shadowing, all displayed states:
  `C:/Users/Admin/.codex/visualizations/2026/07/26/019f9dab-65a3-7100-a171-d7101f52a773/flashie-core-experiences.html`

The precedence and visual contracts in spec section 0 are mandatory.

## Current implementation audit

| Area | Current evidence | Required correction |
|---|---|---|
| Today slow state | Full desktop becomes one small centered orb on an empty canvas | Preserve the Orbital Command composition with cached/skeleton data |
| Shell | 232px text-only sidebar dominates every page | Compact icon rail, useful header status, mobile bottom nav |
| Today loaded | Command components exist but do not define the cold-start experience | Implement approved Daily Core hero, missions and weekly trajectory |
| Reader list | Small CRUD cards in the top third of a mostly empty page | Discovery-oriented library with visible reading state and strong hierarchy |
| Reader article | Word rail, audio control and voice menu overlap/occlude content | One article column + one stateful companion dock; mobile sheet |
| Shadowing | Small select/button block above a mostly empty canvas | Full voice calibration chamber with sample, target, waveform and record state |
| Language | 35 TSX files still contain Vietnamese text | English-only user-facing copy |
| Color/material | 30 TSX files still use direct palette utilities | Semantic tokens and Orbital material primitives |
| Audio | `ATTRIBUTION.md` explicitly says no music; provider is an 80ms oscillator | Implement the approved layered audio behavior and licensed assets |
| Tests | Four tiny E2E files and one orb unit test | Deterministic visual fixtures, real state assertions and screenshot evidence |
| Maintainability | `AppShell.tsx` is 7 lines, `HomePage.tsx` 36 dense lines, `index.css` is a 541-line mixed legacy sheet | Readable components and scoped visual modules |

## Global visual QA gate

Every visual task produces:

1. Dark desktop 1440×900 screenshot.
2. Dark mobile 390×844 screenshot.
3. Light desktop and mobile screenshots.
4. 320×568 overflow smoke.
5. Side-by-side contact sheet against the approved reference.
6. Playwright evidence for no collision, clipping, horizontal overflow or
   console error.
7. Owner approval before the next surface begins.

Store evidence under `artifacts/visual-qa/`. Commit approved Playwright snapshot
baselines only after owner approval; do not treat the rejected UI as a baseline.

Immediate rejection criteria are defined in spec section 16.1.

---

## Phase R0 — Preserve references and create deterministic review states

### R0.1 Version the approved references

**Create**

- `docs/superpowers/visual-references/today-orbital-command.html`
- `docs/superpowers/visual-references/core-experiences.html`
- `docs/superpowers/visual-references/README.md`
- `docs/superpowers/visual-references/screenshots/`

- [ ] Copy the exact approved fragments from the canonical paths.
- [ ] Configure Today to open on A · Orbital Command by default.
- [ ] Render desktop/mobile images for the approved states.
- [ ] Record date, viewport, theme and approval status in the README.
- [ ] Hash the approved files and record hashes so later edits are detectable.

**Gate:** Checked-in references visually match the conversation prototypes.

**Commit:** `docs: preserve approved orbital visual references`

### R0.2 Build a deterministic visual-review harness

**Create/modify**

- `frontend/src/dev/VisualFixturePage.tsx`
- `frontend/src/dev/fixtures/learningOsFixtures.ts`
- `frontend/src/config/features.ts`
- `frontend/playwright.config.ts`
- `frontend/e2e/visual-fixtures.spec.ts`

- [ ] Add a dev/test-only route that renders each surface/state without live API
  timing or personal data.
- [ ] Fixtures: Today loaded/slow/empty; Study active/correct/summary; Reader
  focus/word/audio; Shadowing ready/recording/score/offline.
- [ ] Fixture route must be excluded from production or guarded by DEV/test env.
- [ ] Add Playwright screenshot helpers for required viewport/theme matrix.
- [ ] Add DOM assertions for bounding-box collisions and horizontal overflow.

**Gate:** One command captures the full matrix deterministically.

**Commit:** `test: add deterministic visual review fixtures`

---

## Phase R1 — Foundations that determine visual quality

### R1.1 Replace the mixed CSS foundation

**Refactor**

- `frontend/src/styles/tokens.css`
- `frontend/src/index.css`

**Create**

- `frontend/src/styles/base.css`
- `frontend/src/styles/materials.css`
- `frontend/src/styles/motion.css`
- `frontend/src/styles/components.css`

- [ ] Keep `index.css` as imports plus true global rules only.
- [ ] Define Orbital Command tokens for canvas, glass depth, edge highlight,
  refraction tint, shadows, typography, states and four accents.
- [ ] Provide dark/light material pairs and Safari `backdrop-filter` fallback.
- [ ] Implement ambient rings/grid as supporting texture, never the main visual.
- [ ] Remove or isolate legacy dark-only game/reader/shadowing CSS.
- [ ] Add `prefers-reduced-motion` and Reduce Effects variants beside each motion.
- [ ] Add semantic icon/text/control primitives; ban raw palette utilities in
  newly touched files.

**Automated gate**

- `npm.cmd run build`
- Vitest token/provider tests.
- `rg` confirms no new direct palette utilities in remediated files.

**Visual gate:** Material sample in all 8 theme/accent combinations.

**Commit:** `style: rebuild orbital material foundation`

### R1.2 Rebuild App Shell

**Replace/refactor**

- `frontend/src/components/shell/AppShell.tsx`
- `frontend/src/components/shell/AmbientBackground.tsx`

**Create**

- `frontend/src/components/shell/DesktopRail.tsx`
- `frontend/src/components/shell/MobileNav.tsx`
- `frontend/src/components/shell/PageHeader.tsx`
- `frontend/src/components/icons/`

- [ ] Match the prototype compact icon rail; remove the wide text sidebar.
- [ ] Add icon + visible/accessible label behavior and active orbital state.
- [ ] Add contextual page header slots for streak, sound, theme and capability.
- [ ] Implement mobile bottom nav with safe area.
- [ ] Ensure focus mode can suppress nonessential chrome in Study/Reader.
- [ ] Remove emoji from shell controls.

**Visual gate:** Today placeholder, Reader and Shadowing shell screenshots at all
required sizes. Reject if shell occupies more visual weight than page content.

**Owner checkpoint 1:** Approve shell before Today work proceeds.

**Commit:** `feat: rebuild compact orbital app shell`

### R1.3 Rebuild AI orb as a visual system

**Replace/refactor**

- `frontend/src/components/orb/AiOrb.tsx`
- `frontend/src/components/orb/orbMessages.ts`
- `frontend/src/components/orb/AiOrb.test.tsx`

**Create**

- `frontend/src/components/orb/AiOrb.css`

- [ ] Add sizes/roles for command, study, compact companion and voice waveform.
- [ ] Implement idle, listening, recording, processing, correct, wrong, combo,
  complete, loading and offline visual states.
- [ ] Use layered core/halo/orbit geometry rather than one radial-gradient circle.
- [ ] Keep state copy deterministic and English.
- [ ] Provide static reduced-motion equivalents.

**Visual gate:** One state sheet containing every orb state in dark/light.

**Commit:** `feat: rebuild orbital companion states`

---

## Phase R2 — Today · Orbital Command

### R2.1 Fix slow, cached and error bootstrap

**Refactor**

- `frontend/src/pages/HomePage.tsx`
- `frontend/src/hooks/useBackendState.ts`
- `frontend/src/hooks/useCachedQuery.ts`

**Create**

- `frontend/src/components/home/CommandSkeleton.tsx`
- `frontend/src/components/home/BackendStatus.tsx`

- [ ] Render full Command Center geometry immediately.
- [ ] Populate cached values when available and mark last-sync time.
- [ ] At 1.2s, change orb/status copy to “Starting your learning space…” without
  replacing the page.
- [ ] Use skeleton missions/trajectory/metrics when cache is absent.
- [ ] Disable mutations while offline; keep read-only navigation usable.
- [ ] Retry in background without a full-page spinner.

**Visual gate:** Loaded, 1.2s slow, 8s slow, offline-cached and error screenshots.
Reject any state that becomes an empty canvas.

**Commit:** `fix: preserve command center during backend startup`

### R2.2 Implement the approved Today composition

**Replace/refactor**

- `frontend/src/pages/HomePage.tsx`
- `frontend/src/components/home/**`

**Create**

- `frontend/src/components/home/DailyCoreHero.tsx`
- `frontend/src/components/home/CoreEnergyOrb.tsx`
- `frontend/src/components/home/ActiveMissions.tsx`
- `frontend/src/components/home/WeeklyTrajectory.tsx`
- `frontend/src/components/home/SkillEnergyStrips.tsx`

- [ ] Match approved section order and relative proportions.
- [ ] Hero includes readiness, primary Full Session CTA, Quick Study CTA, reward
  preview and three useful metrics.
- [ ] Missions show icon, title, progress, reward and completed state.
- [ ] Weekly trajectory shows completed/current/future/Boss nodes.
- [ ] Four skill strips show level and mastery.
- [ ] Empty/new user state keeps the same visual world and replaces the core
  mission with a first-path activation flow.
- [ ] Mobile keeps hero, orb and primary CTA above the first fold.

**Visual gate:** Full spec matrix for Today plus side-by-side reference contact
sheet.

**Owner checkpoint 2:** Owner approval is mandatory before Study work.

**Commit:** `feat: implement approved orbital command center`

---

## Phase R3 — Study energy chamber

### R3.1 Build reusable Study stage primitives

**Create/refactor**

- `frontend/src/components/study/StudyStage.tsx`
- `frontend/src/components/study/SessionTrajectory.tsx`
- `frontend/src/components/study/CoreEnergy.tsx`
- `frontend/src/components/study/RewardBurst.tsx`
- `frontend/src/components/study/StudySummary.tsx`
- Existing `frontend/src/components/daily/**`

- [ ] Preserve current exercise/SM-2 logic; move presentation into shared stage.
- [ ] Active stage has progress, one prompt, orb/audio affordance, one answer area
  and one primary action.
- [ ] Correct state confirms answer for 600–700ms and visibly awards
  XP/combo/energy.
- [ ] Wrong state uses equivalent hierarchy with correction and no punishment
  lock.
- [ ] Summary matches prototype and includes time, accuracy, XP and streak.
- [ ] Desktop trajectory rail becomes compact progress on mobile.

**Tests:** Existing daily logic, new state transitions, keyboard submit, swipe,
reduced motion and Silent mode.

**Visual gate:** Active/correct/wrong/summary × dark/light × desktop/mobile.

**Owner checkpoint 3:** Approve Study before Reader work.

**Commit:** `feat: rebuild study as an orbital energy chamber`

---

## Phase R4 — Focus Reader

### R4.1 Redesign Reader discovery

**Refactor**

- `frontend/src/pages/ReaderListPage.tsx`
- `frontend/src/components/reader/CatalogTab.tsx`
- `frontend/src/components/reader/CatalogPreview.tsx`

- [ ] Replace CRUD-looking cards with clear continue-reading, progress, level,
  length and source hierarchy.
- [ ] Use one dominant Continue Reading item and a compact library grid.
- [ ] Translation worker actions become secondary utilities.
- [ ] Empty/loading states retain discovery composition.
- [ ] Convert all copy to English and remove emoji controls/raw legacy surfaces.

**Visual gate:** Loaded, empty, catalog and slow states at desktop/mobile.

**Commit:** `feat: rebuild reader discovery`

### R4.2 Implement the approved focused Reader

**Refactor**

- `frontend/src/pages/ReaderPage.tsx`
- `frontend/src/components/reader/WordPopup.tsx`
- `frontend/src/components/reader/PhraseCardPopup.tsx`
- `frontend/src/components/reader/SourceAttribution.tsx`

**Create**

- `frontend/src/components/reader/ReadingCompanionDock.tsx`
- `frontend/src/components/reader/ReaderAudioState.tsx`
- `frontend/src/components/reader/ReaderWordState.tsx`

- [ ] Article remains the dominant readable column.
- [ ] Desktop has exactly one companion dock; selecting a word or starting audio
  replaces dock content.
- [ ] Remove the persistent left word overlay and tall floating voice menu.
- [ ] Voice choice moves to compact Settings/dock control.
- [ ] Mobile uses one bottom sheet that never covers the selected sentence
  without scroll compensation.
- [ ] Word save, pronunciation, bilingual mode, highlights and attribution keep
  existing behavior.
- [ ] Focus mode collapses app chrome without losing exit/progress/audio access.

**Visual gate:** Focus, word-selected, audio × dark/light × desktop/mobile, plus
long article and long voice-name stress cases. Any overlap rejects the phase.

**Owner checkpoint 4:** Approve Reader before Shadowing work.

**Commit:** `feat: implement approved focused reader`

---

## Phase R5 — Voice calibration Shadowing

### R5.1 Implement the approved Shadowing chamber

**Refactor**

- `frontend/src/pages/ShadowingPage.tsx`
- `frontend/src/components/shadowing/**`
- `frontend/src/hooks/useShadowingWorker.ts`

**Create**

- `frontend/src/components/shadowing/VoiceStage.tsx`
- `frontend/src/components/shadowing/VoiceTrajectory.tsx`
- `frontend/src/components/shadowing/RecordingOrb.tsx`
- `frontend/src/components/shadowing/WordScore.tsx`

- [ ] Ready state contains source, target sentence, sample playback, stress tip,
  waveform and large record control.
- [ ] Recording state has reactive orb/waveform, timer and live transcript.
- [ ] Processing state keeps the same chamber and gives honest progress.
- [ ] Score state shows score ring, word-level marks, one actionable tip, Retry
  and Next.
- [ ] Online/offline/permission-denied paths preserve the composition.
- [ ] Music pauses during sample/recording; Silent mode keeps full visual feedback.

**Visual gate:** Ready, recording, processing, score, offline and permission
denied × dark/light × desktop/mobile.

**Owner checkpoint 5:** Approve Shadowing before whole-app cleanup.

**Commit:** `feat: rebuild shadowing as voice calibration`

---

## Phase R6 — Whole-app consistency and real audio

### R6.1 Complete English and semantic-token migration

**Scope**

- All `frontend/src/**/*.{tsx,css}`

- [ ] Replace all user-facing Vietnamese with approved English copy.
- [ ] Keep Vietnamese only in developer comments if useful.
- [ ] Replace emoji controls with the shared icon system.
- [ ] Replace direct Tailwind palette utilities in remediated/visible components.
- [ ] Convert modal, toast, error, Library, Deck, Weak Words, Progress, Settings,
  Auth, Account, Quick Study and Boss surfaces.
- [ ] Remove dead `Navbar`/legacy home components after route/reference audit.

**Automated gate**

- A copy-audit script fails on Vietnamese user-facing literals.
- A palette-audit script fails on disallowed raw utilities in product components.
- Build and all unit/E2E tests pass.

**Commit:** `style: complete orbital language and material migration`

### R6.2 Implement actual layered audio

**Refactor**

- `frontend/src/providers/AudioProvider.tsx`
- `frontend/src/utils/audio.ts`
- `frontend/src/utils/feedbackSound.ts`
- `frontend/public/audio/ATTRIBUTION.md`

**Add**

- Licensed/original compressed music and SFX assets under
  `frontend/public/audio/`

- [ ] Provide ambient/focus/reader/Boss tracks within the approved 3–4 track cap.
- [ ] Add UI, correct, wrong, combo, checkpoint and completion SFX.
- [ ] Lazy-load only after user interaction; no audio request at initial load.
- [ ] Implement bus volume, ducking, Silent profile and Safari unlock.
- [ ] Keep WebAudio fallback and no-audio fallback.
- [ ] Record source/license/hash for every asset.

**Gate:** Network test, audible review, Silent mode matrix and attribution audit.

**Commit:** `feat: deliver layered orbital audio`

### R6.3 Polish secondary surfaces

**Scope**

- Progress, Library, Deck Detail, Weak Words, Settings, Onboarding, Auth,
  Account, Quick Study and Boss

- [ ] Use the approved shell/material hierarchy.
- [ ] Preserve productivity density for CRUD screens.
- [ ] Use Orbital celebration/game language for Progress, Quick Study and Boss.
- [ ] Add meaningful empty/loading/error states; no small card floating in an
  empty viewport.

**Visual gate:** One dark/light desktop/mobile state for every route.

**Commit:** `style: finish whole-app orbital consistency`

---

## Phase R7 — Final QA and controlled rollout

### R7.1 Full visual regression and browser pass

- [ ] Capture the complete matrix from spec section 16.1.
- [ ] Produce contact sheets against approved references.
- [ ] Run Playwright Chromium desktop/mobile and WebKit.
- [ ] Run keyboard, screen reader, reduced-motion, 200% zoom and contrast checks.
- [ ] Verify Chrome and Safari audio/voice fallbacks.
- [ ] Test Render 1.2s/8s/30s delayed responses and network reconnect.
- [ ] Verify bundle/audio/free-tier budgets.
- [ ] Run `npm.cmd run build`, Vitest, Playwright and full backend pytest.

**Owner checkpoint 6:** Final visual approval of the contact sheets.

**Commit:** `test: approve orbital visual regression baseline`

### R7.2 Production rollout

- [ ] Deploy backend-compatible changes first only if API adjustments were needed.
- [ ] Deploy frontend with Learning OS enabled.
- [ ] Smoke test Today, Study, Reader and Shadowing in production Chrome/Safari
  on desktop and mobile.
- [ ] Compare production screenshots to approved local screenshots.
- [ ] Verify audio caching and no initial music download.
- [ ] Keep feature rollback flags until the owner signs off production.

No database reset is part of this remediation rollout.

## Definition of done

- Today visually matches A · Orbital Command and never collapses into empty space.
- Study, Reader and Shadowing match every approved prototype state.
- The owner approved six visual checkpoints with screenshot evidence.
- No mixed-language copy, emoji controls, overlap or raw legacy dark panels remain
  in visible routes.
- Actual layered audio exists and remains optional/free-tier friendly.
- Desktop/mobile, dark/light, Chrome/Safari and reduced-motion paths pass.
- Functional progression, Reader, Shadowing and scheduling behavior remain intact.
