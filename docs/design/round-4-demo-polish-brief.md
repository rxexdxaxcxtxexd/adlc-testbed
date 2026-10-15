# Round 4 brief: guided tour and three new screens (Claude Design kickoff)

## How to start the session

1. Attach the `coi-poc/` folder (or the private GitHub repo) to the Claude Design project.
2. Paste this whole file as the first message.
3. The design session plans first. It reports its read of the repo and its plan, then stops for the owner's approval.

## 1. What this round makes

The deployed tool is going public: anyone with the link opens it without a sign-in. Two people judge it. A finance executive wants ROI and polish. A data manager wants proof that the numbers can be trusted.

This round makes four things, in priority order:

1. **A guided first-visit tour.** The centerpiece of the demo. It must feel like a premium product, not a tooltip plugin.
2. **Data trust panel.** Expected vs. received certificates, the reconciliation check, and the source of every number.
3. **Subcontractor directory.** A roster of 30+ fictional companies with search, filters and a detail view.
4. **Notification center.** A read-only preview of the automated emails. Nothing sends.

The existing screens (Projects, Compliance, Worklist, Payment holds, record detail, upload page) are built and locked. The ROI page leaves the navigation in this release. Do not design it.

## 2. Read before designing

1. `CLAUDE.md`: hard rules. Restate them in one line in your first report.
2. `GLOSSARY.md`: use these words and no synonyms. Note the *Avoid* lists.
3. `docs/metric-definitions.md`: every number on screen must have an entry here.
4. `docs/decisions.md`: settled choices. Phase 4 holds the design decisions.
5. `docs/design/critique-vocabulary.md`: the shared terms, the six tests, the hard standards and the ban list. Use them in every self-critique.
6. `docs/design/round-3-refinement-brief.md`: sections 2 (what stays fixed), 4 (motion rules) and 5 (build target) bind in full.
7. The live build, which is the starting material:
   - `src/Styles.html`: the current finish. New screens use these tokens. Do not restyle the app.
   - `src/AppClient.html`: the sidebar, views and navigation (`ORDER` and `NAV_LABEL` near the top).
   - `src/DemoPortfolio.gs`: the sample subcontractors and projects.

## 3. What stays fixed

1. Everything in section 2 of the Round 3 brief.
2. The current visual finish in `src/Styles.html`. This round adds screens and a tour layer. It does not change the look of existing screens.
3. "Sample data" on every screen. The notification center also says: "Preview. Sample data. The demo sends no emails."
4. Fictional names only. Emails use `example.com`. Phones use 555-01xx numbers. No real company, client or employer names anywhere.
5. The thesis, which the tour must state plainly: AI reads, routes and drafts. Code calculates and decides. A person approves what matters. The model never does arithmetic.
6. Readings below 0.85 confidence go to the accountant and never auto-approve. Show this number in the tour.
7. No new number appears unless it has a `metric-definitions.md` entry. If a screen needs a number that has none, list it in your report as "needs a definition" with a proposed formula. Do not invent it on screen.
8. Credit, in tour step 8 and an about page: "Designed and built by Lucas Layden." Never say a client has used it.

## 4. The guided tour (priority)

### Behavior

1. Starts on the first visit. Remembers that the visitor has seen it.
2. Skippable at every step. Escape closes it.
3. Replayable from a visible button in the app header or sidebar.
4. Shows progress (for example "3 of 9").
5. Spotlights real elements on the live screen, not screenshots. The tour may switch views to reach an element.
6. Autoplay mode with timed steps, so the owner can screen-record it as the walkthrough video. Start it from a URL flag or a key. Default about 7 seconds a step, set per step.
7. Keyboard: Tab reaches every tour control, arrow keys move between steps, focus returns to the page on close.
8. Screen reader: each step is announced. The spotlight does not trap focus behind an overlay.
9. Works on a 375-wide phone. On a phone the card docks to the bottom instead of floating beside the element.
10. Motion follows the Round 3 motion rules. The spotlight moves between elements; it does not jump. Honor `prefers-reduced-motion`.

### All tour text in one file

Put every word of tour copy, every step's target element, and every step's autoplay time in one config file (for example `tour-steps.js`). The owner edits copy there without touching code.

### Steps, in order

