# Round 3 restart, Run A

Four distinct visual directions are ready for the owner's choice. All changes stay in docs/design/refined/directions-r2/.

The standing instructions, main design brief, refinement brief, field notes, Phase 4 decisions, and restart handoff were read.

Hard rules hold. All data is fictional. Sample data and Demo only remain visible. Code checks the values. People decide. Sources and updated times stay beside the figures. No secrets or employer names appear. No app code changed.

## Review files

| Direction | Live study | Dominant pane | Structural choice |
|---|---|---|---|
| Vault | [vault.html](vault.html) | Certificate PDF; next step is the action focus. | Side navigation, large left PDF, right decision and values. |
| Ledger | [ledger.html](ledger.html) | Next-step panel. | Decision and values form a document column. PDF sits in a narrow margin. |
| Signal | [signal.html](signal.html) | Value lines. | Wide values column on the left, quiet decision and PDF on the right. |
| Drafting | [drafting.html](drafting.html) | Next-step panel. | Record identity sits on the right of a title block. Three unequal columns separate decision, values, and PDF. |

The shared [base-r2.css](base-r2.css) contains anatomy, grid-area names, keyframes, and responsive ordering only. It contains no visual tokens or direction styling. Each HTML file owns its visual rules and a plain sample-data object.

## Pairwise scorecard

The score uses the ten categories in the handoff. Every pair passes the five-difference gate. Shadows do not count because all four omit them. Luminance does not count between the three light directions. Radius does not count between the light directions.

| Pair | Differences | Categories that differ |
|---|---|---|
| Vault / Ledger | 9 of 10 | Luminance family; type family; type scale; surfaces; accent; status tuning; density; radius; motion. |
| Vault / Signal | 9 of 10 | Luminance family; type family; type scale; surfaces; accent; status tuning; density; radius; motion. |
| Vault / Drafting | 9 of 10 | Luminance family; type family; type scale; surfaces; accent; status tuning; density; radius; motion. |
| Ledger / Signal | 7 of 10 | Type family; type scale; surfaces; accent; status tuning; density; motion. |
| Ledger / Drafting | 7 of 10 | Type family; type scale; surfaces; accent; status tuning; density; motion. |
| Signal / Drafting | 7 of 10 | Type family; type scale; surfaces; accent; status tuning; density; motion. |

## Screenshot critique and fixes

| Direction | Finding | Final choice or fix |
|---|---|---|
| Vault | The light document leads. Repeated containers would compete with it. | Only the PDF has a bounded surface. Decision and values use rules on the dark canvas. |
| Ledger | The serif title and decision lead. Controls could become more card sections. | Sections stay unboxed. The note has one bottom rule. Waive and Reject stay equal. |
| Signal | The 44px confidence figure competed with coverage values. The PDF pushed the decision below the first viewport. | Confidence shrank to 28px. The decision moved above the PDF. Coverage figures remain 30px. |
| Drafting | W-9 sat too far below the decision. The title-block divider had a gap. | W-9 now follows the decision row. Title padding replaces the margin, so the divider stays continuous. |
| All mobile views | The first captures showed a reset message over record facts. | Final captures dismiss messages. Messages have a dismiss control and close after 5.2 seconds. |

All four final desktop and mobile screenshots received a visual review for hierarchy, wrapping, aligned numbers, wording, sample labels, and the ban list. The fictional PDFs also received a visual review in the document panels.

## Contrast

Ratios use the WCAG relative-luminance formula. Status text passes 4.5:1 on the surface, canvas, and its own tint. Solid marks use the foreground color as a fill and pass 3:1 against the surface. Body text, muted text, control outlines, and primary-action text also pass their contrast checks.

### Vault

| Family | Foreground | Tint | Text on surface | Text on canvas | Text on tint | Solid against surface |
|---|---|---|---|---|---|---|
| green | #94d7ad | #1c352a | 9.49:1 | 10.56:1 | 7.90:1 | 9.49:1 |
| amber | #e4c181 | #352d1e | 9.24:1 | 10.28:1 | 7.92:1 | 9.24:1 |
| red | #f6a5a2 | #3b2528 | 8.16:1 | 9.09:1 | 7.31:1 | 8.16:1 |
| blue | #a1c4e8 | #22303e | 8.73:1 | 9.72:1 | 7.42:1 | 8.73:1 |
| violet | #cfb5ee | #30273d | 8.67:1 | 9.65:1 | 7.75:1 | 8.67:1 |
| neutral | #b5c1bf | #283230 | 8.56:1 | 9.52:1 | 7.14:1 | 8.56:1 |

Fonts loaded for capture: IBM Plex Mono, Manrope.

### Ledger

| Family | Foreground | Tint | Text on surface | Text on canvas | Text on tint | Solid against surface |
|---|---|---|---|---|---|---|
| green | #34623f | #e1e9d6 | 6.36:1 | 5.97:1 | 5.68:1 | 6.36:1 |
| amber | #80500a | #f1e1ba | 6.14:1 | 5.77:1 | 5.28:1 | 6.14:1 |
| red | #9d3a2a | #f2dacc | 6.13:1 | 5.76:1 | 5.10:1 | 6.13:1 |
| blue | #2d557d | #e0e6e8 | 6.96:1 | 6.54:1 | 6.15:1 | 6.96:1 |
| violet | #65477b | #e9dfeb | 6.88:1 | 6.46:1 | 5.92:1 | 6.88:1 |
| neutral | #625b51 | #e4dfd3 | 6.01:1 | 5.65:1 | 5.04:1 | 6.01:1 |

