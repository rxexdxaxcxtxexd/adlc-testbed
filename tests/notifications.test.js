// Notification log (ticket 19). Seen through notificationLog with the fake Store and Clock.
// The log reports what the code does. An email the code sends shows "Sent" or "Waiting for approval". A planned
// email that no code sends shows "Not sent" with the approval "Not built yet".
// Today is Thursday 2026-10-08. Expected values are literals.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGsRaw, plain } = require('./load-gs');
const LockService = { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) };
const PropertiesService = { getScriptProperties: () => ({ getProperty: () => null }) };
const c = loadGsRaw(['FakeStore', 'FakeClock', 'FakeMailer', 'FakeCalendar', 'FakeCursor', 'FakeTimers', 'initProject', 'seedDemoPortfolio',
  'notificationLog', 'reviewAction', 'processDailyBatch', 'noticeTypeOf', 'nextStatus', 'saveRecord', 'loadRecord', 'TOLERANCE_MATRIX', 'storeDraft', 'draftRows'], { LockService, PropertiesService });

function setup() {
  let sequence = 0;
  const deps = { store: c.FakeStore(), clock: c.FakeClock('2026-10-08', '2026-10-08T10:00:00'), mailer: c.FakeMailer(),
    calendar: c.FakeCalendar(), cursor: c.FakeCursor(), timers: c.FakeTimers(), newToken: () => 'token-' + (++sequence),
    encodePdf: (text) => Buffer.from(text).toString('base64'), uploadBaseUrl: 'https://example.test/upload' };
  c.initProject(deps.store);
  assert.equal(c.seedDemoPortfolio(deps).ok, true);
  return deps;
}

const log = (deps) => plain(c.notificationLog(deps));
const find = (rows, event, recordId, toRole) => rows.find((r) => r.event === event && (!recordId || r.record_id === recordId) && (!toRole || r.to_role === toRole));

test('the log has the fixed fields, the event list, the banner and 16 rows with the seeded data', () => {
  const out = log(setup());
  assert.deepEqual(out.events, ['Certificate received', 'Deficiency found', 'Low-confidence reading', 'Expiring in 30 days',
    'Expiring in 7 days', 'Payment hold notice', 'Renewal accepted', 'COI Sub-Contract Payment Holds - Digest', 'Upload link',
    'Resend request', 'Correction request', 'Certificate approved', 'Duplicate notice', 'Cleared for payment notice']);
  assert.equal(out.source, 'activity_log, compliance_records, certificates, subcontractors, projects');
  assert.equal(out.sample, 'Sample data');
  assert.equal(out.banner, 'Preview. These emails are drafted for review.');
  assert.equal(out.rows.length, 16);
  assert.equal(out.last_updated, '2026-10-08T10:00:00');
  assert.deepEqual(Object.keys(out.rows[0]), ['id', 'event_type', 'event', 'trigger', 'time', 'project_id', 'project', 'record_id', 'sub_name',
    'to_role', 'to_name', 'to_email', 'drafted_by', 'approval', 'approved_by', 'status', 'subject', 'body']);
});

// The seed sends no email, so it holds no acceptance, duplicate or cleared notice. The tests below cause each one.
test('every event in the list but the three that need an action appears at least once with the seeded data', () => {
  const out = log(setup());
  const needAction = ['Certificate approved', 'Duplicate notice', 'Cleared for payment notice'];
  for (const event of out.events.filter((e) => !needAction.includes(e))) assert.ok(out.rows.some((r) => r.event === event), event);
  for (const event of needAction) assert.ok(!out.rows.some((r) => r.event === event), event);
});

test('rows are newest first, ids run NTF-001 up, and a scheduled entry carries its drafting time', () => {
  const out = log(setup());
  assert.equal(out.rows[0].id, 'NTF-001');
  assert.equal(out.rows[15].id, 'NTF-016');
  for (let i = 1; i < out.rows.length; i++) assert.ok(out.rows[i - 1].time >= out.rows[i].time, out.rows[i].id);
  assert.equal(out.rows[15].time, '2026-09-26T06:00:00');
  assert.equal(find(out.rows, 'Expiring in 7 days').time, '2026-10-08T10:00:00');
});

