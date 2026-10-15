// The Drafter, driven through a fake model service. It never throws: an HTTP error, a reply that is not
// JSON, or a draft that breaks a rule gives draft null and a reason. Expected values are written by hand.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGsRaw, plain } = require('./load-gs');

const { buildDrafter, buildDraftRequest } = loadGsRaw(['buildDrafter', 'buildDraftRequest']);

const TWO = [
  { field: 'umbrella', kind: 'limit', text: 'Umbrella: $1,000,000 shown, $2,000,000 required' },
  { field: 'additional_insured_endorsement', kind: 'requirement', text: 'Additional insured endorsement: not shown; required' },
];
const GOOD = {
  opening: 'This certificate does not yet meet the project requirements.',
  explanations: [
    { id: 'D1-limit', text: 'Ask the insurance agent for an umbrella policy that meets the project limit.' },
    { id: 'D2-requirement', text: 'Ask the agent to add the firm as additional insured by endorsement.' },
  ],
};
const USAGE = { promptTokenCount: 310, candidatesTokenCount: 62, thoughtsTokenCount: 0, totalTokenCount: 372 };

const reply = (text, usage) => ({
  status: 200,
  text: JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }], usageMetadata: usage }),
});

function drafter(response) {
  const seen = { requests: [] };
  const d = buildDrafter((request) => {
    seen.requests.push(plain(request));
    if (typeof response === 'function') return response();
    return response;
  });
  return { d, seen };
}

test('a good reply gives the draft, no reason and the usage', () => {
  const { d } = drafter(reply(JSON.stringify(GOOD), USAGE));
  assert.deepEqual(plain(d.draft('subcontractor', TWO)), { draft: GOOD, reason: '', usage: USAGE });
});

