// Coverage limits come only from the tolerance matrix. A dollar amount typed
// into the comparison logic is a second, silent copy of a limit.
//
// "Comparison logic" is the deployed file that defines evaluateCoi, wherever it
// lives. Keep evaluateCoi and its helpers in that file and other code out of it:
// any number of 1000 or more there counts as a dollar amount.
const { withoutComments, withoutCommentsOrStrings, lineAt } = require('./source-text');

const DOLLAR_SIGN = /\$\s?\d+(?:[,_]\d{3})*(?:\.\d+)?/.source;
const THOUSANDS = /(?<![\w$.])\d{1,3}(?:,\d{3})+(?!\w)/.source;
const NUMBER = /(?<![\w$.])\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?(?![\w$])/.source;
const AMOUNT = new RegExp(`(${DOLLAR_SIGN})|(${THOUSANDS})|(${NUMBER})`, 'g');

const DEFINES_EVALUATOR = /\bfunction\s+evaluateCoi\b|\bevaluateCoi\s*[=:]/;

function isComparisonLogic(source) {
  return DEFINES_EVALUATOR.test(withoutCommentsOrStrings(source));
}

// Comments are skipped; strings are not, since a limit inside a message is still a copy.
function findDollarAmounts(source) {
  const code = withoutComments(source);
  const hits = [];
  for (const m of code.matchAll(AMOUNT)) {
    const isNumber = m[3] !== undefined;
    if (isNumber && Number(m[3].replace(/_/g, '')) < 1000) continue;
    hits.push({ line: lineAt(code, m.index), text: m[0] });
  }
  return hits;
}

module.exports = { findDollarAmounts, isComparisonLogic };
