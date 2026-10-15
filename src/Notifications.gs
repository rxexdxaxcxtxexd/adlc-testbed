// Notification log (ticket 19). A read-only view of the emails the workflow sends, and of the planned ones it does not send yet.
// The rule (docs/decisions.md, Phase 5): the log reports what the code does. A notice the code sends shows as sent or
// waiting. A planned notice the code does not send shows as "Not sent" and its trigger says it is not built.
// Nothing here sends anything. notificationLog reads rows through deps.store and calls no mail, Drive,
// Calendar or model service. Names for events are the glossary names (GLOSSARY.md, Notifications).

// Notices the code logs, one activity_log event_type each (docs/decisions.md, Phase 5). saveRecord writes the
// type when nextStatus marks a log line with it. The old catch-all types are in LEGACY_NOTICE_TYPES.
var NOTICE_TYPES = {
  notice_deficiency: { event: 'Deficiency found', to_role: 'Project manager' },
  notice_resend_request: { event: 'Resend request', to_role: 'Subcontractor contact' },
  notice_correction_request: { event: 'Correction request', to_role: 'Subcontractor contact' },
  notice_reminder_30d: { event: 'Expiring in 30 days', to_role: 'Subcontractor contact' },
  notice_reminder_7d: { event: 'Expiring in 7 days', to_role: 'Subcontractor contact' },
  notice_payment_hold: { event: 'Payment hold notice', to_role: 'Accountant' },
  notice_certificate_approved: { event: 'Certificate approved', to_role: 'Subcontractor contact' },
  notice_renewal_accepted: { event: 'Renewal accepted', to_role: 'Subcontractor contact' },
  notice_duplicate: { event: 'Duplicate notice', to_role: 'Subcontractor contact' },
  notice_payment_cleared: { event: 'Cleared for payment notice', to_role: 'Accountant' }
};

// The notices that go to a subcontractor or the project manager. The directory's last notification reads these.
var DIRECTORY_NOTICE_TYPES = ['notice_deficiency', 'notice_resend_request', 'notice_correction_request',
  'notice_reminder_30d', 'notice_reminder_7d', 'notice_certificate_approved', 'notice_renewal_accepted', 'notice_duplicate'];

// Before ticket 19 a notice was logged under whatever type the action had, and the summary was the only clue.
// The live Sheet still holds those rows.
var LEGACY_NOTICE_TYPES = ['status_change', 'certificate_received', 'reading_confirmed', 'resend_requested', 'reject', 'pay_check'];
var LEGACY_NOTICE_SUMMARIES = [
  { type: 'notice_reminder_30d', pattern: /30-day renewal reminder sent\./ },
  { type: 'notice_reminder_7d', pattern: /7-day follow-up sent\./ },
  { type: 'notice_resend_request', pattern: /Asked the subcontractor to resend\./ },
  { type: 'notice_correction_request', pattern: /Correction request sent\./ },
  { type: 'notice_deficiency', pattern: /Sent to the project manager\./ },
  { type: 'notice_payment_hold', pattern: /Pay check: on payment hold/ }
];

// The notice type of an activity-log row, or '' when the row is not a notice.
function noticeTypeOf(entry) {
  if (NOTICE_TYPES[entry.event_type]) return entry.event_type;
  if (LEGACY_NOTICE_TYPES.indexOf(entry.event_type) < 0) return '';
  var hit = LEGACY_NOTICE_SUMMARIES.filter(function (s) { return s.pattern.test(entry.summary); })[0];
  return hit ? hit.type : '';
}

var DIGEST_EVENT = 'COI Sub-Contract Payment Holds - Digest';

// Glossary names, in the order the screen lists them.
var NOTIFICATION_EVENTS = ['Certificate received', 'Deficiency found', 'Low-confidence reading', 'Expiring in 30 days',
  'Expiring in 7 days', 'Payment hold notice', 'Renewal accepted', DIGEST_EVENT, 'Upload link', 'Resend request',
  'Correction request', 'Certificate approved', 'Duplicate notice', 'Cleared for payment notice'];

