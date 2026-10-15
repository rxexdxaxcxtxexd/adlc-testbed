// The daily job: recompute every compliance record from its certificate, the queue and the date, send the
// 30 and 7 day reminders, run the pay check, and keep each accepted certificate on the calendar (docs/decisions.md, Phase 5).
// deps = { store, mailer, clock, calendar, cursor, timers, uploadBaseUrl }.
// The cursor is the saved place { date, after, projects }: the date the pass started on, the number of the
// last record done, and a checked and changed count for each project.

function idNumber(id) {
  return parseInt(String(id).replace(/\D/g, ''), 10) || 0;
}

function countText(n, word) {
  return n + ' ' + word + (n === 1 ? '' : 's');
}

// Only a record the day changed is written, so last_updated means "last changed".
function dayChangedRecord(before, after) {
  return after.log.length > 0 || before.status !== after.status ||
    JSON.stringify(before.nudges) !== JSON.stringify(after.nudges) ||
    JSON.stringify(before.hold) !== JSON.stringify(after.hold);
}

function logDaily(deps, recordId, eventType, summary) {
  withScriptLock(function () {
    deps.store.appendRow('activity_log', { record_id: recordId, time: deps.clock.now(), who: 'System', event_type: eventType, summary: summary });
  });
}

// One record: recompute, mail, save if changed, then bring the calendar in line. Returns whether it changed.
// The mail goes before the save, inside the lock. A mail failure then saves nothing, so the log never says
// "reminder sent" for a reminder that was not, and the next daily run tries again.
function checkOneRecord(deps, recordId, date) {
  var store = deps.store;
  var done = withScriptLock(function () {
    var recRow = findRow(store.readRows('compliance_records'), 'record_id', recordId);
    var project = findRow(store.readRows('projects'), 'project_id', recRow.project_id);
    var record = loadRecord(store, recRow, date);
    var out = nextStatus(record, { type: 'day_passed', uploadLink: uploadLinkFor(deps, recRow) }, date, project.review_mode, TOLERANCE_MATRIX);
    // The pay check follows the day check on the day's own result (docs/decisions.md, Phase 5, ticket 08).
    var pay = nextStatus(out.record, { type: 'pay_check' }, date, project.review_mode, TOLERANCE_MATRIX);
    out = { record: pay.record, effects: out.effects.concat(pay.effects) };
    sendEffects(deps.mailer, out.effects, project, out.record);
    var changed = dayChangedRecord(record, out.record);
    if (changed) saveRecord(store, recordId, out.record, deps.clock.now(), '');
    return { project: project, record: out.record, changed: changed, calendar: calendarChanges(record, out.record) };
  });
  applyCalendar(deps, recordId, done.project, done.record, done.calendar);
  return done.changed;
}

// One run of the daily job. startNew is true for the daily timer, which starts a fresh pass and drops an
// unfinished one, and false for a one-off timer, which continues the saved pass. Returns
// { status: 'continues', processed }, { status: 'done', checked, changed }, { status: 'refused' } or { status: 'none' }.
function processDailyBatch(deps, startNew) {
  var store = deps.store;
  // The one-off timer that started this run has done its job.
  deps.timers.clearContinuations();
  var saved = deps.cursor.get();
  if (!startNew && !saved) return { status: 'none' };
  if (!deps.uploadBaseUrl) {
    deps.cursor.clear();
    logDaily(deps, '', 'daily_refused', 'The daily check did not run. The upload page address is not set. Set Script Property ' + PROP_UPLOAD_BASE_URL + ' first.');
    return { status: 'refused' };
  }
  // A Sheet built before a column was added gets the column now. Without it a value saved for that column
  // is dropped without a word, and the daily job would add the same calendar event every day.
  if (startNew) {
    withScriptLock(function () {
      Object.keys(SCHEMA).forEach(function (tab) { store.ensureTab(tab, SCHEMA[tab]); });
    });
  }
  var pass = startNew ? { date: deps.clock.today(), after: 0, projects: {} } : saved;

  var projectOf = {};
  store.readRows('compliance_records').forEach(function (r) { projectOf[r.record_id] = r.project_id; });
  var waiting = Object.keys(projectOf)
    .filter(function (id) { return idNumber(id) > pass.after; })
    .sort(function (a, b) { return idNumber(a) - idNumber(b); });
  var batch = waiting.slice(0, DAILY_BATCH_SIZE);

  batch.forEach(function (id) {
    var tally = pass.projects[projectOf[id]] || (pass.projects[projectOf[id]] = { checked: 0, changed: 0 });
    tally.checked += 1;
    try {
      if (checkOneRecord(deps, id, pass.date)) tally.changed += 1;
    } catch (err) {
      logDaily(deps, id, 'daily_failed', 'The daily check failed for this record. ' + String(err && err.message ? err.message : err));
    }
    pass.after = idNumber(id);
  });

  if (waiting.length > batch.length) {
    deps.cursor.set(pass);
    deps.timers.scheduleContinuation(DAILY_RETRIGGER_MS);
    return { status: 'continues', processed: batch.length };
  }
  deps.cursor.clear();
  var checked = 0;
  var changed = 0;
  Object.keys(pass.projects).forEach(function (projectId) {
    var t = pass.projects[projectId];
    checked += t.checked;
    changed += t.changed;
    logDaily(deps, projectId, 'daily_check', 'Daily check ran: ' + countText(t.checked, 'record') + ' checked, ' + t.changed + ' changed.');
  });
  return { status: 'done', checked: checked, changed: changed };
}
