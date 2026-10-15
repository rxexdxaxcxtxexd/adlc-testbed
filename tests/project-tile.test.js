// projectTile: the dashboard counts and tile color from docs/metric-definitions.md.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGs } = require('./load-gs');

const { projectTile } = loadGs(['projectTile']);
const TODAY = '2026-10-07';

const rec = (over) => ({
  closed: false, current: null, pending: null, hold: { on: false, reasons: [] }, billedThisCycle: 0, ...over,
});
const cert = (expiry) => ({ id: 'C', expiration_date: expiry });
const limitDeficiency = { stage: 'deficiency', check: { pass: false, deficiencies: [{ field: 'umbrella', kind: 'limit', text: 'Umbrella' }] } };

test('every record compliant is green, On track', () => {
  assert.deepEqual(projectTile([rec({ current: cert('2027-06-30') }), rec({ current: cert('2027-01-01') })], TODAY), {
    color: 'green', word: 'On track',
    expected_count: 2, compliant_count: 2, expired_count: 0, expiring_30d_count: 0, below_limits_count: 0, dollars_on_hold_usd: 0,
  });
});

test('an expiring record counts as compliant and turns the tile yellow, Watch', () => {
  const t = projectTile([rec({ current: cert('2027-06-30') }), rec({ current: cert('2026-10-20') })], TODAY);
  assert.equal(t.color, 'yellow');
  assert.equal(t.word, 'Watch');
  assert.equal(t.compliant_count, 2);
  assert.equal(t.expiring_30d_count, 1);
});

test('an expiring record with a renewal received is not counted as expiring', () => {
  const t = projectTile([rec({ current: cert('2026-10-20'), pending: { stage: 'approval' } })], TODAY);
  assert.equal(t.expiring_30d_count, 0);
});

test('an awaiting record turns the tile yellow', () => {
  assert.equal(projectTile([rec({ current: cert('2027-06-30') }), rec({})], TODAY).color, 'yellow');
});

test('a limit deficiency in the queue counts below limits', () => {
  const t = projectTile([rec({ pending: limitDeficiency })], TODAY);
  assert.equal(t.below_limits_count, 1);
  assert.equal(t.color, 'yellow');
});

test('an expired record turns the tile red, At risk', () => {
  const t = projectTile([rec({ current: cert('2026-10-01') }), rec({ current: cert('2027-06-30') })], TODAY);
  assert.equal(t.color, 'red');
  assert.equal(t.word, 'At risk');
  assert.equal(t.expired_count, 1);
  assert.equal(t.compliant_count, 1);
});

test('a sub on payment hold turns the tile red and adds its billed amount', () => {
  const t = projectTile([
    rec({ current: cert('2027-06-30'), hold: { on: true, reasons: ['No W-9 on file'] }, billedThisCycle: 22900 }),
    rec({ current: cert('2027-06-30'), billedThisCycle: 18400 }),
  ], TODAY);
  assert.equal(t.color, 'red');
  assert.equal(t.dollars_on_hold_usd, 22900);
});

test('closed records are not counted', () => {
  const t = projectTile([rec({ closed: true, current: cert('2026-10-01') }), rec({ current: cert('2027-06-30') })], TODAY);
  assert.equal(t.expected_count, 1);
  assert.equal(t.color, 'green');
});