1. **The problem.** A builder collects insurance certificates from dozens of subcontractors. Paying one whose coverage has lapsed is a real financial risk.
2. **The pattern.** Papers come in, rules check them, exceptions go to a person, payments wait until the paper is right. Name other places it fits, labelled as examples (for instance, a food manufacturer checking supplier insurance or ingredient test certificates).
3. **Who does what.** AI reads the certificate and drafts messages. Code checks coverage and decides status. A person approves what matters. Show the 0.85 confidence threshold for routing to the accountant.
4. **The automations, each named once.** Certificate reading, coverage check, routing to review, renewal reminders, payment holds, the COI Sub-Contract Payment Holds - Digest, and the email notifications.
5. **Data trust.** The panel from section 5.
6. **The subcontractor directory** from section 6.
7. **The notification center** from section 7.
8. **How this was built.** One short step: the rules, tests and review agents behind it, and why the second tool built this way costs less. Carries the credit line.
9. **Close.** What a person does each morning in the tool.

Draft the copy for all nine steps. Keep each step under 40 words. Plain business language; define any technical term in the same sentence.

## 5. Data trust panel

1. **Expected vs. received.** For each subcontractor: certificates owed vs. certificates received, and the person responsible for each gap.
2. **Reconciliation check.** Dashboard counts must equal the source rows. Show pass or fail and the time it last ran. Design both the pass and the fail state.
3. **Source and last-updated time** on every number, in the same pattern the existing screens use.

## 6. Subcontractor directory

1. Columns: company name, trade, point of contact, email, phone, current compliance status, linked certificates, last notification sent.
2. Search, and filters for status and trade.
3. Clicking a company opens its detail view with its certificates and its notification history.
4. At least 30 companies. Extend the subcontractors in `src/DemoPortfolio.gs`; keep their names and planted problems, and add new ones to reach 30+. Show the sample rows as a plain JavaScript object at the top of the file, so the build can swap it for a server call.

## 7. Notification center (UI only)

A log of workflow events. Each entry shows the trigger, recipient, approval step, status and a full email preview. Mark which emails AI drafts and which a person approves before sending. Anything sent to a subcontractor needs a person's approval unless the project's review mode (`docs/decisions.md`, Phase 1) says otherwise.

Events, at minimum:

1. Certificate received: confirmation to the subcontractor's contact.
2. Deficiency found: to the subcontractor's contact and the project manager.
3. Low-confidence reading sent to the accountant for review.
4. Expiring in 30 days, and in 7 days.
5. Expired: payment hold notice to the accountant.
6. Renewal accepted.
7. COI Sub-Contract Payment Holds - Digest (weekly).

Use `GLOSSARY.md` names for events and statuses. Where the glossary has no word for an event, propose one and list it in your report under "new glossary terms."

## 8. Build target

Same as section 5 of the Round 3 brief: plain HTML, CSS and vanilla JavaScript; no framework, no build step, no design-tool runtime; external code only from cdnjs; icons as inline SVG.

Output to `docs/design/round-4/`:

| File | Holds |
|---|---|
| `tour.js`, `tour.css` | The tour engine and its styles |
| `tour-steps.js` | All tour copy, targets and timings |
| `trust.html` | Data trust panel, pass and fail states |
| `directory.html` | Directory list and company detail |
| `notifications.html` | Notification center with email previews |
| `index.html` | Links to each file, plus a demo of the tour running over a copy of the current app shell |

## 9. How to work

1. Read section 2, then report: what you found, your plan, and any conflict between this brief and the repo. Stop for approval.
2. Build the tour first, over a copy of the current app shell, so the owner can feel it early.
3. Then the three screens.
4. Before reporting, run the six tests from `critique-vocabulary.md` on each file, plus a keyboard-only pass and a 375-wide pass on the tour. Fix what fails.

## 10. Report-back checklist

- [ ] Hard rules restated in one line
- [ ] Tour: all 10 behaviors present, tested with keyboard only and at 375 wide
- [ ] Tour copy for all nine steps in `tour-steps.js`, each under 40 words
- [ ] Autoplay mode works, and how to start it is written at the top of `tour.js`
- [ ] Three screens built, using the existing tokens, "Sample data" visible
- [ ] Lists: "needs a definition" (numbers), "new glossary terms" (words)
- [ ] Self-critique table per file (test, finding in vocabulary terms, fix applied)
- [ ] No changes to existing screens, `src/`, or the ROI page

## 11. Pitfalls

- A tour that narrates the UI ("This is the sidebar") wastes the step. Each step says why the element matters to the finance executive or the data manager.
- A dimmed overlay with a hole is the tooltip-plugin look. Aim for a spotlight that feels part of the product: elevation, a soft focus ring, the rest of the page calm but readable.
- Do not let autoplay timing live in code. It belongs in `tour-steps.js`.
- No count-up animation on any number, in the tour or on the screens.
