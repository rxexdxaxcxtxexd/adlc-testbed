// Metering: the cost of one model call, and the ai_calls row it writes.
// Expected values are worked by hand from MODEL_PRICES (input 0.30, output 2.50 USD per million tokens).
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGsRaw, loadContext, plain } = require('./load-gs');

function load(demoValue) {
  const props = demoValue === undefined ? {} : { DEMO_MODE: demoValue };
  return loadGsRaw(['meterCall', 'recordAiCall', 'FakeStore', 'FakeClock', 'initProject'], {
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
  });
}

test('known usage gives the hand-worked cost: 2,000 in and 300 out is 0.00135', () => {
  const { meterCall } = load('off');
  assert.deepEqual(plain(meterCall('gemini-3.5-flash-lite', { promptTokenCount: 2000, candidatesTokenCount: 300 }, 'read')), {
    purpose: 'read', model: 'gemini-3.5-flash-lite', input_tokens: 2000, output_tokens: 300, thinking_tokens: 0, cost_usd: 0.00135,
  });
});

test('thinking tokens bill at the output rate: 1,000 in, 200 out, 100 thinking is 0.00105', () => {
  const { meterCall } = load('off');
  const row = plain(meterCall('gemini-3.5-flash-lite', { promptTokenCount: 1000, candidatesTokenCount: 200, thoughtsTokenCount: 100 }, 'calibration'));
  assert.equal(row.output_tokens, 200);
  assert.equal(row.thinking_tokens, 100);
  assert.equal(row.cost_usd, 0.00105);
});

test('missing usage gives zero tokens and zero cost, not an error', () => {
  const { meterCall } = load('off');
  for (const usage of [undefined, null, {}]) {
    assert.deepEqual(plain(meterCall('gemini-3.5-flash-lite', usage, 'read')), {
      purpose: 'read', model: 'gemini-3.5-flash-lite', input_tokens: 0, output_tokens: 0, thinking_tokens: 0, cost_usd: 0,
    });
  }
});

test('an unknown model gives cost_usd null, never 0', () => {
  const { meterCall } = load('off');
  assert.equal(plain(meterCall('some-other-model', { promptTokenCount: 2000, candidatesTokenCount: 300 }, 'read')).cost_usd, null);
});

function storeWithTabs(c) {
  const store = c.FakeStore();
  c.initProject(store);
  return store;
}

test('recordAiCall appends one ai_calls row with the time, IDs, tokens, cost and outcome, and returns the call_id', () => {
  const c = load('off');
  const store = storeWithTabs(c);
  const id = c.recordAiCall(store, c.FakeClock('2026-10-10', '2026-10-10T08:15:00'), () => 'call-1', 'gemini-3.5-flash-lite',
    { promptTokenCount: 2000, candidatesTokenCount: 300 },
    { purpose: 'read', record_id: 'REC-001', certificate_id: 'CERT-001', outcome: 'ok', outcome_reason: '' });
  assert.equal(id, 'call-1');
  assert.deepEqual(plain(store.readRows('ai_calls')), [{
    call_id: 'call-1', time: '2026-10-10T08:15:00', purpose: 'read', model: 'gemini-3.5-flash-lite', record_id: 'REC-001',
    certificate_id: 'CERT-001', input_tokens: 2000, output_tokens: 300, thinking_tokens: 0, cost_usd: 0.00135,
    outcome: 'ok', outcome_reason: '',
  }]);
});

test('the call ID and Sheet row are created under the same script lock', () => {
  const trace = [];
  let held = false;
  const ctx = loadContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'off' }) },
    LockService: { getScriptLock: () => ({
      tryLock: () => { held = true; trace.push('acquire'); return true; },
      releaseLock: () => { held = false; trace.push('release'); },
    }) },
  });
  const store = { appendRow: (tab, row) => {
    assert.equal(held, true);
    assert.equal(tab, 'ai_calls');
    assert.equal(row.call_id, 'call-under-lock');
    trace.push('write');
  } };
  const id = ctx.recordAiCall(store, ctx.FakeClock('2026-10-10'), () => {
    assert.equal(held, true);
    trace.push('id');
    return 'call-under-lock';
  }, 'gemini-3.5-flash-lite', {}, { purpose: 'read' });
  assert.equal(id, 'call-under-lock');
  assert.equal(held, false);
  assert.deepEqual(trace, ['acquire', 'id', 'write', 'release']);
});

