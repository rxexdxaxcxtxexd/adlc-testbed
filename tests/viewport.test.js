const test = require('node:test');
const assert = require('node:assert/strict');
const { loadContext } = require('./load-gs');

const WANT = 'width=device-width, initial-scale=1, viewport-fit=cover';

// Both pages must ask for edge-to-edge drawing, so the safe-area padding works on an iPhone.
function captureMeta(open) {
  const calls = [];
  const template = { evaluate: () => ({ setTitle: () => ({ addMetaTag: (name, content) => { calls.push([name, content]); return 'page'; } }) }) };
  const context = loadContext({
    HtmlService: { createTemplateFromFile: () => template },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) },
  });
  context.realDeps = () => ({ store: {} });
  context.uploadLinkInfo = () => ({});
  open(context);
  return calls;
}

test('the main page sets the viewport with viewport-fit=cover and no maximum-scale', () => {
  const calls = captureMeta((c) => c.doGet(undefined));
  assert.deepEqual(calls, [['viewport', WANT]]);
});

test('the upload page sets the viewport with viewport-fit=cover and no maximum-scale', () => {
  const calls = captureMeta((c) => c.uploadPage('abc'));
  assert.deepEqual(calls, [['viewport', WANT]]);
});
