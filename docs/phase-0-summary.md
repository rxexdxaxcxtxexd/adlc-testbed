# Phase 0 summary: certificate compliance proof of concept

Date: 2026-10-07. Status: Phase 0 complete; tickets approved; no app code written.

## What we are building

A Google Workspace tool that reads subcontractors' certificates of insurance with AI, checks them against the project requirements in code, and leaves every decision that matters with a person. It tracks expiry, sends reminders, and lists who must not be paid before each pay cycle. Readers of the result: a non-technical CFO (ROI, polish) and a data manager (trust in the numbers). All data is fictional.

## What Phase 0 produced

| Output | Where |
|---|---|
| Glossary, 24 terms | `GLOSSARY.md` |
| Decisions log | `docs/decisions.md` |
| Metric definitions (dashboard, payment hold, tile, ROI) | `docs/metric-definitions.md` |
| Sample tolerance matrix | `docs/tolerance-matrix.json` |
| Six cited research files | `docs/research/` |
| Logic prototype and verdict | branch `prototype/coi-lifecycle`; verdict in `docs/decisions.md` |
| Spec, 52 user stories | `.scratch/coi/spec.md` |
| 13 tickets | `.scratch/coi/issues/` |

## Key decisions

- **A person approves what matters.** Each project has a review mode; new projects review everything. Readings below 0.85 confidence always go to the accountant.
- **Intake is a public upload page** with a unique link per subcontractor, because a Google Form forces a sign-in.
- **Both web apps run as the owner.** A "Demo only" role switcher shows each person's view.
- **Gemini reads the PDF directly** (inline), model `gemini-3.5-flash-lite` on the free tier. AI cost is under $2 a year.
- **Status is computed** from the certificate, the queue and the date. **Payment hold is a flag** with reasons that lifts itself.
- **Hosted on a new free Google account.** Scale and edge-case hardening are out of scope.

## Ticket order and milestones

| Milestone | Tickets |
|---|---|
| 1 Foundation | 01 Repo standards; 02 One certificate, end to end |
| 2 Intake and reading | 03 Real reading and calibration; 04 Public upload page |
| 3 Checking and decisions | 05 Review queue and approval; 06 Deficiency path |
| 4 Screens | 09 Tiles and dashboard; 10 ROI page; 12 Demo seed and protocol |
| 5 Automation | 07 Renewals and reminders; 08 Payment hold; 11 Closeout and audit package |
| 6 Audit and handoff | 13 Audit questions and handoff |

Retros after 02, 04 and 13.

## Open items

- Confirm whether one script project can carry two deployments with different access (ticket 02).
- Confirm the model ID and structured-output field names with the first real call (ticket 03).
- The real ACORD 25 layout is believed to be licensed; samples use our own layout (unverified).
- Audit questions may end as a labelled concept if a notebook cannot be pointed at a Drive folder.
- Owner steps: create the free Google account, the script project and the Gemini key (guided by the ticket 02 wizard).
