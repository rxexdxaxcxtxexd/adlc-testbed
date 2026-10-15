# Draft samples (ticket A)

What the model is told when it drafts a people-facing message, and a table for the owner to fill from a live run.
Fictional data only. The model never sees an amount, a date or a name. The code prints those lines itself.

## The prompt

`{audience}` is "project manager" for the deficiency notice and "subcontractor" for the correction request.

```
You write short, plain emails for a construction firm's insurance compliance team.
Audience: {audience}. Tone: polite, direct, no blame.
You get a list of problems with a certificate of insurance, each with an id, a kind and the field it is about.
Kind "limit" means a coverage limit is missing or too low. Kind "requirement" means something the project needs is not on the certificate.
Write one opening sentence. Then, for each id, one sentence saying what fixes the problem, such as what to ask the insurance agent for.
The system prints the facts above each of your sentences, so do not repeat them and do not count the problems.
Never write a number, an amount, a date, a link or a name. The system adds those.
Use each id you were given exactly once, and no other id.
```

## Model input per certificate

Each input comes from `draftInput(audience, deficiencies)`, run on the expected values in
`test-fixtures/sample-cois/manifest.json` for the sample subcontractor (roofing scope). The id is the deficiency's
position from 1 plus its kind. A certificate with no deficiency, or a file the Reader cannot read, makes no draft call.
An expired policy is not an `evaluateCoi` deficiency, so it makes no draft call. Only deficiencies from `evaluateCoi` reach the drafter.
The second clean certificate is checked against its own insured, as it would be for its own subcontractor.

### 01-clean.pdf: none

No deficiency. No draft call.

### 02-clean-earthwork.pdf: none (second insured; professional liability listed)

No deficiency. No draft call.

### 03-expired.pdf: expired policy

No deficiency. No draft call.

### 04-low-limit.pdf: limit below requirement (general liability each occurrence)

Code lines (printed by the code, never sent to the model):

- General liability: $500,000 shown, $1,000,000 required
- Aggregate: $1,000,000 shown, $2,000,000 required

Model input:

```json
{
  "audience": "project manager",
  "items": [
    {
      "id": "D1-limit",
      "kind": "limit",
      "field_label": "General liability"
    },
    {
      "id": "D2-limit",
      "kind": "limit",
      "field_label": "Aggregate"
    }
  ]
}
```

### 05-wrong-insured.pdf: wrong insured name

Code lines (printed by the code, never sent to the model):

- Insured name: certificate shows Ridgeline Roofing Partners LLC; must read Ridgeline Roofing LLC

Model input:

```json
{
  "audience": "project manager",
  "items": [
    {
      "id": "D1-requirement",
      "kind": "requirement",
      "field_label": "Insured name"
    }
  ]
}
```

### 06-no-additional-insured.pdf: missing additional insured endorsement

Code lines (printed by the code, never sent to the model):

- Additional insured endorsement: not shown; required

Model input:

```json
{
  "audience": "project manager",
  "items": [
    {
      "id": "D1-requirement",
      "kind": "requirement",
      "field_label": "Additional insured endorsement"
    }
  ]
}
```

### 07-corrupt.pdf: corrupt file (a real certificate cut off partway through)

Unreadable. The accountant is asked to resend. No draft call.

### 08-not-a-pdf.pdf: not a PDF (plain text with a .pdf name)

Unreadable. The accountant is asked to resend. No draft call.

## Live outputs

Owner fills this after a live run (see "Owner must run" in the lane A report). One row per call. The check column is
the result of `checkDraft`. Anything with a number, currency sign, link, missing id or extra id must show "rejected".

| Date | Certificate | Audience | Opening | Lines | Check | Tokens in / out | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
|  |  |  |  |  |  |  |  |
