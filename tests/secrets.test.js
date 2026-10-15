const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { findSecrets } = require('../scripts/checks/secrets');

const HOOKS_DIR = path.join(__dirname, '..', 'scripts', 'git-hooks');

// Built at run time so this file never holds a key-shaped string itself.
const FAKE_GOOGLE_KEY = 'AI' + 'za' + 'Sy' + 'X'.repeat(33);
const FAKE_PRIVATE_KEY = '-----BEGIN ' + 'PRIVATE KEY-----';

test('a Google API key is caught', () => {
  assert.deepEqual(findSecrets(`var key = '${FAKE_GOOGLE_KEY}';`), [{ line: 1, kind: 'Google API key' }]);
});

test('a private key block is caught', () => {
  assert.deepEqual(findSecrets(`notes\n${FAKE_PRIVATE_KEY}\n`), [{ line: 2, kind: 'private key' }]);
});

test('code that reads the key from Script Properties passes', () => {
  const source = "var key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');";
  assert.deepEqual(findSecrets(source), []);
});

function git(cwd, ...args) {
  return spawnSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', ...args], {
    cwd,
    encoding: 'utf8',
  });
}

test('the pre-commit hook refuses a staged key and allows a clean commit', () => {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'coi-precommit-'));
  git(repo, 'init', '-q');
  git(repo, 'config', 'core.hooksPath', HOOKS_DIR);

  fs.writeFileSync(path.join(repo, 'Config.gs'), `var KEY = '${FAKE_GOOGLE_KEY}';\n`);
  git(repo, 'add', 'Config.gs');
  const refused = git(repo, 'commit', '-q', '-m', 'planted key');
  assert.notEqual(refused.status, 0);
  assert.match(refused.stderr, /Config\.gs:1 looks like a Google API key/);

  fs.writeFileSync(path.join(repo, 'Config.gs'), "var MODEL = 'model-from-config';\n");
  git(repo, 'add', 'Config.gs');
  assert.equal(git(repo, 'commit', '-q', '-m', 'clean').status, 0);
});
