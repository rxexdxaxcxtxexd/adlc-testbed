---
name: run-the-panel
description: Runs the five reviewer agents on a milestone, doc, screen or build and returns one combined verdict table. Use at each milestone's stage gate, or when asked to "run the panel" or "review with the panel".
---

# Run the panel

The panel judges cold: each reviewer gets the target and the stage, never the author's view of the work. The panel reports; fixes come after, as a separate step.

1. **Target.** Use the file, folder or milestone named in the request. If none is named, use the milestone doc in `docs/milestones/` that is in progress. Done when you can list the target paths.
2. **Lenses.** Find the milestone's row in the stage table below and take its lenses. A target outside the table gets all five. Done when each lens maps to one agent in `.claude/agents/`.
3. **Evidence.** Run `npm test` in `coi-poc/` and keep the last 30 lines of output for the engineering reviewer.
4. **Review.** Start one subagent per lens, all in one message so they run in parallel. Each brief holds only: the milestone name, the target paths, and (engineering only) the test output. Done when every lens has returned a verdict in the shape of `docs/agents/reviewer-report.md`; re-ask any reviewer whose reply breaks that shape.
5. **Combine** into one table:

   | Lens | Verdict | Top issues | Fix |
   |---|---|---|---|

   Below it, list every Block first. Then state whether the milestone can close: it closes only with zero Blocks.
6. **Record.** Append one line to `docs/lessons.md` for every Block, and for every Fix that repeats a lesson already there. Paste the combined table into the milestone doc's "Panel result" section.

## Stage table

| Milestone | Target | Lenses |
|---|---|---|
| 1 Foundation | `docs/milestones/1-foundation.md`, `.claude/`, `scripts/`, `tests/`, `src/` | engineering, data |
| 2 Intake and reading | `docs/milestones/2-intake-and-reading.md`, `src/`, `tests/` | engineering, data, ux |
| 3 Checking and decisions | `docs/milestones/3-checking-and-decisions.md`, `src/`, `tests/`, `docs/tolerance-matrix.json` | engineering, data, cfo |
| 4 Screens | `docs/milestones/4-screens.md`, `src/`, `docs/metric-definitions.md` | ux, cfo, data |
| 5 Automation | `docs/milestones/5-automation.md`, `src/`, `tests/` | engineering, data, cfo |
| 6 Audit and handoff | `docs/milestones/6-audit-and-handoff.md`, `docs/handoff-runbook.md` | cfo, data, ux, engineering, claims |

After the panel, suggest `/project-self-review`.
