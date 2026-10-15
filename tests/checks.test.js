const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { findForbiddenSyntax } = require('../scripts/checks/forbidden-syntax');
const { findDollarAmounts } = require('../scripts/checks/dollar-amounts');

const CHECK = path.join(__dirname, '..', 'scripts', 'checks', 'deployed-code.js');
const CLASPIGNORE = fs.readFileSync(path.join(__dirname, '..', '.claspignore'), 'utf8');

// A throwaway project with this repo's .claspignore and the given files.
function plantProject(files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'coi-check-'));
  fs.writeFileSync(path.join(root, '.claspignore'), CLASPIGNORE);
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return root;
}

function runCheck(root) {
  return spawnSync(process.execPath, [CHECK, root], { encoding: 'utf8' });
}

test('plain Apps Script passes the syntax check', () => {
  const source = 'function nextStatus(record, event) {\n  var required = 2;\n  return record;\n}\n';
  assert.deepEqual(findForbiddenSyntax(source, 'Core.gs'), []);
});

test('each forbidden word is caught with its line', () => {
  const source = [
    "const x = require('x');",
    "import y from 'y';",
    'async function load() {',
    '  await fetchIt();',
    '}',
  ].join('\n');
  assert.deepEqual(findForbiddenSyntax(source, 'Bad.gs'), [
    { line: 1, word: 'require' },
    { line: 2, word: 'import' },
    { line: 3, word: 'async' },
    { line: 4, word: 'await' },
  ]);
});

test('the words inside comments and strings are not code', () => {
  const source = [
    '// we never import anything here',
    "var label = 'Please await approval';",
    '/* async is banned */',
    'var important = true;',
  ].join('\n');
  assert.deepEqual(findForbiddenSyntax(source, 'Ok.gs'), []);
});

test('in a page, only script blocks are checked', () => {
  const page = [
    '<p>Import your certificate and await our reply.</p>',
    '<script>',
    'async function send() {}',
    '</script>',
  ].join('\n');
  assert.deepEqual(findForbiddenSyntax(page, 'Upload.html'), [{ line: 3, word: 'async' }]);
});

test('a planted bad deployed file fails the check, and passes once removed', () => {
  const root = plantProject({
    'src/Core.gs': 'function deriveStatus(r) { return r; }\n',
    'src/Planted.gs': "var lib = require('lib');\n",
    'tests/allowed.test.js': "const t = require('node:test');\n",
  });
  const failed = runCheck(root);
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /src\/Planted\.gs:1 uses "require"/);
  assert.doesNotMatch(failed.stderr, /tests\/allowed/);

  fs.rmSync(path.join(root, 'src', 'Planted.gs'));
  assert.equal(runCheck(root).status, 0);
});

test('comparison logic that reads limits from the matrix passes', () => {
  const source = [
    '// A $1M umbrella against a $2M requirement is a deficiency.',
    'function evaluateCoi(extracted, scope, matrix) {',
    '  var required = matrix.scopes[scope].umbrella_each_occurrence;',
    '  if (extracted.confidence < 0.85) return null;',
    '  return extracted.umbrella < required;',
    '}',
  ].join('\n');
  assert.deepEqual(findDollarAmounts(source), []);
});

test('every way of writing a dollar amount in comparison logic is caught', () => {
  const source = [
    "var a = 'Umbrella below $2,000,000';",
    'var b = 2000000;',
    'var c = 2e6;',
    'var d = 1_000_000;',
    "var e = '1,000,000';",
  ].join('\n');
  assert.deepEqual(findDollarAmounts(source), [
    { line: 1, text: '$2,000,000' },
    { line: 2, text: '2000000' },
    { line: 3, text: '2e6' },
    { line: 4, text: '1_000_000' },
    { line: 5, text: '1,000,000' },
  ]);
});

