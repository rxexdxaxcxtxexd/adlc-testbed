// Ticket 08 through the job functions, with fake Store, Reader, Mailer, Clock, Calendar, Cursor and Timers:
// the daily job runs the pay check, the accountant marks a W-9, and the payment hold list shows who is held.
// Today is 2026-10-08. The current pay cycle is the earliest pay date that is today or later.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGsRaw, plain } = require('./load-gs');

// A lock that is always free; the lock's own behavior is tested in lock.test.js.
const LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) };

const core = loadGsRaw(
  ['initProject', 'seedSampleProject', 'processCertificate', 'reviewAction', 'processDailyBatch', 'paymentHoldList', 'recordDetail',
    'FakeStore', 'FakeReader', 'FakeMailer', 'FakeClock', 'FakeCalendar', 'FakeCursor', 'FakeTimers', 'SAMPLE_READING'],
  { LockService },
);

const UPLOAD_BASE = 'https://upload.example.test/exec';
const ACCOUNTANT = 'Dana Reyes (Accountant)';

const reading = (expiry) => {
  const base = plain(core.SAMPLE_READING);
  return { ...base, values: { ...base.values, expiration_date: expiry } };
};

function emptyProject() {
  const deps = {
    store: core.FakeStore(),
    reader: core.FakeReader(reading('2027-09-30')),
    mailer: core.FakeMailer(),
    clock: core.FakeClock('2026-10-08', '2026-10-08T09:00:00'),
    calendar: core.FakeCalendar(),
    cursor: core.FakeCursor(),
    timers: core.FakeTimers(),
    newToken: () => 'token-1',
    uploadBaseUrl: UPLOAD_BASE,
    internalBaseUrl: '',
  };
  core.initProject(deps.store);
  core.seedSampleProject(deps);
  for (const tab of ['compliance_records', 'certificates', 'subcontractors', 'activity_log']) {
    deps.store.snapshot().rows[tab].length = 0;
  }
  return deps;
}

const pad = (n) => ('00' + n).slice(-3);
const rows = (deps, tab) => plain(deps.store.snapshot().rows[tab]);
const rec = (deps, id) => rows(deps, 'compliance_records').find((r) => r.record_id === id);
const log = (deps) => rows(deps, 'activity_log').map((a) => a.summary);
const on = (deps, day) => { deps.clock = core.FakeClock(day); };
const accountantMail = (deps) => plain(deps.mailer.sent()).filter((m) => m.to === 'accountant@example.com').map((m) => m.body);

// A record with an accepted certificate. w9 defaults to on file.
function addSub(deps, n, expiry, over) {
  const id = pad(n);
  deps.store.appendRow('subcontractors', { sub_id: `SUB-${id}`, name: `Sub ${id}`, email: `sub${id}@example.com`, scope_of_work: 'roofing' });
  deps.store.appendRow('compliance_records', {
    record_id: `REC-${id}`, project_id: 'PRJ-001', sub_id: `SUB-${id}`, upload_token: `tok-${id}`,
    status: 'compliant', current_certificate_id: `CERT-${id}`, queued_certificate_id: '', payment_hold: false,
    payment_hold_reasons: '[]', w9_on_file: true, reminder_30d_sent: true, reminder_7d_sent: true, closed: false,
    last_updated: '2026-10-01T09:00:00', ...over,
  });
  deps.store.appendRow('certificates', {
    certificate_id: `CERT-${id}`, record_id: `REC-${id}`, received_date: '2026-10-01', file_fingerprint: `fp-${id}`,
    confidence: 0.97, insured_name: `Sub ${id}`, expiration_date: expiry, check_result: 'pass', deficiencies: '[]',
    decision: 'approved by the accountant', calendar_event_id: `EVT-${id}`,
  });
}

const bill = (deps, n, cycle, amount) => deps.store.appendRow('pay_applications', {
  project_id: 'PRJ-001', sub_id: `SUB-${pad(n)}`, pay_cycle: cycle, amount_billed_usd: amount,
});

test('the daily job holds a sub who billed this cycle with an expired policy and mails the accountant', () => {
  const deps = emptyProject();
  addSub(deps, 1, '2026-10-07');
  bill(deps, 1, '2026-10-15', 6250);
  const result = plain(core.processDailyBatch(deps, true));
  assert.deepEqual(result, { status: 'done', checked: 1, changed: 1 });
  assert.equal(rec(deps, 'REC-001').payment_hold, true);
  assert.equal(rec(deps, 'REC-001').payment_hold_reasons, '["Policy expired"]');
  assert.deepEqual(accountantMail(deps), ['Payment hold list: Sub 001, $6,250. Policy expired.']);
  assert.ok(log(deps).includes('Pay check: on payment hold (Policy expired).'));
});