function storeAiRows(deps, by) {
  const lines = { opening: 'Please review this certificate.', explanations: [
    { id: 'D1-limit', text: 'The umbrella policy is below the project amount.' },
    { id: 'D2-requirement', text: 'The firm is not shown as additional insured.' }] };
  for (const kind of ['deficiency_notice', 'correction_request']) {
    c.storeDraft(deps.store, '2026-10-08T09:00:00', { record_id: 'REC-001', certificate_id: 'CERT-001', kind: kind,
      drafted_by: by, fallback_reason: by === 'AI' ? '' : 'The model service failed (HTTP 429).', draft: by === 'AI' ? lines : null });
  }
}

test('a stored AI draft sets drafted_by to AI and the body is the assembled text; a Template row keeps today\'s text', () => {
  const deps = setup();
  storeAiRows(deps, 'AI');
  const rows = log(deps).rows;
  const pm = find(rows, 'Deficiency found', 'REC-001', 'Project manager');
  assert.equal(pm.drafted_by, 'AI');
  assert.match(pm.body, /Ridgeline Roofing LLC: Please review this certificate\.\n- Umbrella: \$1,000,000 shown, \$2,000,000 required\n  The umbrella policy is below the project amount\./);
  const correction = find(rows, 'Correction request', 'REC-001');
  assert.equal(correction.drafted_by, 'AI');
  assert.match(correction.body, /Please review this certificate\.\n- Umbrella: .*\n  The umbrella policy is below the project amount\./);
  assert.match(correction.body, /Upload it here: https:\/\/example\.com\/upload\?t=sample-link/);

  const fallback = setup();
  storeAiRows(fallback, 'Template');
  const same = find(log(fallback).rows, 'Correction request', 'REC-001');
  const none = find(log(setup()).rows, 'Correction request', 'REC-001');
  assert.equal(same.drafted_by, 'Template');
  assert.equal(same.body, none.body);
});

test('AI_DRAFTS off shows a template for an unsent stored correction without relabelling historical notices', () => {
  const deps = setup();
  storeAiRows(deps, 'AI');
  const off = loadGsRaw(['notificationLog'], {
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => key === 'AI_DRAFTS' ? 'off' : null }) },
  });
  const rows = plain(off.notificationLog(deps)).rows;
  const correction = find(rows, 'Correction request', 'REC-001');
  assert.deepEqual([correction.status, correction.drafted_by], ['Not sent', 'Template']);
  assert.match(correction.body, /Your certificate does not meet the project requirements\. Please send a corrected certificate\./);
  assert.doesNotMatch(correction.body, /Please review this certificate/);
  const historical = find(rows, 'Deficiency found', 'REC-001', 'Project manager');
  assert.equal(historical.drafted_by, 'AI');
  assert.match(historical.body, /Please review this certificate/);
});

test('an AI row that fails the check again shows Template, with the template body', () => {
  const deps = setup();
  const bad = { opening: 'Pay us $500 by Friday.', explanations: [
    { id: 'D1-limit', text: 'Fix it.' }, { id: 'D2-requirement', text: 'Fix it too.' }] };
  for (const kind of ['deficiency_notice', 'correction_request']) {
    c.storeDraft(deps.store, '2026-10-08T09:00:00', { record_id: 'REC-001', certificate_id: 'CERT-001', kind: kind,
      drafted_by: 'AI', fallback_reason: '', draft: bad });
  }
  const rows = log(deps).rows;
  const plain = log(setup()).rows;
  for (const [event, role] of [['Deficiency found', 'Project manager'], ['Correction request', undefined]]) {
    const got = find(rows, event, 'REC-001', role);
    assert.equal(got.drafted_by, 'Template', event);
    assert.equal(got.body, find(plain, event, 'REC-001', role).body, event);
  }
});

test('a deficiency goes to the project manager (sent) and the subcontractor copy is planned, not built', () => {
  const rows = log(setup()).rows;
  const pm = find(rows, 'Deficiency found', 'REC-001', 'Project manager');
  assert.deepEqual([pm.to_name, pm.to_email, pm.drafted_by, pm.approval, pm.approved_by, pm.status, pm.trigger, pm.subject],
    ['Marcus Webb', 'pm@example.com', 'Template', 'Internal, no approval', '', 'Sent', '2 deficiencies found on CERT-001',
      'Decision needed: Ridgeline Roofing LLC, Maple Court Residences']);
  assert.match(pm.body, /- Umbrella: \$1,000,000 shown, \$2,000,000 required/);
  assert.match(pm.body, /Harborline Builders compliance team$/);
  const sub = find(rows, 'Deficiency found', 'REC-001', 'Subcontractor contact');
  assert.deepEqual([sub.to_name, sub.to_email, sub.drafted_by, sub.approval, sub.approved_by, sub.status],
    ['Marcus Hartwell', 'sub-001@example.com', 'Template', 'Not built yet', '', 'Not sent']);
  assert.equal(sub.trigger, 'Planned, not built. Would send with the project manager copy. 2 deficiencies found on CERT-001');
  const correction = find(rows, 'Correction request', 'REC-001');
  assert.deepEqual([correction.status, correction.drafted_by, correction.approval], ['Not sent', 'Template', 'Person approves']);
  assert.equal(correction.approved_by, '');
  assert.match(correction.body, /Upload it here: https:\/\/example\.com\/upload\?t=sample-link/);
});

