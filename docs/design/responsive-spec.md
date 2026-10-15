# Responsive spec: COI Check on phone, iPad and desktop

Status: spec only. No app code was changed. Layer rule: the bones (screens, wording, data) and the Drafting finish (colors, Geist, shadows) are locked. This is layout adaptation only.

Evidence: screenshots in a local `shots/<w>x<h>/` folder (not committed; regenerate with `shoot.py`) and measurements in `docs/design/responsive/metrics.json` (capture script: `docs/design/responsive/shoot.py`). Sizes: 375x812, 430x932, 768x1024, 1024x768, 820x1180, 1180x820, 1280x800, 1440x900, 1920x1080.

Preview-only note: the "Local preview" bar (`div.well.notice`, 183px tall at 375) is injected by `scripts/build-preview.js`. It is not in the deployed app. Fix it in the preview script only if the public link is the preview. Do not count it as an app defect. Ignore it when judging the app's own header height.

## 1. Summary

1. No screen scrolls sideways at the page level. `scrollWidth` equals the viewport at every size (0px overflow). The shell never breaks.
2. The sidebar is a 68px icon rail below 900px (JS sets it closed by default, `AppClient.html:16`). It works, but it takes 68 of 375px, so content is 307px wide.
3. Opening the rail on a phone does not overlay. It pushes the main column to 111px (375 wide) and the page becomes unreadable (`sidebar-open.png`). This is the worst defect.
4. Tables stay tables on phones. `.table-scroll` scrolls inside a 235px box (Projects 892px, Subcontractors 1058px, Worklist 589px). Names wrap to 3 lines. Status and action columns are cut off. Users cannot see the next action.
5. Tap targets are small everywhere: nav buttons 40px high, `.btn.small` 32px, `.seg` buttons 32px, icon buttons 30px, back button 32px. 15 to 79 elements per screen are under 44px.
6. Every input and select is under 16px (13 to 14.5px). iOS Safari will zoom the page on focus. The header search is 13.5px and sits on every screen.
7. The sticky page header takes 104 to 203px of an 812px phone screen (title, pill, project picker and search all stack, then stick).
8. The segmented filters (`.seg`) are wider than the screen (Worklist 695px in 267px) and clip with no hint.
9. The tour card already docks to the bottom on phones and works. It lacks safe-area padding and covers the element it points at. The welcome card fits. The upload page is close to good: one column, full-width button, but the 48px left header indent does not match the 20px content indent, and the button is 42px.
10. Desktop and iPad landscape (1024+) are fine. At 1024 and 1180 the sidebar is open and leaves 760 and 916px of content. That is acceptable.

## 2. Breakpoint system

Use four tiers. Mobile-first rules are not needed. Keep the existing max-width queries and add one.

| Tier | Name | Range | Devices | Nav | Content |
|---|---|---|---|---|---|
| T1 | `phone` | 0 to 599px | iPhone 375, 430 | Bottom tab bar (5 tabs + More) | One column. Card lists replace wide tables. |
| T2 | `tablet` | 600 to 899px | iPad portrait 768, 820 | 68px icon rail, tap logo to open as an overlay drawer | One to two columns. Tables scroll with a sticky first column, or stay if they fit. |
| T3 | `compact` | 900 to 1239px | iPad landscape 1024, 1180, small laptops | Sidebar open (264px), collapsible | Two columns. Panels stack. Detail grid is 2 columns. |
| T4 | `wide` | 1240px and up | Desktop 1280 to 1920 | Sidebar open | Current layout. Cap content at 1440px so 1920 does not stretch. |

Mapping onto existing rules:

- `max-width:560px` becomes the phone tier. Change it to `max-width:599px` so 600 is the first tablet width. Keep its rules. Add the new phone rules to it.
- `max-width:900px` stays as the tablet/phone block. Keep every rule in it (pagehead padding, 2-up metrics, one-column detail grid). Change one thing: the sidebar must become an overlay at this width (see below).
- `max-width:1240px` stays (panels one column, `.co-facts` 2 up). Keep.
- `max-width:1400px` stays (detail grid two columns). Keep.
- Remove: the JS cut-off `window.innerWidth > 900` at `AppClient.html:16` is fine to keep as the default, but the 900 value must match the CSS. Keep as is.
- Remove nothing else. All new rules are additions.
- Tour JS uses `innerWidth <= 640` for "mobile" (`Tour.html:189`). Change to 599 so it matches the phone tier (JS edit, one number).

