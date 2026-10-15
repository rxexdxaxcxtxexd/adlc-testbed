// The guided tour (ticket 21). Copy, targets and times live in src/TourSteps.html only.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadContext } = require('./load-gs');

const SRC = path.join(__dirname, '..', 'src');
// Windows checkouts use CRLF; the slicing below expects LF.
const read = (name) => fs.readFileSync(path.join(SRC, name), 'utf8').replace(/\r\n/g, '\n');

// Runs the script inside TourSteps.html the way the page does, and returns window.TOUR_CONFIG.
function tourConfig() {
  const html = read('TourSteps.html');
  const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
  const sandbox = { window: {} };
  vm.runInNewContext(script, sandbox);
  return JSON.parse(JSON.stringify(sandbox.window.TOUR_CONFIG));
}

const NOT_BUILT_HERE = new Set(['directory', 'notifications']);
const srcText = () => fs.readdirSync(SRC).filter((f) => /\.(gs|html)$/.test(f)).map(read).join('\n');

test('the tour has 8 steps, each with a view, a target (or null for a centred card) and an autoplay time', () => {
  const steps = tourConfig().steps;
  assert.equal(steps.length, 8);
  assert.deepEqual(steps.map((s) => s.view), ['projects', 'worklist', 'record', 'holds', 'directory', 'notifications', 'worklist', 'worklist']);
  for (const s of steps) {
    assert.equal(typeof s.view, 'string');
    if (s.target !== null) assert.match(s.target, /^\[data-tour="[a-z]+"\]$/);
    assert.ok(Number.isInteger(s.ms) && s.ms >= 4000 && s.ms <= 10000, s.id + ' ms');
  }
});

test('every step target except directory and notifications is on a live element in src', () => {
  const text = srcText();
  const names = tourConfig().steps.filter((s) => s.target !== null).map((s) => /data-tour="([a-z]+)"/.exec(s.target)[1]);
  assert.deepEqual([...new Set(names)].sort(), ['confidence', 'directory', 'notifications', 'payrun', 'projects', 'worklist', 'filters'].sort());
  for (const name of names) {
    if (NOT_BUILT_HERE.has(name)) continue;
    assert.ok(text.includes('data-tour="' + name + '"'), 'no element with data-tour="' + name + '"');
  }
});

test('no step body is over 40 words, and the roles step states the whole thesis', () => {
  const steps = tourConfig().steps;
  for (const s of steps) assert.ok(s.body.split(/\s+/).length <= 40, s.id + ' body is too long');
  const roles = steps.find((s) => s.id === 'roles');
  assert.equal(roles.title, 'AI reads. Code decides. You approve.');
  assert.match(roles.body, /Under 85% confidence, a person checks it first\./);
  assert.match(roles.body, /The model never does arithmetic\./);
});

test('one centred beat says how AI is used, in the owner-approved words, just before the closing step', () => {
  const steps = tourConfig().steps;
  const beat = steps.find((s) => s.id === 'ai-use');
  assert.ok(beat, 'no ai-use step');
  assert.equal(beat.title, 'How AI is used');
  assert.equal(beat.body, 'AI reads the certificate. Code checks every limit and date. AI writes the wording of the notices. Code writes every number. A person approves.');
  assert.equal(beat.target, null);
  assert.equal(steps.indexOf(beat), steps.length - 2);
  assert.equal(steps[steps.length - 1].id, 'morning');
});

test('the welcome card shows no invented dollar figure', () => {
  const config = tourConfig();
  assert.equal(config.welcome.demo[0].to, 'Payment released');
  assert.doesNotMatch(JSON.stringify(config), /\$\s?\d/);
});

test('the credit line is on the About view, not in a tour step', () => {
  const line = 'Designed and built by Lucas Layden.';
  assert.ok(read('AppClient.html').includes(line));
  assert.ok(!JSON.stringify(tourConfig()).includes('Lucas'));
  assert.ok(srcText().includes(line));
  assert.ok(!/client (has|have) used|used by a client/i.test(srcText()));
});

