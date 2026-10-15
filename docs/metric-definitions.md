# Metric definitions

One entry per number that appears on a screen or the ROI page. A number with no entry here does not appear anywhere. Business words are defined in `GLOSSARY.md`; this file holds formulas only.

Shared rules:
- **Today** is the run date, in the script time zone.
- **Open records** are compliance records whose status is not `closed`.
- Every figure on screen shows its **source** (the Sheet tab) and its **last updated** time (the newest `last_updated` among the rows it counts).
- Code computes every figure. The model never does arithmetic.
- Sample data shows "Sample data" beside every figure.

## Compliance dashboard

The six dashboard counts are per project, then summed across active projects for the roll-up. `waiting_count` is a separate project-tile count. It is not included in the dashboard roll-up.

| Metric | Formula | Units | Window | Source columns |
|---|---|---|---|---|
| `expected_count` | Count of open records | records | as of today | `compliance_records.status` |
| `compliant_count` | Count of open records whose current certificate's check result is pass, or whose every deficiency is waived, and whose `expiration_date` is on or after today | records | as of today | `compliance_records.status`, `certificates.check_result`, `certificates.expiration_date` |
| `expired_count` | Count of open records whose current certificate's `expiration_date` is before today and which have no compliant renewal | records | as of today | `certificates.expiration_date`, `certificates.replaces_certificate_id` |
| `expiring_30d_count` | Count of open records whose current certificate's `expiration_date` is from today through today + 30 days inclusive, with no renewal received | records | today to today + 30 | `certificates.expiration_date` |
| `below_limits_count` | Count of open records whose latest certificate (the one in the review queue if any, otherwise the current one) has at least one limit deficiency that is not waived | records | as of today | `certificates.deficiencies`, activity log decisions |
| `waiting_count` | Count of open records on the active project whose loaded record has a nonempty `waitingLabel`. A pending certificate counts once, whether it awaits approval, a deficiency decision, a reading check or a resend. `portfolioView` computes this from the loaded records, not from stored status alone | records | as of today | `compliance_records.closed`, `compliance_records.queued_certificate_id`, `certificates.queue_stage`, `certificates.queue_reason`, `projects.status` |
| `dollars_on_hold_usd` | Sum of `amount_billed_usd` on pay applications in the current pay cycle for subs on payment hold. Each pay application counts once, even when the sub has two held records on the project | USD | current pay cycle | `pay_applications.amount_billed_usd`, `pay_applications.pay_cycle` |

Headline: "Compliant {compliant_count} of {expected_count} expected."

### Payment hold rule

At the pay-cycle check, a sub with a pay application in the current cycle is on payment hold when either is true:
1. Their compliance record is not compliant (awaiting, needs review, in review, or expired). In review covers a certificate waiting for approval or for a deficiency decision. Expiring soon counts as compliant and is never a hold reason (`docs/decisions.md`, Phase 1).
2. `w9_on_file` is false.

The payment hold list shows every held sub with each reason that applies.

### Project tile color

Evaluated in order; the first match wins.

| Color | Rule |
|---|---|
| Red | `expired_count` > 0, or any sub on payment hold |
| Yellow | `expiring_30d_count` > 0, or any record awaiting, in needs review, or with a certificate in the queue (waiting for approval or a deficiency decision); also any case the other two rows do not match |
| Green | `compliant_count` = `expected_count` and nothing above applies |

The tile also shows the color's word (On track, Watch, At risk) and the counts. Color is never the only signal.

## Data trust checks

The Data trust screen is hidden in the public demo (see `docs/decisions.md`, 2026-10-10). No link or route opens it. The numbers below are still calculated by `getTrustChecks` and the daily job. An owner reads them in the Sheet. The stored status check is the newest `activity_log` row with `event_type` `daily_check`. AI cost is the `ai_calls` tab. To see the screen on a local copy, add `'trust'` to `ORDER` and `trust:'Data trust'` to `NAV_LABEL` in `src/AppClient.html`. Do not deploy that change.

Each number is per subcontractor (`certificates_expected`, `certificates_received`, `certificate_gap`) or one result for the whole portfolio (`stored_status_check`). Closed records and projects that are not active are left out. Every number shows its source and last updated time.

