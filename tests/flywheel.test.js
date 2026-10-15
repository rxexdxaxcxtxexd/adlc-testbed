// Correction flywheel (docs/decisions.md, Phase 6): a correction that changed a value becomes a
// calibration sample. Expected values are written by hand.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGsRaw, plain } = require('./load-gs');

const core = loadGsRaw(['sampleFromCorrection', 'upsertSample', 'correctionCalibrationEntries', 'FakeStore', 'initProject']);
const sampleFromCorrection = (...args) => plain(core.sampleFromCorrection(...args));

const READ = {
  insured_name: 'Ridgeline Roofing LLC',
  limits: {
    commercial_liability: 1000000, aggregate: 2000000, auto: 1000000, umbrella: 1000000,
    workers_comp: 1000000, pollution_liability: 1000000, professional_liability: null
  },
  additional_insured_endorsement: true, project_address: true, certificate_holder: true,
  cancellation_notice_days: 30, expiration_date: '2027-09-30'
};
const FIXED = { ...READ, limits: { ...READ.limits, umbrella: 2000000 } };
const PENDING = { id: 'CERT-1', stage: 'needs_review', confidence: 0.7, values: READ };
const DANA = 'Dana Reyes (Accountant)';

test('a changed umbrella limit gives a row whose expected_json is the corrected values', () => {
  const row = sampleFromCorrection(PENDING, FIXED, DANA, 'Umbrella reads $2M on page 2.', '2026-10-07T09:00:00');
  assert.deepEqual(row, {
    sample_id: 'SMP-CERT-1', source: 'correction', certificate_id: 'CERT-1',
    expected_json: '{"insured_name":"Ridgeline Roofing LLC","limits":{"commercial_liability":1000000,"aggregate":2000000,'
      + '"auto":1000000,"umbrella":2000000,"workers_comp":1000000,"pollution_liability":1000000,"professional_liability":null},'
      + '"additional_insured_endorsement":true,"project_address":true,"certificate_holder":true,'
      + '"cancellation_notice_days":30,"expiration_date":"2027-09-30"}',
    corrected_by: DANA, note: 'Umbrella reads $2M on page 2.', time: '2026-10-07T09:00:00', active: true
  });
});

test('a confirmation with no changes gives no row: the model was right', () => {
  assert.equal(sampleFromCorrection(PENDING, READ, DANA, 'Checked against the PDF.', '2026-10-07T09:00:00'), null);
});

test('an unreadable file gives no row: there is nothing to calibrate against', () => {
  const unreadable = { id: 'CERT-2', stage: 'needs_review', reason: 'Unreadable file', confidence: 0, values: null };
  assert.equal(sampleFromCorrection(unreadable, FIXED, DANA, 'Typed in from the paper copy.', '2026-10-07T09:00:00'), null);
});

function sampleStore() {
  const store = core.FakeStore();
  core.initProject(store);
  return store;
}

test('the same certificate corrected twice keeps one row, the newest', () => {
  const store = sampleStore();
  const first = core.sampleFromCorrection(PENDING, FIXED, DANA, 'Umbrella reads $2M.', '2026-10-07T09:00:00');
  core.upsertSample(store, { ...first, record_id: 'REC-001', pdf_link: 'fake://cert-1.pdf' });
  const autoFixed = { ...FIXED, limits: { ...FIXED.limits, auto: 2000000 } };
  const second = core.sampleFromCorrection(PENDING, autoFixed, 'Sam Ortiz (Accountant)', 'Auto is $2M too.', '2026-10-08T11:30:00');
  core.upsertSample(store, { ...second, record_id: 'REC-001', pdf_link: 'fake://cert-1.pdf' });
  const rows = plain(store.readRows('calibration_samples'));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sample_id, 'SMP-CERT-1');
  assert.equal(rows[0].corrected_by, 'Sam Ortiz (Accountant)');
  assert.equal(rows[0].note, 'Auto is $2M too.');
  assert.equal(rows[0].time, '2026-10-08T11:30:00');
  assert.equal(JSON.parse(rows[0].expected_json).limits.auto, 2000000);
  assert.equal(rows[0].active, true);
});

test('a second certificate adds a second row', () => {
  const store = sampleStore();
  core.upsertSample(store, core.sampleFromCorrection(PENDING, FIXED, DANA, 'Umbrella reads $2M.', '2026-10-07T09:00:00'));
  core.upsertSample(store, core.sampleFromCorrection({ ...PENDING, id: 'CERT-2' }, FIXED, DANA, 'Umbrella reads $2M.', '2026-10-07T09:05:00'));
  assert.deepEqual(plain(store.readRows('calibration_samples')).map((r) => r.sample_id), ['SMP-CERT-1', 'SMP-CERT-2']);
});

test('only active rows become calibration entries, shaped like a manifest sample', () => {
  const rows = [
    { sample_id: 'SMP-CERT-1', certificate_id: 'CERT-1', pdf_link: 'https://drive.google.com/file/d/AAA/view', expected_json: '{"insured_name":"Ridgeline Roofing LLC"}', active: true },
    { sample_id: 'SMP-CERT-2', certificate_id: 'CERT-2', pdf_link: 'https://drive.google.com/file/d/BBB/view', expected_json: '{"insured_name":"Cedar Masonry LLC"}', active: false },
    { sample_id: 'SMP-CERT-3', certificate_id: 'CERT-3', pdf_link: 'https://drive.google.com/file/d/CCC/view', expected_json: '{"insured_name":"Brightway Electric Inc."}', active: 'TRUE' },
    { sample_id: 'SMP-CERT-4', certificate_id: 'CERT-4', pdf_link: 'https://drive.google.com/file/d/DDD/view', expected_json: '{"insured_name":"Oakvale Plumbing Co."}', active: '' },
  ];
  assert.deepEqual(plain(core.correctionCalibrationEntries(rows)), [
    { file: 'CERT-1', problem: 'From correction', readable: true, expected: { insured_name: 'Ridgeline Roofing LLC' }, link: 'https://drive.google.com/file/d/AAA/view' },
    { file: 'CERT-3', problem: 'From correction', readable: true, expected: { insured_name: 'Brightway Electric Inc.' }, link: 'https://drive.google.com/file/d/CCC/view' },
  ]);
});

test('a row with broken expected_json names the sample and the way out', () => {
  const rows = [{ sample_id: 'SMP-CERT-9', certificate_id: 'CERT-9', pdf_link: 'x', expected_json: '{oops', active: true }];
  assert.throws(() => core.correctionCalibrationEntries(rows), /SMP-CERT-9: expected_json is not valid JSON\. Fix it or set active to FALSE\./);
});