test('a busy metering lock generates no ID and writes no Sheet row', () => {
  const ctx = loadContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'off' }) },
    LockService: { getScriptLock: () => ({ tryLock: () => false, releaseLock: () => assert.fail('No lock was acquired.') }) },
  });
  let generated = 0;
  let writes = 0;
  assert.throws(() => ctx.recordAiCall({ appendRow: () => { writes += 1; } }, ctx.FakeClock('2026-10-10'),
    () => { generated += 1; return 'unused-id'; }, 'gemini-3.5-flash-lite', {}, { purpose: 'read' }),
  /Another run is saving changes/);
  assert.equal(generated, 0);
  assert.equal(writes, 0);
});

test('recordAiCall writes a blank cost for an unknown model, so the screen can say "price unknown"', () => {
  const c = load('off');
  const store = storeWithTabs(c);
  c.recordAiCall(store, c.FakeClock('2026-10-10'), () => 'call-2', 'some-other-model', { promptTokenCount: 10 },
    { purpose: 'calibration', outcome: 'unreadable', outcome_reason: 'The model returned no answer.' });
  const row = plain(store.readRows('ai_calls'))[0];
  assert.equal(row.cost_usd, '');
  assert.equal(row.record_id, '');
  assert.equal(row.outcome, 'unreadable');
});

test('Share Proj: recordAiCall writes nothing, asks for no ID and returns an empty string', () => {
  const c = load();
  const store = storeWithTabs(c);
  let asked = 0;
  const id = c.recordAiCall(store, c.FakeClock('2026-10-10'), () => { asked += 1; return 'call-3'; }, 'gemini-3.5-flash-lite',
    { promptTokenCount: 2000 }, { purpose: 'read', outcome: 'ok' });
  assert.equal(id, '');
  assert.equal(asked, 0);
  assert.deepEqual(plain(store.readRows('ai_calls')), []);
});

// The upload job writes one ai_calls row per model call. Usage 1,700 in and 300 out: 0.00051 + 0.00075 = 0.00126.
function uploadWorld(demoValue, reading) {
  const props = demoValue === undefined ? {} : { DEMO_MODE: demoValue };
  const c = loadGsRaw(['initProject', 'seedSampleProject', 'acceptUpload', 'processNextUpload', 'FakeStore', 'FakeMailer',
    'FakeClock', 'FakeCalendar', 'SAMPLE_READING'], {
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    console: { log: () => {} },
  });
  let n = 0;
  const deps = {
    store: c.FakeStore(), mailer: c.FakeMailer(), calendar: c.FakeCalendar(),
    clock: c.FakeClock('2026-10-07', '2026-10-07T09:00:00'), newToken: () => 'id-' + (++n),
  };
  deps.reader = { read: () => Object.assign(plain(c.SAMPLE_READING), reading) };
  c.initProject(deps.store);
  c.seedSampleProject(deps);
  c.acceptUpload(deps, 'id-1', { name: 'coi.pdf', size: 2048, header: '%PDF-', fingerprint: 'sha-aaa', base64: 'AAAA' });
  return { c, deps, aiCalls: () => plain(deps.store.readRows('ai_calls')) };
}
const READ_USAGE = { promptTokenCount: 1700, candidatesTokenCount: 300 };

test('Demo Proj: the upload job writes one read row with the record, certificate, tokens and cost', () => {
  const w = uploadWorld('off', { usage: READ_USAGE });
  assert.equal(plain(w.c.processNextUpload(w.deps)).status, 'processed');
  assert.deepEqual(w.aiCalls(), [{
    call_id: 'id-2', time: '2026-10-07T09:00:00', purpose: 'read', model: 'gemini-3.5-flash-lite', record_id: 'REC-001',
    certificate_id: 'CERT-001', input_tokens: 1700, output_tokens: 300, thinking_tokens: 0, cost_usd: 0.00126,
    outcome: 'ok', outcome_reason: '',
  }]);
});

test('Demo Proj: an unreadable reading is metered with outcome unreadable and its reason', () => {
  const w = uploadWorld('off', { readable: false, confidence: 0, values: null, reason: 'The model returned no answer.', usage: READ_USAGE });
  w.c.processNextUpload(w.deps);
  const row = w.aiCalls()[0];
  assert.deepEqual([row.outcome, row.outcome_reason, row.cost_usd], ['unreadable', 'The model returned no answer.', 0.00126]);
});

