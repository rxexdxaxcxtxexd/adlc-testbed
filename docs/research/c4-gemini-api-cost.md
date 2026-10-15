# C4. Gemini API cost per year

Retrieved: 2026-10-07

## Answer

The math supports "under $1 a year" for the likely case on `gemini-3.5-flash-lite`, about $0.53 a year. Even the worst case here, 700 certificates on `gemini-3.8-flash` with heavy thinking, comes to about $21 a year. The earlier "$100 to $400 a year" range is too high by roughly 20 to 700 times. A free tier exists, but Google may use free-tier content to improve its products and tells users not to send confidential data, so the build should use the paid tier.

## Findings

| Claim | Source (exact URL) | Quote or close paraphrase |
|---|---|---|
| 3.5 Flash-Lite paid price | https://ai.google.dev/gemini-api/docs/pricing | `gemini-3.5-flash-lite`: input $0.30, output $2.50 per 1M tokens. |
| 3.8 Flash paid price | https://ai.google.dev/gemini-api/docs/pricing | `gemini-3.8-flash`: input $0.75 and output $3.75 per 1M tokens through Dec 31, 2026; $1.50 and $7.50 from Jan 1, 2027. |
| Other reference prices | https://ai.google.dev/gemini-api/docs/pricing | `gemini-3.1-flash-lite` $0.25 / $1.50; `gemini-3.5-flash` $1.50 / $9.00; `gemini-2.5-flash` $0.30 / $2.50; `gemini-2.5-flash-lite` $0.10 / $0.40. |
| PDF tokens billed at the image rate | https://ai.google.dev/gemini-api/docs/pricing | DOCUMENT-modality tokens (such as PDFs) are billed at the image token rate, which is the same text/image/video input price. |
| Output price includes thinking | https://ai.google.dev/gemini-api/docs/pricing | Output price includes thinking tokens for all listed models. |
| Thinking billing rule | https://ai.google.dev/gemini-api/docs/thinking | Thinking tokens are billed with output tokens. "Pricing is based on the full thought tokens the model needs to generate." |
| Default thinking levels | https://ai.google.dev/gemini-api/docs/thinking | `gemini-3.5-flash-lite` on (minimal). `gemini-3.8-flash` on (medium); minimal not available. |
| Tokens per PDF page on Gemini 3 | https://ai.google.dev/gemini-api/docs/media-resolution | Default (unspecified) 560 tokens per PDF page; low 280 plus native text. |
| Native PDF text is free on Gemini 3 | https://ai.google.dev/gemini-api/docs/document-processing | "You are not charged for tokens originating from the extracted native text in PDFs." |
| Older per-page figure | https://ai.google.dev/gemini-api/docs/generate-content/document-processing | "Each document page is equivalent to 258 tokens." |
| Free tier exists | https://ai.google.dev/gemini-api/docs/pricing | Free tier input and output are "Free of charge" for all eight Flash and Flash-Lite models checked. |
| Free tier data use | https://ai.google.dev/gemini-api/docs/pricing | Free tier: "Content used to improve our products". Paid tier: "Content **not** used to improve our products". |
| Free tier terms | https://ai.google.dev/gemini-api/terms | Unpaid Services: Google uses submitted content and responses to improve products; "human reviewers may read, annotate, and process your API input and output"; "Do not submit sensitive, confidential, or personal information to the Unpaid Services." |
| Paid tier terms | https://ai.google.dev/gemini-api/terms | Paid Services: Google "doesn't use your prompts" or responses "to improve our products"; logs kept "for a limited period of time" for abuse detection and legal needs. Paid requires a Cloud project with active billing. |
| Regional rule | https://ai.google.dev/gemini-api/terms | For users in the EEA, Switzerland and UK, only Paid Services may be used when making API clients available to users there. |
| Free tier rate limits | https://ai.google.dev/gemini-api/docs/rate-limits | No numbers published on the page. It says to "View your active rate limits in AI Studio". Limits are per project; RPD resets at midnight Pacific. |

## Assumptions

All of these are assumptions, not Google figures.

