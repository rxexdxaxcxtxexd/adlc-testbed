// Ticket 07 through the job functions, with fake Store, Reader, Mailer, Clock, Calendar, Cursor and Timers:
// a renewal replaces the current certificate, and a daily job ages every record with no one watching.
// Expected dates and texts are literals worked out by hand: a policy that expires on 2027-09-30 is
// "expiring soon" from 2027-08-31 (30 days before) and "expired" from 2027-10-01.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGsRaw, plain } = require('./load-gs');

// A lock that is always free; the lock's own behavior is tested in lock.test.js.
const LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) };

const core = loadGsRaw(
  ['initProject', 'seedSampleProject', 'processCertificate', 'reviewAction', 'processDailyBatch', 'deriveStatus',
    'FakeStore', 'FakeReader', 'FakeMailer', 'FakeClock', 'FakeCalendar', 'FakeCursor', 'FakeTimers', 'SAMPLE_READING'],
  { LockService },
);

const UPLOAD_BASE = 'https://upload.example.test/exec';
const LINK = `${UPLOAD_BASE}?t=token-1`;
const TITLE = 'Policy expires: Ridgeline Roofing LLC (Maple Court Residences)';
const ACCOUNTANT = 'Dana Reyes (Accountant)';

// The clean sample reading, with its expiry date changed.
const reading = (expiry) => {
  const base = plain(core.SAMPLE_READING);
  return { ...base, values: { ...base.values, expiration_date: expiry } };
};

function setup(over) {
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
    ...over,
  };
  core.initProject(deps.store);
  core.seedSampleProject(deps);
  return deps;
}

const file = (n) => ({ name: `ridgeline-${n}.pdf`, fingerprint: `sha256-${n}`, link: `fake://inbox/ridgeline-${n}.pdf` });
const rows = (deps, tab) => plain(deps.store.snapshot().rows[tab]);
const record = (deps) => rows(deps, 'compliance_records')[0];
const cert = (deps, id) => rows(deps, 'certificates').find((c) => c.certificate_id === id);
const log = (deps) => rows(deps, 'activity_log').map((a) => a.summary);
const sent = (deps) => plain(deps.mailer.sent());
const on = (deps, day) => { deps.clock = core.FakeClock(day); };

// Uploads one certificate and approves it, the way the accountant does on review all.
function acceptCertificate(deps, n) {
  core.processCertificate(deps, 'token-1', file(n));
  const out = plain(core.reviewAction(deps, 'REC-001', 'accountant', 'approve', {}));
  assert.equal(out.ok, true);
}

// A record that already holds an accepted certificate, added beside the sample record.
function addAccepted(deps, n, expiry, status) {
  const id = ('00' + n).slice(-3);
  deps.store.appendRow('subcontractors', { sub_id: `SUB-${id}`, name: `Sub ${id}`, email: `sub${id}@example.com`, scope_of_work: 'roofing' });
  deps.store.appendRow('compliance_records', {
    record_id: `REC-${id}`, project_id: 'PRJ-001', sub_id: `SUB-${id}`, upload_token: `tok-${id}`, status: status || 'compliant',
    current_certificate_id: `CERT-${id}`, queued_certificate_id: '', payment_hold: false, payment_hold_reasons: '[]',
    w9_on_file: true, reminder_30d_sent: false, reminder_7d_sent: false, closed: false, last_updated: '2026-10-01T09:00:00',
  });
  deps.store.appendRow('certificates', {
    certificate_id: `CERT-${id}`, record_id: `REC-${id}`, received_date: '2026-10-01', file_fingerprint: `fp-${id}`, confidence: 0.97,
    insured_name: `Sub ${id}`, expiration_date: expiry, check_result: 'pass', deficiencies: '[]', decision: 'approved by the accountant',
  });
}

// An empty project with no sample record, for batch tests.
function emptyProject(over) {
  const deps = setup(over);
  for (const tab of ['compliance_records', 'certificates', 'subcontractors', 'activity_log']) {
    deps.store.snapshot().rows[tab].length = 0;
  }
  return deps;
}