test('the dollar check applies to the file that defines evaluateCoi only', () => {
  const root = plantProject({
    'src/Evaluate.gs': 'function evaluateCoi(x, s, m) {\n  return x.umbrella < 2000000;\n}\n',
    'src/Roi.gs': 'function roiLines(inputs) { return inputs.hours * 1000; }\n',
  });
  const failed = runCheck(root);
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /src\/Evaluate\.gs:2 has dollar amount "2000000"/);
  assert.doesNotMatch(failed.stderr, /Roi\.gs/);

  fs.writeFileSync(
    path.join(root, 'src', 'Evaluate.gs'),
    'function evaluateCoi(x, s, m) {\n  return x.umbrella < m.umbrella;\n}\n',
  );
  assert.equal(runCheck(root).status, 0);
});

test('a service call without its permission in appsscript.json is caught, with its line', () => {
  const { findMissingScopes } = require('../scripts/checks/oauth-scopes');
  const source = ['// ScriptApp is only named here', 'function run() {', "  ScriptApp.newTrigger('x');", '}'].join(String.fromCharCode(10));
  assert.deepEqual(findMissingScopes(source, ['https://www.googleapis.com/auth/drive']), [
    { line: 3, service: 'ScriptApp', scope: 'https://www.googleapis.com/auth/script.scriptapp' },
  ]);
  assert.deepEqual(findMissingScopes(source, ['https://www.googleapis.com/auth/script.scriptapp']), []);
});

test('a calendar call without the calendar permission in appsscript.json is caught, with its line', () => {
  const { findMissingScopes } = require('../scripts/checks/oauth-scopes');
  const source = ['function add() {', '  CalendarApp.getDefaultCalendar();', '}'].join(String.fromCharCode(10));
  assert.deepEqual(findMissingScopes(source, ['https://www.googleapis.com/auth/drive']), [
    { line: 2, service: 'CalendarApp', scope: 'https://www.googleapis.com/auth/calendar' },
  ]);
  assert.deepEqual(findMissingScopes(source, ['https://www.googleapis.com/auth/calendar']), []);
});

test('the check script fails a project whose code needs a scope the manifest lacks', () => {
  const root = plantProject({
    'src/Timer.gs': 'function t() { ScriptApp.getProjectTriggers(); }',
    'appsscript.json': JSON.stringify({ oauthScopes: [] }),
  });
  const result = runCheck(root);
  assert.equal(result.status, 1);
  assert.ok(result.stderr.includes('src/Timer.gs:1 uses ScriptApp, but appsscript.json lacks https://www.googleapis.com/auth/script.scriptapp'));
});

// Ticket 14: "ANYONE" in appsscript.json means any signed-in Google user, so visitors hit a sign-in page.
const ACCESS_CHECK = path.join(__dirname, '..', 'scripts', 'checks', 'webapp-access.js');
function runAccessCheck(access) {
  const root = plantProject({ 'appsscript.json': JSON.stringify({ webapp: { executeAs: 'USER_DEPLOYING', access } }) });
  return spawnSync(process.execPath, [ACCESS_CHECK, root], { encoding: 'utf8' });
}

test('the web app access check fails on ANYONE and passes on ANYONE_ANONYMOUS', () => {
  const failed = runAccessCheck('ANYONE');
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /webapp\.access is "ANYONE"; it must be "ANYONE_ANONYMOUS"/);
  assert.equal(runAccessCheck('ANYONE_ANONYMOUS').status, 0);
});

test('the web app access check fails on DOMAIN, MYSELF and a missing value', () => {
  const { webappAccessProblem } = require('../scripts/checks/webapp-access');
  assert.match(webappAccessProblem({ webapp: { access: 'DOMAIN' } }), /"DOMAIN"/);
  assert.match(webappAccessProblem({ webapp: { access: 'MYSELF' } }), /"MYSELF"/);
  assert.match(webappAccessProblem({}), /is missing/);
  assert.equal(webappAccessProblem({ webapp: { access: 'ANYONE_ANONYMOUS' } }), '');
});

test('this project passes the web app access check', () => {
  assert.equal(spawnSync(process.execPath, [ACCESS_CHECK], { encoding: 'utf8' }).status, 0);
});