- Pages per certificate: 2 (upper end of 1 to 2). One page would cut input by 560 tokens per call.
- Tokens per page: 560, the Gemini 3 default. Native text is free on Gemini 3, so it adds nothing.
- Prompt text: 600 tokens.
- Input per call: 2 x 560 + 600 = 1,720 tokens.
- Output per call, base case: 300 tokens.
- Output per call, thinking case: 300 + 2,000 thinking tokens = 2,300 tokens. The 2,000 figure is a guess; Google publishes no typical value.
- Calls per certificate: 1.5 (allows for retries).
- Volume: low 140 certificates a year (4 projects x 35); likely 280 (with resubmissions and renewals); high 700 (stated ceiling).
- 3.8 Flash uses the Jan 1, 2027 price ($1.50 / $7.50), since most of a year of use falls after that date.

## Per-call cost

| Model | Case | Input cost | Output cost | Per call |
|---|---|---|---|---|
| 3.5 Flash-Lite | base | 1,720 x $0.30 / 1M = $0.000516 | 300 x $2.50 / 1M = $0.000750 | $0.001266 |
| 3.5 Flash-Lite | thinking | $0.000516 | 2,300 x $2.50 / 1M = $0.005750 | $0.006266 |
| 3.8 Flash (2027 price) | base | 1,720 x $1.50 / 1M = $0.002580 | 300 x $7.50 / 1M = $0.002250 | $0.004830 |
| 3.8 Flash (2027 price) | thinking | $0.002580 | 2,300 x $7.50 / 1M = $0.017250 | $0.019830 |

## Cost per year

Calls = certificates x 1.5. Input tokens = calls x 1,720. Output tokens = calls x 300 (base) or calls x 2,300 (thinking).

| Case | Calls | Input tokens | Output tokens (base / thinking) | 3.5 Flash-Lite base | 3.5 Flash-Lite thinking | 3.8 Flash base | 3.8 Flash thinking |
|---|---|---|---|---|---|---|---|
| Low (140 x 1.5) | 210 | 361,200 | 63,000 / 483,000 | 210 x $0.001266 = $0.27 | 210 x $0.006266 = $1.32 | 210 x $0.004830 = $1.01 | 210 x $0.019830 = $4.16 |
| Likely (280 x 1.5) | 420 | 722,400 | 126,000 / 966,000 | 420 x $0.001266 = $0.53 | 420 x $0.006266 = $2.63 | 420 x $0.004830 = $2.03 | 420 x $0.019830 = $8.33 |
| High (700 x 1.5) | 1,050 | 1,806,000 | 315,000 / 2,415,000 | 1,050 x $0.001266 = $1.33 | 1,050 x $0.006266 = $6.58 | 1,050 x $0.004830 = $5.07 | 1,050 x $0.019830 = $20.82 |

### Comparison with earlier estimates

| Estimate | Supported by the math? |
|---|---|
| "$100 to $400 a year" | No. The highest case here is $20.82. Reaching $100 would need about 5 times the high-case volume on the most expensive setup. |
| "under $1 a year" | Yes for 3.5 Flash-Lite with minimal thinking at low and likely volume ($0.27 and $0.53). No at high volume ($1.33) or with heavy thinking or 3.8 Flash ($1 to $21). "Under $25 a year" holds for every case. |

## Implications for this build

- Inference: API cost is not a factor in the ROI case. Even the worst case is about $21 a year, so the CFO story should rest on staff time saved, not model cost.
- Inference: Use the paid tier. COIs carry business names, policy numbers and limits, and the free-tier terms say not to submit confidential information and allow human review. The paid tier cost is cents to a few dollars a year.
- Inference: For a portfolio demo with fictional sample certificates only, the free tier is acceptable, because no real data is sent. Switch to paid before any real certificate goes through.
- Inference: Keep thinking at the lowest level the model allows. Thinking tokens are the largest cost driver in this table.
- Inference: Log `usageMetadata` token counts per call (including `thoughtsTokenCount`) to a Sheet so the real cost replaces these assumptions after the first runs.
- Inference: Setting `media_resolution` to low (280 tokens per page plus free native text) would cut input cost further, but only if accuracy holds. Input is already the smaller part of the cost.

## Unknowns

- Real thinking token counts for this task. The 2,000-token thinking case is a guess.
- Free-tier rate limits. Google publishes them only in AI Studio, not on the docs page.
- Whether the Jan 1, 2027 price rise for 3.6, 3.7 and 3.8 Flash is final. The pricing page states it; the changelog does not mention it.
- Whether any price change is planned for 3.5 Flash-Lite. None is shown.
- Whether the 258 tokens per page figure would apply instead of 560 for any model used. Using 258 would lower input cost slightly; the conclusion does not change.
