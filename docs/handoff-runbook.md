# Handoff runbook

Status: operational handoff incomplete. This page describes the implemented features, but it is not yet a complete operating procedure.

This runbook covers the Share Proj release. Private setup, daily operations, failure responses, model changes and live checks are out of scope for this test bed. No completed live operation is implied here.

## What it does

The accountant needs a current certificate before the pay run. In Demo Proj, Gemini reads the PDF, code checks coverage and dates, and people review readings or deficiencies. Code builds the payment hold list. Share Proj shows fictional records and keeps visitor changes in the browser tab. It does not save those changes, send their emails or read their uploads with Gemini.

## Share Proj deployments

Both public deployments use version 31, `Round 5 consistency pass` (PR #3, branch `round-5-consistency` at `6035abe`). It passed the signed-out test deployment check on 2026-10-11: `demo: true`, `viewport-fit=cover` kept, no "Sample data" label, and `scripts/checks/webapp-access.js` exits 0.

| ID ends | Role | Version | Access |
|---|---|---|---|
| `…uUnUoGbw` | Public app | 31 | Anyone, no sign-in |
| `…0kFTfYWm` | Public upload page | 31 | Anyone, no sign-in |
| `…y3s1suy2` | Test deployment | 31 | Anyone, no sign-in |
| `…9s-VOkSc` | Editor test | HEAD | Owner only |

Version 30 is `AI upgrades`, the PR #2 merge `8979dcd7cc367bba8d4d83cb053472ce806baaf7`.
Script Properties remain unchanged. The public project remains in Share Proj. Version 30 is the rollback target for both public IDs: `npx -y @google/clasp@latest update-deployment <id> -V 30`.
Public browser checks passed on both URLs, all six app screens, the tour and the actual upload form.
See [the public release review](reviews/public-deployment-2026-10-10.md). The real iPhone and iPad checks remain open. Private operations remain in ticket 23.

List the full IDs with `npx -y @google/clasp@latest list-deployments` from `coi-poc/`.

## Daily run

The daily operating procedure remains open under ticket 23. That ticket must record the operator, commands, expected results and recovery steps in the private project.

Apps Script hides names that end in `_` from its Run menu. Those private functions are also unavailable to browser calls. Do not try to select `runDailyJob_`, `runUploadJob_` or `runCalibration_` in the menu. The names without `_` refuse manual runs in Share Proj. Ticket 23 must check the reachable owner entry points in the private Demo Proj before documenting a procedure. Do not add a public wrapper to the Share Proj or change its mode to bypass a guard.

## Data trust screen (hidden)

The public app has no Data trust screen. No link or route opens it. The stored status check still runs in the daily job. To see its result, open the Sheet and find the newest `activity_log` row with `event_type` `daily_check`. To see AI spend, read the `ai_calls` tab. To open the screen on a local copy, add `'trust'` to `ORDER` and `trust:'Data trust'` to `NAV_LABEL` in `src/AppClient.html`. Do not deploy that change.

## When something fails

The failure procedure remains open under ticket 23. It must cover failed uploads, missing permissions, model failures, email failures and incomplete daily jobs. These recovery steps have not been checked in the private project.

## Changing a coverage requirement

Coverage limits come from `docs/tolerance-matrix.json`. Ticket 23 must document who approves a change, which tests check it, and how to deploy and roll it back. This procedure remains incomplete.

## Changing the AI model

The model name and token prices live in `src/Config.gs`. Ticket 23 must check a new model against the hand-built and correction test sets before a model change. The live procedure remains incomplete.

## Turn AI drafts off

Demo Proj can use model wording for the deficiency notice and correction request. Code assembles their factual lines, names, numbers, dates, links and closing. The draft prompt forbids numbers, amounts, dates, links and names in model wording. The text checks catch specified patterns, not arbitrary names or invented claims. A failed check uses the template. A draft failure does not cancel the notice.

The private-project off-switch procedure and live checks remain open under ticket 23. Script Property `AI_DRAFTS` set to `off` forces template wording for new notices and correction previews/sends, even when an AI draft is already stored. Stored draft rows and historical records stay unchanged. Any other value, or no value, enables drafting. Share Proj visitor actions never call the model.

The correction dialog shows the same assembled text that the rejection sends. Before any rejection write, the server checks the approved wording and certificate ID against the current record. A change requires a fresh preview and approval. The Notifications screen reconstructs historical email previews from stored rows. It does not persist the exact original email body.

## Test set from corrections

When an accountant fixes a misread value in Demo Proj, the PDF link and the corrected values become a test case. The record's timeline then ends the correction line with "Added to the test set."

- **Where rows land.** The `calibration_samples` tab, one row per certificate. `expected_json` holds the corrected values. `pdf_link` points at the PDF where the upload filed it; nothing is copied. A newer correction of the same certificate replaces its row.
- **What adds nothing.** A confirmation with no changes, and an unreadable file. Share Proj never adds a row.
- **Drop a bad row.** Set `active` to FALSE. Do not delete the row; it keeps the trail. Calibration reads only rows where `active` is TRUE.
- **Read the two totals.** In the future private Demo Proj, the reachable editor entry is `runCalibration`, which calls `runCalibration_`. The private name is absent from the Run menu. Ticket 23 must check this procedure. The report can end with "Hand-built set: 8 of 8 pass." and "From corrections: 3 of 4 pass." These are examples, not recorded results. The first is the planted-problem set in `test-fixtures/sample-cois/`. The second is the firm's own hard cases. A new model should pass both before it goes live. With no active correction rows, the report keeps its single total.

## Developer setup

Run each command from the repo root.

1. Install Node 24 or later. The checks use Node's built-in glob matcher. No packages are installed.
2. Turn on the key scan before the first commit: `git config core.hooksPath coi-poc/scripts/git-hooks`.
3. Run the tests: `cd coi-poc && npm test`.
4. Open Claude Code in `coi-poc/`, so `.claude/` loads the hooks, reviewer agents and skills.

## Cost and ownership

Owner responsibilities and running costs remain open under ticket 23. The Share Proj cost rows are estimates, not measured spend. Live usage, delivery and cost checks require the private project.
