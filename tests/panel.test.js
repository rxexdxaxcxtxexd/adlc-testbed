// The review panel's wiring: agents, skills and the milestone docs they point at.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function frontmatter(text) {
  const block = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1];
  return Object.fromEntries(block.split(/\r?\n/).map((line) => line.split(/:\s(.*)/s).slice(0, 2)));
}

const LENSES = ['cfo', 'data', 'ux', 'engineering', 'claims'];

test('five reviewer agents exist, read-only, each reporting in the shared shape', () => {
  for (const lens of LENSES) {
    const agent = read(`.claude/agents/${lens}-reviewer.md`);
    const meta = frontmatter(agent);
    assert.equal(meta.name, `${lens}-reviewer`);
    assert.equal(meta.tools, 'Read, Grep, Glob', lens);
    assert.match(agent, /docs\/agents\/reviewer-report\.md/, lens);
  }
});

test('the report shape asks for a verdict and at most three issues with fixes', () => {
  const report = read('docs/agents/reviewer-report.md');
  assert.match(report, /Verdict: Pass \| Fix \| Block/);
  assert.match(report, /at most three issues/);
  assert.match(report, /Fix: /);
});

test('the three skills load by their folder names', () => {
  for (const skill of ['run-the-panel', 'project-self-review', 'template-from-best-work']) {
    assert.equal(frontmatter(read(`.claude/skills/${skill}/SKILL.md`)).name, skill);
  }
});

test('the stage table maps milestones 1 to 6 to existing docs and real agents', () => {
  const rows = read('.claude/skills/run-the-panel/SKILL.md')
    .split('\n')
    .filter((line) => /^\| \d /.test(line))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));

  assert.deepEqual(
    rows.map(([milestone]) => milestone),
    [
      '1 Foundation',
      '2 Intake and reading',
      '3 Checking and decisions',
      '4 Screens',
      '5 Automation',
      '6 Audit and handoff',
    ],
  );
  for (const [milestone, target, lenses] of rows) {
    for (const docPath of target.match(/docs\/[^`]+/g)) {
      assert.ok(fs.existsSync(path.join(ROOT, docPath)), `${milestone}: ${docPath}`);
    }
    for (const lens of lenses.split(', ')) {
      assert.ok(LENSES.includes(lens), `${milestone}: unknown lens ${lens}`);
    }
  }
});

test('the docs skeleton has the lessons log and the handoff runbook', () => {
  assert.match(read('docs/lessons.md'), /\| Date \| Milestone \| Lens \|/);
  assert.match(read('docs/handoff-runbook.md'), /## Daily run/);
});
