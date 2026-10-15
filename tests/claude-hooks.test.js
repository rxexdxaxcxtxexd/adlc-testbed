const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const HOOKS = path.join(__dirname, '..', '.claude', 'hooks');

const PASSING = "require('node:test')('fine', () => {});\n";
const FAILING = "require('node:test')('broken', () => { throw new Error('planted failure'); });\n";

function fakeProject(suite) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coi-hook-'));
  fs.mkdirSync(path.join(root, 'tests'));
  fs.writeFileSync(path.join(root, 'tests', 'suite.test.js'), suite);
  return root;
}

function runHook(name, root, payload) {
  const env = { ...process.env, CLAUDE_PROJECT_DIR: root };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, [path.join(HOOKS, name)], {
    input: JSON.stringify(payload),
    env,
    encoding: 'utf8',
  });
}

function edit(root, rel) {
  return { tool_name: 'Edit', tool_input: { file_path: path.join(root, rel) } };
}

test('after an edit to core code, a failing suite is reported back', () => {
  const root = fakeProject(FAILING);
  const result = runHook('post-edit.js', root, edit(root, 'src/Core.gs'));
  assert.equal(result.status, 2);
  assert.match(result.stderr, /after editing src\/Core\.gs/);
  assert.match(result.stderr, /planted failure/);
});

test('after an edit to the rules, the tests run', () => {
  const root = fakeProject(FAILING);
  assert.equal(runHook('post-edit.js', root, edit(root, 'docs/tolerance-matrix.json')).status, 2);
});

test('after an edit to core code, a passing suite stays quiet', () => {
  const root = fakeProject(PASSING);
  const result = runHook('post-edit.js', root, edit(root, 'src/Core.gs'));
  assert.equal(result.status, 0);
  assert.equal(result.stderr, '');
});

test('after an edit to a prose doc, the tests do not run', () => {
  const root = fakeProject(FAILING);
  assert.equal(runHook('post-edit.js', root, edit(root, 'docs/lessons.md')).status, 0);
});

test('before a turn ends, a failing full suite sends the agent back to work', () => {
  const root = fakeProject(FAILING);
  const result = runHook('stop.js', root, { stop_hook_active: false });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Full suite failed/);
  assert.match(result.stderr, /planted failure/);
});

test('a second failing stop in a row lets the turn end but still reports', () => {
  const root = fakeProject(FAILING);
  const result = runHook('stop.js', root, { stop_hook_active: true });
  assert.equal(result.status, 0);
  assert.match(result.stderr, /planted failure/);
});

test('before a turn ends, a passing full suite lets it end', () => {
  const root = fakeProject(PASSING);
  assert.equal(runHook('stop.js', root, { stop_hook_active: false }).status, 0);
});
