# Milestone 4: Screens

Status: in progress. The local build passes. Live deployment checks remain open.

## Tickets

08b Worklist, record detail, holds and upload redesign.
09 Project tiles and compliance dashboard.
10 ROI page.
12 Demo seed and screen protocol.

## What was built

- Drafting is the adopted design. Shared styles serve all seven screens.
- Internal navigation reaches projects, compliance, worklist, records, holds and ROI.
- Corrections require a note in the backend. History records the old value, new value, person and note.
- Corrections work for any readable queued certificate, including Brightway's 96% misread.
- Rejection text names the value found and the value required for every deficiency.
- Portfolio views cache Sheet reads within each request.
- Dashboard hold totals open the hold list for all active projects.
- Review mode changes name the person and keep queued certificates waiting.
- ROI code calculates the likely case and the floor. Missing inputs suppress affected figures.
- Four fictional projects contain 140 records. Maple Court has 32 of 35 compliant, one expired policy and $6,250 held.
- The local walkthrough uses the deployed templates and the same backend functions with fake adapters.

## Evidence the success test passed

The local checks ran on 2026-10-08.
The full Node suite passes 226 tests.
The browser check passes 48 checks with no JavaScript page errors.
Browser evidence is in docs/design/refined/app/review-results.json.
Screenshots are in docs/design/refined/app/screenshots/.
The browser check covers 1440, 958 and 375 pixel widths.

The reviewed 26-file source was published to Google on 2026-10-08.
The internal deployment is version 15.
The public upload deployment is version 16.
The existing deployment URLs and access settings stayed the same.
The Google seed created four projects and 140 records in a new Sheet.
The previous Sheet remains intact.
No Git commit or Git push occurred.

The live project figures, record PDF, correction history, ROI figures and expired payment hold passed.
The live upload form also passed at 375 pixels without horizontal overflow.
Live evidence is in docs/design/refined/app/live-review-results.json.
The complete live success test remains open.

## Panel result

The milestone 4 panel ran against the local app on 2026-10-08.
All three reviewers returned Pass after the fixes.

| Reviewer | Result | Evidence |
|---|---|---|
| UX | Pass | Upload progress, readable PDF expansion, tile counts and phone layouts |
| CFO | Pass | Tile counts, readable ROI inputs, percentage formatting and visible sources |
| Data | Pass | Confidence threshold, person confirmation, row definitions and ROI scenarios |

The live Google protocol remains open.
The local panel does not prove real upload duration, timers or email delivery.
The live correction check separately passed against Google storage.

## Open items

Ticket 12 remains open for the deployed protocol.
The seed uses fictional email addresses.
Set the demo recipients to the owner inbox before the email checks.
The live correction check passed and ticket 05 is done.

1. Open the deployed project tiles.
2. Upload a clean sample PDF.
3. Check approval within 90 seconds.
4. Open the compliance record.
5. Check the saved values, per-field results and approval email.
6. Upload a sample with a $1M umbrella.
7. Check $1M found against $2M required.
8. Check the project manager's email.
9. Complete Brightway's correction and approval.
10. Check that the queue clears.
11. Check that the expired record appears on the payment hold list.
12. Check the live upload page at 375 pixels.

Use a fresh sample project without an expired policy for the yellow-tile deficiency check.
Maple Court already has an expired policy and is correctly At risk.
