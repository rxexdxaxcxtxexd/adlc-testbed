// Finds key-shaped strings before they reach git. Keys live in Script Properties.
// Usage:
//   node scripts/checks/secrets.js --staged   scan what is about to be committed (pre-commit hook)
//   node scripts/checks/secrets.js --tracked  scan every file git knows in this folder
// Exit 0 = clean. Exit 1 = each hit printed to stderr as file:line.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const PATTERNS = [
  { kind: 'Google API key', regex: /AIza[0-9A-Za-z_-]{35}/ },
  { kind: 'Google OAuth client secret', regex: /GOCSPX-[0-9A-Za-z_-]{28}/ },
  { kind: 'private key', regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { kind: 'GitHub token', regex: /\bgh[pousr]_[0-9A-Za-z]{36,}/ },
  { kind: 'AWS access key', regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { kind: 'secret key', regex: /\bsk-[0-9A-Za-z_-]{20,}/ },
];

function findSecrets(text) {
  const hits = [];
  text.split('\n').forEach((lineText, i) => {
    for (const { kind, regex } of PATTERNS) {
      if (regex.test(lineText)) hits.push({ line: i + 1, kind });
    }
  });
  return hits;
}

function git(args, cwd) {
  return execFileSync('git', args, { cwd, maxBuffer: 64 * 1024 * 1024 });
}

function namesFrom(buffer) {
  return buffer.toString('utf8').split('\0').filter(Boolean);
}

// Each file as git will store it: the staged copy, not the working copy.
function stagedFiles(cwd) {
  return namesFrom(git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'], cwd)).map((file) => ({
    file,
    content: git(['show', `:${file}`], cwd),
  }));
}

// Tracked files plus new files git would pick up; ignored files are skipped.
function trackedFiles(cwd) {
  return namesFrom(git(['ls-files', '-z', '--cached', '--others', '--exclude-standard'], cwd))
    .map((file) => path.join(cwd, file))
    .filter((full) => fs.existsSync(full))
    .map((full) => ({ file: path.relative(cwd, full), content: fs.readFileSync(full) }));
}

function scan(files) {
  const problems = [];
  for (const { file, content } of files) {
    if (content.includes(0)) continue; // binary
    for (const hit of findSecrets(content.toString('utf8'))) {
      problems.push(`${file}:${hit.line} looks like a ${hit.kind}; move it to Script Properties`);
    }
  }
  return problems;
}

if (require.main === module) {
  const cwd = process.cwd();
  const mode = process.argv[2];
  if (mode !== '--staged' && mode !== '--tracked') {
    console.error('Usage: node scripts/checks/secrets.js --staged | --tracked');
    process.exit(2);
  }
  const problems = scan(mode === '--staged' ? stagedFiles(cwd) : trackedFiles(cwd));
  for (const problem of problems) console.error(problem);
  if (problems.length) console.error('Commit refused: a key-shaped string is staged.');
  process.exit(problems.length ? 1 : 0);
}

module.exports = { findSecrets, scan, trackedFiles };
