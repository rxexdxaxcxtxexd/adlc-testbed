# Issue tracker: Local Markdown

Issues and specs for this project live as markdown files in `coi-poc/.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`, never a single combined tickets file. A ticket inserted between two others takes the earlier number plus a letter (for example `08b`)
- Each issue file has a `Status:` line near the top: `open`, `in-progress` or `done`. No triage labels are used.
- Each issue file has a `Blocked by:` line listing ticket numbers, or `none`
- Each issue file has a `Milestone:` line naming the build phase (1 to 6) whose success test it moves toward
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed).

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.
