const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { isDeployed, readIgnorePatterns } = require('../scripts/checks/deployed-files');

const ROOT = path.join(__dirname, '..');
const patterns = readIgnorePatterns(ROOT);

test('Apps Script code, pages and the manifest deploy', () => {
  for (const file of ['src/Core.gs', 'src/jobs/Daily.gs', 'src/Index.html', 'appsscript.json']) {
    assert.equal(isDeployed(file, patterns), true, file);
  }
});

test('tests, scripts, docs and dev tools stay out of deployment', () => {
  for (const file of [
    'tests/placeholder.test.js',
    'src/Core.test.gs',
    'scripts/checks/secrets.js',
    'scripts/git-hooks/pre-commit',
    'package.json',
    '.claude/settings.json',
    '.claude/hooks/stop.js',
    '.gitignore',
    '.claspignore',
    'docs/tolerance-matrix.json',
    'CLAUDE.md',
    'src/notes.md',
    '.scratch/coi/spec.md',
  ]) {
    assert.equal(isDeployed(file, patterns), false, file);
  }
});