Fonts loaded for capture: IBM Plex Mono, Newsreader, Public Sans.

### Signal

| Family | Foreground | Tint | Text on surface | Text on canvas | Text on tint | Solid against surface |
|---|---|---|---|---|---|---|
| green | #305b3a | #dee7dd | 7.22:1 | 6.79:1 | 6.18:1 | 7.22:1 |
| amber | #7b500a | #eee1c5 | 6.47:1 | 6.09:1 | 5.41:1 | 6.47:1 |
| red | #a3322d | #f0deda | 6.35:1 | 5.97:1 | 5.30:1 | 6.35:1 |
| blue | #365b7d | #dce4e8 | 6.57:1 | 6.18:1 | 5.53:1 | 6.57:1 |
| violet | #694b7c | #e6deea | 6.69:1 | 6.29:1 | 5.52:1 | 6.69:1 |
| neutral | #5b5d56 | #e2e3dd | 6.16:1 | 5.80:1 | 5.17:1 | 6.16:1 |

Fonts loaded for capture: Space Grotesk.

### Drafting

| Family | Foreground | Tint | Text on surface | Text on canvas | Text on tint | Solid against surface |
|---|---|---|---|---|---|---|
| green | #245b45 | #dbe7df | 7.34:1 | 6.67:1 | 6.21:1 | 7.34:1 |
| amber | #82500d | #efe0c4 | 6.28:1 | 5.72:1 | 5.20:1 | 6.28:1 |
| red | #a33333 | #f0ddda | 6.33:1 | 5.76:1 | 5.22:1 | 6.33:1 |
| blue | #235a85 | #dce7ee | 6.79:1 | 6.17:1 | 5.82:1 | 6.79:1 |
| violet | #664b85 | #e4e0ec | 6.70:1 | 6.09:1 | 5.56:1 | 6.70:1 |
| neutral | #50616a | #dce3e5 | 5.98:1 | 5.44:1 | 4.96:1 | 5.98:1 |

Fonts loaded for capture: IBM Plex Mono, IBM Plex Sans.

## Motion

| Direction | Durations | Feel |
|---|---|---|
| Vault | 90, 160, 240ms | Short 2px vertical movement, firm ease-out. |
| Ledger | 120, 240, 360ms | Soft 5px vertical movement, slower ease-out. |
| Signal | 90, 120, 180ms | Opacity change with no travel. |
| Drafting | 120, 200, 280ms | Short 3px horizontal movement, direct ease-out. |

Motion applies to button transforms, changed next-step content, and PDF opacity. Figures never count up. Reduced motion removes animation and transitions.

## Browser checks

Each direction passed the following checks in local Chromium.

- No horizontal overflow at 1440px or 375px.
- All five navigation items stay visible at 375px.
- The next step and deficiencies precede the PDF at stacked widths.
- The stacked PDF starts as View certificate and opens on request.
- Waive and Reject have the same fill, text, border, weight, and height.
- A waiver without a note changes nothing.
- Role changes show the required refusal text.
- A correction without a note changes nothing and keeps the unsaved edit.
- Brightway correction records the old value, new value, note, and Dana Reyes (Accountant), then permits approval.
- Escape cancels a correction.
- Rejection names each found and required value and returns to Awaiting certificate.
- Nothing waiting appears after a completed decision.
- Actual PDFs render through pdf.js 3.11.174 from cdnjs.
- No browser JavaScript errors occurred.

## Fixed data and assumptions

Ridgeline remains REC-001, In review, with 93% reading confidence, umbrella of $1,000,000 against $2,000,000, and the incorrect insured name. Its endorsement remains printed, as in the approved record. The missing-endorsement wording in the brief is an example. The study adds no deficiency.

Brightway remains REC-014, In review, with 96% reading confidence and Waiting for approval. Section 8 requires one misread but does not name a field. This study uses general liability, read as $2,000,000 while the PDF prints $1,000,000. Both amounts exist in the approved requirements. This is the only sample-reading change.

Both records show Not on hold. No bill this pay cycle. Header dates separate the current certificate from the certificate under review. Values show Certificates · Project requirements. The correction request includes the found and required values.

Actions change this page's sample objects only. Fixed success wording stays as supplied. The studies send no mail and call no backend.

Google Fonts and cdnjs loaded during capture. The HTML retains named system fallbacks if fonts are unavailable. PDF failure shows a reason and retains the original-file link. The fictional PDFs use a generic layout.

Drafting uses repeated one-pixel CSS lines for the engineering grid. It has no shaded or decorative gradient.

## Screenshots

[Comparison image](screenshots/comparison-r2.png)

| Direction | Ridgeline, 1440px | Mobile, 375px | Brightway, 1440px |
|---|---|---|---|
| Vault | [Desktop](screenshots/vault-1440.png) | [Mobile](screenshots/vault-375.png) | [Brightway](screenshots/vault-brightway-1440.png) |
| Ledger | [Desktop](screenshots/ledger-1440.png) | [Mobile](screenshots/ledger-375.png) | [Brightway](screenshots/ledger-brightway-1440.png) |
| Signal | [Desktop](screenshots/signal-1440.png) | [Mobile](screenshots/signal-375.png) | [Brightway](screenshots/signal-brightway-1440.png) |
| Drafting | [Desktop](screenshots/drafting-1440.png) | [Mobile](screenshots/drafting-375.png) | [Brightway](screenshots/drafting-brightway-1440.png) |

## Stop

Run A is complete. The owner must choose a direction or name a mix before Run B. refined/styles.css and all app code remain untouched. No commit or push occurred.
