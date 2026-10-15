// Ticket 06 through the job functions, with fake Store, Reader, Mailer and Clock:
// a deficiency goes to the project manager, who waives it with a note or rejects it.
// Expected values are literals read by hand from the planted-problem manifest.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGsRaw, plain } = require('./load-gs');

// A lock that is always free; the lock's own behavior is tested in lock.test.js.
const LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) };

const core = loadGsRaw(
  ['initProject', 'seedSampleProject', 'processCertificate', 'reviewAction', 'recordDetail',
    'FakeStore', 'FakeReader', 'FakeMailer', 'FakeClock', 'FakeCalendar', 'SAMPLE_READING', 'openingView'],
  { LockService },
);

const UPLOAD_BASE = 'https://upload.example.test/exec';
const INTERNAL_BASE = 'https://app.example.test/exec';
const MARCUS = 'Marcus Webb (Project manager)';
const ELENA = 'Elena Park (Leadership)';

// The reading of a certificate with the given changes to the clean sample (01-clean.pdf).
const reading = (change) => {
  const base = plain(core.SAMPLE_READING);
  return { ...base, values: { ...base.values, ...change(base.values) } };
};
// 04-style problem for this record: a $1M umbrella against the $2M requirement.
const LOW_UMBRELLA = () => reading((v) => ({ limits: { ...v.limits, umbrella: 1000000 } }));
// 05-wrong-insured.pdf: the insured is a different company.
const WRONG_INSURED = () => reading(() => ({ insured_name: 'Ridgeline Roofing Partners LLC' }));
// 06-no-additional-insured.pdf: the endorsement is not printed.
const NO_ENDORSEMENT = () => reading(() => ({ additional_insured_endorsement: false }));
// Two problems on one certificate.
const TWO_PROBLEMS = () => reading((v) => ({ limits: { ...v.limits, umbrella: 1000000 }, additional_insured_endorsement: false }));

function setup(rd, over) {
  const deps = {
    store: core.FakeStore(),
    reader: core.FakeReader(rd),
    mailer: core.FakeMailer(),
    clock: core.FakeClock('2026-10-08', '2026-10-08T09:00:00'),
    calendar: core.FakeCalendar(),
    newToken: () => 'token-1',
    uploadBaseUrl: UPLOAD_BASE,
    internalBaseUrl: INTERNAL_BASE,
    ...over,
  };
  core.initProject(deps.store);
  core.seedSampleProject(deps);
  return deps;
}

const FILE = { name: 'ridgeline-coi.pdf', fingerprint: 'sha256-1', link: 'fake://inbox/ridgeline-coi.pdf' };
const rows = (deps, tab) => plain(deps.store.snapshot().rows[tab]);
const sent = (deps) => plain(deps.mailer.sent());
const record = (deps) => rows(deps, 'compliance_records')[0];
const log = (deps) => rows(deps, 'activity_log').map((a) => [a.who, a.summary]);

const WAIT = 'Waived: Umbrella: $1,000,000 shown, $2,000,000 required. Note:';

test('success test: a $1M umbrella against $2M is a deficiency, and the project manager is emailed the value found, the value required and a link', () => {
  const deps = setup(LOW_UMBRELLA());
  core.processCertificate(deps, 'token-1', FILE);
  assert.equal(rows(deps, 'certificates')[0].queue_stage, 'deficiency');
  assert.deepEqual(sent(deps), [{
    to: 'pm@example.com',
    subject: 'Certificate of insurance: Ridgeline Roofing LLC',
    body: 'Ridgeline Roofing LLC: Umbrella: $1,000,000 shown, $2,000,000 required. Waive or reject? Open the record: ' +
      'https://app.example.test/exec?record=REC-001&as=project_manager',
  }]);
});