test('Demo Proj: a save that fails after the read still meters the call, with outcome error', () => {
  const w = uploadWorld('off', { usage: READ_USAGE });
  w.deps.store.updateRow('compliance_records', 'record_id', 'REC-001', { closed: true });
  assert.equal(plain(w.c.processNextUpload(w.deps)).status, 'retry');
  const row = w.aiCalls()[0];
  assert.deepEqual([row.outcome, row.outcome_reason, row.certificate_id], ['error', 'No open compliance record for this upload link.', '']);
});

test('a canned reading with no usage made no model call and writes no row', () => {
  const w = uploadWorld('off', {});
  w.c.processNextUpload(w.deps);
  assert.deepEqual(w.aiCalls(), []);
});

test('Share Proj: the upload job writes no ai_calls row', () => {
  const w = uploadWorld(undefined, { usage: READ_USAGE });
  w.c.processNextUpload(w.deps);
  assert.deepEqual(w.aiCalls(), []);
});

// Calibration: one row per sample read, purpose 'calibration'. Drive and the Reader are fakes.
function calibrationWorld(demoValue) {
  const props = demoValue === undefined ? {} : { DEMO_MODE: demoValue };
  const ctx = loadContext({
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => (k in props ? props[k] : null) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    MimeType: { PLAIN_TEXT: 'text/plain' },
    console: { log: () => {} },
  });
  const manifest = { samples: [
    { file: 'a.pdf', problem: 'clean', readable: true, expected: {} },
    { file: 'b.pdf', problem: 'scan', readable: false },
  ] };
  const fileIter = (items) => { let i = 0; return { hasNext: () => i < items.length, next: () => items[i++] }; };
  const folder = {
    getFoldersByName: () => fileIter([folder]),
    getFilesByName: (name) => {
      if (name === 'manifest.json') return fileIter([{ getBlob: () => ({ getDataAsString: () => JSON.stringify(manifest) }) }]);
      if (name === 'calibration-report.md') return fileIter([]);
      return fileIter([{ getUrl: () => 'fake://' + name }]);
    },
    createFile: () => {},
  };
  ctx.DriveApp = { getRootFolder: () => folder };
  const store = ctx.FakeStore();
  ctx.initProject(store);
  const readings = {
    'fake://a.pdf': { readable: true, confidence: 0.9, values: {}, usage: { promptTokenCount: 2000, candidatesTokenCount: 300 } },
    'fake://b.pdf': { readable: false, confidence: 0, values: null, reason: 'The model service rejected the file (HTTP 400).',
      usage: { promptTokenCount: 0, candidatesTokenCount: 0, thoughtsTokenCount: 0 } },
  };
  let n = 0;
  ctx.GeminiReader = () => ({ read: (file) => readings[file.link] });
  ctx.realDeps = (reader) => ({ store, reader, clock: ctx.FakeClock('2026-10-10', '2026-10-10T07:30:00'), newToken: () => 'call-' + (++n) });
  return { ctx, store, readings, aiCalls: () => plain(store.readRows('ai_calls')) };
}

test('Demo Proj: calibration writes one calibration row per sample, with its outcome', () => {
  const w = calibrationWorld('off');
  w.ctx.runCalibration_();
  assert.deepEqual(w.aiCalls().map((r) => [r.call_id, r.purpose, r.input_tokens, r.output_tokens, r.cost_usd, r.outcome, r.outcome_reason]), [
    ['call-1', 'calibration', 2000, 300, 0.00135, 'ok', ''],
    ['call-2', 'calibration', 0, 0, 0, 'unreadable', 'The model service rejected the file (HTTP 400).'],
  ]);
});

test('editor run with Share Proj on: calibration writes no ai_calls row', () => {
  const w = calibrationWorld();
  w.ctx.runCalibration_();
  assert.deepEqual(w.aiCalls(), []);
});