test('every reason is listed: an expired policy and a missing W-9', () => {
  const deps = emptyProject();
  addSub(deps, 1, '2026-10-07', { w9_on_file: false });
  bill(deps, 1, '2026-10-15', 6250);
  core.processDailyBatch(deps, true);
  assert.equal(rec(deps, 'REC-001').payment_hold_reasons, '["Policy expired","No W-9 on file"]');
  assert.deepEqual(accountantMail(deps), ['Payment hold list: Sub 001, $6,250. Policy expired; No W-9 on file.']);
});

test('a compliant sub with a W-9 on file is not held, and a missing W-9 alone holds', () => {
  const deps = emptyProject();
  addSub(deps, 1, '2027-09-30');
  addSub(deps, 2, '2027-09-30', { w9_on_file: false });
  bill(deps, 1, '2026-10-15', 1000);
  bill(deps, 2, '2026-10-15', 2000);
  core.processDailyBatch(deps, true);
  assert.equal(rec(deps, 'REC-001').payment_hold, false);
  assert.equal(rec(deps, 'REC-002').payment_hold, true);
  assert.equal(rec(deps, 'REC-002').payment_hold_reasons, '["No W-9 on file"]');
});

test('only the current cycle counts: the earliest pay date from today on, and amounts for the same cycle add up', () => {
  const deps = emptyProject();
  addSub(deps, 1, '2026-10-07');
  addSub(deps, 2, '2026-10-07');
  addSub(deps, 3, '2026-10-07');
  bill(deps, 1, '2026-10-01', 9999);
  bill(deps, 1, '2026-10-15', 4000);
  bill(deps, 1, '2026-10-15', 250);
  bill(deps, 1, '2026-10-29', 777);
  bill(deps, 2, '2026-10-29', 500);
  bill(deps, 3, '2026-10-08', 300);
  core.processDailyBatch(deps, true);
  // Pay date 2026-10-08 is today, so it is the current cycle. Only Sub 003 billed in it.
  assert.deepEqual(rows(deps, 'compliance_records').map((r) => r.payment_hold), [false, false, true]);
  assert.deepEqual(accountantMail(deps), ['Payment hold list: Sub 003, $300. Policy expired.']);

  on(deps, '2026-10-09');
  core.processDailyBatch(deps, true);
  // The cycle is now 2026-10-15: Sub 001 billed $4,250 in it; Sub 003 has no bill, so its hold clears.
  assert.deepEqual(rows(deps, 'compliance_records').map((r) => r.payment_hold), [true, false, false]);
  assert.deepEqual(accountantMail(deps).at(-1), 'Payment hold list: Sub 001, $4,250. Policy expired.');
  assert.ok(log(deps).includes('Payment hold cleared: no bill this cycle.'));
});

test('no pay date from today on means nobody is held', () => {
  const deps = emptyProject();
  addSub(deps, 1, '2026-10-07');
  bill(deps, 1, '2026-10-01', 6250);
  core.processDailyBatch(deps, true);
  assert.equal(rec(deps, 'REC-001').payment_hold, false);
  assert.deepEqual(accountantMail(deps), []);
});

test('a closed record is never held', () => {
  const deps = emptyProject();
  addSub(deps, 1, '2026-10-07', { closed: true, status: 'closed' });
  bill(deps, 1, '2026-10-15', 6250);
  core.processDailyBatch(deps, true);
  assert.equal(rec(deps, 'REC-001').payment_hold, false);
});

test('a second daily run mails nothing new and does not rewrite a held record', () => {
  const deps = emptyProject();
  addSub(deps, 1, '2026-10-07');
  bill(deps, 1, '2026-10-15', 6250);
  core.processDailyBatch(deps, true);
  const stamp = rec(deps, 'REC-001').last_updated;
  const mails = plain(deps.mailer.sent()).length;
  on(deps, '2026-10-09');
  assert.deepEqual(plain(core.processDailyBatch(deps, true)), { status: 'done', checked: 1, changed: 0 });
  assert.equal(plain(deps.mailer.sent()).length, mails);
  assert.equal(rec(deps, 'REC-001').last_updated, stamp);
});