test('without an internal app address the deficiency email still goes, with no link', () => {
  const deps = setup(LOW_UMBRELLA(), { internalBaseUrl: '' });
  core.processCertificate(deps, 'token-1', FILE);
  assert.deepEqual(sent(deps).map((m) => m.body), ['Ridgeline Roofing LLC: Umbrella: $1,000,000 shown, $2,000,000 required. Waive or reject?']);
});

test('the record link opens that record as the project manager', () => {
  assert.deepEqual(plain(core.openingView({ record: 'REC-001', as: 'project_manager' })), { record: 'REC-001', role: 'project_manager' });
  assert.deepEqual(plain(core.openingView({ record: 'REC-001', as: 'president' })), { record: 'REC-001', role: '' });
  assert.deepEqual(plain(core.openingView(undefined)), { record: '', role: '' });
});

test('the wrong insured name and the missing endorsement are each caught as a deficiency', () => {
  const wrong = setup(WRONG_INSURED());
  core.processCertificate(wrong, 'token-1', FILE);
  assert.equal(rows(wrong, 'certificates')[0].queue_stage, 'deficiency');
  assert.deepEqual(plain(JSON.parse(rows(wrong, 'certificates')[0].deficiencies)), [
    { field: 'insured_name_matches', kind: 'requirement', text: 'Insured name: certificate shows Ridgeline Roofing Partners LLC; must read Ridgeline Roofing LLC' },
  ]);

  const missing = setup(NO_ENDORSEMENT());
  core.processCertificate(missing, 'token-1', FILE);
  assert.equal(rows(missing, 'certificates')[0].queue_stage, 'deficiency');
  assert.deepEqual(plain(JSON.parse(rows(missing, 'certificates')[0].deficiencies)), [
    { field: 'additional_insured_endorsement', kind: 'requirement', text: 'Additional insured endorsement: not shown; required' },
  ]);
});

test('the record detail offers the decision while a deficiency waits', () => {
  const deps = setup(LOW_UMBRELLA());
  core.processCertificate(deps, 'token-1', FILE);
  const d = plain(core.recordDetail(deps, 'REC-001'));
  assert.equal(d.next, 'decide');
  assert.equal(d.waiting, 'Waiting for a decision on a deficiency');
  assert.deepEqual(d.lines.filter((l) => !l.pass).map((l) => [l.label, l.found, l.required]), [['Umbrella', '$1,000,000', '$2,000,000']]);
});

test('waive records the project manager by name with the note, and makes the certificate current', () => {
  const deps = setup(LOW_UMBRELLA());
  core.processCertificate(deps, 'token-1', FILE);
  const out = plain(core.reviewAction(deps, 'REC-001', 'project_manager', 'waive', { note: 'Roofing crew works under the slab only.' }));
  assert.equal(out.ok, true);
  assert.equal(record(deps).status, 'compliant');
  assert.equal(record(deps).current_certificate_id, 'CERT-001');
  assert.equal(record(deps).queued_certificate_id, '');
  const cert = rows(deps, 'certificates')[0];
  assert.equal(cert.decision, 'waived by the project manager');
  assert.equal(cert.decision_note, 'Roofing crew works under the slab only.');
  assert.deepEqual(log(deps).filter((l) => l[0] === MARCUS), [[MARCUS, `${WAIT} Roofing crew works under the slab only.`]]);
  assert.deepEqual(sent(deps).slice(1).map((m) => [m.to, m.body]), [
    ['ridgeline@example.com', 'Your certificate CERT-001 is approved.'],
    ['accountant@example.com', 'Ridgeline Roofing LLC: CERT-001 filed and approved (waived by the project manager).'],
  ]);
});

test('waive with a blank note is refused with a reason and changes nothing', () => {
  const deps = setup(LOW_UMBRELLA());
  core.processCertificate(deps, 'token-1', FILE);
  const before = plain(deps.store.snapshot());
  const mails = sent(deps).length;
  for (const payload of [{ note: '' }, { note: '   ' }, {}]) {
    assert.deepEqual(plain(core.reviewAction(deps, 'REC-001', 'project_manager', 'waive', payload)), {
      ok: false, message: 'A waiver needs a note. Write why this deficiency is acceptable.',
    });
  }
  assert.deepEqual(plain(deps.store.snapshot()), before);
  assert.equal(sent(deps).length, mails);
});

