# Design critique vocabulary — shared terms for the owner, agents and reviewers

Version 2, 2026-10-08. Written after four rounds of owner feedback so that
every critique, report and hand-off uses the same words for the same
problems. Any agent critiquing a screen MUST name findings with these terms,
cite the test that failed, and apply the fix pattern. Any new recurring
complaint gets a new term added here, not a paragraph of prose elsewhere.

## Bones vs finish (the frame that governs all work)

The owner's ruling (2026-10-08): **the bones are right; the finish is the
work.** Bones = pages, layout structure, element inventory, wording, data,
states, flows, accessibility. The bones are LOCKED and must not be
redesigned. Finish = everything the user senses on top: material, depth,
type, color, enclosure, state response, motion. The goal in the owner's
words: "high-end, high-design, high-interaction, tasteful animation,
professionally delight." Every critique must say which layer it is about.

## The six tests

Run these on any screen or variant before reporting it.

1. **Squint test (depth).** Blur the screen. If cards and surfaces do not
   separate instantly from the canvas, the screen is flat.
2. **Blur test (affordance).** Blur the screen. Identify what is clickable.
   If a static element reads as clickable, or a clickable element does not,
   the grammar is wrong.
3. **Next-step test.** A viewer who does not know the product must be able
   to state the screen's single intended next action in under five seconds
   of looking. If they cannot, hierarchy has failed.
4. **Ink audit.** List every visible element. Grade each: serves the next
   step, supports trust (source, date, identity), or neither. "Neither"
   must be removed or demoted.
5. **State test.** Hover, press, focus and disable every interactive
   element. Each state must respond visibly within 100ms and be
   distinguishable from every other state.
6. **Pairwise diff (variants only).** Two variants must differ on five or
   more of: background luminance, type family, type scale, surface
   strategy, accent, status tuning, density, radius, elevation, motion.

## The terms

Each entry: the owner's words, the definition, the failed test, the fix.

### 1. Convergence
Owner's words: "they look the same."
Two or more variants differing only in cosmetics (font, radius, shadow)
on an identical structure. Failed test: pairwise diff.
Fix: change registers (background strategy, type strategy, surface
strategy), not skins.

### 2. Equal weight
Owner's words: "busy."
No dominant element. All elements carry similar visual mass, so the eye has
no entry point. Failed test: squint (no single focal point), next-step.
Fix: name one hero element per screen. Demote the rest in size, weight and
contrast until one thing clearly dominates.

### 3. E-Ink flatness
Owner's words: "looks almost like an E-Ink UI."
One visual plane. Borders are the only separator. No elevation. Failed
test: squint.
Fix: three elevation tiers (canvas, surface, raised), each separated by
fill change AND layered shadow, plus a 1px inner top highlight on raised
surfaces.

### 4. Cold register
Owner's words: "cold, like IBM dreamed of an app."
Blue-grey neutrals, corporate navy, no warmth anywhere. Failed test: hex
audit — all neutral hues in the 220-260 degree band.
Fix: named warm bias on neutrals (bone, paper, cream). Cold is legal only
when a direction claims it deliberately and still passes depth.

### 5. Spindly type
Owner's words: "the font is unusual and really skinny."
Thin strokes at small sizes that read fragile at 100% zoom. Failed test:
100% zoom inspection.
Fix: body weight 450-500. No condensed or narrow faces. If a face looks
thin at 400, raise the weight or change family.

### 6. Chrome noise
Owner's words: "demo and preview elements everywhere, duplicitous titles."
System and demo chrome (Sample data, Demo only, Local preview, Viewing as)
rendered at product-UI volume, plus repeated brand and title text. Failed
test: count competing header tiers; more than three above the content
fails.
Fix: all demo chrome in ONE muted corner strip, 12px, no boxes. Brand
appears once. Page header is project eyebrow + H1 + one line. Config
controls leave the page flow.

### 7. Affordance blend
Owner's words: "tabs, buttons, everything just blends into the page."
One component anatomy for all controls. Solid-filled status chips that look
like buttons. Failed test: blur.
Fix: four distinct grammars — nav tabs (text + active indicator), filter
chips (quiet pills), action buttons (filled, elevation on hover), status
(tint + text + dot, never solid). Solid fill is reserved for things you
click.

### 8. Boxy
Owner's words: "too rigid and boxy."
Enclosure as the default: every region a rectangle, uniform corner radii,
boxes inside boxes, banded title bars on every panel, the grid visible
everywhere. Failed test: count the enclosures that whitespace or alignment
could replace; more than two fails.
Fix: enclosure requires a reason. Default to separating with whitespace,
alignment and type weight. Reserve boxes for surfaces that must read as
raised objects, and for the one hero element.

### 9. Ink waste
Owner's words: "each character and pixel evaluated for placement."
Ink that does not serve the next step or support trust: redundant labels,
two words where one works, icons that do not speed scanning, borders where
space separates, numbers shown twice. Failed test: ink audit.
Fix: remove or demote. Shorten labels until removing one more word loses
meaning.

### 10. Next-step drift
Owner's words: "diminish noise and focus the user on the information they
need for the next step."
The screen does not make the user's single next action obvious. Failed
test: next-step test.
Fix: state the screen's next action in one sentence before designing.
Order the hierarchy so that action is the first or second thing the eye
finds. Everything else is support.

### 11. Stamped control
Owner's words: "high-interaction... professionally delight" (its absence).
Interactive elements with no tactile response: hover and press look the
same, controls feel printed on the page rather than machined. Failed test:
state test.
Fix: every control gets hover, active, focus, disabled and busy states,
each distinct, transitioning in 90-200ms. Press should compress (scale
.98 or deepen fill). Hover should lift or fill. Focus must be visible.

### 12. Cheap motion
Owner's words: "tasteful animation" (its violation).
Motion that decorates instead of explains: bounces, overshoots, sweeps, or
motion missing where continuity is needed (results appearing with no
transition). Failed test: owner's eye; round-3 brief section 4.
Fix: motion explains what changed or where something went. Two to three
durations (90-240ms), one ease-out family, transform and opacity only.
One signature moment per screen maximum — the rest is quiet continuity.

## Hard standards (the positive space)

These bind every variant regardless of register.

1. **Depth.** Three elevation tiers minimum, separated by fill AND shadow
   (on dark grounds, by fill steps and inner top highlights — shadows read
   weak on dark).
2. **Temperature.** Neutrals carry a named bias, warm by default.
3. **Type.** Body 450-500, solid strokes at 100% zoom, tabular numerals
   for all data.
4. **Grammar.** The four component grammars above, never interchangeable.
5. **Chrome.** One muted strip, brand once, header of three lines.
6. **Enclosure.** Boxes by reason, not default.
7. **Step.** Every screen names its next action before it is designed.
8. **Interaction.** Every control answers hover, press, focus, disabled
   and busy within 100ms, visibly and distinctly. Controls feel machined,
   not stamped.
9. **Motion.** Motion explains change, 90-240ms, ease-out, transform and
   opacity only, reduced-motion honored. One signature moment per screen.

## Ban list

- No purple/indigo/violet gradients or gradient decoration; no
  glassmorphism; no glow. (Violet as the in-review status semantic is fine.
  Shadows and layering are required — flatness is a defect, not restraint.)
- No Inter, Roboto, Arial, Open Sans as the identity font.
- No pure black or pure white grounds; no untinted grey.
- No uniform radius across all components.
- No bounce/elastic easing; motion 90-360ms, ease-out, transform/opacity
  only; honor reduced-motion.
- No badge or icon above every heading. No nested cards.
- Status never a solid-filled chip. Solid fill means clickable.