| Metric | Formula | Units | Window | Source columns |
|---|---|---|---|---|
| `certificates_expected` | Count of the subcontractor's open records, across active projects | certificates | as of today | `compliance_records.sub_id`, `compliance_records.closed`, `compliance_records.project_id`, `projects.status`, `subcontractors.name` |
| `certificates_received` | Count of the subcontractor's open records that have a certificate in the review queue, or a current certificate whose `expiration_date` is on or after today. A record whose newest certificate is expired is not received. It is a gap, and its responsible person is named | certificates | as of today | `compliance_records.current_certificate_id`, `compliance_records.queued_certificate_id`, `certificates.expiration_date` |
| `certificate_gap` | `certificates_expected` − `certificates_received`. The responsible person is the accountant on the project of each record with no certificate (placeholder role "Accountant"; see `docs/decisions.md`, Phase 5) | certificates | as of today | `projects.accountant_name`, plus the columns above |
| `stored_status_check` | Stored status against the live dashboard. Recount `expected_count`, `compliant_count`, `expired_count` and `expiring_30d_count` from the stored `status` column of the `compliance_records` rows, and compare each with the figure the dashboard shows. The dashboard derives its figures live from the certificates. Also recount `dollars_on_hold_usd` (next row). Result is pass when every figure is equal, otherwise fail. Each mismatch names the count, the recounted value and the dashboard value. The run time is the Clock's now | pass or fail | as of the run | `compliance_records.status`, `compliance_records.closed`, `compliance_records.queued_certificate_id`, `compliance_records.last_updated`, `projects.status` |
| `dollars_on_hold_usd` check | Part of `stored_status_check`. Recount the sum of `amount_billed_usd` on `pay_applications` rows whose `pay_cycle` is the current pay cycle (the earliest pay date that is today or later), for each project and subcontractor that has an open record on an active project with `payment_hold` set. Each pay application row counts once. Compare with the `dollars_on_hold_usd` the dashboard shows | USD | current pay cycle | `pay_applications.amount_billed_usd`, `pay_applications.pay_cycle`, `compliance_records.payment_hold`, `compliance_records.closed`, `projects.status` |
| `daily_job_last_ran` | The `time` of the newest `activity_log` row with `event_type` `daily_check`. The daily job writes one such row per project when its pass finishes. Blank when the job has not run. The screen says "Daily job last finished", and "Not run yet" for a blank | time | as of the run | `activity_log.time`, `activity_log.event_type` |
| `certificates_expected_total` | Sum of `certificates_expected` over every subcontractor in the list. The screen says "Certificates owed" | certificates | as of today | the columns of `certificates_expected` |
| `certificates_received_total` | Sum of `certificates_received` over every subcontractor in the list. The screen says "Certificates received" | certificates | as of today | the columns of `certificates_received` |
| `subs_with_gap_count` | Count of subcontractors whose `certificate_gap` is 1 or more. The screen says "Subcontractors with a gap" and shows it on the "With a gap" tab | subcontractors | as of today | the columns of `certificate_gap` |
| `trust_subcontractor_count` | Count of subcontractors in the list: those with at least one open record on an active project. The screen shows it on the "All subcontractors" tab | subcontractors | as of today | `compliance_records.sub_id`, `compliance_records.closed`, `projects.status` |
| `trust_match_count` | Count of list rows after the tab filter ("With a gap" or "All subcontractors"). The screen shows it as the "of" figure in "Showing X of Y" | subcontractors | as of today | the columns of `trust_subcontractor_count` |
| `rows_shown_count` | Count of rows drawn in a list after paging, at most 25 per page. The screen shows it as the "X" in "Showing X of Y", on the directory, the hidden data trust list and any list that pages | rows | as of the view | none (a page count) |
| `ai_spend_month_usd` | Sum of `cost_usd` over `ai_calls` rows whose `time` falls in the calendar month of today, every `purpose`. `cost_usd` is computed by code when the row is written: `input_tokens` × input price + (`output_tokens` + `thinking_tokens`) × output price, from `MODEL_PRICES` in `src/Config.gs`. Rounded to a millionth of a dollar. Blank when any row in the window has a blank `cost_usd` (a model with no price row). The screen says "This month", and "price unknown" for a blank, never $0 | USD | this calendar month | `ai_calls.cost_usd`, `ai_calls.time` |
| `ai_calls_month` | Count of recorded `ai_calls` rows whose `time` falls in the calendar month of today, every `purpose`. It counts stored rows, not all attempted model requests. The screen says "Calls this month" | calls | this calendar month | `ai_calls.call_id`, `ai_calls.time` |
| `ai_cost_per_certificate_usd` | `ai_spend_month_usd` over the rows with `purpose` `read` only, divided by the count of those rows. One read is one certificate. Rounded to a millionth of a dollar. Blank when there is no read this month or any read row has a blank `cost_usd`. The screen says "Per certificate" | USD per certificate | this calendar month | `ai_calls.cost_usd`, `ai_calls.purpose`, `ai_calls.time` |

