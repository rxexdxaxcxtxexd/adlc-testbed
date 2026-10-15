# CLAUDE.md: standing instructions for coi-poc

A proof of concept of certificate-of-insurance (COI) automation: a Google Apps Script backend plus a custom HtmlService web front end, inside Google Workspace. A self-directed portfolio build. Not a client delivery.

Readers of the result: a non-technical CFO who wants ROI and polished UX, and a data manager who wants data she can trust.

## Hard rules

- **Thesis.** AI reads, routes and drafts. Code calculates and decides. A person approves what matters. The model never does arithmetic.
- **Anonymize everything.**
  - Use a fictional company, people, projects and subcontractors.
  - No real client names, call transcript content or links, and no consulting pricing or commercial terms. This applies to the repo, the demo and commit messages.
  - Name no real company or person in this folder.
- **Sample data.** All sample data is fake. Screens carry no "Sample data" label (owner decision, 2026-10-11); the About page says all names are fictional. Sample COI PDFs use fictional insurers, insureds and producers, and print "SAMPLE: fictional certificate" on every page.
- **Credit.** Describe the original design as team work and this build as the author's own.
- **Accounts.** Build only in the author's personal Google Workspace and personal GitHub. Never use an employer or client account.
- **Secrets and model.** No secrets in code. The Gemini API key lives in Script Properties. The model name lives in `Config.gs`; pick the current model at build time.
- **Locking.** Wrap ID generation and Sheet writes in `LockService`.
- **Confidence gate.** An extraction below 0.85 confidence goes to the accountant queue. It never auto-approves.
- **Basic Memory.** Never write to it without asking first.
- **Git.** Never commit or push without showing the diff summary first.
- **Mode names.** Say "Share Proj" for the public, safe mode and "Demo Proj" for the mode that writes real data. In code the names stay the old ones: Share Proj is demo mode on (`DEMO_MODE` = `on`), and Demo Proj is demo mode off. The public deployments always run in Share Proj. See `GLOSSARY.md`, Running modes.

## Testing

- **Node is for development only.** Pure logic is tested locally with Node's built-in test runner, with no packages. `.claspignore` keeps every test file and all tooling out of deployment. This does not break the "no npm" rule, which applies to code that runs in Apps Script.
- **Test through the seams:** `evaluateCoi`, `deriveStatus`, `nextStatus`, `projectTile`, `parseExtraction`, `roiLines`, and fake versions of the Reader, Store, Mailer and Clock adapters. Never test internals.
- **Expected values are literals,** read by hand from the sample PDFs and the planted-problem manifest. Never compute an expected value with the code under test.

## Agent skills

### Issue tracker

Local markdown files under `coi-poc/.scratch/`. See `docs/agents/issue-tracker.md`.

### Domain docs

Single-context, with one home per kind of fact (glossary, metric definitions, tolerance matrix, decisions log). See `docs/agents/domain.md`.
