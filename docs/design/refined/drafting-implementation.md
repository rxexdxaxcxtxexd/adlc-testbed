# Drafting implementation

The user selected Drafting on 2026-10-08 and approved the app build.

The app keeps the navy frames, square controls, engineering grid and record title block.
Coverage amounts use larger text.
Source and update text sits beside each figure.
The decision and W-9 share one column without an empty gap.

## Design to code

| Design | Code | Purpose |
|---|---|---|
| Drafting direction | src/Styles.html | Shared colors, fonts, spacing, frames, focus and motion |
| Shared tokens | docs/design/refined/styles.css | The same CSS without the Apps Script wrapper |
| Internal screens | src/Worklist.html, src/AppClient.html | Navigation, projects, dashboard, worklist, detail, holds and ROI |
| Upload screen | src/UploadPage.html | PDF intake on a phone |
| Record checks | src/Evaluate.gs, src/Lifecycle.gs | Compare requirements and apply review decisions |
| Screen data | src/Portfolio.gs, src/Review.gs, src/PaymentHold.gs | Return values, sources, update times and history |
| ROI inputs | docs/roi-inputs.json, src/Roi.gs | Calculate annual value from visible inputs |
| Local walkthrough | scripts/build-preview.js, scripts/preview-adapter.js | Use the deployed templates and the same backend functions with fake adapters |

No design runtime or copied design-tool markup is required.
The frontend uses google.script.run in Google Apps Script.
The local preview uses the same backend functions with fake storage, mail and calendar adapters.
The local preview resets on reload.
The local preview sends no email.

## Review the app

1. Open docs/design/refined/app/index.html.
2. Select Projects.
3. Select Start walkthrough.
4. Complete the seven steps.

Open docs/design/refined/app/upload.html to check PDF intake.
Open docs/design/refined/app/components.html to check component states.
The component page links to loading, empty, error and missing-input states.

## Build and check

1. Run node scripts/sync-roi.js.
2. Run node scripts/build-preview.js.
3. Run node --test.
4. Run python scripts/review-app.py.

The Python check requires Playwright and the Chromium path in the script.
The browser check saves screenshots and a JSON result under docs/design/refined/app/.
Check 1440, 958 and 375 pixel widths.
The check covers PDF rendering, roles, notes, corrections, approval, waiver, rejection, review mode, W-9 and uploads.

## Local evidence

The full Node suite passes 226 tests.
The browser check passes 48 checks with no JavaScript page errors.
Screenshots cover 1440, 958 and 375 pixel widths.
The milestone 4 UX, CFO and data reviewers all returned Pass after fixes.

Upload progress shows the reading result and a resend action for unreadable PDFs.
The expanded PDF shows the certificate beside the checked values.
Project tiles show renewal and coverage shortfall counts.
A person check shows Confirmed instead of an AI confidence percentage.
A confidence below 0.85 never displays as 85%.

## Google deployment

The Google connection and deployment completed on 2026-10-08.
The internal app is version 15.
The public upload app is version 16.
The existing deployment URLs and access settings stayed the same.
The four-project seed ran in Google.
The original Sheet remains intact.

The live figures, Drive PDF and correction history passed.
The complete upload, timer and email protocol remains open.
The steps below describe a future deployment.

1. Push the reviewed source with clasp push from coi-poc/.
2. Open the Apps Script editor.
3. Run setupPortfolioDemo once.
4. Update the existing internal and upload deployments.
5. Check the Script Properties for both deployment addresses.
6. Open the internal app.
7. Run the live protocol in docs/milestones/4-screens.md.

setupPortfolioDemo creates a new Sheet with four fictional projects and 140 compliance records.
The previous Sheet remains intact.
PREVIOUS_DEMO_SHEET_ID stores the previous Sheet ID.
The function sends no email and creates no calendar events.
The seed writes Sheet rows in batches.
The seed attaches PDFs for the planted problems.
Other sample PDFs are created when first opened.
The seed refuses a data store that already has projects or compliance records.

The live protocol still needs Google storage, timers, PDF access and email checks.
The local preview cannot measure the real upload completion time.
The existing audit and handoff tickets remain outside this screen build.
