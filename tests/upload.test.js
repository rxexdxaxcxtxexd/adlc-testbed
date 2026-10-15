// Ticket 04: the public upload page's logic and the upload job, through fake adapters.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGsRaw, plain } = require('./load-gs');

const LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) };

const core = loadGsRaw(
  ['initProject', 'seedSampleProject', 'acceptUpload', 'processNextUpload', 'uploadLinkInfo', 'FakeStore', 'FakeReader', 'FakeMailer', 'FakeClock', 'FakeCalendar', 'SAMPLE_READING'],
  { LockService },
);

function setup(reader) {
  const deps = {
    store: core.FakeStore(),
    reader: reader || core.FakeReader(core.SAMPLE_READING),
    mailer: core.FakeMailer(),
    clock: core.FakeClock('2026-10-07', '2026-10-07T09:00:00'),
    calendar: core.FakeCalendar(),
    newToken: () => 'token-1',
  };
  core.initProject(deps.store);
  core.seedSampleProject(deps);
  return deps;
}

const PDF = { name: 'coi.pdf', size: 2048, header: '%PDF-', fingerprint: 'sha-aaa', base64: 'AAAA' };
const rows = (deps, tab) => plain(deps.store.snapshot().rows[tab]);

test('a good token shows the subcontractor and project; any bad token shows one message', () => {
  const deps = setup();
  assert.deepEqual(plain(core.uploadLinkInfo(deps.store, 'token-1')), { open: true, subcontractor: 'Ridgeline Roofing LLC', project: rows(deps, 'projects')[0].name });
  const bad = { open: false, message: 'This upload link is not active. Contact the project team for a new one.' };
  assert.deepEqual(plain(core.uploadLinkInfo(deps.store, 'nope')), bad);
  assert.deepEqual(plain(core.uploadLinkInfo(deps.store, '')), bad);
});

test('a token that matches no record is refused and nothing is saved', () => {
  const deps = setup();
  const out = plain(core.acceptUpload(deps, 'nope', PDF));
  assert.deepEqual(out, { ok: false, message: 'This upload link is not active. Contact the project team for a new one.' });
  assert.equal(rows(deps, 'uploads').length, 0);
});

test('a non-PDF is refused, by name or by content', () => {
  const deps = setup();
  const msg = 'Only PDF files are accepted. Please upload your certificate as a PDF.';
  assert.deepEqual(plain(core.acceptUpload(deps, 'token-1', { ...PDF, name: 'coi.docx' })), { ok: false, message: msg });
  assert.deepEqual(plain(core.acceptUpload(deps, 'token-1', { ...PDF, header: 'hello' })), { ok: false, message: msg });
  assert.equal(rows(deps, 'uploads').length, 0);
});

test('a file over 5 MB is refused; exactly 5 MB is accepted', () => {
  const deps = setup();
  const out = plain(core.acceptUpload(deps, 'token-1', { ...PDF, size: 5 * 1024 * 1024 + 1 }));
  assert.deepEqual(out, { ok: false, message: 'This file is larger than 5 MB. Please save a smaller PDF and try again.' });
  assert.equal(plain(core.acceptUpload(deps, 'token-1', { ...PDF, size: 5 * 1024 * 1024 })).ok, true);
});

test('an accepted file lands in the inbox with its fingerprint and an uploads row', () => {
  const deps = setup();
  const out = plain(core.acceptUpload(deps, 'token-1', PDF));
  assert.deepEqual(out, { ok: true, duplicate: false, message: 'Thank you. We received your certificate.', upload_id: 'UPL-001' });
  assert.deepEqual(rows(deps, 'uploads'), [{
    upload_id: 'UPL-001', upload_token: 'token-1', received_time: '2026-10-07T09:00:00', file_name: 'coi.pdf',
    file_fingerprint: 'sha-aaa', drive_link: 'fake://COI Compliance (Sample data)/_inbox/UPL-001 coi.pdf', processed: false, attempts: 0, last_error: '',
  }]);
  assert.ok(deps.store.snapshot().files.some((f) => f.path === 'COI Compliance (Sample data)/_inbox/UPL-001 coi.pdf'));
});

test('the same file twice changes nothing the second time', () => {
  const deps = setup();
  core.acceptUpload(deps, 'token-1', PDF);
  const before = plain(deps.store.snapshot());
  const out = plain(core.acceptUpload(deps, 'token-1', PDF));
  assert.deepEqual(out, { ok: true, duplicate: true, message: 'We already have this file. Nothing was changed.' });
  assert.deepEqual(plain(deps.store.snapshot()), before);
});

test('the job turns one upload into a filed PDF, a saved reading and a queued record', () => {
  const deps = setup();
  core.acceptUpload(deps, 'token-1', PDF);
  assert.deepEqual(plain(core.processNextUpload(deps)), { status: 'processed', upload_id: 'UPL-001' });
  const cert = rows(deps, 'certificates')[0];
  assert.equal(cert.file_fingerprint, 'sha-aaa');
  assert.equal(cert.queue_stage, 'approval');
  assert.equal(cert.pdf_link, 'fake://COI Compliance (Sample data)/_inbox/UPL-001 coi.pdf');
  assert.equal(rows(deps, 'compliance_records')[0].queued_certificate_id, 'CERT-001');
  assert.equal(rows(deps, 'uploads')[0].processed, true);
});

test('the job handles one upload per run and reports none when the queue is empty', () => {
  const deps = setup();
  core.acceptUpload(deps, 'token-1', PDF);
  core.acceptUpload(deps, 'token-1', { ...PDF, fingerprint: 'sha-bbb' });
  assert.equal(plain(core.processNextUpload(deps)).upload_id, 'UPL-001');
  assert.equal(rows(deps, 'uploads')[1].processed, false);
  assert.equal(plain(core.processNextUpload(deps)).upload_id, 'UPL-002');
  assert.deepEqual(plain(core.processNextUpload(deps)), { status: 'none' });
});

test('a reader error is retried, and the third failure marks the upload failed and moves on', () => {
  const broken = { read: () => { throw new Error('HTTP 429'); } };
  const deps = setup(broken);
  core.acceptUpload(deps, 'token-1', PDF);
  assert.deepEqual(plain(core.processNextUpload(deps)), { status: 'retry', upload_id: 'UPL-001' });
  assert.deepEqual(plain(core.processNextUpload(deps)), { status: 'retry', upload_id: 'UPL-001' });
  assert.deepEqual(plain(core.processNextUpload(deps)), { status: 'failed', upload_id: 'UPL-001' });
  const row = rows(deps, 'uploads')[0];
  assert.deepEqual([row.processed, row.attempts, row.last_error], ['failed', 3, 'HTTP 429']);
  assert.match(rows(deps, 'activity_log').at(-1).summary, /^Upload UPL-001 failed 3 times and was skipped\. HTTP 429/);
  assert.deepEqual(plain(core.processNextUpload(deps)), { status: 'none' });
});
