// Shared by the Claude Code hooks. Claude Code sends a JSON payload on stdin;
// a hook exits 0 to carry on, or 2 to show its stderr to the agent.
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function projectRoot() {
  return process.env.CLAUDE_PROJECT_DIR || path.join(__dirname, '..', '..');
}

function readPayload() {
  try {
    return JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

// The full suite: every *.test.js, which includes the deployed-code and key checks.
// NODE_TEST_CONTEXT is removed so a run started from inside a test run reports
// normally instead of streaming results to its parent.
function runSuite(root) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--test'], { cwd: root, env, encoding: 'utf8', timeout: 120000 });
  if (result.error) return { ok: false, output: `Could not run the suite in ${root}: ${result.error.message}` };
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim().split('\n').slice(-30).join('\n');
  return { ok: result.status === 0, output };
}

module.exports = { projectRoot, readPayload, runSuite };
