# Round 5 brief: make Share Proj match the Demo Proj UI (Claude Design kickoff)

## How to start the session

1. Attach the `coi-poc/` folder (or the private GitHub repo, `main` at or after the commit that adds this file) to the Claude Design project.
2. Paste this whole file as the first message.
3. The design session plans first. It reports its comparison and its plan, then stops for the owner's approval.

## 1. What this round makes

The app runs in two modes. `GLOSSARY.md`, section "Running modes", defines them:

| Mode | Who sees it | What an action does | Name in code |
|---|---|---|---|
| **Share Proj** | Anyone with the public link, no sign-in | Changes stay in the visitor's browser tab. Nothing is saved, no email goes out, Gemini reads no file | Demo mode on: `isDemoMode()` is true, `DEMO_MODE` = `on` |
| **Demo Proj** | The owner | Writes to the shared Sheet, sends email, saves uploads to Drive, Gemini reads them | Demo mode off: `DEMO_MODE` = `off` |

The owner's standard is the Demo Proj UI. Today the Share Proj UI does not match it. The owner saw gaps that the list in section 4 does not cover. This round:

1. Compares every screen and state in both modes and lists each difference.
2. Proposes Share Proj changes so that its UI matches the Demo Proj standard.
3. Builds the approved changes.

## 2. Read before designing

1. `CLAUDE.md`: hard rules. Restate them in one line in your first report. Note the "Mode names" rule.
2. `GLOSSARY.md`: use these words and no synonyms. Use "Share Proj" and "Demo Proj" in your report. Use "demo mode" only when you name the code.
3. `docs/design/round-4-demo-polish-brief.md`: the last round. Its screens are now built.
4. `docs/decisions.md`, Phase 5: why Share Proj exists (ticket 14).
5. The files in section 4 of this brief.

## 3. How to see each mode

There is no running copy of Demo Proj. All four deployments read the same `DEMO_MODE` switch, and the switch stays `on`. Use these two sources:

| Mode | Where to look |
|---|---|
| Share Proj | The public app URL (deployment ending `…uUnUoGbw`). The upload page URL (deployment ending `…0kFTfYWm`) plus `?t=<upload code>`. Get a full upload link from the "Resend" email draft on any record |
| Demo Proj | The local preview. Run `node scripts/build-preview.js`, then serve `docs/design/refined/app/` on localhost. The preview runs the Demo Proj code path with fake adapters: it sets `demo` to `false`, and its emails stay in the preview |

Two limits:

- The public URLs run version 27. `main` has later commits, so the code can be newer than the public URLs.
- The local preview adds its own "Local preview" banner. That banner is not part of either mode. Ignore it.

## 4. Known differences (from a code read)

Every place where the code branches on the mode, plus fixed text that is wrong in one mode. This list is a start, not the full list.

| # | Screen | Share Proj today | Demo Proj today | Code |
|---|---|---|---|---|
| 1 | Top bar, every app screen | Grey note beside "Sample data": "Demo: changes stay in your browser" | No note | `src/Worklist.html:38`, `src/AppClient.html:90` |
| 2 | Confirmation after a review action | The server's generic text: "Approved. Demo: no email was sent. The change stays in this browser tab." No subcontractor name | The page's own text, for example "Copper Hollow Electric Inc. approved. The approval email is on its way." | `src/AppClient.html:927`, `src/Demo.gs:90-103` |
| 3 | Confirmation after a review mode change | Server text plus "Demo: the change stays in this browser tab." | "Review mode updated. It applies to new certificates. Items already waiting stay in the queue." | `src/AppClient.html:430`, `src/Demo.gs:106-110` |
| 4 | First screen after a change, then a reload | Loading state, then a second server call. The data in the page does not hold the visitor's changes | Figures show at once from the data in the page | `src/AppClient.html:1263` |
| 5 | Upload page header | Grey note: "Demo: nothing you upload is saved" | No note | `src/UploadPage.html:8,49` |
| 6 | Upload page after upload | Progress stops at step 1. Heading "Demo: nothing was saved". A fixed sample reading in a plain list, the same for any file. A "Try another file" button | "Certificate received", then the page checks progress through reading and checking, then "All set" with the next step | `src/UploadPage.html:150-170`, `src/Upload.gs:9-22` |
| 7 | Certificate PDF in a record | A sample PDF not yet on Drive is built in memory | The PDF is read from Drive (and saved there first if needed) | `src/Code.gs:146-153` |
| 8 | Notification center banner and email footer | "Preview. Sample data. The demo sends no emails." | Same text. This is wrong in Demo Proj, where reminders do send | `src/Notifications.gs:78-79`, `src/AppClient.html:946` |
| 9 | About link | Tooltip "About this demo" | Same text | `src/Worklist.html:29` |

## 5. What stays fixed

- "Sample data" shows on every screen in both modes.
- Share Proj never writes, sends, reads a file with Gemini or creates a timer. Do not change the server guard. A design change is a page change only, unless the owner approves a server change.
- The screens, layout, tour and tokens from round 4 stay as they are, except where a difference in section 4 or your comparison needs a change.
- No real names. Fictional companies only.

## 6. Owner decision to raise

A visitor in Share Proj loses every change when they close the tab. Today rows 1, 2, 5 and 6 tell them so. If Share Proj matches Demo Proj exactly, the visitor gets no sign of this. Propose one option that keeps the match and still tells the visitor, and one option with no notice. The owner picks.

## 7. Build target

| File | What changes there |
|---|---|
| `src/Worklist.html` | Top bar note |
| `src/AppClient.html` | Confirmation text, first-screen data, notification banner |
| `src/UploadPage.html` | Upload states in Share Proj |
| `src/Styles.html` | Any new style |
| `src/Demo.gs`, `src/Upload.gs`, `src/Notifications.gs` | Message text only. No change to what the code saves or sends |

## 8. How to work

1. Do the comparison in section 3 for every screen and state: Projects, Compliance, Worklist, Payment holds, record detail, Subcontractors, Notifications, Data trust, About, the tour, and every upload page state.
2. Add each new difference to the table in section 4, with the screen, both behaviors and the file.
3. Report the full table and your plan. Stop for the owner's approval.
4. After approval, make the changes. Keep each change small.

## 9. Report-back checklist

- [ ] Hard rules restated in one line.
- [ ] Full difference table, with rows added past row 9.
- [ ] For each row: change it, keep it, or owner to decide, with one line of reason.
- [ ] The two options for section 6.
- [ ] Files changed, and the reason for each change.
- [ ] Each changed screen checked at 375 wide and at desktop width.

## 10. Pitfalls

- "Demo" in the code means Share Proj. Do not read `isDemoMode()` as Demo Proj.
- A page change cannot make Share Proj save or send. If a fix seems to need that, stop and ask.
- Every new global function in `src/*.gs` must go into the lists in `tests/demo-mode.test.js`. The tests fail until it does.
- Chrome automation cannot read inside the Apps Script frame on the public URL. Use screenshots there, or the local preview.
