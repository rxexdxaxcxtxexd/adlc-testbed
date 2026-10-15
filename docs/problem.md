# The problem: proving every subcontractor is insured

All figures here are illustrative and come from fictional sample data. Each number names its input in `docs/roi-inputs.json` (shown as `input_name`) or a cited file. Nothing here is measured from a real firm.

## The user

A small construction firm needs a current certificate of insurance (a one-page document from an insurer that lists a subcontractor's coverage and limits) from every subcontractor on every project. The firm must hold it before work starts and before each payment (`.scratch/coi/spec.md`, Problem Statement).

Four roles touch the work (`GLOSSARY.md`):

- The accountant works the review queue for a project and confirms who can be paid.
- The project manager decides on a deficiency (a requirement a certificate fails) in the context of the subcontractor's work.
- Leadership sets the project requirements and the review mode, and decides escalated deficiencies.
- The subcontractor sends the certificate.

The accountant feels the pain most. The model sample has one accountant per project (`.scratch/coi/spec.md`).

## How often it happens

| What happens | How often | Input (low / likely / high) | Source |
|---|---|---|---|
| Certificates to read and file | per year | 140 / 280 / 700 (`certs_per_year`) | Design notes and `docs/research/c4-gemini-api-cost.md`: 35 per project, then renewals and resubmissions, then a scale ceiling |
| Concurrent projects | at any time | 4 / 4 / 4 (`projects`) | Design notes, anonymized |
| Pre-payment record check | every month, on each project | 12 checks a year for each of 4 projects, so 48 a year | `docs/metric-definitions.md`, `hours_saved_value_usd` formula |
| Requests for a project insurance record (an audit) | per year | 1 / 2 / 3 (`audits_per_year`) | Estimate in `docs/roi-inputs.json` |

The spec adds that the number of projects is doubling with the same staff. It gives no new project count, so that figure is not yet known. The firm's own plan would supply it.

## What it costs

Each line below is today's effort or risk, before the tool. The likely case is shown first.

| Cost | Likely figure | Input and source |
|---|---|---|
| Reading, comparing and filing one certificate by hand | 20 minutes (range 15 to 25) | `min_per_cert_today`, estimate |
| Searching records for lapses, renewals and missing W-9 forms (the tax form a subcontractor must file before payment) before a pay run | 45 minutes per project per month (range 30 to 60) | `monthly_check_min_today`, estimate |
| Gathering one audit package from separate folders, emails and payment records | 8 hours (range 4 to 12) | `hours_per_audit_today`, estimate |
| A payment made during a coverage lapse | 1 lapse a year (range 0 to 2) at $1,500 each (range $500 to $3,000) | `lapses_paid_per_year` and `cost_per_incident_usd`, estimates. The cost covers time and money to resolve the payment. It excludes insured losses |
| Staff cost per hour | $40 (range $30 to $50) | `hourly_rate_usd`, estimate: an illustrative fully loaded rate to replace with the firm's own |

The spec also says a missed date has already caused a real problem once. That is the reason for the lapse lines. The spec gives no cost for that event, so the dollar figure above is an estimate.

Leadership also has no single view of whether every subcontractor across every project is covered (`.scratch/coi/spec.md`). That cost has no figure and is not yet known. A measured count of surprise lapses found late would supply it.

## The workaround today

The work is slow, repetitive and easy to get wrong on the one day it matters most, the day before checks go out (`.scratch/coi/spec.md`). The steps are:

1. Certificates arrive by email.
2. The accountant compares each one with the project requirements.
3. The accountant logs the expiry date in a spreadsheet.
4. Each month, before the pay run, the accountant scans the spreadsheet for lapses.
5. The accountant writes near-identical reminder emails to subcontractors whose policies are about to lapse.

Nothing tells a subcontractor that a certificate passed. The old date-reminder spreadsheet missed reminders (`docs/decisions.md`, settled before Phase 0).

## Success measures

The tool succeeds if it meets these checks. Each comes from a written test or definition.

| Measure | Target | Source |
|---|---|---|
| Time from upload to a queued record | A sample certificate uploaded through a link appears within 90 seconds as a PDF, a reading and a queued record | `.scratch/coi/spec.md`, milestone 2 |
| Reading accuracy on sample files | Every value read matches the manifest, with confidence of at least 0.85. The last calibration passed 8 of 8 samples | `.scratch/coi/spec.md`; `docs/decisions.md`, Phase 2 |
| A low-confidence reading never approves itself | A reading below 0.85 goes to the accountant in every review mode | `docs/decisions.md`, Phase 0 |
| A short limit is caught | A $1M umbrella against a $2M requirement becomes a deficiency, and the project manager gets an email with the value, the requirement and a link | `.scratch/coi/spec.md`, milestone 3 |
| Payment hold list is right | The list names each expired subcontractor and each subcontractor with no W-9, with every reason | `docs/metric-definitions.md`, payment hold rule |
| Audit prep is fast | Hours per audit fall from 8 to 2 in the likely case (range 4 to 12 down to 1 to 3) | `hours_per_audit_today` and `hours_per_audit_tool`, estimates |
| Time per certificate falls | From 20 minutes to 5 in the likely case | `min_per_cert_today` and `min_per_cert_tool`, estimates |
| Every number on screen can be traced | Each figure shows its source and last updated time | `docs/metric-definitions.md` |

The two "falls from" rows are estimates, not measurements. A timed sample of real work would replace them. The dollar value of these gains is in `docs/roi.md`.