test('the pay check runs in batches of 10 with the saved cursor', () => {
  const deps = emptyProject();
  for (let n = 1; n <= 12; n++) { addSub(deps, n, '2026-10-07'); bill(deps, n, '2026-10-15', 100 * n); }
  assert.deepEqual(plain(core.processDailyBatch(deps, true)), { status: 'continues', processed: 10 });
  assert.deepEqual(rows(deps, 'compliance_records').map((r) => r.payment_hold), [...Array(10).fill(true), false, false]);
  assert.equal(plain(deps.cursor.get()).after, 10);
  assert.deepEqual(plain(core.processDailyBatch(deps, false)), { status: 'done', checked: 12, changed: 12 });
  assert.equal(rows(deps, 'compliance_records').every((r) => r.payment_hold === true), true);
  assert.equal(accountantMail(deps).length, 12);
});

test('a renewal approved after the pay check lifts the hold and notifies the accountant', () => {
  const deps = emptyProject();
  deps.store.appendRow('subcontractors', { sub_id: 'SUB-001', name: 'Ridgeline Roofing LLC', email: 'ridgeline@example.com', scope_of_work: 'roofing' });
  deps.store.appendRow('compliance_records', {
    record_id: 'REC-001', project_id: 'PRJ-001', sub_id: 'SUB-001', upload_token: 'token-1', status: 'awaiting',
    payment_hold: false, payment_hold_reasons: '[]', w9_on_file: true, reminder_30d_sent: false, reminder_7d_sent: false,
    closed: false, last_updated: '2026-10-08T09:00:00',
  });
  deps.reader = core.FakeReader(reading('2026-10-20'));
  core.processCertificate(deps, 'token-1', { name: 'a.pdf', fingerprint: 'fp-a', link: 'fake://a.pdf' });
  assert.equal(plain(core.reviewAction(deps, 'REC-001', 'accountant', 'approve', {})).ok, true);

  bill(deps, 1, '2026-10-22', 6250);
  on(deps, '2026-10-21');
  core.processDailyBatch(deps, true);
  assert.equal(rec(deps, 'REC-001').payment_hold, true);
  assert.equal(rec(deps, 'REC-001').payment_hold_reasons, '["Policy expired"]');

  deps.reader = core.FakeReader(reading('2027-10-20'));
  core.processCertificate(deps, 'token-1', { name: 'b.pdf', fingerprint: 'fp-b', link: 'fake://b.pdf' });
  assert.equal(rec(deps, 'REC-001').payment_hold, true);
  assert.equal(rec(deps, 'REC-001').payment_hold_reasons, '["Policy expired; renewal not yet approved"]');

  assert.equal(plain(core.reviewAction(deps, 'REC-001', 'accountant', 'approve', {})).ok, true);
  assert.equal(rec(deps, 'REC-001').payment_hold, false);
  assert.equal(rec(deps, 'REC-001').payment_hold_reasons, '[]');
  assert.equal(accountantMail(deps).at(-1), 'Ridgeline Roofing LLC is cleared for payment.');
  assert.ok(log(deps).includes('Payment hold released.'));
});

test('the accountant marks a W-9 missing, the next pay check holds, and marking it on file lifts the hold', () => {
  const deps = emptyProject();
  addSub(deps, 1, '2027-09-30');
  bill(deps, 1, '2026-10-15', 6250);

  const missing = plain(core.reviewAction(deps, 'REC-001', 'accountant', 'w9', { onFile: false }));
  assert.deepEqual(missing, { ok: true, message: 'W-9 marked missing.', status: 'compliant' });
  assert.equal(rec(deps, 'REC-001').w9_on_file, false);
  assert.ok(rows(deps, 'activity_log').some((a) => a.who === ACCOUNTANT && a.summary === 'Marked W-9 missing.'));
  assert.equal(rec(deps, 'REC-001').payment_hold, false);

  core.processDailyBatch(deps, true);
  assert.equal(rec(deps, 'REC-001').payment_hold_reasons, '["No W-9 on file"]');

  const onFile = plain(core.reviewAction(deps, 'REC-001', 'accountant', 'w9', { onFile: true }));
  assert.equal(onFile.message, 'W-9 marked on file.');
  assert.equal(rec(deps, 'REC-001').payment_hold, false);
  assert.equal(accountantMail(deps).at(-1), 'Sub 001 is cleared for payment.');
});

