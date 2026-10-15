// nextStatus: the six prototype scenarios, with outcomes written as literals.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadGs } = require('./load-gs');

const { nextStatus, newRecord } = loadGs(['nextStatus', 'newRecord']);
const MATRIX = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'tolerance-matrix.json'), 'utf8'));

const RIDGELINE = { name: 'Ridgeline Roofing LLC', scope: 'roofing', w9: true };
const BRIGHTWAY = { name: 'Brightway Cleaning Co.', scope: 'cleaning', w9: true };
const SUMMIT = { name: 'Summit Electric Inc.', scope: 'electrical', w9: true };

function values(sub, expiry, over) {
  return {
    insured_name: sub.name,
    limits: {
      commercial_liability: 1000000, aggregate: 2000000, auto: 1000000,
      umbrella: sub.scope === 'cleaning' ? null : 2000000, workers_comp: 1000000,
      pollution_liability: sub.scope === 'roofing' ? 1000000 : null, professional_liability: null,
    },
    additional_insured_endorsement: true, project_address: true, certificate_holder: true,
    cancellation_notice_days: 30, expiration_date: expiry,
    ...over,
  };
}

const file = (id, fingerprint, vals, confidence = 0.96) => ({ id, fingerprint, readable: true, confidence, values: vals });
const received = (f) => ({ type: 'certificate_received', file: f });

function withCurrent(sub, id, expiry, billed = 0) {
  const r = newRecord(sub, billed);
  r.current = { id, fingerprint: `fp-${id}`, received: '2025-10-20', confidence: 0.97, values: values(sub, expiry), expiration_date: expiry, decision: 'approved by the accountant', replaces: null };
  return r;
}

// Runs events in order on one record; returns every step's output.
function run(record, steps) {
  const outs = [];
  let r = record;
  for (const [event, today, mode] of steps) {
    const out = nextStatus(r, event, today, mode, MATRIX);
    outs.push(out);
    r = out.record;
  }
  return outs;
}

test('1. clean pass: review all waits for the accountant; review deficiencies accepts at once', () => {
  const [up, approve] = run(newRecord(RIDGELINE), [
    [received(file('CERT-RID-1', 'fp-r1', values(RIDGELINE, '2027-10-01'))), '2026-10-01', 'review_all'],
    [{ type: 'approve' }, '2026-10-01', 'review_all'],
  ]);
  assert.equal(up.record.status, 'in_review');
  assert.equal(up.record.pending.stage, 'approval');
  assert.deepEqual(up.effects, []);
  assert.equal(approve.record.status, 'compliant');
  assert.equal(approve.record.current.decision, 'approved by the accountant');
  assert.deepEqual(approve.effects, [
    { to: 'Subcontractor', kind: 'email', text: 'Your certificate CERT-RID-1 is approved.' },
    { to: 'Accountant', kind: 'notice', text: 'Ridgeline Roofing LLC: CERT-RID-1 filed and approved (approved by the accountant).' },
  ]);

  const [renewal] = run(withCurrent(SUMMIT, 'CERT-SUM-0', '2027-06-30'), [
    [received(file('CERT-SUM-1', 'fp-s1', values(SUMMIT, '2028-06-30'))), '2026-10-01', 'review_deficiencies'],
  ]);
  assert.equal(renewal.record.status, 'compliant');
  assert.equal(renewal.record.pending, null);
  assert.equal(renewal.record.current.id, 'CERT-SUM-1');
  assert.equal(renewal.record.current.replaces, 'CERT-SUM-0');
  assert.deepEqual(renewal.record.history.map((h) => [h.id, h.outcome]), [['CERT-SUM-0', 'Replaced by CERT-SUM-1']]);
  assert.deepEqual(renewal.effects.map((e) => e.to), ['Subcontractor', 'Accountant']);
});

