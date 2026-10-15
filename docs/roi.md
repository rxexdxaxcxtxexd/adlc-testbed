# Return on investment

This page is for the spoken walkthrough. Every figure is an illustrative annual value from fictional inputs. It is an estimate, not measured savings.

The figures match `roiLines` in `src/Roi.gs`, run on `docs/roi-inputs.json` (updated 2026-10-08). Code does all the arithmetic. The AI model does none.

## Result

| Case | Net value per year |
|---|---|
| Low (the floor) | $518.67 |
| Likely | $5,284.47 |
| High | $21,933.06 |

The low case uses every input at its least favourable value, so it is the floor. The AI reading cost is under $2 a year in every case (`docs/research/c4-gemini-api-cost.md`), so the return rests on staff time, not model cost.

## How the cases work

Low, likely and high label the net value, not each input. In the low case, today's effort is at its lowest and effort with the tool is at its highest. The cost lines in the low column therefore show the larger cost. This follows `docs/metric-definitions.md`, section "Scenario values". The low case uses the low staff rate of $30 an hour for savings and upkeep alike. Certificate volume, project count and audit count take the value that gives the lower net value. In this data that is the low value.

## Inputs

Source key: "sourced" means a cited file. "Estimate" means reasoning set in `docs/roi-inputs.json`, to replace with the firm's own number.

| Input | Low | Likely | High | Source |
|---|---|---|---|---|
| `min_per_cert_today`: minutes per certificate today | 15 | 20 | 25 | Estimate: read a certificate, compare its limits and file the result by hand |
| `min_per_cert_tool`: minutes per certificate with the tool | 3 | 5 | 8 | Estimate: check the extracted values and complete one approval or decision |
| `certs_per_year`: certificates per year | 140 | 280 | 700 | Sourced: design notes and `docs/research/c4-gemini-api-cost.md` (35 per project, renewals, scale ceiling) |
| `monthly_check_min_today`: monthly check minutes per project today | 30 | 45 | 60 | Estimate: search records for lapses, renewals and missing W-9 forms before payment |
| `monthly_check_min_tool`: monthly check minutes per project with the tool | 5 | 10 | 15 | Estimate: review the payment hold list and resolve the named reasons |
| `projects`: projects | 4 | 4 | 4 | Sourced: design notes, four concurrent fictional projects |
| `hourly_rate_usd`: staff cost per hour | $30 | $40 | $50 | Estimate: illustrative fully loaded cost |
| `lapses_paid_per_year`: payments with a lapse per year today | 0 | 1 | 2 | Estimate |
| `cost_per_incident_usd`: cost per lapse | $500 | $1,500 | $3,000 | Estimate: time and cost to resolve, excluding insured losses |
| `catch_rate`: share of lapses caught | 0.5 | 0.75 | 0.9 | Estimate: a dated payment hold list catches half to nine tenths, and people still act on it |
| `hours_per_audit_today`: hours per audit today | 4 | 8 | 12 | Estimate |
| `hours_per_audit_tool`: hours per audit with the tool | 1 | 2 | 3 | Estimate |
| `audits_per_year`: audits per year | 1 | 2 | 3 | Estimate |
| `api_cost_per_year_usd`: certificate reading spend per year | $0.27 | $0.53 | $1.33 | Sourced: `docs/research/c4-gemini-api-cost.md`, model `gemini-3.5-flash-lite` with minimal thinking |
| `upkeep_hours_per_month`: upkeep hours per month | 0.25 | 0.5 | 1 | Estimate: check failed uploads, timers and model changes |

The value used in each case is: today's effort and lapse inputs at their own case value; effort with the tool, reading spend and upkeep at the opposite value (low case uses the high input).

## Line by line

### Staff time saved (`hours_saved_value_usd`)

Formula: ((minutes today minus minutes with the tool) times certificates per year, plus (monthly check minutes today minus with the tool) times 12 times projects), divided by 60, times staff cost per hour.

| Case | Certificate minutes | Monthly check minutes | Hours | Value |
|---|---|---|---|---|
| Low | (15 - 8) x 140 = 980 | (30 - 15) x 12 x 4 = 720 | 1,700 / 60 = 28.33 | 28.33 x $30 = $850.00 |
| Likely | (20 - 5) x 280 = 4,200 | (45 - 10) x 12 x 4 = 1,680 | 5,880 / 60 = 98.00 | 98.00 x $40 = $3,920.00 |
| High | (25 - 3) x 700 = 15,400 | (60 - 5) x 12 x 4 = 2,640 | 18,040 / 60 = 300.67 | 300.67 x $50 = $15,033.33 |

### Lapse risk avoided (`lapse_risk_avoided_usd`)

Formula: lapses per year times cost per lapse times share caught.

| Case | Sum | Value |
|---|---|---|
| Low | 0 x $500 x 0.5 | $0.00 |
| Likely | 1 x $1,500 x 0.75 | $1,125.00 |
| High | 2 x $3,000 x 0.9 | $5,400.00 |

### Audit prep saved (`audit_prep_saved_usd`)

Formula: (hours today minus hours with the tool) times audits per year times staff cost per hour.

| Case | Sum | Value |
|---|---|---|
| Low | (4 - 3) x 1 x $30 | $30.00 |
| Likely | (8 - 2) x 2 x $40 | $480.00 |
| High | (12 - 1) x 3 x $50 | $1,650.00 |

### Running cost (`running_cost_usd`)

Formula: reading spend plus upkeep hours per month times 12 times staff cost per hour.

| Case | Reading spend | Upkeep | Value |
|---|---|---|---|
| Low | $1.33 | 1 x 12 x $30 = $360.00 | $361.33 |
| Likely | $0.53 | 0.5 x 12 x $40 = $240.00 | $240.53 |
| High | $0.27 | 0.25 x 12 x $50 = $150.00 | $150.27 |

### Net value (`net_value_usd`)

Net value is staff time saved, plus lapse risk avoided, plus audit prep saved, minus running cost.

| Case | Sum | Net value |
|---|---|---|
| Low | $850.00 + $0.00 + $30.00 - $361.33 | $518.67 |
| Likely | $3,920.00 + $1,125.00 + $480.00 - $240.53 | $5,284.47 |
| High | $15,033.33 + $5,400.00 + $1,650.00 - $150.27 | $21,933.06 |

## What the figures do not cover

- Setup effort and the cost to build the tool are not in the net value. The inputs hold no figure for them, so they are not yet known. The firm's own build or purchase quote would supply them.
- The staff rate is illustrative. The firm's payroll data would supply the real rate.
- The minutes and hours today and with the tool are estimates. A timed sample of real work would supply measured values.
- Lapses per year and cost per lapse are estimates. The firm's claims and payment history would supply them.
- Reading spend assumes 2 pages a certificate, 1.5 calls each and minimal thinking. The research file guesses 2,000 thinking tokens for its heavier case and gives $6.58 a year at 700 certificates on this model, and up to $20.82 on a larger model (`docs/research/c4-gemini-api-cost.md`). Those cases are not in the inputs. The reading spend feeds the low case (the opposite-value rule), so $20.82 would cut the low case net value from $518.67 to $499.18, about 3.8 percent. The likely and high cases would not change. Real token counts logged after the first runs would replace the guess.
- The spec says projects are doubling with the same staff. The inputs hold four projects in every case, so the figures do not show that growth.
