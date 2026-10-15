# Calibration report: ticket 03

Date: 2026-10-07. Model: `gemini-3.5-flash-lite`. Structured-output field: `responseJsonSchema`. Samples: `test-fixtures/sample-cois/`, compared with `manifest.json` by `runCalibration()`.

## Run 1: 5 of 8 pass

Three samples failed on one field. The model returned `insured_name` with the street address line after the name. The prompt asked for "the name printed under Insured", and the Insured box has two lines. Every other value matched.

| Sample | Result | Failing field |
|---|---|---|
| 01-clean | pass, 0.99 | |
| 02-clean-earthwork | fail, 0.95 | `insured_name` read as "Birchwood Earthworks Inc." plus "2200 Millrace Drive, Fairview" |
| 03-expired | pass, 0.95 | |
| 04-low-limit | pass, 0.95 | |
| 05-wrong-insured | fail, 0.99 | `insured_name` read with the address line |
| 06-no-additional-insured | fail, 0.99 | `insured_name` read with the address line |
| 07-corrupt | pass | unreadable, HTTP 400 |
| 08-not-a-pdf | pass | unreadable, HTTP 400 |

Prompt change in `src/Extract.gs`, from

> insured_name: the name printed under Insured, exactly as shown.

to

> insured_name: the insured's name only, exactly as shown. Use the first line under Insured. Leave out the street address and every other line of the Insured box.

## Run 2: 8 of 8 pass (after the prompt change)

Every readable sample: all 13 fields match the manifest and confidence is at least 0.95 (gate 0.85). Both unreadable samples return an unreadable result with a reason and no values.

| Sample | Planted problem | Result | Confidence |
|---|---|---|---|
| 01-clean.pdf | none | PASS | 0.99 |
| 02-clean-earthwork.pdf | none (second insured, professional liability listed) | PASS | 1 |
| 03-expired.pdf | expired policy | PASS | 0.99 |
| 04-low-limit.pdf | limit below requirement | PASS | 0.95 |
| 05-wrong-insured.pdf | wrong insured name | PASS | 1 |
| 06-no-additional-insured.pdf | missing additional insured endorsement | PASS | 0.99 |
| 07-corrupt.pdf | corrupt file | PASS | unreadable: The model service rejected the file (HTTP 400). |
| 08-not-a-pdf.pdf | not a PDF | PASS | unreadable: The model service rejected the file (HTTP 400). |

### Field-by-field log, run 2

Every readable sample had the same manifest values as the table below, except where listed. Each row read back identically (pass).

| Field | 01 clean | 02 earthwork | 03 expired | 04 low limit | 05 wrong insured | 06 no addl insured |
|---|---|---|---|---|---|---|
| insured_name | Ridgeline Roofing LLC | Birchwood Earthworks Inc. | Ridgeline Roofing LLC | Ridgeline Roofing LLC | Ridgeline Roofing Partners LLC | Ridgeline Roofing LLC |
| limits.commercial_liability | 1000000 | 2000000 | 1000000 | 500000 | 1000000 | 1000000 |
| limits.aggregate | 2000000 | 4000000 | 2000000 | 1000000 | 2000000 | 2000000 |
| limits.auto | 1000000 | 1000000 | 1000000 | 1000000 | 1000000 | 1000000 |
| limits.umbrella | 2000000 | 5000000 | 2000000 | 2000000 | 2000000 | 2000000 |
| limits.workers_comp | 1000000 | 1000000 | 1000000 | 1000000 | 1000000 | 1000000 |
| limits.pollution_liability | 1000000 | 2000000 | 1000000 | 1000000 | 1000000 | 1000000 |
| limits.professional_liability | null | 1000000 | null | null | null | null |
| additional_insured_endorsement | true | true | true | true | true | false |
| project_address | true | true | true | true | true | true |
| certificate_holder | true | true | true | true | true | true |
| cancellation_notice_days | 30 | 30 | 30 | 45 | 30 | 30 |
| expiration_date | 2027-09-30 | 2028-01-15 | 2025-03-31 | 2027-06-30 | 2027-09-30 | 2027-03-31 |

Total: 8 of 8 samples pass.
