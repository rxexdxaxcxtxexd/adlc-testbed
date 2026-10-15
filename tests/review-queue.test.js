// Ticket 05 through the job functions, with fake Store, Reader, Mailer and Clock:
// the review queue, approval, corrections, resend requests, review mode and the detail view.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGsRaw, plain } = require('./load-gs');

// A lock that is always free; the lock's own behavior is tested in lock.test.js.
const LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) };
// Demo Proj: demo mode off, so a correction may write a calibration sample.
const PropertiesService = { getScriptProperties: () => ({ getProperty: (k) => (k === 'DEMO_MODE' ? 'off' : null) }) };

const core = loadGsRaw(
  ['initProject', 'seedSampleProject', 'processCertificate', 'reviewAction', 'setReviewMode', 'recordDetail', 'worklistRows',
    'fillSampleNames', 'recordPdfLink', 'FakeStore', 'FakeReader', 'FakeMailer', 'FakeClock', 'FakeCalendar', 'SAMPLE_READING'],
  { LockService, PropertiesService },
);

const UPLOAD_BASE = 'https://example.test/exec';
const UNREADABLE = { readable: false, confidence: 0, values: null, reason: 'The model service rejected the file (HTTP 400).' };
const lowConfidence = () => ({ ...plain(core.SAMPLE_READING), confidence: 0.7 });

function setup(reading) {
  const deps = {
    store: core.FakeStore(),
    reader: core.FakeReader(reading || core.SAMPLE_READING),
    mailer: core.FakeMailer(),
    clock: core.FakeClock('2026-10-07', '2026-10-07T09:00:00'),
    calendar: core.FakeCalendar(),
    newToken: () => 'token-1',
    uploadBaseUrl: UPLOAD_BASE,
  };
  core.initProject(deps.store);
  core.seedSampleProject(deps);
  return deps;
}

const FILE = { name: 'ridgeline-coi.pdf', fingerprint: 'sha256-1', link: 'fake://inbox/ridgeline-coi.pdf' };
const FILE_2 = { name: 'ridgeline-coi-2.pdf', fingerprint: 'sha256-2', link: 'fake://inbox/ridgeline-coi-2.pdf' };
const rows = (deps, tab) => plain(deps.store.snapshot().rows[tab]);
const certs = (deps) => rows(deps, 'certificates');
const sent = (deps) => plain(deps.mailer.sent());
const sentTo = (deps) => sent(deps).map((m) => m.to);

const DANA = 'Dana Reyes (Accountant)';
const ELENA = 'Elena Park (Leadership)';

// The values the accountant reads off the PDF when the AI got the umbrella limit wrong.
const fixedValues = () => {
  const v = plain(core.SAMPLE_READING).values;
  return { ...v, limits: { ...v.limits, umbrella: 2000000 } };
};

test('a passing certificate on review all waits and nothing goes to the subcontractor', () => {
  const deps = setup();
  core.processCertificate(deps, 'token-1', FILE);
  assert.equal(certs(deps)[0].queue_stage, 'approval');
  assert.deepEqual(sent(deps), []);
});

test('approval sends the subcontractor an approval email, notifies the accountant, and logs the named person', () => {
  const deps = setup();
  core.processCertificate(deps, 'token-1', FILE);
  const out = plain(core.reviewAction(deps, 'REC-001', 'accountant', 'approve'));
  assert.equal(out.ok, true);
  assert.deepEqual(sent(deps).map((m) => [m.to, m.body]), [
    ['ridgeline@example.com', 'Your certificate CERT-001 is approved.'],
    ['accountant@example.com', 'Ridgeline Roofing LLC: CERT-001 filed and approved (approved by the accountant).'],
  ]);
  assert.equal(rows(deps, 'compliance_records')[0].status, 'compliant');
  assert.equal(rows(deps, 'compliance_records')[0].current_certificate_id, 'CERT-001');
  const log = rows(deps, 'activity_log').map((a) => [a.who, a.summary]);
  assert.deepEqual(log.filter((l) => l[0] === DANA), [[DANA, 'Approved CERT-001.']]);
});

test('approve with nothing waiting is refused with a reason and changes nothing', () => {
  const deps = setup();
  const before = plain(deps.store.snapshot());
  const out = plain(core.reviewAction(deps, 'REC-001', 'accountant', 'approve'));
  assert.deepEqual(out, {
    ok: false,
    message: 'Nothing is waiting for approval. A deficiency needs a waive or reject from the project manager instead.',
  });
  assert.deepEqual(plain(deps.store.snapshot()), before);
  assert.deepEqual(sent(deps), []);
});

