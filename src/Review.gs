// Review queue: the accountant's actions, the leadership review mode, and the record detail view.
// Each action loads the record, runs the compliance core, saves the result and hands effects to
// the Mailer and the Calendar. deps = { store, reader, mailer, clock, calendar, newToken, uploadBaseUrl }.

var ROLES = {
  accountant: { label: 'Accountant', nameColumn: 'accountant_name', phrase: 'the accountant' },
  project_manager: { label: 'Project manager', nameColumn: 'project_manager_name', phrase: 'the project manager' },
  leadership: { label: 'Leadership', nameColumn: 'leadership_name', phrase: 'leadership' }
};

// Which role may do each action, and the words for the refusal.
var ACTION_ROLE = {
  approve: ['accountant'], correct: ['accountant'], resend: ['accountant'], w9: ['accountant'], set_mode: ['leadership'],
  waive: ['project_manager', 'leadership'], reject: ['project_manager', 'leadership']
};
var ACTION_VERB = {
  approve: 'approve a certificate', correct: 'correct a reading',
  resend: 'send a resend request', w9: 'mark a W-9', set_mode: 'change the review mode',
  waive: 'waive a deficiency', reject: 'reject a deficiency'
};

var REVIEW_MODES = { review_all: 'review all', review_deficiencies: 'review deficiencies', automatic: 'automatic' };

// "Dana Reyes (Accountant)" when the project names the person, else the role alone.
function actorName(project, role) {
  var r = ROLES[role];
  var name = project[r.nameColumn];
  return name ? name + ' (' + r.label + ')' : r.label;
}

// Returns the refusal text, or '' when the role may do the action.
function roleDenied(role, action) {
  if (!ROLES[role]) return 'Unknown role.';
  if (!ACTION_ROLE[action]) return 'Unknown action.';
  if (ACTION_ROLE[action].indexOf(role) < 0) {
    var who = ACTION_ROLE[action].map(function (k) { return ROLES[k].phrase; }).join(' or ');
    return 'Only ' + who + ' can ' + ACTION_VERB[action] + '.';
  }
  return '';
}

function uploadLinkFor(deps, recRow) {
  return deps.uploadBaseUrl ? deps.uploadBaseUrl + '?t=' + encodeURIComponent(recRow.upload_token) : '';
}

// The link in the deficiency email: the record, opened as the project manager (docs/decisions.md, Phase 3).
// Empty when the internal app address is not set; the email then goes without a link.
function recordLinkFor(deps, recordId) {
  return deps.internalBaseUrl ? deps.internalBaseUrl + '?record=' + encodeURIComponent(recordId) + '&as=project_manager' : '';
}

function isUnreadable(cert) {
  return !!cert && cert.reason === 'Unreadable file';
}

// What the accountant sees a record waiting for. Empty when nothing waits.
function waitingLabel(record) {
  var p = record.pending;
  if (!p) return '';
  if (p.stage === 'approval') return 'Waiting for approval';
  if (p.stage === 'deficiency') return 'Waiting for a decision on a deficiency';
  return isUnreadable(p) ? 'Unreadable file' : 'Needs review';
}

// The one action that clears what the record waits for: approve, correct, resend, or none.
function nextStep(record) {
  var p = record.pending;
  if (!p) return null;
  if (p.stage === 'approval') return 'approve';
  if (p.stage === 'needs_review') return isUnreadable(p) ? 'resend' : 'correct';
  if (p.stage === 'deficiency') return 'decide';
  return null;
}

var ACTION_DONE = {
  approve: 'Approved. The subcontractor has been emailed.',
  correct: 'Correction saved and the check run again.',
  resend: 'Resend request sent.',
  waive: 'Waived. The subcontractor has been emailed that the certificate is approved.',
  reject: 'Rejected. The correction request has been sent to the subcontractor.'
};

