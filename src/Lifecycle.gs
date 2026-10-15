// Compliance core: status and lifecycle. Pure: no Google services, no page code.
// Dates are ISO strings (YYYY-MM-DD) in the script time zone.

var MS_PER_DAY = 86400000;

function addDays(iso, n) {
  var d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysUntil(from, to) {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / MS_PER_DAY);
}

// Status is derived, never set by hand: it follows the current certificate, the queue and the date.
function deriveStatus(r, today) {
  if (r.closed) return 'closed';
  if (r.current) {
    var d = daysUntil(today, r.current.expiration_date);
    if (d < 0) return 'expired';
    if (d <= 30) return 'expiring_soon';
    return 'compliant';
  }
  if (r.pending) return r.pending.stage === 'needs_review' ? 'needs_review' : 'in_review';
  return 'awaiting';
}

var CONFIDENCE_GATE = 0.85;

// Expiring soon counts as compliant for payment hold (docs/decisions.md, Phase 1).
function isCompliantStatus(s) {
  return s === 'compliant' || s === 'expiring_soon';
}

var HOLD_REASON = {
  awaiting: 'No certificate received', needs_review: 'Certificate needs review',
  in_review: 'Certificate waiting for a decision', closed: 'Record closed'
};

function holdReasons(r, today) {
  var s = deriveStatus(r, today);
  var reasons = [];
  if (!isCompliantStatus(s)) {
    if (s === 'expired') reasons.push(r.pending ? 'Policy expired; renewal not yet approved' : 'Policy expired');
    else reasons.push(HOLD_REASON[s]);
  }
  if (!r.sub.w9) reasons.push('No W-9 on file');
  return reasons;
}

function newRecord(sub, billedThisCycle) {
  return {
    sub: sub, closed: false, current: null, pending: null, history: [], hold: { on: false, reasons: [] },
    billedThisCycle: billedThisCycle || 0, nudges: { d30: false, d7: false }, log: [], status: 'awaiting'
  };
}

