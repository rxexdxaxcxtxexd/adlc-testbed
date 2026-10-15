// Checks every file .claspignore lets through to Apps Script.
// Usage: node scripts/checks/deployed-code.js [project root]
// Exit 0 = clean. Exit 1 = each problem printed to stderr as file:line.
const fs = require('node:fs');
const path = require('node:path');
const { deployedFiles } = require('./deployed-files');
const { findForbiddenSyntax } = require('./forbidden-syntax');
const { findDollarAmounts, isComparisonLogic } = require('./dollar-amounts');
const { findMissingScopes } = require('./oauth-scopes');

function checkDeployedCode(root) {
  const problems = [];
  const manifestPath = path.join(root, 'appsscript.json');
  const scopes = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')).oauthScopes || [] : [];
  for (const file of deployedFiles(root)) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    for (const hit of findForbiddenSyntax(source, file)) {
      problems.push(`${file}:${hit.line} uses "${hit.word}"; Apps Script has no modules or promises`);
    }
    if (file.endsWith('.gs')) {
      for (const hit of findMissingScopes(source, scopes)) {
        problems.push(`${file}:${hit.line} uses ${hit.service}, but appsscript.json lacks ${hit.scope}`);
      }
    }
    if (!isComparisonLogic(source)) continue;
    for (const hit of findDollarAmounts(source)) {
      problems.push(`${file}:${hit.line} has dollar amount "${hit.text}"; read limits from the tolerance matrix`);
    }
  }
  return problems;
}

if (require.main === module) {
  const root = path.resolve(process.argv[2] || path.join(__dirname, '..', '..'));
  const problems = checkDeployedCode(root);
  for (const problem of problems) console.error(problem);
  process.exit(problems.length ? 1 : 0);
}

module.exports = { checkDeployedCode };
