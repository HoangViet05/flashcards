# R3–R5 visual QA v2

This directory contains viewport-cropped references from
`docs/superpowers/visual-references/core-experiences.html` and screenshots of
the real production routes. Prototype controls and review chrome are hidden
before each reference capture. Contact sheets place two images at their native
viewport dimensions; they are not scaled into a generic review fixture.

The automated gate records one AppShell, no horizontal overflow, and no
console errors for the captured Study, Reader article, and Shadowing routes in
dark/light desktop and mobile, compact 320px, and reduced-motion variants.
Chromium and WebKit run the same routes.

`manifest-chromium.json` and `manifest-webkit.json` deliberately use
`OWNER_REVIEW_REQUIRED` rather than a visual `PASS`: selector/layout checks
cannot certify pixel fidelity. The remaining deterministic interaction state
matrix is still required before an owner acceptance decision; it must not be
represented as passing by this artifact set.

Today’s approved proof files are not written by this suite. Their hashes match
commit `0909cee` byte-for-byte.
