# Apps Script quotas and limits for the COI proof of concept

Retrieved: 2026-10-07

## Answer

Yes. At 35 to 140 certificates a month, the workload sits far below every daily quota on a paid Google Workspace account, even if the whole month's volume lands on one day. The closest limit is not a daily quota. It is the 6-minute cap on a single execution, which applies on every edition. A trigger that works through a batch of certificates, each with an external AI call, will hit that cap long before any daily total. The other limits to design around are the 25 MB attachment cap per email (if ZIP bundles go out by email), the 500 KB total size of a property store (if PropertiesService holds more than settings), and the 30-simultaneous-executions-per-user cap during the pre-pay-run peak. On a consumer gmail.com account, the 100 email recipients per day and 90 minutes of trigger runtime per day would be much tighter.

## Findings

All "per day" quotas are per user and reset 24 hours after the first request (quotas page). Google says quotas "can be changed or removed at any time without notice". Trial Workspace accounts get extra limits until the domain has paid at least USD $100 and 60 days have passed.

| Limit | Value | Edition | Source |
|---|---|---|---|
| Script runtime per execution | 6 min | Consumer and Workspace (same) | https://developers.google.com/apps-script/guides/services/quotas |
| Web app runtime per execution | No separate figure. The page lists one "Script runtime" of 6 min, which covers it | Both | https://developers.google.com/apps-script/guides/services/quotas |
| Simple trigger runtime | 30 sec | Both | https://developers.google.com/apps-script/guides/triggers |
| Installable and time-driven trigger runtime per execution | No separate figure. Falls under the 6 min script runtime | Both | https://developers.google.com/apps-script/guides/services/quotas |
| Custom function runtime | 30 sec / execution | Both | https://developers.google.com/apps-script/guides/services/quotas |
| Triggers total runtime per day | 90 min (consumer), 6 hr (Workspace) | Differs | https://developers.google.com/apps-script/guides/services/quotas |
| Simultaneous executions per user | 30 | Both | https://developers.google.com/apps-script/guides/services/quotas |
| Simultaneous executions per script | 1,000 | Both | https://developers.google.com/apps-script/guides/services/quotas |
| google.script.run concurrent server calls from one page | 10 | Both | https://developers.google.com/apps-script/guides/html/communication |
| Triggers per user per script | 20 | Both | https://developers.google.com/apps-script/guides/services/quotas |
| Time-driven trigger frequency | Every minute at most, once a month at least. Time may be "slightly randomized" (a 9 AM trigger can fire between 9 and 10 AM) | Both | https://developers.google.com/apps-script/guides/triggers/installable |
| everyMinutes(n) allowed values | 1, 5, 10, 15 or 30 | Both | https://developers.google.com/apps-script/reference/script/clock-trigger-builder |
| nearMinute() precision | Plus or minus 15 minutes | Both | https://developers.google.com/apps-script/reference/script/clock-trigger-builder |
| after(ms) one-off trigger | Runs no sooner than the given delay. "The actual duration might vary, but won't be less than your specified minimum." Page does not say the trigger deletes itself or how late it may run | Both | https://developers.google.com/apps-script/reference/script/clock-trigger-builder |
| Installable trigger identity | Always runs as the account that created it | Both | https://developers.google.com/apps-script/guides/triggers/installable |
| Email recipients per day (MailApp/GmailApp) | 100 (consumer), 1,500 (Workspace). Both marked with a footnote whose text the page did not return | Differs | https://developers.google.com/apps-script/guides/services/quotas |
| Email recipients per day within domain | 100 (consumer), 2,000 (Workspace) | Differs | https://developers.google.com/apps-script/guides/services/quotas |
| Email read/write (not send) | 20,000 / day (consumer), 50,000 / day (Workspace) | Differs | https://developers.google.com/apps-script/guides/services/quotas |
| Email recipients per message | 50 | Both | https://developers.google.com/apps-script/guides/services/quotas |
| Email attachments per message | 250 | Both | https://developers.google.com/apps-script/guides/services/quotas |
| Email total attachment size per message | 25 MB | Both | https://developers.google.com/apps-script/guides/services/quotas |
| Email body size per message | 200 KB (consumer), 400 KB (Workspace) | Differs | https://developers.google.com/apps-script/guides/services/quotas |
| Gmail (non-script) sending limits, for context | 2,000 messages / user / day; 3,000 external recipients / day; trial accounts 500. Page says "Quotas might be different if you're using Google Apps Script" | Workspace | https://knowledge.workspace.google.com/admin/gmail/gmail-sending-limits-in-google-workspace |
| UrlFetch calls per day | 20,000 (consumer), 100,000 (Workspace) | Differs | https://developers.google.com/apps-script/guides/services/quotas |
| UrlFetch response size | 50 MB / call | Both | https://developers.google.com/apps-script/guides/services/quotas |
| UrlFetch POST size | 50 MB / call | Both | https://developers.google.com/apps-script/guides/services/quotas |
| UrlFetch headers | 100 / call, 8 KB header size / call | Both | https://developers.google.com/apps-script/guides/services/quotas |
| UrlFetch URL length | 2 KB / call (quotas page); "up to 2,082 characters" (reference page) | Both | https://developers.google.com/apps-script/guides/services/quotas and https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app |
| UrlFetch timeout | `timeoutSeconds` parameter, default 360 (6 min). Page states no maximum. The 6 min script runtime still caps the whole execution | Both | https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app |
| Calendar events created | 5,000 / day (consumer), 10,000 / day (Workspace) | Differs | https://developers.google.com/apps-script/guides/services/quotas |
| Properties read/write | 50,000 / day (consumer), 500,000 / day (Workspace) | Differs | https://developers.google.com/apps-script/guides/services/quotas |
| Property value size | 9 KB / value | Both | https://developers.google.com/apps-script/guides/services/quotas |
| Property total storage | 500 KB / property store | Both | https://developers.google.com/apps-script/guides/services/quotas |
| Documents created | 250 / day (consumer), 1,500 / day (Workspace) | Differs | https://developers.google.com/apps-script/guides/services/quotas |
| Spreadsheets created | 250 / day (consumer), 3,200 / day (Workspace) | Differs | https://developers.google.com/apps-script/guides/services/quotas |
| Files converted | 2,000 / day (consumer), 4,000 / day (Workspace) | Differs | https://developers.google.com/apps-script/guides/services/quotas |
| Drive file creation (DriveApp.createFile) per day | Not listed. No general Drive file creation quota on the quotas page | Unknown | https://developers.google.com/apps-script/guides/services/quotas |
| DriveApp.createFile(name, content) size | Throws if content is larger than 50 MB | Both | https://developers.google.com/apps-script/reference/drive/drive-app |
| DriveApp.createFile(name, content, mimeType) size | Throws if content is larger than 10 MB | Both | https://developers.google.com/apps-script/reference/drive/drive-app |
| DriveApp.createFile(blob) size | No limit stated | Unknown | https://developers.google.com/apps-script/reference/drive/drive-app |
| Utilities.zip / max Blob size | No limit stated on the Utilities or Blob reference pages | Unknown | https://developers.google.com/apps-script/reference/utilities/utilities and https://developers.google.com/apps-script/reference/base/blob |
| Utilities.sleep max | 300,000 ms (5 min) | Both | https://developers.google.com/apps-script/reference/utilities/utilities |
| google.script.run legal types | Primitives (Number, Boolean, String, null), and objects and arrays made of them. A form element is legal only as the sole parameter. File inputs in a form arrive as Blob objects | Both | https://developers.google.com/apps-script/guides/html/communication and https://developers.google.com/apps-script/guides/html/reference/run |
| google.script.run illegal types | Date, Function, DOM elements other than a form, circular references. A form is not a legal return type. Undefined array fields become null | Both | https://developers.google.com/apps-script/guides/html/reference/run |
| google.script.run payload size | Not stated on either page | Unknown | https://developers.google.com/apps-script/guides/html/communication |
| LockService.getScriptLock | "Prevents any user from concurrently running a section of code" | Both | https://developers.google.com/apps-script/reference/lock/lock-service |
| LockService.getDocumentLock | "Prevents any user of the current document from concurrently running a section of code" | Both | https://developers.google.com/apps-script/reference/lock/lock-service |
| LockService.getUserLock | "Prevents the current user from concurrently running a section of code" | Both | https://developers.google.com/apps-script/reference/lock/lock-service |
| Lock.tryLock(ms) | Returns true or false. No exception on timeout | Both | https://developers.google.com/apps-script/reference/lock/lock |
| Lock.waitLock(ms) | Throws an exception if the timeout expires first | Both | https://developers.google.com/apps-script/reference/lock/lock |
| Lock max timeout | Not stated | Unknown | https://developers.google.com/apps-script/reference/lock/lock |
| Lock release | Released automatically when the script ends, or by releaseLock() | Both | https://developers.google.com/apps-script/reference/lock/lock |
| Spreadsheet size | Up to 20 million cells or 100 MB, for files created in or converted to Sheets | Both | https://support.google.com/drive/answer/37603 |
| Characters per cell | Page says only that on Excel conversion, cells over 50,000 characters are removed | Both | https://support.google.com/drive/answer/37603 |