test('2. a $1M umbrella against $2M goes to the project manager; reject, resend, approve', () => {
  const low = values(RIDGELINE, '2027-10-01', { limits: { ...values(RIDGELINE, '2027-10-01').limits, umbrella: 1000000 } });
  const [up, reject, resend, approve] = run(newRecord(RIDGELINE), [
    [received(file('CERT-RID-1', 'fp-r1', low)), '2026-10-01', 'review_all'],
    [{ type: 'reject' }, '2026-10-01', 'review_all'],
    [received(file('CERT-RID-2', 'fp-r2', values(RIDGELINE, '2027-10-01'))), '2026-10-02', 'review_all'],
    [{ type: 'approve' }, '2026-10-02', 'review_all'],
  ]);
  assert.equal(up.record.status, 'in_review');
  assert.equal(up.record.pending.stage, 'deficiency');
  assert.deepEqual(up.effects, [
    { to: 'Project manager', kind: 'email', text: 'Ridgeline Roofing LLC: Umbrella: $1,000,000 shown, $2,000,000 required. Waive or reject?' },
  ]);
  assert.equal(reject.record.status, 'awaiting');
  assert.deepEqual(reject.effects, [
    { to: 'Subcontractor', kind: 'email', text: 'Your certificate does not meet the project requirements. Please send a corrected certificate.\n- Umbrella: $1,000,000 shown, $2,000,000 required' },
  ]);
  assert.equal(resend.record.pending.stage, 'approval');
  assert.equal(approve.record.status, 'compliant');
  assert.deepEqual(approve.record.history.map((h) => [h.id, h.outcome]), [['CERT-RID-1', 'Rejected']]);
});

test('2b. a waived deficiency becomes the current certificate', () => {
  const low = values(RIDGELINE, '2027-10-01', { limits: { ...values(RIDGELINE, '2027-10-01').limits, umbrella: 1000000 } });
  const [, waive] = run(newRecord(RIDGELINE), [
    [received(file('CERT-RID-1', 'fp-r1', low)), '2026-10-01', 'automatic'],
    [{ type: 'waive', who: 'Sam Ortiz (Project manager)', note: 'Roofing crew works under the ground-floor slab only.' }, '2026-10-01', 'automatic'],
  ]);
  assert.equal(waive.record.status, 'compliant');
  assert.equal(waive.record.current.decision, 'waived by the project manager');
  assert.equal(waive.record.current.decision_note, 'Roofing crew works under the ground-floor slab only.');
  assert.deepEqual(waive.record.log.map((l) => [l.who, l.text]), [
    ['System', '1 deficiency found. Sent to the project manager.'],
    ['Sam Ortiz (Project manager)', 'Waived: Umbrella: $1,000,000 shown, $2,000,000 required. Note: Roofing crew works under the ground-floor slab only.'],
    ['System', 'CERT-RID-1 accepted (waived by the project manager). Expires 2027-10-01.'],
  ]);
});

test('2c. a waive with a blank note is refused and changes nothing', () => {
  const low = values(RIDGELINE, '2027-10-01', { limits: { ...values(RIDGELINE, '2027-10-01').limits, umbrella: 1000000 } });
  const [up, blank, missing] = run(newRecord(RIDGELINE), [
    [received(file('CERT-RID-1', 'fp-r1', low)), '2026-10-01', 'automatic'],
    [{ type: 'waive', note: '   ' }, '2026-10-01', 'automatic'],
    [{ type: 'waive' }, '2026-10-01', 'automatic'],
  ]);
  for (const out of [blank, missing]) {
    assert.equal(out.refused, 'A waiver needs a note. Write why this deficiency is acceptable.');
    assert.deepEqual(out.record, up.record);
    assert.deepEqual(out.effects, []);
  }
});

