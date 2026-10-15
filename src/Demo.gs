// Demo mode (docs/decisions.md, Phase 5, ticket 14): a visitor's changes live in the visitor's browser only.
// An action runs the normal code against an overlay store. The overlay store reads the real rows plus the
// browser's changed rows, and keeps every write in memory. The changed rows go back to the browser, which
// keeps them in sessionStorage and sends them with each later call. Nothing is written to the master data.

// The key column of each tab whose rows a write can change. Rows of other tabs (activity_log) only add.
var DEMO_KEY = { projects: 'project_id', subcontractors: 'sub_id', compliance_records: 'record_id', certificates: 'certificate_id', uploads: 'upload_id' };

// The browser's changed rows are untrusted. Keep only known tabs and columns, and plain values.
var DEMO_MAX_ROWS = 2000;
function cleanOverlay(raw) {
  var rows = {};
  var kept = 0;
  var given = raw && typeof raw === 'object' && raw.rows && typeof raw.rows === 'object' ? raw.rows : {};
  Object.keys(SCHEMA).forEach(function (tab) {
    if (!Array.isArray(given[tab])) return;
    given[tab].forEach(function (row) {
      if (!row || typeof row !== 'object' || kept >= DEMO_MAX_ROWS) return;
      var clean = {};
      SCHEMA[tab].forEach(function (c) {
        var v = row[c];
        if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') clean[c] = v;
      });
      if (DEMO_KEY[tab] && (clean[DEMO_KEY[tab]] === undefined || clean[DEMO_KEY[tab]] === '')) return;
      (rows[tab] || (rows[tab] = [])).push(clean);
      kept += 1;
    });
  });
  return { rows: rows };
}

function demoIndexOf(rows, key, value) {
  for (var i = 0; i < rows.length; i++) if (rows[i][key] === value) return i;
  return -1;
}

// Same interface as the Store. Reads: the base rows with the overlay laid over them.
// Writes: kept in the overlay. Files: never written. The base store is only read, once per tab.
function OverlayStore(base, overlay) {
  var rows = cleanOverlay(overlay).rows;
  var cache = {};
  function copy(row) { return Object.assign({}, row); }
  function put(tab, row) {
    var list = rows[tab] || (rows[tab] = []);
    var key = DEMO_KEY[tab];
    var at = key ? demoIndexOf(list, key, row[key]) : -1;
    if (at >= 0) list[at] = Object.assign({}, list[at], row);
    else list.push(copy(row));
  }
  function readRows(tab) {
    if (!cache[tab]) cache[tab] = base.readRows(tab);
    var out = cache[tab].map(copy);
    var key = DEMO_KEY[tab];
    (rows[tab] || []).forEach(function (row) {
      var at = key ? demoIndexOf(out, key, row[key]) : -1;
      if (at >= 0) out[at] = Object.assign(out[at], row);
      else out.push(copy(row));
    });
    return out;
  }
  return {
    ensureTab: function () {},
    ensureFolder: function () {},
    writeFile: function () { return ''; },
    writeBlob: function () { return ''; },
    readRows: readRows,
    appendRow: function (tab, row) { put(tab, row); },
    appendRows: function (tab, list) { list.forEach(function (row) { put(tab, row); }); },
    updateRow: function (tab, keyColumn, keyValue, patch) {
      if (DEMO_KEY[tab] !== keyColumn) throw new Error('Demo mode cannot update ' + tab + ' by ' + keyColumn + '.');
      if (demoIndexOf(readRows(tab), keyColumn, keyValue) < 0) throw new Error('No ' + tab + ' row with ' + keyColumn + ' = ' + keyValue);
      var change = {};
      Object.keys(patch).forEach(function (c) { if (patch[c] !== undefined) change[c] = patch[c]; });
      change[keyColumn] = keyValue;
      put(tab, change);
    },
    overlay: function () { return cleanOverlay({ rows: rows }); }
  };
}

// deps for a demo call: the real reads, an overlay store, and fakes for mail, calendar, timers and the cursor.
// No Reader: nothing in demo mode reads a certificate with Gemini.
function demoDeps(real, overlay) {
  return Object.assign({}, real, {
    store: OverlayStore(real.store, overlay), reader: null, mailer: FakeMailer(), calendar: FakeCalendar(),
    cursor: FakeCursor(), timers: FakeTimers()
  });
}

var DEMO_NOTE = 'Demo: no email was sent. The change stays in this browser tab.';
var DEMO_ACTION_DONE = {
  approve: 'Approved.', correct: 'Correction applied and the check run again.', resend: 'Resend request prepared.',
  waive: 'Waived.', reject: 'Rejected.'
};

// A review action in demo mode. Same checks and outcome as the real action, through nextStatus. Returns the
// real result plus { demo: true, overlay } with every changed row.
function demoReviewAction(real, overlay, recordId, role, action, payload) {
  var deps = demoDeps(real, overlay);
  var out = reviewAction(deps, recordId, role, action, payload);
  if (!out.ok) return out;
  var done = action === 'w9' ? out.message : DEMO_ACTION_DONE[action];
  return { ok: true, demo: true, message: done + ' ' + DEMO_NOTE, status: out.status, overlay: deps.store.overlay() };
}

function demoReviewMode(real, overlay, projectId, role, mode) {
  var deps = demoDeps(real, overlay);
  var out = setReviewMode(deps, projectId, role, mode);
  if (!out.ok) return out;
  return { ok: true, demo: true, message: out.message + ' Demo: the change stays in this browser tab.', overlay: deps.store.overlay() };
}

// Owner-only entry points (setup, timers, calibration) do nothing in demo mode.
// Public names that have a private "_" version for the owner to run from the script editor.
var OWNER_RUN_ = ['setupDemo', 'buildDemo', 'setupPortfolioDemo', 'runCalibration', 'calibrationFolder',
  'installUploadTrigger', 'installDailyTrigger', 'runUploadJob', 'runDailyJob', 'continueDailyJob'];

function demoRefusal(name) {
  var message = name + ' did not run because demo mode is on.';
  if (OWNER_RUN_.indexOf(name) >= 0) message += ' Run ' + name + '_ from the Apps Script editor instead. Do not turn demo mode off while the app is public.';
  console.log(message);
  return { ok: false, demo: true, message: message };
}
