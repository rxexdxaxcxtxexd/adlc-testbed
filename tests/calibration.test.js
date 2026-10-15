// compareToManifest and the report: pass and fail rules for the calibration gate.
// Expected values are written by hand.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGs } = require('./load-gs');

const { compareToManifest, formatCalibrationReport } = loadGs(['compareToManifest', 'formatCalibrationReport']);

const EXPECTED = {
  insured_name: 'Ridgeline Roofing LLC',
  limits: {
    commercial_liability: 1000000, aggregate: 2000000, auto: 1000000, umbrella: 2000000,
    workers_comp: 1000000, pollution_liability: 1000000, professional_liability: null
  },
  additional_insured_endorsement: true, project_address: true, certificate_holder: true,
  cancellation_notice_days: 30, expiration_date: '2027-09-30'
};
const ENTRY = { file: '01-clean.pdf', problem: 'none', readable: true, expected: EXPECTED };
const readingOf = (patch = {}, confidence = 0.9) => {
  const { limits, ...rest } = patch;
  return { readable: true, confidence, reason: null, values: { ...EXPECTED, ...rest, limits: { ...EXPECTED.limits, ...limits } } };
};

test('every value matches and confidence is at least 0.85: pass', () => {
  const r = compareToManifest(readingOf(), ENTRY);
  assert.equal(r.pass, true);
  assert.equal(r.rows.length, 13);
  assert.equal(r.rows.every((row) => row.pass), true);
});

test('confidence of exactly 0.85 passes and 0.84 fails', () => {
  assert.equal(compareToManifest(readingOf({}, 0.85), ENTRY).pass, true);
  const low = compareToManifest(readingOf({}, 0.84), ENTRY);
  assert.equal(low.pass, false);
  assert.equal(low.confidenceOk, false);
  assert.equal(low.rows.every((row) => row.pass), true);
});

test('one wrong value fails the sample and names the field', () => {
  const r = compareToManifest(readingOf({ limits: { auto: 500000 } }), ENTRY);
  assert.equal(r.pass, false);
  const bad = r.rows.filter((row) => !row.pass);
  assert.deepEqual(bad, [{ field: 'limits.auto', expected: 1000000, found: 500000, pass: false }]);
});

test('a null where the manifest has a value fails, and a value where the manifest has null fails', () => {
  const missing = compareToManifest(readingOf({ expiration_date: null }), ENTRY);
  assert.deepEqual(missing.rows.filter((row) => !row.pass), [{ field: 'expiration_date', expected: '2027-09-30', found: null, pass: false }]);
  const extra = compareToManifest(readingOf({ limits: { professional_liability: 1000000 } }), ENTRY);
  assert.deepEqual(extra.rows.filter((row) => !row.pass), [{ field: 'limits.professional_liability', expected: null, found: 1000000, pass: false }]);
});

test('an unreadable reading of a readable sample fails', () => {
  const r = compareToManifest({ readable: false, confidence: 0, values: null, reason: 'The reply was not valid JSON.' }, ENTRY);
  assert.equal(r.pass, false);
  assert.deepEqual(r.rows, [{ field: 'readable', expected: true, found: false, pass: false }]);
});

const BAD = { file: '07-corrupt.pdf', problem: 'corrupt file', readable: false };

test('an unreadable sample passes only when the result is unreadable with a reason and no values', () => {
  const ok = compareToManifest({ readable: false, confidence: 0, values: null, reason: 'The model service rejected the file (HTTP 400).' }, BAD);
  assert.equal(ok.pass, true);
  const guessed = compareToManifest(readingOf(), BAD);
  assert.equal(guessed.pass, false);
  const noReason = compareToManifest({ readable: false, confidence: 0, values: null, reason: '' }, BAD);
  assert.equal(noReason.pass, false);
});

test('the report lists every sample and field, then a total', () => {
  const clean = compareToManifest(readingOf(), ENTRY);
  const wrong = compareToManifest(readingOf({ limits: { auto: 500000 } }, 0.8), { ...ENTRY, file: '03-low-limit.pdf', problem: 'limit below requirement' });
  const text = formatCalibrationReport([
    { file: '01-clean.pdf', problem: 'none', result: clean, reading: readingOf() },
    { file: '03-low-limit.pdf', problem: 'limit below requirement', result: wrong, reading: readingOf({ limits: { auto: 500000 } }, 0.8) }
  ]);
  const lines = text.split('\n');
  assert.equal(lines[0], '# Calibration report');
  assert.ok(lines.includes('## 01-clean.pdf (none): PASS, confidence 0.9'));
  assert.ok(lines.includes('## 03-low-limit.pdf (limit below requirement): FAIL, confidence 0.8'));
  assert.ok(lines.includes('| limits.auto | 1000000 | 500000 | FAIL |'));
  assert.ok(lines.includes('| insured_name | Ridgeline Roofing LLC | Ridgeline Roofing LLC | pass |'));
  assert.equal(lines[lines.length - 1], 'Total: 1 of 2 samples pass.');
});

test('with correction samples the report has two sections and two totals', () => {
  const clean = compareToManifest(readingOf(), ENTRY);
  const wrong = compareToManifest(readingOf({ limits: { auto: 500000 } }), ENTRY);
  const fromCorrection = { ...ENTRY, file: 'CERT-014', problem: 'From correction' };
  const fixedRead = compareToManifest(readingOf({}, 0.96), fromCorrection);
  const stillWrong = compareToManifest(readingOf({ limits: { umbrella: 1000000 } }, 0.96), { ...fromCorrection, file: 'CERT-037' });
  const text = formatCalibrationReport(
    [
      { file: '01-clean.pdf', problem: 'none', result: clean, reading: readingOf() },
      { file: '03-low-limit.pdf', problem: 'limit below requirement', result: wrong, reading: readingOf({ limits: { auto: 500000 } }) }
    ],
    [
      { file: 'CERT-014', problem: 'From correction', result: fixedRead, reading: readingOf({}, 0.96) },
      { file: 'CERT-037', problem: 'From correction', result: stillWrong, reading: readingOf({ limits: { umbrella: 1000000 } }, 0.96) }
    ]
  );
  const lines = text.split('\n');
  assert.equal(lines[0], '# Calibration report');
  const hand = lines.indexOf('## Hand-built set');
  const corr = lines.indexOf('## From corrections');
  assert.ok(hand > 0 && corr > hand);
  assert.ok(lines.indexOf('### 01-clean.pdf (none): PASS, confidence 0.9') > hand);
  assert.ok(lines.indexOf('### 03-low-limit.pdf (limit below requirement): FAIL, confidence 0.9') < corr);
  assert.ok(lines.indexOf('### CERT-014 (From correction): PASS, confidence 0.96') > corr);
  assert.ok(lines.indexOf('### CERT-037 (From correction): FAIL, confidence 0.96') > corr);
  assert.ok(lines.includes('| limits.umbrella | 2000000 | 1000000 | FAIL |'));
  assert.deepEqual(lines.slice(-2), ['Hand-built set: 1 of 2 pass.', 'From corrections: 1 of 2 pass.']);
  assert.ok(!lines.some((l) => l.startsWith('Total:')));
});

test('an empty list of correction samples keeps the single total', () => {
  const clean = compareToManifest(readingOf(), ENTRY);
  const text = formatCalibrationReport([{ file: '01-clean.pdf', problem: 'none', result: clean, reading: readingOf() }], []);
  const lines = text.split('\n');
  assert.ok(lines.includes('## 01-clean.pdf (none): PASS, confidence 0.9'));
  assert.equal(lines[lines.length - 1], 'Total: 1 of 1 samples pass.');
});
