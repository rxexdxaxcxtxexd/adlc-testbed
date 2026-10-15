# Spec: certificate of insurance compliance (proof of concept)

Status: open
Milestones: 1 to 6 (see Further Notes)

Vocabulary follows `GLOSSARY.md`. Decisions referenced here live in `docs/decisions.md`. Every number on a screen is defined in `docs/metric-definitions.md`.

This file records the original plan. Later owner decisions control the release. Use `docs/handoff-ai-upgrades-finish.md` for the present Share Proj scope. User stories and milestone success tests below are planned behavior, not proof of completed live checks. ROI and Data trust are hidden. Live AI upgrade checks and the complete operational handoff remain under ticket 23.

## Problem Statement

A small construction firm must hold a current certificate of insurance from every subcontractor on every project, before work starts and before each payment. Today one accountant per project does this by hand: certificates arrive by email, the accountant compares each one against the project requirements, logs the expiry date in a spreadsheet, scans that spreadsheet every month before the pay run, and writes near-identical reminder emails to subcontractors whose policies are about to lapse. Nothing tells a subcontractor their certificate passed. A missed date has already caused a real problem once. The number of projects is doubling with the same staff.

The work is not failing; it is slow, repetitive and easy to get wrong on the one day it matters most, the day before checks go out. Leadership has no single view of whether every subcontractor across every project is covered.

## Solution

A web tool inside Google Workspace that takes over the repetitive parts and leaves the judgment with people.

A subcontractor receives a unique upload link for each project. They upload their certificate as a PDF; no sign-in. The tool reads the certificate with AI, then ordinary code checks every coverage and limit against the project requirements for that subcontractor's scope of work. A person approves what matters: each project has a review mode, and new projects start with every result waiting for the accountant. Readings the AI is unsure of always go to a person. Deficiencies go to the project manager, who waives or rejects them.

The tool keeps one compliance record per subcontractor per project, files every certificate in Drive, sends renewal reminders at 30 and 7 days, and before each pay cycle builds the payment hold list of everyone who must not be paid and why. Leadership sees one tile per project (on track, watch, at risk) and a compliance dashboard; a CFO sees an ROI page whose every number shows its inputs. All data is fictional and labelled "Sample data."

## User Stories

### Subcontractor

1. As a subcontractor, I want a link that needs no account or sign-in, so that I can send my certificate in under a minute.
2. As a subcontractor, I want the link to already know which project I am on, so that I cannot file my certificate against the wrong job.
3. As a subcontractor, I want to be told immediately if my file cannot be read, so that I can resend it the same day.
4. As a subcontractor, I want an email when my certificate is approved, so that I know I am cleared to work and be paid.
5. As a subcontractor, I want a correction request that names each missing or low limit and the required amount, so that I can take one clear request to my insurance agent.
6. As a subcontractor, I want a reminder 30 days before my policy expires, so that I renew before payment stops.
7. As a subcontractor, I want a follow-up 7 days before expiry if I have not sent a renewal, so that a missed first email does not cost me a payment.
8. As a subcontractor, I want a resent copy of the same file to be recognized, so that I do not create confusion by sending it twice.

### Accountant

