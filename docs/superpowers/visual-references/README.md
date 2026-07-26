# Approved visual references

These files preserve the approved 2026-07-26 prototypes named in the Learning OS design. They are immutable inputs to visual QA, not implementation examples.

## Capture rule

The legacy images directly under `screenshots/` include the prototype review chrome and are retained only as historical evidence. They are not valid comparison inputs. R0/R1 comparison images are written under `screenshots/cropped/` by the Playwright gate, which captures only the prototype app viewport (`.ftd-screen` or `.fce-screen`) after the review controls have been excluded. Each capture records the same browser theme and viewport as its corresponding implementation image.

| Surface | Checked-in source | Canonical source | Approval | Rendered review images |
| --- | --- | --- | --- | --- |
| Today | `today-orbital-command.html` | `flashie-today-directions.html` | A · Orbital Command only | `screenshots/today-orbital-command-{desktop,mobile}.png` |
| Study, Reader, Shadowing | `core-experiences.html` | `flashie-core-experiences.html` | all displayed states | `screenshots/core-{study,reader,shadowing}-{active,feedback,complete}-{desktop,mobile}.png` |

Reference capture date: 2026-07-26. Desktop viewport: 1440×900. Mobile viewport: 390×844. The prototypes manage their own light presentation; the screenshots are preserved as approved composition references rather than theme variants.

## Integrity hashes

SHA-256 values must match the approved canonical fragments before any comparison:

- `today-orbital-command.html`: `762AAA49D7E1ED27EA140922BB6ECED9EC546B490102D00E075F95E6A4B1CF1E`
- `core-experiences.html`: `FC10CAA1764D9CDE102FB9FA4F8966172EF47AFF480E89CA1AFE5B1ED2BC01F6`

The matching full preview wrappers remain thread-scoped source material solely to render these checked-in review images. Do not use rejected Today directions B or C as product references.
