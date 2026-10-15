// Helpers that blank out parts of a source file before a check searches it.
// Blanked text becomes spaces, and newlines stay, so line numbers still match
// the original file.

const STRINGS = /'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/;
const COMMENTS = /\/\*[\s\S]*?\*\/|\/\/[^\n]*/;
// Strings come first in the alternation, so a "//" inside a string stays a string.
const COMMENTS_AND_STRINGS = new RegExp(`${STRINGS.source}|${COMMENTS.source}`, 'g');

function blank(text) {
  return text.replace(/[^\n]/g, ' ');
}

function withoutComments(source) {
  return source.replace(COMMENTS_AND_STRINGS, (m) => (m.startsWith('/') ? blank(m) : m));
}

function withoutCommentsOrStrings(source) {
  return source.replace(COMMENTS_AND_STRINGS, blank);
}

// For a page, keep only the code inside <script> blocks.
function codeOf(source, file) {
  if (!file.endsWith('.html')) return source;
  return source.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)|[\s\S]/gi, (m, open, code, close) =>
    code === undefined ? blank(m) : blank(open) + code + blank(close),
  );
}

function lineAt(text, index) {
  return text.slice(0, index).split('\n').length;
}

module.exports = { withoutComments, withoutCommentsOrStrings, codeOf, lineAt };