test('a low-confidence reading is a planned email to the accountant, not sent, with the whole-number percent', () => {
  const row = find(log(setup()).rows, 'Low-confidence reading');
  assert.deepEqual([row.record_id, row.to_role, row.to_name, row.approval, row.status, row.trigger],
    ['REC-037', 'Accountant', 'Dana Reyes', 'Not built yet', 'Not sent',
      'Planned, not built. Would send when a reading is below the limit. Read at 72% confidence']);
  assert.match(row.subject, /^Needs review: .+, Cedar Park Offices$/);
  assert.match(row.body, /was read at 72% confidence, below the 85% limit/);
});

test('an expiring record gives a 30-day entry and a scheduled 7-day entry', () => {
  const rows = log(setup()).rows;
  const d30 = find(rows, 'Expiring in 30 days', 'REC-036');
  assert.deepEqual([d30.trigger, d30.time, d30.drafted_by, d30.approval, d30.approved_by, d30.status],
    ['Policy expires Oct 26, 2026. The daily job sends it at its next run.', '2026-09-26T06:00:00', 'Template', 'Automatic (daily job)', '', 'Not sent']);
  const d7 = find(rows, 'Expiring in 7 days', 'REC-036');
  assert.deepEqual([d7.trigger, d7.status, d7.approval], ['Scheduled for Oct 19, 2026, 7 days before expiry', 'Not sent', 'Automatic (daily job)']);
  assert.match(d7.body, /Reminder: your policy expires Oct 26, 2026\./);
});

test('an expired record gives a payment hold notice to the accountant with the billed amount', () => {
  const row = find(log(setup()).rows, 'Payment hold notice', 'REC-003');
  assert.deepEqual([row.to_role, row.approval, row.status, row.trigger], ['Accountant', 'Internal, no approval', 'Sent', 'Pay check: Policy expired']);
  assert.match(row.body, /Billed this pay cycle: \$6,250\./);
});

test('without a logged notice, the record state still gives the deficiency and payment hold entries', () => {
  const deps = setup();
  const quiet = { clock: deps.clock, store: { readRows: (tab) => deps.store.readRows(tab).filter((r) => tab !== 'activity_log' || r.event_type === 'record_created') } };
  const rows = log(quiet).rows;
  assert.equal(rows.length, 16);
  const hold = find(rows, 'Payment hold notice', 'REC-003');
  assert.deepEqual([hold.trigger, hold.time, hold.status], ['Policy expired Sep 30, 2026', '2026-10-01T06:00:00', 'Sent']);
  assert.equal(find(rows, 'Deficiency found', 'REC-001', 'Project manager').status, 'Sent');
  assert.equal(find(rows, 'Payment hold notice', 'REC-071').trigger, 'Pay check: No W-9 on file');
});

test('a renewal waiting for approval gives a drafted Renewal accepted entry', () => {
  const row = find(log(setup()).rows, 'Renewal accepted');
  assert.deepEqual([row.record_id, row.to_role, row.status, row.approval, row.trigger],
    ['REC-014', 'Subcontractor contact', 'Waiting for approval', 'Person approves', 'Renewal passed every check; waiting for approval']);
  assert.match(row.body, /Your renewal CERT-014 is approved\. It expires [A-Z][a-z]{2} \d+, 2027\./);
});

