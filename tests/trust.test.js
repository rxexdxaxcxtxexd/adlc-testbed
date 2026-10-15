// Data trust checks: expected vs. received per subcontractor, and the reconciliation check.
// Fixtures are small and written here, not the demo portfolio.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGsRaw, plain } = require('./load-gs');

const c = loadGsRaw(['expectedVsReceived', 'reconcile', 'trustView', 'portfolioView', 'paymentHoldList', 'FakeStore', 'FakeClock', 'initProject']);

const row = (over) => ({
  project_id: 'P1', sub_id: 'S1', sub_name: 'Alder Roofing', accountant_name: 'Ana Reyes', closed: false,
  status: 'compliant', current_certificate_id: 'C1', queued_certificate_id: '', ...over,
});

test('expected vs received: one sub with a missing certificate has a gap of 1 and a named person', () => {
  const rows = [
    row({}),
    row({ project_id: 'P2', accountant_name: 'Ben Cho', status: 'awaiting', current_certificate_id: '' }),
    row({ sub_id: 'S2', sub_name: 'Birch Paving' }),
  ];
  assert.deepEqual(plain(c.expectedVsReceived(rows)), [
    { sub_id: 'S1', sub_name: 'Alder Roofing', expected: 2, received: 1, gap: 1, responsible_role: 'Accountant', responsible: ['Ben Cho'] },
    { sub_id: 'S2', sub_name: 'Birch Paving', expected: 1, received: 1, gap: 0, responsible_role: 'Accountant', responsible: [] },
  ]);
});

test('expected vs received: a certificate in the review queue counts as received; a closed record is left out', () => {
  const rows = [
    row({ status: 'in_review', current_certificate_id: '', queued_certificate_id: 'C9' }),
    row({ project_id: 'P2', closed: true, current_certificate_id: '' }),
  ];
  assert.deepEqual(plain(c.expectedVsReceived(rows)), [
    { sub_id: 'S1', sub_name: 'Alder Roofing', expected: 1, received: 1, gap: 0, responsible_role: 'Accountant', responsible: [] },
  ]);
});

test('expected vs received: a record whose newest certificate is expired is not received, and names the accountant', () => {
  const rows = [
    row({ status: 'expired' }),
    row({ sub_id: 'S2', sub_name: 'Birch Paving', status: 'compliant', current_expired: true, accountant_name: 'Ben Cho' }),
    row({ sub_id: 'S3', sub_name: 'Cedar Masonry', status: 'expired', current_certificate_id: 'C3', queued_certificate_id: 'C4' }),
  ];
  assert.deepEqual(plain(c.expectedVsReceived(rows)), [
    { sub_id: 'S1', sub_name: 'Alder Roofing', expected: 1, received: 0, gap: 1, responsible_role: 'Accountant', responsible: ['Ana Reyes'] },
    { sub_id: 'S2', sub_name: 'Birch Paving', expected: 1, received: 0, gap: 1, responsible_role: 'Accountant', responsible: ['Ben Cho'] },
    { sub_id: 'S3', sub_name: 'Cedar Masonry', expected: 1, received: 1, gap: 0, responsible_role: 'Accountant', responsible: [] },
  ]);
});

test('expected vs received: two gap records with the same accountant list that person once', () => {
  const rows = [
    row({ status: 'awaiting', current_certificate_id: '' }),
    row({ project_id: 'P2', status: 'awaiting', current_certificate_id: '' }),
    row({ project_id: 'P3', status: 'awaiting', current_certificate_id: '', accountant_name: 'Ben Cho' }),
  ];
  assert.deepEqual(plain(c.expectedVsReceived(rows)), [
    { sub_id: 'S1', sub_name: 'Alder Roofing', expected: 3, received: 0, gap: 3, responsible_role: 'Accountant', responsible: ['Ana Reyes', 'Ben Cho'] },
  ]);
});

test('expected vs received: no rows gives an empty list', () => {
  assert.deepEqual(plain(c.expectedVsReceived([])), []);
});

