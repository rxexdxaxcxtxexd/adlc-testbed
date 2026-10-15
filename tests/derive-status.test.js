// deriveStatus: status follows the current certificate, the queue and the date.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGs } = require('./load-gs');

const { deriveStatus } = loadGs(['deriveStatus']);
const TODAY = '2026-10-07';
const record = (over) => ({ closed: false, current: null, pending: null, ...over });

test('a record with nothing received is awaiting', () => {
  assert.equal(deriveStatus(record({}), TODAY), 'awaiting');
});

test('a current certificate more than 30 days out is compliant', () => {
  assert.equal(deriveStatus(record({ current: { expiration_date: '2026-11-07' } }), TODAY), 'compliant');
});

test('a current certificate 30 days out is expiring soon', () => {
  assert.equal(deriveStatus(record({ current: { expiration_date: '2026-11-06' } }), TODAY), 'expiring_soon');
});

test('a current certificate expiring today is expiring soon, not expired', () => {
  assert.equal(deriveStatus(record({ current: { expiration_date: '2026-10-07' } }), TODAY), 'expiring_soon');
});

test('a current certificate that expired yesterday is expired', () => {
  assert.equal(deriveStatus(record({ current: { expiration_date: '2026-10-06' } }), TODAY), 'expired');
});

test('a low-confidence reading in the queue is needs review', () => {
  assert.equal(deriveStatus(record({ pending: { stage: 'needs_review' } }), TODAY), 'needs_review');
});

test('a certificate waiting for approval or a deficiency decision is in review', () => {
  assert.equal(deriveStatus(record({ pending: { stage: 'approval' } }), TODAY), 'in_review');
  assert.equal(deriveStatus(record({ pending: { stage: 'deficiency' } }), TODAY), 'in_review');
});

test('an expired current certificate stays expired while its renewal waits', () => {
  const r = record({ current: { expiration_date: '2026-10-01' }, pending: { stage: 'approval' } });
  assert.equal(deriveStatus(r, TODAY), 'expired');
});

test('a closed record is closed whatever it holds', () => {
  assert.equal(deriveStatus(record({ closed: true, current: { expiration_date: '2026-10-01' } }), TODAY), 'closed');
});
