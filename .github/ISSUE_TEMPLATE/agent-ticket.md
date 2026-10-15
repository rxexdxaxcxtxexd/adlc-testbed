---
name: Agent ticket
about: Work for the agent. Label agent-ready when it is complete.
labels: []
---

# <Verb phrase: the outcome, not the task>

ID: <id>   Size: S | M | L (L must be split)   Owner of the outcome: <person>

## Outcome
One or two sentences: what is true when this is done, from a user's point of view.

## Why now
One sentence. Which Finance workflow or deadline this unblocks.

## Acceptance criteria
Each line must be checkable by a test, an eval case, or a command.
1. Given <input>, the tool returns <exact output>.
2. Totals match the reference file `<path>` to the cent.
3. Stale feed (older than <n> hours) is excluded and reported, not used.
4. CI is green: tests, lint, typecheck, gitleaks, osv-scanner, evals (if AI paths changed).
5. No new dependency unless listed in PLAN.md section 7 and the deps-approved label is set.

## Bounds (the agent must stay inside)
- Files or folders it may change: <globs>
- Max diff size: <n> lines changed. More than this, stop and ask.
- Data access: read-only. Writes need a separate ticket and a human approval step.
- Systems it may call: <list>. Everything else is off limits.
- Model and spend: <approved model>, token budget <n>, CI fix rounds max 3.
- Time box: <hours>

## Out of scope
- <Thing someone might assume is included, explicitly excluded>
- <Refactors, renames, formatting changes outside the bounded files>
- <Changing existing eval cases or CI config>

## Inputs and references
- Sample data: <path, synthetic only, no real Finance data in the repo>
- Related ADR or spec: <link>
- Rules that apply: R-001, R-002 (from AGENTS.md)

## Definition of done for the agent
PLAN.md approved, PR open, CI green or stop report posted, PR description lists what changed, what was tested, what was not tested, and any new rule candidates.
