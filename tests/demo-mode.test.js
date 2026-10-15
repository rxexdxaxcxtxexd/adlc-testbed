// Demo mode (ticket 14). The public app runs as the owner for anonymous visitors, and the browser can call
// every global function in src/*.gs. With demo mode on, no call may write a Sheet row or a Drive file, send
// email, read with Gemini, touch the calendar or create a trigger. The three timer entry points run only when
// a real installed timer calls them (see TIMERS). Every Google service here is a tripwire
// that records any call, and realDeps hands out a fake Store, Mailer and Reader that count what they do.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadContext, plain } = require('./load-gs');

const SRC = path.join(__dirname, '..', 'src');

// Functions that write, send, call Gemini or create a trigger when demo mode is off. Each one refuses
// or simulates in demo mode.
const GUARDED = [
  'setupDemo', 'buildDemo', 'setupPortfolioDemo', 'runCalibration', 'calibrationFolder',
  'installUploadTrigger', 'installDailyTrigger',
  'submitUpload', 'runReviewAction', 'changeReviewMode', 'getPdfData',
];

// Owner-run functions. The public name refuses in demo mode. The work sits in a private name (PRIVATE) that the
// owner runs from the script editor, where demo mode does not apply.
// Timer entry points. In demo mode a public call runs only when its event carries a triggerUid that matches an
// installed trigger. Any other call returns a demo refusal and changes nothing. The work sits in private
// functions (PRIVATE), which the owner runs from the script editor.
const TIMERS = ['runUploadJob', 'runDailyJob', 'continueDailyJob'];

// Private functions (name ends in "_"). Apps Script does not let google.script.run call them.
const PRIVATE = ['readDriveBase64_', 'setupDemo_', 'buildDemo_', 'setupPortfolioDemo_', 'runCalibration_', 'calibrationFolder_',
  'installUploadTrigger_', 'installDailyTrigger_', 'runUploadJob_', 'runDailyJob_', 'continueDailyJob_', 'isInstalledTimerCall_', 'runsNow_'];

// Every other global function. Each one either only reads, or needs adapter objects with methods as
// arguments. A browser call can pass only plain data, so such a function throws before any write.
const READ_ONLY = [
  // Page reads
  // Trust checks and directory (tickets 17, 18)
  'getTrustChecks', 'getDirectory', 'trustView', 'reconcile', 'expectedVsReceived', 'dollarsOnHoldRecount',
  'aiCostSummary', 'aiCostView',
  'directoryView', 'directoryRows', 'worstStatus', 'sentNoticeType',
  // Notification log (ticket 19): reads only, sends nothing
  'getNotifications', 'notificationLog', 'noticeTypeOf', 'dateLabel', 'latestThursday', 'firstName',
  'certificateWithGaps', 'gapLines',
  'doGet', 'uploadPage', 'include', 'getWorklist', 'getAppData', 'getPaymentHoldList', 'getRecordDetail',
  'getPortfolio', 'getRoi', 'getUploadStatus', 'openingView', 'pageDeps', 'realDeps', 'timed',
  // Settings
  'demoModeFromValue', 'isDemoMode',
  // Adapter builders: they return objects and call nothing
  'SheetStore', 'GeminiReader', 'GmailMailer', 'GoogleCalendar', 'ScriptCursor', 'ScriptTimers', 'ScriptClock',
  'buildReader', 'buildModelRequest', 'driveFileIdFromLink', 'GeminiDrafter', 'buildDrafter', 'buildDraftRequest',
  'FakeStore', 'FakeReader', 'FakeMailer', 'FakeCalendar', 'FakeCursor', 'FakeTimers', 'FakeClock',
  // Demo helpers
  'cleanOverlay', 'demoIndexOf', 'OverlayStore', 'demoDeps', 'demoReviewAction', 'demoReviewMode', 'demoRefusal',
  'demoPdfData', 'demoUpload', 'samplePdf',
  // Pure logic
  'calibrationFolderPath', 'calibrationFields', 'valueAt', 'compareToManifest', 'formatCalibrationReport', 'calibrationItemLines',
  'idNumber', 'countText', 'dayChangedRecord', 'demoPortfolioRows', 'demoCertificatePdf', 'formatUsd', 'normalizeName',
  'mergeRules', 'evaluateCoi', 'nullableType', 'unreadableReading', 'toDollars', 'isCalendarDate', 'parseExtraction',
  'findRow', 'certFromRow', 'certToRow', 'addDays', 'daysUntil', 'deriveStatus', 'isCompliantStatus', 'holdReasons',
  'newRecord', 'nextStatus', 'calendarChanges', 'resendText', 'correctionText', 'correctionChanges', 'projectTile',
  'actorName', 'roleDenied', 'uploadLinkFor', 'recordLinkFor', 'isUnreadable', 'waitingLabel', 'nextStep',
  'shownCertificate', 'roiLines', 'projectFolderPath', 'subFolderPath', 'meterCall', 'demoAiCallRows',
  'sampleFromCorrection', 'correctionCalibrationEntries',
  // AI drafts (ticket A): pure wording checks and assembly
  'draftIds', 'draftInput', 'checkDraft', 'draftedLines', 'assembleDeficiencyNotice', 'assembleCorrectionRequest',
  'draftFromRows', 'usableDraft', 'replaceEffectText', 'aiDraftsOn', 'storedNotice',
  // Take deps or a store as the first argument (inert from the browser)
  'logDaily', 'checkOneRecord', 'processDailyBatch', 'seedDemoPortfolio', 'ensureSamplePdfLink', 'loadRecord',
  'saveRecord', 'sendEffects', 'applyCalendar', 'processCertificate', 'readAndMeter', 'worklistRows', 'withScriptLock', 'nextId',
  'currentPayCycle', 'billedInCycle', 'paymentHoldList', 'latestModeChange', 'portfolioView', 'readViewDeps',
  'worklistView', 'portfolioHoldList', 'appData', 'reviewAction', 'setReviewMode', 'recordPdfLink', 'recordDetail',
  'fillSampleNames', 'seedSampleProject', 'initProject', 'addProjectFolders', 'findOpenRecord', 'uploadLinkInfo',
  'acceptUpload', 'processNextUpload', 'uploadProgress', 'recordAiCall', 'upsertSample',
  'draftRows', 'findDraft', 'storeDraft', 'ensureDrafts', 'withDeficiencyDraft', 'withCorrectionDraft', 'correctionRequestText',
];