test('the request names the configured model, asks for JSON at temperature 0.3 with the draft schema, and sends only ids, kinds and labels', () => {
  const { d, seen } = drafter(reply(JSON.stringify(GOOD), USAGE));
  d.draft('project manager', TWO);
  const req = seen.requests[0];
  assert.equal(req.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
  assert.equal(req.body.generationConfig.temperature, 0.3);
  assert.equal(req.body.generationConfig.responseMimeType, 'application/json');
  assert.deepEqual(req.body.generationConfig.responseJsonSchema.required, ['opening', 'explanations']);
  const [prompt, input] = req.body.contents[0].parts.map((p) => p.text);
  assert.match(prompt, /^You write short, plain emails/);
  assert.match(prompt, /Audience: project manager\./);
  assert.doesNotMatch(prompt, /\{audience\}/);
  assert.equal(input, '{"audience":"project manager","items":[{"id":"D1-limit","kind":"limit","field_label":"Umbrella"},' +
    '{"id":"D2-requirement","kind":"requirement","field_label":"Additional insured endorsement"}]}');
  assert.doesNotMatch(JSON.stringify(req.body), /1,000,000|\$/);
  assert.deepEqual(plain(buildDraftRequest('project manager', TWO)), req);
});

test('a reply with a number gives no draft, the check reason and the usage', () => {
  const bad = { ...GOOD, explanations: [{ id: 'D1-limit', text: 'Raise the umbrella to 2 million.' }, GOOD.explanations[1]] };
  const { d } = drafter(reply(JSON.stringify(bad), USAGE));
  assert.deepEqual(plain(d.draft('subcontractor', TWO)), { draft: null, reason: 'Draft rejected: contains a number.', usage: USAGE });
});

test('HTTP 429 gives no draft and a reason that names the status', () => {
  const { d } = drafter({ status: 429, text: '{"error":{"code":429,"message":"Resource exhausted"}}' });
  assert.deepEqual(plain(d.draft('subcontractor', TWO)), { draft: null, reason: 'The model service failed (HTTP 429).', usage: null });
});

test('a reply whose text is not JSON gives no draft and a reason', () => {
  const { d } = drafter(reply('Sure! Here is your email: {opening: ', USAGE));
  assert.deepEqual(plain(d.draft('subcontractor', TWO)), { draft: null, reason: 'The model reply was not valid JSON.', usage: USAGE });
});

test('a response body that is not JSON gives no draft and a reason', () => {
  const { d } = drafter({ status: 200, text: '<html>Bad gateway</html>' });
  assert.deepEqual(plain(d.draft('subcontractor', TWO)), { draft: null, reason: 'The model reply was not valid JSON.', usage: null });
});

test('a reply with no answer gives no draft and a reason', () => {
  const { d } = drafter({ status: 200, text: JSON.stringify({ candidates: [], usageMetadata: USAGE }) });
  assert.deepEqual(plain(d.draft('subcontractor', TWO)), { draft: null, reason: 'The model returned no answer.', usage: USAGE });
});

test('a send that throws (no API key, network down) gives no draft and the error as the reason', () => {
  const { d } = drafter(() => { throw new Error('Script Property GEMINI_API_KEY is not set.'); });
  assert.deepEqual(plain(d.draft('subcontractor', TWO)), { draft: null, reason: 'Script Property GEMINI_API_KEY is not set.', usage: null });
});

test('the draft keeps only the opening and the id and text of each line', () => {
  const extra = { ...GOOD, tone: 'warm', explanations: GOOD.explanations.map((e) => ({ ...e, note: 'x' })) };
  const { d } = drafter(reply(JSON.stringify(extra), USAGE));
  assert.deepEqual(plain(d.draft('subcontractor', TWO)).draft, GOOD);
});

// --- Wiring: the upload job drafts once and stores; the reject reads what was stored ---

const UPLOAD_BASE = 'https://upload.example.test/exec';
const INTERNAL_BASE = 'https://app.example.test/exec';
const RECORD_LINK = 'https://app.example.test/exec?record=REC-001&as=project_manager';
const UPLOAD_LINK = 'https://upload.example.test/exec?t=token-1';
const FILE = { name: 'ridgeline-coi.pdf', fingerprint: 'sha256-1', link: 'fake://inbox/ridgeline-coi.pdf' };
const MARCUS_REJECTS = ['REC-001', 'project_manager', 'reject', {}];

// 01-clean.pdf with the umbrella of 04-style problem ($1M) and no endorsement (06): two deficiencies.
function twoProblemReading(sample) {
  const base = plain(sample);
  return { ...base, values: { ...base.values, limits: { ...base.values.limits, umbrella: 1000000 }, additional_insured_endorsement: false } };
}

// A fresh app with the sample project. props are the Script Properties. reply is what each draft call returns.
function app(props, reply) {
  const LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) };
  const PropertiesService = { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null) }) };
  const c = loadGsRaw(['initProject', 'seedSampleProject', 'processCertificate', 'reviewAction', 'FakeStore', 'FakeReader',
    'FakeMailer', 'FakeClock', 'FakeCalendar', 'SAMPLE_READING', 'recordAiCall', 'recordDetail', 'loadRecord', 'withDeficiencyDraft'], { LockService, PropertiesService });
  const calls = [];
  const deps = {
    store: c.FakeStore(), reader: c.FakeReader(twoProblemReading(c.SAMPLE_READING)), mailer: c.FakeMailer(),
    clock: c.FakeClock('2026-10-08', '2026-10-08T09:00:00'), calendar: c.FakeCalendar(), newToken: () => 'token-1',
    uploadBaseUrl: UPLOAD_BASE, internalBaseUrl: INTERNAL_BASE,
    drafter: { draft: (audience, deficiencies) => { calls.push([audience, plain(deficiencies).length]); return reply(audience); } },
  };
  c.initProject(deps.store);
  c.seedSampleProject(deps);
  let n = 0;
  deps.newToken = () => 'call-' + (++n);
  return { c, deps, calls, drafts: () => plain(deps.store.readRows('ai_drafts')), sent: () => plain(deps.mailer.sent()).map((m) => m.body) };
}

const DEMO_PROJ = { DEMO_MODE: 'off' };
const PM_LINES = {
  opening: 'This certificate needs a decision before work goes ahead.',
  explanations: [
    { id: 'D1-limit', text: 'The umbrella policy is below what this project asks for.' },
    { id: 'D2-requirement', text: 'The firm is not shown as additional insured.' },
  ],
};
const SUB_LINES = {
  opening: 'Thank you for sending your certificate. The listed items need an update.',
  explanations: [
    { id: 'D1-limit', text: 'Ask your insurance agent to raise the umbrella limit to the project amount.' },
    { id: 'D2-requirement', text: 'Ask your agent for an additional insured endorsement naming the firm.' },
  ],
};
const goodReply = (audience) => ({ draft: audience === 'subcontractor' ? SUB_LINES : PM_LINES, reason: '', usage: USAGE });

