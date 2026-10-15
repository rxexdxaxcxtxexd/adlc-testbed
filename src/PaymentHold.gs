// Payment hold: which pay cycle is current, what a sub billed in it, and the payment hold list.
// The pay check itself is the pay_check event in nextStatus; the daily job runs it (docs/decisions.md, Phase 5).

// The current pay cycle is the earliest pay date that is today or later ('' when there is none).
// pay_cycle holds the pay date as YYYY-MM-DD, so plain text order is date order.
function currentPayCycle(store, today) {
  var dates = store.readRows('pay_applications')
    .map(function (p) { return String(p.pay_cycle); })
    .filter(function (d) { return d !== '' && d >= today; })
    .sort();
  return dates.length ? dates[0] : '';
}

// What one sub billed on one project in one cycle. Several rows for the same cycle add up.
function billedInCycle(store, projectId, subId, cycle) {
  if (!cycle) return 0;
  return store.readRows('pay_applications')
    .filter(function (p) { return p.project_id === projectId && p.sub_id === subId && String(p.pay_cycle) === cycle; })
    .reduce(function (sum, p) { return sum + (Number(p.amount_billed_usd) || 0); }, 0);
}

// The payment hold list for one project: every held sub who billed in the current cycle, the amount,
// every reason, the source tabs and the newest last_updated among the held records (docs/decisions.md, Phase 5).
// Largest amount first; equal amounts keep Sheet order.
function paymentHoldList(deps, projectId) {
  var store = deps.store;
  var cycle = currentPayCycle(store, deps.clock.today());
  var subName = {};
  store.readRows('subcontractors').forEach(function (s) { subName[s.sub_id] = s.name; });
  var rows = [];
  var newest = '';
  if (cycle) {
    // One row per sub: the bill is the sub's, so a sub with two held records counts it once
    // (docs/metric-definitions.md, dollars_on_hold_usd). The row opens the first held record and lists every reason.
    var rowOf = {};
    store.readRows('compliance_records').forEach(function (r) {
      if (r.project_id !== projectId || r.payment_hold !== true || r.closed === true) return;
      var amount = billedInCycle(store, projectId, r.sub_id, cycle);
      if (!amount) return;
      var reasons = JSON.parse(r.payment_hold_reasons || '[]');
      var seen = rowOf[r.sub_id];
      if (seen) {
        reasons.forEach(function (reason) { if (seen.reasons.indexOf(reason) < 0) seen.reasons.push(reason); });
      } else {
        rows.push(rowOf[r.sub_id] = {
          record_id: r.record_id, subcontractor: subName[r.sub_id] || r.sub_id, amount: formatUsd(amount), amount_usd: amount,
          reasons: reasons
        });
      }
      if (String(r.last_updated) > newest) newest = String(r.last_updated);
    });
  }
  rows = rows.map(function (row, i) { return { row: row, i: i }; })
    .sort(function (a, b) { return (b.row.amount_usd - a.row.amount_usd) || (a.i - b.i); })
    .map(function (x) { return x.row; });
  var total = rows.reduce(function (sum, row) { return sum + row.amount_usd; }, 0);
  var empty = '';
  if (!cycle) empty = 'No pay date from today on has a pay application. Nothing to hold.';
  else if (!rows.length) empty = 'No one is on payment hold for the pay date ' + cycle + '.';
  return {
    pay_date: cycle, rows: rows, total: formatUsd(total), total_usd: total,
    source: 'pay_applications, compliance_records', last_updated: newest, empty: empty, sample: 'Sample data'
  };
}