## Implications for this build

Working assumptions for the arithmetic: worst case is all 140 certificates in one day. Each certificate triggers 1 form submit, up to 3 AI calls, 1 Calendar event, up to 3 email recipients, 2 Drive files, and about 20 property reads or writes. Change these if the design changes.

- Inference. Per-execution runtime is the limit most likely to bite. If one AI call takes 20 to 60 seconds, a single run can finish only 6 to 18 calls (360 s / 60 s = 6; 360 s / 20 s = 18). A time-driven "process the queue" job must handle a few certificates per run, save its place, and stop well before 6 minutes. Do not pass a long `timeoutSeconds` to UrlFetch and expect the run to survive it.
- Inference. Daily trigger runtime fits on Workspace. 140 certificates x 1 min each = 140 min, under 360 min (6 hr). On consumer gmail.com, 140 min is over the 90 min cap, so a peak day could fail there.
- Inference. Web app calls also count against the 6-minute cap. Any button that runs the AI call inside google.script.run should return fast and hand the slow work to a trigger.
- Inference. Email recipients fit on Workspace. 140 x 3 = 420 recipients, under 1,500 (28 percent). On consumer, 420 is over 100, so only about 33 certificates a day could go out (100 / 3).
- Inference. Email attachments are a size risk, not a count risk. A ZIP bundle above 25 MB fails to send. Send a Drive link instead of attaching large ZIPs. Keep HTML bodies under 400 KB (200 KB on consumer).
- Inference. UrlFetch calls fit easily. 140 x 3 = 420 calls, 0.4 percent of 100,000 (2.1 percent of the 20,000 consumer quota). The 50 MB response and POST limits are not a concern for text AI payloads, but sending large PDFs to the AI API may approach it.
- Inference. Calendar events fit easily. 140 is 1.4 percent of 10,000 (2.8 percent of 5,000 on consumer).
- Inference. Properties read/write count fits. 140 x 20 = 2,800 operations, 0.6 percent of 500,000 (5.6 percent of 50,000). The binding limit is size. Each value caps at 9 KB and the whole store at 500 KB. At about 1 KB per certificate record, 140 records a month fill 500 KB in under 4 months (500 / 140 = 3.6). Keep records in the spreadsheet. Use PropertiesService only for settings, API keys and cursors.
- Inference. Drive file creation has no published daily quota for plain files. If the build creates Google Docs, 140 x 2 = 280 docs fits under 1,500 on Workspace but is over 250 on consumer.
- Inference. ZIP size has no published limit. Treat 50 MB as a practical ceiling, since that is the limit on UrlFetch responses and createFile(name, content). Test with a realistic month-end bundle.
- Inference. Simultaneous executions fit. A pre-pay-run burst of form submits runs as the trigger owner, so it counts against that one user's 30 concurrent executions. 140 submits spread over a day will not approach 30 at once. A scripted bulk import might.
- Inference. All installable triggers run as the account that created them, so every daily quota above is charged to that one account. Create triggers from a service-style Workspace user, not a person who may leave.
- Inference. Triggers per script fit. The design needs about 3 (form submit, queue processor, monthly job), well under 20. If the code chains one-off `after()` triggers, it must delete each finished one, or the count will creep toward 20.
- Inference. google.script.run cannot pass Dates. Send dates as ISO strings and parse them on the server. To upload a certificate file from the web app, pass the whole form as the only argument so the file arrives as a Blob.
- Inference. Use `LockService.getScriptLock()` with `tryLock` around writes to the spreadsheet and the next-ID counter. A web app has no bound document, so the document lock is the wrong choice for a standalone script. `tryLock` lets the code back off cleanly. `waitLock` throws.
- Inference. The spreadsheet as a database fits for years. 140 rows x 30 columns = 4,200 cells a month, about 50,400 a year, 0.25 percent of 20 million cells.

## Unknowns

- The footnote text for the asterisked email recipient quotas (marked `note1` on the quotas page) did not come back from the page. It may qualify the 100 and 1,500 figures, for example for new or trial accounts.
- No published maximum Blob size, and no limit for `Utilities.zip`.
- No published daily quota for `DriveApp.createFile` of non-Google files.
- No published size limit for google.script.run arguments or return values.
- No published maximum for `tryLock` or `waitLock` timeouts.
- No published maximum for UrlFetch `timeoutSeconds`, and no statement of how it interacts with the 6-minute runtime.
- The `after()` page does not say how late a one-off trigger can fire, or whether it removes itself after running.
- The installable triggers page does not give separate runtime numbers for form-submit versus time-driven triggers. This research assumes both follow the 6-minute script runtime.
- The Workspace Gmail sending limits page says Apps Script quotas "might be different". It does not say whether script-sent mail also counts toward the 2,000 messages per day user cap.
- The Sheets 20 million cell figure is newer than older Google pages that said 10 million. The support page read on this date says 20 million.
- Trial Workspace accounts get stricter, unstated limits until the paid threshold is met.