Layout rules per tier:

- Sidebar and nav
  - T1: hide `.side` (display none). Show a new fixed bottom bar with Worklist, Holds, Projects, Subcontractors, More. "More" opens a sheet with Compliance, Notifications, Data trust, Tour, About, role switch. This needs new markup (see ticket R3). A CSS-only fallback is in R2: make the rail an overlay drawer. Prefer the drawer if markup changes are not wanted.
  - T2: keep the 68px rail. When opened it overlays the content (`position:fixed`, scrim behind) instead of pushing it. Closes on nav tap and on scrim tap.
  - T3, T4: as today.
- Page header (`.pagehead`)
  - T1: not sticky (`position:static`). Title, count, then a single row for the sample pill. Search collapses into an icon button that expands to a full-width field. Project picker moves into the page body, full width.
  - T2: sticky is fine. One row: title left, tools right. Pill beside the title.
  - T3, T4: as today.
- Grid columns: T1 1 col, T2 2 col for tiles (metrics, cases), 1 col for panels, T3 2 col, T4 current (3 col detail).
- Tables: T1 card list for Worklist, Holds, Projects, Subcontractors. T2 and up keep tables. Details in section 3.
- Detail panes: T1 and T2 stack. Notifications list becomes list then full-screen detail with a back button (T1 only). T3 and T4 keep two panes.

## 3. Per screen, per tier

Common defect on all screens at T1 and T2: nav rail items 40px high, header search 13.5px, `a.skip` 42px. Fixes are in section 4 and are not repeated below.

### Projects
- T1: replace the 892px table with a card list. Each card: project name (bold), status chip, then a 2-column key/value grid (open items, expiring, holds). Whole card is one tap target (min 56px). T2: keep table, scroll in the box with sticky first column (project name), add a right-edge fade. T3, T4: table as today.
- Primary action: tap a card to open. No new buttons.
- Defects: table inner scroll 892px in 235px (T1) and 628px (T2); project names wrap in 3 lines; "Try the upload page" link 84px tall (preview only).
- Fix: CSS `display:block` on `tr` at T1 plus `td::before{content:attr(data-label)}`. Needs `data-label` attributes on `td` in AppClient.html. See ticket R6.

### Compliance (dashboard)
- T1: 1 column. Metrics tiles stack (already at 560). The case table (505px) becomes a card list like Projects. T2: 2-up tiles, table fits (no inner scroll at 768, measured). T3 and T4: as today.
- Defects: table scroll 505px in 235px (T1). Chart and tiles fit.
- Fix: same card-list pattern as Projects.

### Worklist
- T1: segmented filter becomes a horizontally scrollable chip row with 44px chips and a right fade (it is 695px in 267px today and clips with no hint). Table becomes cards: name and record on line one, status chip on line two, then the "next action" as a full-width 44px amber button at the bottom of the card. This is the PM's main job on the phone, so the action must be on the card.
- T2: table fits at 768 (no inner scroll). The seg row clips ("All records 140" is cut at the right edge, see `768x1024/worklist.png`). Make `.seg` scroll with fade as at T1. Next action pill is fine.
- T3, T4: unchanged.
- Primary action placement: next-action button inside each card, bottom, full width.
- Defects: seg clipped at T1 and T2; table 589px in 235px; project picker 13.5px; row height small; keyboard hint footer `.keys` ("up down move, Enter open, / search") is useless on touch.
- Fix: hide `.keys` footer under `(hover:none)`. Chips and cards as above.

### Payment holds
- T1: card list. Each card: subcontractor, amount held (mono, large), reason, and a 44px "Review" button. The hold strip (`.holdstrip`) is already one column at 900. T2: table fits. Keep.
- Defects: table 381px in 235px at T1; picker font size.
- Fix: card list. A PM checks a hold on site, so the held amount must be the largest text on the card.

### Subcontractors (directory)
- Widest table (1058px). 44 small targets at 375, 54 at 1024, 79 at 1920 (many are per-row links).
- T1: card list. Name, status chip, certificates, expiry. Search and status filter stacked full width above, 44px tall, 16px text.
- T2: keep table, sticky first column, scroll in the box (1058 in 628 at 768). Hide the least important column (`td:nth-child(5)`, nowrap) below 900 if possible.
- T3: table fits at 1180, scrolls slightly at 1024 to 1280 (904 box vs 1058). Hide one column between 900 and 1279 to remove the scroll.
- Defects: 1058px table; `#dir-search` 14.5px; `#dir-status` 14.5px.