test('a role that may not do the action is refused by name and changes nothing', () => {
  const deps = setup();
  core.processCertificate(deps, 'token-1', FILE);
  const before = plain(deps.store.snapshot());
  assert.deepEqual(plain(core.reviewAction(deps, 'REC-001', 'leadership', 'approve')), { ok: false, message: 'Only the accountant can approve a certificate.' });
  assert.deepEqual(plain(core.setReviewMode(deps, 'PRJ-001', 'accountant', 'automatic')), { ok: false, message: 'Only leadership can change the review mode.' });
  assert.deepEqual(plain(deps.store.snapshot()), before);
});

for (const mode of ['review_all', 'review_deficiencies', 'automatic']) {
  test(`a reading below 0.85 confidence goes to needs review in ${mode}`, () => {
    const deps = setup(lowConfidence());
    if (mode !== 'review_all') assert.equal(plain(core.setReviewMode(deps, 'PRJ-001', 'leadership', mode)).ok, true);
    core.processCertificate(deps, 'token-1', FILE);
    assert.equal(certs(deps)[0].queue_stage, 'needs_review');
    assert.equal(rows(deps, 'compliance_records')[0].status, 'needs_review');
    assert.deepEqual(sent(deps), []);
  });
}

test('switching a project to automatic leaves a waiting reading in needs review', () => {
  const deps = setup(lowConfidence());
  core.processCertificate(deps, 'token-1', FILE);
  assert.equal(plain(core.setReviewMode(deps, 'PRJ-001', 'leadership', 'automatic')).ok, true);
  assert.equal(certs(deps)[0].queue_stage, 'needs_review');
  core.processCertificate(deps, 'token-1', FILE_2);
  assert.equal(rows(deps, 'compliance_records')[0].status, 'needs_review');
});

test('a mode change applies to later certificates only; a certificate already waiting for approval keeps waiting', () => {
  const deps = setup();
  core.processCertificate(deps, 'token-1', FILE);
  core.setReviewMode(deps, 'PRJ-001', 'leadership', 'automatic');
  assert.equal(certs(deps)[0].queue_stage, 'approval');
  assert.equal(rows(deps, 'compliance_records')[0].status, 'in_review');
  assert.deepEqual(sent(deps), []);
});

test('a mode change is saved on the project and logged once with the named person', () => {
  const deps = setup();
  const out = plain(core.setReviewMode(deps, 'PRJ-001', 'leadership', 'automatic'));
  assert.deepEqual(out, { ok: true, message: 'Review mode changed from review all to automatic.' });
  assert.equal(rows(deps, 'projects')[0].review_mode, 'automatic');
  assert.deepEqual(rows(deps, 'activity_log').filter((a) => a.event_type === 'review_mode_changed').map((a) => [a.record_id, a.time, a.who, a.summary]), [
    ['PRJ-001', '2026-10-07T09:00:00', ELENA, 'Changed review mode from review all to automatic.'],
  ]);
  assert.deepEqual(plain(core.setReviewMode(deps, 'PRJ-001', 'leadership', 'sometimes')), { ok: false, message: 'Unknown review mode.' });
  assert.deepEqual(plain(core.setReviewMode(deps, 'PRJ-001', 'leadership', 'automatic')), { ok: false, message: 'The project is already on automatic.' });
});

test('a correction re-runs the check, saves the new values and logs each change with the name and date', () => {
  const lowReading = lowConfidence();
  lowReading.values.limits.umbrella = 1000000;
  const deps = setup(lowReading);
  core.processCertificate(deps, 'token-1', FILE);
  const out = plain(core.reviewAction(deps, 'REC-001', 'accountant', 'correct', { values: fixedValues(), note: 'Checked against the PDF.' }));
  assert.equal(out.ok, true);
  const cert = certs(deps)[0];
  assert.equal(cert.umbrella_usd, 2000000);
  assert.equal(cert.confidence, 1);
  assert.equal(cert.check_result, 'pass');
  assert.equal(cert.queue_stage, 'approval');
  assert.deepEqual(rows(deps, 'activity_log').filter((a) => a.who === DANA).map((a) => [a.time, a.summary]), [
    ['2026-10-07T09:00:00', 'Changed Umbrella from $1,000,000 to $2,000,000 on CERT-001. Note: Checked against the PDF. Added to the test set.'],
  ]);
  assert.deepEqual(sent(deps), []);
});