const source = () => [
  row({ sub_id: 'S1' }),
  row({ sub_id: 'S2', status: 'expiring_soon' }),
  row({ sub_id: 'S3', status: 'expired' }),
  row({ sub_id: 'S4', status: 'awaiting', current_certificate_id: '' }),
  row({ sub_id: 'S5', closed: true, status: 'expired' }),
];
const counts = { expected_count: 4, compliant_count: 2, expired_count: 1, expiring_30d_count: 1 };
const clock = c.FakeClock('2026-10-08', '2026-10-08T10:00:00');

test('reconcile: matching counts pass, with the run time from the clock', () => {
  assert.deepEqual(plain(c.reconcile(source(), counts, clock)), {
    pass: true, mismatches: [], checked_at: '2026-10-08T10:00:00',
  });
});

test('reconcile: change one source row and the check fails naming that count; restore it and it passes', () => {
  const changed = source();
  changed[0].status = 'expired';
  assert.deepEqual(plain(c.reconcile(changed, counts, clock)), {
    pass: false,
    mismatches: [
      { count: 'compliant_count', expected: 1, actual: 2 },
      { count: 'expired_count', expected: 2, actual: 1 },
    ],
    checked_at: '2026-10-08T10:00:00',
  });
  changed[0].status = 'compliant';
  assert.equal(c.reconcile(changed, counts, clock).pass, true);
});

// One test per count: the dashboard shows one more than the recount, so exactly that count fails.
[
  ['expected_count', { expected_count: 5, compliant_count: 2, expired_count: 1, expiring_30d_count: 1 }, { count: 'expected_count', expected: 4, actual: 5 }],
  ['compliant_count', { expected_count: 4, compliant_count: 3, expired_count: 1, expiring_30d_count: 1 }, { count: 'compliant_count', expected: 2, actual: 3 }],
  ['expired_count', { expected_count: 4, compliant_count: 2, expired_count: 2, expiring_30d_count: 1 }, { count: 'expired_count', expected: 1, actual: 2 }],
  ['expiring_30d_count', { expected_count: 4, compliant_count: 2, expired_count: 1, expiring_30d_count: 2 }, { count: 'expiring_30d_count', expected: 1, actual: 2 }],
].forEach(([name, dashboard, mismatch]) => {
  test('reconcile: a dashboard figure that differs on ' + name + ' fails naming only that count', () => {
    assert.deepEqual(plain(c.reconcile(source(), dashboard, clock)), {
      pass: false, mismatches: [mismatch], checked_at: '2026-10-08T10:00:00',
    });
  });
});

test('reconcile: dollars on hold that differ from the recount from pay applications fail with both amounts', () => {
  const dashboard = { ...counts, dollars_on_hold_usd: 9050 };
  assert.deepEqual(plain(c.reconcile(source(), dashboard, clock, 6250)), {
    pass: false, mismatches: [{ count: 'dollars_on_hold_usd', expected: 6250, actual: 9050 }], checked_at: '2026-10-08T10:00:00',
  });
  assert.equal(c.reconcile(source(), { ...counts, dollars_on_hold_usd: 6250 }, clock, 6250).pass, true);
});

test('reconcile: an expiring record with a renewal in the queue is not counted as expiring', () => {
  const rows = [row({ status: 'expiring_soon', queued_certificate_id: 'C2' })];
  const r = plain(c.reconcile(rows, { expected_count: 1, compliant_count: 1, expired_count: 0, expiring_30d_count: 0 }, clock));
  assert.equal(r.pass, true);
});

