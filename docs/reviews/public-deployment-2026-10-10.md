# Public deployment review

Status: version 30 is public. Both deployment checks passed after the owner's "go". The real iPhone and iPad checks remain open.

## Release record

| Item | Result |
|---|---|
| App source | PR #2 merge, `8979dcd7cc367bba8d4d83cb053472ce806baaf7` |
| Apps Script version | 30, description `AI upgrades` |
| Public app | ID ends `uUnUoGbw`, version 30 |
| Public upload page | ID ends `0kFTfYWm`, version 30 |
| Test deployment | ID ends `y3s1suy2`, version 30 |
| Editor deployment | ID ends `9s-VOkSc`, HEAD |
| Public mode | Share Proj; Script Properties unchanged |
| Rollback target | Version 29 for both public IDs |
| Browser check completed | 2026-10-11 at 01:43:29 UTC |

The release retained both public URLs. The deployment list confirmed the versions after publication.

## Signed-out browser checks

Each check used a fresh Chromium mobile context at 375x667. No context imported login or storage. Initial cookie counts were zero.

| Check | Result |
|---|---|
| Public app URL | HTTP 200; inline server JSON and `INITIAL.demo` both contain `true` |
| Public upload deployment URL without a link parameter | HTTP 200; inline server JSON and `INITIAL.demo` both contain `true` |
| Actual upload page | HTTP 200; inline and runtime `DEMO` both contain `true`; the existing fictional link opens the form |
| Sample labels | Visible `Sample data` on all three page loads |
| Rendered viewport | All three outer pages contain `width=device-width, initial-scale=1, viewport-fit=cover` |
| Public tour | All eight beats and the closing card passed; the AI card and copy stayed within the frame and browser viewport |
| Public navigation | Six visible items; all six screens opened through navigation buttons |
| Upload form | Heading, file chooser and upload button visible; no file selected or submitted |
| Browser errors | Zero page, console or observed frame errors in all three contexts |
| Anonymous-access manifest | `node scripts/checks/webapp-access.js` exited 0 |

The six screens were Projects, Compliance, Worklist, Payment holds, Subcontractors and Notifications.
The upload check read an existing fictional resend draft through its record link. It clicked no resend, review or upload action.
The helper kept the upload token in memory. Saved reports redact tokens. Screenshots mask draft and email text.
The checks changed no master data and sent no messages.

## Evidence and remaining work

- Browser report: ignored `.scratch/coi/validation/public-deployment-v30/public-deployment-browser.json`.
- Screenshots: the report's `internal-app/`, `upload-deployment-app/` and `upload-form/` folders.
- Browser helper: ignored `.scratch/coi/validation/public-deployment-browser.py`.
- Prior test deployment: [test review](test-deployment-2026-10-10.md).
- Prior shipping panel: [panel review](panel-2026-10-10.md).
- Owner device check: [real-device checklist](real-device-checklist.md).

The earlier local suite passed 469 tests. All 109 responsive results passed across ten sizes.
Chromium emulation does not prove Safari safe areas, input zoom, keyboard behavior or rotation on real devices.
Private live AI checks remain in ticket 23. The video remains deferred.
The owner still needs to send the Share Proj link. The to-do remains unticked until the owner sends it.
