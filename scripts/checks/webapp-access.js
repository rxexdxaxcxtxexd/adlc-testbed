// Checks that the web app opens with no Google sign-in. In appsscript.json, "ANYONE" means any
// signed-in Google user, and every deployment copies the manifest (ticket 14, docs/decisions.md Phase 5).
// Usage: node scripts/checks/webapp-access.js [project root]
// Exit 0 = webapp.access is ANYONE_ANONYMOUS. Exit 1 = the problem printed to stderr.
const fs = require('node:fs');
const path = require('node:path');

const REQUIRED_ACCESS = 'ANYONE_ANONYMOUS';

// manifest: the parsed appsscript.json. Returns the problem text, or '' when the access is right.
function webappAccessProblem(manifest) {
  const access = manifest && manifest.webapp ? manifest.webapp.access : undefined;
  if (access === REQUIRED_ACCESS) return '';
  return `appsscript.json webapp.access is ${access === undefined ? 'missing' : JSON.stringify(access)}; it must be "${REQUIRED_ACCESS}" so visitors need no sign-in`;
}

function checkWebappAccess(root) {
  const manifestPath = path.join(root, 'appsscript.json');
  if (!fs.existsSync(manifestPath)) return 'appsscript.json is missing';
  return webappAccessProblem(JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
}

if (require.main === module) {
  const root = path.resolve(process.argv[2] || path.join(__dirname, '..', '..'));
  const problem = checkWebappAccess(root);
  if (problem) console.error(problem);
  process.exit(problem ? 1 : 0);
}

module.exports = { webappAccessProblem, checkWebappAccess, REQUIRED_ACCESS };
