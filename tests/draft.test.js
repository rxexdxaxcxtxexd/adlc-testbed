// AI drafts (ticket A): the model input, the draft check, the message assembly and the ai_drafts tab.
// The model writes wording only. Code writes every fact line, the closing and the link.
// Expected values are literals. Deficiency texts are the ones evaluateCoi writes for the planted problems.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGs, loadGsRaw, plain } = require('./load-gs');

const g = loadGs(['draftInput', 'draftIds', 'checkDraft', 'assembleDeficiencyNotice', 'assembleCorrectionRequest',
  'correctionText', 'nextStatus', 'usableDraft', 'DRAFT_PROMPT', 'DRAFT_SCHEMA', 'DRAFT_AUDIENCE']);
const raw = loadGsRaw(['FakeStore', 'initProject', 'storeDraft', 'findDraft', 'draftFromRows', 'draftRows']);

// 04-low-limit.pdf on a roofing record (two limit deficiencies) and 06-no-additional-insured.pdf (one requirement).
const LOW_UMBRELLA = { field: 'umbrella', kind: 'limit', text: 'Umbrella: $1,000,000 shown, $2,000,000 required' };
const NO_ENDORSEMENT = { field: 'additional_insured_endorsement', kind: 'requirement', text: 'Additional insured endorsement: not shown; required' };
const WRONG_INSURED = { field: 'insured_name_matches', kind: 'requirement',
  text: 'Insured name: certificate shows Ridgeline Roofing Partners LLC; must read Ridgeline Roofing LLC' };
const TWO = [LOW_UMBRELLA, NO_ENDORSEMENT];

const CLEAN = {
  opening: 'This certificate does not yet meet the project requirements.',
  explanations: [
    { id: 'D1-limit', text: 'Ask the insurance agent for an umbrella policy that meets the project limit.' },
    { id: 'D2-requirement', text: 'Ask the agent to add the firm as additional insured by endorsement.' },
  ],
};
const IDS = ['D1-limit', 'D2-requirement'];
const withOpening = (opening) => ({ ...CLEAN, opening });
const withText = (text) => ({ ...CLEAN, explanations: [CLEAN.explanations[0], { id: 'D2-requirement', text }] });

// --- Model input ---

test('the model input holds the audience and, per deficiency, only an id, the kind and the field label', () => {
  assert.deepEqual(g.draftInput('subcontractor', TWO), {
    audience: 'subcontractor',
    items: [
      { id: 'D1-limit', kind: 'limit', field_label: 'Umbrella' },
      { id: 'D2-requirement', kind: 'requirement', field_label: 'Additional insured endorsement' },
    ],
  });
});

test('the model input carries no amount, digit-bearing value or name from the deficiency text', () => {
  const input = JSON.stringify(g.draftInput('project manager', [LOW_UMBRELLA, WRONG_INSURED]));
  assert.doesNotMatch(input, /\$|1,000,000|Ridgeline|Partners/);
  assert.equal(input, '{"audience":"project manager","items":[{"id":"D1-limit","kind":"limit","field_label":"Umbrella"},' +
    '{"id":"D2-requirement","kind":"requirement","field_label":"Insured name"}]}');
});

test('ids are the position from 1 and the kind, in the order evaluateCoi lists the deficiencies', () => {
  assert.deepEqual(g.draftIds([NO_ENDORSEMENT, LOW_UMBRELLA, WRONG_INSURED]), ['D1-requirement', 'D2-limit', 'D3-requirement']);
  assert.deepEqual(g.draftIds([]), []);
});

test('each kind of draft has its audience, and the prompt names the audience and forbids numbers, links and names', () => {
  assert.deepEqual(g.DRAFT_AUDIENCE, { deficiency_notice: 'project manager', correction_request: 'subcontractor' });
  assert.match(g.DRAFT_PROMPT, /\{audience\}/);
  assert.match(g.DRAFT_PROMPT, /Never write a number, an amount, a date, a link or a name\./);
  assert.deepEqual(g.DRAFT_SCHEMA.required, ['opening', 'explanations']);
});

// --- checkDraft: one test per rule (plan A4) ---

test('rule 1: a digit in any model text is rejected as a number', () => {
  assert.deepEqual(g.checkDraft(withOpening('Two problems need fixing by day 30.'), IDS), { ok: false, reason: 'contains a number' });
  assert.deepEqual(g.checkDraft(withText('Raise the umbrella to 2 million.'), IDS), { ok: false, reason: 'contains a number' });
});