9. As an accountant, I want one worklist per project with everything that needs me at the top, so that I stop hunting through my inbox and spreadsheet.
10. As an accountant, I want each subcontractor's status, current expiry date and last action on one row, so that I can see the whole project at a glance.
11. As an accountant, I want certificates that passed every check to wait for my approval while the project is on review all, so that nothing goes to a subcontractor before I have seen it.
12. As an accountant, I want a certificate the AI read with low confidence to come to me in every review mode, so that a bad reading never approves itself.
13. As an accountant, I want to see the PDF beside the values that were read from it, so that I can check the reading quickly.
14. As an accountant, I want to correct a wrongly read value and have the check run again, so that my correction, not the AI's guess, decides the result.
15. As an accountant, I want every correction I make logged with my name and the date, so that an auditor can see what changed and why.
16. As an accountant, I want an unreadable file to arrive with a ready-made "please resend" draft, so that I can send it with one click.
17. As an accountant, I want to add a note to any compliance record that stays forever, so that I remember why a decision was made.
18. As an accountant, I want to mark whether a W-9 is on file, so that a missing W-9 holds payment as surely as an expired policy.
19. As an accountant, I want a payment hold list before each pay cycle with each subcontractor, the billed amount and every reason, so that I never pay someone I should not.
20. As an accountant, I want a hold to lift on its own once its reasons are gone, so that a subcontractor who renews on pay day is not held by mistake.
21. As an accountant, I want a duplicate upload ignored without creating a second item, so that my queue stays honest.
22. As an accountant, I want a newer upload to replace one still waiting in my queue, so that I only ever review the latest file.
23. As an accountant, I want to close a project's records when the work ends, so that tracking stops and history is kept.
24. As an accountant, I want closing a record to be refused while a certificate is still waiting, so that nothing is lost unreviewed.
25. As an accountant, I want an audit package of every certificate, reading, decision and message for a closed project, so that audit prep takes minutes.
26. As an accountant, I want awaiting records created when a subcontract is issued, so that I can see who still owes me a certificate.

### Project manager

27. As a project manager, I want an email naming each deficiency, the value found and the value required, with a link to the record, so that I can decide without opening a spreadsheet.
28. As a project manager, I want to waive a deficiency with a note, so that work can continue when a lower limit is acceptable for this scope.
29. As a project manager, I want to reject a deficiency and have the correction request sent for me, so that I do not write the email myself.
30. As a project manager, I want my waivers recorded with my name and reason, so that the decision can be defended later.

### Leadership

31. As leadership, I want one tile per project that says on track, watch or at risk in words as well as color, so that I can read portfolio health in one glance.
32. As leadership, I want each tile to show compliant of expected, expired, expiring within 30 days, below required limits, and dollars on hold, so that I know where to look.
33. As leadership, I want a tile to turn at risk whenever anyone is expired or on payment hold, so that the serious cases are never hidden behind a count.
34. As leadership, I want to set each project's review mode, so that automation grows only as fast as trust in it.
35. As leadership, I want automatic mode to list what went out without review in a weekly summary, so that I can spot drift.
36. As leadership, I want the project requirements and the limits by scope of work kept in one place, so that a policy change is made once.

### CFO and data manager (reviewers of the result)

37. As a CFO, I want an ROI page that leads with the likely case and calls out the low-case floor, so that I see both the expected value and the worst honest case.
38. As a CFO, I want every ROI input shown with its low, likely and high value and its basis, so that I can change any assumption I disagree with.
39. As a CFO, I want the ROI page to refuse to show a number whose inputs lack a value or a basis, so that I am never shown an invented figure.
40. As a CFO, I want the running cost shown, both the AI spend and the upkeep hours, so that the return is net of what it costs to run.
41. As a data manager, I want every figure on screen to show its source and when it was last updated, so that I can trace any number.
42. As a data manager, I want every metric defined once in writing, so that "compliant" means the same thing on every screen.
43. As a data manager, I want every activity in a timeline tab, so that the record view and an auditor read the same history.
44. As a data manager, I want the sample data to carry planted problems that the tests prove are caught, so that the checks are shown to work on bad data, not only clean data.
45. As a reviewer, I want "Sample data" on every screen and "SAMPLE: fictional certificate" on every sample PDF, so that nothing reads as a claim about a real company.

### Owner of the build

46. As the owner, I want a step-by-step setup script for the steps only I can do in Google's consoles, so that setup is repeatable.
47. As the owner, I want `initProject` to build the Sheet tabs and Drive folders exactly, so that a new demo project takes one command.
48. As the owner, I want a role switcher labelled "Demo only," so that I can show each person's view from one account.
49. As the owner, I want the AI model name in one setting, so that a retired model is a one-line change.
50. As the owner, I want the API key kept in Script Properties, never in code, so that the repo can be shared safely.
51. As the owner, I want a handoff runbook, so that a business could run this without me.
52. As the owner, I want to ask audit questions over a project's certificates and get cited answers, so that the audit story is concrete.