Screen words for the per-subcontractor numbers: "Owed" is `certificates_expected`, "Received" is `certificates_received`, "Gap" is `certificate_gap`. The "Responsible person" column is the role and name from `certificate_gap`. On the hidden data trust screen the check is called "Stored status check" (`stored_status_check`). In the result of `getTrustChecks` its key is `reconciliation`. The screen shows each mismatch as the count name, the dashboard figure and the recount, with no difference figure.

AI cost: the three `ai_*` figures sit in one strip on the hidden data trust screen, titled "AI cost". Its "Updated" time is the newest `time` on the `ai_calls` tab. In the result of `getTrustChecks` the key is `ai_cost`; it is null on a Sheet built before the `ai_calls` tab existed, and the strip is left out. In Share Proj the rows are seeded sample data, shaped from the cost model in `docs/research/c4-gemini-api-cost.md`, not measured.

These figures describe recorded usage, not a reconciled provider bill. Failed requests and failed row writes can leave no cost row. Draft calls with no returned usage add no row. During uploads and drafting, a metering write failure is logged without undoing the saved certificate or stopping the template fallback. A metering failure stops a calibration run.

The Reader substitutes zero-token usage for a rejected file with HTTP 400, and an empty usage object when a successful response omits usage metadata. Those responses can create zero-token rows. A zero-token row does not prove measured zero cost. Ticket 23 holds the live usage and measured-spend checks. The AI tab row meanings and keys are defined in `.scratch/coi/spec.md`.

Recount rules, from the stored `status` column: `compliant_count` counts `compliant` and `expiring_soon`; `expired_count` counts `expired`; `expiring_30d_count` counts `expiring_soon` with no certificate in the review queue; `expected_count` counts every open record.

What the check does and does not prove: the 6 AM daily job writes the stored `status` column. The check compares that stored column with the dashboard, which is live. It is not an independent recount from the certificates. A fail can appear between midnight and the daily run on a day a certificate crosses a date line, because the dashboard moves to the new day at midnight and the stored status does not move until the daily run. It clears after the daily run. A fail at any other time means the stored rows and the certificates disagree.

## Subcontractor directory

One row per subcontractor. Every figure shows "Sample data".

| Metric | Formula | Units | Window | Source columns |
|---|---|---|---|---|
| `subcontractor_count` | Count of rows on the `subcontractors` tab | subcontractors | as of today | `subcontractors.sub_id` |
| `directory_compliant_count` | Count of subcontractors whose shown status is Compliant or Expiring soon. Same rule as `compliant_count`. | subcontractors | as of today | `compliance_records.status`, `certificates.expiration_date` |
| `last_notification_sent` | For each subcontractor, the time and the glossary event name of the newest notice on its records. A notice is an `activity_log` row whose `event_type` is `notice_deficiency` (to the project manager), `notice_resend_request`, `notice_correction_request`, `notice_reminder_30d`, `notice_reminder_7d`, `notice_certificate_approved`, `notice_renewal_accepted` or `notice_duplicate`. A row logged before these types existed carries an older `event_type` and counts when its `summary` matches the old notice text. Blank when there is none. The screen shows "None sent" for a blank | time | all time | `activity_log.time`, `activity_log.event_type`, `activity_log.summary`, `activity_log.record_id`, `compliance_records.sub_id` |
| `directory_match_count` | Count of directory rows that match the search and the status and trade filters. The screen shows it as the "of" figure in "Showing X of Y" | subcontractors | as of today | the columns of `subcontractor_count` |

The directory's "Updated" time is the newest `last_updated` among all compliance records. The company detail page shows the same time. Its certificate list is the certificates on the subcontractor's records, each with the record that holds it. Its notification history is the notification log rows for that subcontractor (see Notification center). It shows no count.

