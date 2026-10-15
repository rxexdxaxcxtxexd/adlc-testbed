// Writes the fictional sample certificates and their manifest to test-fixtures/sample-cois/.
// Run: node scripts/make-sample-cois.js
// No packages. Each PDF is written by hand with built-in fonts, in our own layout (not a
// standard form), and prints "SAMPLE: fictional certificate" on every page. The manifest
// lists every value printed and the problem planted in each file. Calibration compares the
// Reader's output to it, so edit the values here and nowhere else, then run this script.
const fs = require('node:fs');
const path = require('node:path');

const OUT = path.join(__dirname, '..', 'test-fixtures', 'sample-cois');
const BANNER = 'SAMPLE: fictional certificate';

const INSURERS = {
  A: 'Northgate Mutual Insurance Co.',
  B: 'Cedar Ridge Casualty Co.',
  C: 'Lantern Bay Indemnity Co.'
};

const NO_LIMITS = {
  commercial_liability: null, aggregate: null, auto: null, umbrella: null,
  workers_comp: null, pollution_liability: null, professional_liability: null
};
const BASE_LIMITS = {
  commercial_liability: 1000000, aggregate: 2000000, auto: 1000000, umbrella: 2000000,
  workers_comp: 1000000, pollution_liability: 1000000, professional_liability: null
};
const BASE_DATES = {
  gl: ['2026-10-01', '2027-09-30'], auto: ['2026-10-01', '2027-09-30'], umbrella: ['2026-10-01', '2027-09-30'],
  wc: ['2026-10-01', '2027-09-30'], pollution: ['2026-10-01', '2027-09-30'], professional: ['2026-10-01', '2027-09-30']
};

// One entry per PDF. `values` is what the Reader must return. `shows` is what the page prints
// beyond that: the policy dates (the expiry in `values` is the earliest of them).
const SAMPLES = [
  {
    file: '01-clean.pdf', problem: 'none', issued: '2026-10-01',
    producer: ['Alder & Finch Insurance Brokers', '88 Quarry Lane, Fairview'],
    operations: 'roofing services',
    dates: BASE_DATES,
    values: {
      insured_name: 'Ridgeline Roofing LLC', limits: { ...BASE_LIMITS },
      additional_insured_endorsement: true, project_address: true, certificate_holder: true,
      cancellation_notice_days: 30, expiration_date: '2027-09-30'
    }
  },
  {
    file: '02-clean-earthwork.pdf', problem: 'none (second insured; professional liability listed)', issued: '2026-11-12',
    producer: ['Marlow Coast Risk Partners', '14 Tidewater Road, Fairview'],
    operations: 'excavation and grading',
    dates: {
      gl: ['2027-01-15', '2028-01-15'], auto: ['2027-01-15', '2028-01-15'], umbrella: ['2027-01-15', '2028-01-15'],
      wc: ['2027-01-15', '2028-01-15'], pollution: ['2027-01-15', '2028-01-15'], professional: ['2027-01-15', '2028-01-15']
    },
    values: {
      insured_name: 'Birchwood Earthworks Inc.',
      limits: {
        commercial_liability: 2000000, aggregate: 4000000, auto: 1000000, umbrella: 5000000,
        workers_comp: 1000000, pollution_liability: 2000000, professional_liability: 1000000
      },
      additional_insured_endorsement: true, project_address: true, certificate_holder: true,
      cancellation_notice_days: 30, expiration_date: '2028-01-15'
    }
  },
  {
    file: '03-expired.pdf', problem: 'expired policy', issued: '2024-04-02',
    producer: ['Alder & Finch Insurance Brokers', '88 Quarry Lane, Fairview'],
    operations: 'roofing services',
    dates: {
      gl: ['2024-04-01', '2025-03-31'], auto: ['2024-07-01', '2025-06-30'], umbrella: ['2024-07-01', '2025-06-30'],
      wc: ['2024-07-01', '2025-06-30'], pollution: ['2024-04-01', '2025-03-31'], professional: ['2024-04-01', '2025-03-31']
    },
    values: {
      insured_name: 'Ridgeline Roofing LLC', limits: { ...BASE_LIMITS },
      additional_insured_endorsement: true, project_address: true, certificate_holder: true,
      cancellation_notice_days: 30, expiration_date: '2025-03-31'
    }
  },
  {
    file: '04-low-limit.pdf', problem: 'limit below requirement (general liability each occurrence)', issued: '2026-08-14',
    producer: ['Alder & Finch Insurance Brokers', '88 Quarry Lane, Fairview'],
    operations: 'roofing services',
    dates: {
      gl: ['2026-07-01', '2027-06-30'], auto: ['2026-07-01', '2027-06-30'], umbrella: ['2026-07-01', '2027-06-30'],
      wc: ['2026-07-01', '2027-06-30'], pollution: ['2026-07-01', '2027-06-30'], professional: ['2026-07-01', '2027-06-30']
    },
    values: {
      insured_name: 'Ridgeline Roofing LLC', limits: { ...BASE_LIMITS, commercial_liability: 500000, aggregate: 1000000 },
      additional_insured_endorsement: true, project_address: true, certificate_holder: true,
      cancellation_notice_days: 45, expiration_date: '2027-06-30'
    }
  },
  {
    file: '05-wrong-insured.pdf', problem: 'wrong insured name', issued: '2026-10-01',
    producer: ['Alder & Finch Insurance Brokers', '88 Quarry Lane, Fairview'],
    operations: 'roofing services',
    dates: BASE_DATES,
    values: {
      insured_name: 'Ridgeline Roofing Partners LLC', limits: { ...BASE_LIMITS },
      additional_insured_endorsement: true, project_address: true, certificate_holder: true,
      cancellation_notice_days: 30, expiration_date: '2027-09-30'
    }
  },
  {
    file: '06-no-additional-insured.pdf', problem: 'missing additional insured endorsement', issued: '2026-09-20',
    producer: ['Alder & Finch Insurance Brokers', '88 Quarry Lane, Fairview'],
    operations: 'roofing services',
    dates: {
      gl: ['2026-04-01', '2027-03-31'], auto: ['2026-04-01', '2027-03-31'], umbrella: ['2026-04-01', '2027-03-31'],
      wc: ['2026-04-01', '2027-03-31'], pollution: ['2026-04-01', '2027-03-31'], professional: ['2026-04-01', '2027-03-31']
    },
    values: {
      insured_name: 'Ridgeline Roofing LLC', limits: { ...BASE_LIMITS },
      additional_insured_endorsement: false, project_address: true, certificate_holder: true,
      cancellation_notice_days: 30, expiration_date: '2027-03-31'
    }
  }
];

