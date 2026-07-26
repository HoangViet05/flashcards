# Today complete visual batch

This batch exercises the production `HomePage` and its single `TodayOrbitalCommand` surface. Visual QA injects deterministic data into that production path; it does not use a substitute page or fixture DOM.

Coverage includes loaded dark, cached/slow (1.2 s and 8 s delays), empty/new-user, offline/error, compact 320×568, reduced-motion, keyboard traversal, Chromium layout checks, and a WebKit smoke test.

Each visual case stores `implementation.png`, `contact-sheet.png`, `layout-result.json`, `console-result.json`, and `overflow-result.json`. Contact sheets are implementation-labelled for states without a separately supplied visual reference. The approved loaded/light desktop and mobile references remain frozen outside this directory; `regression-results.json` records their required hashes.

Known differences: no separate dark/slow/empty/offline prototype reference was supplied, so those contact sheets are production captures rather than reference-versus-implementation comparisons. State-specific wording is intentionally dynamic while the Orbital Command DOM hierarchy and visual proportions remain shared.