// Seam: nextStatus(record, event, today, mode, matrix) returns { record, effects } or
// { record, effects: [], refused }. Effects are messages (to, kind, text); adapters send them.
function nextStatus(record, event, today, mode, matrix) {
  var r = JSON.parse(JSON.stringify(record));
  var effects = [];
  // notice is the event_type of a line that records a sent notice (NOTICE_TYPES in Notifications.gs).
  function log(who, text, notice) {
    var entry = { date: today, who: who, text: text };
    if (notice) entry.notice = notice;
    r.log.push(entry);
  }
  function send(to, kind, text) { effects.push({ to: to, kind: kind, text: text }); }
  function refuse(why) { return { record: record, effects: [], refused: why }; }
  function deficiencyText(cert) { return cert.check.deficiencies.map(function (d) { return d.text; }).join('; '); }

  var recordLink = event.recordLink || '';

  function accept(cert, how, note) {
    var renewal = !!r.current;
    if (r.current) r.history.push(Object.assign({}, r.current, { outcome: 'Replaced by ' + cert.id }));
    r.current = Object.assign({}, cert, { decision: how });
    if (note) r.current.decision_note = note;
    delete r.current.stage;
    delete r.current.reason;
    r.pending = null;
    r.nudges = { d30: false, d7: false };
    log('System', cert.id + ' accepted (' + how + '). Expires ' + cert.expiration_date + '.', renewal ? 'notice_renewal_accepted' : 'notice_certificate_approved');
    send('Subcontractor', 'email', 'Your certificate ' + cert.id + ' is approved.');
    send('Accountant', 'notice', r.sub.name + ': ' + cert.id + ' filed and approved (' + how + ').');
  }

  function route(cert) {
    cert.check = evaluateCoi(cert.values, r.sub.scope, matrix, { insuredName: r.sub.name });
    if (!cert.check.pass) {
      r.pending = Object.assign(cert, { stage: 'deficiency' });
      var count = cert.check.deficiencies.length;
      log('System', count + (count === 1 ? ' deficiency' : ' deficiencies') + ' found. Sent to the project manager.', 'notice_deficiency');
      send('Project manager', 'email', r.sub.name + ': ' + deficiencyText(cert) + '. Waive or reject?' + (recordLink ? ' Open the record: ' + recordLink : ''));
    } else if (mode === 'review_all') {
      r.pending = Object.assign(cert, { stage: 'approval' });
      log('System', 'Passed every check. Ready for approval.');
    } else {
      accept(cert, mode === 'automatic' ? 'approved automatically (automatic mode)' : 'approved automatically');
    }
  }

  switch (event.type) {
    case 'certificate_received': {
      if (r.closed) return refuse('This record is closed. The upload is refused.');
      var f = event.file;
      var all = [r.current, r.pending].concat(r.history).filter(Boolean);
      if (all.some(function (c) { return c.fingerprint === f.fingerprint; })) {
        log('System', 'Duplicate file received and ignored. Nothing changed.', 'notice_duplicate');
        send('Subcontractor', 'notice', 'We already have this certificate. No action needed.');
        break;
      }
      if (r.pending) {
        r.history.push(Object.assign({}, r.pending, { outcome: 'Replaced in the queue by a newer upload' }));
        log('System', r.pending.id + ' was still in the queue; the newer upload replaces it.');
        r.pending = null;
      }
      var cert = {
        id: f.id, fingerprint: f.fingerprint, received: today, values: f.values, confidence: f.confidence,
        expiration_date: f.values ? f.values.expiration_date : null, replaces: r.current ? r.current.id : null
      };
      if (!f.readable) {
        r.pending = Object.assign(cert, { stage: 'needs_review', reason: 'Unreadable file' });
        log('System', 'Unreadable file. Sent to the accountant queue.');
        send('Accountant', 'draft', 'Draft for the subcontractor, held for you: "Please resend your certificate as a standard PDF."');
        break;
      }
      if (f.confidence < CONFIDENCE_GATE) {
        r.pending = Object.assign(cert, { stage: 'needs_review', reason: 'Low-confidence reading (' + f.confidence.toFixed(2) + ', below ' + CONFIDENCE_GATE + ')' });
        log('System', 'Reading confidence ' + f.confidence.toFixed(2) + ' is below ' + CONFIDENCE_GATE + '. Sent to the accountant queue.');
        break;
      }
      route(cert);
      break;
    }
    case 'reading_confirmed': {
      if (!r.pending || !r.pending.values || r.pending.reason === 'Unreadable file') {
        return refuse('There is no readable certificate waiting to be checked.');
      }
      var correctionNote = String(event.note || '').trim();
      if (!correctionNote) return refuse('A correction needs a note. Write what you changed and why.');
      var who = event.who || 'Accountant';
      var corrected = Object.assign({}, r.pending, { values: event.values, confidence: 1, expiration_date: event.values.expiration_date, confirmedBy: who });
      delete corrected.stage;
      delete corrected.reason;
      var changes = correctionChanges(r.pending.values || { limits: {} }, event.values);
      if (!changes.length) log(who, 'Confirmed the reading of ' + corrected.id + ' with no changes. Note: ' + correctionNote);
      changes.forEach(function (c, i) {
        var line = c + ' on ' + corrected.id + '. Note: ' + correctionNote;
        // The caller wrote this correction to the calibration test set (src/Flywheel.gs).
        if (event.addedToTestSet && i === changes.length - 1) line += (/[.!?]$/.test(line) ? ' ' : '. ') + 'Added to the test set.';
        log(who, line);
      });
      r.pending = null;
      route(corrected);
      break;
    }
    case 'resend_requested': {
      if (!r.pending || r.pending.reason !== 'Unreadable file') return refuse('There is no unreadable file waiting.');
      r.history.push(Object.assign({}, r.pending, { outcome: 'Unreadable; resend requested' }));
      r.pending = null;
      log(event.who || 'Accountant', 'Asked the subcontractor to resend.', 'notice_resend_request');
      send('Subcontractor', 'email', resendText(event.uploadLink));
      break;
    }
    case 'approve': {
      if (!r.pending || r.pending.stage !== 'approval') {
        return refuse('Nothing is waiting for approval. A deficiency needs a waive or reject from the project manager instead.');
      }
      log(event.who || 'Accountant', 'Approved ' + r.pending.id + '.');
      accept(r.pending, 'approved by the accountant');
      break;
    }
    case 'waive': {
      if (!r.pending || r.pending.stage !== 'deficiency') return refuse('There is no deficiency waiting for a decision.');
      var note = String(event.note || '').trim();
      if (!note) return refuse('A waiver needs a note. Write why this deficiency is acceptable.');
      log(event.who || 'Project manager', 'Waived: ' + deficiencyText(r.pending) + '. Note: ' + note);
      accept(r.pending, 'waived by the project manager', note);
      break;
    }
    case 'reject': {
      if (!r.pending || r.pending.stage !== 'deficiency') return refuse('There is no deficiency waiting for a decision.');
      r.history.push(Object.assign({}, r.pending, { outcome: 'Rejected' }));
      log(event.who || 'Project manager', 'Rejected ' + r.pending.id + '. Correction request sent.', 'notice_correction_request');
      send('Subcontractor', 'email', correctionText(r.pending.check.deficiencies, event.uploadLink));
      r.pending = null;
      break;
    }
    case 'day_passed': {
      if (r.closed) break;
      if (r.current && !r.pending) {
        var d = daysUntil(today, r.current.expiration_date);
        var renewalLink = event.uploadLink ? ' Upload your renewal here: ' + event.uploadLink : '';
        // One reminder a day at most (docs/decisions.md, Phase 5): inside 7 days only the follow-up goes,
        // and the 30-day reminder counts as sent.
        if (d >= 0 && d <= 7 && !r.nudges.d7) {
          r.nudges = { d30: true, d7: true };
          send('Subcontractor', 'email', 'Reminder: your policy expires ' + r.current.expiration_date + '.' + renewalLink);
          log('System', '7-day follow-up sent.', 'notice_reminder_7d');
        } else if (d >= 0 && d <= 30 && !r.nudges.d30) {
          r.nudges.d30 = true;
          send('Subcontractor', 'email', 'Your policy expires ' + r.current.expiration_date + '. Please send your renewal.' + renewalLink);
          log('System', '30-day renewal reminder sent.', 'notice_reminder_30d');
        }
      }
      // Compared with the stored status, so a day the job missed still logs the expiry.
      if (record.status !== 'expired' && deriveStatus(r, today) === 'expired') log('System', 'Policy expired.');
      break;
    }
    case 'pay_check': {
      if (r.closed) break;
      // Only a change is logged and mailed, so the daily job does not repeat itself (docs/decisions.md, Phase 5).
      if (!r.billedThisCycle) {
        if (r.hold.on) {
          r.hold = { on: false, reasons: [] };
          log('System', 'Payment hold cleared: no bill this cycle.');
        }
        break;
      }
      var reasons = holdReasons(r, today);
      if (reasons.length && !r.hold.on) {
        r.hold = { on: true, reasons: reasons };
        log('System', 'Pay check: on payment hold (' + reasons.join('; ') + ').', 'notice_payment_hold');
        send('Accountant', 'report', 'Payment hold list: ' + r.sub.name + ', ' + formatUsd(r.billedThisCycle) + '. ' + reasons.join('; ') + '.');
      }
      break;
    }
    case 'w9_set': {
      var wantW9 = !!event.onFile;
      if (r.sub.w9 === wantW9) return refuse('The W-9 is already marked ' + (wantW9 ? 'on file' : 'missing') + '.');
      r.sub.w9 = wantW9;
      log(event.who || 'Accountant', wantW9 ? 'Marked W-9 on file.' : 'Marked W-9 missing.');
      break;
    }
    case 'close': {
      if (r.closed) return refuse('This record is already closed.');
      if (r.pending) return refuse('A certificate is waiting in the queue. Decide it first, then close the record.');
      r.closed = true;
      log('Accountant', 'Closed the record. Tracking stops; history is kept for audit.');
      break;
    }
    default:
      return refuse('Unknown action.');
  }

  // A payment hold releases itself once its reasons are gone.
  if (r.hold.on) {
    var still = holdReasons(r, today);
    if (!still.length) {
      r.hold = { on: false, reasons: [] };
      log('System', 'Payment hold released.', 'notice_payment_cleared');
      send('Accountant', 'notice', r.sub.name + ' is cleared for payment.');
    } else {
      r.hold.reasons = still;
    }
  }
  r.status = deriveStatus(r, today);
  return { record: r, effects: effects };
}