test('a correction with changes writes one calibration sample with the PDF link and the corrected values', () => {
  const lowReading = lowConfidence();
  lowReading.values.limits.umbrella = 1000000;
  const deps = setup(lowReading);
  core.processCertificate(deps, 'token-1', FILE);
  core.reviewAction(deps, 'REC-001', 'accountant', 'correct', { values: fixedValues(), note: 'Checked against the PDF.' });
  const samples = rows(deps, 'calibration_samples');
  assert.equal(samples.length, 1);
  const { expected_json, ...rest } = samples[0];
  assert.deepEqual(rest, {
    sample_id: 'SMP-CERT-001', source: 'correction', certificate_id: 'CERT-001', record_id: 'REC-001',
    pdf_link: certs(deps)[0].pdf_link, corrected_by: DANA, note: 'Checked against the PDF.', time: '2026-10-07T09:00:00', active: true
  });
  assert.equal(JSON.parse(expected_json).limits.umbrella, 2000000);
  assert.equal(JSON.parse(expected_json).insured_name, 'Ridgeline Roofing LLC');
});

test('a confirmation with no changes writes no sample and says nothing about the test set', () => {
  const deps = setup(lowConfidence());
  core.processCertificate(deps, 'token-1', FILE);
  const same = plain(core.SAMPLE_READING).values;
  assert.equal(plain(core.reviewAction(deps, 'REC-001', 'accountant', 'correct', { values: same, note: 'Checked against the PDF.' })).ok, true);
  assert.deepEqual(rows(deps, 'calibration_samples'), []);
  assert.deepEqual(rows(deps, 'activity_log').filter((a) => a.who === DANA).map((a) => a.summary), [
    'Confirmed the reading of CERT-001 with no changes. Note: Checked against the PDF.',
  ]);
});

test('a refused correction writes no sample', () => {
  const lowReading = lowConfidence();
  lowReading.values.limits.umbrella = 1000000;
  const deps = setup(lowReading);
  core.processCertificate(deps, 'token-1', FILE);
  assert.equal(plain(core.reviewAction(deps, 'REC-001', 'accountant', 'correct', { values: fixedValues(), note: ' ' })).ok, false);
  assert.deepEqual(rows(deps, 'calibration_samples'), []);
});

test('a correction that still falls short becomes a deficiency and emails the project manager', () => {
  const deps = setup(lowConfidence());
  core.processCertificate(deps, 'token-1', FILE);
  const short = fixedValues();
  short.limits.umbrella = 1000000;
  core.reviewAction(deps, 'REC-001', 'accountant', 'correct', { values: short, note: 'Checked against the PDF.' });
  assert.equal(certs(deps)[0].queue_stage, 'deficiency');
  assert.deepEqual(sentTo(deps), ['pm@example.com']);
});

test('a correction with a value that is not a dollar amount is refused and changes nothing', () => {
  const deps = setup(lowConfidence());
  core.processCertificate(deps, 'token-1', FILE);
  const before = plain(deps.store.snapshot());
  const bad = fixedValues();
  bad.limits.umbrella = 'lots';
  const out = plain(core.reviewAction(deps, 'REC-001', 'accountant', 'correct', { values: bad, note: 'Checked against the PDF.' }));
  assert.deepEqual(out, { ok: false, message: 'The corrected values are not valid: limits.umbrella is not a dollar amount.' });
  assert.deepEqual(plain(deps.store.snapshot()), before);
});

test('correct with no readable certificate waiting is refused with a reason', () => {
  const deps = setup();
  const out = plain(core.reviewAction(deps, 'REC-001', 'accountant', 'correct', { values: fixedValues(), note: 'Checked against the PDF.' }));
  assert.deepEqual(out, { ok: false, message: 'There is no readable certificate waiting to be checked.' });
});

test('an unreadable file arrives with a resend draft, and one click sends it with the upload link', () => {
  const deps = setup(UNREADABLE);
  core.processCertificate(deps, 'token-1', FILE);
  assert.deepEqual(sent(deps), []);
  const detail = plain(core.recordDetail(deps, 'REC-001'));
  assert.deepEqual(detail.draft, {
    to: 'ridgeline@example.com',
    subject: 'Certificate of insurance: Ridgeline Roofing LLC',
    body: 'Please resend your certificate as a standard PDF. Upload it here: https://example.test/exec?t=token-1',
    ready: true,
  });
  assert.equal(detail.next, 'resend');

  assert.equal(plain(core.reviewAction(deps, 'REC-001', 'accountant', 'resend')).ok, true);
  assert.deepEqual(sent(deps).map((m) => [m.to, m.body]), [
    ['ridgeline@example.com', 'Please resend your certificate as a standard PDF. Upload it here: https://example.test/exec?t=token-1'],
  ]);
  assert.equal(rows(deps, 'compliance_records')[0].status, 'awaiting');
});

