// The deployed copy of the tolerance matrix matches its home in docs/.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { matrixSource } = require('../scripts/sync-matrix');

const ROOT = path.join(__dirname, '..');

test('src/ToleranceMatrix.gs is in sync with docs/tolerance-matrix.json (run scripts/sync-matrix.js)', () => {
  const json = fs.readFileSync(path.join(ROOT, 'docs', 'tolerance-matrix.json'), 'utf8');
  const lf = (text) => text.replace(/\r\n/g, '\n');
  assert.equal(lf(fs.readFileSync(path.join(ROOT, 'src', 'ToleranceMatrix.gs'), 'utf8')), lf(matrixSource(json)));
});