### Notifications (list and detail)
- T1: master-detail becomes two steps. List first. Tap an email, the detail takes the whole screen with a "Back to list" button (44px) pinned top. Today the layout is one column (list then detail below), so the detail appears far down the page (`notification-detail.png` shows the user scrolled). The detail is hard to find after tapping.
- T2: stacked is acceptable at 768, but better as two panes at 820+ with a 300px list. Use `note-layout` columns `minmax(260px,320px) 1fr` from 760px up instead of 900.
- T3, T4: two panes as today.
- Defects: `.seg` 419px in 267px; `#note-event` 14.5px; sticky header covers the top of the detail (the detail title is clipped under the header in `notification-detail.png`).
- Fix: after selecting, `scrollIntoView` with `scroll-margin-top` equal to header height. Needs a small JS change (flag).

### Data trust
- T1: `.seg` 296px in 267px (clips by 29px). Diff table (446px) becomes a card list: one card per check (what, expected, found, pass/fail chip). `.trust-when` is already one column at 900.
- T2 and up: unchanged.
- Defects: table scroll 446 in 235 at T1 and 290 at 430.
- Fix: card list. This is the data manager's screen. Keep the red fail row tint on the card.

### Record detail (with PDF preview)
- T1: single column, in this order: back button, header and facts, "Your next action" card, certificate requirements checks (already stacked as cards, readable), then PDF, then timeline. Put the next-action button into a sticky bottom bar (`position:sticky;bottom:0` with safe-area padding) so approve, waive, reject stay in reach while scrolling.
- Checks table: already collapses to 2-column rows at 560 (`.checks .tr`). Good. Row text is readable, but label and value alternate with little hierarchy. Keep.
- PDF preview: `<details class="pdf">`, canvas width 100%. At 375 the page renders at about 307px wide, so text on the certificate is unreadable. Add an "Open PDF" button (opens in a new tab; iOS shows the native viewer with pinch zoom) as the primary way to read it on a phone. Keep the canvas as a preview. Make `summary` 44px high.
- T2: two columns (left facts, right checks) from 768. The 900 rule makes it one column. Change the detail grid to 2 columns at 768 to 899 if time allows. Optional.
- T3, T4: as today. At 1024 and 1180 the right column drops under (`detail-right` spans), which is fine.
- Defects: back button 32px high; "Mark missing" and "Start" buttons under 44px; `.btn.small` 32px; no sticky action.

### Dialogs (fix a misread value, waive, reject)
- Dialog fits at 375 (`dialog.png`, width `100vw - 32px`). Inputs are 14.5px, so iOS zooms on focus. Buttons 40px.
- T1: make dialogs bottom sheets: `width:100%`, `max-height:calc(100dvh - 16px)`, radius on top only, bottom padding `env(safe-area-inset-bottom)`. Primary button full width, secondary below it.
- Use `dvh` with a `vh` fallback. See section 4 on iOS.
- `.dialog-grid` is already one column at 900.

### About
- Text page. Fits at all sizes. Only the global tap and font fixes apply. Cap line length at 70ch on T4 (already fine at 1920 by screenshot).

### Desktop (T3 and T4)
- 1280, 1440 and 1920 have no overflow. At 1920 content is 1440px wide and left aligned beside the sidebar. Keep. Directory table is the only inner scroll at 1280 (1058 in 904). Fix by dropping one column at 1240 to 1439, or letting `.dir-table td:nth-child(4),(5)` wrap.

## 4. Global rules

Tap targets (WCAG 2.2 target size, Apple 44pt): every interactive element at T1 and T2 must be at least 44x44 CSS px, or have 44px of spacing around it.

- Under `@media (pointer:coarse)`: `.btn, .btn.small, .btn.back, .seg button, .nav-btn, .foot-btn, .icon-btn, .nav-toggle, .nav-sub button, input, select { min-height:44px }`. `.icon-btn { min-width:44px }`. `.nav-btn` height 44px. `.skip` 44px.
- Use `pointer:coarse`, not width. An iPad landscape at 1180 is touch and needs the same sizes. A narrow desktop window does not.
- Inline table links: pad the whole row cell to 44px with `a { display:inline-block; padding:10px 0 }` or make the whole card the target.
- Rail items: 52x40 today. Make 52x48.