Row fields:
- **Status** is the worst status across the subcontractor's open compliance records, from the same status code as the worklist. Worst first: expired, then needs review and in review, awaiting, expiring soon, compliant. A subcontractor with only closed records shows Closed.
- **Certificates** are the IDs of every certificate on the subcontractor's records.
- **Last notification** is the newest `activity_log` entry on those records whose summary is a reminder, a follow-up, a resend request, a correction request or a deficiency notice sent to the project manager. It is blank when there is none.

## Notification center

A read-only preview of the automatic emails. Nothing sends, and every figure shows "Sample data". The rows come from `getNotifications` (ticket 19). The screen shows only the counts below.

| Metric | Formula | Units | Window | Source columns |
|---|---|---|---|---|
| `notification_count` | Count of notification rows returned. The screen shows it in the page header and under the list as "N emails" after the filters | emails | all time | the notification rows (`id`) |
| `notification_status_count` | Count of notification rows with a given `status` (Sent, Waiting for approval, Not sent). The "All" tab counts every row. The tabs show these counts | emails | all time | the notification rows (`status`) |

The event filter shows no counts. The step track (Triggered, Approval, Sent) shows times and names from one row, not counts.

## ROI page

Every input has low, likely and high values, and a basis: `sourced: <where>` or `estimate: <reasoning>`. The page refuses to show any line whose inputs lack a value or a basis, and says which input is missing.

The page leads with the likely case, shows low and high beside it, and calls out the low case's net value as the floor.

| Metric | Formula | Units | Window |
|---|---|---|---|
| `hours_saved_value_usd` | ((`min_per_cert_today` − `min_per_cert_tool`) × `certs_per_year` + (`monthly_check_min_today` − `monthly_check_min_tool`) × 12 × `projects`) ÷ 60 × `hourly_rate_usd` | USD | per year |
| `lapse_risk_avoided_usd` | `lapses_paid_per_year` × `cost_per_incident_usd` × `catch_rate` | USD | per year |
| `audit_prep_saved_usd` | (`hours_per_audit_today` − `hours_per_audit_tool`) × `audits_per_year` × `hourly_rate_usd` | USD | per year |
| `api_cost_usd` | `api_cost_per_year_usd` | USD | per year |
| `upkeep_cost_usd` | `upkeep_hours_per_month` × 12 × `hourly_rate_usd` | USD | per year |
| `running_cost_usd` | `api_cost_per_year_usd` + `upkeep_hours_per_month` × 12 × `hourly_rate_usd` | USD | per year |
| `net_value_usd` | `hours_saved_value_usd` + `lapse_risk_avoided_usd` + `audit_prep_saved_usd` − `running_cost_usd` | USD | per year |

### Scenario values

Low, likely and high label net-value scenarios.
They do not label each cost from cheapest to most costly.

| Input group | Low net value | Likely net value | High net value |
|---|---|---|---|
| Time today and lapse benefit inputs | Low input value | Likely input value | High input value |
| Time with the tool, reading spend and upkeep hours | High input value | Likely input value | Low input value |
| Certificate volume, projects and audit count | The count that gives the lower net value | Likely input value | The count that gives the higher net value |
| Staff cost per hour | The rate that gives the lower net value | Likely input value | The rate that gives the higher net value |

Each scenario uses one staff rate for time saved, audit prep and upkeep.
Code chooses that rate from the sign of annual hours saved after upkeep.
If those hours are positive, the low scenario uses the low rate.
If those hours are negative, the low scenario uses the high rate.
The high scenario uses the reverse rule.
Code also checks the sign of time saved before each volume multiplier.
If time saved is negative, the low scenario uses the higher volume.
The supplied inputs give positive time savings in every scenario.

The low scenario uses each input at its least favourable value.
The displayed cost lines use that same net-value scenario.
For example, high upkeep hours appear in the low net-value column.

Every input requires three finite, nonnegative values in ascending order.
Catch rate cannot exceed 1.
An absent value or basis suppresses the affected line.
A placeholder basis also suppresses the affected line.

### Inputs with a known source

| Input | Low | Likely | High | Basis |
|---|---|---|---|---|
| `api_cost_per_year_usd` | 0.27 | 0.53 | 1.33 | sourced: `docs/research/c4-gemini-api-cost.md` |
| `projects` | 4 | 4 | 4 | sourced: design notes (anonymized): 4 concurrent projects |
| `certs_per_year` | 140 | 280 | 700 | sourced: design notes and c4 volume cases (35 per project; resubmissions and renewals; scale ceiling) |

All other inputs are set in the ROI ticket, each with `estimate: <reasoning>`.