function sourceFunctions() {
  const names = [];
  for (const file of fs.readdirSync(SRC).filter((f) => f.endsWith('.gs'))) {
    const text = fs.readFileSync(path.join(SRC, file), 'utf8');
    for (const m of text.matchAll(/^function\s+([A-Za-z0-9_$]+)\s*\(/gm)) names.push(m[1]);
  }
  return names.sort();
}

// A Google service that records every call and then fails it.
function tripwire(service, calls) {
  return new Proxy({}, {
    get: (_, prop) => {
      if (typeof prop === 'symbol') return undefined;
      return () => { calls.push(service + '.' + prop); throw new Error('Tripwire: ' + service + '.' + prop); };
    },
  });
}

// The 140-record demo portfolio, seeded once and copied into each fresh project.
let seedCache = null;
function seededRows(ctx, clock) {
  if (!seedCache) {
    let n = 0;
    const deps = { store: ctx.FakeStore(), clock, newToken: () => 'token-' + (++n), encodePdf: (t) => Buffer.from(t).toString('base64') };
    ctx.initProject(deps.store);
    assert.equal(ctx.seedDemoPortfolio(deps).ok, true);
    seedCache = plain(deps.store.snapshot());
  }
  return seedCache;
}

// A fresh project: the demo portfolio in a FakeStore, then counters on every adapter.
function world(demoValue) {
  const calls = [];
  const props = demoValue === undefined ? {} : { DEMO_MODE: demoValue };
  const globals = {
    console: { log: () => {} },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (k in props ? props[k] : null),
      getProperties: () => Object.assign({}, props),
      setProperty: (k) => calls.push('PropertiesService.setProperty ' + k),
      deleteProperty: (k) => calls.push('PropertiesService.deleteProperty ' + k),
    }) },
    Utilities: {
      getUuid: () => 'uuid',
      base64Encode: (v) => Buffer.from(typeof v === 'string' ? v : Uint8Array.from(v)).toString('base64'),
      base64Decode: (v) => { calls.push('Utilities.base64Decode'); return [...Buffer.from(v, 'base64')]; },
      computeDigest: () => { calls.push('Utilities.computeDigest'); return []; },
      formatDate: () => '2026-10-08',
      DigestAlgorithm: { SHA_256: 'SHA_256' },
    },
    Session: { getScriptTimeZone: () => 'America/Chicago' },
  };
  for (const s of ['SpreadsheetApp', 'DriveApp', 'MailApp', 'GmailApp', 'UrlFetchApp', 'ScriptApp', 'CalendarApp', 'HtmlService', 'MimeType']) {
    globals[s] = tripwire(s, calls);
  }
  const ctx = loadContext(globals);
  const clock = ctx.FakeClock('2026-10-08', '2026-10-08T10:00:00');
  const base = ctx.FakeStore();
  const seeded = seededRows(ctx, clock);
  for (const tab of Object.keys(seeded.tabs)) {
    base.ensureTab(tab, seeded.tabs[tab]);
    for (const row of seeded.rows[tab]) base.appendRow(tab, row);
  }

  const writes = [];
  const store = {};
  for (const m of ['ensureTab', 'ensureFolder', 'writeFile', 'writeBlob', 'appendRow', 'updateRow']) {
    store[m] = (...args) => { writes.push(m + ' ' + args[0]); return base[m](...args); };
  }
  store.readRows = (tab) => base.readRows(tab);
  let reads = 0;
  const reader = { read: () => { reads += 1; return plain(ctx.SAMPLE_READING); } };
  const mailer = ctx.FakeMailer(), calendar = ctx.FakeCalendar(), timers = ctx.FakeTimers(), cursor = ctx.FakeCursor();
  ctx.realDeps = () => ({ store, reader, mailer, calendar, timers, cursor, clock, newToken: () => 'new-token',
    uploadBaseUrl: 'https://example.test/upload', internalBaseUrl: 'https://example.test/app' });
  return {
    ctx, base, calls,
    effects: () => ({ writes: writes.slice(), sent: mailer.sent().length, reads, events: calendar.events().length,
      timers: timers.scheduled().length + timers.cleared(), cursor: cursor.get(), calls: calls.slice() }),
  };
}