test('a spelled-out amount is rejected, so the model cannot write a figure in words', () => {
  for (const word of ['million', 'Thousand', 'hundred', 'billion', 'dozen', 'percent']) {
    assert.deepEqual(g.checkDraft(withText('Raise the umbrella to two ' + word + '.'), IDS), { ok: false, reason: 'contains a number word' }, word);
  }
  assert.equal(g.checkDraft(withText('Ask the agent to add the missing endorsement.'), IDS).ok, true);
});

test('ordinary number words and amounts are rejected in the opening and each explanation', () => {
  for (const text of [
    'Ask for five dollars of umbrella coverage.',
    'Two items need an update.',
    'Raise the limit to twenty-five.',
    'Half the required amount is enough.',
    'Ask for a dollar of coverage.',
    'Only ninety cents are required.',
    'A quarter of the required limit is enough.',
    'A trillion is required.',
  ]) {
    assert.deepEqual(g.checkDraft(withOpening(text), IDS), { ok: false, reason: 'contains a number word' }, text);
    assert.deepEqual(g.checkDraft(withText(text), IDS), { ok: false, reason: 'contains a number word' }, text);
  }
});

test('named dates, weekdays and relative days are rejected without rejecting modal may', () => {
  for (const text of [
    'Send a corrected certificate by May.',
    'Send a corrected certificate by may.',
    'The policy expires in September.',
    'Send the renewal before Jan.',
    'Send a corrected certificate on Monday.',
    'Send the certificate before Thu.',
    'Please send the renewal tomorrow.',
  ]) {
    assert.deepEqual(g.checkDraft(withOpening(text), IDS), { ok: false, reason: 'contains a date' }, text);
    assert.deepEqual(g.checkDraft(withText(text), IDS), { ok: false, reason: 'contains a date' }, text);
  }
  assert.deepEqual(g.checkDraft(withText('The agent may need to add the missing endorsement.'), IDS), { ok: true, reason: '' });
  assert.deepEqual(g.checkDraft(withOpening('Please review the listed items with your agent.'), IDS), { ok: true, reason: '' });
});

test('rule 2: a dollar, euro or pound sign is rejected', () => {
  for (const sign of ['$', '€', '£']) {
    assert.deepEqual(g.checkDraft(withText('Raise the limit by ' + sign + ' a lot.'), IDS), { ok: false, reason: 'contains a currency sign' }, sign);
  }
});

test('rule 3: a link is rejected, written with http or www.', () => {
  assert.deepEqual(g.checkDraft(withText('Upload it at https://example.com now.'), IDS), { ok: false, reason: 'contains a link' });
  assert.deepEqual(g.checkDraft(withOpening('See www.example.com for help.'), IDS), { ok: false, reason: 'contains a link' });
});

test('bare domains, email addresses and other URI schemes are rejected', () => {
  for (const text of [
    'Upload the certificate at example.com.',
    'Upload it at portal.example.test/upload.',
    'See example.co.uk for help.',
    'Send it to agent@example.test.',
    'Use ftp://files.example.test for the renewal.',
    'Use mailto:theagent for the renewal.',
    'Use javascript:openThePortal for the renewal.',
  ]) {
    assert.deepEqual(g.checkDraft(withOpening(text), IDS), { ok: false, reason: 'contains a link' }, text);
    assert.deepEqual(g.checkDraft(withText(text), IDS), { ok: false, reason: 'contains a link' }, text);
  }
});

test('obvious IDs in prose are rejected even when the IDs have no digits', () => {
  for (const text of [
    'Update certificate CERT-ALPHA.',
    'See record REC_ROOF.',
    'Use policy POLICY-ABC.',
    'Use ID-ALPHA for the file.',
    'Use aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee for the record.',
  ]) {
    assert.deepEqual(g.checkDraft(withOpening(text), IDS), { ok: false, reason: 'contains an id' }, text);
    assert.deepEqual(g.checkDraft(withText(text), IDS), { ok: false, reason: 'contains an id' }, text);
  }
});

