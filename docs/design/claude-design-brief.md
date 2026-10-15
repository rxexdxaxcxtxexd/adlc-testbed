# Design brief: certificate compliance tool (hi-fi UX)

Hand-off to Claude Design. Written 2026-10-08, after ticket 08 of 13. The back end is mostly done; the leadership and CFO screens are not built yet. This brief gives you everything you need to design them, and the rules the result will be judged against.

## 1. What the product is

A small construction firm must hold a current certificate of insurance (COI) from every subcontractor on every project, before work starts and before each payment. Today an accountant does this by hand from email and a spreadsheet. This tool takes over the repetitive parts:

1. A subcontractor uploads their certificate (PDF) through a personal link. No sign-in.
2. AI reads the values off the PDF.
3. Ordinary code checks every coverage and limit against the project's requirements.
4. A named person approves what matters. Low-confidence readings always go to a person. Deficiencies go to the project manager, who waives (with a note) or rejects.
5. The tool tracks expiry, sends reminders at 30 and 7 days, and before each pay cycle lists who must not be paid and why (the payment hold list).

**The thesis the design must make visible:** AI reads, routes and drafts. Code calculates and decides. A person approves what matters. The AI is a careful reader, not a decision-maker. Do not dress it up as magic: no sparkles, no "AI-powered" badges, no model names on screen. Show the AI's confidence plainly, and show the person's name on every decision.

This is a portfolio proof of concept. All data is fictional.

## 2. Who judges the result

| Reader | What they want | Their question |
|---|---|---|
| CFO of a small construction firm, not technical | ROI, money at risk, polish | "Does this change a decision I make, what does it save or protect, and can I trust the number?" |
| Data manager | Data she can trust | "Where did this number come from, and when?" |
| Senior product designer (review panel) | Calm, polished, obvious when opened cold | "Does the user know what to do in five seconds, and does it look like a product a firm would pay for?" |

## 3. Hard rules (non-negotiable)

1. **Fictional everything.** Use only the fictional names in section 9, or new fictional ones in the same style. No real companies, insurers, brokers, logos or people.
2. **"Sample data" on every screen**, where the eye lands, not in a footer.
3. **Role switcher labelled "Demo only."** One account shows every role's view. The switcher must look like a demo control, not a real permission system.
4. **Status in words, never color alone.** Every status and tile color has its word beside it (and ideally an icon or shape).
5. **Every figure shows its source and last-updated time**, plus "Sample data". Source is a Sheet tab name in plain words (for example "Compliance records"), and last updated is a timestamp.
6. **No invented numbers.** A number appears only if it is defined in section 7. Do not add charts, trends, percentages or KPIs that section 7 does not define. If you want one, list it as a proposal in your hand-back and leave it out of the screens.
7. **No real certificate form.** The real industry certificate layout is believed to be licensed. If you show a certificate, use a generic "certificate-style" PDF thumbnail printed "SAMPLE: fictional certificate."
8. **No model or vendor names on screen.** Say "read automatically" or "reading confidence", not the model name.

## 4. Build target (so your design ports cleanly)

The app runs as a Google Apps Script web app (HtmlService). That shapes what is realistic:

| Constraint | What it means for the design |
|---|---|
| Plain HTML, CSS and JavaScript, one HTML file per app, no build step | Hand back plain HTML and CSS. No React, Tailwind, or component libraries. |
| Page runs inside a Google-hosted frame | No browser address-bar routing. Views switch inside one page. Deep links use URL parameters (`?record=REC-001&as=project_manager`). |
| Server calls are slow (about 1 to 3 seconds each) | Every view needs a designed loading state. Prefer skeletons over spinners. |
| External code only from cdnjs | pdf.js 3.11.174 already draws the PDF onto canvases. Icons must be inline SVG. |
| Fonts | Google Fonts or a system font stack. Pick one family plus a monospace for IDs and amounts if you want. |
| Two apps | **Internal app** (laptop first, 1280 to 1440 wide, must not break at tablet width). **Upload page** (phone first, 375 wide, used by a subcontractor in a truck). |

