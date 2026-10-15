---
name: project-self-review
description: Review the project's own setup (CLAUDE.md, reviewer agents, skills, hooks, checks, lessons) for stale, repeated, contradictory and missing rules. Run after the panel at each milestone.
disable-model-invocation: true
---

# Project self-review

Keeps the project's instructions as sharp as the work. Code enforces and prose only reminds, so every repeated miss should end as a check.

1. **Read** `CLAUDE.md`, `.claude/agents/*.md`, `.claude/skills/*/SKILL.md`, `.claude/settings.json`, `scripts/checks/`, `docs/lessons.md`, `docs/decisions.md` and the latest milestone doc in `docs/milestones/`.
2. **Find**, citing a file and line for each:
   - **Stale**: a line in `CLAUDE.md`, an agent or a skill that no longer matches the spec, the decisions log or the code.
   - **Repeated lesson**: a lesson in `docs/lessons.md` seen two or more times. Propose a check in `scripts/checks/` or a test; propose a `CLAUDE.md` rule only when code cannot enforce it.
   - **Contradiction**: two files that disagree on a definition, threshold, owner or name.
   - **Gap**: a milestone success test or hard rule with no check, test or reviewer row covering it.

   Done when every lesson in `docs/lessons.md` is either covered by a check or listed as a finding.
3. **Propose.** Output a findings table (type, file, finding, proposed change), then the proposed diffs. Wait for the user's approval.
4. **Apply** the approved diffs and run `npm test`. Add a row to `docs/decisions.md` only for a change that meets the test in `docs/agents/domain.md`.
