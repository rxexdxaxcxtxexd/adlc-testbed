# How AI is used in COI Check, and how AI was used to build it

All figures come from this repo, its git history or a cited file. Where a number was not measured, this file says so. Sample data is fictional throughout.

## 1. The rule

AI reads. Code checks and decides. A person approves what matters. The model never does arithmetic.

The rule is enforced in code and covered by tests. The model does one narrow job: it reads a messy document into clean fields. Code checks that work, and people own the decisions.

## 2. Where AI is used in the product

| # | Where | What the model does | What code does | What a person does | Where to look |
|---|---|---|---|---|---|
| 1 | Certificate reading | Reads the PDF directly, with no OCR step. Returns 13 fields as JSON against a fixed schema, plus one confidence score. The prompt tells it never to add, round or convert a number. | `parseExtraction` rejects a reply with the wrong shape, a limit that is not a dollar amount, a bad date, or a confidence outside 0 to 1. It turns that reply into "unreadable, with a reason". | Nothing, when the reading is clean and the review mode allows it. | `src/Extract.gs`, `src/Adapters.gs` |
| 2 | Confidence gate | Scores its own reading. | Sends anything below 0.85, or anything it cannot parse, to the accountant in every review mode. It never auto-approves. | The accountant checks the reading against the PDF and corrects it. The log keeps the old value, the new value, the person, the note and the time. | `docs/decisions.md`, Phase 0 |
| 3 | Unreadable files | Nothing. A rejected file is a file problem. | Turns an HTTP 400 into "unreadable" and routes it to a person. A rate limit or an outage stops the job and retries, so a good certificate is never filed as unreadable because the service was down. A bad API key never marks a file unreadable. | The accountant sends the resend request. | `docs/decisions.md`, Phase 2 |
| 4 | Checking and deciding | Nothing. | `evaluateCoi` compares every value with a tolerance matrix for each scope of work. Code works out the status from the facts and the date, sets and lifts payment holds, and counts dollars on hold. | The project manager waives a deficiency with a note, or rejects it. Leadership sets the review mode. | `src/Evaluate.gs`, `docs/tolerance-matrix.json`, `src/PaymentHold.gs` |
| 5 | Trust ramp | Nothing. | Gives each project a review mode: review all, review deficiencies, or automatic. A new project starts on review all. | Leadership moves a project along the ramp by hand. | `docs/decisions.md`, Phase 0 |
| 6 | Approval trail | Nothing. | Gives every sent notice its own event type. The log shows how each notice was approved: by a person, by the review mode, by the daily job, or not built. It never invents an approver. | | `src/Notifications.gs` |

**An honesty fix.** Up to version 29, the Notifications screen labelled four template-built messages "Drafted by AI". At that point the only model call in the app was the certificate reader. Version 30 labels those messages "Template" and adds real AI drafts (section 4). The label now says "AI" only when a model wrote the text.

## 3. Model choice and cost

- **Model.** `gemini-3.5-flash-lite`, named once in `src/Config.gs`. It reads PDFs natively, returns structured JSON, and keeps output tokens low by default. It runs inside Google Workspace, so the firm adds no vendor.
- **Price.** $0.30 per million input tokens and $2.50 per million output tokens. A base reading is about 1,720 input and 300 output tokens, so about $0.0013 a certificate. Source: `docs/research/c4-gemini-api-cost.md`. This is an estimate. Metering (section 4) records the real cost once live readings run.
- **Choices that show judgment:**
  - The model is named exactly, with no "latest" alias. A silent model swap would change readings with no code change.
  - There is no fallback model. A quiet fallback would change results without anyone seeing it. Calibration measures one model.
  - Switching models is a one-line change, gated by a calibration run on the sample set.
  - The free tier is used only because every certificate in the demo is fictional. The paid tier is needed before any real certificate is sent.
- **Where the return comes from.** Model cost is very small next to staff time and lapse risk. See `docs/roi.md` for the estimates, all on fictional inputs.

## 4. Added in version 30

These three changes shipped in version 30. They are tested, reviewed by the five-reviewer panel and deployed. The public demo runs in Share Proj, which never calls the model. Live readings against the model, which give the measured cost and the first real drafts, are planned in ticket 23.

