// Stop hook: before a turn ends, run the full suite. On failure the agent keeps
// working. If the agent is already continuing because of this hook
// (stop_hook_active), the turn ends anyway so an unfixable failure cannot loop;
// the failure is still printed.
const { projectRoot, readPayload, runSuite } = require('./run-suite');

const payload = readPayload();
const { ok, output } = runSuite(projectRoot());
if (ok) process.exit(0);

console.error(`Full suite failed. Fix it, or record why in docs/lessons.md:\n${output}`);
process.exit(payload.stop_hook_active ? 0 : 2);
