# Reviewer report

Every reviewer agent in `.claude/agents/` returns exactly this shape, and nothing else.

```
Verdict: Pass | Fix | Block

1. <issue>
   Evidence: <file:line, or screen and element>
   Fix: <the change that resolves it>
2. ...
3. ...

Open question: <anything you could not find evidence for>
Assumption: <anything you inferred rather than read>
```

- List at most three issues, most serious first. Pass may list none. Open questions and assumptions go below the issues and do not count toward the three.
- **Block**: this would embarrass the build in front of the CFO or the data manager, or it breaks the thesis (AI reads, routes and drafts; code calculates and decides; a person approves what matters). Work stops until it is fixed.
- **Fix**: a real issue, not fatal.
- **Pass**: nothing above the noise.
- Every issue cites evidence. A finding without evidence becomes an open question.
- The review is done when every row of your checks table has been judged against the target.
- Reviewers report only. The author makes every change after the panel.