test('calibration checks Sheet structure under the lock and reads PDFs outside the lock', () => {
  const w = calibrationWorld('off');
  let held = false;
  const tabs = [];
  const reads = [];
  w.ctx.LockService = { getScriptLock: () => ({
    tryLock: () => { assert.equal(held, false); held = true; return true; },
    releaseLock: () => { held = false; },
  }) };
  const ensureTab = w.store.ensureTab;
  w.store.ensureTab = (tab, columns) => {
    assert.equal(held, true);
    tabs.push(tab);
    return ensureTab(tab, columns);
  };
  const appendRow = w.store.appendRow;
  w.store.appendRow = (tab, row) => {
    assert.equal(held, true);
    return appendRow(tab, row);
  };
  w.ctx.GeminiReader = () => ({ read: (file) => {
    assert.equal(held, false);
    reads.push(file.link);
    return w.readings[file.link];
  } });
  w.ctx.runCalibration_();
  assert.deepEqual(tabs, ['calibration_samples']);
  assert.deepEqual(reads, ['fake://a.pdf', 'fake://b.pdf']);
  assert.equal(held, false);
  assert.equal(w.aiCalls().length, 2);
});

test('a busy calibration lock does not touch Sheet structure', () => {
  const w = calibrationWorld();
  let writes = 0;
  w.ctx.LockService = { getScriptLock: () => ({ tryLock: () => false, releaseLock: () => assert.fail('No lock was acquired.') }) };
  w.store.ensureTab = () => { writes += 1; };
  assert.throws(() => w.ctx.runCalibration_(), /Another run is saving changes/);
  assert.equal(writes, 0);
  assert.deepEqual(w.aiCalls(), []);
});

// Share Proj seed: about 40 sample read rows, shaped from the cost model, not measured.
test('the demo portfolio seeds 40 read rows this month, near 1,700 in and 300 out, costed by meterCall', () => {
  const c = loadGsRaw(['initProject', 'seedDemoPortfolio', 'FakeStore', 'FakeClock', 'aiCostSummary'], {
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
  });
  let n = 0;
  const deps = { store: c.FakeStore(), clock: c.FakeClock('2026-10-10', '2026-10-10T10:00:00'), newToken: () => 'tok-' + (++n),
    encodePdf: (t) => Buffer.from(t).toString('base64') };
  c.initProject(deps.store);
  assert.equal(plain(c.seedDemoPortfolio(deps)).ok, true);
  const rows = plain(deps.store.readRows('ai_calls'));
  assert.equal(rows.length, 40);
  // First row by hand: 1,640 in and 280 out. 1,640 x 0.30 + 280 x 2.50 = 492 + 700 = 1,192 millionths of a dollar.
  assert.deepEqual([rows[0].time, rows[0].input_tokens, rows[0].output_tokens, rows[0].thinking_tokens, rows[0].cost_usd],
    ['2026-10-01T08:00:00', 1640, 280, 0, 0.001192]);
  for (const r of rows) {
    assert.equal(r.purpose, 'read');
    assert.equal(r.model, 'gemini-3.5-flash-lite');
    assert.ok(r.input_tokens >= 1640 && r.input_tokens <= 1760, String(r.input_tokens));
    assert.ok(r.output_tokens >= 280 && r.output_tokens <= 320, String(r.output_tokens));
    assert.ok(r.time >= '2026-10-01' && r.time < '2026-10-10', r.time);
    assert.ok(r.record_id && r.certificate_id && r.call_id);
  }
  const summary = plain(c.aiCostSummary(rows, '2026-10-10'));
  assert.equal(summary.ai_calls_month, 40);
  assert.equal(summary.price_unknown, false);
});

test('Demo Proj: an active correction sample is read, metered as calibration and reported in its own total', () => {
  const w = calibrationWorld('off');
  w.store.appendRow('calibration_samples', { sample_id: 'SMP-CERT-001', certificate_id: 'CERT-001', pdf_link: 'fake://c.pdf',
    expected_json: '{"insured_name":"Ridgeline Roofing LLC"}', active: true });
  w.readings['fake://c.pdf'] = { readable: true, confidence: 0.9, values: { insured_name: 'Ridgeline Roofing LLC' },
    usage: { promptTokenCount: 1000, candidatesTokenCount: 200 } };
  const report = w.ctx.runCalibration_();
  assert.match(report, /From corrections: 1 of 1 pass\./);
  assert.deepEqual(w.aiCalls().map((r) => [r.call_id, r.purpose, r.input_tokens, r.output_tokens, r.cost_usd]), [
    ['call-1', 'calibration', 2000, 300, 0.00135],
    ['call-2', 'calibration', 0, 0, 0],
    ['call-3', 'calibration', 1000, 200, 0.0008],
  ]);
});
