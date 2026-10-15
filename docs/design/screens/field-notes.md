# Field notes (brief §11 item 5)

For each element on each screen, the data that fills it. Column names are from `src/Schema.gs`. Metric names are from `docs/metric-definitions.md` (§7). Words in quotes are the §5 vocabulary.

Conventions:
- `table.column` is a Sheet column. `→` means "derived by code from".
- "Current certificate" is `compliance_records.current_certificate_id`. "Queued certificate" is `compliance_records.queued_certificate_id`. "Latest certificate" is the queued one if there is one, otherwise the current one (as §7 `below_limits_count` defines it).
- **Updated** on any figure is the newest `last_updated` among the rows it counts (metric-definitions shared rules).
- **Gap** marks an element with no column behind it yet. Each gap is listed again at the end.

## 6.8 Shared chrome (`Chrome.dc.html`)

| Element | Field |
|---|---|
| App name "Certificate compliance" | Fixed text |
| Firm name "Harborline Builders" | Fixed text (sample firm). Gap if it must come from the Sheet: no firm column |
| "Sample data · all names fictional" | Fixed. Shown while the Sheet is the sample (`DRIVE_ROOT` = "COI Compliance (Sample data)") |
| "Demo only" switcher | URL parameter `as` (accountant, project_manager, leadership). Not a permission |
| Navigation tabs | Fixed list. Active tab is the current view |

## 6.1 Project tiles (`Tiles.dc.html`)

| Element | Field |
|---|---|
| Hold summary amount (all projects) | Sum of `dollars_on_hold_usd` across active projects |
| Hold summary "Pay date" | `pay_applications.pay_cycle` of the current cycle |
| Hold summary source / updated | Pay applications · time of the pay-cycle check. Gap: no column stores the run time of the check |
| One tile per project | `projects` rows where `projects.status` is active |
| Tile color and word ("On track", "Watch", "At risk") and shape | §7 tile color rule, first match wins |
| Project name | `projects.name` |
| "Compliant X of Y expected" | `compliant_count` of `expected_count`, per project |
| Expired | `expired_count`, per project. Red only when above 0 |
| Expiring within 30 days | `expiring_30d_count`, per project |
| Below required limits | `below_limits_count`, per project |
| On hold this pay cycle | `dollars_on_hold_usd`, per project |
| Tile source line | Compliance records, Pay applications · newest `compliance_records.last_updated` |
| Tile click | Opens the worklist with `projects.project_id` |
| Empty state | No active `projects` rows |

## 6.2 Compliance dashboard (`Dashboard.dc.html`)

| Element | Field |
|---|---|
| "Compliant X of Y expected" (all active projects) | `compliant_count` of `expected_count`, summed across projects |
| Expired card | `expired_count`, summed |
| Expiring within 30 days card | `expiring_30d_count`, summed |
| Below required limits card | `below_limits_count`, summed |
| Dollars on hold card | `dollars_on_hold_usd`, summed. Pay date: `pay_applications.pay_cycle` |
| Card source | The source columns in metric-definitions for that metric, as tab names |
| "Records behind" rows | The records counted by the selected metric |
| Row: subcontractor, ID | `subcontractors.name`, `compliance_records.record_id` |
| Row: project | `projects.name` |
| Row: status pill | `compliance_records.status` as a §5 record status word |
| Row: "Why it counts", expired / expiring | `certificates.expiration_date` of the current certificate, and "No renewal received" from `certificates.replaces_certificate_id` |
| Row: "Why it counts", below limits | `certificates.deficiencies` of the latest certificate (limit kind, not waived) and the §5 waiting-for words |
| Row: "Why it counts", hold | `pay_applications.amount_billed_usd` and `compliance_records.payment_hold_reasons` |

## 6.3 Project worklist (`Worklist.dc.html`)