Light theme is required. Dark theme is optional.

Do not apply an existing design system or brand, including any default design system on the account. Build the tokens from this brief. The firm and product are fictional, so no real company's colors, fonts or logos belong here.

## 5. Vocabulary (use these exact words)

| Concept | Words on screen |
|---|---|
| Record status | Awaiting certificate, Needs review, In review, Compliant, Expiring soon, Expired, Closed |
| What a record waits for | Waiting for approval; Waiting for a decision on a deficiency; Needs review; Unreadable file; Nothing waiting |
| Project tile | On track (green), Watch (yellow), At risk (red) |
| Review mode | Review all, Review deficiencies, Automatic |
| Payment hold reasons | "No certificate received", "Certificate needs review", "Certificate waiting for a decision", "Policy expired", "Policy expired; renewal not yet approved", "No W-9 on file", "Record closed" (the words in `HOLD_REASON` and `holdReasons` in `src/Lifecycle.gs`) |
| People | Accountant, Project manager, Leadership, Subcontractor |
| One sub on one project | Compliance record |

Payment hold is a flag with reasons, not a status. A record can be Compliant and on hold (for example, no W-9 on file). "Expiring soon" is never a hold reason.

## 6. Screens to design

Design each screen in its key states: **loaded, loading, empty, error, and refused action** (a plain sentence saying why an action is not allowed, for example "Only the project manager or leadership can waive a deficiency").

### 6.1 Project tiles (leadership home)

- **Question it answers:** which project needs my attention?
- One tile per project. Each tile shows: color and word (On track / Watch / At risk), project name, "Compliant X of Y expected", expired, expiring within 30 days, below required limits, dollars on hold.
- Tile color rules, first match wins: **At risk** if anyone is expired or on payment hold. **Watch** if anyone is expiring within 30 days, awaiting, needs review, or has a certificate in the queue. **On track** only if everyone is compliant.
- Click a tile to open that project's worklist.
- Design for 4 projects.

### 6.2 Compliance dashboard

- **Question:** are we covered across the whole portfolio?
- The six numbers from section 7, rolled up across projects, each with source and last updated. Headline: "Compliant {X} of {Y} expected."
- Each number can lead to the records behind it.

### 6.3 Project worklist (accountant home)

- **Question:** what needs me today?
- One row per subcontractor: name, status, what it is waiting for, current expiry date, last action. Rows that need the current role sit at the top.
- The review mode control (leadership can change it; others see it disabled with a reason).
- Exists today in a plain form; redesign it.

### 6.4 Compliance record detail (the most important screen)

- **Question:** is this certificate right, and what do I do about it?
- Left: the certificate PDF, drawn page by page. Right: every value read, against the requirement, with pass or fail per line. Example line: "Umbrella: found $1,000,000, required $2,000,000, fail."
- Reading confidence, shown plainly. Below 85% the record always goes to a person; make that visible.
- The one next action for this role, prominent:
  - Accountant: **Approve**; **Correct a value** (edit fields inline, then the check runs again); **Send "please resend" draft** (shows the draft text first) for an unreadable file; **Mark W-9 on file / missing**.
  - Project manager or leadership: **Waive** (note required) or **Reject** (sends a fixed correction request listing each deficiency with value found and value required).
- Payment hold flag and its reasons, if on.
- Timeline: every event, newest first, each with date, person as "Name (Role)" or "System", and a one-line summary. Corrections show old value to new value.

### 6.5 Payment hold list

- **Question:** who must I not pay this cycle, and why?
- Rows: subcontractor, amount billed this cycle, every reason. Total dollars on hold. The pay date of the current cycle. Source and last updated.
- Read-only, visible to every role.
- Empty state: "No one is on payment hold for the pay cycle of {date}."

### 6.6 ROI page (for the CFO)

