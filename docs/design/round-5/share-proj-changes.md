# Round 5: Share Proj matches Demo Proj

Hard rules: AI reads, routes and drafts; code calculates and decides; a person approves what matters; fictional names; "Sample data" on every screen; Share Proj never writes, sends, reads with Gemini or sets a timer.

Section 6 decision: **Option B (owner, 2026-10-10).** No Share Proj notice anywhere. Share Proj looks identical to Demo Proj; "Sample data" stays on every screen.

| # | Screen | Change | Files |
|---|---|---|---|
| 1 | Top bar | Grey "Demo:" note removed | `Worklist.html`, `AppClient.html`, `Styles.html` |
| 2 | Review action confirmation | Page text in both modes, e.g. "Copper Hollow Electric Inc. approved. The approval email is on its way." | `AppClient.html` (`mutate`) |
| 3 | Review mode confirmation | Page text in both modes. Server text with no page text (W-9) drops its "Demo:" tail | `AppClient.html` |
| 4 | First screen with saved changes | Figures show at once from the page data, then one quiet refresh lays the tab's changes over them | `AppClient.html` (boot) |
| 5 | Upload header | "Demo:" note removed | `UploadPage.html` |
| 6 | Upload result | Same steps as Demo Proj: Certificate received → reading → "All set". Sample reading list and "Try another file" removed | `UploadPage.html`, `Styles.html` |
| 7 | Record PDF | Keep. Server path only, nothing visible differs | — |
| 8 | Notification banner and email footer | "Preview. Sample data." in both modes ("The demo sends no emails" was wrong in Demo Proj) | `Notifications.gs`, `AppClient.html`, 2 tests |
| 9 | About tooltip | "About COI Check" | `Worklist.html` |

Not changed: server guards, `Demo.gs` and `Upload.gs` message text (the page no longer shows it; tests pin it).

Accepted with Option B: in Share Proj the toasts ("email is on its way", "Resend request sent") and the upload steps describe Demo Proj behavior. Nothing on screen says the visit is not saved.

## Upload page polish

- Drop zone: raised file icon that lifts on hover and on drag-over; the zone scales 1%. Icon turns green once a file is chosen; the file pill animates in.
- Progress: card fades in, steps rise in one after another, a finished step gets a filled green check that pops.
- Share Proj timing: File received → Reading (1.7 s) → Sent to the project team (1.1 s) → done.
- Success: green seal with a drawn check and one soft ring, then "You're all set".
- Fixed: the round 4 notification `.mark` style leaked into the upload step marks (grey pills). `.steps .mark` now resets it.
- Reduced motion: the existing global rule turns all of it off; the check still shows.

## Copy review (upload page)

| Where | Before | After | Why |
|---|---|---|---|
| Intro | Send one PDF certificate of insurance. Maximum 5 MB. | Send your certificate of insurance as one PDF, up to 5 MB. | One sentence, speaks to the reader |
| Helper | The project team reviews every certificate. Uploading does not approve it. | The project team reviews every certificate before it's approved. | Same fact, said positively |
| File chosen button | Change | Choose another | Says what it does |
| Step 1 | Certificate received | File received | Heading already says "Certificate received" |
| Step 2 | Reading the certificate | Reading your certificate | Warmer |
| Success heading | All set | You're all set | Warmer, still short |
| Slow check | The check is taking longer than expected. Your file is saved. | This is taking longer than usual. Your file is saved, so you can close this page. | Tells them what they can do |
| Check failed | We could not finish the check | We couldn't finish the check | Matches the contractions elsewhere ("We're", "We'll") |
| Progress failed to load | The reading result could not load. Your file is saved. | We couldn't load the progress. Your file is saved. | Plain words |
| Send failed | The file could not be sent. Please try again. | The upload didn't go through. Check your connection and try again. | Gives the likely fix |
| Link closed | This upload link is not active. / Contact the project team for a new link. | This upload link isn't active / Ask the project team for a new one. | No period on a heading; shorter |

Kept: "Upload your certificate", "Drop your PDF here", "Choose PDF", "Upload certificate", "Certificate received / We're reading it now. You can close this page.", the success line, and the server error text in `Upload.gs` (tests pin it).

Preview: `docs/design/round-5/upload-preview.html` (Share Proj path, design-only, not for deploy).

To check: `node --test`, then 375 wide and desktop on the local preview and the "Demo polish test" deployment.