test('3. a low-confidence reading waits for the accountant in every mode; the correction re-runs the check', () => {
  const misread = values(RIDGELINE, '2027-10-01', { limits: { ...values(RIDGELINE, '2027-10-01').limits, umbrella: 200000 } });
  const [up, confirm] = run(newRecord(RIDGELINE), [
    [received(file('CERT-RID-1', 'fp-r1', misread, 0.62)), '2026-10-01', 'review_all'],
    [{ type: 'reading_confirmed', note: 'Checked against the PDF.', values: values(RIDGELINE, '2027-10-01') }, '2026-10-01', 'automatic'],
  ]);
  assert.equal(up.record.status, 'needs_review');
  assert.equal(up.record.pending.reason, 'Low-confidence reading (0.62, below 0.85)');
  assert.deepEqual(up.effects, []);
  assert.equal(confirm.record.status, 'compliant');
  assert.equal(confirm.record.current.decision, 'approved automatically (automatic mode)');
  assert.equal(confirm.record.current.confirmedBy, 'Accountant');

  const [auto] = run(newRecord(RIDGELINE), [[received(file('CERT-RID-1', 'fp-r1', misread, 0.62)), '2026-10-01', 'automatic']]);
  assert.equal(auto.record.status, 'needs_review');
});

test('3b. an unreadable file waits for the accountant with a resend draft', () => {
  const [up, resend] = run(newRecord(RIDGELINE), [
    [{ type: 'certificate_received', file: { id: 'CERT-RID-1', fingerprint: 'fp-r1', readable: false, confidence: 0, values: null } }, '2026-10-01', 'automatic'],
    [{ type: 'resend_requested' }, '2026-10-01', 'automatic'],
  ]);
  assert.equal(up.record.status, 'needs_review');
  assert.deepEqual(up.effects, [
    { to: 'Accountant', kind: 'draft', text: 'Draft for the subcontractor, held for you: "Please resend your certificate as a standard PDF."' },
  ]);
  assert.equal(resend.record.status, 'awaiting');
  assert.deepEqual(resend.effects, [{ to: 'Subcontractor', kind: 'email', text: 'Please resend your certificate as a standard PDF.' }]);
});

test('4. renewal after expiry in pay week: reminders, hold, and the hold lifts itself', () => {
  let r = withCurrent(BRIGHTWAY, 'CERT-BRI-0', '2026-10-20', 6250);
  const sent = [];
  for (let day = 2; day <= 21; day++) {
    const today = `2026-10-${String(day).padStart(2, '0')}`;
    const out = nextStatus(r, { type: 'day_passed' }, today, 'review_all', MATRIX);
    for (const e of out.effects) sent.push([today, e.text]);
    r = out.record;
  }
  assert.deepEqual(sent, [
    ['2026-10-02', 'Your policy expires 2026-10-20. Please send your renewal.'],
    ['2026-10-13', 'Reminder: your policy expires 2026-10-20.'],
  ]);
  assert.equal(r.status, 'expired');

  const [pay, renewal, approve] = run(r, [
    [{ type: 'pay_check' }, '2026-10-21', 'review_all'],
    [received(file('CERT-BRI-1', 'fp-b1', values(BRIGHTWAY, '2027-10-20'))), '2026-10-21', 'review_all'],
    [{ type: 'approve' }, '2026-10-21', 'review_all'],
  ]);
  assert.deepEqual(pay.record.hold, { on: true, reasons: ['Policy expired'] });
  assert.deepEqual(pay.effects, [
    { to: 'Accountant', kind: 'report', text: 'Payment hold list: Brightway Cleaning Co., $6,250. Policy expired.' },
  ]);
  assert.deepEqual(renewal.record.hold, { on: true, reasons: ['Policy expired; renewal not yet approved'] });
  assert.deepEqual(approve.record.hold, { on: false, reasons: [] });
  assert.equal(approve.record.status, 'compliant');
  assert.deepEqual(approve.effects.at(-1), { to: 'Accountant', kind: 'notice', text: 'Brightway Cleaning Co. is cleared for payment.' });
});