## Implementation Decisions

### Modules

Deep modules with small interfaces. The compliance core holds almost all the behavior; everything that touches Google sits behind an adapter.

1. **Compliance core (pure).** No Google services, no DOM. Lifted from the logic prototype (branch `prototype/coi-lifecycle`). Interface:
   - `evaluateCoi(extracted, scope, matrix, context)` returns `{ pass, deficiencies[] }`. `context.insuredName` is the subcontractor's name; the insured-name check compares normalized names.
   - `deriveStatus(record, today)` returns one status.
   - `nextStatus(record, event, today, mode)` returns `{ record, effects[] }` or `{ record, effects: [], refused: reason }`. Effects are the messages the event produced (to, kind, text); adapters send them.
   - `projectTile(records, today)` returns color, word and the dashboard counts.
2. **Extraction.** `parseExtraction(json)` turns the model's reply into clean values or an unreadable result with a reason. The Reader adapter sends the PDF inline (base64, `application/pdf`) to `generateContent` and asks for JSON output against a fixed schema at temperature 0. The model ID lives in configuration: `gemini-3.5-flash-lite`, with no fallback model (docs/decisions.md, Phase 2). Confirm the ID and the structured-output field names with the first real call.
3. **ROI.** `roiLines(inputs)` computes each line from `docs/metric-definitions.md` and returns, per line, either the value per case or "not shown" with the missing input named.
4. **Adapters.** Reader (Gemini), Store (Sheets and Drive), Mailer (Gmail), Clock. Each has a real and a fake version with the same interface.
5. **Jobs.** Process new uploads (one certificate per run); a daily run that recomputes status and sends reminders; the pay check; closeout and the audit ZIP. Batches use the continuation-token pattern: a cursor in Script Properties, at most 10 records per run, re-triggered after 60 seconds.
6. **Intake page.** A public page, run as the owner, no sign-in. It checks the link's token against an open compliance record (awaiting, expiring soon, expired, or with a rejected certificate), accepts PDF only up to a size cap, saves the file to Drive, records its fingerprint, and adds an upload row. Processing happens in a job, not in the page request.
7. **Internal app.** Views: project tiles, compliance dashboard, project worklist, compliance record detail, payment hold list, ROI page. A role switcher labelled "Demo only" picks accountant, project manager or leadership. Browser code reaches the server only through `google.script.run`; dates cross as ISO strings.
8. **Setup and sample data.** `initProject` builds tabs and folders. A sample generator produces fictional ACORD 25-style certificates as PDFs from an HTML template, each printed "SAMPLE: fictional certificate," plus a manifest of planted problems.

### Status model (from the prototype)

Status is computed, never set by hand. The Sheet stores it for filtering; code recomputes it on every write and in the daily job.

```js
// From the logic prototype: status follows the current certificate, the queue and the date.
function deriveStatus(r, today) {
  if (r.closed) return 'closed';
  if (r.current) {
    const d = daysUntil(today, r.current.expiration_date);
    if (d < 0) return 'expired';
    if (d <= 30) return 'expiring_soon';
    return 'compliant';
  }
  if (r.pending) return r.pending.stage === 'needs_review' ? 'needs_review' : 'in_review';
  return 'awaiting';
}
```

Routing of a readable certificate (from the prototype):
- Confidence below 0.85, or unparseable: queue stage `needs_review`, in every review mode.
- Deficiencies found: queue stage `deficiency`; the project manager is emailed.
- Pass in review all: queue stage `approval`; nothing goes to the subcontractor.
- Pass in review deficiencies or automatic: accepted at once. The weekly summary was deferred by the owner and is not built.
- After an accountant corrects a low-confidence reading, the check re-runs and routing follows the review mode.

