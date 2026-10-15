// Subcontractor directory data (ticket 18): seeded names, contacts, phones and the read function.
// Expected values are literals.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGsRaw, plain } = require('./load-gs');
const LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) };
const c = loadGsRaw(['FakeStore', 'FakeClock', 'FakeMailer', 'FakeCalendar', 'initProject', 'seedDemoPortfolio',
  'directoryRows', 'directoryView', 'portfolioView'], { LockService });

function setup() {
  let sequence = 0;
  const deps = { store: c.FakeStore(), clock: c.FakeClock('2026-10-08', '2026-10-08T10:00:00'), mailer: c.FakeMailer(),
    calendar: c.FakeCalendar(), newToken: () => 'token-' + (++sequence),
    encodePdf: (text) => Buffer.from(text).toString('base64'), uploadBaseUrl: 'https://example.test/upload' };
  c.initProject(deps.store);
  assert.equal(c.seedDemoPortfolio(deps).ok, true);
  return deps;
}

test('subcontractors tab ends with contact_name, phone and trade', () => {
  const deps = setup();
  assert.deepEqual(plain(deps.store.snapshot()).tabs.subcontractors,
    ['sub_id', 'name', 'email', 'scope_of_work', 'contact_name', 'phone', 'trade']);
});

test('the seed has 140 unique subcontractors with example.com emails and 555-01xx phones', () => {
  const subs = plain(setup().store.readRows('subcontractors'));
  assert.equal(subs.length, 140);
  assert.equal(new Set(subs.map((s) => s.name)).size, 140);
  assert.ok(subs.every((s) => /^sub-\d{3}@example\.com$/.test(s.email)));
  assert.ok(subs.every((s) => /^555-01\d\d$/.test(s.phone)));
  assert.ok(subs.every((s) => /^[A-Z][a-z]+ [A-Z][a-z]+$/.test(s.contact_name)));
  assert.ok(subs.every((s) => s.trade));
});

test('generated company names are gone and the three kept names stay', () => {
  const names = plain(setup().store.readRows('subcontractors')).map((s) => s.name);
  assert.ok(!names.some((n) => /\d-\d/.test(n)));
  ['Ridgeline Roofing LLC', 'Cedar Masonry LLC', 'Brightway Electric Inc.'].forEach((n) => assert.ok(names.includes(n), n));
  assert.equal(names[0], 'Ridgeline Roofing LLC');
  assert.equal(names[2], 'Cedar Masonry LLC');
  assert.equal(names[13], 'Brightway Electric Inc.');
});

test('neighbouring companies never share a lead word, and no name sounds like a utility', () => {
  const names = plain(setup().store.readRows('subcontractors')).map((s) => s.name);
  const lead = (n) => n.split(' ')[0];
  names.slice(1).forEach((n, i) => assert.notEqual(lead(n), lead(names[i]), names[i] + ' / ' + n));
  // No lead word returns within 20 rows.
  names.forEach((n, i) => names.slice(i + 1, i + 21).forEach((m) => assert.notEqual(lead(n), lead(m), n + ' / ' + m)));
  assert.ok(!names.some((n) => /Power|Light/.test(n)));
  assert.deepEqual(names.slice(3, 6), ['Northgate Cleaning LLC', 'Stonehaven Plumbing Inc.', 'Westbrook Roofing Co.']);
});

test('the seed is the same on every run', () => {
  assert.deepEqual(plain(setup().store.readRows('subcontractors')), plain(setup().store.readRows('subcontractors')));
});

test('phones reuse 555-0100 to 555-0199 by index', () => {
  const subs = plain(setup().store.readRows('subcontractors'));
  assert.equal(subs[0].phone, '555-0100');
  assert.equal(subs[99].phone, '555-0199');
  assert.equal(subs[100].phone, '555-0100');
});

test('trade is a readable label for scope_of_work', () => {
  const subs = plain(setup().store.readRows('subcontractors'));
  assert.deepEqual([subs[0].scope_of_work, subs[0].trade], ['roofing', 'Roofing']);
  assert.deepEqual([subs[13].scope_of_work, subs[13].trade], ['electrical', 'Electrical']);
  assert.deepEqual([subs[1].scope_of_work, subs[1].trade], ['electrical', 'Electrical']);
  assert.deepEqual([subs[2].scope_of_work, subs[2].trade], ['earthwork', 'Earthwork']);
});