// trustView reads the Sheet through the store and compares with the real dashboard figures.
function sheet() {
  const store = c.FakeStore();
  c.initProject(store);
  store.appendRow('projects', { project_id: 'P1', name: 'Test Tower', review_mode: 'review_all', status: 'active', accountant_name: 'Ana Reyes' });
  store.appendRow('subcontractors', { sub_id: 'S1', name: 'Alder Roofing', scope_of_work: 'roofing' });
  store.appendRow('subcontractors', { sub_id: 'S2', name: 'Birch Paving', scope_of_work: 'paving' });
  store.appendRow('compliance_records', { record_id: 'R1', project_id: 'P1', sub_id: 'S1', status: 'compliant', current_certificate_id: 'C1', w9_on_file: true, closed: false, payment_hold: false, last_updated: '2026-10-07T08:00:00' });
  store.appendRow('compliance_records', { record_id: 'R2', project_id: 'P1', sub_id: 'S2', status: 'awaiting', w9_on_file: true, closed: false, payment_hold: false, last_updated: '2026-10-07T09:00:00' });
  // Left out: an inactive project, and a closed record with a newer last_updated.
  store.appendRow('projects', { project_id: 'P9', name: 'Old Depot', review_mode: 'review_all', status: 'archived', accountant_name: 'Zed Old' });
  store.appendRow('subcontractors', { sub_id: 'S3', name: 'Cedar Masonry', scope_of_work: 'masonry' });
  store.appendRow('compliance_records', { record_id: 'R3', project_id: 'P9', sub_id: 'S3', status: 'expired', current_certificate_id: 'C3', w9_on_file: true, closed: false, payment_hold: false, last_updated: '2026-10-07T23:00:00' });
  store.appendRow('compliance_records', { record_id: 'R4', project_id: 'P1', sub_id: 'S1', status: 'compliant', current_certificate_id: 'C4', w9_on_file: true, closed: true, payment_hold: false, last_updated: '2026-10-07T12:00:00' });
  store.appendRow('certificates', { certificate_id: 'C1', record_id: 'R1', expiration_date: '2027-06-30', check_result: 'pass', deficiencies: '[]' });
  return { store, clock: c.FakeClock('2026-10-08', '2026-10-08T10:00:00') };
}

test('trustView: both results with source and last updated, and the check passes on consistent data', () => {
  const v = plain(c.trustView(sheet()));
  assert.equal(v.reconciliation.pass, true);
  assert.equal(v.reconciliation.checked_at, '2026-10-08T10:00:00');
  assert.deepEqual(v.expected_vs_received.rows.map((r) => [r.sub_name, r.expected, r.received, r.gap, r.responsible]),
    [['Alder Roofing', 1, 1, 0, []], ['Birch Paving', 1, 0, 1, ['Ana Reyes']]]);
  assert.equal(v.expected_vs_received.source, 'compliance_records, subcontractors, projects');
  assert.equal(v.expected_vs_received.last_updated, '2026-10-07T09:00:00');
  assert.equal(v.reconciliation.source, 'compliance_records, certificates');
  assert.equal(v.reconciliation.last_updated, '2026-10-07T09:00:00');
  assert.equal(v.reconciliation.daily_job_last_ran, '');
  assert.equal(v.sample, 'Sample data');
});

test('trustView: daily_job_last_ran is the newest daily_check row, and not a later row of another type', () => {
  const deps = sheet();
  const log = (time, event_type) => deps.store.appendRow('activity_log', { record_id: 'P1', time, who: 'System', event_type, summary: 'x' });
  log('2026-10-06T06:00:10', 'daily_check');
  log('2026-10-07T06:00:42', 'daily_check');
  log('2026-10-07T23:00:00', 'status_change');
  assert.equal(plain(c.trustView(deps)).reconciliation.daily_job_last_ran, '2026-10-07T06:00:42');
});

test('trustView: a stored status that disagrees with the dashboard fails the check and names the count', () => {
  const deps = sheet();
  // The stored status says compliant, but the certificate expired in 2026: the dashboard derives expired.
  deps.store.updateRow('certificates', 'certificate_id', 'C1', { expiration_date: '2026-10-01' });
  const v = plain(c.trustView(deps));
  assert.equal(v.reconciliation.pass, false);
  assert.deepEqual(v.reconciliation.mismatches, [
    { count: 'compliant_count', expected: 1, actual: 0 },
    { count: 'expired_count', expected: 0, actual: 1 },
  ]);
  deps.store.updateRow('certificates', 'certificate_id', 'C1', { expiration_date: '2027-06-30' });
  assert.equal(c.trustView(deps).reconciliation.pass, true);
});

