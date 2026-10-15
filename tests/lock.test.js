// withScriptLock: ID generation and Sheet writes run only inside a script lock taken with tryLock.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGsRaw } = require('./load-gs');

function fakeLockService(granted) {
  const calls = [];
  return {
    calls,
    LockService: {
      getScriptLock: () => ({
        tryLock: (ms) => { calls.push(`tryLock ${ms}`); return granted; },
        releaseLock: () => calls.push('release'),
      }),
    },
  };
}

test('the work runs between tryLock and release, and its result comes back', () => {
  const fake = fakeLockService(true);
  const { withScriptLock } = loadGsRaw(['withScriptLock'], { LockService: fake.LockService });
  assert.equal(withScriptLock(() => { fake.calls.push('work'); return 'done'; }), 'done');
  assert.deepEqual(fake.calls, ['tryLock 10000', 'work', 'release']);
});

test('the lock is released when the work throws', () => {
  const fake = fakeLockService(true);
  const { withScriptLock } = loadGsRaw(['withScriptLock'], { LockService: fake.LockService });
  assert.throws(() => withScriptLock(() => { throw new Error('boom'); }), /boom/);
  assert.deepEqual(fake.calls, ['tryLock 10000', 'release']);
});

test('when the lock is busy the work does not run and the caller is told', () => {
  const fake = fakeLockService(false);
  const { withScriptLock } = loadGsRaw(['withScriptLock'], { LockService: fake.LockService });
  let ran = false;
  assert.throws(() => withScriptLock(() => { ran = true; }), /Another run is saving changes/);
  assert.equal(ran, false);
  assert.deepEqual(fake.calls, ['tryLock 10000']);
});