const NOTHING = { writes: [], sent: 0, reads: 0, events: 0, timers: 0, cursor: null, calls: [] };

test('the browser cannot reject without the correction text and certificate it approves', () => {
  for (const mode of ['on', 'off']) {
    for (const payload of [undefined, {}, { approved_text: 'Please update the certificate.' }, { certificate_id: 'CERT-001' }]) {
      const w = world(mode);
      assert.deepEqual(plain(w.ctx.runReviewAction('REC-001', 'project_manager', 'reject', payload)),
        { ok: false, message: 'Open the correction request and approve its wording before you send it.' });
      assert.deepEqual(w.effects(), NOTHING);
    }
  }
});

test('every global function in src/*.gs is listed as guarded or read-only', () => {
  const listed = [...GUARDED, ...TIMERS, ...PRIVATE, ...READ_ONLY].sort();
  assert.equal(new Set(listed).size, listed.length, 'a name is listed twice');
  assert.deepEqual(sourceFunctions(), listed);
});

test('every server call the pages make is a listed function', () => {
  const pages = fs.readdirSync(SRC).filter((f) => f.endsWith('.html')).map((f) => fs.readFileSync(path.join(SRC, f), 'utf8')).join('\n');
  const called = [...pages.matchAll(/\b(?:rpc|call|mutate)\('([A-Za-z]+)'/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(called)].sort(), ['changeReviewMode', 'getAppData', 'getDirectory', 'getNotifications', 'getPaymentHoldList',
    'getPdfData', 'getRecordDetail', 'getTrustChecks', 'getUploadStatus', 'getWorklist', 'runReviewAction', 'submitUpload']);
  for (const name of called) assert.ok(GUARDED.includes(name) || READ_ONLY.includes(name), name);
  for (const name of PRIVATE) assert.ok(!called.includes(name), name);
});

test('demo mode is on when DEMO_MODE is missing, blank or unknown, and off only for "off" or "false"', () => {
  const { ctx } = world();
  for (const v of [null, undefined, '', 'on', 'true', 'yes', 'of']) assert.equal(ctx.demoModeFromValue(v), true, String(v));
  for (const v of ['off', 'OFF', ' false ', 'False']) assert.equal(ctx.demoModeFromValue(v), false, v);
  assert.equal(ctx.isDemoMode(), true);
  assert.equal(world('off').ctx.isDemoMode(), false);
});

// One test per guarded function: called the way the browser or a timer calls it, it changes nothing.
const OWNER_ONLY = ['setupDemo', 'buildDemo', 'setupPortfolioDemo', 'runCalibration', 'installUploadTrigger', 'installDailyTrigger'];
for (const name of OWNER_ONLY) {
  test(`${name} refuses in demo mode and changes nothing`, () => {
    const w = world();
    const out = plain(w.ctx[name]());
    assert.equal(out.ok, false);
    assert.equal(out.demo, true);
    assert.equal(out.message, name + ' did not run because demo mode is on. Run ' + name + '_ from the Apps Script editor instead. Do not turn demo mode off while the app is public.');
    assert.deepEqual(w.effects(), NOTHING);
  });
}

test('calibrationFolder refuses in demo mode and creates no folder', () => {
  const w = world();
  assert.throws(() => w.ctx.calibrationFolder(), /calibrationFolder did not run because demo mode is on/);
  assert.deepEqual(w.effects(), NOTHING);
});

test('runReviewAction approve in demo mode returns the outcome and the changed rows, and changes nothing', () => {
  const w = world();
  const out = plain(w.ctx.runReviewAction('REC-014', 'accountant', 'approve', {}));
  assert.deepEqual(w.effects(), NOTHING);
  assert.equal(out.ok, true);
  assert.equal(out.demo, true);
  assert.equal(out.status, 'compliant');
  assert.equal(out.message, 'Approved. Demo: no email was sent. The change stays in this browser tab.');
  const record = out.overlay.rows.compliance_records.find((r) => r.record_id === 'REC-014');
  assert.equal(record.status, 'compliant');
  assert.equal(record.current_certificate_id, 'CERT-014');
  assert.equal(record.queued_certificate_id, '');
  // The master data still waits for approval.
  assert.equal(w.base.readRows('compliance_records').find((r) => r.record_id === 'REC-014').queued_certificate_id, 'CERT-014');
});

// Correction flywheel: Share Proj shows the same log line as Demo Proj and writes no calibration sample.
const brightwayFix = (ctx) => {
  const values = plain(ctx.getRecordDetail('REC-014')).values;
  values.limits.commercial_liability = 1000000;
  return { values, note: 'Misread on page 1.' };
};
const TEST_SET_LINE = 'Changed General liability from $2,000,000 to $1,000,000 on CERT-014. Note: Misread on page 1. Added to the test set.';

test('a correction in Share Proj says "Added to the test set." and writes no sample, in the Sheet or in the changed rows', () => {
  const w = world();
  const out = plain(w.ctx.runReviewAction('REC-014', 'accountant', 'correct', brightwayFix(w.ctx)));
  assert.equal(out.ok, true);
  assert.deepEqual(w.effects(), NOTHING);
  assert.ok(out.overlay.rows.activity_log.some((a) => a.summary === TEST_SET_LINE));
  assert.deepEqual(out.overlay.rows.calibration_samples || [], []);
  assert.deepEqual(plain(w.base.readRows('calibration_samples')), []);
});

test('the same correction in Demo Proj writes one sample row', () => {
  const w = world('off');
  assert.equal(plain(w.ctx.runReviewAction('REC-014', 'accountant', 'correct', brightwayFix(w.ctx))).ok, true);
  assert.deepEqual(plain(w.base.readRows('calibration_samples')).map((r) => [r.sample_id, r.certificate_id, r.record_id]), [['SMP-CERT-014', 'CERT-014', 'REC-014']]);
  assert.ok(plain(w.base.readRows('activity_log')).some((a) => a.summary === TEST_SET_LINE));
});

test('the changed rows, sent back with a read, show the change; without them the record is unchanged', () => {
  const w = world();
  const { overlay } = plain(w.ctx.runReviewAction('REC-014', 'accountant', 'approve', {}));
  assert.equal(plain(w.ctx.getRecordDetail('REC-014', overlay)).next, null);
  assert.equal(plain(w.ctx.getRecordDetail('REC-014')).next, 'approve');
  const row = plain(w.ctx.getAppData(overlay)).worklist.rows.find((r) => r.record_id === 'REC-014');
  assert.equal(row.next, null);
  assert.deepEqual(w.effects(), NOTHING);
});

test('a second demo action builds on the first: waive REC-001, then the W-9 change keeps the waiver', () => {
  const w = world();
  const first = plain(w.ctx.runReviewAction('REC-001', 'project_manager', 'waive', { note: 'Umbrella shortfall accepted for this phase.' }));
  assert.equal(first.ok, true);
  const second = plain(w.ctx.runReviewAction('REC-001', 'accountant', 'w9', { onFile: false }, first.overlay));
  assert.equal(second.ok, true);
  assert.equal(second.message, 'W-9 marked missing. Demo: no email was sent. The change stays in this browser tab.');
  const detail = plain(w.ctx.getRecordDetail('REC-001', second.overlay));
  assert.equal(detail.waived, true);
  assert.equal(detail.w9_on_file, false);
  assert.deepEqual(w.effects(), NOTHING);
});

test('a refused demo action returns the refusal and no rows', () => {
  const w = world();
  assert.deepEqual(plain(w.ctx.runReviewAction('REC-014', 'project_manager', 'approve', {})), { ok: false, message: 'Only the accountant can approve a certificate.' });
  assert.deepEqual(w.effects(), NOTHING);
});

test('changeReviewMode in demo mode returns the new mode in the changed rows and changes nothing', () => {
  const w = world();
  const out = plain(w.ctx.changeReviewMode('leadership', 'automatic', 'PRJ-001'));
  assert.deepEqual(w.effects(), NOTHING);
  assert.equal(out.message, 'Review mode changed from review all to automatic. Demo: the change stays in this browser tab.');
  assert.deepEqual(out.overlay.rows.projects, [{ project_id: 'PRJ-001', review_mode: 'automatic' }]);
  assert.equal(plain(w.ctx.getAppData(out.overlay)).portfolio.projects[0].review_mode, 'automatic');
  assert.equal(w.base.readRows('projects')[0].review_mode, 'review_all');
});

test('getPdfData in demo mode builds a missing sample PDF in memory and saves nothing', () => {
  const w = world();
  const base64 = w.ctx.getPdfData('REC-004');
  assert.equal(Buffer.from(base64, 'base64').toString('latin1').slice(0, 8), '%PDF-1.4');
  assert.deepEqual(w.effects(), NOTHING);
  assert.equal(w.base.readRows('certificates').find((c) => c.certificate_id === 'CERT-004').pdf_link, '');
});

test('getPdfData ignores the browser rows, so a visitor cannot point it at another Drive file', () => {
  const w = world();
  const overlay = { rows: { certificates: [{ certificate_id: 'CERT-004', pdf_link: 'https://drive.google.com/file/d/OTHER/view' }] } };
  w.ctx.getPdfData('REC-004', overlay);
  assert.deepEqual(w.effects(), NOTHING);
});

test('submitUpload in demo mode reads nothing, saves nothing and returns the stored sample reading', () => {
  const w = world();
  const token = w.base.readRows('compliance_records').find((r) => r.record_id === 'REC-002').upload_token;
  const out = plain(w.ctx.submitUpload(token, 'coi.pdf', Buffer.from('%PDF-1.4 x').toString('base64')));
  assert.deepEqual(w.effects(), NOTHING);
  assert.equal(out.ok, true);
  assert.equal(out.demo, true);
  assert.equal(out.message, 'This is a demo. Nothing was saved and your file was not read. Below is the stored sample reading.');
  assert.deepEqual(out.reading[0], { label: 'Insured name', value: 'Ridgeline Roofing LLC' });
  assert.deepEqual(out.reading.at(-1), { label: 'Expires', value: '2027-09-30' });
  assert.deepEqual(plain(w.ctx.submitUpload('no-such-token', 'coi.pdf', '')), { ok: false, message: 'This upload link is not active. Contact the project team for a new one.' });
});

test('with demo mode off the same approve saves and emails, and browser rows are ignored', () => {
  const w = world('off');
  const fake = { rows: { compliance_records: [{ record_id: 'REC-014', status: 'closed' }] } };
  assert.equal(plain(w.ctx.getRecordDetail('REC-014', fake)).status, 'Compliant');
  const out = plain(w.ctx.runReviewAction('REC-014', 'accountant', 'approve', {}, fake));
  assert.equal(out.ok, true);
  assert.equal(out.demo, undefined);
  const e = w.effects();
  assert.ok(e.writes.length > 0);
  assert.ok(e.sent > 0);
});

// The sweep: every global function, called with plain data the way a browser can, changes nothing.
test('in demo mode no global function, called with plain arguments, writes, sends, reads or calls a write service', () => {
  const argSets = [[], ['REC-014', 'accountant', 'approve', {}], [{}, {}, {}, {}], ['x', 'x', 'x', 'x'],
    ['https://drive.google.com/file/d/OWNER-FILE/view'], [{ link: 'https://drive.google.com/file/d/OWNER-FILE/view' }]];
  // getPdfData reads the PDF of a record's own certificate, from the link in the real rows. No other public
  // function may open a Drive file: a visitor could pass the ID of any file the owner can read.
  const allowed = (name, c) => c === 'HtmlService.createTemplateFromFile' || c === 'HtmlService.createHtmlOutputFromFile' ||
    c === 'SpreadsheetApp.openById' || (name === 'getPdfData' && c === 'DriveApp.getFileById');
  for (const name of sourceFunctions().filter((n) => !n.endsWith('_') && !TIMERS.includes(n))) {
    const w = world();
    for (const args of argSets) {
      try { w.ctx[name](...args); } catch (err) { /* a throw is fine; a change is not */ }
      const e = w.effects();
      assert.deepEqual({ ...e, calls: e.calls.filter((c) => !allowed(name, c)) }, NOTHING, name + '(' + JSON.stringify(args) + ')');
    }
  }
});

test('the overlay keeps only known tabs, columns and plain values', () => {
  const { ctx } = world();
  assert.deepEqual(plain(ctx.cleanOverlay({ rows: {
    compliance_records: [{ record_id: 'REC-001', status: 'compliant', evil: 'x', closed: { a: 1 } }, { status: 'no key' }, 'text'],
    secrets: [{ a: 1 }],
    activity_log: [{ record_id: 'REC-001', summary: 'Note.' }],
  } })), { rows: {
    compliance_records: [{ record_id: 'REC-001', status: 'compliant' }],
    activity_log: [{ record_id: 'REC-001', summary: 'Note.' }],
  } });
  assert.deepEqual(plain(ctx.cleanOverlay('junk')), { rows: {} });
  assert.deepEqual(plain(ctx.cleanOverlay(null)), { rows: {} });
});

test('no public function reads a Drive file by a link the caller gives', () => {
  const w = world();
  assert.equal(w.ctx.readDriveBase64, undefined);
  assert.equal(typeof w.ctx.readDriveBase64_, 'function');
});

// A ScriptApp with these installed triggers. Anything else it is asked to do is recorded and fails.
function withTriggers(w, ids) {
  w.ctx.ScriptApp = { getProjectTriggers: () => ids.map((id) => ({ getUniqueId: () => id })) };
}
const REFUSED = (name) => ({ ok: false, demo: true, message: name + ' did not run because demo mode is on. Run ' + name + '_ from the Apps Script editor instead. Do not turn demo mode off while the app is public.' });

for (const name of TIMERS) {
  test(`${name} called by a visitor with no event refuses in demo mode and changes nothing`, () => {
    const w = world();
    assert.deepEqual(plain(w.ctx[name]()), REFUSED(name));
    assert.deepEqual(w.effects(), NOTHING);
  });

  test(`${name} called with a forged triggerUid that is not installed refuses and changes nothing`, () => {
    const w = world();
    withTriggers(w, ['real-1', 'real-2']);
    assert.deepEqual(plain(w.ctx[name]({ triggerUid: 'x' })), REFUSED(name));
    assert.deepEqual(plain(w.ctx[name]({ triggerUid: '' })), REFUSED(name));
    assert.deepEqual(plain(w.ctx[name]({ other: 'real-1' })), REFUSED(name));
    assert.deepEqual(w.effects(), NOTHING);
  });
}

test('runDailyJob called by an installed timer runs in demo mode: it checks stored records and saves what the date changed', () => {
  const w = world();
  withTriggers(w, ['real-1', 'real-2']);
  const out = plain(w.ctx.runDailyJob({ triggerUid: 'real-1' }));
  assert.equal(out.status, 'continues');
  assert.equal(out.processed, 10);
  const e = w.effects();
  assert.ok(e.writes.length > 0);
  assert.equal(e.cursor.after, 10);
  assert.equal(e.timers, 2); // one clear of old continuation timers, one new continuation timer
  const next = plain(w.ctx.continueDailyJob({ triggerUid: 'real-2' }));
  assert.equal(next.status, 'continues');
  assert.equal(w.effects().cursor.after, 20);
});

test('continueDailyJob from an installed timer with no saved pass does nothing', () => {
  const w = world();
  withTriggers(w, ['real-1']);
  assert.deepEqual(plain(w.ctx.continueDailyJob({ triggerUid: 'real-1' })), { status: 'none' });
  assert.deepEqual({ ...w.effects(), timers: 0 }, NOTHING);
});

test('runUploadJob from an installed timer runs in demo mode on an upload already stored', () => {
  const w = world();
  withTriggers(w, ['real-1']);
  const rec = w.base.readRows('compliance_records').find((r) => r.record_id === 'REC-002');
  w.base.appendRow('uploads', { upload_id: 'UPL-900', upload_token: rec.upload_token, received_time: '2026-10-08T09:00:00',
    file_name: 'coi.pdf', file_fingerprint: 'stored-1', drive_link: 'https://drive.google.com/file/d/STORED/view', processed: false, attempts: 0, last_error: '' });
  assert.deepEqual(plain(w.ctx.runUploadJob({ triggerUid: 'real-1' })), { status: 'processed', upload_id: 'UPL-900' });
  assert.equal(w.effects().reads, 1);
});

test('runUploadJob in demo mode, on an upload that lands in a deficiency, drafts nothing and calls no model', () => {
  const w = world();
  withTriggers(w, ['real-1']);
  const rec = w.base.readRows('compliance_records').find((r) => r.record_id === 'REC-002');
  w.base.appendRow('uploads', { upload_id: 'UPL-901', upload_token: rec.upload_token, received_time: '2026-10-08T09:00:00',
    file_name: 'coi.pdf', file_fingerprint: 'stored-2', drive_link: 'https://drive.google.com/file/d/STORED/view', processed: false, attempts: 0, last_error: '' });
  assert.deepEqual(plain(w.ctx.runUploadJob({ triggerUid: 'real-1' })), { status: 'processed', upload_id: 'UPL-901' });
  const cert = w.base.readRows('certificates').find((c) => c.file_fingerprint === 'stored-2');
  assert.equal(cert.queue_stage, 'deficiency');
  const e = w.effects();
  assert.ok(!e.writes.includes('appendRow ai_drafts'));
  assert.ok(!e.calls.some((c) => c.startsWith('UrlFetchApp')));
  assert.deepEqual(plain(w.base.readRows('ai_drafts')), []);
});

test('the private job functions run in demo mode with no event, for the owner in the editor', () => {
  const w = world();
  assert.equal(plain(w.ctx.runDailyJob_()).status, 'continues');
  assert.equal(w.effects().cursor.after, 10);
  assert.equal(plain(w.ctx.continueDailyJob_()).status, 'continues');
  assert.equal(w.effects().cursor.after, 20);
  assert.deepEqual(plain(w.ctx.runUploadJob_()), { status: 'none' });
});

test('with demo mode off the public job functions run with no event, as before', () => {
  const w = world('off');
  assert.equal(plain(w.ctx.runDailyJob()).status, 'continues');
  assert.equal(plain(w.ctx.continueDailyJob()).status, 'continues');
  assert.deepEqual(plain(w.ctx.runUploadJob()), { status: 'none' });
});

// The owner-run private functions run in demo mode. Each gets a stand-in for the Google service it uses.
function triggerApp(installed, made) {
  const builder = { timeBased: () => builder, everyMinutes: () => builder, everyDays: () => builder, atHour: () => builder,
    create: () => { made.push(1); } };
  return { getProjectTriggers: () => installed.map((h) => ({ getHandlerFunction: () => h })),
    newTrigger: (name) => { made.push(name); return builder; } };
}

test('installUploadTrigger_ and installDailyTrigger_ run in demo mode and point at the public timer names', () => {
  const w = world();
  const made = [];
  w.ctx.ScriptApp = triggerApp([], made);
  w.ctx.installUploadTrigger_();
  w.ctx.installDailyTrigger_();
  assert.deepEqual(made.filter((m) => typeof m === 'string'), ['runUploadJob', 'runDailyJob']);
  made.length = 0;
  w.ctx.ScriptApp = triggerApp(['runUploadJob', 'runDailyJob'], made);
  w.ctx.installUploadTrigger_();
  w.ctx.installDailyTrigger_();
  assert.deepEqual(made, []);
});

function driveApp(created) {
  const folder = { getFoldersByName: () => ({ hasNext: () => false }), createFolder: () => { created.push('folder'); return folder; },
    getFilesByName: () => ({ hasNext: () => false }) };
  return { getRootFolder: () => folder };
}

test('calibrationFolder_ and runCalibration_ run in demo mode', () => {
  const w = world();
  const created = [];
  w.ctx.DriveApp = driveApp(created);
  assert.ok(w.ctx.calibrationFolder_());
  assert.ok(created.length > 0);
  assert.throws(() => w.ctx.runCalibration_(), /manifest\.json is not in the Drive folder/);
});

test('setupPortfolioDemo_ runs in demo mode and seeds a new Sheet', () => {
  const w = world();
  const sheet = { getId: () => 'new-sheet', setSpreadsheetTimeZone: () => {} };
  w.ctx.SpreadsheetApp = { create: () => sheet };
  const fresh = w.ctx.FakeStore();
  w.ctx.SheetStore = () => fresh;
  w.ctx.ScriptClock = () => w.ctx.FakeClock('2026-10-08', '2026-10-08T10:00:00');
  const out = plain(w.ctx.setupPortfolioDemo_());
  assert.equal(out.ok, true);
  assert.equal(out.records, 140);
  assert.ok(w.effects().calls.includes('PropertiesService.setProperty SHEET_ID'));
});

test('buildDemo_ and setupDemo_ run in demo mode', () => {
  const w = world();
  const sheet = { setSpreadsheetTimeZone: () => {}, getSheetByName: () => null, getId: () => 'sheet-1' };
  w.ctx.SpreadsheetApp = { openById: () => sheet };
  w.ctx.DriveApp = { getRootFolder: () => ({ getFoldersByName: () => ({ next: () => ({}) }) }),
    getFileById: () => ({ moveTo: () => {} }) };
  w.ctx.PropertiesService = { getScriptProperties: () => ({ getProperty: () => 'sheet-1', setProperty: () => {} }) };
  assert.match(w.ctx.buildDemo_(), /^Already seeded; nothing changed\./);
  assert.match(w.ctx.setupDemo_(), /^Already seeded; nothing changed\./);
});

test('with demo mode off the public setup and trigger functions call the private ones', () => {
  const w = world('off');
  const made = [];
  w.ctx.ScriptApp = triggerApp([], made);
  w.ctx.installDailyTrigger();
  assert.deepEqual(made.filter((m) => typeof m === 'string'), ['runDailyJob']);
});

test('a refusal for a visitor action gives no DEMO_MODE advice, and no owner-run name lacks a private version', () => {
  const { ctx } = world();
  assert.equal(plain(ctx.demoRefusal('getPdfData')).message, 'getPdfData did not run because demo mode is on.');
  for (const name of ['setupDemo', 'buildDemo', 'setupPortfolioDemo', 'runCalibration', 'calibrationFolder', 'installUploadTrigger',
    'installDailyTrigger', ...TIMERS]) {
    assert.equal(typeof ctx[name + '_'], 'function', name);
    assert.match(plain(ctx.demoRefusal(name)).message, new RegExp('Run ' + name + '_ from the Apps Script editor'));
  }
});

// Directory and data trust read through the demo overlay (ticket 20), as getRecordDetail does.
test('getDirectory with the changed rows shows the change; without them the directory is unchanged', () => {
  const w = world();
  const { overlay } = plain(w.ctx.runReviewAction('REC-001', 'project_manager', 'waive', { note: 'Umbrella shortfall accepted for this phase.' }));
  const row = (view) => plain(view).rows.find((r) => r.company === 'Ridgeline Roofing LLC');
  assert.equal(row(w.ctx.getDirectory(overlay)).status, 'Compliant');
  assert.equal(row(w.ctx.getDirectory()).status, 'In review');
  assert.equal(plain(w.ctx.getDirectory(overlay)).rows.length, 140);
  assert.deepEqual(w.effects(), NOTHING);
});

test('getTrustChecks with the changed rows shows a stale stored status as a Fail; without them it passes', () => {
  const w = world();
  const stale = { rows: { compliance_records: [{ record_id: 'REC-004', status: 'expired' }] } };
  const failed = plain(w.ctx.getTrustChecks(stale)).reconciliation;
  assert.equal(failed.pass, false);
  assert.deepEqual(failed.mismatches, [{ count: 'compliant_count', expected: 134, actual: 135 }, { count: 'expired_count', expected: 2, actual: 1 }]);
  assert.equal(plain(w.ctx.getTrustChecks()).reconciliation.pass, true);
  assert.deepEqual(w.effects(), NOTHING);
});

test('getTrustChecks with the changed rows shows a new gap for the subcontractor, and no gap without them', () => {
  const w = world();
  const lost = { rows: { compliance_records: [{ record_id: 'REC-004', current_certificate_id: '' }] } };
  const gap = (view) => plain(view).expected_vs_received.rows.find((r) => r.sub_id === 'SUB-004');
  const shown = gap(w.ctx.getTrustChecks(lost));
  assert.deepEqual([shown.expected, shown.received, shown.gap], [1, 0, 1]);
  assert.deepEqual(shown.responsible, ['Dana Reyes']);
  assert.equal(gap(w.ctx.getTrustChecks()).gap, 0);
  assert.deepEqual(w.effects(), NOTHING);
});

test('with demo mode off, getDirectory and getTrustChecks ignore the browser rows', () => {
  const w = world('off');
  const fake = { rows: { compliance_records: [{ record_id: 'REC-004', status: 'expired' }] } };
  assert.equal(plain(w.ctx.getTrustChecks(fake)).reconciliation.pass, true);
  assert.equal(plain(w.ctx.getDirectory(fake)).rows.find((r) => r.company === 'Northgate Cleaning LLC').status, 'Compliant');
});