// The calendar work a change of current certificate needs. Pure. A new current certificate gets an
// event, the replaced one loses its event, and a current certificate that has none yet gets one
// (this is how the daily job fills a gap). Each change is { action, certificateId, eventId or date }.
function calendarChanges(before, after) {
  var changes = [];
  var was = before.current;
  var now = after.current;
  if (was && (!now || was.id !== now.id) && was.calendar_event_id) {
    changes.push({ action: 'delete', certificateId: was.id, eventId: was.calendar_event_id });
  }
  if (now && !now.calendar_event_id) {
    changes.push({ action: 'create', certificateId: now.id, date: now.expiration_date });
  }
  return changes;
}

// The email a subcontractor gets when a file could not be read. link is optional.
function resendText(link) {
  return 'Please resend your certificate as a standard PDF.' + (link ? ' Upload it here: ' + link : '');
}

// The email a subcontractor gets when the project manager rejects a certificate: every
// deficiency with the value found and the value required. link is optional.
function correctionText(deficiencies, link) {
  return 'Your certificate does not meet the project requirements. Please send a corrected certificate.\n' +
    deficiencies.map(function (d) { return '- ' + d.text; }).join('\n') +
    (link ? '\nUpload it here: ' + link : '');
}

var CORRECTION_LABEL ={ insured_name: 'Insured name', expiration_date: 'Expiry date' };
var CORRECTION_BOOLEANS = ['additional_insured_endorsement', 'project_address', 'certificate_holder'];