Input font size: set `input, select, textarea { font-size:16px }` under `@media (pointer:coarse)` (or max-width 899px). Today: header search 13.5px, selects 13 to 14.5px, dialog inputs 14.5px. Also `.field input` rule at `Styles.html:171` sets 14.5px and must be overridden. Do not use `maximum-scale=1` in the viewport tag. It blocks pinch zoom, which is an accessibility failure.

Safe areas: add `viewport-fit=cover` to the viewport meta (`Code.gs:85` and `:162`). Without it `env(safe-area-inset-*)` is 0. Then pad:
- Bottom tab bar, sticky action bar, tour card, dialogs: `padding-bottom:calc(12px + env(safe-area-inset-bottom))`.
- Landscape phone and iPad: `padding-left/right: env(safe-area-inset-*)` on `.app`.
Note the Apps Script wrapper iframe may not let `viewport-fit=cover` take effect (the outer page owns the viewport). Treat it as progressive. Verify on a real iPhone.

Hover and touch:
- Wrap every `:hover` transform and shadow in `@media (hover:hover)`. On touch, `.btn:hover` lifts the button and sticks after tap. `:active` stays.
- `.drop:hover` icon lift and `.note-item:hover` same.
- Hover-only information: `title` tooltips and the keyboard hints (`kbd`, "Esc", "/") have no touch meaning. Hide `kbd` and the keyboard hint footer when `(hover:none)`. The `Esc` label on the back button is noise on touch.
- No drag-only action exists. Drag and drop on the upload page needs the "Choose PDF" button, which exists.

Focus states: `:focus-visible` outline is 2px accent, kept. Keep it. On the rail `outline-offset:-2px` is correct. Check the new bottom bar and sheets have the same.

Sticky headers: `.pagehead` is sticky at all sizes and reaches 143 to 203px at 375. Make it static under 600px, or compact (title row only) with the tools below it, non sticky. Sticky only the title bar (64px max) on tablets.

iframe and iOS viewport notes:
- Apps Script serves the app inside a sandboxed iframe on `googleusercontent.com`. The app cannot read or set `window.top`, so no `top.location`, no `top.history`, and no way to change the parent's viewport meta. The viewport meta set by `addMetaTag` is hoisted to the outer page and works. The outer page background is not ours. Keep `html{background:var(--bg)}` (already set) so overscroll looks right.
- `100vh` on iOS Safari includes the collapsed toolbar area, so `height:100vh` is taller than the visible screen. Affects `.side` (`height:100vh`), `.app{min-height:100vh}` and `dialog{max-height:calc(100vh - 48px)}`. Use `100dvh` with `100vh` fallback: `height:100vh; height:100dvh`. Inside an iframe, the iframe height is set by the outer page, so `dvh` may equal the iframe height. Test both.
- Do not rely on `position:fixed` bottom bars inside the iframe being pinned to the browser's bottom edge on old iOS. They pin to the iframe viewport, which Apps Script sets full-screen. It worked in current Safari but check on a device.
- Scrolling: the iframe, not the top page, scrolls. `scroll-margin-top` and `scrollIntoView` work inside the iframe. `window.scrollTo` works. Pull-to-refresh reloads the outer page and loses state. Not fixable.
- `localStorage` may be blocked in third-party iframes in Safari (ITP). The app already wraps it in try/catch (`remembered`). Keep.
- Fonts load from Google Fonts. On a slow phone connection the fallback `system-ui` shows first. Add `font-display:swap` (already in the URL as `display=swap`). Fine.
- Print: not needed.

## 5. Tour and welcome card

Measured: the tour card docks at the bottom on phones (`.ct-docked`, `left:12px; right:12px; bottom:12px`, max height `min(62vh,440px)`). See `375x812/tour-1..8.png`.

What works: card is readable, steps dots, Skip, Back, Next, Autoplay all visible. No overflow in any of the 8 steps at 375.