test('a fake model reply with an invented amount fails to the template path', () => {
  const { buildDrafter } = loadGsRaw(['buildDrafter']);
  const reply = withText('Ask for five dollars of umbrella coverage.');
  const drafter = buildDrafter(() => ({ status: 200, text: JSON.stringify({
    candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] } }],
    usageMetadata: { promptTokenCount: 310, candidatesTokenCount: 62 },
  }) }));
  assert.deepEqual(plain(drafter.draft('subcontractor', TWO)), {
    draft: null, reason: 'Draft rejected: contains a number word.',
    usage: { promptTokenCount: 310, candidatesTokenCount: 62 },
  });
});

test('rule 4: an id the code did not send, a missing id or a repeated id is rejected', () => {
  const unknown = { ...CLEAN, explanations: [CLEAN.explanations[0], { id: 'D9-limit', text: 'Fix this.' }] };
  assert.deepEqual(g.checkDraft(unknown, IDS), { ok: false, reason: 'unknown id D9-limit' });
  const missing = { ...CLEAN, explanations: [CLEAN.explanations[0]] };
  assert.deepEqual(g.checkDraft(missing, IDS), { ok: false, reason: 'missing id D2-requirement' });
  const repeated = { ...CLEAN, explanations: [CLEAN.explanations[0], CLEAN.explanations[0], CLEAN.explanations[1]] };
  assert.deepEqual(g.checkDraft(repeated, IDS), { ok: false, reason: 'repeated id D1-limit' });
});

test('rule 5: an opening over 200 characters or an explanation over 240 is rejected; at the limit it passes', () => {
  assert.deepEqual(g.checkDraft(withOpening('a'.repeat(201)), IDS), { ok: false, reason: 'opening is over 200 characters' });
  assert.deepEqual(g.checkDraft(withText('b'.repeat(241)), IDS), { ok: false, reason: 'an explanation is over 240 characters' });
  assert.deepEqual(g.checkDraft(withOpening('a'.repeat(200)), IDS), { ok: true, reason: '' });
  assert.deepEqual(g.checkDraft(withText('b'.repeat(240)), IDS), { ok: true, reason: '' });
});

test('rule 6: a clean reply passes', () => {
  assert.deepEqual(g.checkDraft(CLEAN, IDS), { ok: true, reason: '' });
});

test('a reply that is not the expected shape, or has empty text, is rejected', () => {
  assert.deepEqual(g.checkDraft(null, IDS), { ok: false, reason: 'not the expected shape' });
  assert.deepEqual(g.checkDraft({ opening: 'Hi.' }, IDS), { ok: false, reason: 'not the expected shape' });
  assert.deepEqual(g.checkDraft({ ...CLEAN, explanations: [{ id: 'D1-limit', text: 7 }] }, IDS), { ok: false, reason: 'not the expected shape' });
  assert.deepEqual(g.checkDraft(withOpening('  '), IDS), { ok: false, reason: 'empty text' });
});

test('the digits in an id do not count as a number; only the text is checked', () => {
  assert.equal(g.checkDraft(CLEAN, IDS).ok, true);
});

// --- Assembly (plan A5) ---

const RECORD_LINK = 'https://app.example.test/exec?record=REC-001&as=project_manager';
const UPLOAD_LINK = 'https://upload.example.test/exec?t=token-1';

// A record whose certificate CERT-001 waits in the accountant queue after a low-confidence reading.
function waitingRecord() {
  return { sub: { name: 'Ridgeline Roofing LLC', email: 'r@example.com', scope: 'roofing', w9: true }, closed: false, current: null,
    pending: { id: 'CERT-001', stage: 'needs_review', reason: 'Low-confidence reading', confidence: 0.7, values: { limits: {} } },
    history: [], hold: { on: false, reasons: [] }, billedThisCycle: 0, nudges: { d30: false, d7: false }, log: [], status: 'needs_review' };
}

test('with no draft the deficiency notice equals today\'s email byte for byte, with and without the link', () => {
  assert.equal(g.assembleDeficiencyNotice('Ridgeline Roofing LLC', TWO, null, RECORD_LINK),
    'Ridgeline Roofing LLC: Umbrella: $1,000,000 shown, $2,000,000 required; Additional insured endorsement: not shown; required. ' +
    'Waive or reject? Open the record: https://app.example.test/exec?record=REC-001&as=project_manager');
  assert.equal(g.assembleDeficiencyNotice('Ridgeline Roofing LLC', [LOW_UMBRELLA], null, ''),
    'Ridgeline Roofing LLC: Umbrella: $1,000,000 shown, $2,000,000 required. Waive or reject?');
});

