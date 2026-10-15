# Test deployment review

Status: test deployment passed. The owner then said "go" for the public release. The real iPhone and iPad checks remain open.

## Version and scope

| Item | Result |
|---|---|
| Reviewed source | `main` at `8979dcd7cc367bba8d4d83cb053472ce806baaf7`, after PR #2 merged |
| Apps Script version | 30, description `AI upgrades` |
| Test deployment | ID ends `y3s1suy2`, version 30 |
| Public app during this test | ID ends `uUnUoGbw`, version 29 |
| Public upload page during this test | ID ends `0kFTfYWm`, version 29 |
| Rollback target | Version 29 for both public deployments |
| Script Properties | Unchanged |
| Check completed | 2026-10-11 at 01:33:32 UTC |

The code push included 34 app files. It excluded secrets, documentation, tests and developer tools.

## Browser results

The check used Chromium at 375x667 with touch and mobile emulation. The fresh browser context imported no login or storage.

| Check | Result |
|---|---|
| Signed-out access | HTTP 200; initial cookie count 0 |
| Share Proj | Inline server JSON and `INITIAL.demo` both contain `true` |
| Sample label | Visible `Sample data` |
| Rendered viewport | Top-level Google page contains `width=device-width, initial-scale=1, viewport-fit=cover` |
| Tour | All eight beats and the closing card passed |
| AI beat | Exact copy passed; card, heading and body fit the app frame and browser viewport |
| Navigation | Six visible items; Projects, Compliance, Worklist, Payment holds, Subcontractors and Notifications |
| Runtime errors | Zero page errors, console errors or observed frame errors |

Google's banner reduced the app frame to 375x582. The check used that actual frame height for card bounds.

The first helper run checked only the embedded app's viewport tag and reported a failure. That assertion targeted the wrong document.
The report already showed the required option on Google's outer page. The inner tag matched the existing literal in `Worklist.html`.
The corrected helper checked the rendered outer tag and recorded the inner tag separately. No app code, viewport tag or deployment changed.
The source spec describes this outer-page placement. The [Google API reference](https://developers.google.com/apps-script/reference/html/html-output#addmetatagname,-content) explains `addMetaTag`.

## Evidence and limits

Local artifacts remain under ignored `.scratch/coi/validation/`:

- First report: `test-deployment-v30/test-deployment-browser.json`.
- Corrected report: `test-deployment-v30-checked/test-deployment-browser.json`.
- Screenshots: `test-deployment-v30-checked/375x667-01.png` through `375x667-09.png`, plus initial and navigation views.
- Browser helper: `test-deployment-browser.py`.

Earlier local checks passed 469 tests, ten responsive sizes and 109 responsive results. The local tour passed at 375x667 and 1440x900.

Chromium emulation does not prove Safari safe areas, keyboard behavior or rotation on real devices. Use [the device checklist](real-device-checklist.md).
The test performed no uploads or review actions. It changed no master data and sent no messages.
Private live AI checks remain in ticket 23. The video remains deferred.

The owner approved the public update after these results. Both public IDs now use version 30. See [the public release review](public-deployment-2026-10-10.md).
