# Design hand-back from Claude Design

Brief: `claude-design-brief.md`. Round 3 brief: `round-3-refinement-brief.md`.

## Visual reference only

The `.dc.html` files run on Claude Design's own runtime, `support.js`. They are a visual reference, not code to ship.

- Do not copy `.dc.html` markup into `src/`.
- Never put `support.js` into `src/`.
- Build each screen in plain HTML, CSS and JavaScript, using `src/Styles.html` (ticket 08b).
- If `refined/` has a screen, build from `refined/` instead.

Decision: `docs/decisions.md`, Phase 4.

## How to view the screens

Each file in `screens/` loads `./support.js` and `./tokens.css`, but both files are in this folder, one level up. A screen opened from `screens/` shows no styles.

1. Copy `screens/`, `support.js` and `tokens.css` into one temporary folder.
2. Serve the folder with `python -m http.server 8765`.
3. Open `http://127.0.0.1:8765/Walkthrough.dc.html` in Chrome.

## Round 1: tokens and components (received 2026-10-08)

| File | What it is |
|---|---|
| `tokens.css` | Design tokens as CSS custom properties: type, colors, status colors, spacing, radius, shadow, sizing |
| `components.html` | Component sheet (brief section 11 item 2). Exported as `Tokens and Components.dc.html`. Open in a browser; needs `tokens.css` and `support.js` beside it |
| `support.js` | Claude Design's page runtime, needed only to view the `.dc.html` files. Not part of the build |

Built from the brief only; no existing design system or brand applied.

### Contrast check (WCAG AA), verified 2026-10-08

Every status color passes 4.5:1 as text and as a fill with white text.

| Family | Used for | On white | On canvas | On own tint | White on fill |
|---|---|---|---|---|---|
| Green | Compliant, On track, pass | 6.53 | 5.93 | 5.62 | 6.53 |
| Amber | Needs review, Expiring soon, Watch | 6.45 | 5.86 | 5.66 | 6.45 |
| Red | Expired, At risk, fail | 6.57 | 5.97 | 5.65 | 6.57 |
| Blue | Awaiting | 7.08 | 6.43 | 6.06 | 7.08 |
| Violet | In review | 7.73 | 7.02 | 6.51 | 7.73 |
| Neutral | Closed, waived | 6.86 | 6.23 | 5.74 | 6.86 |
| Hold | Payment hold flag | 16.56 | 15.05 | 13.50 | 16.56 |

Other: muted text on sunken 4.93; input border on white 3.91 (non-text, needs 3:1); focus ring on white 5.67.

Note: Needs review and Expiring soon share amber. The status word tells them apart, as the brief requires.

## Round 2: screens and prototype (received 2026-10-08)

| File | What it is |
|---|---|
| `screens/*.dc.html` | One file per screen in its key states, plus the three review batches (A, B, C) |
| `screens/Walkthrough.dc.html` | The clickable prototype of the brief section 10 walkthrough |
| `screens/field-notes.md` | The data field behind each element (brief section 11 item 5) |
| `proposals.md` | Ideas left out because they add a number or behavior the brief does not define |

Review on 2026-10-08: the `ux-reviewer` and `cfo-reviewer` agents both returned Fix, with no Block. Decisions and fixes are in `docs/decisions.md`, Phase 4, and in section 8 of the Round 3 brief.

## Round 3: refinement

In progress in `refined/`.
