# Round 3 brief: refinement pass (enterprise-grade UI and motion)

Written 2026-10-08, after Round 2 was approved. Read `claude-design-brief.md` first; this brief adds to it and wins only where it says so.

## 1. Why this round

Round 2 got the structure, states, data and rules right. It looks generic. The CFO wants a first-class, enterprise-grade product: the kind of tool a finance team trusts with money decisions and is proud to show an auditor. This round raises the visual and interaction quality without changing what the product does.

The bar is a mature finance or operations product used all day by real people: precise, calm, dense where it helps, quick to read, and alive in the small moments. It is not a marketing site. No hero sections, gradients for show, glassmorphism, oversized type or decorative illustration.

## 2. What stays fixed

1. Every hard rule in section 3 of the main brief: fictional data, "Sample data" where the eye lands, the "Demo only" switcher, status in words never color alone, source and last-updated on every figure, no invented numbers, no real certificate form, no model or vendor names.
2. The vocabulary in section 5 and the numbers in section 7 (`docs/metric-definitions.md`). Nothing new on screen that counts, compares or trends.
3. The screens, their states and their data. `docs/design/screens/field-notes.md` must stay true: each element keeps the field that fills it.
4. The sample data and the section 10 walkthrough, including every figure (Maple Court: Compliant 32 of 35 expected, 1 expired, $6,250 on hold).
5. All visible text that comes from the code: success messages, refusals, upload messages, the resend and correction email text.
6. Red only for At risk, Expired and fail. Calm, not alarming.
7. WCAG 2.1 AA: contrast, visible keyboard focus, no color-only meaning, works at 375 wide.

## 3. What is open

1. **The visual language.** Type family and scale, color palette, surfaces, borders, elevation, density, icon style, data presentation. You may replace tokens in `tokens.css`. List every changed or new token with the reason, and recheck AA for every status color as text and as a fill.
2. **Layout polish.** Alignment, rhythm, hierarchy, how numbers and money are set (tabular figures, alignment, units), table design, empty and error states that feel designed, not default.
3. **Interaction.** Hover, focus, pressed and selected states on everything clickable. Keyboard support where a power user would expect it (moving through worklist rows, Approve from the keyboard, Escape to cancel an edit). Inline editing that feels direct. Clear feedback after every action.
4. **Motion.** A small, consistent motion system (see section 4).

## 4. Motion rules

Motion must explain what changed or where something went. Never motion for decoration.

1. Define motion tokens: two or three durations (for example 120 ms, 200 ms, 320 ms) and one or two easing curves. Use them everywhere.
2. Good uses: a row leaving "Needs you" after an approval; the payment hold flag clearing; a value line turning from Fail to Pass after a correction; a tile changing color and word; panels and drafts opening in place; skeletons resolving into content; the PDF page drawing in; toasts for success messages; the walkthrough moving between steps.
3. Animate only `transform` and `opacity` (and color where needed). No layout jank. Keep everything at 60 fps on a mid-range laptop.
4. No count-up animation on money or on any section 7 number. Figures appear settled; a CFO must never see a number in motion.
5. Honor `prefers-reduced-motion`: replace movement with an instant change or a short fade.
6. Server calls take 1 to 3 seconds. Use motion to make waiting feel shorter (skeletons, a pressed button that holds its state), never to hide a result.

## 5. Build target (stricter than Round 2)

Round 2 came back in the design tool's own format (`.dc.html` plus `support.js`), which cannot ship. This round's output must be the code we ship:

1. Plain HTML, CSS and vanilla JavaScript. No React, no frameworks, no build step, no design-tool runtime.
2. One shared stylesheet (`refined/styles.css`, tokens first) that every screen links. It becomes `src/Styles.html` in the build.
3. One HTML file per screen in `refined/`. Views switch inside a page; no address-bar routing.
4. External code only from cdnjs (pdf.js 3.11.174 for the certificate). Fonts from Google Fonts or the system stack. Icons as inline SVG.
5. Sample data as plain JavaScript objects at the top of each file, shaped like `field-notes.md`, so the build can swap them for server calls.

## 6. How to work

1. **Direction first.** Show two or three distinct visual directions applied to one screen (the compliance record detail), each with a one-paragraph rationale. Stop. The owner picks one.
2. **System next.** Apply the chosen direction to `styles.css` (tokens, components, motion tokens) and a component page that shows every component in every state. Stop for review.
3. **Screens, in this order:** record detail, worklist, project tiles, compliance dashboard, payment hold list, ROI page, upload page (375 wide). Stop after every two screens.
4. **Walkthrough last:** the section 10 walkthrough as one clickable HTML file, with motion between steps.
5. After each stop, check against section 2 of this brief and list anything you were unsure about.

## 7. Hand-back

Everything in `docs/design/refined/`: `styles.css`, `components.html`, one HTML file per screen, `walkthrough.html`, and `notes.md` (changed tokens with reasons, contrast ratios, the motion tokens, anything left out as a proposal).

## 8. Fixes from the Round 2 review (added 2026-10-08)

The owner's reviewers returned Fix, with no Block. Apply each item below. Where an item changes something section 2 holds fixed, this section wins. The decisions behind them are in `docs/decisions.md`, Phase 4.

### Words and data

1. Record header: show "Expires" only. Remove "Policy period". A queued certificate's date reads "Certificate under review expires {date}", apart from the current certificate. The worklist uses the same words.
2. Payment hold reasons use the code's words: "No certificate received", "Certificate needs review", "Certificate waiting for a decision", "Policy expired", "Policy expired; renewal not yet approved", "No W-9 on file", "Record closed". The awaiting status reads "Awaiting certificate". See brief section 5.
3. A record with nothing pending shows "Nothing waiting".
4. The correction request names the value found and the value required for every line, for example "Insured name: certificate shows Ridgeline Roofing Partners LLC; must read Ridgeline Roofing LLC" and "Additional insured endorsement: not shown; required".
5. Correct a value needs a short note. The timeline shows the old value, the new value and the note.
6. Plant one misread value on Brightway Electric. Walkthrough step 4 shows Correct a value, then Approve.
7. One record ID format everywhere: REC- and three digits.
8. Dollars on hold show one "Updated" time on the tiles, the dashboard and the hold list: the newest `last_updated` among the held records. Use the same source words on all three.
9. The values card source reads "Certificates · Project requirements".
10. The ROI source reads "ROI inputs". Every estimate basis gives a reason. Never show "estimate: placeholder".
11. Ridgeline and Brightway are In review but not on hold. Make it plain on screen that they have no bill this pay cycle.

### Layout

12. When the record detail columns stack, put the next-step panel and its deficiency list above the PDF. Shrink the PDF to a "View certificate" control.
13. Give Waive and Reject equal visual weight.
14. ROI: the floor text says each input is at its least favourable value, not its low value. Show reading spend and upkeep as separate amounts in running cost. The table must not clip the High column at 958 px wide.
15. Walkthrough: the "Demo only" bar must not cover the row that a step points to.
16. At 375 wide, every navigation item stays reachable without a sideways scroll.