test('a resend is refused with a reason when the upload page address is not set', () => {
  const deps = setup(UNREADABLE);
  core.processCertificate(deps, 'token-1', FILE);
  deps.uploadBaseUrl = '';
  const out = plain(core.reviewAction(deps, 'REC-001', 'accountant', 'resend'));
  assert.deepEqual(out, { ok: false, message: 'The upload page address is not set. Set Script Property UPLOAD_BASE_URL first.' });
  assert.deepEqual(sent(deps), []);
});

test('the detail view shows the timeline, the values against the requirements, confidence and the PDF link', () => {
  const deps = setup();
  core.processCertificate(deps, 'token-1', FILE);
  const d = plain(core.recordDetail(deps, 'REC-001'));
  assert.equal(d.subcontractor, 'Ridgeline Roofing LLC');
  assert.equal(d.status, 'In review');
  assert.equal(d.review_mode, 'review_all');
  assert.equal(d.waiting, 'Waiting for approval');
  assert.equal(d.next, 'approve');
  assert.equal(d.confidence, 0.96);
  assert.equal(d.pdf_link, 'fake://inbox/ridgeline-coi.pdf');
  assert.equal(d.draft, null);
  assert.equal(d.lines.length, 11);
  assert.deepEqual(d.lines[3], { field: 'umbrella', label: 'Umbrella', found: '$2,000,000', required: '$2,000,000', pass: true });
  assert.equal(d.values.insured_name, 'Ridgeline Roofing LLC');
  assert.deepEqual(d.timeline.map((t) => [t.time, t.who, t.summary]), [
    ['2026-10-07T09:00:00', 'System', 'Passed every check. Ready for approval.'],
    ['2026-10-07T09:00:00', 'System', 'Record created; awaiting certificate.'],
  ]);
});

test('the worklist puts records that need the accountant first and says what each waits for', () => {
  const deps = setup();
  deps.store.appendRow('subcontractors', { sub_id: 'SUB-002', name: 'Summit Electric Inc.', email: 'summit@example.com', scope_of_work: 'electrical' });
  deps.store.appendRow('compliance_records', {
    record_id: 'REC-002', project_id: 'PRJ-001', sub_id: 'SUB-002', upload_token: 'token-2', status: 'awaiting',
    payment_hold: false, payment_hold_reasons: '[]', w9_on_file: true, closed: false,
  });
  const summit = plain(core.SAMPLE_READING);
  summit.values.insured_name = 'Summit Electric Inc.';
  deps.reader = core.FakeReader(summit);
  core.processCertificate(deps, 'token-2', FILE);
  const list = plain(core.worklistRows(deps, 'PRJ-001'));
  assert.deepEqual(list.map((r) => [r.record_id, r.waiting]), [['REC-002', 'Waiting for approval'], ['REC-001', '']]);
  core.reviewAction(deps, 'REC-002', 'accountant', 'approve');
  assert.deepEqual(plain(core.worklistRows(deps, 'PRJ-001')).map((r) => [r.record_id, r.waiting]), [['REC-001', ''], ['REC-002', '']]);
});

test('re-running setup fills blank staff names on an older sample project and keeps names already set', () => {
  const deps = setup();
  deps.store.updateRow('projects', 'project_id', 'PRJ-001', { accountant_name: '', leadership_name: '', project_manager_name: 'Someone Else' });
  core.fillSampleNames(deps.store);
  const project = rows(deps, 'projects')[0];
  assert.deepEqual([project.accountant_name, project.project_manager_name, project.leadership_name], ['Dana Reyes', 'Someone Else', 'Elena Park']);
});

test('the PDF link is the waiting certificate when one waits, else the current one, else none', () => {
  const deps = setup();
  assert.equal(core.recordPdfLink(deps, 'REC-001'), '');
  core.processCertificate(deps, 'token-1', FILE);
  assert.equal(core.recordPdfLink(deps, 'REC-001'), 'fake://inbox/ridgeline-coi.pdf');
  core.reviewAction(deps, 'REC-001', 'accountant', 'approve');
  assert.equal(core.recordPdfLink(deps, 'REC-001'), 'fake://inbox/ridgeline-coi.pdf');
  core.processCertificate(deps, 'token-1', FILE_2);
  assert.equal(core.recordPdfLink(deps, 'REC-001'), 'fake://inbox/ridgeline-coi-2.pdf');
  assert.throws(() => core.recordPdfLink(deps, 'REC-999'), /No such record/);
});

