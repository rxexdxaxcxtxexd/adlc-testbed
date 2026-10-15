// Loads every deployed .gs file into one sandbox, the way Apps Script shares
// one global scope across files. Returned functions hand back plain JSON, so
// tests compare values, not objects from the sandbox's own realm.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = path.join(__dirname, '..', 'src');

function sandbox(globals) {
  const context = vm.createContext({ console, ...globals });
  for (const file of fs.readdirSync(SRC).filter((f) => f.endsWith('.gs')).sort()) {
    vm.runInContext(fs.readFileSync(path.join(SRC, file), 'utf8'), context, { filename: file });
  }
  return context;
}

const plain = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

function loadGs(names, globals = {}) {
  const context = sandbox(globals);
  const out = {};
  for (const name of names) {
    const fn = vm.runInContext(name, context);
    out[name] = typeof fn === 'function' ? (...args) => plain(fn(...args)) : plain(fn);
  }
  return out;
}

// For tests that drive adapters: functions come back unwrapped, so objects keep
// their methods. Pass results through plain() before comparing them.
function loadGsRaw(names, globals = {}) {
  const context = sandbox(globals);
  return Object.fromEntries(names.map((name) => [name, vm.runInContext(name, context)]));
}

// For tests that drive the entry points in Code.gs: the whole shared scope, so a test can
// replace one global (such as realDeps) the way a fake replaces a Google service.
function loadContext(globals = {}) {
  return sandbox(globals);
}

module.exports = { loadGs, loadGsRaw, loadContext, plain };