test('expiring soon is not a payment-hold reason (decisions.md, Phase 1)', () => {
  const [pay] = run(withCurrent(BRIGHTWAY, 'CERT-BRI-0', '2026-10-20', 6250), [[{ type: 'pay_check' }, '2026-10-07', 'review_all']]);
  assert.equal(pay.record.status, 'expiring_soon');
  assert.deepEqual(pay.record.hold, { on: false, reasons: [] });
  assert.deepEqual(pay.effects, []);
});

test('a missing W-9 holds payment even when the certificate is compliant', () => {
  const [unset, pay, set] = run(withCurrent(SUMMIT, 'CERT-SUM-0', '2027-06-30', 22900), [
    [{ type: 'w9_set', onFile: false }, '2026-10-07', 'review_all'],
    [{ type: 'pay_check' }, '2026-10-07', 'review_all'],
    [{ type: 'w9_set', onFile: true }, '2026-10-07', 'review_all'],
  ]);
  assert.equal(unset.record.hold.on, false);
  assert.deepEqual(pay.record.hold, { on: true, reasons: ['No W-9 on file'] });
  assert.deepEqual(set.record.hold, { on: false, reasons: [] });
});

test('a daily pay check that finds the same hold again sends and logs nothing', () => {
  const [first, again] = run(withCurrent(BRIGHTWAY, 'CERT-BRI-0', '2026-10-20', 6250), [
    [{ type: 'pay_check' }, '2026-10-21', 'review_all'],
    [{ type: 'pay_check' }, '2026-10-22', 'review_all'],
  ]);
  assert.equal(first.effects.length, 1);
  assert.deepEqual(again.record.hold, { on: true, reasons: ['Policy expired'] });
  assert.deepEqual(again.effects, []);
  assert.deepEqual(again.record.log, first.record.log);
});

test('a reason added while a hold is on joins the stored list without a second report', () => {
  const [pay, w9, again] = run(withCurrent(BRIGHTWAY, 'CERT-BRI-0', '2026-10-20', 6250), [
    [{ type: 'pay_check' }, '2026-10-21', 'review_all'],
    [{ type: 'w9_set', onFile: false }, '2026-10-21', 'review_all'],
    [{ type: 'pay_check' }, '2026-10-21', 'review_all'],
  ]);
  assert.deepEqual(pay.record.hold.reasons, ['Policy expired']);
  assert.deepEqual(w9.record.hold.reasons, ['Policy expired', 'No W-9 on file']);
  assert.deepEqual(again.effects, []);
});

test('a hold clears when there is no bill this cycle, and a sub with no hold and no bill logs nothing', () => {
  const [held] = run(withCurrent(BRIGHTWAY, 'CERT-BRI-0', '2026-10-20', 6250), [[{ type: 'pay_check' }, '2026-10-21', 'review_all']]);
  assert.equal(held.record.hold.on, true);

  const [cleared] = run({ ...held.record, billedThisCycle: 0 }, [[{ type: 'pay_check' }, '2026-11-05', 'review_all']]);
  assert.deepEqual(cleared.record.hold, { on: false, reasons: [] });
  assert.equal(cleared.record.log.at(-1).text, 'Payment hold cleared: no bill this cycle.');
  assert.deepEqual(cleared.effects, []);

  const [none] = run(withCurrent(BRIGHTWAY, 'CERT-BRI-0', '2026-10-20', 0), [[{ type: 'pay_check' }, '2026-10-21', 'review_all']]);
  assert.deepEqual(none.record.log, []);
  assert.deepEqual(none.effects, []);
});

test('a W-9 change is logged under the name given, and a change to the same value is refused', () => {
  const [set] = run(withCurrent(SUMMIT, 'CERT-SUM-0', '2027-06-30', 22900), [
    [{ type: 'w9_set', onFile: false, who: 'Dana Reyes (Accountant)' }, '2026-10-07', 'review_all'],
  ]);
  assert.deepEqual(set.record.log, [{ date: '2026-10-07', who: 'Dana Reyes (Accountant)', text: 'Marked W-9 missing.' }]);
  const same = nextStatus(set.record, { type: 'w9_set', onFile: false }, '2026-10-07', 'review_all', MATRIX);
  assert.equal(same.refused, 'The W-9 is already marked missing.');
  assert.deepEqual(same.effects, []);
  const onFile = nextStatus(withCurrent(SUMMIT, 'CERT-SUM-0', '2027-06-30', 0), { type: 'w9_set', onFile: true }, '2026-10-07', 'review_all', MATRIX);
  assert.equal(onFile.refused, 'The W-9 is already marked on file.');
});