test('a renewal replaces the current certificate; the old one stays in history with the ID of the one that replaced it', () => {
  const deps = setup();
  acceptCertificate(deps, 1);
  assert.equal(record(deps).current_certificate_id, 'CERT-001');

  deps.reader = core.FakeReader(reading('2028-09-30'));
  core.processCertificate(deps, 'token-1', file(2));
  assert.equal(record(deps).current_certificate_id, 'CERT-001');
  assert.equal(record(deps).queued_certificate_id, 'CERT-002');
  assert.equal(plain(core.reviewAction(deps, 'REC-001', 'accountant', 'approve', {})).ok, true);

  assert.equal(record(deps).current_certificate_id, 'CERT-002');
  assert.equal(record(deps).queued_certificate_id, '');
  assert.equal(cert(deps, 'CERT-002').replaces_certificate_id, 'CERT-001');
  assert.equal(cert(deps, 'CERT-001').outcome, 'Replaced by CERT-002');
  assert.equal(cert(deps, 'CERT-001').expiration_date, '2027-09-30');
  assert.equal(rows(deps, 'certificates').length, 2);
});

test('each accepted certificate puts one all-day event on the calendar, and a renewal removes the old one', () => {
  const deps = setup();
  core.processCertificate(deps, 'token-1', file(1));
  assert.deepEqual(plain(deps.calendar.events()), []);

  core.reviewAction(deps, 'REC-001', 'accountant', 'approve', {});
  assert.deepEqual(plain(deps.calendar.events()), [{ id: 'EVT-1', title: TITLE, date: '2027-09-30' }]);
  assert.equal(cert(deps, 'CERT-001').calendar_event_id, 'EVT-1');

  deps.reader = core.FakeReader(reading('2028-09-30'));
  core.processCertificate(deps, 'token-1', file(2));
  assert.deepEqual(plain(deps.calendar.events()), [{ id: 'EVT-1', title: TITLE, date: '2027-09-30' }]);
  core.reviewAction(deps, 'REC-001', 'accountant', 'approve', {});
  assert.deepEqual(plain(deps.calendar.events()), [{ id: 'EVT-2', title: TITLE, date: '2028-09-30' }]);
  assert.equal(cert(deps, 'CERT-002').calendar_event_id, 'EVT-2');
});

test('a calendar failure does not undo the acceptance, is logged, and the next daily run adds the event', () => {
  const deps = setup();
  const real = deps.calendar;
  deps.calendar = { ...real, createAllDay: () => { throw new Error('Calendar is down.'); } };
  core.processCertificate(deps, 'token-1', file(1));
  assert.equal(plain(core.reviewAction(deps, 'REC-001', 'accountant', 'approve', {})).status, 'compliant');
  assert.equal(record(deps).current_certificate_id, 'CERT-001');
  assert.equal(log(deps).at(-1), 'The calendar event for CERT-001 could not be created. Calendar is down.');

  deps.calendar = real;
  on(deps, '2026-10-09');
  core.processDailyBatch(deps, true);
  assert.deepEqual(plain(real.events()), [{ id: 'EVT-1', title: TITLE, date: '2027-09-30' }]);
  assert.equal(cert(deps, 'CERT-001').calendar_event_id, 'EVT-1');
});

test('the daily job adds an event for an accepted certificate that has none, once', () => {
  const deps = emptyProject();
  addAccepted(deps, 1, '2027-03-31');
  core.processDailyBatch(deps, true);
  core.processDailyBatch(deps, true);
  assert.deepEqual(plain(deps.calendar.events()), [{ id: 'EVT-1', title: 'Policy expires: Sub 001 (Maple Court Residences)', date: '2027-03-31' }]);
});

test('with a fixed clock, expiring soon and expired start on the right day', () => {
  const deps = setup();
  acceptCertificate(deps, 1);
  const stored = [];
  for (const day of ['2027-08-30', '2027-08-31', '2027-09-30', '2027-10-01']) {
    on(deps, day);
    core.processDailyBatch(deps, true);
    stored.push([day, record(deps).status]);
  }
  assert.deepEqual(stored, [
    ['2027-08-30', 'compliant'],
    ['2027-08-31', 'expiring_soon'],
    ['2027-09-30', 'expiring_soon'],
    ['2027-10-01', 'expired'],
  ]);
});

test('deriveStatus gives the same answer for the same days, straight from the seam', () => {
  const r = { closed: false, pending: null, current: { expiration_date: '2027-09-30' } };
  const status = (day) => core.deriveStatus(r, day);
  assert.equal(status('2027-08-30'), 'compliant');
  assert.equal(status('2027-08-31'), 'expiring_soon');
  assert.equal(status('2027-09-30'), 'expiring_soon');
  assert.equal(status('2027-10-01'), 'expired');
});