test('with no draft the deficiency notice equals the text nextStatus emits', () => {
  // A low-umbrella reading confirmed by the accountant routes to a deficiency and emits the email.
  const values = { insured_name: 'Ridgeline Roofing LLC', limits: { commercial_liability: 1000000, aggregate: 2000000, auto: 1000000,
    umbrella: 1000000, workers_comp: 1000000, pollution_liability: 1000000, professional_liability: null },
    additional_insured_endorsement: true, project_address: true, certificate_holder: true, cancellation_notice_days: 30, expiration_date: '2027-09-30' };
  const record = waitingRecord();
  const matrix = loadGs(['TOLERANCE_MATRIX']).TOLERANCE_MATRIX;
  const out = g.nextStatus(record, { type: 'reading_confirmed', who: 'Dana Reyes (Accountant)', note: 'Checked.', values, recordLink: RECORD_LINK },
    '2026-10-08', 'review_all', matrix);
  const email = out.effects.find((e) => e.to === 'Project manager');
  assert.equal(email.text, 'Ridgeline Roofing LLC: Umbrella: $1,000,000 shown, $2,000,000 required. Waive or reject? Open the record: ' + RECORD_LINK);
});

test('with no draft the correction request equals correctionText byte for byte', () => {
  assert.equal(g.assembleCorrectionRequest(TWO, null, UPLOAD_LINK), g.correctionText(TWO, UPLOAD_LINK));
  assert.equal(g.assembleCorrectionRequest(TWO, null, ''), g.correctionText(TWO, ''));
  assert.equal(g.assembleCorrectionRequest(TWO, null, UPLOAD_LINK),
    'Your certificate does not meet the project requirements. Please send a corrected certificate.\n' +
    '- Umbrella: $1,000,000 shown, $2,000,000 required\n' +
    '- Additional insured endorsement: not shown; required\n' +
    'Upload it here: https://upload.example.test/exec?t=token-1');
});

test('with a draft the deficiency notice is the name and opening, each fact line with the model line under it, then the fixed closing', () => {
  assert.equal(g.assembleDeficiencyNotice('Ridgeline Roofing LLC', TWO, CLEAN, RECORD_LINK),
    'Ridgeline Roofing LLC: This certificate does not yet meet the project requirements.\n' +
    '- Umbrella: $1,000,000 shown, $2,000,000 required\n' +
    '  Ask the insurance agent for an umbrella policy that meets the project limit.\n' +
    '- Additional insured endorsement: not shown; required\n' +
    '  Ask the agent to add the firm as additional insured by endorsement.\n' +
    'Waive or reject? Open the record: https://app.example.test/exec?record=REC-001&as=project_manager');
});

test('with a draft the correction request is the opening, each fact line with the model line under it, then the fixed closing and link', () => {
  assert.equal(g.assembleCorrectionRequest(TWO, CLEAN, UPLOAD_LINK),
    'This certificate does not yet meet the project requirements.\n' +
    '- Umbrella: $1,000,000 shown, $2,000,000 required\n' +
    '  Ask the insurance agent for an umbrella policy that meets the project limit.\n' +
    '- Additional insured endorsement: not shown; required\n' +
    '  Ask the agent to add the firm as additional insured by endorsement.\n' +
    'Please send a corrected certificate.\n' +
    'Upload it here: https://upload.example.test/exec?t=token-1');
  assert.equal(g.assembleCorrectionRequest(TWO, CLEAN, '').split('\n').at(-1), 'Please send a corrected certificate.');
});

test('a stored AI draft is used only if it still passes the check for these deficiencies', () => {
  assert.deepEqual(g.usableDraft({ drafted_by: 'AI', fallback_reason: '', draft: CLEAN }, TWO), CLEAN);
  assert.equal(g.usableDraft({ drafted_by: 'AI', fallback_reason: '', draft: withText('Raise it to 2 million.') }, TWO), null);
  assert.equal(g.usableDraft({ drafted_by: 'AI', fallback_reason: '', draft: CLEAN }, [LOW_UMBRELLA]), null);
  assert.equal(g.usableDraft({ drafted_by: 'Template', fallback_reason: 'AI drafts are off.', draft: null }, TWO), null);
  assert.equal(g.usableDraft(null, TWO), null);
});

