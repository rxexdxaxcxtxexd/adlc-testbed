# C3. Current Gemini model for cheap, accurate extraction

Retrieved: 2026-10-07

## Answer

The current stable Flash-tier models are `gemini-3.8-flash` (newest), `gemini-3.7-flash`, `gemini-3.6-flash` and `gemini-3.5-flash`. The stable Flash-Lite models are `gemini-3.5-flash-lite` and `gemini-3.1-flash-lite`. `gemini-2.5-flash` is not deprecated and has no shutdown date, but since September 18, 2026 Google limits it to users who used it before, so a new project may not get access. Google tells new projects to use 3.5 Flash-Lite or 3.8 Flash. Inference: put `gemini-3.5-flash-lite` in `Config.gs`, with `gemini-3.8-flash` as the fallback if accuracy falls short.

## Findings

| Claim | Source (exact URL) | Quote or close paraphrase |
|---|---|---|
| Stable Flash models | https://ai.google.dev/gemini-api/docs/models | Listed as Stable: `gemini-3.8-flash` (New), `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.5-flash` (described as a legacy Flash model). |
| Stable Flash-Lite models | https://ai.google.dev/gemini-api/docs/models | Listed as Stable: `gemini-3.5-flash-lite` ("Fastest, most cost-effective 3.5 model"), `gemini-3.1-flash-lite`. |
| Preview model | https://ai.google.dev/gemini-api/docs/models | `gemini-3-flash-preview` is listed under Preview. |
| Shut down models | https://ai.google.dev/gemini-api/docs/models | `gemini-3.1-flash-lite-preview`, `gemini-2.0-flash`, `gemini-2.0-flash-lite` listed as shut down. |
| 2.0 Flash shutdown date and replacement | https://ai.google.dev/gemini-api/docs/deprecations | `gemini-2.0-flash` and `gemini-2.0-flash-001`: shutdown June 1, 2026; replacement `gemini-3.6-flash`. |
| 2.5 Flash-Lite preview shutdown | https://ai.google.dev/gemini-api/docs/deprecations | `gemini-2.5-flash-lite-preview-09-2025`: shutdown March 31, 2026; replacement `gemini-3.1-flash-lite`. |
| No shutdown dates for current models | https://ai.google.dev/gemini-api/docs/deprecations | `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-3-flash-preview`, `gemini-3.5-flash`, `gemini-3.6-flash`, `gemini-3.7-flash`, `gemini-3.8-flash`: shutdown "None announced". Listed dates are "the _earliest possible dates_" for retirement. |
| Release dates | https://ai.google.dev/gemini-api/docs/deprecations | 3.5 Flash May 19, 2026; 3.6 Flash July 21, 2026; 3.7 Flash Aug 13, 2026; 3.8 Flash Sept 2, 2026; 2.5 Flash June 17, 2025. |
| 2.5 models restricted to past users | https://ai.google.dev/gemini-api/docs/changelog | Sep 18, 2026: "we are limiting access to the 2.5 models to users who have actively used them in the past." Not deprecated, available "until further notice." New projects should use 3.5 Flash-Lite or 3.8 Flash. |
| 2.5 models still served | https://ai.google.dev/gemini-api/docs/models | "These models are not deprecated and will continue to be served until further notice through the API." |
| 3.5 Flash-Lite purpose | https://ai.google.dev/gemini-api/docs/changelog | Jul 21, 2026: GA, "a low-latency, highly cost-effective subagent option designed for high-volume automation." |
| 3.8 Flash release | https://ai.google.dev/gemini-api/docs/changelog | Sep 2, 2026: GA, "engineered for long-horizon software engineering, autonomous agents, and complex enterprise workflows." |
| 3.1 Flash-Lite release | https://ai.google.dev/gemini-api/docs/changelog | May 7, 2026: GA, "optimized for speed, scale, and cost efficiency." |
| 3.5 Flash-Lite specs | https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite | Stable `gemini-3.5-flash-lite`; inputs include PDF; 1,048,576 input and 65,536 output tokens; structured outputs and thinking supported; latest update July 2026. |
| 3.8 Flash specs | https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash | Stable `gemini-3.8-flash`; inputs include PDF; structured outputs supported; thinking "Supported (low, medium, high)"; `minimal` "is not supported and returns an error". |
| Default thinking levels | https://ai.google.dev/gemini-api/docs/thinking | `gemini-3.8-flash`: on (medium). `gemini-3.5-flash-lite`: on (minimal). `gemini-2.5-flash-lite`: off by default. |
| "latest" aliases exist | https://ai.google.dev/gemini-api/docs/models | The page defines the alias pattern, for example `gemini-flash-latest`, but lists no specific alias. |
| Structured output model list may lag | https://ai.google.dev/gemini-api/docs/generate-content/structured-output | The legacy guide's supported list names 3.1 Flash-Lite, 3.5 Flash, 2.5 Flash and others, but not 3.5 Flash-Lite or 3.8 Flash. The model pages for those two say structured outputs are supported. |

## Implications for this build

- Inference: Use `gemini-3.5-flash-lite` in `Config.gs`. It is stable, accepts PDFs, supports structured output, and defaults to minimal thinking, which keeps output tokens and cost low. Google names it as a default choice for new projects.
- Inference: Keep `gemini-3.8-flash` as the documented fallback. It is the newest stable Flash model and should be more accurate, but it costs more and cannot go below "low" thinking.
- Inference: Do not use `gemini-2.5-flash`. A new personal project probably counts as a new user and may be refused access.
- Inference: Do not use a `-latest` alias. A silent model swap would change extraction behaviour without a code change, which breaks the trust story for the data manager.
- Inference: The release pace is about one Flash model per month in 2026. Store the model ID only in `Config.gs` and re-check the deprecations page at each build.
- Inference: The 0.85 confidence gate matters more on Flash-Lite. Measure how many sample certificates fall below it before choosing between the two models.

## Unknowns

- Whether a brand-new API key project can call `gemini-2.5-flash` at all. The changelog says access is limited to past users, but does not define "past user".
- Measured extraction accuracy of 3.5 Flash-Lite vs 3.8 Flash on ACORD 25 forms. No Google benchmark covers this.
- Whether `gemini-3.5-flash-lite` with minimal thinking plus a JSON schema returns reliable dollar limits and dates. Needs a test set.
- Future shutdown dates. None are announced for any current Flash or Flash-Lite model.
