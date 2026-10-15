# PLAN: <ticket id and title>

Status: draft | approved by Lucas on <date> | superseded
Ticket: <link>
Branch: agent/<ticket-id>-<slug>
Author: <agent name and model>

## 1. Outcome (copied from ticket, one sentence)

## 2. Files
| File | New or edit | What changes | Why |
|---|---|---|---|
| src/... | edit | ... | ... |

Files I will NOT touch (from the ticket's bounds): ...

## 3. Approach
1. Step one, concrete.
2. Step two.
Alternatives considered and rejected, one line each.

## 4. Money and data handling (delete if none)
- Where money math happens, and that it is deterministic code (Tier 0 item 9).
- Which feeds are read, their owner, freshness rule (Tier 0 item 6).
- Read-only or write? If write: who approves and how (Tier 0 item 3).

## 5. Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|

## 6. Test plan
- Unit tests to add: ...
- Fixed-case eval cases to add or change (list IDs, expected outputs): ...
- Edge cases: empty input, stale feed, negative amounts, rounding, timezone.
- Manual check Lucas should do: ...
- Commands that must pass: `npm test`, `npm run lint`, `npm run typecheck`.

## 7. New dependencies (each one needs a line, or write "none")
| Package | Version | Why needed | Existing alternative checked | npq or GuardDog result | osv-scanner result |
|---|---|---|---|---|---|

## 8. Rollback
- How to undo: revert PR <how>; migrations have a down step: yes/no/NA.
- Data written that cannot be reverted: none | describe.
- Feature flag or config switch: ...
- Time to roll back: ...

## 9. Open questions for Lucas
1. ...

## 10. Spend and bounds
- Max CI fix rounds: 3. Max agent token budget: <n>. Stop and report if exceeded.