Defects and fixes:
1. The docked card is up to 62% of the screen and covers the thing the step highlights (step 3: the "Read confidence" box is partly hidden under the card in `tour-3.png`). Fix: at T1 cap the card at 44vh (`max-height:min(44dvh,360px)`), and scroll the target into the top 40% of the viewport before showing the card (JS: the scroll target offset in `Tour.html:270`, `top = 84` should be about `16` on phones because the header is not sticky at T1).
2. No safe-area padding: bottom gap is a fixed 12px. Use `bottom:calc(12px + env(safe-area-inset-bottom))`.
3. Buttons: Back and Next are about 40px. Make 44px. "Skip" is a text link, about 24px. Give it a 44px hit area (padding).
4. `mobile()` uses 640, the CSS uses 640. The new phone tier is 599. At 600 to 640 the card docks but the layout is tablet. Align both to 599 or leave both at 640. Decision: leave both at 640 and do not add churn. Spec treats 640 as the tour's own phone limit.
5. iPad portrait (768, 820): the card floats next to the target. At 768 the rail is 68px, so there is room (`sideFits` logic). Check that the floating card never covers the Next target. Not fully verified (see section 9).
6. The ring highlight uses `getBoundingClientRect` and the page scrolls. Resize and rotation reset it (`resize` listener exists). Good.
7. Welcome card (`welcome.png`): fits at 375 and 430 with 20px padding at 480 and below. Primary button must be 44px+ and full width at T1. The pointer-follow tilt only runs with `pointer:fine` (already guarded at `Tour.html:488`). Good.
8. Tour step that opens a dialog (the fix dialog) stacks the card under the sheet. Keep the card hidden while a dialog is open, or dock it above the sheet. Verify.

Acceptance: tour runs 1 to the last step at 375x812 with no horizontal scroll and the card never taller than 44% of the viewport (see section 7).

## 6. Upload page (subcontractor path on a phone)

Today (`upload*.png`): one column, full-width "Upload certificate" button, chips for From and Project, drop zone with "Choose PDF". No overflow at any size. 2 to 4 small targets.

It is close. Make it excellent:

1. Alignment bug: `.uploadhead` has `padding:22px 48px 0` (`Styles.html:460`) and `.upload-main` content sits at 20px. The logo is indented 28px more than the page content at 375. Fix: `.uploadhead{padding:16px 20px 0}` under 600px.
2. The page title is 34px. At 375 it fits on one line. Keep. Reduce to 30px (the h1 rule at 560 already does this).
3. The drop zone talks about dropping. A phone user cannot drop. Under `(hover:none)`, hide "Drop your PDF here" copy? The bones (wording) are locked, so do not change the text. Instead make the entire drop zone tappable (it opens the file picker), and make "Choose PDF" a 48px primary-weight button. A label wrapping an `input type=file` covers the whole zone and gives the same result. Markup change in `UploadPage.html` (flag).
4. File input: `accept="application/pdf,.pdf"` is already set (`UploadPage.html:21`). Keep it. Do not add `capture`, because the file must be a PDF.
5. Button heights: "Upload certificate" is 42px (`.btn.wide`). Set 52px on touch. "Choose PDF" is `.btn.small` 32px. Set 48px.
6. Keep the upload button reachable. After a file is chosen the card grows. At 375x812 the button is still above the fold in the chosen state (`upload-chosen.png`). Confirm at 375x667 (iPhone SE height) and, if not, make the button sticky at the bottom of the card on phones with safe-area padding.
7. Progress state (`upload-progress.png`): 0 to 2 small targets. "Check progress" and "Choose a new PDF" are `.btn.small` 32px. Make 44px.
8. Error text must be visible without scrolling: `.form-error` has `role=alert`. On error, scroll it into view. Check `UploadPage.html` does (small JS, flag).
9. Large file message (5 MB limit) must show in the card. Phone photos converted to PDF can exceed 5 MB. The wording is locked. Verify the error shows, no change.
10. The "Sample data" pill stays in the header. Good.
11. Landscape phone (812x375): the card is 640px max and centered. Fine. Check the header does not eat 25% of the height. It is non sticky, so fine.
12. Safe area: bottom padding `calc(24px + env(safe-area-inset-bottom))` on `.upload-main`.
13. Text size: body is 14.5px. For this page set 16px body text on touch, since it is read by non-technical users outdoors. This is a type-scale change inside the locked finish, but it is a legibility rule, not a style change. Keep Geist.

## 7. Acceptance tests

Write as `scripts/checks/responsive.js` using Python or Node Playwright. Each test runs at all 9 sizes unless stated. Phone and iPad sizes use `isMobile:true, hasTouch:true, deviceScaleFactor:2`. Serve with `python3 -m http.server 8765 -d docs/design/refined/app`.

