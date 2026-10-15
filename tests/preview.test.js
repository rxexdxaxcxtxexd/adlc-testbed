// The local browser uses the same core without Google services.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { loadContext, plain } = require('./load-gs');

test('the local preview loads notifications without a Google settings service', () => {
  const context = loadContext({
    window: {}, location: { search: '' }, URLSearchParams,
    btoa: text => Buffer.from(text, 'latin1').toString('base64'),
    atob: text => Buffer.from(text, 'base64').toString('latin1'),
    setTimeout: callback => callback(),
  });
  const adapter = fs.readFileSync(path.join(__dirname, '../scripts/preview-adapter.js'), 'utf8');
  vm.runInContext(adapter, context, { filename: 'preview-adapter.js' });
  let result, failure;
  context.window.COIPreview.call('getNotifications', [], value => { result = plain(value); }, error => { failure = error; });
  assert.equal(failure, undefined);
  assert.equal(result.rows.length, 16);
  assert.equal(result.banner, 'Preview. These emails are drafted for review.');
  const correction = result.rows.find(row => row.event === 'Correction request' && row.record_id === 'REC-001');
  assert.equal(correction.drafted_by, 'Template');
  assert.match(correction.body, /Your certificate does not meet the project requirements\. Please send a corrected certificate\./);
});
