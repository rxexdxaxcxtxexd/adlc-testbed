// Data trust checks (docs/metric-definitions.md, "Data trust checks"). Read-only.

// Placeholder: no repo source names who chases a missing certificate (docs/decisions.md, Phase 5).
var TRUST_GAP_ROLE = 'Accountant';
var TRUST_COUNTS = ['expected_count', 'compliant_count', 'expired_count', 'expiring_30d_count', 'dollars_on_hold_usd'];

// rows: one object per compliance record with project_id, sub_id, sub_name, accountant_name, closed,
// current_certificate_id, queued_certificate_id and current_expired (true when the current certificate's
// expiration date is before today; when absent, the stored status 'expired' is used).
// A record whose newest certificate is expired is not received. A certificate in the review queue is newer
// than the current one, so a queued renewal counts as received.
// Returns one entry per subcontractor, in first-seen order.
function expectedVsReceived(rows) {
  var order = [], bySub = {};
  rows.forEach(function (r) {
    if (r.closed === true) return;
    var s = bySub[r.sub_id];
    if (!s) {
      s = bySub[r.sub_id] = { sub_id: r.sub_id, sub_name: r.sub_name, expected: 0, received: 0, gap: 0,
        responsible_role: TRUST_GAP_ROLE, responsible: [] };
      order.push(r.sub_id);
    }
    s.expected += 1;
    var expired = r.current_expired !== undefined ? r.current_expired === true : r.status === 'expired';
    if (r.queued_certificate_id || (r.current_certificate_id && !expired)) {
      s.received += 1;
    } else if (r.accountant_name && s.responsible.indexOf(r.accountant_name) < 0) {
      s.responsible.push(r.accountant_name);
    }
    s.gap = s.expected - s.received;
  });
  return order.map(function (id) { return bySub[id]; });
}

// Stored status vs live dashboard. Recounts the dashboard figures from the stored status column, which the
// daily job writes, and compares each with dashboardCounts (derived live from the certificates).
// Each mismatch: expected = the recount, actual = the figure the dashboard shows.
// dollarsRecount is the dollars-on-hold recount from pay applications (see dollarsOnHoldRecount).
function reconcile(sourceRows, dashboardCounts, clock, dollarsRecount) {
  var open = sourceRows.filter(function (r) { return r.closed !== true; });
  function count(test) { return open.filter(test).length; }
  var recount = {
    expected_count: open.length,
    compliant_count: count(function (r) { return r.status === 'compliant' || r.status === 'expiring_soon'; }),
    expired_count: count(function (r) { return r.status === 'expired'; }),
    expiring_30d_count: count(function (r) { return r.status === 'expiring_soon' && !r.queued_certificate_id; }),
    dollars_on_hold_usd: dollarsRecount
  };
  var mismatches = [];
  TRUST_COUNTS.forEach(function (name) {
    if (recount[name] !== dashboardCounts[name]) mismatches.push({ count: name, expected: recount[name], actual: dashboardCounts[name] });
  });
  return { pass: mismatches.length === 0, mismatches: mismatches, checked_at: clock.now() };
}

// Dollars on hold, recounted from source rows: the pay applications in the current pay cycle that belong to
// an open record on an active project with payment_hold set. Each pay application row counts once.
function dollarsOnHoldRecount(store, today, activeProjectIds) {
  var cycle = currentPayCycle(store, today);
  if (!cycle) return 0;
  var held = {};
  store.readRows('compliance_records').forEach(function (r) {
    if (r.closed !== true && r.payment_hold === true && activeProjectIds.indexOf(r.project_id) >= 0) held[r.project_id + '|' + r.sub_id] = true;
  });
  return store.readRows('pay_applications').reduce(function (sum, p) {
    return String(p.pay_cycle) === cycle && held[p.project_id + '|' + p.sub_id] ? sum + (Number(p.amount_billed_usd) || 0) : sum;
  }, 0);
}

// AI cost (docs/metric-definitions.md, Data trust checks). rows: the ai_calls tab. The window is the calendar
// month of today, from the time column. Spend and calls count every purpose; per certificate counts reads only.
// A blank cost_usd in the window means an unknown price: spend and per certificate are null, never $0.
// Sums round to a millionth of a dollar.
function aiCostSummary(rows, today) {
  var month = String(today).slice(0, 7);
  var spend = 0, calls = 0, readSpend = 0, reads = 0, unknown = false, readUnknown = false, updated = '';
  rows.forEach(function (r) {
    if (String(r.time) > updated) updated = String(r.time);
    if (String(r.time).slice(0, 7) !== month) return;
    var blank = r.cost_usd === '' || r.cost_usd === null || r.cost_usd === undefined;
    var cost = blank ? 0 : Number(r.cost_usd);
    calls += 1;
    spend += cost;
    if (blank) unknown = true;
    if (r.purpose === 'read') {
      reads += 1;
      readSpend += cost;
      if (blank) readUnknown = true;
    }
  });
  function micro(n) { return Math.round(n * 1e6) / 1e6; }
  return {
    month: month,
    ai_spend_month_usd: unknown ? null : micro(spend),
    ai_calls_month: calls,
    ai_cost_per_certificate_usd: readUnknown || !reads ? null : micro(readSpend / reads),
    price_unknown: unknown,
    source: 'ai_calls', last_updated: updated
  };
}

// A Sheet built before the ai_calls tab existed has no such tab. Returns null then, and the screen leaves the figures out.
function aiCostView(store, today) {
  var rows;
  try { rows = store.readRows('ai_calls'); } catch (err) { return null; }
  return aiCostSummary(rows, today);
}

// Reads the Sheet, takes the dashboard totals from portfolioView, and returns both checks.
function trustView(deps) {
  deps = readViewDeps(deps);
  var store = deps.store;
  var active = store.readRows('projects').filter(function (p) { return p.status === 'active'; });
  var subs = store.readRows('subcontractors');
  var certs = store.readRows('certificates');
  var today = deps.clock.today();
  var rows = [], updated = '';
  active.forEach(function (p) {
    store.readRows('compliance_records').filter(function (r) { return r.project_id === p.project_id; }).forEach(function (r) {
      var sub = findRow(subs, 'sub_id', r.sub_id);
      if (r.closed !== true && String(r.last_updated) > updated) updated = String(r.last_updated);
      var cert = r.current_certificate_id ? findRow(certs, 'certificate_id', r.current_certificate_id) : null;
      var expired = !!cert && String(cert.expiration_date) < today;
      rows.push(Object.assign({}, r, { current_expired: expired, sub_name: sub ? sub.name : r.sub_id, accountant_name: p.accountant_name }));
    });
  });
  // The daily job logs a 'daily_check' row per project when its pass finishes (Daily.gs). The newest one is when it last ran.
  var dailyRan = '';
  store.readRows('activity_log').forEach(function (a) {
    if (a.event_type === 'daily_check' && String(a.time) > dailyRan) dailyRan = String(a.time);
  });
  var totals = portfolioView(deps).totals;
  return {
    expected_vs_received: { rows: expectedVsReceived(rows), responsible_role: TRUST_GAP_ROLE,
      source: 'compliance_records, subcontractors, projects', last_updated: updated },
    reconciliation: Object.assign(reconcile(rows, totals, deps.clock,
      dollarsOnHoldRecount(store, today, active.map(function (p) { return p.project_id; }))),
      { source: 'compliance_records, certificates', last_updated: updated, daily_job_last_ran: dailyRan }),
    ai_cost: aiCostView(store, today),
    sample: 'Sample data'
  };
}