test('only the accountant can mark a W-9, and a bad request changes nothing', () => {
  const deps = emptyProject();
  addSub(deps, 1, '2027-09-30');
  const before = JSON.stringify(rows(deps, 'compliance_records'));
  assert.deepEqual(plain(core.reviewAction(deps, 'REC-001', 'project_manager', 'w9', { onFile: false })), { ok: false, message: 'Only the accountant can mark a W-9.' });
  assert.deepEqual(plain(core.reviewAction(deps, 'REC-001', 'leadership', 'w9', { onFile: false })), { ok: false, message: 'Only the accountant can mark a W-9.' });
  assert.deepEqual(plain(core.reviewAction(deps, 'REC-001', 'accountant', 'w9', {})), { ok: false, message: 'Say whether the W-9 is on file or missing.' });
  assert.deepEqual(plain(core.reviewAction(deps, 'REC-001', 'accountant', 'w9', { onFile: true })), { ok: false, message: 'The W-9 is already marked on file.' });
  assert.equal(JSON.stringify(rows(deps, 'compliance_records')), before);
});

test('the payment hold list shows subcontractor, amount and every reason, with source and last update', () => {
  const deps = emptyProject();
  addSub(deps, 1, '2026-10-07');
  addSub(deps, 2, '2027-09-30', { w9_on_file: false });
  addSub(deps, 3, '2027-09-30');
  bill(deps, 1, '2026-10-15', 6250);
  bill(deps, 2, '2026-10-15', 22900);
  bill(deps, 3, '2026-10-15', 400);
  deps.clock = core.FakeClock('2026-10-08', '2026-10-08T06:00:00');
  core.processDailyBatch(deps, true);

  assert.deepEqual(plain(core.paymentHoldList(deps, 'PRJ-001')), {
    pay_date: '2026-10-15',
    rows: [
      { record_id: 'REC-002', subcontractor: 'Sub 002', amount: '$22,900', amount_usd: 22900, reasons: ['No W-9 on file'] },
      { record_id: 'REC-001', subcontractor: 'Sub 001', amount: '$6,250', amount_usd: 6250, reasons: ['Policy expired'] },
    ],
    total: '$29,150',
    total_usd: 29150,
    source: 'pay_applications, compliance_records',
    last_updated: '2026-10-08T06:00:00',
    empty: '',
    sample: 'Sample data',
  });
});

test('the payment hold list says so when nobody is held, and when no pay date is coming', () => {
  const deps = emptyProject();
  addSub(deps, 1, '2027-09-30');
  bill(deps, 1, '2026-10-15', 6250);
  core.processDailyBatch(deps, true);
  assert.deepEqual(plain(core.paymentHoldList(deps, 'PRJ-001')), {
    pay_date: '2026-10-15', rows: [], total: '$0', total_usd: 0, source: 'pay_applications, compliance_records',
    last_updated: '', empty: 'No one is on payment hold for the pay date 2026-10-15.', sample: 'Sample data',
  });

  on(deps, '2026-10-16');
  assert.deepEqual(plain(core.paymentHoldList(deps, 'PRJ-001')), {
    pay_date: '', rows: [], total: '$0', total_usd: 0, source: 'pay_applications, compliance_records',
    last_updated: '', empty: 'No pay date from today on has a pay application. Nothing to hold.', sample: 'Sample data',
  });
});

test('a hold left from an old cycle does not show on the list once that cycle has passed', () => {
  const deps = emptyProject();
  addSub(deps, 1, '2026-10-07');
  bill(deps, 1, '2026-10-15', 6250);
  core.processDailyBatch(deps, true);
  assert.equal(rec(deps, 'REC-001').payment_hold, true);
  on(deps, '2026-10-16');
  assert.equal(plain(core.paymentHoldList(deps, 'PRJ-001')).rows.length, 0);
});

test('the record page tells the W-9 flag: on file, then missing after the accountant marks it', () => {
  const deps = emptyProject();
  addSub(deps, 1, '2027-09-30');
  assert.equal(plain(core.recordDetail(deps, 'REC-001')).w9_on_file, true);
  core.reviewAction(deps, 'REC-001', 'accountant', 'w9', { onFile: false });
  assert.equal(plain(core.recordDetail(deps, 'REC-001')).w9_on_file, false);
  assert.equal(plain(core.recordDetail(deps, 'REC-001')).closed, false);
});