| Element | Field |
|---|---|
| Project picker, name, ID | `projects.name`, `projects.project_id` |
| "Compliant X of Y expected" | `compliant_count` of `expected_count` for this project |
| Review mode control ("Review all", "Review deficiencies", "Automatic") | `projects.review_mode` |
| "Set by Elena Park (Leadership), Sep 2" | Gap: the activity log is keyed by `record_id`, so a project-level change has nowhere to go. Name today would come from `projects.leadership_name` |
| "Needs you" rows | Records whose waiting-for item belongs to the current role (accountant: "Waiting for approval", "Needs review", "Unreadable file"; project manager and leadership: "Waiting for a decision on a deficiency") |
| Subcontractor name, scope | `subcontractors.name`, `subcontractors.scope_of_work` |
| Record ID | `compliance_records.record_id` |
| Status pill | `compliance_records.status` |
| On payment hold flag and reasons | `compliance_records.payment_hold`, `compliance_records.payment_hold_reasons` |
| Waiting for | → queued certificate `certificates.queue_stage` and `certificates.queue_reason`, as §5 waiting-for words. Confirm the mapping when wiring |
| Expires | `certificates.expiration_date` of the current certificate. "None on file" when there is no current certificate |
| Last action | Newest `activity_log` row for the record: `who`, `summary`, `time` |

## 6.4 Compliance record detail (`RecordDetail.dc.html`)

| Element | Field |
|---|---|
| Back link "Worklist: {project}" | `projects.name` |
| Subcontractor name, scope, project, ID | `subcontractors.name`, `subcontractors.scope_of_work`, `projects.name`, `compliance_records.record_id` |
| Status pill | `compliance_records.status` |
| Waiting for | As in the worklist |
| On payment hold, reasons | `compliance_records.payment_hold`, `compliance_records.payment_hold_reasons` |
| Expires | `certificates.expiration_date` |
| Policy period | Gap: there is no effective (start) date column. Only `expiration_date` exists |
| "Current certificate expires" / "Renewal policy period" (renewal case) | `expiration_date` of the current certificate and of the queued one (`replaces_certificate_id` set) |
| Header source / updated | Compliance records · `compliance_records.last_updated` |
| Certificate PDF pages | `certificates.pdf_link`, drawn with pdf.js |
| "Uploaded … by … (Subcontractor)" | `certificates.received_date`, `subcontractors.name` |
| "Open the original file (owner only)" | `certificates.pdf_link` |
| Unreadable file | Queued certificate with `queue_reason` = unreadable and no values |
| Next step panel | Role from `as`, plus the waiting-for item |
| Approve | Writes `certificates.decision`, an `activity_log` row, and the approval email |
| Correct a value | Edits the `certificates` value columns below, then reruns the check |
| "Please resend" draft: To, subject, body | `subcontractors.email`; fixed text from the code; upload link from `compliance_records.upload_token` |
| Deficiency list | `certificates.deficiencies` (text as written by `evaluateCoi`) |
| Waiver note | `certificates.decision_note` |
| "What Reject sends" | `correctionText(deficiencies, link)` in `src/Lifecycle.gs` |
| Reading confidence and the 85% line | `certificates.confidence`. The 85% line is fixed |
| "Fails: …" / "Pass" / "Waived" summary | `certificates.check_result`, `certificates.deficiencies`, waivers in `decision` |
| General liability | `certificates.commercial_liability_usd` |
| Aggregate | `certificates.aggregate_usd` |
| Auto | `certificates.auto_usd` |
| Umbrella | `certificates.umbrella_usd` |
| Workers' comp | `certificates.workers_comp_usd` |
| Pollution (roofing and earthwork only) | `certificates.pollution_liability_usd` |
| Additional insured endorsement | `certificates.additional_insured_endorsement` |
| Project address | `certificates.project_address` |
| Certificate holder | `certificates.certificate_holder` |
| Insured name, "Matches" / "Does not match", both names underneath | `certificates.insured_name` against `subcontractors.name` |
| Cancellation notice | `certificates.cancellation_notice_days` |
| "Required" column | `docs/tolerance-matrix.json` (`TOLERANCE_MATRIX`). The values card source reads "Certificates, Projects"; the requirements are not a Sheet tab. Confirm the source wording |
| Values card updated | `compliance_records.last_updated` |
| W-9 card | `compliance_records.w9_on_file` |
| Timeline rows: date, person, summary | `activity_log.time`, `activity_log.who`, `activity_log.summary` |
| Timeline marker (decision, correction, system) | `activity_log.event_type` |
| Correction "old → new" | Gap: `activity_log` has no old or new value columns. Either the summary carries both, or the tab needs two columns |
| Waiver note in the timeline | `certificates.decision_note` |