test('stored amounts, dates, bare links and IDs produce the literal template instead of AI wording', () => {
  for (const text of [
    'Ask for five dollars of umbrella coverage.',
    'Send a corrected certificate by May.',
    'Upload the certificate at example.com.',
    'Update certificate CERT-ALPHA.',
  ]) {
    const draft = g.usableDraft({ drafted_by: 'AI', fallback_reason: '', draft: withText(text) }, TWO);
    assert.equal(draft, null, text);
    assert.equal(g.assembleCorrectionRequest(TWO, draft, ''),
      'Your certificate does not meet the project requirements. Please send a corrected certificate.\n' +
      '- Umbrella: $1,000,000 shown, $2,000,000 required\n' +
      '- Additional insured endorsement: not shown; required');
  }
});

// --- The ai_drafts tab ---

function store() {
  const s = raw.FakeStore();
  raw.initProject(s);
  return s;
}

const AI_FIELDS = { record_id: 'REC-001', certificate_id: 'CERT-001', kind: 'correction_request', drafted_by: 'AI', fallback_reason: '', draft: CLEAN };

test('storeDraft writes one row with a new draft id, the opening and the explanations as JSON, and a blank call id', () => {
  const s = store();
  raw.storeDraft(s, '2026-10-08T09:00:00', AI_FIELDS);
  assert.deepEqual(plain(s.readRows('ai_drafts')), [{
    draft_id: 'DRF-001', record_id: 'REC-001', certificate_id: 'CERT-001', kind: 'correction_request', drafted_by: 'AI',
    fallback_reason: '', opening: 'This certificate does not yet meet the project requirements.',
    explanations_json: '[{"id":"D1-limit","text":"Ask the insurance agent for an umbrella policy that meets the project limit."},' +
      '{"id":"D2-requirement","text":"Ask the agent to add the firm as additional insured by endorsement."}]',
    call_id: '', time: '2026-10-08T09:00:00',
  }]);
});

test('storeDraft writes once per certificate and kind; a second call changes nothing', () => {
  const s = store();
  raw.storeDraft(s, '2026-10-08T09:00:00', AI_FIELDS);
  raw.storeDraft(s, '2026-10-08T09:05:00', { ...AI_FIELDS, drafted_by: 'Template', fallback_reason: 'HTTP 429', draft: null });
  raw.storeDraft(s, '2026-10-08T09:05:00', { ...AI_FIELDS, kind: 'deficiency_notice', drafted_by: 'Template', fallback_reason: 'AI drafts are off.', draft: null });
  const rows = plain(s.readRows('ai_drafts'));
  assert.deepEqual(rows.map((r) => [r.draft_id, r.kind, r.drafted_by, r.fallback_reason, r.opening, r.explanations_json]), [
    ['DRF-001', 'correction_request', 'AI', '', 'This certificate does not yet meet the project requirements.', rows[0].explanations_json],
    ['DRF-002', 'deficiency_notice', 'Template', 'AI drafts are off.', '', ''],
  ]);
});

test('findDraft returns the stored row for the certificate and kind, or null', () => {
  const s = store();
  raw.storeDraft(s, '2026-10-08T09:00:00', AI_FIELDS);
  raw.storeDraft(s, '2026-10-08T09:00:00', { ...AI_FIELDS, kind: 'deficiency_notice', drafted_by: 'Template', fallback_reason: 'HTTP 429', draft: null });
  assert.deepEqual(plain(raw.findDraft(s, 'CERT-001', 'correction_request')), { drafted_by: 'AI', fallback_reason: '', draft: CLEAN });
  assert.deepEqual(plain(raw.findDraft(s, 'CERT-001', 'deficiency_notice')), { drafted_by: 'Template', fallback_reason: 'HTTP 429', draft: null });
  assert.equal(raw.findDraft(s, 'CERT-002', 'correction_request'), null);
});

test('a Sheet with no ai_drafts tab yet reads as no drafts', () => {
  const s = raw.FakeStore();
  assert.deepEqual(plain(raw.draftRows(s)), []);
  assert.equal(raw.draftFromRows([], 'CERT-001', 'deficiency_notice'), null);
});
