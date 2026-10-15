// Every ID generation and Sheet write runs inside the script lock.
var LOCK_WAIT_MS = 10000;

function withScriptLock(work) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(LOCK_WAIT_MS)) throw new Error('Another run is saving changes. Try again in a moment.');
  try {
    return work();
  } finally {
    lock.releaseLock();
  }
}

// Next ID in a tab, such as CERT-004 after CERT-003. Call only inside withScriptLock.
function nextId(store, tab, column, prefix) {
  var max = store.readRows(tab).reduce(function (m, row) {
    var n = parseInt(String(row[column]).replace(prefix, ''), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return prefix + ('00' + (max + 1)).slice(-3);
}