const TEMPLATE_NOTICE = 'Ridgeline Roofing LLC: Umbrella: $1,000,000 shown, $2,000,000 required; Additional insured endorsement: not shown; required. ' +
  'Waive or reject? Open the record: ' + RECORD_LINK;
const TEMPLATE_CORRECTION = 'Your certificate does not meet the project requirements. Please send a corrected certificate.\n' +
  '- Umbrella: $1,000,000 shown, $2,000,000 required\n' +
  '- Additional insured endorsement: not shown; required\n' +
  'Upload it here: ' + UPLOAD_LINK;
const AI_CORRECTION = 'Thank you for sending your certificate. The listed items need an update.\n' +
  '- Umbrella: $1,000,000 shown, $2,000,000 required\n' +
  '  Ask your insurance agent to raise the umbrella limit to the project amount.\n' +
  '- Additional insured endorsement: not shown; required\n' +
  '  Ask your agent for an additional insured endorsement naming the firm.\n' +
  'Please send a corrected certificate.\n' +
  'Upload it here: ' + UPLOAD_LINK;

test('Demo Proj: a new deficiency drafts both messages once, stores two AI rows and sends the drafted notice', () => {
  const a = app(DEMO_PROJ, goodReply);
  a.c.processCertificate(a.deps, 'token-1', FILE);
  assert.deepEqual(a.calls, [['project manager', 2], ['subcontractor', 2]]);
  assert.deepEqual(a.drafts().map((r) => [r.draft_id, r.record_id, r.certificate_id, r.kind, r.drafted_by, r.fallback_reason, r.opening, r.call_id, r.time]), [
    ['DRF-001', 'REC-001', 'CERT-001', 'deficiency_notice', 'AI', '', 'This certificate needs a decision before work goes ahead.', 'call-1', '2026-10-08T09:00:00'],
    ['DRF-002', 'REC-001', 'CERT-001', 'correction_request', 'AI', '', 'Thank you for sending your certificate. The listed items need an update.', 'call-2', '2026-10-08T09:00:00'],
  ]);
  assert.deepEqual(a.sent(), ['Ridgeline Roofing LLC: This certificate needs a decision before work goes ahead.\n' +
    '- Umbrella: $1,000,000 shown, $2,000,000 required\n' +
    '  The umbrella policy is below what this project asks for.\n' +
    '- Additional insured endorsement: not shown; required\n' +
    '  The firm is not shown as additional insured.\n' +
    'Waive or reject? Open the record: ' + RECORD_LINK]);
});

test('Demo Proj: reject sends the stored correction draft and makes no model call', () => {
  const a = app(DEMO_PROJ, goodReply);
  a.c.processCertificate(a.deps, 'token-1', FILE);
  assert.equal(a.c.recordDetail(a.deps, 'REC-001').rejection_text, AI_CORRECTION);
  assert.equal(plain(a.c.reviewAction(a.deps, 'REC-001', 'project_manager', 'reject',
    { certificate_id: 'CERT-001', approved_text: AI_CORRECTION })).ok, true);
  assert.equal(a.calls.length, 2);
  assert.equal(a.sent()[1], AI_CORRECTION);
  assert.equal(a.drafts().length, 2);
});

test('a changed draft requires new approval before any record write or correction email', () => {
  const a = app({ DEMO_MODE: 'off' }, goodReply);
  a.c.processCertificate(a.deps, 'token-1', FILE);
  assert.equal(a.c.recordDetail(a.deps, 'REC-001').rejection_text, AI_CORRECTION);
  a.deps.store.updateRow('ai_drafts', 'draft_id', 'DRF-002', { opening: 'Please ask your agent to update the certificate.' });
  const before = plain(a.deps.store.snapshot());
  assert.deepEqual(plain(a.c.reviewAction(a.deps, 'REC-001', 'project_manager', 'reject',
    { certificate_id: 'CERT-001', approved_text: AI_CORRECTION })),
    { ok: false, message: 'The correction request changed. Reopen the record and approve the current wording.' });
  assert.deepEqual(plain(a.deps.store.snapshot()), before);
  assert.equal(a.sent().length, 1);
  assert.equal(a.calls.length, 2);
});

