// Entry points: the internal web app and the owner's setup run.

function realDeps(reader) {
  var props = PropertiesService.getScriptProperties().getProperties();
  var sheetId = props[PROP_SHEET_ID];
  if (!sheetId) throw new Error('Script Property ' + PROP_SHEET_ID + ' is not set. Run setupDemo first.');
  return {
    store: SheetStore(sheetId), reader: reader, mailer: GmailMailer(), clock: ScriptClock(), newToken: Utilities.getUuid,
    calendar: GoogleCalendar(), cursor: ScriptCursor(), timers: ScriptTimers(),
    uploadBaseUrl: props[PROP_UPLOAD_BASE_URL] || '',
    internalBaseUrl: props[PROP_INTERNAL_BASE_URL] || ''
  };
}

// Writes the run time of one page call to the execution log, so a slow call shows up by name.
function timed(name, fn) {
  var start = Date.now();
  try { return fn(); } finally { console.log(name + ' ' + (Date.now() - start) + ' ms'); }
}

// Owner runs this from the script editor: builds the Sheet and Drive tree, seeds the
// sample project and sends one canned certificate through the whole path. The editor's
// Execution log shows only printed lines, so the result is printed as well as returned.
function setupDemo() {
  if (isDemoMode()) return demoRefusal('setupDemo');
  return setupDemo_();
}

// Private version for the owner to run from the script editor, where demo mode does not apply.
function setupDemo_() {
  var message = buildDemo_();
  console.log(message);
  return message;
}

function buildDemo() {
  if (isDemoMode()) return demoRefusal('buildDemo');
  return buildDemo_();
}

function buildDemo_() {
  var props = PropertiesService.getScriptProperties();
  var deps = withScriptLock(function () {
    if (!props.getProperty(PROP_SHEET_ID)) {
      var created = SpreadsheetApp.create(DRIVE_ROOT + ' data');
      props.setProperty(PROP_SHEET_ID, created.getId());
    }
    var ss = SpreadsheetApp.openById(props.getProperty(PROP_SHEET_ID));
    // Dates read back in the Sheet's zone; match the script's so ISO dates do not shift.
    ss.setSpreadsheetTimeZone(Session.getScriptTimeZone());
    var d = realDeps(FakeReader(SAMPLE_READING));
    initProject(d.store);
    var blank = ss.getSheetByName('Sheet1');
    if (blank) ss.deleteSheet(blank);
    DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getRootFolder().getFoldersByName(DRIVE_ROOT).next());
    return d;
  });

  if (deps.store.readRows('projects').length) {
    withScriptLock(function () { fillSampleNames(deps.store); });
    var rec = deps.store.readRows('compliance_records')[0];
    var certId = rec.queued_certificate_id || rec.current_certificate_id || 'No certificate';
    return 'Already seeded; nothing changed. ' + certId + ' is ' + rec.status + '.';
  }
  seedSampleProject(deps);
  var token = deps.store.readRows('compliance_records')[0].upload_token;
  var result = processCertificate(deps, token, { name: 'ridgeline-coi.pdf', fingerprint: 'sample-ridgeline-1', link: '' });
  return 'Seeded ' + SAMPLE_PROJECT.name + '. ' + result.certificate_id + ' is ' + result.status + '.';
}

