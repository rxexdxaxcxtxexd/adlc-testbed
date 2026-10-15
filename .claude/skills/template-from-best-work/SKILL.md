---
name: template-from-best-work
description: Turn a finished doc that passed the panel with no Block into a reusable template in docs/templates/.
disable-model-invocation: true
---

# Template from best work

Templates come from this project's own best finished work, so each one carries what made the original pass.

1. **Confirm** the source's milestone doc shows a panel result with zero Blocks. If it shows any Block, or no panel result, stop and say so.
2. **Copy the structure** into `docs/templates/<name>.template.md`:
   - Keep the headings, table shapes, order, and the guidance that made it strong.
   - Replace project-specific content with `{{placeholder}}` fields, each with a one-line hint.
   - Keep each section's "done when" test.
3. **Add a header block:**
   ```
   template: <name>
   promoted_from: <source path>
   promoted_on: YYYY-MM-DD
   why_it_worked: <one line: what the reviewers credited, from the milestone doc>
   ```
4. **Existing template?** If `docs/templates/<name>.template.md` exists, show the diff and ask before replacing it.
5. **Index** the template with one row in `docs/templates/README.md`.
