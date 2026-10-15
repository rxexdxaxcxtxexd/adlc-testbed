// The checks, run against this repo as it stands.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { checkDeployedCode } = require('../scripts/checks/deployed-code');
const { scan, trackedFiles } = require('../scripts/checks/secrets');
const { deployedFiles } = require('../scripts/checks/deployed-files');

const ROOT = path.join(__dirname, '..');

test('only Apps Script code, pages and the manifest would deploy', () => {
  const unexpected = deployedFiles(ROOT).filter(
    (file) => file !== 'appsscript.json' && !/^src\/.+\.(gs|html)$/.test(file),
  );
  assert.deepEqual(unexpected, []);
});

test('deployed code has no modules, promises or dollar amounts in comparison logic', () => {
  assert.deepEqual(checkDeployedCode(ROOT), []);
});

test('no tracked file holds a key-shaped string', () => {
  assert.deepEqual(scan(trackedFiles(ROOT)), []);
});