// The event_type of a log row: one per event, whether the row comes from the activity log or from record state.
var EVENT_TYPE = {
  'Certificate received': 'certificate_received', 'Deficiency found': 'deficiency_found', 'Low-confidence reading': 'low_confidence_reading',
  'Expiring in 30 days': 'expiring_30d', 'Expiring in 7 days': 'expiring_7d', 'Payment hold notice': 'payment_hold_notice',
  'Renewal accepted': 'renewal_accepted', 'COI Sub-Contract Payment Holds - Digest': 'payment_holds_digest',
  'Upload link': 'upload_link', 'Resend request': 'resend_request', 'Correction request': 'correction_request',
  'Certificate approved': 'certificate_approved', 'Duplicate notice': 'duplicate_notice', 'Cleared for payment notice': 'cleared_for_payment_notice'
};

// The approval values a row can carry. Each one is true of what the code does.
//   'Internal, no approval'   Goes to staff. The code sends it with no person in the loop.
//   'Person approves'         A person acts first. A draft waits for that person (status "Waiting for approval").
//                             approved_by names the person only when the activity log records that person's action.
//   'Automatic (daily job)'   The daily job sends it. No person is in the loop.
//   'Automatic (review mode)' The code sends it on its own because the project's review mode lets the certificate through.
//   'Automatic (on upload)'   The upload job sends it on its own when a file arrives.
//   'Not built yet'           A planned notice. The code does not send it (status "Not sent").
var APPROVAL_INTERNAL = 'Internal, no approval';
var APPROVAL_PERSON = 'Person approves';
var APPROVAL_DAILY = 'Automatic (daily job)';
var APPROVAL_REVIEW_MODE = 'Automatic (review mode)';
var APPROVAL_UPLOAD = 'Automatic (on upload)';
var APPROVAL_NOT_BUILT = 'Not built yet';
var PLANNED = 'Planned, not built. ';

var NOTIFICATION_BANNER = 'Preview. These emails are drafted for review.';
var NOTIFICATION_FOOTER = '\n\nHarborline Builders compliance team';
var SAMPLE_UPLOAD_LINK = 'https://example.com/upload?t=sample-link';
var SAMPLE_RECORD_LINK = 'https://example.com/coi?as=project_manager&record=';
var MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// 'Oct 8, 2026' from '2026-10-08'.
function dateLabel(iso) {
  var p = String(iso).slice(0, 10).split('-');
  return MONTH_NAMES[parseInt(p[1], 10) - 1] + ' ' + parseInt(p[2], 10) + ', ' + p[0];
}

// The latest Thursday on or before the date. The planned digest would go out on Thursday at 6:00 AM.
function latestThursday(iso) {
  var dow = new Date(iso + 'T00:00:00Z').getUTCDay();
  return addDays(iso, -((dow - 4 + 7) % 7));
}

function firstName(full) {
  return String(full || '').split(' ')[0];
}

// The newest certificate with a check result, for the gaps shown in an email.
function certificateWithGaps(model) {
  var all = [model.pending, model.current].concat(model.history.slice().reverse()).filter(Boolean);
  return all.filter(function (c) { return c.check && c.check.deficiencies.length; })[0] || null;
}

function gapLines(cert) {
  return cert ? cert.check.deficiencies.map(function (d) { return '- ' + d.text; }).join('\n') : '';
}

// The stored draft for a notice, read from the ai_drafts rows. Returns { by, draft }: by is the label
// (AI only when the stored wording passes the check again; otherwise Template) and draft is the wording, or null.
function storedNotice(rows, cert, kind) {
  if (!cert) return { by: 'Template', draft: null };
  var found = draftFromRows(rows, cert.id, kind);
  if (!found) return { by: 'Template', draft: null };
  var draft = usableDraft(found, cert.check.deficiencies);
  return { by: draft ? 'AI' : 'Template', draft: draft };
}