const UNREADABLE = [
  { file: '07-corrupt.pdf', problem: 'corrupt file (a real certificate cut off partway through)' },
  { file: '08-not-a-pdf.pdf', problem: 'not a PDF (plain text with a .pdf name)' }
];

const usd = (n) => '$' + n.toLocaleString('en-US');
const usDate = (iso) => iso.slice(5, 7) + '/' + iso.slice(8, 10) + '/' + iso.slice(0, 4);

// Collects drawing commands for one 612 x 792 page.
function page() {
  const ops = [];
  const esc = (s) => {
    if (/[^\x20-\x7e]/.test(s)) throw new Error('Non-ASCII text in sample: ' + s);
    return s.replace(/[\\()]/g, '\\$&');
  };
  return {
    text(x, y, size, s, bold = false) { ops.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${esc(s)}) Tj ET`); },
    rect(x, y, w, h) { ops.push(`0.5 w ${x} ${y} ${w} ${h} re S`); },
    line(x1, y1, x2, y2) { ops.push(`0.5 w ${x1} ${y1} m ${x2} ${y2} l S`); },
    stream() { return ops.join('\n'); }
  };
}

// Assembles pages into a valid PDF with a correct cross-reference table.
function assemble(streams) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${streams.map((_, i) => `${5 + i * 2} 0 R`).join(' ')}] /Count ${streams.length} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>'
  ];
  streams.forEach((s, i) => {
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${6 + i * 2} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(s, 'latin1')} >>\nstream\n${s}\nendstream`);
  });
  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out, 'latin1'));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((o) => { out += String(o).padStart(10, '0') + ' 00000 n \n'; });
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