Not shown on screen: `certificates.professional_liability_usd`. The sample requirements do not ask for it.

## 6.5 Payment hold list (`HoldList.dc.html`)

| Element | Field |
|---|---|
| Project picker, name, ID | `projects.name`, `projects.project_id` |
| Pay date of the current cycle | `pay_applications.pay_cycle` |
| Total dollars on hold | `dollars_on_hold_usd` for this project |
| Source / updated | Pay applications, Compliance records · time of the pay-cycle check (same gap as the tiles) |
| Rows | Subs with a `pay_applications` row in the current cycle and `compliance_records.payment_hold` true |
| Subcontractor, ID | `subcontractors.name`, `compliance_records.record_id` |
| Status | `compliance_records.status` |
| Billed this cycle | `pay_applications.amount_billed_usd` |
| Every reason | `compliance_records.payment_hold_reasons`, as §5 hold reasons |
| Total row | Same as the total above |
| Empty: no one held | No held rows in the cycle |
| Empty: no current pay cycle | No `pay_applications.pay_cycle` from today on |

## 6.6 Return on investment (`ROI.dc.html`)

| Element | Field |
|---|---|
| Likely net value per year; low and high | `net_value_usd` (likely, low, high) |
| "The floor" | `net_value_usd`, low case |
| Hours saved line | `hours_saved_value_usd` |
| Lapse risk avoided line | `lapse_risk_avoided_usd` |
| Audit prep saved line | `audit_prep_saved_usd` |
| Running cost line | `running_cost_usd` |
| Net value line | `net_value_usd` |
| Each input row: low, likely, high, basis | The ROI inputs by name (`min_per_cert_today`, `min_per_cert_tool`, `certs_per_year`, `monthly_check_min_today`, `monthly_check_min_tool`, `projects`, `hourly_rate_usd`, `lapses_paid_per_year`, `cost_per_incident_usd`, `catch_rate`, `hours_per_audit_today`, `hours_per_audit_tool`, `audits_per_year`, `api_cost_per_year_usd`, `upkeep_hours_per_month`) |
| "Not shown" and the missing input | Any input with no value or no basis |
| Source "ROI inputs" / updated | Gap: there is no ROI inputs tab in `SCHEMA` yet. It arrives with the ROI ticket |

## 6.7 Upload page (`UploadPage.dc.html`)

| Element | Field |
|---|---|
| Firm name | Fixed text (same as the chrome) |
| "Sample data" | Fixed, as in the chrome |
| From | `subcontractors.name`, found through `compliance_records.upload_token` |
| Project | `projects.name`, through the same record |
| Chosen file name and size | The browser file. Stored as `uploads.file_name` |
| Sending | The upload call in progress |
| Sent | A new `uploads` row |
| Not a PDF / too big | Checked in the browser and again in `src/Upload.gs` (PDF only, 5 MB) |
| Duplicate | `uploads.file_fingerprint` (or `certificates.file_fingerprint`) already on this record |
| Link not active | No record for the token, or `compliance_records.closed` true |

## Gaps to settle before wiring

All seven were settled on 2026-10-08. See `docs/decisions.md`, Phase 4. Where a decision changes an element above (gaps 1 to 6), the decision row wins.

1. **Policy effective date.** The record header shows a policy period. Only `certificates.expiration_date` exists. Add an effective date column or show "Expires" only.
2. **Correction old → new.** `activity_log` has no old or new value columns.
3. **Project-level events.** `activity_log` is keyed by `record_id`, so "review mode set by" has nowhere to go.
4. **Pay-cycle check time.** The hold list, tiles and dashboard show "Updated … (pay-cycle check)". No column stores when the check ran.
5. **ROI inputs tab.** Not in `SCHEMA` yet.
6. **Requirements source.** Required values come from `docs/tolerance-matrix.json`, but the values card says "Source: Certificates, Projects".
7. **Waiting-for mapping.** `queue_stage` and `queue_reason` need a stated mapping to the four §5 waiting-for words.