test('approval for another certificate changes no rows and sends no correction email', () => {
  const a = app({ DEMO_MODE: 'off' }, goodReply);
  a.c.processCertificate(a.deps, 'token-1', FILE);
  const before = plain(a.deps.store.snapshot());
  assert.deepEqual(plain(a.c.reviewAction(a.deps, 'REC-001', 'project_manager', 'reject',
    { certificate_id: 'CERT-002', approved_text: AI_CORRECTION })),
    { ok: false, message: 'The correction request changed. Reopen the record and approve the current wording.' });
  assert.deepEqual(plain(a.deps.store.snapshot()), before);
  assert.equal(a.sent().length, 1);
});

test('AI_DRAFTS off after upload invalidates AI approval and forces a newly approved template', () => {
  const props = { DEMO_MODE: 'off' };
  const a = app(props, goodReply);
  a.c.processCertificate(a.deps, 'token-1', FILE);
  assert.equal(a.c.recordDetail(a.deps, 'REC-001').rejection_text, AI_CORRECTION);
  props.AI_DRAFTS = 'off';
  assert.equal(a.c.recordDetail(a.deps, 'REC-001').rejection_text, TEMPLATE_CORRECTION);
  const before = plain(a.deps.store.snapshot());
  assert.equal(plain(a.c.reviewAction(a.deps, 'REC-001', 'project_manager', 'reject',
    { certificate_id: 'CERT-001', approved_text: AI_CORRECTION })).ok, false);
  assert.deepEqual(plain(a.deps.store.snapshot()), before);
  assert.equal(a.sent().length, 1);
  assert.equal(plain(a.c.reviewAction(a.deps, 'REC-001', 'project_manager', 'reject',
    { certificate_id: 'CERT-001', approved_text: TEMPLATE_CORRECTION })).ok, true);
  assert.equal(a.sent()[1], TEMPLATE_CORRECTION);
  assert.equal(a.calls.length, 2);
  assert.deepEqual(a.drafts().map((r) => r.drafted_by), ['AI', 'AI']);
});

test('AI_DRAFTS off also prevents a stored AI deficiency notice from being reused', () => {
  const props = { DEMO_MODE: 'off' };
  const a = app(props, goodReply);
  a.c.processCertificate(a.deps, 'token-1', FILE);
  props.AI_DRAFTS = 'off';
  const recRow = a.deps.store.readRows('compliance_records')[0];
  const record = a.c.loadRecord(a.deps.store, recRow);
  const effects = [{ type: 'notify', text: TEMPLATE_NOTICE }];
  assert.deepEqual(plain(a.c.withDeficiencyDraft(a.deps, 'REC-001', record, effects, RECORD_LINK)), effects);
  assert.equal(a.calls.length, 2);
});

test('Demo Proj: a failed draft stores Template rows with the reason, and both emails are the template', () => {
  const a = app(DEMO_PROJ, () => ({ draft: null, reason: 'The model service failed (HTTP 429).', usage: null }));
  a.c.processCertificate(a.deps, 'token-1', FILE);
  a.c.reviewAction(a.deps, ...MARCUS_REJECTS);
  assert.deepEqual(a.drafts().map((r) => [r.kind, r.drafted_by, r.fallback_reason, r.opening, r.explanations_json]), [
    ['deficiency_notice', 'Template', 'The model service failed (HTTP 429).', '', ''],
    ['correction_request', 'Template', 'The model service failed (HTTP 429).', '', ''],
  ]);
  assert.deepEqual(a.sent(), [TEMPLATE_NOTICE, TEMPLATE_CORRECTION]);
});

test('Demo Proj with AI_DRAFTS off: no model call, Template rows that say why, and the template emails', () => {
  const a = app({ DEMO_MODE: 'off', AI_DRAFTS: 'off' }, goodReply);
  a.c.processCertificate(a.deps, 'token-1', FILE);
  a.c.reviewAction(a.deps, ...MARCUS_REJECTS);
  assert.deepEqual(a.calls, []);
  assert.deepEqual(a.drafts().map((r) => [r.kind, r.drafted_by, r.fallback_reason]), [
    ['deficiency_notice', 'Template', 'AI drafts are off (Script Property AI_DRAFTS).'],
    ['correction_request', 'Template', 'AI drafts are off (Script Property AI_DRAFTS).'],
  ]);
  assert.deepEqual(a.sent(), [TEMPLATE_NOTICE, TEMPLATE_CORRECTION]);
});