// What an accountant changed in a reading, as one text per changed value, old to new.
// Pure. Unchanged values give no text.
function correctionChanges(before, after) {
  var changes = [];
  function note(label, from, to) {
    if (from !== to) changes.push('Changed ' + label + ' from ' + from + ' to ' + to);
  }
  var money = function (n) { return n == null ? 'Not shown' : formatUsd(n); };
  var printed = function (b) { return b === true ? 'Printed' : 'Not printed'; };
  note(CORRECTION_LABEL.insured_name, before.insured_name || 'Not shown', after.insured_name || 'Not shown');
  COI_LIMITS.forEach(function (f) { note(COI_LABEL[f], money((before.limits || {})[f]), money((after.limits || {})[f])); });
  CORRECTION_BOOLEANS.forEach(function (f) { note(COI_LABEL[f], printed(before[f]), printed(after[f])); });
  var days = function (n) { return n == null ? 'Not shown' : n + ' days'; };
  note(COI_LABEL.cancellation_notice_days, days(before.cancellation_notice_days), days(after.cancellation_notice_days));
  note(CORRECTION_LABEL.expiration_date, before.expiration_date || 'Not shown', after.expiration_date || 'Not shown');
  return changes;
}

var TILE_WORD = { red: 'At risk', yellow: 'Watch', green: 'On track' };

// Seam: projectTile(records, today). Counts and colors follow docs/metric-definitions.md;
// colors are evaluated red, then yellow, then green.
function projectTile(records, today) {
  var open = records.filter(function (r) { return !r.closed; });
  var st = open.map(function (r) { return deriveStatus(r, today); });
  var held = open.filter(function (r) { return r.hold && r.hold.on; });
  var count = function (pred) { return open.filter(pred).length; };
  var t = {
    expected_count: open.length,
    compliant_count: count(function (r, i) { return isCompliantStatus(st[i]); }),
    expired_count: count(function (r, i) { return st[i] === 'expired'; }),
    expiring_30d_count: count(function (r, i) { return st[i] === 'expiring_soon' && !r.pending; }),
    // The latest certificate is the one in the queue; an accepted one has no open limit deficiency.
    below_limits_count: count(function (r) {
      return !!(r.pending && r.pending.check && r.pending.check.deficiencies.some(function (d) { return d.kind === 'limit'; }));
    }),
    dollars_on_hold_usd: held.reduce(function (sum, r) { return sum + (r.billedThisCycle || 0); }, 0)
  };
  var waiting = count(function (r, i) { return st[i] === 'awaiting' || !!r.pending; });
  var color;
  if (t.expired_count > 0 || held.length > 0) color = 'red';
  else if (t.expiring_30d_count > 0 || waiting > 0) color = 'yellow';
  else if (t.compliant_count === t.expected_count) color = 'green';
  else color = 'yellow';
  return Object.assign({ color: color, word: TILE_WORD[color] }, t);
}
