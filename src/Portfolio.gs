// Portfolio figures use the same record core and hold list as the detail page.
function latestModeChange(store, projectId) {
  var rows = store.readRows('activity_log').filter(function (r) {
    return r.record_id === projectId && r.event_type === 'review_mode_changed';
  }).sort(function (a, b) { return String(b.time).localeCompare(String(a.time)); });
  return rows.length ? { who: rows[0].who, time: rows[0].time } : null;
}

function portfolioView(deps) {
  deps = readViewDeps(deps);
  var today = deps.clock.today();
  var store = deps.store;
  var active = store.readRows('projects').filter(function (p) { return p.status === 'active'; });
  var metrics = ['expected_count', 'compliant_count', 'expired_count', 'expiring_30d_count', 'below_limits_count', 'dollars_on_hold_usd'];
  var totals = {}, updated = {};
  metrics.forEach(function (m) { totals[m] = 0; updated[m] = ''; });
  var projects = active.map(function (p) {
    var rows = store.readRows('compliance_records').filter(function (r) { return r.project_id === p.project_id && r.closed !== true; });
    var models = rows.map(function (row) { return loadRecord(store, row, today); });
    var tile = projectTile(models, today);
    var hold = paymentHoldList(deps, p.project_id);
    tile.dollars_on_hold_usd = hold.total_usd;
    tile.waiting_count = models.filter(function (m) { return !!waitingLabel(m); }).length;
    var last = {};
    metrics.forEach(function (m) { last[m] = ''; });
    rows.forEach(function (row, i) {
      var model = models[i], status = deriveStatus(model, today);
      function stamp(metric, applies) {
        if (applies && String(row.last_updated) > last[metric]) last[metric] = String(row.last_updated);
      }
      stamp('expected_count', true);
      stamp('compliant_count', isCompliantStatus(status));
      stamp('expired_count', status === 'expired');
      stamp('expiring_30d_count', status === 'expiring_soon' && !model.pending);
      stamp('below_limits_count', !!(model.pending && model.pending.check && model.pending.check.deficiencies.some(function (d) { return d.kind === 'limit'; })));
    });
    last.dollars_on_hold_usd = hold.last_updated;
    metrics.forEach(function (m) {
      totals[m] += tile[m];
      if (last[m] > updated[m]) updated[m] = last[m];
    });
    return Object.assign(tile, {
      project_id: p.project_id, name: p.name, review_mode: p.review_mode,
      staff: { accountant: p.accountant_name, project_manager: p.project_manager_name, leadership: p.leadership_name },
      last_updated: last, source: 'compliance_records, certificates',
      hold_source: hold.source, pay_date: hold.pay_date, sample: 'Sample data'
    });
  });
  return { today: today, projects: projects, totals: totals, last_updated: updated,
    source: 'compliance_records, certificates', hold_source: 'pay_applications, compliance_records', sample: 'Sample data' };
}

// Cache Sheet reads within one view request. Every figure uses the same rows.
function readViewDeps(deps) {
  var cache = {};
  return Object.assign({}, deps, { store: { readRows: function (tab) {
    if (!cache[tab]) cache[tab] = deps.store.readRows(tab);
    return cache[tab];
  } } });
}

function worklistView(deps, projectId) {
  deps = readViewDeps(deps);
  var projects = deps.store.readRows('projects').filter(function (p) {
    return projectId === 'all' ? p.status === 'active' : p.project_id === projectId;
  });
  if (!projects.length && projectId !== 'all') throw new Error('No such project.');
  var rows = [];
  projects.forEach(function (p) {
    worklistRows(deps, p.project_id).forEach(function (r) { r.project = p.name; r.project_id = p.project_id; rows.push(r); });
  });
  rows.sort(function (a, b) { return (!!b.waiting - !!a.waiting); });
  var project = projects[0];
  return { project_id: projectId, project: projectId === 'all' ? 'All active projects' : project.name,
    review_mode: projectId === 'all' ? null : project.review_mode, review_modes: REVIEW_MODES,
    mode_set: projectId === 'all' ? null : latestModeChange(deps.store, projectId), rows: rows };
}

function portfolioHoldList(deps) {
  deps = readViewDeps(deps);
  var projects = deps.store.readRows('projects').filter(function (p) { return p.status === 'active'; });
  var rows = [], updated = '';
  projects.forEach(function (project) {
    var list = paymentHoldList(deps, project.project_id);
    list.rows.forEach(function (r) { rows.push(Object.assign({}, r, {project:project.name,project_id:project.project_id})); });
    if (list.last_updated > updated) updated = list.last_updated;
  });
  rows.sort(function (a, b) { return b.amount_usd - a.amount_usd; });
  var total = rows.reduce(function (sum, row) { return sum + row.amount_usd; },0);
  var cycle = currentPayCycle(deps.store, deps.clock.today());
  return {rows:rows,total:formatUsd(total),total_usd:total,pay_date:cycle,last_updated:updated,
    source:'pay_applications, compliance_records',empty:cycle ? 'No one is on payment hold for the pay date ' + cycle + '.' : 'No current pay cycle.',sample:'Sample data'};
}

