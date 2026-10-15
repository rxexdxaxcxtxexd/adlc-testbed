// Fake adapters: same interfaces as the real ones in Adapters.gs, held in memory.
// Tests use all of them; ticket 02's deployed path uses FakeReader for a canned reading.

// Store: Sheet tabs as arrays of row objects, Drive as folder and file paths.
function FakeStore() {
  var tabs = {};
  var rows = {};
  var folders = [];
  var files = [];
  return {
    ensureTab: function (name, columns) {
      if (!tabs[name]) { tabs[name] = columns.slice(); rows[name] = []; return; }
      // An older tab gains any column added since it was built.
      columns.forEach(function (c) {
        if (tabs[name].indexOf(c) >= 0) return;
        tabs[name].push(c);
        rows[name].forEach(function (r) { r[c] = ''; });
      });
    },
    ensureFolder: function (path) {
      if (folders.indexOf(path) < 0) folders.push(path);
    },
    writeFile: function (folder, name, content, mimeType) {
      var path = folder + '/' + name;
      files = files.filter(function (f) { return f.path !== path; });
      files.push({ path: path, content: content, mimeType: mimeType });
      return 'fake://' + path;
    },
    writeBlob: function (folder, name, base64, mimeType) {
      return this.writeFile(folder, name, 'base64:' + base64, mimeType);
    },
    readRows: function (tab) {
      return rows[tab].map(function (r) { return Object.assign({}, r); });
    },
    appendRow: function (tab, row) {
      var clean = {};
      tabs[tab].forEach(function (c) { clean[c] = row[c] === undefined ? '' : row[c]; });
      rows[tab].push(clean);
    },
    updateRow: function (tab, keyColumn, keyValue, patch) {
      var row = rows[tab].filter(function (r) { return r[keyColumn] === keyValue; })[0];
      if (!row) throw new Error('No ' + tab + ' row with ' + keyColumn + ' = ' + keyValue);
      tabs[tab].forEach(function (c) { if (patch[c] !== undefined) row[c] = patch[c]; });
    },
    snapshot: function () {
      return { tabs: tabs, rows: rows, folders: folders, files: files };
    }
  };
}

// Reader: returns the canned reading it was given, whatever the file.
function FakeReader(reading) {
  return { read: function () { return JSON.parse(JSON.stringify(reading)); } };
}

// Mailer: keeps every message instead of sending it.
function FakeMailer() {
  var sent = [];
  return {
    send: function (to, subject, body) { sent.push({ to: to, subject: subject, body: body }); },
    sent: function () { return sent.slice(); }
  };
}

// Calendar: all-day events held in memory. An ID is EVT-1, EVT-2 and so on, never reused.
function FakeCalendar() {
  var events = [];
  var made = 0;
  return {
    createAllDay: function (title, isoDate) {
      made += 1;
      events.push({ id: 'EVT-' + made, title: title, date: isoDate });
      return 'EVT-' + made;
    },
    deleteEvent: function (eventId) {
      events = events.filter(function (e) { return e.id !== eventId; });
    },
    events: function () { return events.slice(); }
  };
}

// Cursor: the daily job's saved place, held in memory (Script Properties in the real one).
function FakeCursor() {
  var saved = null;
  return {
    get: function () { return saved === null ? null : JSON.parse(JSON.stringify(saved)); },
    set: function (cursor) { saved = JSON.parse(JSON.stringify(cursor)); },
    clear: function () { saved = null; }
  };
}

// Timers: remembers each run asked for and how often the old one-off timers were cleared.
function FakeTimers() {
  var scheduled = [];
  var cleared = 0;
  return {
    scheduleContinuation: function (ms) { scheduled.push(ms); },
    clearContinuations: function () { cleared += 1; },
    scheduled: function () { return scheduled.slice(); },
    cleared: function () { return cleared; }
  };
}

// Clock: a fixed day and time.
function FakeClock(isoDate, isoTime) {
  return {
    today: function () { return isoDate; },
    now: function () { return isoTime || isoDate + 'T09:00:00'; }
  };
}