test('directoryRows gives one row per subcontractor with status, certificates and last notification', () => {
  const rows = plain(c.directoryRows(setup()));
  assert.equal(rows.length, 140);
  const r1 = rows[0];
  assert.deepEqual([r1.sub_id, r1.company, r1.trade, r1.email, r1.status, r1.certificate_ids, r1.last_notification, r1.last_notification_time],
    ['SUB-001', 'Ridgeline Roofing LLC', 'Roofing', 'sub-001@example.com', 'In review', ['CERT-001'],
      'Deficiency found', '2026-10-08T10:00:00']);
  assert.deepEqual([rows[3].last_notification, rows[3].last_notification_time], ['', '']);
  assert.match(r1.contact, /^[A-Z][a-z]+ [A-Z][a-z]+$/);
  assert.match(r1.phone, /^555-01\d\d$/);
  assert.deepEqual([rows[1].status, rows[1].certificate_ids], ['Awaiting certificate', []]);
  assert.equal(rows[2].status, 'Expired');
  assert.equal(rows[3].status, 'Compliant');
  assert.deepEqual(rows[13].certificate_ids.slice().sort(), ['CERT-014', 'CERT-014-CURRENT']);
});

// New rows carry their own event_type. The summary does not matter for them.
test('last notification reads the notice event type, whatever the summary says', () => {
  const deps = setup();
  const log = (time, event_type, summary) => deps.store.appendRow('activity_log', { record_id: 'REC-004', time, who: 'System', event_type, summary });
  log('2026-10-01T09:00:00', 'notice_reminder_30d', 'Any words at all.');
  log('2026-10-03T09:00:00', 'notice_payment_hold', 'Pay check: on payment hold (Policy expired).');
  log('2026-10-04T09:00:00', 'record_created', '7-day follow-up sent.');
  const row = plain(c.directoryRows(deps))[3];
  assert.deepEqual([row.last_notification_time, row.last_notification], ['2026-10-01T09:00:00', 'Expiring in 30 days']);
});

test('last notification names the approval, duplicate and renewal notices by their glossary event', () => {
  const deps = setup();
  const log = (time, event_type) => deps.store.appendRow('activity_log', { record_id: 'REC-004', time, who: 'System', event_type, summary: 'Words that do not matter.' });
  log('2026-10-01T09:00:00', 'notice_certificate_approved');
  log('2026-10-02T09:00:00', 'notice_duplicate');
  log('2026-10-03T09:00:00', 'notice_renewal_accepted');
  log('2026-10-04T09:00:00', 'notice_payment_cleared');
  const row = plain(c.directoryRows(deps))[3];
  assert.deepEqual([row.last_notification_time, row.last_notification], ['2026-10-03T09:00:00', 'Renewal accepted']);
});

test('the seeded deficiency notice is a notice_deficiency row', () => {
  const rows = plain(setup().store.readRows('activity_log')).filter((a) => a.record_id === 'REC-001' && a.event_type === 'notice_deficiency');
  assert.deepEqual(rows.map((a) => a.summary), ['2 deficiencies found. Sent to the project manager.']);
});

// Rows logged before notices had their own event_type stay in the live Sheet. An old row counts only when its
// event_type is an old one AND its summary matches.
test('an old row counts when its event_type is an old one and its summary matches, and not otherwise', () => {
  const deps = setup();
  const log = (time, event_type, summary) => deps.store.appendRow('activity_log', { record_id: 'REC-004', time, who: 'Marcus Webb (Project manager)', event_type, summary });
  log('2026-10-02T09:00:00', 'reject', 'Rejected CERT-004. Correction request sent.');
  log('2026-10-03T09:00:00', 'reject', 'Rejected CERT-004.');
  log('2026-10-04T09:00:00', 'upload_failed', 'Correction request sent.');
  const row = plain(c.directoryRows(deps))[3];
  assert.deepEqual([row.last_notification_time, row.last_notification], ['2026-10-02T09:00:00', 'Correction request']);
});

test('last notification is the newest sent-notice entry in the activity log (old status_change rows)', () => {
  const deps = setup();
  const log = (time, summary) => deps.store.appendRow('activity_log', { record_id: 'REC-004', time, who: 'System', event_type: 'status_change', summary });
  log('2026-10-01T09:00:00', '30-day renewal reminder sent.');
  log('2026-10-05T09:00:00', '7-day follow-up sent.');
  log('2026-10-06T09:00:00', 'Pay check: on payment hold (no certificate).');
  const row = plain(c.directoryRows(deps))[3];
  assert.deepEqual([row.last_notification_time, row.last_notification], ['2026-10-05T09:00:00', 'Expiring in 7 days']);
});

