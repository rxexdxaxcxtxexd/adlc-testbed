// Calibration: read every sample PDF with the real Reader and compare each value to the
// manifest the generator wrote (docs/decisions.md, Phase 2). The owner runs runCalibration
// from the script editor after uploading test-fixtures/sample-cois/* to the Drive folder. It then reads
// every active row of calibration_samples, the samples from accountant corrections (src/Flywheel.gs).

// Files load alphabetically and share one scope, so nothing here reads another file's
// variable until a function runs.
var CALIBRATION_REPORT = 'calibration-report.md';

function calibrationFolderPath() { return DRIVE_ROOT + '/calibration'; }

function calibrationFields() {
  return ['insured_name']
    .concat(LIMIT_FIELDS.map(function (f) { return 'limits.' + f; }))
    .concat(FLAG_FIELDS, ['cancellation_notice_days', 'expiration_date']);
}

function valueAt(values, path) {
  return path.split('.').reduce(function (o, key) { return o == null ? undefined : o[key]; }, values);
}

// entry: one manifest sample. Returns { pass, confidenceOk, rows }.
function compareToManifest(reading, entry) {
  if (!entry.readable) {
    var ok = !reading.readable && reading.values === null && typeof reading.reason === 'string' && reading.reason.length > 0;
    return { pass: ok, confidenceOk: true, rows: [] };
  }
  if (!reading.readable) {
    return { pass: false, confidenceOk: false, rows: [{ field: 'readable', expected: true, found: false, pass: false }] };
  }
  var rows = calibrationFields().map(function (field) {
    var expected = valueAt(entry.expected, field);
    var found = valueAt(reading.values, field);
    return { field: field, expected: expected, found: found === undefined ? null : found, pass: found === expected };
  });
  var confidenceOk = reading.confidence >= CONFIDENCE_GATE;
  return { pass: confidenceOk && rows.every(function (r) { return r.pass; }), confidenceOk: confidenceOk, rows: rows };
}

// items: [{ file, problem, reading, result }]. Markdown, so it reads in the log and as a file.
// correctionItems (optional) are the samples from accountant corrections (src/Flywheel.gs). When there
// are any, the report has two sections and two totals; when there are none it reads as before.
function formatCalibrationReport(items, correctionItems) {
  var lines = ['# Calibration report', ''];
  var passed = function (list) { return list.filter(function (i) { return i.result.pass; }).length; };
  if (!correctionItems || !correctionItems.length) {
    lines = lines.concat(calibrationItemLines(items, '## '));
    lines.push('Total: ' + passed(items) + ' of ' + items.length + ' samples pass.');
    return lines.join('\n');
  }
  lines.push('## Hand-built set', '');
  lines = lines.concat(calibrationItemLines(items, '### '));
  lines.push('## From corrections', '');
  lines = lines.concat(calibrationItemLines(correctionItems, '### '));
  lines.push('Hand-built set: ' + passed(items) + ' of ' + items.length + ' pass.');
  lines.push('From corrections: ' + passed(correctionItems) + ' of ' + correctionItems.length + ' pass.');
  return lines.join('\n');
}

// One heading per sample, then its field table and any confidence note.
function calibrationItemLines(items, heading) {
  var lines = [];
  items.forEach(function (item) {
    var r = item.reading;
    var detail = r.readable ? 'confidence ' + r.confidence : 'unreadable: ' + r.reason;
    lines.push(heading + item.file + ' (' + item.problem + '): ' + (item.result.pass ? 'PASS' : 'FAIL') + ', ' + detail, '');
    if (item.result.rows.length) {
      lines.push('| Field | Manifest | Read | Result |', '|---|---|---|---|');
      item.result.rows.forEach(function (row) {
        lines.push('| ' + row.field + ' | ' + row.expected + ' | ' + row.found + ' | ' + (row.pass ? 'pass' : 'FAIL') + ' |');
      });
      lines.push('');
    }
    if (r.readable && !item.result.confidenceOk) {
      lines.push('Confidence ' + r.confidence + ' is below ' + CONFIDENCE_GATE + '.', '');
    }
  });
  return lines;
}

function calibrationFolder() {
  if (isDemoMode()) throw new Error(demoRefusal('calibrationFolder').message);
  return calibrationFolder_();
}

function calibrationFolder_() {
  var folder = DriveApp.getRootFolder();
  calibrationFolderPath().split('/').forEach(function (name) {
    var it = folder.getFoldersByName(name);
    folder = it.hasNext() ? it.next() : folder.createFolder(name);
  });
  return folder;
}

// Owner runs this from the script editor. Makes one Gemini call per sample.
// One calibration read, with its ai_calls row (purpose 'calibration').
function readAndMeter(deps, file) {
  var reading = deps.reader.read(file);
  recordAiCall(deps.store, deps.clock, deps.newToken, GEMINI_MODEL, reading.usage, {
    purpose: 'calibration', outcome: reading.readable ? 'ok' : 'unreadable', outcome_reason: reading.reason || ''
  });
  return reading;
}

function runCalibration() {
  if (isDemoMode()) return demoRefusal('runCalibration');
  return runCalibration_();
}

function runCalibration_() {
  var folder = calibrationFolder_();
  var manifestFiles = folder.getFilesByName('manifest.json');
  if (!manifestFiles.hasNext()) {
    throw new Error('manifest.json is not in the Drive folder ' + calibrationFolderPath() + '. Upload everything in test-fixtures/sample-cois/ there, then run again.');
  }
  var manifest = JSON.parse(manifestFiles.next().getBlob().getDataAsString());
  // Each read writes one ai_calls row with purpose 'calibration' (Metering.gs). Needs SHEET_ID, so run setupDemo first.
  var deps = realDeps(GeminiReader());
  var items = manifest.samples.map(function (entry) {
    var files = folder.getFilesByName(entry.file);
    if (!files.hasNext()) throw new Error(entry.file + ' is not in ' + calibrationFolderPath() + '.');
    var reading = readAndMeter(deps, { name: entry.file, fingerprint: '', link: files.next().getUrl() });
    return { file: entry.file, problem: entry.problem, reading: reading, result: compareToManifest(reading, entry) };
  });
  // Then every active sample from an accountant correction. Its PDF stays where the upload filed it.
  var store = deps.store;
  withScriptLock(function () { store.ensureTab('calibration_samples', SCHEMA.calibration_samples); });
  var samples = correctionCalibrationEntries(store.readRows('calibration_samples'));
  var correctionItems = samples.map(function (entry) {
    var reading = readAndMeter(deps, { name: entry.file, fingerprint: '', link: entry.link });
    return { file: entry.file, problem: entry.problem, reading: reading, result: compareToManifest(reading, entry) };
  });
  var report = formatCalibrationReport(items, correctionItems);
  var old = folder.getFilesByName(CALIBRATION_REPORT);
  while (old.hasNext()) old.next().setTrashed(true);
  folder.createFile(CALIBRATION_REPORT, report, MimeType.PLAIN_TEXT);
  console.log(report);
  return report;
}
