# Proposals (brief §11 item 6)

These were left out of every batch because each adds a number or a behavior the brief does not define. Items 6 and 7 were applied in the Batch C review. The rest are not built. Items 8, 9 and 10 stay deferred. Each one needs a decision row before it goes in.

On 2026-10-08 the owner adopted items 5 and 8 (`docs/decisions.md`, Phase 4). Items 1 to 4, 9 and 10 stay out.

## From Round 2 Batch B

1. **A "Why At risk" line on each tile.** It uses words only, but it changes the approved tile component.
2. **Payback period on the ROI page.** §7 does not define it.
3. **Dollars on hold compared with last cycle.** That is a trend, and §12 rules trends out.
4. **A "By project" table on the dashboard.** The tiles already show each project's numbers.

## From Round 2 Batch A

5. **Name both insured names in the correction request.** The code's text reads "Insured name: missing or wrong", so a subcontractor may not know what to fix. The screen shows both names, but the email does not. This changes fixed text in `src/Evaluate.gs`.

## From Batch C

6. **Applied in the Batch C review.** ~~A narrow layout for the values card on the record detail.~~ At 375 wide the four-column value lines break. See Batch C, 4p. This needs a new rule on an approved component.
7. **Applied in the Batch C review (under 984 px of component width).** ~~Turn off the sticky PDF pane when the columns stack.~~ At 375 wide the PDF stacks above the values but stays sticky, so it would cover the values as you scroll. This is a change of behavior on an approved screen.
8. **Plant a misread value on Brightway Electric.** §10 step 4 says Dana corrects one value and then approves. Every line on Brightway passes, so the walkthrough shows only Approve. The correction is shown on Summit Mechanical (Batch A, 4b). This changes the sample data.
9. **A CFO role, or a "viewing as" label for the CFO.** §5 has no CFO role, so in step 6 the CFO views the ROI page as Leadership.
10. **HTML email layout (§6.9).** It is lower priority and was not designed in any batch. The six emails stay as fixed plain text.
