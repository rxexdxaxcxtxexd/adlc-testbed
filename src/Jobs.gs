// Jobs: load a record from the Store, run the compliance core, save the result,
// and hand effects to the Mailer and the Calendar. deps = { store, reader, mailer, clock, calendar, newToken }.

var STATUS_LABEL = {
  awaiting: 'Awaiting certificate', needs_review: 'Needs review', in_review: 'In review', compliant: 'Compliant',
  expiring_soon: 'Expiring soon', expired: 'Expired', closed: 'Closed'
};

function findRow(rows, column, value) {
  return rows.filter(function (r) { return r[column] === value; })[0] || null;
}

function certFromRow(row) {
  var limits = {};
  COI_LIMITS.forEach(function (f) { limits[f] = row[f + '_usd'] === '' ? null : row[f + '_usd']; });
  var values = row.check_result === '' && row.insured_name === '' ? null : {
    insured_name: row.insured_name, limits: limits,
    additional_insured_endorsement: row.additional_insured_endorsement === true,
    project_address: row.project_address === true, certificate_holder: row.certificate_holder === true,
    cancellation_notice_days: row.cancellation_notice_days === '' ? null : row.cancellation_notice_days,
    expiration_date: row.expiration_date
  };
  var cert = {
    id: row.certificate_id, fingerprint: row.file_fingerprint, received: row.received_date,
    confidence: row.confidence, values: values, expiration_date: row.expiration_date || null,
    replaces: row.replaces_certificate_id || null, decision: row.decision, outcome: row.outcome,
    decision_note: row.decision_note || '', calendar_event_id: row.calendar_event_id || ''
  };
  if (row.check_result) cert.check = { pass: row.check_result === 'pass', deficiencies: JSON.parse(row.deficiencies || '[]') };
  if (row.queue_stage) cert.stage = row.queue_stage;
  if (row.queue_reason) cert.reason = row.queue_reason;
  return cert;
}

function certToRow(cert, recordId) {
  var v = cert.values || { limits: {} };
  var row = {
    certificate_id: cert.id, record_id: recordId, received_date: cert.received, file_fingerprint: cert.fingerprint,
    queue_stage: cert.stage || '', queue_reason: cert.reason || '', confidence: cert.confidence,
    insured_name: v.insured_name || '', additional_insured_endorsement: v.additional_insured_endorsement === true,
    project_address: v.project_address === true, certificate_holder: v.certificate_holder === true,
    cancellation_notice_days: v.cancellation_notice_days == null ? '' : v.cancellation_notice_days,
    expiration_date: cert.expiration_date || '',
    check_result: cert.check ? (cert.check.pass ? 'pass' : 'fail') : '',
    deficiencies: JSON.stringify(cert.check ? cert.check.deficiencies : []),
    decision: cert.decision || '', replaces_certificate_id: cert.replaces || '', outcome: cert.outcome || '',
    decision_note: cert.decision_note || '', calendar_event_id: cert.calendar_event_id || ''
  };
  COI_LIMITS.forEach(function (f) { row[f + '_usd'] = v.limits[f] == null ? '' : v.limits[f]; });
  return row;
}

// Builds the core's record shape from the Sheet rows. Give today to load what the sub billed in the current
// pay cycle (the pay check needs it); without it billedThisCycle is 0.
function loadRecord(store, recRow, today) {
  var sub = findRow(store.readRows('subcontractors'), 'sub_id', recRow.sub_id);
  var certs = store.readRows('certificates')
    .filter(function (c) { return c.record_id === recRow.record_id; })
    .map(certFromRow);
  var byId = function (id) { return certs.filter(function (c) { return c.id === id; })[0] || null; };
  return {
    sub: { name: sub.name, email: sub.email, scope: sub.scope_of_work, w9: recRow.w9_on_file === true },
    closed: recRow.closed === true,
    current: byId(recRow.current_certificate_id),
    pending: byId(recRow.queued_certificate_id),
    history: certs.filter(function (c) { return c.id !== recRow.current_certificate_id && c.id !== recRow.queued_certificate_id; }),
    hold: { on: recRow.payment_hold === true, reasons: JSON.parse(recRow.payment_hold_reasons || '[]') },
    billedThisCycle: today ? billedInCycle(store, recRow.project_id, recRow.sub_id, currentPayCycle(store, today)) : 0,
    nudges: { d30: recRow.reminder_30d_sent === true, d7: recRow.reminder_7d_sent === true },
    log: [],
    status: recRow.status
  };
}

