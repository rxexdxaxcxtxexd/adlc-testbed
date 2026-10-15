// PostToolUse hook: after an edit to rules, reading or core code (or the tests
// and tooling that guard them), run the suite and report a failure to the agent.
// Prose docs skip the run.
const path = require('node:path');
const { projectRoot, readPayload, runSuite } = require('./run-suite');

const WATCHED = ['src/', 'tests/', 'scripts/', '.claude/', 'docs/tolerance-matrix.json', '.claspignore', 'package.json', 'appsscript.json'];

const root = projectRoot();
const edited = (readPayload().tool_input || {}).file_path || '';
const rel = path.relative(root, edited).split(path.sep).join('/');

if (!edited || !WATCHED.some((prefix) => rel.startsWith(prefix))) process.exit(0);

const { ok, output } = runSuite(root);
if (ok) process.exit(0);
console.error(`Tests failed after editing ${rel}. Fix before moving on:\n${output}`);
process.exit(2);