test('5. a duplicate file never creates a second certificate or queue item', () => {
  const f = file('CERT-RID-1', 'fp-r1', values(RIDGELINE, '2027-10-01'));
  const dupe = { ...f, id: 'CERT-RID-2' };
  const [, again, approve, third] = run(newRecord(RIDGELINE), [
    [received(f), '2026-10-01', 'review_all'],
    [received(dupe), '2026-10-01', 'review_all'],
    [{ type: 'approve' }, '2026-10-01', 'review_all'],
    [received(dupe), '2026-10-02', 'review_all'],
  ]);
  const notice = [{ to: 'Subcontractor', kind: 'notice', text: 'We already have this certificate. No action needed.' }];
  assert.equal(again.record.pending.id, 'CERT-RID-1');
  assert.deepEqual(again.record.history, []);
  assert.deepEqual(again.effects, notice);
  assert.equal(approve.record.current.id, 'CERT-RID-1');
  assert.equal(third.record.current.id, 'CERT-RID-1');
  assert.equal(third.record.pending, null);
  assert.deepEqual(third.record.history, []);
  assert.deepEqual(third.effects, notice);
});

test('5b. a newer upload replaces one still waiting in the queue', () => {
  const [, newer] = run(newRecord(RIDGELINE), [
    [received(file('CERT-RID-1', 'fp-r1', values(RIDGELINE, '2027-10-01'))), '2026-10-01', 'review_all'],
    [received(file('CERT-RID-2', 'fp-r2', values(RIDGELINE, '2027-10-01'))), '2026-10-02', 'review_all'],
  ]);
  assert.equal(newer.record.pending.id, 'CERT-RID-2');
  assert.deepEqual(newer.record.history.map((h) => [h.id, h.outcome]), [['CERT-RID-1', 'Replaced in the queue by a newer upload']]);
});

test('6. moves that should be impossible are refused and change nothing', () => {
  const start = newRecord(RIDGELINE);
  const [approveNothing, up, waiveClean, closeWaiting, , close, uploadClosed] = run(start, [
    [{ type: 'approve' }, '2026-10-01', 'review_all'],
    [received(file('CERT-RID-1', 'fp-r1', values(RIDGELINE, '2027-10-01'))), '2026-10-01', 'review_all'],
    [{ type: 'waive', note: 'Acceptable.' }, '2026-10-01', 'review_all'],
    [{ type: 'close' }, '2026-10-01', 'review_all'],
    [{ type: 'approve' }, '2026-10-01', 'review_all'],
    [{ type: 'close' }, '2026-10-01', 'review_all'],
    [received(file('CERT-RID-2', 'fp-r2', values(RIDGELINE, '2027-10-01'))), '2026-10-02', 'review_all'],
  ]);
  assert.equal(approveNothing.refused, 'Nothing is waiting for approval. A deficiency needs a waive or reject from the project manager instead.');
  assert.deepEqual(approveNothing.record, start);
  assert.equal(waiveClean.refused, 'There is no deficiency waiting for a decision.');
  assert.deepEqual(waiveClean.record, up.record);
  assert.equal(closeWaiting.refused, 'A certificate is waiting in the queue. Decide it first, then close the record.');
  assert.equal(close.record.status, 'closed');
  assert.equal(uploadClosed.refused, 'This record is closed. The upload is refused.');
  assert.equal(uploadClosed.record.current.id, 'CERT-RID-1');
});

