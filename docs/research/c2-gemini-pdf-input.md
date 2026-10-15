# C2. Can the Gemini API take a PDF directly?

Retrieved: 2026-10-07

## Answer

Yes. The Gemini API accepts a PDF directly as base64 data inside the request, so Apps Script does not need a PDF text extractor. Inline PDFs can be up to 50 MB or 1000 pages, far above a 50 to 300 KB certificate. The model reads both the page images and the embedded text layer. Google's docs list structured JSON output as a model capability and describe PDF extraction into structured formats, but no Google page shows a single example that combines an inline PDF with a JSON schema, so the first test call should confirm it. UrlFetchApp allows 50 MB per POST, so payload size is not a constraint.

## Findings

| Claim | Source (exact URL) | Quote or close paraphrase |
|---|---|---|
| PDFs can be sent inline to `generateContent` | https://ai.google.dev/gemini-api/docs/generate-content/document-processing | "You can pass PDF data inline in the request to `generateContent`." Inline is "best suited for smaller documents or temporary processing." |
| PDF size and page limit | https://ai.google.dev/gemini-api/docs/generate-content/document-processing | "Gemini supports PDF files up to 50MB or 1000 pages." "This limit applies to both inline data and Files API uploads." |
| Inline request limit in general | https://ai.google.dev/gemini-api/docs/generate-content/file-input-methods | Inline data: "100 MB per request/payload"; "PDFs are limited to 50MB for this method." |
| Files API alternative | https://ai.google.dev/gemini-api/docs/generate-content/file-input-methods | File API: "2 GB per file, up to 20GB per project". "File API uploads are temporary and expire after 48 hours." |
| Files API recommended for big or reused files | https://ai.google.dev/gemini-api/docs/document-processing | Recommended for "larger files or when you intend to reuse a document across multiple requests." |
| Tokens per page (general figure) | https://ai.google.dev/gemini-api/docs/generate-content/document-processing | "Each document page is equivalent to 258 tokens." |
| Tokens per page on Gemini 3 models (default) | https://ai.google.dev/gemini-api/docs/media-resolution | PDF page tokens by `media_resolution`: unspecified (default) 560; low 280 plus native text; medium 560 plus native text; high 1120 plus native text. |
| Text layer and images both read | https://ai.google.dev/gemini-api/docs/document-processing | Gemini uses native vision to analyze "text, images, diagrams, charts, and tables." For Gemini 3: "Text natively embedded in the PDF is extracted and provided to the model." |
| Native PDF text is not billed on Gemini 3 | https://ai.google.dev/gemini-api/docs/document-processing | "You are not charged for tokens originating from the extracted native text in PDFs." Page-image tokens are reported under the `IMAGE` modality. |
| REST inline PDF body (generateContent) | https://ai.google.dev/gemini-api/docs/generate-content/document-processing | Endpoint `.../v1beta/models/gemini-3.8-flash:generateContent?key=$GOOGLE_API_KEY`; body `"contents": [{ "parts":[ {"inline_data": {"mime_type": "application/pdf", "data": "..."}}, {"text": "..."} ] }]`. REST uses snake_case; JS and Go samples use camelCase `inlineData` / `mimeType`. |
| generateContent is still supported but labelled legacy | https://ai.google.dev/gemini-api/docs/migrate-to-interactions | "While `generateContent` remains fully supported, we recommend the Interactions API for all new development." The document-processing page title reads "Gemini Generate Content API (Legacy)". |
| Newer Interactions API body shape | https://ai.google.dev/gemini-api/docs/document-processing | POST `https://generativelanguage.googleapis.com/v1beta/interactions` with `"input": [ {"type": "document", "data": "<base64>", "mime_type": "application/pdf"}, {"type": "text", "text": "..."} ]`. |
| Structured output, generateContent guide shape | https://ai.google.dev/gemini-api/docs/generate-content/structured-output | REST example nests the schema as `"generationConfig": { "responseFormat": { "text": { "mimeType": "application/json", "schema": {...} } } }`. |
| Structured output, API reference field names | https://ai.google.dev/api/generate-content | Search summary of the reference: `responseMimeType` plus `responseJsonSchema` in GenerationConfig, with `responseSchema` marked deprecated. I could not load the GenerationConfig section directly (page truncated). |
| Structured output, Interactions API shape | https://ai.google.dev/gemini-api/docs/structured-output | "configure `response_format` ... of type `text`", "set its `mime_type` to `application/json`", "The schema should be provided in the `schema` field." |
| Structured output supports a subset of JSON Schema | https://ai.google.dev/gemini-api/docs/structured-output | "Gemini's structured output mode supports a subset of the JSON Schema specification." Very large or deeply nested schemas may be rejected. |
| PDF plus structured output | https://ai.google.dev/gemini-api/docs/document-processing | The page lists extracting into "structured output formats" as a capability. No page shows a PDF and a schema in one example. |
| Model accepts PDF and structured output | https://ai.google.dev/gemini-api/docs/models/gemini-3.5-flash-lite | Inputs "Text, Image, Video, Audio, and PDF"; structured outputs "Supported". Same for https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash |
| UrlFetchApp POST size | https://developers.google.com/apps-script/guides/services/quotas | URL Fetch POST size "50 MB / call" (consumer and Workspace). |
| UrlFetchApp response size | https://developers.google.com/apps-script/guides/services/quotas | URL Fetch response size "50 MB / call". |
| UrlFetchApp daily calls and runtime | https://developers.google.com/apps-script/guides/services/quotas | URL Fetch calls "20,000 / day" (consumer), "100,000 / day" (Workspace). Script runtime "6 min / execution". Headers "100 / call", header size "8 KB / call", URL length "2 KB / call". |

