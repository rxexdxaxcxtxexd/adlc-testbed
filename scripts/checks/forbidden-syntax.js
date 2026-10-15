// Apps Script runs plain script files: no modules and no promises.
// These four words in deployed code mean something will break on deploy.
const { withoutCommentsOrStrings, codeOf, lineAt } = require('./source-text');

const FORBIDDEN = /\b(require|import|async|await)\b/g;

function findForbiddenSyntax(source, file) {
  const code = withoutCommentsOrStrings(codeOf(source, file));
  return [...code.matchAll(FORBIDDEN)].map((m) => ({ line: lineAt(code, m.index), word: m[1] }));
}

module.exports = { findForbiddenSyntax };