test('the tour engine holds no tour copy of its own and reads the autoplay flag from INITIAL.tour', () => {
  const engine = read('Tour.html');
  assert.ok(engine.includes('INITIAL'));
  assert.ok(!engine.includes('location.search'));
  assert.ok(!engine.includes('support.js'));
  for (const step of tourConfig().steps) assert.ok(!engine.includes(step.title), step.id + ' title is in the engine');
});

test('the page includes the tour after the app, and a replay button is in the sidebar', () => {
  const page = read('Worklist.html');
  const order = ['AppClient', 'TourSteps', 'Tour'].map((n) => page.indexOf("include('" + n + "')"));
  assert.ok(order[0] > 0 && order[0] < order[1] && order[1] < order[2], 'include order');
  assert.match(page, /<aside[\s\S]*data-tour-replay[\s\S]*<\/aside>/);
  assert.match(page, /id="about-link"/);
});

test('the host exposes coiApp with go and screen, and the About view is not in ORDER', () => {
  const app = read('AppClient.html').replace(/\r\n/g, '\n');
  assert.match(app, /window\.coiApp = \{/);
  assert.match(app, /screen: function/);
  assert.match(app, /go: function/);
  const order = /var ORDER = \[([^\]]*)\]/.exec(app)[1];
  assert.ok(!order.includes('about'));
});

// doGet runs against a fake page template, so the test sees the data the page would get.
function openPage(parameter) {
  let captured = null;
  const template = { evaluate: () => ({ setTitle: () => ({ addMetaTag: () => 'page' }) }) };
  const context = loadContext({
    HtmlService: { createTemplateFromFile: () => { captured = template; return template; } },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
  });
  context.doGet(parameter === undefined ? undefined : { parameter });
  return JSON.parse(captured.initial.replace(/\\u003c/g, '<'));
}

test('doGet passes tour play only for the exact value play', () => {
  assert.equal(openPage({ tour: 'play' }).tour, 'play');
  for (const value of ['start', 'welcome', 'PLAY', 'play ', '1', '', 'true']) {
    assert.equal('tour' in openPage({ tour: value }), false, 'value "' + value + '" must not pass');
  }
  assert.equal('tour' in openPage({}), false);
  assert.equal('tour' in openPage(undefined), false);
});

// Runs fetchView from AppClient.html on its own, with a fake server call.
function fetchViewWith(state) {
  const app = read('AppClient.html').replace(/\r\n/g, '\n');
  const start = app.indexOf('  function fetchView(');
  const end = app.indexOf('\n  }\n', start) + 4;
  const sandbox = { state };
  vm.runInNewContext(app.slice(start, end) + '\nthis.fetchView = fetchView;', sandbox);
  return sandbox.fetchView;
}

test('the early fetch can run twice with no callbacks: the second call hits the cache and does not throw', () => {
  const state = { views: {}, viewWait: {} };
  const fetchView = fetchViewWith(state);
  let asks = 0;
  const ask = (ok) => { asks++; ok({ rows: [] }); };
  // The welcome card warms the screens, then "Show me around" warms them again.
  fetchView('directory', ask, 'rows', null, null);
  assert.doesNotThrow(() => fetchView('directory', ask, 'rows', null, null));
  assert.equal(asks, 1);
  let got = null;
  fetchView('directory', ask, 'rows', (data) => { got = data; }, null);
  assert.deepEqual(got, { rows: [] });
});

test('"Show me around" marks the welcome card seen before the tour starts, and a failed early fetch cannot stop the tour', () => {
  const engine = read('Tour.html');
  assert.match(engine, /=== 'start'\) \{ markSeen\(\); start\(\); \}/);
  assert.match(engine, /function warm\(\) \{ var a = app\(\); try \{/);
});