test('the unreadable file gives a Resend request draft the accountant sends, and a new record gives a planned Upload link, not sent', () => {
  const rows = log(setup()).rows;
  const resend = find(rows, 'Resend request', 'REC-038');
  assert.deepEqual([resend.status, resend.approval, resend.body.includes('Please resend your certificate as a standard PDF. Upload it here: https://example.com/upload?t=sample-link')], ['Waiting for approval', 'Person approves', true]);
  const link = find(rows, 'Upload link', 'REC-002');
  assert.deepEqual([link.status, link.approval, link.trigger], ['Not sent', 'Not built yet', 'Planned, not built. Would send when the record is created']);
  const received = find(rows, 'Certificate received', 'REC-037');
  assert.deepEqual([received.status, received.approval, received.trigger], ['Not sent', 'Not built yet', 'Planned, not built. Would send when a certificate is uploaded']);
});

test('the digest is one planned weekly entry, not sent, Thursday 6:00 AM, to the accountants, listing the held subcontractors', () => {
  const rows = log(setup()).rows.filter((r) => r.event === 'COI Sub-Contract Payment Holds - Digest');
  assert.equal(rows.length, 1);
  const d = rows[0];
  assert.deepEqual([d.time, d.trigger, d.to_role, d.to_name, d.to_email, d.approval, d.status, d.subject, d.project, d.record_id],
    ['2026-10-08T06:00:00', 'Planned, not built. Would send weekly, Thursday 6:00 AM', 'Accountant', 'Dana Reyes', 'accountant@example.com', 'Not built yet', 'Not sent',
      'COI Sub-Contract Payment Holds - Digest: Oct 15, 2026 pay run', 'All active projects', '']);
  assert.match(d.body, /- Cedar Masonry LLC, Maple Court Residences: \$6,250\. Policy expired\./);
  assert.match(d.body, /- Quarry Bend Roofworks Inc\., Harbor View Commons: \$2,800\. No W-9 on file\./);
  assert.match(d.body, /Total on hold: \$9,050\./);
});

test('on a Saturday the digest is dated the Thursday before', () => {
  const deps = setup();
  deps.clock = c.FakeClock('2026-10-10', '2026-10-10T10:00:00');
  assert.equal(find(log(deps).rows, 'COI Sub-Contract Payment Holds - Digest').time, '2026-10-08T06:00:00');
});

test('the review mode does not change who approves: reminders are the daily job, drafts need a person, planned notices have no approval', () => {
  const deps = setup();
  for (const id of ['PRJ-001', 'PRJ-002', 'PRJ-003']) deps.store.updateRow('projects', 'project_id', id, { review_mode: 'automatic' });
  const rows = log(deps).rows;
  assert.equal(find(rows, 'Expiring in 30 days').approval, 'Automatic (daily job)');
  assert.deepEqual([find(rows, 'Resend request').approval, find(rows, 'Correction request').approval], ['Person approves', 'Person approves']);
  assert.deepEqual([find(rows, 'Certificate received', 'REC-037').approval, find(rows, 'Upload link', 'REC-002').approval,
    find(rows, 'Deficiency found', 'REC-001', 'Subcontractor contact').approval], ['Not built yet', 'Not built yet', 'Not built yet']);
  assert.equal(find(rows, 'Deficiency found', 'REC-001', 'Project manager').approval, 'Internal, no approval');
});

test('no row names an approver unless the activity log holds that person\'s action', () => {
  const rows = log(setup()).rows;
  for (const r of rows) {
    if (r.approval !== 'Person approves' || r.status !== 'Sent') assert.equal(r.approved_by, '', r.id);
  }
  assert.ok(!rows.some((r) => r.approved_by === 'Dana Reyes'));
});

test('an old notice row logged as status_change with a matching summary shows as sent by the daily job', () => {
  const deps = setup();
  deps.store.appendRow('activity_log', { record_id: 'REC-004', time: '2026-10-02T06:00:00', who: 'System', event_type: 'status_change', summary: '30-day renewal reminder sent.' });
  deps.store.appendRow('activity_log', { record_id: 'REC-005', time: '2026-10-02T06:00:00', who: 'System', event_type: 'record_created', summary: '30-day renewal reminder sent.' });
  const rows = log(deps).rows.filter((r) => r.record_id === 'REC-004' || r.record_id === 'REC-005');
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].event, rows[0].time, rows[0].status, rows[0].approval, rows[0].approved_by], ['Expiring in 30 days', '2026-10-02T06:00:00', 'Sent', 'Automatic (daily job)', '']);
});