test('reject sends the subcontractor a correction request listing every deficiency, and the record returns to awaiting', () => {
  const deps = setup(TWO_PROBLEMS());
  core.processCertificate(deps, 'token-1', FILE);
  const out = plain(core.reviewAction(deps, 'REC-001', 'project_manager', 'reject'));
  assert.equal(out.ok, true);
  assert.equal(record(deps).status, 'awaiting');
  assert.equal(record(deps).current_certificate_id, '');
  assert.equal(record(deps).queued_certificate_id, '');
  assert.deepEqual(sent(deps).slice(1), [{
    to: 'ridgeline@example.com',
    subject: 'Certificate of insurance: Ridgeline Roofing LLC',
    body: 'Your certificate does not meet the project requirements. Please send a corrected certificate.\n' +
      '- Umbrella: $1,000,000 shown, $2,000,000 required\n' +
      '- Additional insured endorsement: not shown; required\n' +
      'Upload it here: https://upload.example.test/exec?t=token-1',
  }]);
  assert.equal(rows(deps, 'certificates')[0].outcome, 'Rejected');
  assert.deepEqual(log(deps).filter((l) => l[0] === MARCUS), [[MARCUS, 'Rejected CERT-001. Correction request sent.']]);
});

test('reject with no upload page address is refused with a reason and changes nothing', () => {
  const deps = setup(LOW_UMBRELLA(), { uploadBaseUrl: '' });
  core.processCertificate(deps, 'token-1', FILE);
  const before = plain(deps.store.snapshot());
  assert.deepEqual(plain(core.reviewAction(deps, 'REC-001', 'project_manager', 'reject')), {
    ok: false, message: 'The upload page address is not set. Set Script Property UPLOAD_BASE_URL first.',
  });
  assert.deepEqual(plain(deps.store.snapshot()), before);
});

test('leadership may decide a deficiency and is logged by name; the accountant may not', () => {
  const deps = setup(LOW_UMBRELLA());
  core.processCertificate(deps, 'token-1', FILE);
  const before = plain(deps.store.snapshot());
  assert.deepEqual(plain(core.reviewAction(deps, 'REC-001', 'accountant', 'waive', { note: 'ok' })), {
    ok: false, message: 'Only the project manager or leadership can waive a deficiency.',
  });
  assert.deepEqual(plain(core.reviewAction(deps, 'REC-001', 'accountant', 'reject')), {
    ok: false, message: 'Only the project manager or leadership can reject a deficiency.',
  });
  assert.deepEqual(plain(deps.store.snapshot()), before);
  assert.equal(plain(core.reviewAction(deps, 'REC-001', 'leadership', 'waive', { note: 'Escalated and accepted.' })).ok, true);
  assert.deepEqual(log(deps).filter((l) => l[0] === ELENA).map((l) => l[0]), [ELENA]);
});

test('waive or reject with no deficiency waiting is refused with a reason and changes nothing', () => {
  const deps = setup(core.SAMPLE_READING);
  core.processCertificate(deps, 'token-1', FILE);
  assert.equal(rows(deps, 'certificates')[0].queue_stage, 'approval');
  const before = plain(deps.store.snapshot());
  assert.deepEqual(plain(core.reviewAction(deps, 'REC-001', 'project_manager', 'waive', { note: 'Fine.' })), {
    ok: false, message: 'There is no deficiency waiting for a decision.',
  });
  assert.deepEqual(plain(core.reviewAction(deps, 'REC-001', 'project_manager', 'reject')), {
    ok: false, message: 'There is no deficiency waiting for a decision.',
  });
  assert.deepEqual(plain(deps.store.snapshot()), before);
  assert.deepEqual(sent(deps), []);
});