// deps = { store, clock }. Returns the log described in docs/design/round-4-demo-polish-brief.md, section 7.
function notificationLog(deps) {
  var store = deps.store;
  var today = deps.clock.today();
  var projects = store.readRows('projects');
  var subs = store.readRows('subcontractors');
  var records = store.readRows('compliance_records');
  var log = store.readRows('activity_log');
  var drafts = draftRows(store);
  var cycle = currentPayCycle(store, today);
  var out = [];

  var staged = [];
  log.forEach(function (a) {
    var type = noticeTypeOf(a);
    if (type) staged.push({ entry: a, type: type });
  });
  function hasLogged(recordId, type) {
    return staged.some(function (s) { return s.entry.record_id === recordId && s.type === type; });
  }

  // The person an activity-log row names, or '' when the row is by the system or has no role.
  function personOf(who) {
    return /\((Accountant|Project manager|Leadership)\)$/.test(who) ? who : '';
  }
  // The person whose approve or waive action the log holds for a record, before the row at index.
  function approverBefore(recordId, index) {
    for (var i = Math.min(index, log.length) - 1; i >= 0; i--) {
      if (log[i].record_id === recordId && /^(Approved |Waived:)/.test(log[i].summary) && personOf(log[i].who)) return log[i].who;
    }
    return '';
  }

  function add(ctx, e) {
    var staff = ctx.staff;
    var toRole = e.to_role;
    var to = { name: '', email: '' };
    if (toRole === 'Subcontractor contact') to = { name: ctx.sub.contact_name, email: ctx.sub.email };
    else if (toRole === 'Project manager') to = { name: staff.project_manager_name, email: staff.project_manager_email };
    else if (toRole === 'Accountant') to = { name: staff.accountant_name, email: staff.accountant_email };
    else if (toRole === 'Leadership') to = { name: staff.leadership_name, email: staff.leadership_email };
    var approval = e.approval;
    var status = e.status;
    // A person is named only when the activity log records that person's action.
    var approvedBy = approval === APPROVAL_PERSON && status === 'Sent' ? (e.approved_by || '') : '';
    var body = 'Hello ' + firstName(to.name) + ',\n\n' + e.message + NOTIFICATION_FOOTER;
    out.push({
      id: '', event_type: EVENT_TYPE[e.event], event: e.event, trigger: e.trigger, time: e.time,
      project_id: staff.project_id, project: staff.name, record_id: ctx.record_id, sub_name: ctx.sub.name,
      to_role: toRole, to_name: to.name, to_email: to.email,
      drafted_by: e.drafted_by || 'Template', approval: approval, approved_by: approvedBy, status: status,
      subject: e.subject, body: body
    });
  }

  records.forEach(function (row) {
    var staff = projects.filter(function (p) { return p.project_id === row.project_id; })[0];
    var sub = subs.filter(function (s) { return s.sub_id === row.sub_id; })[0];
    if (!staff || !sub) return;
    var model = loadRecord(store, row, today);
    var status = deriveStatus(model, today);
    var ctx = { staff: staff, sub: sub, record_id: row.record_id };
    var drafted = String(row.last_updated || today + 'T00:00:00');
    var subject = 'Certificate of insurance: ' + sub.name;
    var where = sub.name + ', ' + staff.name;
    var shown = model.pending || model.current;
    var certId = shown ? shown.id : '';
    var gaps = certificateWithGaps(model);

    // Notices the activity log holds. Each one is an email the code sent, or a draft a person must send.
    staged.filter(function (s) { return s.entry.record_id === row.record_id; }).forEach(function (s) {
      var a = s.entry;
      var meta = NOTICE_TYPES[s.type];
      var common = { event: meta.event, to_role: meta.to_role, time: String(a.time), status: 'Sent' };
      var person = personOf(a.who);
      if (s.type === 'notice_deficiency') {
        var count = (/^(\d+) deficienc/.exec(a.summary) || [])[1];
        var pmDraft = storedNotice(drafts, gaps, 'deficiency_notice');
        add(ctx, Object.assign(common, {
          trigger: (count ? count + (count === '1' ? ' deficiency' : ' deficiencies') : 'Deficiencies') + ' found on ' + (gaps ? gaps.id : certId),
          drafted_by: pmDraft.by, approval: APPROVAL_INTERNAL, subject: 'Decision needed: ' + where,
          message: pmDraft.draft ? assembleDeficiencyNotice(sub.name, gaps.check.deficiencies, pmDraft.draft, SAMPLE_RECORD_LINK + row.record_id)
            : sub.name + ' has gaps against the project requirements.\n' + gapLines(gaps) + '\n\nWaive or reject? Open the record: ' + SAMPLE_RECORD_LINK + row.record_id
        }));
      } else if (s.type === 'notice_resend_request') {
        add(ctx, Object.assign(common, { trigger: 'Unreadable file', approval: APPROVAL_PERSON, approved_by: person, subject: subject,
          message: resendText(SAMPLE_UPLOAD_LINK) }));
      } else if (s.type === 'notice_correction_request') {
        var fixDraft = storedNotice(drafts, gaps, 'correction_request');
        add(ctx, Object.assign(common, { trigger: 'Rejected by the project manager', drafted_by: fixDraft.by, approval: APPROVAL_PERSON, approved_by: person, subject: subject,
          message: !gaps ? correctionText([], SAMPLE_UPLOAD_LINK)
            : fixDraft.draft ? assembleCorrectionRequest(gaps.check.deficiencies, fixDraft.draft, SAMPLE_UPLOAD_LINK)
            : correctionText(gaps.check.deficiencies, SAMPLE_UPLOAD_LINK) }));
      } else if (s.type === 'notice_reminder_30d' || s.type === 'notice_reminder_7d') {
        var is7 = s.type === 'notice_reminder_7d';
        var expiry = model.current ? model.current.expiration_date : '';
        add(ctx, Object.assign(common, { trigger: is7 ? 'Policy expires within 7 days' : 'Policy expires within 30 days', approval: APPROVAL_DAILY, subject: subject,
          message: (is7 ? 'Reminder: your policy expires ' : 'Your policy expires ') + (expiry ? dateLabel(expiry) : 'soon') +
            (is7 ? '.' : '. Please send your renewal.') + ' Upload your renewal here: ' + SAMPLE_UPLOAD_LINK }));
      } else if (s.type === 'notice_certificate_approved' || s.type === 'notice_renewal_accepted') {
        var renewed = s.type === 'notice_renewal_accepted';
        var acceptedId = (/^(\S+) accepted/.exec(a.summary) || [])[1] || certId;
        var byPerson = /approved by the accountant|waived by the project manager/.test(a.summary);
        var approver = byPerson ? approverBefore(row.record_id, log.indexOf(a)) : '';
        add(ctx, Object.assign(common, {
          trigger: (renewed ? 'Renewal ' : 'Certificate ') + acceptedId + ' accepted',
          approval: byPerson ? APPROVAL_PERSON : APPROVAL_REVIEW_MODE, approved_by: approver, subject: subject,
          message: renewed ? 'Your renewal ' + acceptedId + ' is approved. It expires ' + (model.current ? dateLabel(model.current.expiration_date) : 'later') + '.'
            : 'Your certificate ' + acceptedId + ' is approved.' }));
      } else if (s.type === 'notice_duplicate') {
        add(ctx, Object.assign(common, { trigger: 'The same file arrived twice', approval: APPROVAL_UPLOAD, subject: subject,
          message: 'We already have this certificate. No action needed.' }));
      } else if (s.type === 'notice_payment_cleared') {
        add(ctx, Object.assign(common, { trigger: 'Every payment hold reason is gone', approval: APPROVAL_INTERNAL, subject: 'Cleared for payment: ' + where,
          message: sub.name + ' is cleared for payment.' }));
      } else {
        var billed = billedInCycle(store, row.project_id, row.sub_id, cycle);
        var reasons = (/\((.*)\)\.$/.exec(a.summary) || [])[1] || model.hold.reasons.join('; ');
        add(ctx, Object.assign(common, { trigger: 'Pay check: ' + reasons, approval: APPROVAL_INTERNAL, subject: 'Payment hold: ' + where,
          message: sub.name + ' is on payment hold. ' + reasons + '.' + (billed ? ' Billed this pay cycle: ' + formatUsd(billed) + '.' : '') }));
      }
    });

    // Entries the record's state gives when the log holds no notice for them. A notice the code does not send is
    // "Not sent", with the design kept as a preview.
    var notBuilt = { status: 'Not sent', approval: APPROVAL_NOT_BUILT };
    if (model.pending) {
      add(ctx, Object.assign({ event: 'Certificate received', to_role: 'Subcontractor contact', time: drafted,
        trigger: PLANNED + 'Would send when a certificate is uploaded', subject: subject,
        message: 'We received your certificate ' + model.pending.id + ' for ' + staff.name + '. We are checking it now. You do not need to do anything yet.' }, notBuilt));
    }
    if (model.pending && model.pending.stage === 'deficiency') {
      var found = model.pending.check.deficiencies.length + (model.pending.check.deficiencies.length === 1 ? ' deficiency' : ' deficiencies') + ' found on ' + model.pending.id;
      var pendingPm = storedNotice(drafts, model.pending, 'deficiency_notice');
      var pendingFix = aiDraftsOn() ? storedNotice(drafts, model.pending, 'correction_request') : { by: 'Template', draft: null };
      if (!hasLogged(row.record_id, 'notice_deficiency')) {
        add(ctx, { event: 'Deficiency found', to_role: 'Project manager', time: drafted, status: 'Sent', drafted_by: pendingPm.by, approval: APPROVAL_INTERNAL,
          trigger: found, subject: 'Decision needed: ' + where,
          message: pendingPm.draft ? assembleDeficiencyNotice(sub.name, model.pending.check.deficiencies, pendingPm.draft, SAMPLE_RECORD_LINK + row.record_id)
            : sub.name + ' has gaps against the project requirements.\n' + gapLines(model.pending) + '\n\nWaive or reject? Open the record: ' + SAMPLE_RECORD_LINK + row.record_id });
      }
      add(ctx, Object.assign({ event: 'Deficiency found', to_role: 'Subcontractor contact', time: drafted, drafted_by: 'Template',
        trigger: PLANNED + 'Would send with the project manager copy. ' + found,
        subject: subject,
        message: 'We checked certificate ' + model.pending.id + ' against the project requirements. The project manager is deciding what happens next. You do not need to do anything yet.\n' + gapLines(model.pending) }, notBuilt));
      add(ctx, { event: 'Correction request', to_role: 'Subcontractor contact', time: drafted, drafted_by: pendingFix.by, approval: APPROVAL_PERSON,
        status: 'Not sent', trigger: 'Sent only if the project manager rejects the certificate', subject: subject,
        message: pendingFix.draft ? assembleCorrectionRequest(model.pending.check.deficiencies, pendingFix.draft, SAMPLE_UPLOAD_LINK)
          : correctionText(model.pending.check.deficiencies, SAMPLE_UPLOAD_LINK) });
    }
    if (model.pending && model.pending.stage === 'needs_review' && /^Low-confidence/.test(model.pending.reason || '')) {
      var percent = Math.round(model.pending.confidence * 100);
      add(ctx, Object.assign({ event: 'Low-confidence reading', to_role: 'Accountant', time: drafted,
        trigger: PLANNED + 'Would send when a reading is below the limit. Read at ' + percent + '% confidence', subject: 'Needs review: ' + where,
        message: model.pending.id + ' for ' + sub.name + ' was read at ' + percent + '% confidence, below the ' + Math.round(CONFIDENCE_GATE * 100) + '% limit. Check the reading before anything else happens.' }, notBuilt));
    }
    if (isUnreadable(model.pending)) {
      // The code holds this draft for the accountant. It goes out when the accountant chooses to send it.
      add(ctx, { event: 'Resend request', to_role: 'Subcontractor contact', time: drafted, approval: APPROVAL_PERSON, status: 'Waiting for approval',
        trigger: 'Unreadable file', subject: subject, message: resendText(SAMPLE_UPLOAD_LINK) });
    }
    if (model.pending && model.pending.stage === 'approval' && model.pending.replaces) {
      // The renewal email goes when a person approves the renewal.
      add(ctx, { event: 'Renewal accepted', to_role: 'Subcontractor contact', time: drafted, approval: APPROVAL_PERSON, status: 'Waiting for approval',
        trigger: 'Renewal passed every check; waiting for approval', subject: subject,
        message: 'Your renewal ' + model.pending.id + ' is approved. It expires ' + dateLabel(model.pending.expiration_date) + '.' });
    }
    if (model.current && model.current.replaces && !model.pending && !hasLogged(row.record_id, 'notice_renewal_accepted')) {
      var byAccountant = /approved by the accountant|waived by the project manager/.test(model.current.decision || '');
      add(ctx, { event: 'Renewal accepted', to_role: 'Subcontractor contact', time: drafted, status: 'Sent',
        approval: byAccountant ? APPROVAL_PERSON : APPROVAL_REVIEW_MODE, approved_by: byAccountant ? approverBefore(row.record_id, log.length) : '',
        trigger: 'Renewal ' + model.current.id + ' accepted', subject: subject,
        message: 'Your renewal ' + model.current.id + ' is approved. It expires ' + dateLabel(model.current.expiration_date) + '.' });
    }
    if (!model.closed && !model.pending && model.current) {
      var days = daysUntil(today, model.current.expiration_date);
      var expiry = model.current.expiration_date;
      var daily = ' The daily job sends it at its next run.';
      if (days >= 0 && days <= 30 && !hasLogged(row.record_id, 'notice_reminder_30d') && days > 7) {
        add(ctx, { event: 'Expiring in 30 days', to_role: 'Subcontractor contact', time: addDays(expiry, -30) + 'T06:00:00', approval: APPROVAL_DAILY,
          status: model.nudges.d30 ? 'Sent' : 'Not sent', trigger: 'Policy expires ' + dateLabel(expiry) + (model.nudges.d30 ? '' : '.' + daily), subject: subject,
          message: 'Your policy expires ' + dateLabel(expiry) + '. Please send your renewal. Upload your renewal here: ' + SAMPLE_UPLOAD_LINK });
      }
      if (days >= 0 && days <= 30 && !hasLogged(row.record_id, 'notice_reminder_7d')) {
        // Inside 7 days the follow-up goes out. Before that it is a drafted entry the daily job sends on the 7-day mark.
        add(ctx, { event: 'Expiring in 7 days', to_role: 'Subcontractor contact', approval: APPROVAL_DAILY,
          time: days <= 7 ? addDays(expiry, -7) + 'T06:00:00' : drafted,
          status: days > 7 ? 'Not sent' : (model.nudges.d7 ? 'Sent' : 'Not sent'),
          trigger: days > 7 ? 'Scheduled for ' + dateLabel(addDays(expiry, -7)) + ', 7 days before expiry' : 'Policy expires ' + dateLabel(expiry) + (model.nudges.d7 ? '' : '.' + daily),
          subject: subject,
          message: 'Reminder: your policy expires ' + dateLabel(expiry) + '. Upload your renewal here: ' + SAMPLE_UPLOAD_LINK });
      }
    }
    if ((status === 'expired' || model.hold.on) && !hasLogged(row.record_id, 'notice_payment_hold')) {
      var owed = billedInCycle(store, row.project_id, row.sub_id, cycle);
      var expired = status === 'expired';
      var why = model.hold.reasons.length ? model.hold.reasons.join('; ') : 'Policy expired';
      add(ctx, { event: 'Payment hold notice', to_role: 'Accountant', time: expired ? addDays(model.current.expiration_date, 1) + 'T06:00:00' : drafted,
        status: 'Sent', approval: APPROVAL_INTERNAL, trigger: expired ? 'Policy expired ' + dateLabel(model.current.expiration_date) : 'Pay check: ' + why, subject: 'Payment hold: ' + where,
        message: sub.name + ' is on payment hold. ' + why + '.' + (owed ? ' Billed this pay cycle: ' + formatUsd(owed) + '.' : '') });
    }
    if (status === 'awaiting' && log.some(function (a) { return a.record_id === row.record_id && a.event_type === 'record_created'; })) {
      add(ctx, Object.assign({ event: 'Upload link', to_role: 'Subcontractor contact', time: drafted,
        trigger: PLANNED + 'Would send when the record is created', subject: subject,
        message: 'Please upload your certificate of insurance for ' + staff.name + ' here: ' + SAMPLE_UPLOAD_LINK }, notBuilt));
    }
  });

  // The weekly digest: one entry for the accountants, with every held subcontractor from the payment hold list.
  // No code sends it yet, so it shows as "Not sent".
  var active = projects.filter(function (p) { return p.status === 'active'; });
  var holds = portfolioHoldList(deps);
  var names = [], emails = [];
  active.forEach(function (p) {
    if (names.indexOf(p.accountant_name) < 0) { names.push(p.accountant_name); emails.push(p.accountant_email); }
  });
  var lines = holds.rows.map(function (h) { return '- ' + h.subcontractor + ', ' + h.project + ': ' + h.amount + '. ' + h.reasons.join('; ') + '.'; });
  var digestBody = holds.rows.length
    ? 'Hello ' + names.map(firstName).join(' and ') + ',\n\nThese subcontractors are on payment hold for the ' + dateLabel(holds.pay_date) + ' pay run.\n' +
      lines.join('\n') + '\n\nTotal on hold: ' + holds.total + '.' + NOTIFICATION_FOOTER
    : 'Hello ' + names.map(firstName).join(' and ') + ',\n\n' + holds.empty + NOTIFICATION_FOOTER;
  out.push({
    id: '', event_type: EVENT_TYPE[DIGEST_EVENT], event: DIGEST_EVENT, trigger: PLANNED + 'Would send weekly, Thursday 6:00 AM',
    time: latestThursday(today) + 'T06:00:00',
    project_id: '', project: 'All active projects', record_id: '', sub_name: '',
    to_role: 'Accountant', to_name: names.join(', '), to_email: emails.join(', '),
    drafted_by: 'Template', approval: APPROVAL_NOT_BUILT, approved_by: '', status: 'Not sent',
    subject: DIGEST_EVENT + (holds.pay_date ? ': ' + dateLabel(holds.pay_date) + ' pay run' : ''), body: digestBody
  });

  // Newest first. Equal times keep the order built above.
  var rows = out.map(function (r, i) { return { r: r, i: i }; })
    .sort(function (a, b) { return String(b.r.time).localeCompare(String(a.r.time)) || (a.i - b.i); })
    .map(function (x, n) { x.r.id = 'NTF-' + String(n + 1).padStart(3, '0'); return x.r; });
  return {
    rows: rows, events: NOTIFICATION_EVENTS.slice(),
    source: 'activity_log, compliance_records, certificates, subcontractors, projects',
    last_updated: rows.length ? rows[0].time : '', sample: 'Sample data', banner: NOTIFICATION_BANNER
  };
}