// action is approve, correct, resend, w9, waive or reject. payload.values holds the corrected reading
// for correct; payload.note holds the reason for waive; payload.onFile is the W-9 state.
// A browser reject includes payload.approved_text and payload.certificate_id from the preview. Returns { ok, message, status }.
// A refusal changes nothing.
function reviewAction(deps, recordId, role, action, payload) {
  var denied = action === 'set_mode' ? 'Unknown action.' : roleDenied(role, action);
  if (denied) return { ok: false, message: denied };
  var result = withScriptLock(function () {
    var store = deps.store;
    var recRow = findRow(store.readRows('compliance_records'), 'record_id', recordId);
    if (!recRow) return { ok: false, message: 'No such record.' };
    var project = findRow(store.readRows('projects'), 'project_id', recRow.project_id);
    var who = actorName(project, role);
    var event;
    if (action === 'approve') {
      event = { type: 'approve', who: who };
    } else if (action === 'correct') {
      var parsed = parseExtraction({ readable: true, unreadable_reason: null, confidence: 1, values: payload && payload.values });
      if (!parsed.readable) return { ok: false, message: 'The corrected values are not valid: ' + parsed.reason };
      var note = String(payload && payload.note || '').trim();
      if (!note) return { ok: false, message: 'A correction needs a note. Write what you changed and why.' };
      event = { type: 'reading_confirmed', who: who, note: note, values: parsed.values, recordLink: recordLinkFor(deps, recordId) };
    } else if (action === 'w9') {
      if (!payload || typeof payload.onFile !== 'boolean') return { ok: false, message: 'Say whether the W-9 is on file or missing.' };
      event = { type: 'w9_set', who: who, onFile: payload.onFile };
    } else if (action === 'waive') {
      event = { type: 'waive', who: who, note: payload && payload.note };
    } else if (action === 'reject') {
      var rejectLink = uploadLinkFor(deps, recRow);
      if (!rejectLink) return { ok: false, message: 'The upload page address is not set. Set Script Property ' + PROP_UPLOAD_BASE_URL + ' first.' };
      event = { type: 'reject', who: who, uploadLink: rejectLink };
    } else {
      var link = uploadLinkFor(deps, recRow);
      if (!link) return { ok: false, message: 'The upload page address is not set. Set Script Property ' + PROP_UPLOAD_BASE_URL + ' first.' };
      event = { type: 'resend_requested', who: who, uploadLink: link };
    }
    var before = loadRecord(store, recRow);
    // A correction that changed a value becomes a calibration sample (src/Flywheel.gs), and its log line says so.
    var sample = event.type === 'reading_confirmed' ? sampleFromCorrection(before.pending, event.values, who, event.note, deps.clock.now()) : null;
    if (sample) event.addedToTestSet = true;
    var out = nextStatus(before, event, deps.clock.today(), project.review_mode, TOLERANCE_MATRIX);
    if (out.refused) return { ok: false, message: out.refused };
    if (action === 'reject') {
      out.effects = withCorrectionDraft(store, before.pending, out.effects, event.uploadLink);
      if (payload && typeof payload.approved_text === 'string' &&
          (payload.certificate_id !== before.pending.id || !out.effects.some(function (e) { return e.text === payload.approved_text; }))) {
        return { ok: false, message: 'The correction request changed. Reopen the record and approve the current wording.' };
      }
    }
    saveRecord(store, recordId, out.record, deps.clock.now(), '', event.type);
    // Share Proj shows the same log line and writes no sample.
    if (sample && !isDemoMode()) {
      var sampleCert = findRow(store.readRows('certificates'), 'certificate_id', sample.certificate_id);
      upsertSample(store, Object.assign(sample, { record_id: recordId, pdf_link: sampleCert ? sampleCert.pdf_link : '' }));
    }
    return { ok: true, project: project, record: out.record, effects: out.effects, calendar: calendarChanges(before, out.record),
      uploadLink: event.uploadLink };
  });
  if (!result.ok) return { ok: false, message: result.message };
  // The lock fixes the approved wording before the record changes. Send that exact text.
  sendEffects(deps.mailer, result.effects, result.project, result.record);
  applyCalendar(deps, recordId, result.project, result.record, result.calendar);
  var done = action === 'w9' ? (result.record.sub.w9 ? 'W-9 marked on file.' : 'W-9 marked missing.') : ACTION_DONE[action];
  return { ok: true, message: done, status: result.record.status };
}

// Leadership changes a project's review mode. It applies to certificates that arrive afterwards;
// certificates already waiting keep waiting (docs/decisions.md, Phase 3).
function setReviewMode(deps, projectId, role, mode) {
  var denied = roleDenied(role, 'set_mode');
  if (denied) return { ok: false, message: denied };
  if (!REVIEW_MODES[mode]) return { ok: false, message: 'Unknown review mode.' };
  return withScriptLock(function () {
    var store = deps.store;
    var project = findRow(store.readRows('projects'), 'project_id', projectId);
    if (!project) return { ok: false, message: 'No such project.' };
    if (project.review_mode === mode) return { ok: false, message: 'The project is already on ' + REVIEW_MODES[mode] + '.' };
    var change = 'from ' + REVIEW_MODES[project.review_mode] + ' to ' + REVIEW_MODES[mode] + '.';
    store.updateRow('projects', 'project_id', projectId, { review_mode: mode });
    store.appendRow('activity_log', {
      record_id: projectId, time: deps.clock.now(), who: actorName(project, role),
      event_type: 'review_mode_changed', summary: 'Changed review mode ' + change
    });
    return { ok: true, message: 'Review mode changed ' + change };
  });
}