test('trustView: a record whose certificate expired is a gap with the accountant named, from the live date', () => {
  const deps = sheet();
  deps.store.updateRow('certificates', 'certificate_id', 'C1', { expiration_date: '2026-10-01' });
  const v = plain(c.trustView(deps));
  assert.deepEqual(v.expected_vs_received.rows.map((r) => [r.sub_name, r.expected, r.received, r.gap, r.responsible]),
    [['Alder Roofing', 1, 0, 1, ['Ana Reyes']], ['Birch Paving', 1, 0, 1, ['Ana Reyes']]]);
});

// Dollars on hold: the sheet() fixture plus pay applications. Pay dates: 2026-10-15 is current, 2026-10-30 is later.
function heldSheet() {
  const deps = sheet();
  deps.store.updateRow('compliance_records', 'record_id', 'R2', { payment_hold: true, payment_hold_reasons: '["No certificate received"]' });
  const pay = (project_id, sub_id, pay_cycle, amount_billed_usd) => deps.store.appendRow('pay_applications', { project_id, sub_id, pay_cycle, amount_billed_usd });
  pay('P1', 'S2', '2026-10-15', 6250);
  pay('P1', 'S2', '2026-10-30', 999);   // not the current cycle
  pay('P1', 'S1', '2026-10-15', 3100);  // S1 is not on hold
  pay('P9', 'S3', '2026-10-15', 500);   // inactive project
  pay('P1', 'S2', '2026-10-01', 70);    // past cycle
  return deps;
}

test('trustView: dollars on hold match the recount from pay applications ($6,250), so the check passes', () => {
  const v = plain(c.trustView(heldSheet()));
  assert.equal(v.reconciliation.pass, true);
  assert.deepEqual(v.reconciliation.mismatches, []);
});

test('trustView: a second held record for the same sub counts the bill once, so the dashboard shows $6,250 and the check passes', () => {
  const deps = heldSheet();
  deps.store.appendRow('compliance_records', { record_id: 'R5', project_id: 'P1', sub_id: 'S2', status: 'awaiting', w9_on_file: true, closed: false, payment_hold: true, payment_hold_reasons: '["W-9 not on file"]', last_updated: '2026-10-07T09:30:00' });
  const v = plain(c.trustView(deps));
  assert.deepEqual(v.reconciliation.mismatches, []);
  assert.equal(v.reconciliation.pass, true);
  assert.equal(plain(c.portfolioView(deps)).totals.dollars_on_hold_usd, 6250);
});

test('paymentHoldList: a sub with two held records is one row with the bill once and every reason', () => {
  const deps = heldSheet();
  deps.store.appendRow('compliance_records', { record_id: 'R5', project_id: 'P1', sub_id: 'S2', status: 'awaiting', w9_on_file: false, closed: false, payment_hold: true, payment_hold_reasons: '["No certificate received","W-9 not on file"]', last_updated: '2026-10-07T09:30:00' });
  const list = plain(c.paymentHoldList(deps, 'P1'));
  assert.deepEqual(list.rows, [{ record_id: 'R2', subcontractor: 'Birch Paving', amount: '$6,250', amount_usd: 6250,
    reasons: ['No certificate received', 'W-9 not on file'] }]);
  assert.equal(list.total_usd, 6250);
  assert.equal(list.last_updated, '2026-10-07T09:30:00');
});

// Ticket B: AI reading cost on Data trust. Costs are hand-picked so the sums are easy to check.
const ai = loadGsRaw(['aiCostSummary']);
const call = (over) => ({ call_id: 'x', time: '2026-10-05T09:00:00', purpose: 'read', model: 'gemini-3.5-flash-lite',
  input_tokens: 1700, output_tokens: 300, thinking_tokens: 0, cost_usd: 0.002, outcome: 'ok', ...over });

