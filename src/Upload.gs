// Public upload page logic and the upload job. deps = { store, reader, mailer, clock, newToken }.
// The page only saves the file and adds an uploads row. The job does the reading.

var UPLOAD_MSG_BAD_LINK = 'This upload link is not active. Contact the project team for a new one.';
var UPLOAD_MSG_NOT_PDF = 'Only PDF files are accepted. Please upload your certificate as a PDF.';
var UPLOAD_MSG_TOO_BIG = 'This file is larger than 5 MB. Please save a smaller PDF and try again.';
var UPLOAD_MSG_DUPLICATE = 'We already have this file. Nothing was changed.';
var UPLOAD_MSG_SAVED = 'Thank you. We received your certificate.';
var UPLOAD_MSG_DEMO = 'This is a demo. Nothing was saved and your file was not read. Below is the stored sample reading.';

// Demo mode (ticket 14): no Drive write, no uploads row, no Gemini call. A good link gets the stored sample reading.
function demoUpload(store, token) {
  if (!findOpenRecord(store, token)) return { ok: false, message: UPLOAD_MSG_BAD_LINK };
  var v = SAMPLE_READING.values;
  var lines = [{ label: 'Insured name', value: v.insured_name }];
  COI_LIMITS.forEach(function (f) { lines.push({ label: COI_LABEL[f], value: v.limits[f] == null ? 'Not shown' : formatUsd(v.limits[f]) }); });
  lines.push({ label: 'Additional insured endorsement', value: v.additional_insured_endorsement ? 'Printed' : 'Not printed' });
  lines.push({ label: 'Project address', value: v.project_address ? 'Printed' : 'Not printed' });
  lines.push({ label: 'Certificate holder', value: v.certificate_holder ? 'Printed' : 'Not printed' });
  lines.push({ label: 'Cancellation notice', value: v.cancellation_notice_days + ' days' });
  lines.push({ label: 'Expires', value: v.expiration_date });
  return { ok: true, demo: true, message: UPLOAD_MSG_DEMO, reading: lines, sample: 'Sample data' };
}

// A link is open while its record exists, is not closed, and does not hold a current compliant certificate.
function findOpenRecord(store, token) {
  if (!token) return null;
  var rec = findRow(store.readRows('compliance_records'), 'upload_token', token);
  if (!rec || rec.closed === true || rec.status === 'closed' || rec.status === 'compliant') return null;
  return rec;
}

// Names shown on the upload page, or { open: false } for any bad link.
function uploadLinkInfo(store, token) {
  var rec = findOpenRecord(store, token);
  if (!rec) return { open: false, message: UPLOAD_MSG_BAD_LINK };
  var sub = findRow(store.readRows('subcontractors'), 'sub_id', rec.sub_id);
  var project = findRow(store.readRows('projects'), 'project_id', rec.project_id);
  return { open: true, subcontractor: sub.name, project: project.name };
}

// file = { name, size, header, fingerprint, base64 }. header is the first five characters of the file.
function acceptUpload(deps, token, file) {
  var store = deps.store;
  if (!findOpenRecord(store, token)) return { ok: false, message: UPLOAD_MSG_BAD_LINK };
  if (!/\.pdf$/i.test(file.name) || file.header !== '%PDF-') return { ok: false, message: UPLOAD_MSG_NOT_PDF };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, message: UPLOAD_MSG_TOO_BIG };

  return withScriptLock(function () {
    var rec = findOpenRecord(store, token);
    if (!rec) return { ok: false, message: UPLOAD_MSG_BAD_LINK };
    var seen = store.readRows('certificates').some(function (c) {
      return c.record_id === rec.record_id && c.file_fingerprint === file.fingerprint;
    }) || store.readRows('uploads').some(function (u) {
      return u.upload_token === token && u.file_fingerprint === file.fingerprint;
    });
    if (seen) return { ok: true, duplicate: true, message: UPLOAD_MSG_DUPLICATE };

    var uploadId = nextId(store, 'uploads', 'upload_id', 'UPL-');
    var link = store.writeBlob(DRIVE_INBOX, uploadId + ' ' + file.name, file.base64, 'application/pdf');
    store.appendRow('uploads', {
      upload_id: uploadId, upload_token: token, received_time: deps.clock.now(), file_name: file.name,
      file_fingerprint: file.fingerprint, drive_link: link, processed: false, attempts: 0, last_error: ''
    });
    return { ok: true, duplicate: false, message: UPLOAD_MSG_SAVED, upload_id: uploadId };
  });
}