function certificatePage(s) {
  const v = s.values;
  const p = page();
  p.text(40, 764, 11, BANNER, true);
  p.text(40, 738, 17, 'Certificate of Insurance', true);
  p.text(40, 724, 8, 'Sample layout for demonstration only. Not a standard industry form.');
  p.text(420, 738, 9, 'Date issued: ' + usDate(s.issued));

  p.rect(40, 650, 250, 60);
  p.text(46, 700, 7, 'PRODUCER', true);
  p.text(46, 686, 9, s.producer[0]);
  p.text(46, 674, 9, s.producer[1]);
  p.rect(322, 650, 250, 60);
  p.text(328, 700, 7, 'INSURED', true);
  p.text(328, 686, 9, v.insured_name);
  p.text(328, 674, 9, '2200 Millrace Drive, Fairview');

  p.text(40, 632, 7, 'INSURERS', true);
  p.text(40, 621, 8, `A: ${INSURERS.A}    B: ${INSURERS.B}    C: ${INSURERS.C}`);

  const cols = [40, 168, 192, 262, 317, 372, 535];
  p.text(cols[0], 600, 7, 'COVERAGE', true);
  p.text(cols[1], 600, 7, 'INSR', true);
  p.text(cols[2], 600, 7, 'POLICY NO.', true);
  p.text(cols[3], 600, 7, 'EFFECTIVE', true);
  p.text(cols[4], 600, 7, 'EXPIRES', true);
  p.text(cols[5], 600, 7, 'LIMITS (US DOLLARS)', true);
  p.text(cols[6], 600, 7, 'ADDL INSD', true);
  p.line(40, 595, 572, 595);

  const L = v.limits;
  const rows = [
    { key: 'gl', name: ['General liability'], insr: 'A', no: 'GL-48213',
      limits: [`Each occurrence   ${usd(L.commercial_liability)}`, `General aggregate   ${usd(L.aggregate)}`],
      addl: v.additional_insured_endorsement ? 'Yes' : 'No' },
    { key: 'auto', name: ['Automobile liability'], insr: 'A', no: 'AU-77120',
      limits: [`Combined single limit   ${usd(L.auto)}`], addl: '-' },
    { key: 'umbrella', name: ['Umbrella / excess', 'liability'], insr: 'B', no: 'UM-30551',
      limits: [`Each occurrence   ${usd(L.umbrella)}`], addl: '-' },
    { key: 'wc', name: ['Workers compensation', "and employer's liability"], insr: 'C', no: 'WC-90417',
      limits: [`E.L. each accident   ${usd(L.workers_comp)}`, 'Workers comp: statutory limits'], addl: '-' }
  ];
  if (L.pollution_liability !== null) {
    rows.push({ key: 'pollution', name: ['Pollution liability'], insr: 'B', no: 'PL-61388', limits: [`Each claim   ${usd(L.pollution_liability)}`], addl: '-' });
  }
  if (L.professional_liability !== null) {
    rows.push({ key: 'professional', name: ['Professional liability'], insr: 'B', no: 'PR-20964', limits: [`Each claim   ${usd(L.professional_liability)}`], addl: '-' });
  }
  let y = 582;
  for (const r of rows) {
    r.name.forEach((t, i) => p.text(cols[0], y - i * 10, 8, t));
    p.text(cols[1], y, 8, r.insr);
    p.text(cols[2], y, 8, r.no);
    p.text(cols[3], y, 8, usDate(s.dates[r.key][0]));
    p.text(cols[4], y, 8, usDate(s.dates[r.key][1]));
    r.limits.forEach((t, i) => p.text(cols[5], y - i * 10, 8, t));
    p.text(cols[6], y, 8, r.addl);
    y -= 34;
    p.line(40, y + 12, 572, y + 12);
  }

  const descTop = 330;
  p.rect(40, 200, 532, 120);
  p.text(46, descTop - 8, 7, 'DESCRIPTION OF OPERATIONS', true);
  p.text(46, descTop - 24, 9, `Operations: ${s.operations}.`);
  p.text(46, descTop - 38, 9, v.project_address ? 'Project: Maple Court Residences, 410 Alder Street, Fairview.' : 'Project: not stated.');
  if (v.additional_insured_endorsement) {
    p.text(46, descTop - 52, 9, 'The certificate holder is included as an additional insured on the general');
    p.text(46, descTop - 64, 9, 'liability policy by endorsement, for work performed on the project above.');
  }

  p.rect(40, 120, 250, 64);
  p.text(46, 174, 7, 'CERTIFICATE HOLDER', true);
  if (v.certificate_holder) {
    p.text(46, 160, 9, 'Maple Court Development Partners LP');
    p.text(46, 148, 9, '410 Alder Street, Fairview');
  } else {
    p.text(46, 160, 9, '(none named)');
  }

  p.text(40, 100, 8, `Should a policy above be cancelled before its expiration date, the insurer will give`);
  p.text(40, 90, 8, v.cancellation_notice_days === null
    ? 'no notice period is stated.'
    : `written notice to the certificate holder ${v.cancellation_notice_days} days before cancellation.`);

  p.text(40, 24, 9, BANNER, true);
  return p.stream();
}

function notAPdf() {
  return Buffer.from('Plain text note, not a certificate.\nThis file only has a .pdf name.\n' + BANNER + '\n', 'latin1');
}

function build() {
  const files = new Map();
  const manifest = {
    note: 'Fictional data. Every value below is printed on its PDF. Calibration compares the Reader to this file.',
    samples: []
  };
  for (const s of SAMPLES) {
    files.set(s.file, assemble([certificatePage(s)]));
    manifest.samples.push({ file: s.file, problem: s.problem, readable: true, expected: s.values });
  }
  const clean = files.get('01-clean.pdf');
  files.set('07-corrupt.pdf', clean.subarray(0, Math.floor(clean.length * 0.6)));
  files.set('08-not-a-pdf.pdf', notAPdf());
  for (const u of UNREADABLE) manifest.samples.push({ file: u.file, problem: u.problem, readable: false });
  return { files, manifest };
}

if (require.main === module) {
  const { files, manifest } = build();
  fs.mkdirSync(OUT, { recursive: true });
  for (const [name, bytes] of files) fs.writeFileSync(path.join(OUT, name), bytes);
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Wrote ${files.size} files and manifest.json to ${OUT}`);
}

module.exports = { build, BANNER };