test('directoryView counts 140 subcontractors and 135 compliant (expiring soon included), and says Sample data', () => {
  const view = plain(c.directoryView(setup()));
  assert.equal(view.rows.length, 140);
  assert.deepEqual([view.subcontractor_count, view.directory_compliant_count, view.sample, view.source], [140, 135, 'Sample data', 'subcontractors']);
});

test('directoryView uses directory_compliant_count, not the dashboard key compliant_count', () => {
  const view = plain(c.directoryView(setup()));
  assert.equal(view.compliant_count, undefined);
  assert.equal(view.directory_compliant_count, 135);
});

// A sub on two projects shows the worst status across its open records, whatever the order.
function addRecord(deps, recordId, projectId, subId, extra, expiry, closed) {
  deps.store.appendRow('compliance_records', Object.assign({ record_id: recordId, project_id: projectId, sub_id: subId, status: 'awaiting',
    payment_hold: false, payment_hold_reasons: '[]', w9_on_file: true, closed: !!closed, last_updated: '2026-10-08T10:00:00' }, extra));
  if (expiry) deps.store.appendRow('certificates', { certificate_id: 'CERT-' + recordId, record_id: recordId, expiration_date: expiry, check_result: 'pass', deficiencies: '[]', insured_name: 'X' });
}

test('directory status is the worst across open records: compliant here and expired there shows Expired', () => {
  const deps = setup();
  addRecord(deps, 'REC-X1', 'PRJ-002', 'SUB-004', { current_certificate_id: 'CERT-REC-X1' }, '2026-09-01');
  const rows = plain(c.directoryRows(deps));
  assert.equal(rows[3].status, 'Expired');
});

test('directory status is the worst whichever record comes first: expired then compliant shows Expired', () => {
  const deps = setup();
  addRecord(deps, 'REC-X2', 'PRJ-002', 'SUB-003', { current_certificate_id: 'CERT-REC-X2' }, '2027-12-31');
  assert.equal(plain(c.directoryRows(deps))[2].status, 'Expired');
});

test('directory status: awaiting is worse than compliant, and a closed record is ignored', () => {
  const deps = setup();
  addRecord(deps, 'REC-X3', 'PRJ-002', 'SUB-005', {});
  addRecord(deps, 'REC-X4', 'PRJ-003', 'SUB-006', { current_certificate_id: 'CERT-REC-X4' }, '2026-09-01', true);
  const rows = plain(c.directoryRows(deps));
  assert.equal(rows[4].status, 'Awaiting certificate');
  assert.equal(rows[5].status, 'Compliant');
});

test('directory status: in review is worse than expiring soon, and expiring soon is worse than compliant', () => {
  const deps = setup();
  addRecord(deps, 'REC-X5', 'PRJ-002', 'SUB-007', { current_certificate_id: 'CERT-REC-X5' }, '2026-10-20');
  addRecord(deps, 'REC-X6', 'PRJ-003', 'SUB-007', { queued_certificate_id: 'CERT-REC-X6' }, '2027-12-31');
  addRecord(deps, 'REC-X7', 'PRJ-002', 'SUB-008', { current_certificate_id: 'CERT-REC-X7' }, '2026-10-20');
  const rows = plain(c.directoryRows(deps));
  assert.equal(rows[6].status, 'In review');
  assert.equal(rows[7].status, 'Expiring soon');
});

test('portfolio figures are unchanged: Maple Court 32 of 35, 1 expired, $6,250 on hold', () => {
  const maple = plain(c.portfolioView(setup())).projects[0];
  assert.deepEqual([maple.compliant_count, maple.expected_count, maple.expired_count, maple.dollars_on_hold_usd], [32, 35, 1, 6250]);
});

test('the single sample subcontractor has a contact, a 555-01xx phone and a trade', () => {
  const { SAMPLE_SUB } = require('./load-gs').loadGs(['SAMPLE_SUB']);
  assert.deepEqual(SAMPLE_SUB, { sub_id: 'SUB-001', name: 'Ridgeline Roofing LLC', email: 'ridgeline@example.com',
    scope_of_work: 'roofing', contact_name: 'Jordan Ellis', phone: '555-0142', trade: 'Roofing' });
});
