// evaluateCoi: one reading checked against the tolerance matrix for a scope of work.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGs } = require('./load-gs');

const { evaluateCoi } = loadGs(['evaluateCoi']);
const MATRIX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'tolerance-matrix.json'), 'utf8'));
const NAME = { insuredName: 'Ridgeline Roofing LLC' };

// A reading that meets every roofing requirement in the sample policy.
const clean = (over) => ({
  insured_name: 'Ridgeline Roofing LLC',
  limits: {
    commercial_liability: 1000000, aggregate: 2000000, auto: 1000000, umbrella: 2000000,
    workers_comp: 1000000, pollution_liability: 1000000, professional_liability: null,
  },
  additional_insured_endorsement: true, project_address: true, certificate_holder: true,
  cancellation_notice_days: 30, expiration_date: '2027-10-01',
  ...over,
});

test('a clean roofing certificate passes', () => {
  const result = evaluateCoi(clean(), 'roofing', MATRIX, NAME);
  assert.equal(result.pass, true);
  assert.deepEqual(result.deficiencies, []);
});

test('a $1M umbrella against the $2M rule is a limit deficiency naming both amounts', () => {
  const reading = clean({ limits: { ...clean().limits, umbrella: 1000000 } });
  const result = evaluateCoi(reading, 'roofing', MATRIX, NAME);
  assert.equal(result.pass, false);
  assert.deepEqual(result.deficiencies, [{ field: 'umbrella', kind: 'limit', text: 'Umbrella: $1,000,000 shown, $2,000,000 required' }]);
});

test('roofing needs pollution cover that a missing value fails', () => {
  const reading = clean({ limits: { ...clean().limits, pollution_liability: null } });
  assert.deepEqual(evaluateCoi(reading, 'roofing', MATRIX, NAME).deficiencies, [
    { field: 'pollution_liability', kind: 'limit', text: 'Pollution: not shown; $1,000,000 required' },
  ]);
});

test('cleaning needs no umbrella', () => {
  const reading = clean({ insured_name: 'Brightway Cleaning Co.', limits: { ...clean().limits, umbrella: null, pollution_liability: null } });
  assert.equal(evaluateCoi(reading, 'cleaning', MATRIX, { insuredName: 'Brightway Cleaning Co.' }).pass, true);
});

test('a wrong insured name fails; case and punctuation do not', () => {
  assert.deepEqual(evaluateCoi(clean({ insured_name: 'Ridgeline Roofing Holdings' }), 'roofing', MATRIX, NAME).deficiencies, [
    { field: 'insured_name_matches', kind: 'requirement', text: 'Insured name: certificate shows Ridgeline Roofing Holdings; must read Ridgeline Roofing LLC' },
  ]);
  assert.equal(evaluateCoi(clean({ insured_name: 'RIDGELINE ROOFING, LLC' }), 'roofing', MATRIX, NAME).pass, true);
});

test('a missing additional insured endorsement fails', () => {
  assert.deepEqual(evaluateCoi(clean({ additional_insured_endorsement: false }), 'roofing', MATRIX, NAME).deficiencies, [
    { field: 'additional_insured_endorsement', kind: 'requirement', text: 'Additional insured endorsement: not shown; required' },
  ]);
});

test('a short cancellation notice fails and names both day counts', () => {
  assert.deepEqual(evaluateCoi(clean({ cancellation_notice_days: 10 }), 'roofing', MATRIX, NAME).deficiencies, [
    { field: 'cancellation_notice_days', kind: 'requirement', text: 'Cancellation notice: 10 days shown, 30 required' },
  ]);
});

test('lines list every required check with the value found and the value required, passes included', () => {
  const reading = clean({ limits: { ...clean().limits, umbrella: 1000000 }, project_address: false });
  assert.deepEqual(evaluateCoi(reading, 'roofing', MATRIX, NAME).lines, [
    { field: 'commercial_liability', label: 'General liability', found: '$1,000,000', required: '$1,000,000', pass: true },
    { field: 'aggregate', label: 'Aggregate', found: '$2,000,000', required: '$2,000,000', pass: true },
    { field: 'auto', label: 'Auto', found: '$1,000,000', required: '$1,000,000', pass: true },
    { field: 'umbrella', label: 'Umbrella', found: '$1,000,000', required: '$2,000,000', pass: false },
    { field: 'workers_comp', label: "Workers' comp", found: '$1,000,000', required: 'Any amount', pass: true },
    { field: 'pollution_liability', label: 'Pollution', found: '$1,000,000', required: '$1,000,000', pass: true },
    { field: 'additional_insured_endorsement', label: 'Additional insured endorsement', found: 'Printed', required: 'Printed', pass: true },
    { field: 'project_address', label: 'Project address', found: 'Not printed', required: 'Printed', pass: false },
    { field: 'certificate_holder', label: 'Certificate holder', found: 'Printed', required: 'Printed', pass: true },
    { field: 'insured_name_matches', label: 'Insured name', found: 'Matches', required: 'Matches', pass: true },
    { field: 'cancellation_notice_days', label: 'Cancellation notice', found: '30 days', required: '30 days', pass: true },
  ]);
});

test('a limit not shown reads "Not shown" and fails; an unrequired limit has no line', () => {
  const reading = clean({ limits: { ...clean().limits, pollution_liability: null }, cancellation_notice_days: null });
  const lines = evaluateCoi(reading, 'roofing', MATRIX, NAME).lines;
  assert.deepEqual(lines.filter((l) => l.field === 'pollution_liability'), [
    { field: 'pollution_liability', label: 'Pollution', found: 'Not shown', required: '$1,000,000', pass: false },
  ]);
  assert.deepEqual(lines.filter((l) => l.field === 'cancellation_notice_days'), [
    { field: 'cancellation_notice_days', label: 'Cancellation notice', found: 'Not shown', required: '30 days', pass: false },
  ]);
  assert.equal(lines.some((l) => l.field === 'professional_liability'), false);
});
