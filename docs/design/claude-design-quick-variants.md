# Quick variant mocks: the finish layer (Claude Design handoff)

## What this sets up

Fast variant mocks to set the finish direction quickly. NOT full redesigns.
The owner's ruling: the bones are right (pages, structure, element
inventory, wording, data, states) and are LOCKED. The finish is the work:
material, depth, type, color, enclosure, state response, motion. The goal
in the owner's words: high-end, high-design, high-interaction, tasteful
animation, professionally delight. One evening of work; the owner picks a
direction fast; the winner gets built out by the normal Round 3 process.

## Read before designing

1. `coi-poc/CLAUDE.md` — hard rules (anonymization, sample data, no
   employer names). Non-negotiable.
2. `coi-poc/docs/design/round-3-refinement-brief.md` — section 2 ("What
   stays fixed") and section 4 (motion rules) bind in full.
3. `coi-poc/docs/design/critique-vocabulary.md` — the shared terms. Use
   them in every self-critique and report. The six tests and the hard
   standards apply to every mock below.
4. The real build, which is the starting material:
   - `coi-poc/src/Styles.html` — the current finish (inventory below)
   - `coi-poc/src/Worklist.html` — the worklist screen markup
   - `coi-poc/src/AppClient.html` — the record detail and other views

## Current finish inventory (what you are replacing)

Facts from the live `src/Styles.html`, so the starting point is not a
guess:

- Every major component is wrapped in a 1.5px solid ink border: panels,
  tiles, metrics, record title, mode box, notices, dialogs, the ROI hero.
  Zero box-shadow declarations exist anywhere. This is the E-Ink and
  Boxy diagnosis in code form.
- Cold palette: canvas `#e6edf0`, ink `#15394b` (steel navy), chrome
  `#dae4e9`. All neutrals in the blue-grey band. This is the Cold register
  diagnosis.
- IBM Plex Sans at 400/500 — the Spindly type risk at 14px body.
- Horizontal striping: panel title bars, table headers and the app nav all
  carry a chrome background band. Adds Enclosure weight everywhere.
- A 24px graph-paper grid background on main. Drafting identity; reads as
  noise against the "few degrees more minimal" goal.
- Status pills carry border + tint + text: three marks per status.
- Motion tokens exist and are good (120/200/280ms,
  cubic-bezier(.22,1,.36,1), reduced-motion honored) but are barely used:
  two keyframes total (page reveal, loading bar). Buttons and tiles change
  hover color instantly with no transition. No press states, no lifts, no
  elevation changes. This is the Stamped control diagnosis.
- The good news: motion tokens, focus-visible, tabular numerals, skip
  link and responsive scaffolding are already correct. Keep all of it.

## The target in one paragraph

The register is Harbor: warm bone canvas, elevated white surfaces, layered
shadows, 1px inner top highlights, solid 450+ weight type, one confident
warm accent chosen by the mock itself from the terracotta/moss/ochre
family (owner delegates the accent to the mocks: each mock proposes one,
the comparison page names each accent for the pick), status as tint +
text + dot, chrome demoted to one muted corner strip. Pushed a few degrees
more minimal than anything built so far: each character and pixel
evaluated against the user's next step, enclosure by reason, not by
default. And the finish includes the interaction layer: machined controls
(distinct hover/press/focus/busy states) and tasteful motion that explains
change. Minimal must not collapse into E-Ink flatness.

## Scope discipline (this is what makes it fast)

1. Two screens only: the worklist and the record detail. Work on COPIES of
   the real markup — copy `src/Worklist.html` and the record-detail view
   markup from `src/AppClient.html` into the output folder. The bones
   (element inventory, wording, data) stay byte-identical; only the finish
   layer changes. This makes the three variants directly comparable and
   the winner trivially portable back into `src/Styles.html`.
2. Exactly three mocks plus one comparison page. Do not add more.
3. Each mock is self-contained HTML with its own inline stylesheet — a
   restyled copy of the real screen, plus the interaction layer below.
4. Output to `coi-poc/docs/design/quick-variants/`:
   `v1-boxless.html`, `v2-one-surface.html`, `v3-harbor-30.html`,
   `index.html` (side-by-side links, one-line rationale each).
5. Skip anything not needed to judge the direction: no responsive work
   beyond not breaking at 1440, no empty/error state redesign, no
   component page, no build integration.

## The three mocks (positions on the minimal axis)

All three sit in the Harbor register with the full interaction layer. They
differ only in how far down the minimal axis they go. The owner is
choosing a position, not a style.

### v1-boxless — the far end
- Zero enclosures. No cards, no boxes, no bordered panels. Hierarchy is
  carried entirely by typography, whitespace, alignment, and hairline
  rules where truly needed. Status is inline colored text with a small
  dot. The table is pure rules and rows on one continuous warm ground.
- This mock tests the floor: if the squint test fails here, that failure
  is data about the axis, not something to hide — report it.

### v2-one-surface — the deliberate middle
- Exactly one enclosed, raised surface per screen: the next-step panel
  (record detail) or the table (worklist). Everything else sits open on
  the canvas, separated by space and type.
- The one surface gets the full depth treatment: layered shadow, inner
  top highlight, clear elevation. The contrast between the one raised
  object and the open field IS the design.

### v3-harbor-30 — Harbor standard, 30% less ink
- The layered Harbor register as specified, then a full ink audit and
  enclosure audit applied: every element graded against the next-step
  test, every enclosure justified, every label at minimum length.
- Roughly 30% less visible chrome, text and borders than the current
  Drafting build (`src/Styles.html` inventory above). Same information,
  less ink.

## The interaction layer (required in all three mocks)

The owner named interaction and animation as part of the finish. Each
mock must demonstrate it, not describe it:

1. Full control state set: every button, tab, filter, row and input gets
   hover, active (press compresses: scale .98 or fill deepens), focus,
   disabled. Transitions 90-200ms ease-out on transform, opacity and
   color.
2. Two to three signature micro-interactions per mock, chosen from the
   product's real moments: a row leaving the worklist after an approval,
   a value line turning Fail to Pass, the PDF panel drawing in, the
   confidence bar settling, a toast landing. Implement them with CSS
   transitions/keyframes on the real markup (a click or two of JS to
   trigger is fine — this is a mock, the interactions must be FEELABLE).
3. A motion spec comment block at the top of each file: durations,
   easings, and one sentence on this mock's motion personality.

## Self-critique before reporting (mandatory)

Run the six tests from `critique-vocabulary.md` on each mock: squint
(depth), blur (affordance), next-step (state the action, time it), ink
audit (list the "neither" elements and remove them), state test (hover and
press everything), and report findings using the vocabulary terms. Fix
what fails, then report.

## Report-back checklist

- [ ] CLAUDE.md hard rules read and restated in one line
- [ ] Three mocks + comparison page in `quick-variants/`, all in Harbor
      colors/type, bones byte-identical to the real screens
- [ ] Each mock: self-critique table (test, finding in vocabulary terms,
      fix applied)
- [ ] Next-step sentence for each of the two screens, stated at the top
      of the report
- [ ] Each mock: enclosure count reported; interaction states present and
      listed; the two-three signature micro-interactions named
- [ ] Motion spec comment block present in each file
- [ ] The three mocks visibly differ in enclosure count and motion feel
- [ ] A one-line recommendation with reasoning: which position the mocks
      argue for and why
- [ ] Stopped after the three mocks — no component page, no
      `src/Styles.html` changes, no app code

## Pitfalls

- Minimal is not empty. If a screen loses the next-step test, hierarchy
  was removed, not noise. Put hierarchy back with type scale and spacing.
- Minimal is not flat. The depth standard survives: v1 may fail the squint
  test (that is its job), but v2 and v3 must pass.
- Interaction is not decoration. If a micro-interaction does not explain
  a real change in this product, cut it — that is the Cheap motion term.
- Do not blend the three positions into one safe average — that is the
  Convergence failure mode. Keep them at arm's length from each other.
- Do not touch locked wording, numbers, element inventory or data to make
  the design easier. Bones win over aesthetics.
- The owner picks fast. Spend the effort making the three positions
  unmistakably different and the interactions feelable, not polishing any
  one of them.