// One upload per run. A failure counts one attempt; the third marks the row failed and moves on.
function processNextUpload(deps) {
  var store = deps.store;
  var next = store.readRows('uploads').filter(function (u) { return u.processed === false || u.processed === ''; })[0];
  if (!next) return { status: 'none' };
  var attempts = (next.attempts === '' ? 0 : next.attempts) + 1;
  try {
    processCertificate(deps, next.upload_token, { name: next.file_name, fingerprint: next.file_fingerprint, link: next.drive_link });
  } catch (err) {
    var failed = attempts >= MAX_UPLOAD_ATTEMPTS;
    var message = String(err && err.message ? err.message : err);
    withScriptLock(function () {
      store.updateRow('uploads', 'upload_id', next.upload_id, { attempts: attempts, last_error: message, processed: failed ? 'failed' : false });
      if (failed) {
        var rec = findRow(store.readRows('compliance_records'), 'upload_token', next.upload_token);
        store.appendRow('activity_log', {
          record_id: rec ? rec.record_id : '', time: deps.clock.now(), who: 'System', event_type: 'upload_failed',
          summary: 'Upload ' + next.upload_id + ' failed ' + attempts + ' times and was skipped. ' + message, drive_link: next.drive_link
        });
      }
    });
    return { status: failed ? 'failed' : 'retry', upload_id: next.upload_id };
  }
  withScriptLock(function () {
    store.updateRow('uploads', 'upload_id', next.upload_id, { attempts: attempts, last_error: '', processed: true });
  });
  return { status: 'processed', upload_id: next.upload_id };
}

// A receipt exposes only the result for the upload that belongs to its token.
function uploadProgress(deps, token, uploadId) {
  var upload = findRow(deps.store.readRows('uploads'), 'upload_id', uploadId);
  var record = findRow(deps.store.readRows('compliance_records'), 'upload_token', token);
  if (!upload || !record || upload.upload_token !== token) return {state:'inactive',complete:true,message:'This upload receipt is not active. Contact the project team.'};
  if (upload.processed === 'failed') return {state:'failed',complete:true,message:'The certificate check could not finish. Contact the project team for help. Your file is saved.'};
  if (upload.processed !== true) return {state:'waiting',complete:false,message:'Your file is saved. Waiting for the certificate check.'};
  var certificate = deps.store.readRows('certificates').filter(function (c) {
    return c.record_id === record.record_id && c.file_fingerprint === upload.file_fingerprint;
  })[0];
  if (!certificate) return {state:'received',complete:true,message:'Your file is saved. The project team will review the result.'};
  if (certificate.queue_reason === 'Unreadable file') return {state:'unreadable',complete:true,message:'The certificate could not be read. Please resend a readable standard PDF.'};
  if (certificate.queue_stage === 'needs_review') return {state:'needs_review',complete:true,message:'The certificate was read. The project team must check the reading before approval.'};
  if (certificate.queue_stage === 'deficiency') return {state:'decision',complete:true,message:'The certificate was read. The project team must decide on the project requirements.'};
  if (certificate.queue_stage === 'approval') return {state:'approval',complete:true,message:'The certificate was read. It is waiting for the accountant to approve.'};
  return {state:'complete',complete:true,message:'The certificate check is complete. The project team recorded the result.'};
}
