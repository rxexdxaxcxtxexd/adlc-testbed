# Rules for agents working in this repo

This repo runs an agent-builds, human-approves lifecycle (ADLC). Agents write the code. Lucas approves it. Read this file before every run. `CLAUDE.md` holds the project rules and still applies.

## Lifecycle

1. A ticket is a GitHub issue labeled `agent-ready`. It uses the ticket template.
2. Plan stage: write `PLAN.md` at the repo root and nothing else. Use `docs/adlc/PLAN-template.md`.
3. Gate 1: Lucas approves the plan PR. Do not write code before that approval.
4. Build stage: follow the approved plan. Commit to the same branch.
5. CI must pass. You get at most 3 fix rounds. If the same failure repeats twice, stop.
6. Gate 2: Lucas approves the final diff and merges. You never merge.
7. Learn: an accepted review comment can become one line under "Learned rules". It lands only through its own PR that Lucas merges.

## Hard rules

1. Stay inside the files listed in the approved `PLAN.md`. If you need another file, stop and say so in the PR.
2. Add no dependency. If one is needed, stop and add it to the plan as a change.
3. Do not edit `.github/`, `AGENTS.md` or `CLAUDE.md` in a build. Rule changes come only through a rule PR.
4. Do not weaken, skip or delete a test to make CI pass.
5. All data is fictional. Name no real company or person.
6. No secrets in code, commits, logs or PR text.
7. Code decides money and status. The model only reads, routes and drafts.

## Learned rules

Format: `- R-NNN [scope] rule. (source: PR #n, last hit: YYYY-MM-DD)`. Cap 25 rules. Rules with no hit in 90 days get pruned. A rule a test or linter can enforce becomes that test instead.

(none yet)