- **Question:** what does this return, net of what it costs to run, and how sure are we?
- Leads with the **likely** net value per year. Shows **low** and **high** beside it. Calls out the **low-case net value as the floor**.
- Lines: hours saved, lapse risk avoided, audit prep saved, running cost (AI spend plus upkeep hours), net value.
- Every input visible with low, likely and high values and its basis, written as "sourced: <where>" or "estimate: <reasoning>".
- **Refusal state:** if an input lacks a value or a basis, that line shows "Not shown" and names the missing input. Design this state; it is a selling point, not an error.
- The AI cost is tiny ("under $2 a year"). Upkeep hours dominate running cost. Do not hide that.

### 6.7 Upload page (subcontractor, phone)

- **Question:** how do I send my certificate?
- Names the subcontractor and the project. One big action: choose a PDF and send. PDF only, 5 MB cap.
- States: ready; sending; sent ("We received your certificate. You'll get an email when it is reviewed."); not a PDF; too big; duplicate (same file already received); link not active ("This upload link is not active. Contact the project team for a new one.").
- Tap targets at least 44 px. No sign-in, no account language anywhere.

### 6.8 Shared chrome

- Header with app name, "Sample data", the "Demo only" role switcher, and navigation between tiles, dashboard, worklist, payment hold list and ROI.
- Navigation may change by role, but every view must be reachable in the demo.

### 6.9 Emails (lower priority)

Approval, correction request, 30-day reminder, 7-day follow-up, deficiency notice to the project manager, "please resend". These are fixed plain text today. If you have time, propose a simple HTML email layout. Each must name each deficiency, the value found, the value required, and carry a link.

## 7. Every number allowed on screen

Defined in `docs/metric-definitions.md`. Nothing else appears.

| Number | Plain meaning |
|---|---|
| Expected | Open compliance records |
| Compliant | Open records with a passing (or fully waived) current certificate, not expired |
| Expired | Open records whose current certificate has expired, with no renewal |
| Expiring within 30 days | Current certificate expires today through 30 days out, with no renewal |
| Below required limits | Latest certificate has an unwaived limit shortfall |
| Dollars on hold | Sum billed this pay cycle by subcontractors on payment hold |
| ROI lines | Hours saved, lapse risk avoided, audit prep saved, running cost, net value; each low, likely and high, per year |

## 8. Design principles

1. **One job per screen.** The thing that needs the current person is on top and visually first. Not every metric gets equal weight.
2. **Money at risk is never buried.** Dollars on hold appear on the tiles and the hold list, not only as a count.
3. **Trust cues sit next to the number,** not in a footer: source, last updated, Sample data.
4. **People's names on decisions.** "Approved by Dana Reyes (Accountant), Oct 8" reads as a control a CFO trusts.
5. **Calm, not alarming.** Red is reserved for At risk, Expired and fail. A screen full of red means nothing.
6. **Plain words.** No acronyms on screen except W-9 and PDF. No technical IDs as the main label; IDs can appear small and secondary.
7. **Accessibility.** WCAG 2.1 AA contrast, visible keyboard focus, no color-only meaning, works on a laptop and a phone.

## 9. Fictional sample data for mockups

| Kind | Values |
|---|---|
| Firm | Invent one (for example "Harborline Builders"). Keep it fictional. |
| Project used in the build | Maple Court Residences (PRJ-001) |
| Other projects for tiles | Invent three, for example Cedar Point Lofts, Riverside Commons, Oak Hollow Clinic |
| People | Dana Reyes (Accountant), Marcus Webb (Project manager), Elena Park (Leadership) |
| Subcontractors | Ridgeline Roofing LLC (roofing), Birchwood Earthworks Inc. (earthwork), Brightway Electric, Summit Mechanical; invent more up to about 35 per project |
| Requirements (sample, not real) | General liability $1M each occurrence, $2M aggregate; auto $1M; umbrella $2M; workers' comp required; pollution $1M for roofing and earthwork; 30-day cancellation notice; additional insured endorsement required |
| Planted problems to show | Expired policy; $1M umbrella against $2M required; wrong insured name ("Ridgeline Roofing Partners LLC" on a Ridgeline record); missing additional insured endorsement; unreadable file; duplicate upload; no W-9 on file |
| Amounts billed | Realistic monthly pay applications, $5,000 to $60,000 |