// Ticket 05: named actors, per-value correction lines, resend link.
const DANA = 'Dana Reyes (Accountant)';
const lowReading = () => file('CERT-1', 'fp-low', values(RIDGELINE, '2027-09-30', { limits: { ...values(RIDGELINE).limits, umbrella: 1000000 } }), 0.7);
const confirm = (vals) => ({ type: 'reading_confirmed', who: DANA, note: 'Checked against the PDF.', values: vals });

test('T1. a correction logs one line per changed value, old to new, under the named person', () => {
  const corrected = values(RIDGELINE, '2027-09-30', { project_address: true });
  const wrong = { ...lowReading(), values: { ...lowReading().values, project_address: false } };
  const outs = run(newRecord(RIDGELINE), [
    [received(wrong), '2026-10-07', 'review_all'],
    [confirm(corrected), '2026-10-07', 'review_all'],
  ]);
  assert.deepEqual(outs[1].record.log.filter((e) => e.who === DANA), [
    { date: '2026-10-07', who: DANA, text: 'Changed Umbrella from $1,000,000 to $2,000,000 on CERT-1. Note: Checked against the PDF.' },
    { date: '2026-10-07', who: DANA, text: 'Changed Project address from Not printed to Printed on CERT-1. Note: Checked against the PDF.' },
  ]);
  assert.equal(outs[1].record.pending.stage, 'approval');
});

test('T2. confirming a reading with no changes says so', () => {
  const outs = run(newRecord(RIDGELINE), [
    [received(file('CERT-1', 'fp-low', values(RIDGELINE, '2027-09-30'), 0.7)), '2026-10-07', 'review_all'],
    [confirm(values(RIDGELINE, '2027-09-30')), '2026-10-07', 'review_all'],
  ]);
  assert.deepEqual(outs[1].record.log.filter((e) => e.who === DANA), [
    { date: '2026-10-07', who: DANA, text: 'Confirmed the reading of CERT-1 with no changes. Note: Checked against the PDF.' },
  ]);
});

test('T2b. a correction that became a test sample says so on its last change line', () => {
  const corrected = values(RIDGELINE, '2027-09-30', { project_address: true });
  const wrong = { ...lowReading(), values: { ...lowReading().values, project_address: false } };
  const outs = run(newRecord(RIDGELINE), [
    [received(wrong), '2026-10-07', 'review_all'],
    [{ ...confirm(corrected), addedToTestSet: true }, '2026-10-07', 'review_all'],
  ]);
  assert.deepEqual(outs[1].record.log.filter((e) => e.who === DANA), [
    { date: '2026-10-07', who: DANA, text: 'Changed Umbrella from $1,000,000 to $2,000,000 on CERT-1. Note: Checked against the PDF.' },
    { date: '2026-10-07', who: DANA, text: 'Changed Project address from Not printed to Printed on CERT-1. Note: Checked against the PDF. Added to the test set.' },
  ]);
});

test('T2c. a note without a closing period still ends with ". Added to the test set."', () => {
  const outs = run(newRecord(RIDGELINE), [
    [received(lowReading()), '2026-10-07', 'review_all'],
    [{ ...confirm(values(RIDGELINE, '2027-09-30')), note: 'Umbrella is $2M on page 2', addedToTestSet: true }, '2026-10-07', 'review_all'],
  ]);
  assert.deepEqual(outs[1].record.log.filter((e) => e.who === DANA).map((e) => e.text), [
    'Changed Umbrella from $1,000,000 to $2,000,000 on CERT-1. Note: Umbrella is $2M on page 2. Added to the test set.',
  ]);
});

test('T3. a corrected reading is checked again and a bad value still becomes a deficiency', () => {
  const stillShort = values(RIDGELINE, '2027-09-30', { limits: { ...values(RIDGELINE).limits, umbrella: 1500000 } });
  const outs = run(newRecord(RIDGELINE), [
    [received(lowReading()), '2026-10-07', 'review_all'],
    [confirm(stillShort), '2026-10-07', 'review_all'],
  ]);
  assert.equal(outs[1].record.pending.stage, 'deficiency');
  assert.equal(outs[1].effects[0].to, 'Project manager');
});