test('noticeTypeOf names the new types, the old rows by summary and nothing else', () => {
  const t = (event_type, summary) => c.noticeTypeOf({ event_type, summary });
  assert.equal(t('notice_reminder_7d', 'anything'), 'notice_reminder_7d');
  assert.equal(t('status_change', '7-day follow-up sent.'), 'notice_reminder_7d');
  assert.equal(t('resend_requested', 'Asked the subcontractor to resend.'), 'notice_resend_request');
  assert.equal(t('reject', 'Rejected CERT-001. Correction request sent.'), 'notice_correction_request');
  assert.equal(t('pay_check', 'Pay check: on payment hold (Policy expired).'), 'notice_payment_hold');
  assert.equal(t('record_created', '7-day follow-up sent.'), '');
  assert.equal(t('status_change', 'Policy expired.'), '');
});

test('the daily job logs a reminder as notice_reminder_30d and the log then shows it as sent', () => {
  const deps = setup();
  let run = c.processDailyBatch(deps, true);
  while (run.status === 'continues') run = c.processDailyBatch(deps, false);
  assert.equal(run.status, 'done');
  const logged = plain(deps.store.readRows('activity_log')).filter((a) => a.record_id === 'REC-036' && /reminder sent/.test(a.summary));
  assert.deepEqual(logged.map((a) => a.event_type), ['notice_reminder_30d']);
  const row = find(log(deps).rows, 'Expiring in 30 days', 'REC-036');
  assert.deepEqual([row.status, row.approval, row.approved_by, row.time], ['Sent', 'Automatic (daily job)', '', '2026-10-08T10:00:00']);
  assert.equal(deps.mailer.sent().filter((m) => /Please send your renewal/.test(m.body || m.text || JSON.stringify(m))).length > 0, true);
});

test('rejecting a deficiency logs the correction request as notice_correction_request', () => {
  const deps = setup();
  assert.equal(plain(c.reviewAction(deps, 'REC-001', 'project_manager', 'reject')).ok, true);
  const logged = plain(deps.store.readRows('activity_log')).filter((a) => a.record_id === 'REC-001' && /Correction request sent/.test(a.summary));
  assert.deepEqual(logged.map((a) => [a.event_type, a.who]), [['notice_correction_request', 'Marcus Webb (Project manager)']]);
  const row = find(log(deps).rows, 'Correction request', 'REC-001');
  assert.deepEqual([row.status, row.approved_by, row.trigger], ['Sent', 'Marcus Webb (Project manager)', 'Rejected by the project manager']);
});

const logged = (deps, recordId, type) => plain(deps.store.readRows('activity_log')).filter((a) => a.record_id === recordId && a.event_type === type);

test('approving a renewal sends the email, logs notice_renewal_accepted and names the accountant who approved', () => {
  const deps = setup();
  const before = deps.mailer.sent().length;
  assert.equal(plain(c.reviewAction(deps, 'REC-014', 'accountant', 'approve')).ok, true);
  assert.equal(deps.mailer.sent().length - before, 2);
  assert.equal(logged(deps, 'REC-014', 'notice_renewal_accepted').length, 1);
  const rows = log(deps).rows.filter((r) => r.record_id === 'REC-014' && r.event === 'Renewal accepted');
  assert.equal(rows.length, 1);
  assert.deepEqual([rows[0].status, rows[0].approval, rows[0].approved_by, rows[0].trigger],
    ['Sent', 'Person approves', 'Dana Reyes (Accountant)', 'Renewal CERT-014 accepted']);
});

test('waiving a deficiency accepts the first certificate, logs notice_certificate_approved and names the project manager', () => {
  const deps = setup();
  assert.equal(plain(c.reviewAction(deps, 'REC-001', 'project_manager', 'waive', { note: 'Accepted for this job.' })).ok, true);
  assert.equal(logged(deps, 'REC-001', 'notice_certificate_approved').length, 1);
  const row = find(log(deps).rows, 'Certificate approved', 'REC-001');
  assert.deepEqual([row.status, row.approval, row.approved_by, row.to_role, row.trigger, row.body.includes('Your certificate CERT-001 is approved.')],
    ['Sent', 'Person approves', 'Marcus Webb (Project manager)', 'Subcontractor contact', 'Certificate CERT-001 accepted', true]);
});

