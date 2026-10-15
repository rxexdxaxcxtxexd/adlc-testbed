# Consistency pass, 2026-10-11

Goal: one current UI in both modes (Demo Proj and Share Proj), matching the latest guidance. `src/` is the source of truth; the v4 mock is the design reference.

## Owner decisions

- **No "Sample data" flag anywhere on screen.** Overrides the old hard rule in `CLAUDE.md` (updated). PDFs keep "SAMPLE: fictional certificate". The About page keeps "All names are fictional."
- **Option B** for Share Proj stands: no notice.

## Changes (project copy of `src/`, not yet pushed)

| # | Area | Change | Files |
|---|---|---|---|
| 1 | Header, upload page | "Sample data" pill removed; style removed | `Worklist.html`, `UploadPage.html`, `Styles.html` |
| 2 | Tab titles | "COI Check · Harborline Builders", "Upload your certificate" | `Worklist.html`, `UploadPage.html`, `Code.gs` |
| 3 | Notifications | Banner: "Preview. These emails are drafted for review." Email footer drops "Sample data. This is a preview." | `Notifications.gs`, `AppClient.html` |
| 4 | About | "All names are fictional." | `AppClient.html` |
| 5 | Record: next-step panel | v4 layout: state as heading ("Decision needed") with one meta line; waiting state shows the owner chip; no full-bleed banner, no "N requirements not met" heading, no numbered steps, no inner well | `AppClient.html`, `Styles.html` |
| 6 | Record: gaps | One neutral list, a row per gap, red "Fail" tag, found value in red. Replaces red cards with red left edge | same |
| 7 | Record: decide | "Waiver note" label; placeholder "Why are these gaps acceptable for this job?"; helper "Reject emails Ridgeline a correction request." | same |
| 8 | Record: not owner | "View only" lock row with the reason, plus "View as …" link | same |
| 9 | Record: fix value | Footer strip "Value read wrong?" + "Fix a misread value" (accountant only, hidden in the check-reading state where it's the main button) | same |
| 10 | Record: other states | Heading carries the state, so the body drops its own heading: "Passed every check. Approve it and Brightway gets an approval email." / "The file couldn't be read. Ask … for a readable PDF." | `AppClient.html` |
| 11 | Record: checks | Heading "Checks"; "Under 85% is checked by a person" | `AppClient.html` |
| 12 | Errors | "That didn't go through. Try again." / "This view didn't load" / "The certificate preview didn't load." / "The message history didn't load." | `AppClient.html` |
| 13 | v4 mock | "Correct a value" → "Fix a misread value" to match `src/` | `COI App v4.dc.html` |
| 14 | Tests | Banner, footer and a "no Sample data flag" check | `tests/notifications.test.js`, `tests/app-views.test.js` |

## Copy rules checked across live UI

Contractions, buttons that say what they do, no "Demo:" wording, no "Sample data", no "Please". Server refusal text in `*.gs` is unchanged (tests pin it) — the one visible exception is the upload failure message in `Upload.gs` ("could not finish").

## Not changed

- Record header chips (Project, Scope, Record) stay; v4 moves the project to a breadcrumb. Small, do it with the responsive work.
- Server `sample:` fields in API responses (no screen reads them) and the owner-side Sheet name.
- Dead CSS `.numbered`, `.step-num`, old `.gap` base rule: safe to delete later.

## Handoff to Claude Code

1. Pull these files from the design project into the repo: `src/AppClient.html`, `src/Styles.html`, `src/Worklist.html`, `src/UploadPage.html`, `src/Code.gs`, `src/Notifications.gs`, `tests/notifications.test.js`, `tests/app-views.test.js`, `CLAUDE.md`.
2. Add a row to `docs/decisions.md`: no "Sample data" label on screens (2026-10-11), supersedes the 2026-10-10 row's "Sample data stays on every screen".
3. Update deploy checks that grep for "Sample data" (handoff runbook signed-out check, ticket 14/22 notes, reviewer agents in `.claude/agents/`). Check for `demo\":true` only.
4. `node --test`, then check the record panel as accountant, project manager and leadership at 375 and desktop.
5. Then the responsive spec, in its own order.

Preview: `docs/design/round-5/decision-panel-preview.html` (static, design only).