// Writes the core's new record back: certificate rows, the compliance record row, the activity log.
function saveRecord(store, recordId, record, now, pdfLink, eventType) {
  var existing = store.readRows('certificates').map(function (c) { return c.certificate_id; });
  [record.current, record.pending].concat(record.history).filter(Boolean).forEach(function (cert) {
    var row = certToRow(cert, recordId);
    if (existing.indexOf(cert.id) < 0) store.appendRow('certificates', Object.assign(row, { pdf_link: pdfLink }));
    else store.updateRow('certificates', 'certificate_id', cert.id, row);
  });
  store.updateRow('compliance_records', 'record_id', recordId, {
    status: record.status,
    current_certificate_id: record.current ? record.current.id : '',
    queued_certificate_id: record.pending ? record.pending.id : '',
    payment_hold: record.hold.on, payment_hold_reasons: JSON.stringify(record.hold.reasons),
    w9_on_file: record.sub.w9, reminder_30d_sent: record.nudges.d30, reminder_7d_sent: record.nudges.d7,
    closed: record.closed, last_updated: now
  });
  record.log.forEach(function (entry) {
    store.appendRow('activity_log', { record_id: recordId, time: now, who: entry.who, event_type: entry.notice || eventType || 'status_change', summary: entry.text });
  });
}

// Effects name a role; the project and subcontractor rows give the address.
// A draft is held for the accountant, never sent; the deficiency path (ticket 06) shows it.
function sendEffects(mailer, effects, project, record) {
  var to = {
    'Subcontractor': record.sub.email, 'Accountant': project.accountant_email,
    'Project manager': project.project_manager_email, 'Leadership': project.leadership_email
  };
  effects.filter(function (e) { return e.kind !== 'draft'; }).forEach(function (e) {
    mailer.send(to[e.to], 'Certificate of insurance: ' + record.sub.name, e.text);
  });
}

// Brings the calendar in line with the record after a save: the event of a replaced certificate goes,
// and a current certificate with no event gets one (docs/decisions.md, Phase 5). A calendar failure never
// undoes the save. It is logged, and the daily job tries again. Call outside the lock.
function applyCalendar(deps, recordId, project, record, changes) {
  changes.forEach(function (c) {
    try {
      if (c.action === 'delete') {
        deps.calendar.deleteEvent(c.eventId);
        return;
      }
      var eventId = deps.calendar.createAllDay('Policy expires: ' + record.sub.name + ' (' + project.name + ')', c.date);
      withScriptLock(function () {
        deps.store.updateRow('certificates', 'certificate_id', c.certificateId, { calendar_event_id: eventId });
      });
    } catch (err) {
      var message = String(err && err.message ? err.message : err);
      withScriptLock(function () {
        deps.store.appendRow('activity_log', {
          record_id: recordId, time: deps.clock.now(), who: 'System', event_type: 'calendar_failed',
          summary: 'The calendar event for ' + c.certificateId + ' could not be ' + (c.action === 'delete' ? 'removed' : 'created') + '. ' + message
        });
      });
    }
  });
}