Payment hold is a flag with reasons, not a status. Who is held, and why, is defined once in `docs/metric-definitions.md` (payment hold rule); expiring soon is not a hold reason (see `docs/decisions.md`, Phase 1). The hold lifts itself when every reason is gone.

Refusals: approve with nothing waiting for approval; waive or reject with no deficiency waiting; correct a reading when none is waiting; upload to a closed record; close a record while a certificate waits.

### Schema

The Sheet replaces the earlier single `coi_records` tab with these tabs. Schema changes require matching code, tests and documentation. Phase 6 added the three AI tabs below.

- `projects`: project ID, name, review mode, accountant, project manager and leadership addresses, status, created date.
- `subcontractors`: sub ID, name, email, scope of work.
- `compliance_records`: record ID, project ID, sub ID, subcontract number, upload token, stored status, current certificate ID, queued certificate ID, payment hold flag and reasons, W-9 on file, reminder flags, closed, last updated.
- `certificates`: certificate ID, record ID, received date, file fingerprint, queue stage and reason, confidence, every value read (limits, insured name, endorsement, project address, certificate holder, cancellation days, expiry date), check result and deficiencies, decision, ID of the certificate it replaces, outcome, Drive links.
- `pay_applications`: project ID, sub ID, pay cycle, amount billed.
- `activity_log`: record ID, time, who, event type, one-line summary, Drive link.
- `uploads`: written by the intake page; processed by the upload job.
- `ai_calls`: recorded model usage, token counts, computed cost, purpose and outcome.
- `ai_drafts`: stored model wording or template fallback for each certificate and message kind.
- `calibration_samples`: corrected expected values and the original PDF link for each correction test case.

### What one row means

| Tab | One row | Key |
|---|---|---|
| projects | One project, with its review mode and named staff | project_id |
| subcontractors | One subcontractor, shared across projects | sub_id |
| compliance_records | One subcontractor on one project | record_id; project_id and sub_id together |
| certificates | One received certificate, including queued and replaced certificates | certificate_id; record_id links to the compliance record |
| pay_applications | One billed amount for a subcontractor, project and pay date | No unique row ID; repeated rows add together |
| activity_log | One event for a record or project | No unique row ID; record_id, time and row order identify the event |
| uploads | One accepted upload receipt before the reading job | upload_id; upload_token links to the compliance record |
| ai_calls | One stored usage record for a model response; Share Proj rows are estimated samples | call_id; optional record_id and certificate_id link to the source record |
| ai_drafts | One stored result for a certificate and message kind, AI or Template with its fallback reason | draft_id; certificate_id and kind together identify the stored result; call_id links to recorded usage when available |
| calibration_samples | One active or inactive corrected test case per certificate; a newer correction replaces the row | sample_id; certificate_id is the update key; record_id and pdf_link identify the source |

A record event uses the compliance record ID in activity_log.record_id.
A project event uses the project ID in that same column.
Review mode changes and daily checks are project events.
REC- and PRJ- prefixes distinguish the two event types.

`ai_calls` and `ai_drafts` append rows. `storeDraft` does not add another result for the same certificate and kind. `calibration_samples` updates the existing certificate row after a newer correction. A person sets `active` to FALSE to exclude a sample without deleting its history. A confirmation with no changes and an unreadable file add no sample. Share Proj corrections change only the visitor's record view and add no stored test case.

The tolerance matrix's home is the repo file; deploy copies it to Drive. Drive keeps PDFs, readings (JSON), decision notes and correspondence in the canonical folder tree.

### Access

- Both web apps run as the owner, so every file has one owner and users need no Sheet rights.
- The intake page allows anyone, no sign-in. The internal app allows anyone signed in to a Google account; all its data is fictional.
- **To confirm in ticket 01:** whether one script project can carry two deployments with different access settings. If not, the intake page becomes its own small script project that writes only to the `uploads` tab and the Drive inbox folder.

### Rules carried into code