// A request with a t parameter is an upload link; any other request gets the worklist
// (docs/decisions.md, Phase 2: one script project carries both deployments).
function doGet(e) {
  if (e && e.parameter && e.parameter.t !== undefined) return uploadPage(e.parameter.t);
  var page = HtmlService.createTemplateFromFile('src/Worklist');
  var initial = openingView(e && e.parameter);
  initial.demo = isDemoMode();
  // ?tour=play starts the guided tour on autoplay. The page runs in an iframe, so it cannot read the query itself. No other value counts.
  if (e && e.parameter && e.parameter.tour === 'play') initial.tour = 'play';
  // The first screen's data rides in the page, so it shows figures with no second round trip.
  // If the read fails, the page asks for the data itself and shows its own error.
  try { initial.data = timed('doGet appData', function () { return appData(realDeps(null)); }); } catch (err) { initial.data = null; }
  page.initial = JSON.stringify(initial).replace(/</g, '\\u003c');
  return page.evaluate().setTitle('COI Check · Harborline Builders')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

// The record and role a deficiency email link opens (docs/decisions.md, Phase 3). An unknown role is dropped.
function openingView(params) {
  var p = params || {};
  return { record: p.record ? String(p.record) : '', role: ROLES[p.as] ? String(p.as) : '' };
}

// The deps for a page call. In demo mode the browser's overlay (its own changed rows) is laid over the
// real rows, and nothing can be written. With demo mode off the overlay is ignored.
function pageDeps(overlay) {
  var real = realDeps(null);
  return isDemoMode() ? demoDeps(real, overlay) : real;
}

// Called from the page through google.script.run. The last argument of each page call is the demo overlay.
function getWorklist(projectId, overlay) {
  return worklistView(pageDeps(overlay), projectId || SAMPLE_PROJECT.project_id);
}

// The portfolio, the worklist and holds for every active project, and the ROI estimate, in one call.
function getAppData(overlay) {
  return timed('getAppData', function () { return appData(pageDeps(overlay)); });
}

// The payment hold list: every held sub who billed in the current pay cycle, the amount and every reason.
function getPaymentHoldList(projectId, overlay) {
  var deps = pageDeps(overlay);
  return projectId === 'all' ? portfolioHoldList(deps) : paymentHoldList(deps, projectId || SAMPLE_PROJECT.project_id);
}

// Read-only subcontractor directory rows and counts. The last argument is the demo overlay.
function getDirectory(overlay) {
  return timed('getDirectory', function () { return directoryView(readViewDeps(pageDeps(overlay))); });
}

function getRecordDetail(recordId, overlay) {
  return timed('getRecordDetail', function () { return recordDetail(readViewDeps(pageDeps(overlay)), recordId); });
}

// action is approve, correct, resend, w9, waive or reject. The page sends the role chosen in the "Demo only" switcher.
// In demo mode the action runs against the overlay and returns the changed rows. Nothing is saved or sent.
function runReviewAction(recordId, role, action, payload, overlay) {
  if (action === 'reject' && (!payload || typeof payload.approved_text !== 'string' || typeof payload.certificate_id !== 'string')) {
    return { ok: false, message: 'Open the correction request and approve its wording before you send it.' };
  }
  if (isDemoMode()) return demoReviewAction(realDeps(null), overlay, recordId, role, action, payload);
  return reviewAction(realDeps(null), recordId, role, action, payload);
}

function changeReviewMode(role, mode, projectId, overlay) {
  if (isDemoMode()) return demoReviewMode(realDeps(null), overlay, projectId || SAMPLE_PROJECT.project_id, role, mode);
  return setReviewMode(realDeps(null), projectId || SAMPLE_PROJECT.project_id, role, mode);
}

// Private (the name ends in "_"), so google.script.run cannot call it. The app runs as the owner, so a public
// version would let any visitor read any Drive file the owner can open, given its ID.
function readDriveBase64_(link) {
  return Utilities.base64Encode(DriveApp.getFileById(driveFileIdFromLink(link)).getBlob().getBytes());
}

// The PDF for the certificate the record shows, as base64 ('' when there is none).
// In demo mode a sample PDF that is not on Drive yet is built in memory and not saved.
function getPdfData(recordId) {
  var deps = realDeps(null);
  if (isDemoMode()) {
    deps.encodePdf = function (text) { return Utilities.base64Encode(text); };
    return demoPdfData(deps, recordId, readDriveBase64_);
  }
  var link = ensureSamplePdfLink(deps, recordId);
  return link ? readDriveBase64_(link) : '';
}

function uploadPage(token) {
  var page = HtmlService.createTemplateFromFile('src/UploadPage');
  page.token = JSON.stringify(token).replace(/</g, '\\u003c');
  page.info = JSON.stringify(uploadLinkInfo(realDeps(null).store, token)).replace(/</g, '\\u003c');
  page.demo = JSON.stringify(isDemoMode());
  return page.evaluate().setTitle('Upload your certificate')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

// Called from the upload page through google.script.run. Returns { ok, message }.
// In demo mode: no Drive write, no uploads row, no Gemini call (ticket 14).
function submitUpload(token, name, base64) {
  if (isDemoMode()) return demoUpload(realDeps(null).store, String(token || ''));
  var bytes = Utilities.base64Decode(base64);
  var header = '';
  for (var i = 0; i < 5 && i < bytes.length; i++) header += String.fromCharCode(bytes[i] & 255);
  var fingerprint = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes).map(function (b) {
    return ('0' + (b & 255).toString(16)).slice(-2);
  }).join('');
  return acceptUpload(realDeps(null), token, { name: String(name), size: bytes.length, header: header, fingerprint: fingerprint, base64: base64 });
}

// Timer entry points. Each public job function only checks who called it, then runs a private function (the
// name ends in "_") that does the work. google.script.run cannot call a private function, so a visitor can
// reach the work only through the public name. In demo mode the public name runs only for a real timer: the
// event a timer passes carries a triggerUid that matches an installed trigger. The owner runs a private
// version from the script editor for a manual run. With demo mode off the public names run as before.
function isInstalledTimerCall_(e) {
  var uid = e && e.triggerUid;
  if (!uid) return false;
  return ScriptApp.getProjectTriggers().some(function (t) { return t.getUniqueId() === String(uid); });
}

function runsNow_(e) {
  return !isDemoMode() || isInstalledTimerCall_(e);
}

// Timer entry point: one upload per run.
function runUploadJob(e) {
  if (!runsNow_(e)) return demoRefusal('runUploadJob');
  return runUploadJob_();
}

function runUploadJob_() {
  var deps = realDeps(GeminiReader());
  // Drafts a new deficiency's messages (src/Draft.gs). Calls nothing in Share Proj.
  deps.drafter = GeminiDrafter();
  var result = processNextUpload(deps);
  if (result.status !== 'none') console.log(result.status + ' ' + (result.upload_id || ''));
  return result;
}

// Owner runs this once. It adds the one-minute timer and does nothing if the timer exists.
function installUploadTrigger() {
  if (isDemoMode()) return demoRefusal('installUploadTrigger');
  return installUploadTrigger_();
}

function installUploadTrigger_() {
  var exists = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'runUploadJob'; });
  if (!exists) ScriptApp.newTrigger('runUploadJob').timeBased().everyMinutes(1).create();
  console.log(exists ? 'The upload timer is already installed.' : 'Installed the one-minute upload timer.');
}