// One certificate, start to finish. file = { name, fingerprint, link } plus, for the
// real Reader, blob (the PDF). The reading
// happens before the lock is taken, so a slow read never blocks other writers.
// A reading with usage came from a model call, so it writes one ai_calls row (Metering.gs), even when the save
// fails. A canned reading has no usage and writes none. A request that fails outright is not billed and writes none.
// A failed ai_calls write is logged and never undoes the save.
function processCertificate(deps, uploadToken, file) {
  var reading = deps.reader.read(file);
  var call = { purpose: 'read', outcome: reading.readable ? 'ok' : 'unreadable', outcome_reason: reading.reason || '' };
  function meter() {
    if (!reading.usage) return;
    try { recordAiCall(deps.store, deps.clock, deps.newToken, GEMINI_MODEL, reading.usage, call); }
    catch (err) { console.log('The ai_calls row was not written. ' + String(err && err.message ? err.message : err)); }
  }
  var result;
  try {
    result = withScriptLock(function () {
      var store = deps.store;
      var recRow = findRow(store.readRows('compliance_records'), 'upload_token', uploadToken);
      if (!recRow || recRow.closed === true) throw new Error('No open compliance record for this upload link.');
      var project = findRow(store.readRows('projects'), 'project_id', recRow.project_id);
      var record = loadRecord(store, recRow);
      var certId = nextId(store, 'certificates', 'certificate_id', 'CERT-');
      call.record_id = recRow.record_id;
      var event = {
        type: 'certificate_received',
        file: { id: certId, fingerprint: file.fingerprint, readable: reading.readable, confidence: reading.confidence, values: reading.values },
        recordLink: recordLinkFor(deps, recRow.record_id)
      };
      var out = nextStatus(record, event, deps.clock.today(), project.review_mode, TOLERANCE_MATRIX);
      if (out.refused) throw new Error(out.refused);
      saveRecord(store, recRow.record_id, out.record, deps.clock.now(), file.link);
      // A duplicate file adds no certificate, so its call names none.
      var kept = [out.record.current, out.record.pending].concat(out.record.history).filter(function (c) { return c && c.id === certId; });
      call.certificate_id = kept.length ? certId : '';
      return { recordId: recRow.record_id, project: project, record: out.record, effects: out.effects, calendar: calendarChanges(record, out.record) };
    });
  } catch (err) {
    call.outcome = 'error';
    call.outcome_reason = String(err && err.message ? err.message : err);
    meter();
    throw err;
  }
  meter();
  // A new deficiency: draft the notice and the correction request once, outside the lock (src/Draft.gs).
  var effects = withDeficiencyDraft(deps, result.recordId, result.record, result.effects, recordLinkFor(deps, result.recordId));
  sendEffects(deps.mailer, effects, result.project, result.record);
  applyCalendar(deps, result.recordId, result.project, result.record, result.calendar);
  var saved = result.record.pending || result.record.current;
  return { record_id: result.recordId, certificate_id: saved ? saved.id : '', status: result.record.status };
}

// One row per compliance record: subcontractor, status, expiry, last action.
function worklistRows(deps, projectId) {
  var store = deps.store;
  var today = deps.clock.today();
  var log = store.readRows('activity_log');
  var out = store.readRows('compliance_records')
    .filter(function (r) { return r.project_id === projectId; })
    .map(function (recRow) {
      var record = loadRecord(store, recRow);
      var entries = log.filter(function (a) { return a.record_id === recRow.record_id; });
      return {
        record_id: recRow.record_id,
        subcontractor: record.sub.name,
        status: STATUS_LABEL[deriveStatus(record, today)],
        expiry: record.current ? record.current.expiration_date : '',
        payment_hold: record.hold.on,
        hold_reasons: record.hold.reasons,
        last_updated: recRow.last_updated,
        last_action_who: entries.length ? entries[entries.length - 1].who : '',
        last_action_time: entries.length ? entries[entries.length - 1].time : '',
        last_action: entries.length ? entries[entries.length - 1].summary : '',
        waiting: waitingLabel(record),
        next: nextStep(record),
        deficiency_count: record.pending && record.pending.check ? record.pending.check.deficiencies.length : 0,
        sample: 'Sample data'
      };
    });
  // Records that need a person come first. Ties keep Sheet order.
  return out.map(function (row, i) { return { row: row, i: i }; })
    .sort(function (a, b) { return (!!b.row.waiting - !!a.row.waiting) || (a.i - b.i); })
    .map(function (x) { return x.row; });
}