test('an automatic acceptance logs a Certificate approved row marked Automatic (review mode), with no approver', () => {
  const deps = setup();
  const rows = deps.store.readRows('compliance_records');
  // A current certificate on a record whose subcontractor has the same scope of work as REC-002.
  const subs = deps.store.readRows('subcontractors');
  const scopeOf = (r) => subs.find((x) => x.sub_id === r.sub_id).scope_of_work;
  const wanted = scopeOf(rows.find((r) => r.record_id === 'REC-002'));
  const source = rows.find((r) => r.status === 'compliant' && scopeOf(r) === wanted);
  const good = c.loadRecord(deps.store, source, '2026-10-08').current;
  const record = c.loadRecord(deps.store, rows.find((r) => r.record_id === 'REC-002'), '2026-10-08');
  const out = c.nextStatus(record, { type: 'certificate_received', file: { id: 'CERT-002', fingerprint: 'fp-002', readable: true, confidence: 0.99, values: Object.assign({}, good.values, { insured_name: record.sub.name }) } },
    '2026-10-08', 'automatic', c.TOLERANCE_MATRIX);
  assert.equal(out.record.status, 'compliant');
  c.saveRecord(deps.store, 'REC-002', out.record, '2026-10-08T10:00:00', '', 'certificate_received');
  const row = find(log(deps).rows, 'Certificate approved', 'REC-002');
  assert.deepEqual([row.approval, row.approved_by, row.status], ['Automatic (review mode)', '', 'Sent']);
});

test('a duplicate file logs notice_duplicate and the log shows it as sent on upload', () => {
  const deps = setup();
  const row = deps.store.readRows('compliance_records').find((r) => r.record_id === 'REC-004');
  const record = c.loadRecord(deps.store, row, '2026-10-08');
  const out = c.nextStatus(record, { type: 'certificate_received', file: { id: 'CERT-004-B', fingerprint: 'sample-CERT-004', readable: true, confidence: 0.99, values: null } },
    '2026-10-08', 'review_all', c.TOLERANCE_MATRIX);
  assert.equal(plain(out.effects).length, 1);
  c.saveRecord(deps.store, 'REC-004', out.record, '2026-10-08T10:00:00', '', 'certificate_received');
  assert.equal(logged(deps, 'REC-004', 'notice_duplicate').length, 1);
  const dup = find(log(deps).rows, 'Duplicate notice', 'REC-004');
  assert.deepEqual([dup.status, dup.approval, dup.approved_by, dup.to_role, dup.trigger, dup.body.includes('We already have this certificate. No action needed.')],
    ['Sent', 'Automatic (on upload)', '', 'Subcontractor contact', 'The same file arrived twice', true]);
});

test('lifting a payment hold logs notice_payment_cleared and the log shows Cleared for payment notice to the accountant', () => {
  const deps = setup();
  assert.equal(plain(c.reviewAction(deps, 'REC-071', 'accountant', 'w9', { onFile: true })).ok, true);
  assert.equal(logged(deps, 'REC-071', 'notice_payment_cleared').length, 1);
  const row = find(log(deps).rows, 'Cleared for payment notice', 'REC-071');
  assert.deepEqual([row.status, row.approval, row.to_role, row.to_name, row.trigger],
    ['Sent', 'Internal, no approval', 'Accountant', 'Dana Reyes', 'Every payment hold reason is gone']);
});

test('building the log sends nothing and needs no Mailer, Calendar or Reader', () => {
  const deps = setup();
  const before = deps.mailer.sent().length;
  const trap = () => { throw new Error('a send path was used'); };
  const bare = { store: deps.store, clock: deps.clock, mailer: { send: trap }, calendar: { createAllDay: trap, deleteEvent: trap }, reader: { read: trap } };
  assert.equal(log(bare).rows.length, 16);
  assert.equal(deps.mailer.sent().length, before);
  assert.deepEqual(plain(deps.calendar.events()), []);
});

test('Notifications.gs and getNotifications name no Google service that sends, writes or reads a model', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'Notifications.gs'), 'utf8');
  assert.doesNotMatch(src, /Mailer|GmailApp|MailApp|DriveApp|CalendarApp|UrlFetchApp|Gemini|\.send\(|appendRow|updateRow|writeFile|writeBlob/);
  const code = fs.readFileSync(path.join(__dirname, '..', 'src', 'Code.gs'), 'utf8');
  const body = /function getNotifications\(overlay\) \{([\s\S]*?)\n\}/.exec(code)[1];
  assert.match(body, /timed\('getNotifications'/);
  assert.match(body, /notificationLog\(readViewDeps\(pageDeps\(overlay\)\)\)/);
  assert.doesNotMatch(body, /mailer|Mailer|GmailApp/);
});