// Timer entry point: starts a fresh daily pass. The daily timer calls this.
function runDailyJob(e) {
  if (!runsNow_(e)) return demoRefusal('runDailyJob');
  return runDailyJob_();
}

function runDailyJob_() {
  var result = processDailyBatch(realDeps(null), true);
  console.log(JSON.stringify(result));
  return result;
}

// Timer entry point: continues the saved pass. Each one-off timer calls this.
function continueDailyJob(e) {
  if (!runsNow_(e)) return demoRefusal('continueDailyJob');
  return continueDailyJob_();
}

function continueDailyJob_() {
  var result = processDailyBatch(realDeps(null), false);
  console.log(JSON.stringify(result));
  return result;
}

// Owner runs this once. It adds the daily timer and does nothing if the timer exists.
function installDailyTrigger() {
  if (isDemoMode()) return demoRefusal('installDailyTrigger');
  return installDailyTrigger_();
}

function installDailyTrigger_() {
  var exists = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'runDailyJob'; });
  if (!exists) ScriptApp.newTrigger('runDailyJob').timeBased().everyDays(1).atHour(DAILY_HOUR).create();
  console.log(exists ? 'The daily timer is already installed.' : 'Installed the daily timer for ' + DAILY_HOUR + ' AM.');
}

// Templates share the same styles and page controller.
function include(name) { return HtmlService.createHtmlOutputFromFile('src/' + name).getContent(); }
function getPortfolio(overlay) { return portfolioView(pageDeps(overlay)); }
function getRoi() { return roiLines(ROI_INPUTS); }

// Data trust checks: expected vs. received per subcontractor, and the reconciliation check. Read-only.
function getTrustChecks(overlay) { return timed('getTrustChecks', function () { return trustView(readViewDeps(pageDeps(overlay))); }); }

function getUploadStatus(token, uploadId) { return uploadProgress(realDeps(null), token, uploadId); }

// The notification log: a read-only preview of the emails the workflow sends. Nothing is sent (ticket 19).
function getNotifications(overlay) {
  return timed('getNotifications', function () { return notificationLog(readViewDeps(pageDeps(overlay))); });
}
