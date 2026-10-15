// Correction flywheel (docs/decisions.md, Phase 6): when an accountant corrects a reading, the PDF link
// and the corrected values become a calibration sample. Calibration then tests the next model against
// the firm's own hard cases as well as the hand-built set.

// pending = the certificate before correction. values = the corrected values. Returns a sample row, or null
// when nothing changed (the model was right) or the file was unreadable (nothing to calibrate against).
// The caller adds record_id and pdf_link. One row per certificate, so the certificate ID names the sample.
function sampleFromCorrection(pending, values, who, note, time) {
  if (!pending || !pending.values || isUnreadable(pending) || !values) return null;
  if (!correctionChanges(pending.values, values).length) return null;
  return {
    sample_id: 'SMP-' + pending.id, source: 'correction', certificate_id: pending.id,
    expected_json: JSON.stringify(values), corrected_by: who, note: String(note || '').trim(), time: time, active: true
  };
}

// Writes one sample. A newer correction of the same certificate replaces the older row.
// Call it inside the script lock. The tab is made if an older Sheet does not have it yet.
function upsertSample(store, row) {
  store.ensureTab('calibration_samples', SCHEMA.calibration_samples);
  var old = findRow(store.readRows('calibration_samples'), 'certificate_id', row.certificate_id);
  if (old) store.updateRow('calibration_samples', 'certificate_id', row.certificate_id, row);
  else store.appendRow('calibration_samples', row);
}

// Active sample rows, shaped like a manifest sample so compareToManifest checks them unchanged.
// A row counts only when active is TRUE; a person sets it to FALSE to drop a bad sample.
function correctionCalibrationEntries(rows) {
  return rows.filter(function (row) {
    return row.active === true || String(row.active).toLowerCase() === 'true';
  }).map(function (row) {
    var expected;
    try {
      expected = JSON.parse(row.expected_json);
    } catch (e) {
      throw new Error(row.sample_id + ': expected_json is not valid JSON. Fix it or set active to FALSE.');
    }
    return { file: row.certificate_id, problem: 'From correction', readable: true, expected: expected, link: row.pdf_link };
  });
}