test('the subcontractor gets one reminder at 30 days and one follow-up at 7 days, each with the upload link', () => {
  const deps = setup();
  acceptCertificate(deps, 1);
  const before = sent(deps).length;
  const emails = [];
  for (let d = new Date('2027-08-29T00:00:00Z'); d <= new Date('2027-10-03T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
    const day = d.toISOString().slice(0, 10);
    on(deps, day);
    core.processDailyBatch(deps, true);
    sent(deps).slice(before + emails.length).forEach((m) => emails.push([day, m.to, m.body]));
  }
  assert.deepEqual(emails, [
    ['2027-08-31', 'ridgeline@example.com', `Your policy expires 2027-09-30. Please send your renewal. Upload your renewal here: ${LINK}`],
    ['2027-09-23', 'ridgeline@example.com', `Reminder: your policy expires 2027-09-30. Upload your renewal here: ${LINK}`],
  ]);
  assert.equal(record(deps).reminder_30d_sent, true);
  assert.equal(record(deps).reminder_7d_sent, true);
});

test('a record first seen inside 7 days gets the 7-day follow-up only', () => {
  const deps = setup();
  acceptCertificate(deps, 1);
  const before = sent(deps).length;
  on(deps, '2027-09-26');
  core.processDailyBatch(deps, true);
  assert.deepEqual(sent(deps).slice(before).map((m) => m.body), [`Reminder: your policy expires 2027-09-30. Upload your renewal here: ${LINK}`]);
  on(deps, '2027-09-27');
  core.processDailyBatch(deps, true);
  assert.equal(sent(deps).length, before + 1);
});

test('no reminder goes out once a renewal has arrived', () => {
  const deps = setup();
  acceptCertificate(deps, 1);
  deps.reader = core.FakeReader(reading('2028-09-30'));
  on(deps, '2027-09-20');
  core.processCertificate(deps, 'token-1', file(2));
  const before = sent(deps).length;
  on(deps, '2027-09-23');
  core.processDailyBatch(deps, true);
  assert.equal(sent(deps).length, before);
  assert.equal(record(deps).reminder_7d_sent, false);
});

test('a record that did not change is not written, and each pass logs one summary per project', () => {
  const deps = setup();
  acceptCertificate(deps, 1);
  const stamp = record(deps).last_updated;
  on(deps, '2026-10-09');
  const result = plain(core.processDailyBatch(deps, true));
  assert.deepEqual(result, { status: 'done', checked: 1, changed: 0 });
  assert.equal(record(deps).last_updated, stamp);
  assert.deepEqual(rows(deps, 'activity_log').at(-1), {
    record_id: 'PRJ-001', time: '2026-10-09T09:00:00', who: 'System', event_type: 'daily_check', summary: 'Daily check ran: 1 record checked, 0 changed.', drive_link: '',
  });
});

test('a changed record is written with the new status and time, and the expiry is logged', () => {
  const deps = setup();
  acceptCertificate(deps, 1);
  on(deps, '2027-10-01');
  core.processDailyBatch(deps, true);
  assert.equal(record(deps).status, 'expired');
  assert.equal(record(deps).last_updated, '2027-10-01T09:00:00');
  assert.ok(log(deps).includes('Policy expired.'));
  assert.equal(log(deps).at(-1), 'Daily check ran: 1 record checked, 1 changed.');
});

test('the job takes 10 records a run, saves a cursor, and asks to run again after 60 seconds', () => {
  const deps = emptyProject();
  for (let n = 1; n <= 25; n++) addAccepted(deps, n, '2026-10-07');
  on(deps, '2026-10-08');
  const statuses = () => rows(deps, 'compliance_records').map((r) => r.status);

  assert.deepEqual(plain(core.processDailyBatch(deps, true)), { status: 'continues', processed: 10 });
  assert.deepEqual(statuses().slice(0, 12), [...Array(10).fill('expired'), 'compliant', 'compliant']);
  assert.deepEqual(plain(deps.cursor.get()), {
    date: '2026-10-08', after: 10, projects: { 'PRJ-001': { checked: 10, changed: 10 } },
  });
  assert.deepEqual(plain(deps.timers.scheduled()), [60000]);

  assert.deepEqual(plain(core.processDailyBatch(deps, false)), { status: 'continues', processed: 10 });
  assert.equal(plain(deps.cursor.get()).after, 20);
  assert.deepEqual(plain(deps.timers.scheduled()), [60000, 60000]);

  assert.deepEqual(plain(core.processDailyBatch(deps, false)), { status: 'done', checked: 25, changed: 25 });
  assert.equal(deps.cursor.get(), null);
  assert.deepEqual(plain(deps.timers.scheduled()), [60000, 60000]);
  assert.equal(deps.timers.cleared(), 3);
  assert.equal(statuses().every((s) => s === 'expired'), true);
  assert.deepEqual(log(deps).filter((s) => s.startsWith('Daily check ran')), ['Daily check ran: 25 records checked, 25 changed.']);
});

test('a continuing run keeps the date its pass started on', () => {
  const deps = emptyProject();
  addAccepted(deps, 1, '2026-10-08');
  deps.cursor.set({ date: '2026-10-07', after: 0, projects: {} });
  on(deps, '2026-10-09');
  core.processDailyBatch(deps, false);
  assert.equal(record(deps).status, 'expiring_soon');
});

test('a run with no saved pass and nothing to continue does nothing', () => {
  const deps = emptyProject();
  addAccepted(deps, 1, '2026-10-07');
  assert.deepEqual(plain(core.processDailyBatch(deps, false)), { status: 'none' });
  assert.equal(record(deps).status, 'compliant');
});

test('the daily timer starts a fresh pass and drops an unfinished one', () => {
  const deps = emptyProject();
  addAccepted(deps, 1, '2026-10-07');
  addAccepted(deps, 2, '2026-10-07');
  deps.cursor.set({ date: '2026-10-01', after: 1, projects: {} });
  on(deps, '2026-10-08');
  assert.deepEqual(plain(core.processDailyBatch(deps, true)), { status: 'done', checked: 2, changed: 2 });
});

test('without the upload page address the job refuses, logs why, and changes nothing', () => {
  const deps = setup({ uploadBaseUrl: '' });
  acceptCertificate(deps, 1);
  on(deps, '2027-10-01');
  const before = JSON.stringify(rows(deps, 'compliance_records'));
  deps.cursor.set({ date: '2027-10-01', after: 0, projects: {} });
  assert.deepEqual(plain(core.processDailyBatch(deps, true)), { status: 'refused' });
  assert.equal(JSON.stringify(rows(deps, 'compliance_records')), before);
  assert.equal(log(deps).at(-1), 'The daily check did not run. The upload page address is not set. Set Script Property UPLOAD_BASE_URL first.');
  assert.equal(deps.cursor.get(), null);
  assert.deepEqual(plain(deps.timers.scheduled()), []);
});

test('one record that fails is logged, saves nothing, and is retried the next day while the pass reaches the next record', () => {
  const deps = emptyProject();
  addAccepted(deps, 1, '2026-10-20');
  addAccepted(deps, 2, '2026-10-20');
  on(deps, '2026-10-08');
  const working = deps.mailer;
  let calls = 0;
  deps.mailer = { send: (to, subject, body) => { calls += 1; if (calls === 1) throw new Error('Mail is down.'); working.send(to, subject, body); } };
  assert.deepEqual(plain(core.processDailyBatch(deps, true)), { status: 'done', checked: 2, changed: 1 });
  const byId = () => Object.fromEntries(rows(deps, 'compliance_records').map((r) => [r.record_id, r]));
  assert.equal(byId()['REC-001'].reminder_30d_sent, false);
  assert.equal(byId()['REC-002'].reminder_30d_sent, true);
  assert.ok(log(deps).includes('The daily check failed for this record. Mail is down.'));
  assert.equal(rows(deps, 'activity_log').filter((a) => a.record_id === 'REC-001' && a.summary === '30-day renewal reminder sent.').length, 0);
  assert.equal(deps.cursor.get(), null);

  on(deps, '2026-10-09');
  core.processDailyBatch(deps, true);
  assert.equal(byId()['REC-001'].reminder_30d_sent, true);
  assert.deepEqual(plain(working.sent()).map((m) => m.to), ['sub002@example.com', 'sub001@example.com']);
});

test('a Sheet built before the calendar column existed gets the column, and the event ID is kept, not re-created every day', () => {
  const deps = emptyProject();
  addAccepted(deps, 1, '2027-03-31');
  const state = deps.store.snapshot();
  state.tabs.certificates = state.tabs.certificates.filter((c) => c !== 'calendar_event_id');
  state.rows.certificates.forEach((r) => { delete r.calendar_event_id; });

  core.processDailyBatch(deps, true);
  core.processDailyBatch(deps, true);
  assert.equal(plain(deps.store.snapshot().tabs).certificates.at(-1), 'calendar_event_id');
  assert.deepEqual(plain(deps.calendar.events()).map((e) => e.id), ['EVT-1']);
  assert.equal(cert(deps, 'CERT-001').calendar_event_id, 'EVT-1');
});
