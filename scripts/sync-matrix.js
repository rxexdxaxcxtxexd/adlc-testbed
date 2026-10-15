// Copies docs/tolerance-matrix.json (the matrix's home) into src/ToleranceMatrix.gs,
// so deployed code can read it. tests/tolerance-matrix.test.js fails if the two differ.
// Usage: node scripts/sync-matrix.js
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function matrixSource(json) {
  return [
    '// Generated from docs/tolerance-matrix.json by scripts/sync-matrix.js. Do not edit by hand.',
    `var TOLERANCE_MATRIX = ${JSON.stringify(JSON.parse(json), null, 2)};`,
    '',
  ].join('\n');
}

if (require.main === module) {
  const json = fs.readFileSync(path.join(ROOT, 'docs', 'tolerance-matrix.json'), 'utf8');
  fs.writeFileSync(path.join(ROOT, 'src', 'ToleranceMatrix.gs'), matrixSource(json));
}

module.exports = { matrixSource };
