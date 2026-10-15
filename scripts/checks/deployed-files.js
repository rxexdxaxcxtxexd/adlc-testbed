// Which files clasp pushes to Apps Script, decided by .claspignore alone.
// Every deployed-code check reads this list, so .claspignore is the single
// definition of "deployed code".
const fs = require('node:fs');
const path = require('node:path');

const SKIP_DIRS = new Set(['.git', 'node_modules']);

function readIgnorePatterns(root) {
  return fs
    .readFileSync(path.join(root, '.claspignore'), 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

// .claspignore holds deny lines only, so any match keeps the file out.
// A top-level pattern such as "*.md" also matches in subfolders, as in clasp.
function isDeployed(relPath, patterns) {
  const name = path.posix.basename(relPath);
  return !patterns.some((p) => path.posix.matchesGlob(relPath, p) || (!p.includes('/') && path.posix.matchesGlob(name, p)));
}

function listFiles(root, dir = root) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(root, full));
    else files.push(path.relative(root, full).split(path.sep).join('/'));
  }
  return files;
}

function deployedFiles(root) {
  const patterns = readIgnorePatterns(root);
  return listFiles(root).filter((file) => isDeployed(file, patterns));
}

module.exports = { readIgnorePatterns, isDeployed, listFiles, deployedFiles };