test('Share Proj: the upload job calls no model and writes no ai_drafts row; the emails are the template', () => {
  for (const props of [{}, { DEMO_MODE: 'on' }]) {
    const a = app(props, goodReply);
    a.c.processCertificate(a.deps, 'token-1', FILE);
    a.c.reviewAction(a.deps, ...MARCUS_REJECTS);
    assert.deepEqual(a.calls, []);
    assert.deepEqual(a.drafts(), []);
    assert.deepEqual(a.sent(), [TEMPLATE_NOTICE, TEMPLATE_CORRECTION]);
  }
});

test('a certificate that passes every check calls no model and stores no draft', () => {
  const a = app(DEMO_PROJ, goodReply);
  a.deps.reader = a.c.FakeReader(a.c.SAMPLE_READING);
  a.c.processCertificate(a.deps, 'token-1', FILE);
  assert.deepEqual(a.calls, []);
  assert.deepEqual(a.drafts(), []);
});

test('a stored AI row that breaks a rule (edited in the Sheet) is not sent; the template goes', () => {
  const a = app(DEMO_PROJ, goodReply);
  a.c.processCertificate(a.deps, 'token-1', FILE);
  const row = a.drafts()[1];
  a.deps.store.updateRow('ai_drafts', 'draft_id', row.draft_id, { opening: 'Pay us $500 by Friday.' });
  a.c.reviewAction(a.deps, ...MARCUS_REJECTS);
  assert.equal(a.sent()[1], TEMPLATE_CORRECTION);
});

test('a drafter that throws never stops the upload: the template notice goes and the certificate is saved', () => {
  const a = app(DEMO_PROJ, () => { throw new Error('boom'); });
  const out = plain(a.c.processCertificate(a.deps, 'token-1', FILE));
  assert.equal(out.status, 'in_review');
  assert.deepEqual(a.sent(), [TEMPLATE_NOTICE]);
});

test('metering: one ai_calls row per draft call, linked from the ai_drafts row', () => {
  const a = app(DEMO_PROJ, goodReply);
  a.c.processCertificate(a.deps, 'token-1', FILE);
  const rows = plain(a.deps.store.readRows('ai_calls')).filter((r) => r.purpose === 'draft');
  assert.deepEqual(rows.map((r) => [r.call_id, r.record_id, r.certificate_id, r.input_tokens, r.output_tokens, r.outcome]), [
    ['call-1', 'REC-001', 'CERT-001', 310, 62, 'ok'],
    ['call-2', 'REC-001', 'CERT-001', 310, 62, 'ok'],
  ]);
  assert.deepEqual(a.drafts().map((r) => r.call_id), ['call-1', 'call-2']);
});

test('metering: a draft the check rejects was still billed, so it writes a row; a failed request writes none', () => {
  const rejected = app(DEMO_PROJ, () => ({ draft: null, reason: 'Draft rejected: a number.', usage: USAGE }));
  rejected.c.processCertificate(rejected.deps, 'token-1', FILE);
  assert.deepEqual(plain(rejected.deps.store.readRows('ai_calls')).map((r) => [r.purpose, r.outcome, r.outcome_reason]),
    [['draft', 'rejected', 'Draft rejected: a number.'], ['draft', 'rejected', 'Draft rejected: a number.']]);
  const failed = app(DEMO_PROJ, () => ({ draft: null, reason: 'The model service failed (HTTP 429).', usage: null }));
  failed.c.processCertificate(failed.deps, 'token-1', FILE);
  assert.deepEqual(plain(failed.deps.store.readRows('ai_calls')), []);
});

test('metering: none in Share Proj, none with AI_DRAFTS off, none when nothing is drafted', () => {
  for (const props of [{}, { DEMO_MODE: 'on' }, { DEMO_MODE: 'off', AI_DRAFTS: 'off' }]) {
    const a = app(props, goodReply);
    a.c.processCertificate(a.deps, 'token-1', FILE);
    assert.deepEqual(plain(a.deps.store.readRows('ai_calls')), []);
  }
});