// Everything the list screens show, from one read of each tab. The page keeps it and filters it
// per project, so a click between screens needs no server call. A write refreshes it.
function appData(deps) {
  deps = readViewDeps(deps);
  var portfolio = portfolioView(deps);
  var holds = { all: portfolioHoldList(deps) };
  portfolio.projects.forEach(function (p) {
    holds[p.project_id] = paymentHoldList(deps, p.project_id);
    p.mode_set = latestModeChange(deps.store, p.project_id);
  });
  return { portfolio: portfolio, worklist: worklistView(deps, 'all'), holds: holds, roi: roiLines(ROI_INPUTS) };
}

// Directory (ticket 18, ticket 19). A sent notice is an activity-log entry for the subcontractor's record
// whose notice type (noticeTypeOf, Notifications.gs) is one of DIRECTORY_NOTICE_TYPES: a notice to the
// subcontractor or the project manager. noticeTypeOf also reads an old row logged under a legacy event_type
// by its summary, so the live Sheet's old rows still count.
function sentNoticeType(entry) {
  var type = noticeTypeOf(entry);
  return type && DIRECTORY_NOTICE_TYPES.indexOf(type) >= 0 ? type : '';
}

// One row per subcontractor: company, trade, contact, email, phone, status, certificate IDs, last notice.
// A subcontractor on several projects shows the worst status across its open records.
// Worst first: expired, then needs review and in review, awaiting, expiring soon, compliant.
// A subcontractor with only closed records shows Closed.
var STATUS_SEVERITY = { expired: 5, needs_review: 4, in_review: 4, awaiting: 3, expiring_soon: 2, compliant: 1, closed: 0 };

function worstStatus(statuses) {
  return statuses.reduce(function (worst, s) {
    return worst === null || STATUS_SEVERITY[s] > STATUS_SEVERITY[worst] ? s : worst;
  }, null);
}

function directoryRows(deps) {
  deps = readViewDeps(deps);
  var today = deps.clock.today();
  var records = deps.store.readRows('compliance_records');
  var certs = deps.store.readRows('certificates');
  var log = deps.store.readRows('activity_log');
  return deps.store.readRows('subcontractors').map(function (sub) {
    var mine = records.filter(function (r) { return r.sub_id === sub.sub_id; });
    var ids = mine.map(function (r) { return r.record_id; });
    var open = mine.filter(function (r) { return r.closed !== true; });
    if (!open.length) open = mine.slice(0, 1);
    var worst = worstStatus(open.map(function (r) { return deriveStatus(loadRecord(deps.store, r), today); }));
    var notice = log.filter(function (a) { return ids.indexOf(a.record_id) >= 0 && sentNoticeType(a); })
      .sort(function (a, b) { return String(b.time).localeCompare(String(a.time)); })[0];
    return {
      sub_id: sub.sub_id, company: sub.name, trade: sub.trade, contact: sub.contact_name, email: sub.email, phone: sub.phone,
      status: worst ? STATUS_LABEL[worst] : '',
      certificate_ids: certs.filter(function (c) { return ids.indexOf(c.record_id) >= 0; }).map(function (c) { return c.certificate_id; }),
      // Each certificate with the record it sits on, so the page can link a certificate to its record.
      certificates: certs.filter(function (c) { return ids.indexOf(c.record_id) >= 0; }).map(function (c) {
        return { certificate_id: c.certificate_id, record_id: c.record_id, expiration_date: c.expiration_date || '' };
      }),
      record_ids: ids,
      last_notification: notice ? NOTICE_TYPES[sentNoticeType(notice)].event : '',
      last_notification_time: notice ? notice.time : ''
    };
  });
}

function directoryView(deps) {
  deps = readViewDeps(deps);
  var rows = directoryRows(deps);
  var updated = '';
  deps.store.readRows('compliance_records').forEach(function (r) { if (String(r.last_updated) > updated) updated = String(r.last_updated); });
  return {
    last_updated: updated,
    rows: rows,
    subcontractor_count: rows.length,
    directory_compliant_count: rows.filter(function (r) { return r.status === STATUS_LABEL.compliant || r.status === STATUS_LABEL.expiring_soon; }).length,
    source: 'subcontractors',
    sample: 'Sample data'
  };
}