1. **AI drafts for notices.** The model writes only the wording of the deficiency notice and the correction request. Code writes every fact, number, date and link. A draft that contains a digit, a dollar sign, a link, an ID or a spelled-out amount is thrown away, and the template goes out. The email always goes, even when drafting fails. The label says "AI" only when a model wrote the text and the text passed the check.
2. **Metering.** Every model call writes one row with the model, the tokens in and out from the API's own count, the cost, and the purpose. A missing price reads "price unknown", never $0.
3. **Corrections become tests.** When the accountant fixes a misread value, the PDF and the corrected values become a calibration sample. Calibration then reports two scores: the hand-built set, and the set built from real corrections. Any model change is tested against the firm's own hard cases.

Version 30 also adds phone and iPad layouts, from `docs/design/responsive-spec.md`, and hides the Data trust screen from the public app.

## 5. How AI was used to build it

Low estimates on purpose.

| Measure | Figure | Source |
|---|---|---|
| Calendar time, first commit to version 30 | 4 days | git log |
| Hours with at least one commit | 28. Use "about 25 hours of hands-on time". | git log, commits grouped by hour |
| Builders | 1 | git authors |
| Commits on `main` | 108 | git |
| Tickets planned | 24 | `.scratch/coi/issues/` |
| Decisions logged, with trade-offs | 83 | `docs/decisions.md` |
| Lessons logged, each turned into a rule or check | 19 | `docs/lessons.md` |
| Automated tests | 469, all passing on `main` | `npm test` |
| Automated checks | 8 fast checks: secrets, OAuth scopes, forbidden syntax, dollar amounts in copy, source text, deployed code, deployed files, public access. 2 browser checks: phone, iPad and desktop layouts, and the guided tour. | `scripts/checks/` |
| Research briefs, each cited | 6: quotas, form sign-in, run-as rules, PDF input, current model, cost | `docs/research/` |
| Code | about 3,900 lines of Apps Script, 3,000 lines of HTML and JS, 6,100 lines of tests | `wc -l` |
| Calibration | 5 of 8 on the first run, 8 of 8 after one prompt fix | `docs/calibration-report.md` |
| Design rounds | 5 | `docs/design/` |
| Tokens | Not measured here. The build sessions ran on another machine. | |

### The agent system

- **Reviewer agents.** Five standing reviewers in `.claude/agents/`: CFO, data, UX, engineering and claims. Each judges cold against a fixed rubric and returns a fixed report shape. Research ran as parallel subagents on a cheaper model, one cited file each.
- **Skills.** `run-the-panel` runs the five reviewers in parallel at each milestone gate, and a Block stops the milestone. `project-self-review` turns repeated lessons into checks. `template-from-best-work` makes reusable templates.
- **Automations.** A post-edit hook runs the checks on every file change. A stop hook runs the tests before an agent can say it is done. A pre-commit hook scans for keys. In the product, an upload job and a daily job run on timers.
- **Tools.** Claude Code for planning, build, tests and the review panel. Codex CLI for one design round. Claude Design for visual directions and the guided tour. The Gemini API is the product's reader.
- **Parallel lanes.** The version 30 work ran as separate agents in separate git worktrees: one each for drafts, metering, corrections, the layout spec and the layout build. A code review agent checked the merged AI work and fixed what it found. A second round of lanes hid Data trust, added the viewport line and the tour beat, then ran the panel and shipped.

### Lessons that show the AI was managed, not trusted

1. **The test set is the referee.** The model returned the insured's street address with the name. Calibration caught it at 5 of 8. One prompt line fixed it, and the next run was 8 of 8.
2. **A lesson became a permanent check.** A helper function could be called from any browser and could return any Drive file the owner could open. The fix was a test that lists every global function as guarded, read-only or private, and fails on any new unlisted one.
3. **Passing tests are not a working product.** 355 tests passed and the tour still broke on its first frame, because no test opened the tour in a real browser. The fix and the rule are in `docs/lessons.md`: run the tour in a real browser before a redeploy.
4. **Settled decisions get overturned in the open.** Research overturned two decisions: form intake forces a Google sign-in, and the pinned model was closed to new projects. Both were marked as superseded in the decisions log, not changed silently.
