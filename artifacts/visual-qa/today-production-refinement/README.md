# Today production refinement — review evidence

Scope is the production Today route with the existing single Orbital `AppShell` and controlled `/api/daily/home` response. `VITE_VISUAL_TODAY_PROOF` was unset.

## Screenshots

- `desktop-1920-light.png`, `desktop-1920-dark.png`
- `desktop-1440-light.png`, `desktop-1440-dark.png`
- `mobile-390-light.png`, `mobile-390-dark.png`
- `desktop-1440-dark-reduced-motion.png`
- `orb-motion-frame-1.png`, `orb-motion-frame-2.png`

## Verified

- One application shell and one shared `AiOrb`; the saved transform samples in `result.json` differ in normal motion and reduced motion reports `none`.
- No horizontal overflow or application console/page errors across six viewport/theme captures.
- Words Ready, Remembered, missions, and skills have tested real routes; journey checkpoints are keyboard-operable buttons with actual checkpoint state.
- Existing loading, failure, recovery, cache, empty, desktop-shell, and mobile-first-viewport tests remain passing.

## Production files changed

- `frontend/src/components/home/TodayOrbitalCommand.tsx`
- `frontend/src/components/home/TodayOrbitalCommandStates.css`
- `frontend/src/components/home/todayOrbitalData.ts`
- `frontend/src/components/orb/AiOrb.tsx`
- `frontend/src/components/orb/AiOrb.css`

No fixtures, routes outside Today, backend data, migrations, commits, or deployment were changed.
