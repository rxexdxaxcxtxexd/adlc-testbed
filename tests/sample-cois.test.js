// The sample certificates and manifest in test-fixtures/sample-cois/.
// Expected values are written by hand from the planted problems.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { build } = require('../scripts/make-sample-cois');

const DIR = path.join(__dirname, '..', 'test-fixtures', 'sample-cois');
const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));
const entry = (file) => manifest.samples.find((s) => s.file === file);
const bytes = (file) => fs.readFileSync(path.join(DIR, file));
const readable = manifest.samples.filter((s) => s.readable);

test('the committed files match what the generator makes', () => {
  const { files, manifest: made } = build();
  assert.deepEqual(made, manifest);
  for (const [name, content] of files) assert.ok(content.equals(bytes(name)), `${name} is out of date; run node scripts/make-sample-cois.js`);
  assert.deepEqual(fs.readdirSync(DIR).sort(), [...files.keys(), 'manifest.json'].sort());
});

test('there are at least six samples, with the five planted problems and an unreadable file', () => {
  assert.ok(manifest.samples.length >= 6);
  const problems = manifest.samples.map((s) => s.problem).join(' | ');
  for (const wanted of ['none', 'expired policy', 'limit below requirement', 'wrong insured name', 'missing additional insured endorsement']) {
    assert.ok(problems.includes(wanted), `no sample for: ${wanted}`);
  }
  assert.ok(manifest.samples.some((s) => !s.readable));
});

test('every readable sample is a whole PDF that prints the sample banner on every page', () => {
  for (const s of readable) {
    const text = bytes(s.file).toString('latin1');
    assert.ok(text.startsWith('%PDF-1.4\n'), s.file);
    assert.ok(text.endsWith('%%EOF\n'), s.file);
    const pages = (text.match(/\/Type \/Page /g) || []).length;
    const banners = (text.match(/\(SAMPLE: fictional certificate\) Tj/g) || []).length;
    assert.ok(pages >= 1 && banners >= pages, `${s.file}: ${banners} banners on ${pages} pages`);
  }
});

test('the cross-reference table points at every object', () => {
  for (const s of readable) {
    const text = bytes(s.file).toString('latin1');
    const start = Number(/startxref\n(\d+)\n/.exec(text)[1]);
    assert.ok(text.slice(start).startsWith('xref\n'), s.file);
    const offsets = [...text.slice(start).matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    assert.ok(offsets.length >= 6);
    offsets.forEach((offset, i) => assert.ok(text.slice(offset).startsWith(`${i + 1} 0 obj\n`), `${s.file} object ${i + 1}`));
  }
});

test('the insureds are the three fictional ones', () => {
  const insureds = new Set(readable.map((s) => s.expected.insured_name));
  assert.deepEqual([...insureds].sort(), [
    'Birchwood Earthworks Inc.', 'Ridgeline Roofing LLC', 'Ridgeline Roofing Partners LLC'
  ]);
});

test('the unreadable samples are a cut-off PDF and a text file', () => {
  const corrupt = bytes('07-corrupt.pdf').toString('latin1');
  assert.ok(corrupt.startsWith('%PDF-1.4'));
  assert.ok(!corrupt.includes('%%EOF'));
  assert.ok(!bytes('08-not-a-pdf.pdf').toString('latin1').startsWith('%PDF'));
  assert.deepEqual(entry('07-corrupt.pdf').readable, false);
  assert.deepEqual(entry('08-not-a-pdf.pdf').readable, false);
});

test('the manifest holds the planted values', () => {
  assert.deepEqual(entry('01-clean.pdf').expected, {
    insured_name: 'Ridgeline Roofing LLC',
    limits: {
      commercial_liability: 1000000, aggregate: 2000000, auto: 1000000, umbrella: 2000000,
      workers_comp: 1000000, pollution_liability: 1000000, professional_liability: null
    },
    additional_insured_endorsement: true, project_address: true, certificate_holder: true,
    cancellation_notice_days: 30, expiration_date: '2027-09-30'
  });
  assert.equal(entry('03-expired.pdf').expected.expiration_date, '2025-03-31');
  assert.equal(entry('04-low-limit.pdf').expected.limits.commercial_liability, 500000);
  assert.equal(entry('04-low-limit.pdf').expected.limits.aggregate, 1000000);
  assert.equal(entry('05-wrong-insured.pdf').expected.insured_name, 'Ridgeline Roofing Partners LLC');
  assert.equal(entry('06-no-additional-insured.pdf').expected.additional_insured_endorsement, false);
  assert.equal(entry('02-clean-earthwork.pdf').expected.limits.professional_liability, 1000000);
});

test('the printed text agrees with the manifest for the planted values', () => {
  const text = (file) => bytes(file).toString('latin1');
  assert.ok(text('04-low-limit.pdf').includes('Each occurrence   $500,000'));
  assert.ok(text('05-wrong-insured.pdf').includes('(Ridgeline Roofing Partners LLC) Tj'));
  assert.ok(text('03-expired.pdf').includes('(03/31/2025) Tj'));
  assert.ok(!text('06-no-additional-insured.pdf').includes('additional insured on the general'));
  assert.ok(text('01-clean.pdf').includes('additional insured on the general'));
});
