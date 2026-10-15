// Ticket 02's path, through fake adapters: a canned reading becomes a certificate,
// a compliance record and one worklist row.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGsRaw, plain } = require('./load-gs');

// A lock that is always free; the lock's own behavior is tested in lock.test.js.
const LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) };

const core = loadGsRaw(
  ['initProject', 'seedSampleProject', 'processCertificate', 'worklistRows', 'FakeStore', 'FakeReader', 'FakeMailer', 'FakeClock', 'FakeCalendar', 'SAMPLE_READING'],
  { LockService },
);

function setup(reading) {
  const deps = {
    store: core.FakeStore(),
    reader: core.FakeReader(reading || core.SAMPLE_READING),
    mailer: core.FakeMailer(),
    clock: core.FakeClock('2026-10-07', '2026-10-07T09:00:00'),
    calendar: core.FakeCalendar(),
    newToken: () => 'token-1',
  };
  core.initProject(deps.store);
  core.seedSampleProject(deps);
  return deps;
}

const SAMPLE_FILE = { name: 'ridgeline-coi.pdf', fingerprint: 'sha256-ridgeline-1', link: 'fake://inbox/ridgeline-coi.pdf' };

test('before any certificate the worklist shows one awaiting row', () => {
  const deps = setup();
  assert.deepEqual(plain(core.worklistRows(deps, 'PRJ-001')), [
    { record_id: 'REC-001', subcontractor: 'Ridgeline Roofing LLC', status: 'Awaiting certificate', expiry: '', payment_hold: false, hold_reasons: [], last_updated: '2026-10-07T09:00:00', last_action_who: 'System', last_action_time: '2026-10-07T09:00:00', last_action: 'Record created; awaiting certificate.', waiting: '', next: null, deficiency_count: 0, sample: 'Sample data' },
  ]);
});

test('a clean canned reading on a review-all project waits for approval, saved in every tab', () => {
  const deps = setup();
  const result = plain(core.processCertificate(deps, 'token-1', SAMPLE_FILE));
  assert.deepEqual(result, { record_id: 'REC-001', certificate_id: 'CERT-001', status: 'in_review' });

  const rows = plain(deps.store.snapshot().rows);
  assert.equal(rows.certificates.length, 1);
  const cert = rows.certificates[0];
  assert.equal(cert.certificate_id, 'CERT-001');
  assert.equal(cert.record_id, 'REC-001');
  assert.equal(cert.file_fingerprint, 'sha256-ridgeline-1');
  assert.equal(cert.queue_stage, 'approval');
  assert.equal(cert.umbrella_usd, 2000000);
  assert.equal(cert.expiration_date, '2027-09-30');
  assert.equal(cert.check_result, 'pass');
  assert.equal(cert.deficiencies, '[]');
  assert.equal(cert.pdf_link, 'fake://inbox/ridgeline-coi.pdf');

  const rec = rows.compliance_records[0];
  assert.equal(rec.status, 'in_review');
  assert.equal(rec.queued_certificate_id, 'CERT-001');
  assert.equal(rec.current_certificate_id, '');
  assert.equal(rec.last_updated, '2026-10-07T09:00:00');

  assert.deepEqual(rows.activity_log.map((a) => a.summary), [
    'Record created; awaiting certificate.',
    'Passed every check. Ready for approval.',
  ]);
  assert.deepEqual(plain(deps.mailer.sent()), []);

  assert.deepEqual(plain(core.worklistRows(deps, 'PRJ-001')), [
    { record_id: 'REC-001', subcontractor: 'Ridgeline Roofing LLC', status: 'In review', expiry: '', payment_hold: false, hold_reasons: [], last_updated: '2026-10-07T09:00:00', last_action_who: 'System', last_action_time: '2026-10-07T09:00:00', last_action: 'Passed every check. Ready for approval.', waiting: 'Waiting for approval', next: 'approve', deficiency_count: 0, sample: 'Sample data' },
  ]);
});

test('a deficient reading emails the project manager at the project address', () => {
  const low = { ...plain(core.SAMPLE_READING) };
  low.values = { ...low.values, limits: { ...low.values.limits, umbrella: 1000000 } };
  const deps = setup(low);
  core.processCertificate(deps, 'token-1', SAMPLE_FILE);
  assert.deepEqual(plain(deps.mailer.sent()), [
    { to: 'pm@example.com', subject: 'Certificate of insurance: Ridgeline Roofing LLC', body: 'Ridgeline Roofing LLC: Umbrella: $1,000,000 shown, $2,000,000 required. Waive or reject?' },
  ]);
  assert.equal(plain(deps.store.snapshot().rows).certificates[0].deficiencies,
    '[{"field":"umbrella","kind":"limit","text":"Umbrella: $1,000,000 shown, $2,000,000 required"}]');
});

test('an unknown upload token is refused and nothing is written', () => {
  const deps = setup();
  assert.throws(() => core.processCertificate(deps, 'no-such-token', SAMPLE_FILE), /No open compliance record for this upload link/);
  assert.equal(plain(deps.store.snapshot().rows).certificates.length, 0);
});

test('an unreadable file queues for the accountant and the resend draft is held, not emailed', () => {
  const deps = setup({ readable: false, confidence: 0, values: null });
  assert.deepEqual(plain(core.processCertificate(deps, 'token-1', SAMPLE_FILE)), { record_id: 'REC-001', certificate_id: 'CERT-001', status: 'needs_review' });
  assert.deepEqual(plain(deps.mailer.sent()), []);
});