- `LockService` script lock with `tryLock` around ID generation and every Sheet write.
- No `require`, `import` or `async`/`await` in deployed code.
- No dollar amounts in the comparison logic; limits come only from the tolerance matrix.
- Secrets only in Script Properties.

## Testing Decisions

- **A good test checks behavior through a seam, never internals.** Given inputs, assert the returned record, effects, refusal, tile or ROI line.
- **Expected values are literals,** read by hand from the sample PDFs and the planted-problem manifest. Never compute an expected value with the code under test.
- **Seams:** the compliance core (`evaluateCoi`, `deriveStatus`, `nextStatus`, `projectTile`), `parseExtraction`, and `roiLines`. Jobs are tested through the core with fake adapters (Reader, Store, Mailer, Clock).
- **Runner:** Node's built-in test runner, development only, with no packages. Tests load the plain Apps Script files into a sandbox, the same way the prototype's headless scenario run loaded the page's script. `.claspignore` keeps all test files and tooling out of deployment.
- **Prior art:** the prototype's six scenarios (clean pass; $1M umbrella against $2M; low confidence under review all, unchanged by switching to automatic; renewal after expiry in pay week with the hold lifting itself; duplicate; refused moves) become the first `nextStatus` tests, with outcomes written as literals.
- **Planted problems** each have a test proving they are caught: expired policy, limit below requirement, wrong insured name, missing additional insured endorsement, unreadable file (encrypted, corrupt or non-PDF), duplicate submission.
- **Extraction calibration gate (milestone 2):** on every sample PDF, every value read matches the manifest and confidence is at least 0.85. Fix the prompt before moving on.
- **Mechanical checks:** a scan that fails on `require`, `import`, `async` or `await` in deployed code; a scan that fails on dollar amounts in the comparison logic; a snapshot test that fails if a tab, column or folder name changes; a pre-commit scan for keys.
- **Manual protocol (milestone 4):** happy path, deficiency path and integration checks against the deployed URL, driven in Chrome.

## Out of Scope

- Subcontractor self-service status portal (a nice-to-have).
- Email intake (shown only as a concept).
- Morning digest, personal or suppressed reminders, escalation timers.
- Backfill of existing certificates; the demo starts from seeded sample data.
- Project divisions.
- Hard payment block or any accounts-payable integration beyond the payment hold list.
- Sync with any other reminder tool.
- Bonds, lien waivers, safety certificates and other document types.
- Scale and hardening beyond a demo: high volume, quota tuning, multiple real users.
- OCR or any reading of scanned images as a supported path.
- Native mobile app; multi-language.

## Further Notes

### Milestones (each ticket names the one it moves toward)

| # | Milestone | Success test |
|---|---|---|
| 1 | Foundation | Repo standards in place; `initProject` builds the exact Sheet tabs and Drive tree |
| 2 | Intake and reading | A sample certificate uploaded through a link appears within 90 seconds as a PDF, a reading and a queued record; calibration gate passes |
| 3 | Checking and decisions | A clean certificate ends approved with the right emails; a $1M umbrella against $2M becomes a deficiency and the project manager is emailed with value, requirement and link |
| 4 | Screens | The manual protocol passes against the deployed URL |
| 5 | Automation | Reminders at 30 and 7 days; the payment hold list names an expired subcontractor; closeout builds the audit ZIP |
| 6 | Audit and handoff | "Which subcontractors on the sample project have an umbrella below $2M?" returns a correct, cited answer; handoff runbook written |

### Open items

- Confirm the model ID and the structured-output field names with the first real call.
- Confirm per-deployment access settings (see Access).
- The ACORD 25 form layout is believed to be licensed; sample certificates use our own layout. Unverified.
- Audit question-and-answer: build it only if a notebook can be pointed at the project's Drive folder by hand; otherwise label it a concept.

### Credit and anonymization

The original design was team work from earlier consulting; this build is the owner's. All names, projects and figures are fictional. No real client, call content, pricing or employer appears anywhere in the repo, the demo or commit messages.