test('AI cost: this month only, all purposes in spend and count, reads only in per certificate', () => {
  const rows = [
    call({}),
    call({ time: '2026-10-09T15:00:00', cost_usd: 0.004 }),
    call({ time: '2026-10-10T08:00:00', purpose: 'calibration', cost_usd: 0.001 }),
    call({ time: '2026-09-30T23:59:00', cost_usd: 0.5 }),
  ];
  assert.deepEqual(plain(ai.aiCostSummary(rows, '2026-10-10')), {
    month: '2026-10', ai_spend_month_usd: 0.007, ai_calls_month: 3, ai_cost_per_certificate_usd: 0.003, price_unknown: false,
    source: 'ai_calls', last_updated: '2026-10-10T08:00:00',
  });
});

test('AI cost: a blank cost in the window makes spend and per certificate unknown, never $0', () => {
  const rows = [call({}), call({ time: '2026-10-06T09:00:00', model: 'some-other-model', cost_usd: '' })];
  const out = plain(ai.aiCostSummary(rows, '2026-10-10'));
  assert.equal(out.ai_spend_month_usd, null);
  assert.equal(out.ai_cost_per_certificate_usd, null);
  assert.equal(out.ai_calls_month, 2);
  assert.equal(out.price_unknown, true);
});

test('AI cost: a blank cost last month does not touch this month', () => {
  const rows = [call({}), call({ time: '2026-09-06T09:00:00', cost_usd: '' })];
  const out = plain(ai.aiCostSummary(rows, '2026-10-10'));
  assert.equal(out.ai_spend_month_usd, 0.002);
  assert.equal(out.price_unknown, false);
  assert.equal(out.last_updated, '2026-10-05T09:00:00');
});

test('AI cost: no calls gives zero spend, zero calls and no per certificate figure', () => {
  assert.deepEqual(plain(ai.aiCostSummary([], '2026-10-10')), {
    month: '2026-10', ai_spend_month_usd: 0, ai_calls_month: 0, ai_cost_per_certificate_usd: null, price_unknown: false,
    source: 'ai_calls', last_updated: '',
  });
});

test('AI cost: sums round to a millionth of a dollar, so 40 calls at 0.00126 show 0.0504', () => {
  const rows = Array.from({ length: 40 }, () => call({ cost_usd: 0.00126 }));
  const out = plain(ai.aiCostSummary(rows, '2026-10-10'));
  assert.equal(out.ai_spend_month_usd, 0.0504);
  assert.equal(out.ai_cost_per_certificate_usd, 0.00126);
});

test('trustView: ai_cost carries the three figures, the source tab and the newest call time', () => {
  const deps = sheet();
  deps.store.appendRow('ai_calls', call({ call_id: 'A1', time: '2026-10-07T11:00:00', cost_usd: 0.00135 }));
  deps.store.appendRow('ai_calls', call({ call_id: 'A2', time: '2026-10-08T09:30:00', cost_usd: 0.00125 }));
  assert.deepEqual(plain(c.trustView(deps)).ai_cost, {
    month: '2026-10', ai_spend_month_usd: 0.0026, ai_calls_month: 2, ai_cost_per_certificate_usd: 0.0013, price_unknown: false,
    source: 'ai_calls', last_updated: '2026-10-08T09:30:00',
  });
});

test('trustView: a Sheet built before the ai_calls tab existed gives ai_cost null, and the rest still works', () => {
  const deps = sheet();
  const readRows = deps.store.readRows;
  deps.store.readRows = (tab) => { if (tab === 'ai_calls') throw new Error('No Sheet tab named ai_calls. Run setupDemo first.'); return readRows(tab); };
  const v = plain(c.trustView(deps));
  assert.equal(v.ai_cost, null);
  assert.equal(v.reconciliation.pass, true);
});