## 10. The demo walkthrough your prototype should support

One person through one morning, ending on a decision:

1. Elena (Leadership) opens the tiles. Maple Court is **At risk**: one expired, $6,250 on hold.
2. She opens the payment hold list and sees who is held and why.
3. Dana (Accountant) opens the worklist. A certificate waits for approval; another needs review.
4. Dana opens the record, checks the PDF beside the values, corrects one value, and approves.
5. Marcus (Project manager) opens a deficiency: umbrella $1M against $2M. He rejects; the correction request goes out.
6. The CFO opens the ROI page: likely net value, the floor, and every input with its basis.

## 11. What to hand back

Hand back in two rounds. **Round 1 is items 1 and 2 only** (tokens and components). Stop there for review. Start the screens only after the owner confirms round 1, so a fix to a color or component carries into every screen instead of being repeated in each one.

1. **Design tokens** as CSS custom properties: color (including status colors that pass AA as text and as fills), type scale, spacing, radius, shadow.
2. **Components:** status pill, tile, metric card with source and freshness, table row, value-vs-requirement line, confidence indicator, timeline item, primary and secondary buttons, refused-action message, empty state, skeleton, "Sample data" badge, "Demo only" switcher.
3. **Hi-fi screens** for section 6.1 to 6.8, each in its key states, at 1440 wide (internal app) and 375 wide (upload page and one internal screen to prove it does not break).
4. **A clickable prototype** of the section 10 walkthrough.
5. **Annotations** naming the data field that fills each element (use section 5 and 7 terms), so the build can wire it without guessing.
6. **A list of proposals** you left out because they would add a number or behavior not in this brief.

## 12. Out of scope

Subcontractor self-service status portal; email intake; native mobile app; other languages; bonds, lien waivers or other document types; any accounts-payable integration beyond the payment hold list; charts of trends over time.

## 13. Owner notes: wiring the design into the repo

This section is for the owner, not for Claude Design. Do these steps after Claude Design hands back, and before ticket 09 starts.

### Rules the design must meet

1. The design comes back as plain HTML and CSS. Apps Script serves plain HTML with no build step. React or Tailwind output needs a full rewrite.
2. The design adds no numbers. A figure appears on screen only if `docs/metric-definitions.md` defines it. Keep every extra chart or metric in the proposals list, not in the build.

### Checkpoint after round 1 (tokens and components)

1. Run the `ux-reviewer` agent on the tokens and components. Check AA contrast on every status color, as text and as a fill.
2. Check that nothing comes from an existing design system or brand.
3. Send fixes back to Claude Design, then confirm round 2 (the screens).

### Steps after round 2 (screens and prototype)

1. Save the hand-back in `docs/design/`: the tokens as `tokens.css`, the screens in `screens/`, and the prototype link in a `README.md`.
2. Run the `ux-reviewer` and `cfo-reviewer` agents (`.claude/agents/`) on the mockups.
3. Fix every Block before ticket 09 starts. A fix in a mockup costs less than a fix in a built screen.
4. Check each screen against sections 3, 5 and 7 of this brief: "Sample data", "Demo only", status words, and only defined numbers.
5. Move the tokens into one shared file, `src/Styles.html`, that `Worklist.html` and `UploadPage.html` both include. This needs an `include()` helper in `Code.gs`.
6. Add the design files to the acceptance criteria of tickets 09, 10 and 12.
7. Add one row to `docs/decisions.md` that records the design adoption.
8. Put the proposals list in `docs/design/proposals.md` as ideas. Do not build them without a decision row.