### Request body shape for this build (generateContent, from Google's two examples combined)

Google shows the PDF part and the JSON output config in separate examples. This combines them. It is not a single Google example.

```json
POST https://generativelanguage.googleapis.com/v1beta/models/MODEL_ID:generateContent
Header: x-goog-api-key: <API key>
Content-Type: application/json

{
  "contents": [{
    "parts": [
      {"inline_data": {"mime_type": "application/pdf", "data": "<base64 of PDF>"}},
      {"text": "<extraction prompt>"}
    ]
  }],
  "generationConfig": {
    "temperature": 0,
    "responseMimeType": "application/json",
    "responseJsonSchema": { "type": "object", "properties": { "...": {} }, "required": ["..."] }
  }
}
```

The generateContent structured-output guide instead shows `"generationConfig": {"responseFormat": {"text": {"mimeType": "application/json", "schema": {...}}}}`. Test one shape first and fall back to the other.

## Implications for this build

- Inference: Apps Script can send the certificate with `Utilities.base64Encode(blob.getBytes())` inside an `inline_data` part. No Files API upload step is needed, because each certificate is used once and is tiny.
- Inference: A 300 KB PDF becomes about 400 KB as base64. That is well under the 50 MB UrlFetchApp POST limit and the 50 MB inline PDF limit.
- Inference: Born-digital ACORD forms have a real text layer. On Gemini 3 models that text is passed to the model at no token charge, which should help accuracy on dollar amounts and dates.
- Inference: Budget 560 tokens per page on Gemini 3 models (the default), not 258. The 258 figure appears on the legacy page and seems to describe older models.
- Inference: Build on `generateContent` for now. It is "fully supported" and has the simplest shape for raw HTTP. Keep the request builder in one function so a later move to the Interactions API touches one place.
- Inference: Validate the returned JSON in code anyway. Google warns that schema-valid output can still be wrong.

## Unknowns

- Which structured-output field names the live REST endpoint accepts today: `responseMimeType` + `responseJsonSchema` (API reference, per search summary), `responseSchema` (deprecated), or `responseFormat.text.schema` (generateContent guide). Google's pages disagree. Test with one real call.
- No Google page shows an inline PDF and a JSON schema in the same request. The capability is implied, not shown.
- Whether the 258 tokens per page figure still applies to any current model, or only to pre-Gemini 3 models.
- Whether `media_resolution` set to `low` (280 tokens per page plus free native text) keeps extraction accuracy on ACORD 25 forms. Needs a test.
- Whether the generateContent endpoint has a planned end date. None is published as of retrieval.