Sizes (w x h): 375x812, 430x932, 768x1024, 1024x768, 820x1180, 1180x820, 1280x800, 1440x900, 1920x1080.

Screens and how to reach them (use the app's own nav; the preview keeps state in memory):
`projects`, `dashboard` (Compliance), `worklist`, `holds`, `directory`, `company`, `notifications` (then click the first `.note-item`), `trust`, `record` (click the first worklist row link), `about`, and `upload.html`.

Tests:

- T1 Reachable. For each size and screen, navigate through the visible nav (rail, tab bar or drawer, whichever exists at that size). Assert the `h1` text matches the screen name and `document.querySelector('main')` is visible. At T1 the "More" sheet must reach Compliance, Notifications, Data trust and About.
- T2 No horizontal page scroll. `document.documentElement.scrollWidth <= window.innerWidth`. Tolerance 0px. Also fail if any element other than `.table-scroll`, `.seg` or the PDF canvas has `getBoundingClientRect().right > innerWidth + 1`.
- T3 No inner scroll on phones for card lists. At 375 and 430, on projects, dashboard, worklist, holds, directory, trust: `.table-scroll` must not exist (card list) or `scrollWidth <= clientWidth`. At 768 and 820 inner scroll is allowed only on projects and directory, and then the first column must be sticky (`getComputedStyle(td:first-child).position === 'sticky'`).
- T4 Tap target size. At the 6 phone and iPad widths (375, 430, 768, 820, 1024, 1180 under touch), for every visible `button, a[href], input, select, summary, [role=button]`, require `width >= 44 && height >= 44`. Allowed exceptions: inline links inside a paragraph, and the hidden `a.skip` until focused. Report the count and list the offenders. Baseline today (from `metrics.json`): 15 to 54 per screen. Target: 0.
- T5 Input font size. At every touch size, every visible `input, select, textarea` has computed `font-size >= 16px`. Includes `#search`, `#project-picker`, `#dir-search`, `#dir-status`, `#note-event`, `#role`, `#mode`, `#fix-field`, `#fix-read` and dialog inputs.
- T6 Sidebar does not squeeze. At 375, 430, 768, 820: open the nav. Assert `main` width stays within 2px of its closed width (overlay, not push), and a scrim exists. Tap scrim, nav closes. Baseline: main drops to 111px at 375.
- T7 Header height. At 375 and 430, scroll the record page down 400px. Sticky header (if any) is at most 64px tall. Static headers are fine.
- T8 Tour completes at 375. Open `index.html?tour=play` at 375x812. Click Next 7 times (or until the finish card). At every step: card bounding box is inside the viewport (left >= 0, right <= innerWidth, bottom <= innerHeight), card height <= 0.5 * innerHeight, no horizontal scroll, and the highlighted target is at least partly visible (not fully under the card). The last step shows the finish state. Repeat at 768x1024 and 1180x820. Selectors: `.ct-card`, `.ct-ring`, `#ct-count`.
- T9 Welcome card. Open at 375 and 430. Card inside viewport. Primary button at least 44px high.
- T10 Dialog. At 375x812 open "Fix a misread value" on the record screen. Dialog inside viewport, `max-height <= innerHeight`, Save button visible without scrolling the page, all inputs 16px.
- T11 Notifications flow at 375. Tap an item. Detail is shown, list is hidden, the Back button is visible, at least 44px, and the title is not covered by a sticky header (title top >= header bottom).
- T12 PDF. On the record at 375, open the PDF `<details>`. Canvas width <= main width. An "Open PDF" link exists with `target=_blank`.
- T13 Upload page. At 375, 430 and 768: no horizontal scroll, "Upload certificate" and "Choose PDF" at least 48px, the file input still has accept for PDF, choose a file with `setInputFiles`, button still inside viewport at 375x667 (or sticky), progress state buttons at least 44px. Logo left edge equals content left edge (within 1px).
- T14 Desktop regression. At 1280, 1440, 1920: no horizontal scroll, no inner scroll on any table except directory at 1280 (until fixed), sidebar width 264px, content max width 1440px.
- T15 Hover. On a `(hover:none)` context, `.btn:hover` has no transform (emulate with `page.emulate_media` is not enough for hover; assert the stylesheet by reading `document.styleSheets` for `:hover` rules outside a `(hover:hover)` media block, and expect none for `.btn`, `.note-item`, `.drop`).
- Output: a table per size with pass or fail and offender lists. Exit code 1 on any fail. Save screenshots to `shots/<w>x<h>/<screen>.png`.

## 8. Build order for a coding agent

Each ticket is small and independent. Order is by user value. "CSS only" means only `src/Styles.html` (and `Tour.html` inline CSS where named). Do not touch tests, only add `scripts/checks/responsive.js` in R0.

R0. Test harness (new file only). Write `scripts/checks/responsive.js` from section 7. Run it first for a baseline. No app files. Note: `scripts/` is read-only for this spec job, but not for the builder.

R1. Touch sizes and input font size. CSS only. `Styles.html`: add `@media (pointer:coarse)` block with min-height 44px for `.btn, .btn.small, .btn.back, .btn.wide, .seg button, .nav-btn, .foot-btn, .icon-btn, .nav-toggle, .nav-sub button, .nav-sub .item, .nav-sub .all, summary, .pdf summary, .note-item` and 16px for `input, select, textarea, .field input, .field select, .field textarea, .gsearch input, .dir-search input`. Also `.skip` padding. Tests T4, T5.

R2. Sidebar becomes an overlay below 900px. CSS only if the open state already toggles `.side.closed` (it does, `AppClient.html:219`). `Styles.html`: at `max-width:899px` make `.side` `position:fixed; left:0; top:0; height:100dvh; z-index:40; box-shadow:var(--raised)`, and `.app` gets `padding-left:68px` so the closed rail still reserves its 68px. The open `.side` is 264px and floats over main. Scrim: use `.side:not(.closed)` plus `.app::after` (needs the scrim click handler, see R2b). R2b (JS, `AppClient.html` near line 219): add a scrim element click that calls the same close function. Flag: small JS and one markup node. Tests T6.

R3. Phone bottom tab bar. Markup in `Worklist.html` (new `<nav class="tabbar">` with 5 buttons plus a More sheet) and JS in `AppClient.html` to wire to the existing `go(screen)` function and badge counts. CSS in `Styles.html`: hide `.side` and `.app{padding-left:0}` under 600px; `.tabbar{position:fixed;bottom:0;left:0;right:0;height:calc(56px + env(safe-area-inset-bottom));padding-bottom:env(safe-area-inset-bottom)}`; `main{padding-bottom:88px}`. Skip R3 if the R2 drawer is judged enough. Tests T1, T6. Needs markup: yes.

R4. Header on phones. CSS only. `Styles.html` at `max-width:599px`: `.pagehead{position:static;padding:12px 16px}`, `.ph-tools{width:100%}`, `main{padding:16px 16px 72px}`. Project picker goes full width (`#project-picker{width:100%}`). Keep the search full width. Test T7. (The search icon-collapse is optional and needs JS.)

R5. Segmented filters scroll with a hint. CSS only. `Styles.html`: `.seg` at `max-width:899px`: `display:flex; overflow-x:auto; scrollbar-width:none; scroll-snap-type:x proximity; mask-image:linear-gradient(90deg,#000 calc(100% - 28px),transparent)`. The sliding indicator `.seg-ind` is positioned by JS (`placeSeg`, `AppClient.html:272`) and may drift when the strip scrolls. Verify. If it drifts, drop the indicator at that width and style `button[aria-pressed=true]` with the white background. Tests T2.

R6. Table to card lists at phones. Markup plus CSS. In `AppClient.html`, add `data-label="..."` to each `<td>` in the Projects (about line 550 on), Compliance, Worklist, Holds, Subcontractors and Data trust tables, and a class `cardable` on the `<table>`. CSS: under 600px `.cardable thead{display:none} .cardable tr{display:grid;gap:6px;padding:14px 0} .cardable td{display:flex;justify-content:space-between} .cardable td::before{content:attr(data-label);color:var(--muted)}`, and `.cardable td:first-child` as the title row. Next-action cell: `grid-column:1/-1; min-height:48px`. Do Worklist first, then Holds, Projects, Directory, Compliance, Trust, one ticket each. Tests T3, T4.

R7. Tablet tables. CSS only. `.table-scroll table` first column sticky: `th:first-child,td:first-child{position:sticky;left:0;background:var(--surface);z-index:1}` between 600 and 1239px, and a right-edge fade. Directory: hide `td:nth-child(5)` and its `th` from 900 to 1279 to remove the scroll. Test T3, T14.

R8. Notifications on phone. Markup and JS. `AppClient.html` (~line 1147): add a `data-pane` state (`list` or `detail`) on `.note-layout`; at phone width show one pane. Add a `Back to list` button in the detail (44px). Add `scroll-margin-top` on `.note-preview`. CSS: `Styles.html` `.note-layout` columns at 760px. Test T11. Needs markup: yes.

R9. Record detail on phone. CSS plus tiny markup. Sticky bottom action bar for the "Your next action" card under 600px (`position:sticky; bottom:0`, safe-area padding). "Open PDF" link next to the PDF summary (markup in `AppClient.html` PDF block, about the `.pdf` details). Test T12.

R10. Dialogs as bottom sheets. CSS only. `Styles.html` line 445 region: under 600px `dialog{width:100%;max-width:100%;margin:auto 0 0;border-radius:18px 18px 0 0;max-height:calc(100dvh - 16px);padding-bottom:calc(18px + env(safe-area-inset-bottom))}`; buttons stack full width. Also replace `100vh` with `100dvh` (keep a `100vh` line before it) in `.app`, `.side`, `dialog`. Test T10.

R11. Hover guards. CSS only. Wrap `.btn:hover`, `.btn.secondary:hover`, `.btn.tertiary:hover`, `.btn.back:hover`, `.icon-btn:hover`, `.note-item:hover`, `.seg button:hover`, `.drop:hover` rules in `@media (hover:hover)`. Under `(hover:none)` hide `kbd`, `.keys` and the Esc label. Test T15.

R12. Tour on phones. CSS plus one JS number. `Tour.html`: `.ct-card.ct-docked` `max-height:min(44dvh,360px)`, `bottom:calc(12px + env(safe-area-inset-bottom))`, 44px `.ct-btn` and `.ct-skip`; JS `top` offset (line 270) smaller when `mobile()`. Test T8, T9.

R13. Upload page. `Styles.html` lines 460 to 487 (`.uploadhead`, `.upload-main`, `.drop`, `.upload-card`) and `UploadPage.html`. CSS: header padding 20px at phone, 48px buttons, 16px body, safe-area padding. Markup: wrap the drop zone in a `<label>` so the whole zone opens the picker; the input is `hidden` today, so the label must be the tap target. Tests T13.

R14. Viewport. `Code.gs` lines 85 and 162: viewport content `width=device-width, initial-scale=1, viewport-fit=cover`. One-line each. Ask first; `Code.gs` is deployed code. Do not add `maximum-scale`.

R15. Content cap at wide. CSS only. `main, .pagehead { max-width:1440px }` at 1920 already effectively applies. Verify, and only change if the shot shows stretched content. Likely no change.

Ship order: R0, R1, R10, R2, R4, R5, R6 (Worklist first), R11, R9, R12, R13, R8, R7, R3, R14.

## 9. Risks and what was not checked

- Real devices were not used. Everything was measured in Chromium with a mobile emulation. iOS Safari differs: `100vh`, `dvh`, `position:fixed` inside an iframe, safe areas, the keyboard resizing the viewport, and input zoom. Test on a physical iPhone and iPad before calling it done.
- The preview runs outside Apps Script. The real app runs inside the `googleusercontent.com` iframe, which can change viewport behavior and block `localStorage`. The measurements do not include that iframe wrapper.
- `viewport-fit=cover` may not take effect through `addMetaTag` in the sandbox. Unverified.
- Tour steps were checked visually at 375 only (`tour-1..8.png`), not scripted. Tablet tour placement is not verified.
- Only the Accountant role was shot. A project manager role may show other buttons (approve, waive, reject) that were not measured. Re-run `shoot.py` with the role switched.
- The record page in one state (Oakvale, needs review) was shot. Approved, expired and hold states were not.
- Landscape phone (812x375) and iPhone SE (375x667) were not shot.
- Dark mode and Dynamic Type (iOS text size) were not checked. Large text may break the 44px cards and the chip rows.
- Card lists depend on `data-label` text. Labels must match the column headers. Do not invent new wording.
- The `.seg` sliding indicator may misalign when the strip scrolls (R5). Check after the change.
- The tab bar (R3) adds a second navigation pattern to maintain. The drawer in R2 is cheaper. Decide with the author before building R3.
- The "Local preview" bar and `components.html` are preview-only. They were not designed for phones.
- The 1920 shots exist. Nothing was re-shot in this pass.
