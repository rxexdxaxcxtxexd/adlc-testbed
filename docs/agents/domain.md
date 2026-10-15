# Domain docs

How the engineering skills read and write this project's domain documentation. Single-context layout: one of each file, under `coi-poc/`.

## One home per kind of fact

Each kind of fact lives in exactly one file. Do not copy a fact into a second file; link to its home.

| Kind of fact | Home | Holds | Never holds |
|---|---|---|---|
| Business words | `GLOSSARY.md` | One plain-English definition per term, plus the synonyms to avoid | Formulas, column names, code, implementation detail |
| Metrics | `docs/metric-definitions.md` | One entry per metric: formula, units, time window, source columns, owner | Business word definitions (link to `GLOSSARY.md` instead) |
| Coverage limits | `docs/tolerance-matrix.json` | Required coverages and minimum limits, default plus per scope of work | Prose or reasoning (put the reason in `docs/decisions.md`) |
| Decisions | `docs/decisions.md` | One row per decision: date, decision, why, alternatives rejected, source | Long write-ups. Do not create `docs/adr/` or ADR files |
| Research facts | `docs/research/<topic>.md` | One cited file per question, primary sources only | Decisions (a research file may recommend; the decision goes in `docs/decisions.md`) |

## Before exploring, read these

- `GLOSSARY.md`
- `docs/decisions.md`
- `docs/metric-definitions.md` when the work touches a number on a screen or the ROI page
- `docs/tolerance-matrix.json` when the work touches comparison logic

If a file does not exist yet, proceed silently. The `domain-modeling` skill creates `GLOSSARY.md` and `docs/decisions.md` rows when terms or decisions settle.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a test name, a screen label), use the term as `GLOSSARY.md` defines it. Do not use a synonym the glossary lists as "avoid."

If the concept is not in the glossary, either you are inventing language (reconsider) or there is a real gap (note it for `domain-modeling`).

## Recording a decision

Add a row to `docs/decisions.md` only when all three are true:

1. It is hard to reverse.
2. A future reader would be surprised by it.
3. It came from a real trade-off between options.

Rows marked "Settled before Phase 0" are not reopened by grilling. If research shows one is wrong, flag it to the user; do not change it silently.

## Flag conflicts

If your output contradicts a row in `docs/decisions.md`, say so explicitly:

> _Contradicts the decision of <date> (<decision>), but worth reopening because..._