// The certificate a record shows: the one waiting, else the current one.
function shownCertificate(record) {
  return record.pending || record.current;
}

// Drive link of the PDF the record shows, or '' when it has none. The page asks for a record,
// never for a link, so it cannot ask for another Drive file.
function recordPdfLink(deps, recordId) {
  var store = deps.store;
  var recRow = findRow(store.readRows('compliance_records'), 'record_id', recordId);
  if (!recRow) throw new Error('No such record.');
  var shown = shownCertificate(loadRecord(store, recRow));
  var certRow = shown ? findRow(store.readRows('certificates'), 'certificate_id', shown.id) : null;
  return certRow ? certRow.pdf_link : '';
}

// Everything the record page shows: the values against the requirements, the timeline,
// the confidence, the PDF link and, for an unreadable file, the resend draft.
function recordDetail(deps, recordId) {
  var store = deps.store;
  var recRow = findRow(store.readRows('compliance_records'), 'record_id', recordId);
  if (!recRow) throw new Error('No such record.');
  var project = findRow(store.readRows('projects'), 'project_id', recRow.project_id);
  var record = loadRecord(store, recRow, deps.clock.today());
  var shown = shownCertificate(record);
  var certRow = shown ? findRow(store.readRows('certificates'), 'certificate_id', shown.id) : null;
  var lines = shown && shown.values
    ? evaluateCoi(shown.values, record.sub.scope, TOLERANCE_MATRIX, { insuredName: record.sub.name }).lines
    : [];
  var confirmation = store.readRows('activity_log').filter(function (a) {
    return a.record_id === recordId && a.event_type === 'reading_confirmed' && shown && (a.summary.indexOf(' ' + shown.id + '.') >= 0 || a.summary.indexOf(' ' + shown.id + ' with no changes.') >= 0);
  });
  var draft = null;
  if (isUnreadable(record.pending)) {
    var link = uploadLinkFor(deps, recRow);
    draft = {
      to: record.sub.email, subject: 'Certificate of insurance: ' + record.sub.name,
      body: resendText(link), ready: !!link
    };
  }
  return {
    record_id: recordId,
    project_id: project.project_id,
    project: project.name,
    subcontractor: record.sub.name,
    scope: record.sub.scope,
    status: STATUS_LABEL[deriveStatus(record, deps.clock.today())],
    w9_on_file: record.sub.w9,
    closed: record.closed,
    review_mode: project.review_mode,
    waiting: waitingLabel(record),
    next: nextStep(record),
    expiry: record.current ? record.current.expiration_date : '',
    queued_expiry: record.pending ? record.pending.expiration_date : '',
    last_updated: recRow.last_updated,
    received: shown ? shown.received : '',
    payment_hold: record.hold.on,
    hold_reasons: record.hold.reasons,
    billed_this_cycle_usd: record.billedThisCycle,
    check_result: shown && shown.check ? (shown.check.pass ? 'Pass' : 'Fail') : 'Not checked',
    waived: !!(shown && shown.decision && shown.decision.indexOf('waived') === 0),
    rejection_text: correctionRequestText(store, shown, uploadLinkFor(deps, recRow)),
    staff: { accountant: project.accountant_name, project_manager: project.project_manager_name, leadership: project.leadership_name },
    certificate_id: shown ? shown.id : '',
    confidence: shown ? shown.confidence : null,
    confidence_label: confirmation.length ? 'Confirmed' : shown && typeof shown.confidence === 'number' ? (Math.floor(shown.confidence * 10000) / 100).toLocaleString('en-US', {maximumFractionDigits:2}) + '%' : 'Not shown',
    reading_confirmed_by: confirmation.length ? confirmation[confirmation.length - 1].who : '',
    pdf_link: certRow ? certRow.pdf_link : '',
    values: shown ? shown.values : null,
    lines: lines,
    limit_fields: COI_LIMITS.map(function (f) { return { field: f, label: COI_LABEL[f] }; }),
    draft: draft,
    timeline: store.readRows('activity_log')
      .filter(function (a) { return a.record_id === recordId; })
      .map(function (a) { return { time: a.time, who: a.who, summary: a.summary, event_type: a.event_type }; }).reverse(),
    sample: 'Sample data'
  };
}