test('T4. approval logs the named person and sends the subcontractor and the accountant one message each', () => {
  const outs = run(newRecord(RIDGELINE), [
    [received(file('CERT-1', 'fp-1', values(RIDGELINE, '2027-09-30'))), '2026-10-07', 'review_all'],
    [{ type: 'approve', who: DANA }, '2026-10-07', 'review_all'],
  ]);
  assert.deepEqual(outs[1].record.log.filter((e) => e.who === DANA), [
    { date: '2026-10-07', who: DANA, text: 'Approved CERT-1.' },
  ]);
  assert.deepEqual(outs[1].effects.map((e) => [e.to, e.kind]), [['Subcontractor', 'email'], ['Accountant', 'notice']]);
  assert.equal(outs[1].record.status, 'compliant');
});

test('T5. approve with nothing waiting is refused with a reason', () => {
  const outs = run(newRecord(RIDGELINE), [[{ type: 'approve', who: DANA }, '2026-10-07', 'review_all']]);
  assert.equal(outs[0].refused, 'Nothing is waiting for approval. A deficiency needs a waive or reject from the project manager instead.');
  assert.deepEqual(outs[0].effects, []);
});

test('T6. the resend email carries the upload link', () => {
  const unreadable = { id: 'CERT-1', fingerprint: 'fp-bad', readable: false, confidence: 0, values: null };
  const outs = run(newRecord(RIDGELINE), [
    [received(unreadable), '2026-10-07', 'review_all'],
    [{ type: 'resend_requested', who: DANA, uploadLink: 'https://example.test/exec?t=tok-1' }, '2026-10-07', 'review_all'],
  ]);
  assert.deepEqual(outs[1].effects, [
    { to: 'Subcontractor', kind: 'email', text: 'Please resend your certificate as a standard PDF. Upload it here: https://example.test/exec?t=tok-1' },
  ]);
  assert.equal(outs[1].record.log.filter((e) => e.who === DANA)[0].text, 'Asked the subcontractor to resend.');
});

const DAILY_LINK = 'https://upload.example.test/exec?t=abc';

test('the 30-day reminder carries the upload link when one is given', () => {
  const out = nextStatus(withCurrent(BRIGHTWAY, 'CERT-BRI-0', '2026-10-20'), { type: 'day_passed', uploadLink: DAILY_LINK }, '2026-10-02', 'review_all', MATRIX);
  assert.deepEqual(out.effects, [{ to: 'Subcontractor', kind: 'email', text: `Your policy expires 2026-10-20. Please send your renewal. Upload your renewal here: ${DAILY_LINK}` }]);
  assert.deepEqual(out.record.nudges, { d30: true, d7: false });
});

test('a record first seen inside 7 days gets the 7-day follow-up only, and both reminders count as sent', () => {
  const out = nextStatus(withCurrent(BRIGHTWAY, 'CERT-BRI-0', '2026-10-20'), { type: 'day_passed', uploadLink: DAILY_LINK }, '2026-10-16', 'review_all', MATRIX);
  assert.deepEqual(out.effects, [{ to: 'Subcontractor', kind: 'email', text: `Reminder: your policy expires 2026-10-20. Upload your renewal here: ${DAILY_LINK}` }]);
  assert.deepEqual(out.record.nudges, { d30: true, d7: true });
  assert.deepEqual(out.record.log.map((l) => l.text), ['7-day follow-up sent.']);
});

test('an expiry is logged even when the daily job missed the day it happened', () => {
  const r = withCurrent(BRIGHTWAY, 'CERT-BRI-0', '2026-10-20');
  r.status = 'expiring_soon';
  const out = nextStatus(r, { type: 'day_passed' }, '2026-10-23', 'review_all', MATRIX);
  assert.equal(out.record.status, 'expired');
  assert.deepEqual(out.record.log.map((l) => l.text), ['Policy expired.']);
});
