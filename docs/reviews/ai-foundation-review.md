# Review of the merged AI work (lanes A, B, C)

Baseline before any fix: `npm test` 445 pass, 0 fail. All 8 checks exit 0.

## Findings

| id | severity | file:line | what is wrong | fix | status |
|---|---|---|---|---|---|
| R1 | blocker | `src/Calibration.gs` (`runCalibration_`, correction samples) | The merge left a call to `reader.read`, but `reader` no longer existed. With one active `calibration_samples` row, the run threw a ReferenceError. Those reads were also never metered. | New `readAndMeter` reads and writes the `calibration` ai_calls row. Both loops use it. Test added in `tests/metering.test.js`. | fixed |
| R2 | major | `src/Notifications.gs:112` (`storedNotice`) | A stored row with `drafted_by` AI whose wording failed the check again showed "Drafted by AI" over template text. | The label is AI only when the usable draft exists. Test in `tests/notifications.test.js`. | fixed |
| R3 | minor | `src/Draft.gs:59` (`checkDraft`) | The check caught digits but not "two million" or "ten percent", so the model could write an amount in words. | Reject hundred, thousand, million, billion, dozen, percent. Test added. | fixed |
| R4 | minor | `tests/draft.test.js:140` | The expected email came from `assembleDeficiencyNotice`, the code under test. | Literal string. | fixed |
| R5 | minor | `src/AppClient.html:1115` | The strip was titled "AI reading cost" but sums reads, drafts and calibration. | Titled "AI cost". Docs and test updated. | fixed |
| R6 | minor | `docs/handoff-runbook.md`, `docs/decisions.md` | `AI_DRAFTS` was not in the runbook. The decision row listed the old rules only. | Added both. | fixed |

## Checked, no finding

- **Model call or Sheet write in Share Proj.** `ensureDrafts`, `recordAiCall`, the sample write in `reviewAction` and `runCalibration` all check `isDemoMode()`. Tests cover each.
- **Facts from the model.** The model sees only audience, id, kind and field label. Code writes every fact line, the closing and every link. Stored rows are checked again before they are shown or sent.
- **Draft reaching an email unchecked.** `buildDrafter` checks, and `usableDraft` checks again on send and on screen.
- **Email fails because drafting failed.** `withDeficiencyDraft` catches every error and sends the template. `buildDrafter` never throws.
- **Failure paths.** 429, timeout, empty reply, bad JSON, missing API key and `AI_DRAFTS` off each give the template and a stored reason. Tests exist for each.
- **Locks.** `storeDraft` and `upsertSample` run inside the lock. `recordAiCall` takes its own lock and is called outside it. No lock is left held. `storeDraft` writes once per certificate and kind.
- **Cost math.** `MODEL_PRICES` matches the research note. By hand: 1,700 in at 0.30 and 300 out at 2.50 per million is 510 + 750 = 1,260 millionths, so $0.00126. With 1,000 in and 200 out it is $0.0008. A missing price gives null, a blank cell and "price unknown", never $0. Thinking tokens bill at the output rate.
- **Currency rounding.** Sums round to a millionth. The screen shows four decimals under one cent.
- **Wrong column, tab name or argument order.** None found in the new code.
- **Honesty of "Drafted by AI".** Fixed in R2. The subcontractor copy of a deficiency, resend and reminder rows say Template.
- **Plain English.** No em dashes in the new docs.

## Needs owner decision

None. Two notes for later:

- The check refuses digits and number words, but cannot judge tone or sense. A person still approves the correction request, and the project manager reads the notice.
- The per-certificate figure counts every read row, including reads that failed to save. This is a small overcount and matches the definition in `docs/metric-definitions.md`.
