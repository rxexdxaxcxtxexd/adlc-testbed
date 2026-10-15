/* Record detail: shared sample data and behavior for the Round 3 direction studies.
   Each direction file brings its own stylesheet and calls RecordDetail.mount({ ... }).
   The sample data is shaped like docs/design/screens/field-notes.md section 6.4,
   so the build can swap it for server calls. Wording and check rules match Round 2
   (RecordDetail.dc.html), which mirrors evaluateCoi in src/Evaluate.gs. */
(function () {
  'use strict';

  /* ---------- Sample data (fictional) ---------- */

  const SAMPLE = {
    firm: 'Harborline Builders',
    now: 'Oct 8, 2026 · 10:42 AM',
    nowShort: 'Oct 8, 2026, 10:42 AM',
    roles: { accountant: 'Accountant', project_manager: 'Project manager', leadership: 'Leadership' },
    people: { accountant: 'Dana Reyes', project_manager: 'Marcus Webb', leadership: 'Elena Park' },
    nav: [['projects', 'Projects'], ['dashboard', 'Compliance dashboard'], ['worklist', 'Worklist'], ['hold', 'Payment hold list'], ['roi', 'Return on investment']],
    // Required values: docs/tolerance-matrix.json (sample requirements, not real)
    rules: { glOcc: ['General liability', 1000000], agg: ['Aggregate', 2000000], auto: ['Auto', 1000000], umb: ['Umbrella', 2000000], wc: ["Workers' comp", null], pol: ['Pollution', 1000000] },
    checks: [['ai', 'Additional insured endorsement'], ['addr', 'Project address'], ['holder', 'Certificate holder']],
    records: {
      ridgeline: {
        id: 'REC-001', name: 'Ridgeline Roofing LLC', scope: 'Roofing', project: 'Maple Court Residences',
        status: 'In review', waiting: 'Waiting for a decision on a deficiency', next: 'decide', conf: 93, w9: true, hold: [], pollution: true,
        values: { glOcc: 1000000, agg: 2000000, auto: 1000000, umb: 1000000, wc: 1000000, pol: 1000000, ai: true, addr: true, holder: true, insuredName: 'Ridgeline Roofing Partners LLC', cancel: 30 },
        address: '41 Quarry Road, Millbrook', period: 'Jan 15, 2026 to Jan 15, 2027',
        facts: [['Policy period', 'Jan 15, 2026 to Jan 15, 2027'], ['Expires', 'Jan 15, 2027'], ['Current certificate', 'None on file']],
        updated: 'Oct 8, 2026, 9:20 AM', uploadedLine: 'Uploaded Oct 8, 2026 by Ridgeline Roofing LLC (Subcontractor)',
        confText: 'Above the 85% line, so the values were not sent for a second look. Code ran the check; the deficiencies wait for a person.',
        timeline: [
          { when: 'Oct 8, 2026 · 9:20 AM', who: 'System', text: 'Sent to Marcus Webb (Project manager) for a decision on the deficiencies.', kind: 'system' },
          { when: 'Oct 8, 2026 · 9:19 AM', who: 'System', text: 'Checked against the Maple Court Residences requirements. Fails: umbrella, insured name.', kind: 'system' },
          { when: 'Oct 8, 2026 · 9:18 AM', who: 'System', text: 'Read automatically. Reading confidence 93%.', kind: 'system' },
          { when: 'Oct 8, 2026 · 9:12 AM', who: 'Ridgeline Roofing LLC', role: 'Subcontractor', text: 'Uploaded a certificate through the upload link.', kind: 'system' },
          { when: 'Sep 28, 2026 · 2:05 PM', who: 'System', text: 'Upload link sent to Ridgeline Roofing LLC.', kind: 'system' },
          { when: 'Sep 28, 2026 · 2:04 PM', who: 'Dana Reyes', role: 'Accountant', text: 'Added Ridgeline Roofing LLC to Maple Court Residences.', kind: 'decision' }
        ]
      },
      summit: {
        id: 'REC-021', name: 'Summit Mechanical', scope: 'Mechanical', project: 'Maple Court Residences',
        status: 'Expiring soon', currentStatus: 'Expiring soon', waiting: 'Needs review', next: 'correct', conf: 78, w9: true, hold: [],
        values: { glOcc: 1000000, agg: 2000000, auto: 100000, umb: 2000000, wc: 1000000, pol: 1000000, ai: true, addr: true, holder: true, insuredName: 'Summit Mechanical', cancel: 30 },
        pdfTrue: { auto: 1000000 },
        address: '220 Mill Street, Harbor Point', period: 'Oct 31, 2026 to Oct 31, 2027',
        facts: [['Current certificate expires', 'Oct 31, 2026'], ['Renewal policy period', 'Oct 31, 2026 to Oct 31, 2027']],
        afterApproveFacts: [['Policy period', 'Oct 31, 2026 to Oct 31, 2027'], ['Expires', 'Oct 31, 2027']],
        updated: 'Oct 8, 2026, 9:02 AM', uploadedLine: 'Renewal uploaded Oct 8, 2026 by Summit Mechanical (Subcontractor)',
        confText: '',
        timeline: [
          { when: 'Oct 8, 2026 · 9:02 AM', who: 'System', text: 'Sent to a person because reading confidence is below 85%.', kind: 'system' },
          { when: 'Oct 8, 2026 · 9:01 AM', who: 'System', text: 'Read automatically. Reading confidence 78%.', kind: 'system' },
          { when: 'Oct 8, 2026 · 8:55 AM', who: 'Summit Mechanical', role: 'Subcontractor', text: 'Uploaded a renewal certificate through the upload link.', kind: 'system' },
          { when: 'Oct 1, 2026 · 7:00 AM', who: 'System', text: '30-day reminder sent. The current certificate expires Oct 31, 2026.', kind: 'system' },
          { when: 'Nov 3, 2025 · 11:10 AM', who: 'Dana Reyes', role: 'Accountant', text: 'Approved the current certificate.', kind: 'decision' }
        ]
      }
    },
    recordOrder: [['ridgeline', 'Ridgeline Roofing LLC · deficiency'], ['summit', 'Summit Mechanical · low confidence']]
  };

  /* ---------- Icons (inline SVG, 16 px grid, stroke = currentColor) ---------- */

  const P = 'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';
  const svg = (d, cls) => '<svg class="ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 16 16" aria-hidden="true" ' + P + '>' + d + '</svg>';
  const ICON = {
    back: svg('<path d="M10 3.5L5.5 8l4.5 4.5"/>'),
    check: svg('<path d="M3.5 8.5l3 3 6-6.5"/>'),
    cross: svg('<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>'),
    minus: svg('<path d="M4 8h8"/>'),
    alert: svg('<circle cx="8" cy="8" r="6.2"/><path d="M8 4.8v3.6"/><circle cx="8" cy="11" r=".4" fill="currentColor"/>'),
    lock: svg('<rect x="3" y="7" width="10" height="7" rx="1.5"/><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2"/>'),
    doc: svg('<path d="M4 1.8h5.5L12.5 5v9.2H4Z"/><path d="M9.5 1.8V5h3"/>'),
    out: svg('<path d="M9 2.5h4.5V7M13.5 2.5L7.5 8.5M11.5 9.5v4h-9v-9h4"/>'),
    person: svg('<circle cx="8" cy="5.5" r="2.6"/><path d="M3 13.8c.7-2.6 2.7-3.9 5-3.9s4.3 1.3 5 3.9"/>'),
    gear: svg('<circle cx="8" cy="8" r="2.2"/><path d="M8 1.8v1.8M8 12.4v1.8M1.8 8h1.8M12.4 8h1.8M3.6 3.6l1.3 1.3M11.1 11.1l1.3 1.3M3.6 12.4l1.3-1.3M11.1 4.9l1.3-1.3"/>'),
    pencil: svg('<path d="M10.8 2.7l2.5 2.5L6 12.5l-3.2.7.7-3.2Z"/>'),
    keys: svg('<rect x="1.8" y="4" width="12.4" height="8" rx="1.5"/><path d="M4.5 6.6h.01M7 6.6h.01M9.5 6.6h.01M12 6.6h.01M5 9.4h6"/>'),
    grid: svg('<rect x="2.2" y="2.2" width="4.6" height="4.6" rx="1"/><rect x="9.2" y="2.2" width="4.6" height="4.6" rx="1"/><rect x="2.2" y="9.2" width="4.6" height="4.6" rx="1"/><rect x="9.2" y="9.2" width="4.6" height="4.6" rx="1"/>'),
    gauge: svg('<path d="M2.5 11.5a5.5 5.5 0 1 1 11 0"/><path d="M8 11.5l2.6-3.4"/>'),
    list: svg('<path d="M5.5 4h8M5.5 8h8M5.5 12h8"/><path d="M2.5 4h.01M2.5 8h.01M2.5 12h.01"/>'),
    pause: svg('<rect x="2.2" y="2.2" width="11.6" height="11.6" rx="2"/><path d="M6.5 5.5v5M9.5 5.5v5"/>'),
    coin: svg('<circle cx="8" cy="8" r="6.2"/><path d="M9.8 5.7c-.4-.5-1-.8-1.8-.8-1 0-1.8.6-1.8 1.4 0 1.9 3.7 1 3.7 3 0 .8-.8 1.5-1.9 1.5-.8 0-1.5-.3-1.9-.9M8 3.6v1.3M8 11v1.3"/>'),
    flag: svg('<path d="M3.5 14V2.5M3.5 2.8h8l-1.6 2.9 1.6 2.9h-8"/>'),
    clock: svg('<circle cx="8" cy="8" r="6.2"/><path d="M8 4.6V8l2.3 1.4"/>'),
    half: svg('<circle cx="8" cy="8" r="6.2"/><path d="M8 1.8v12.4A6.2 6.2 0 0 0 8 1.8Z" fill="currentColor" stroke="none"/>'),
    ring: svg('<circle cx="8" cy="8" r="6.2" stroke-dasharray="2.4 2"/>'),
    checkCircle: svg('<circle cx="8" cy="8" r="6.2"/><path d="M5.3 8.3l1.8 1.8 3.6-3.9"/>'),
    crossCircle: svg('<circle cx="8" cy="8" r="6.2"/><path d="M5.8 5.8l4.4 4.4M10.2 5.8l-4.4 4.4"/>'),
    minusCircle: svg('<circle cx="8" cy="8" r="6.2"/><path d="M5.3 8h5.4"/>'),
    x: svg('<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>')
  };
  // Status word -> tone + shape. Color is never the only signal.
  const STATUS = {
    'Awaiting': ['blue', ICON.ring], 'Needs review': ['amber', ICON.alert], 'In review': ['violet', ICON.half],
    'Compliant': ['green', ICON.checkCircle], 'Expiring soon': ['amber', ICON.clock], 'Expired': ['red', ICON.crossCircle], 'Closed': ['neutral', ICON.minusCircle]
  };

  /* ---------- Helpers ---------- */

  const usd = n => '$' + Number(n).toLocaleString('en-US');
  const num = s => { const n = String(s == null ? '' : s).replace(/[^0-9]/g, ''); return n ? Number(n) : null; };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clone = o => JSON.parse(JSON.stringify(o));
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cssMs = (el, name, fallback) => {
    const v = getComputedStyle(el).getPropertyValue(name).trim();
    if (!v) return fallback;
    return v.endsWith('ms') ? parseFloat(v) : parseFloat(v) * 1000;
  };
  // Server calls take 1 to 3 seconds in the build. The demo waits a short, fixed time.
  const LATENCY = { load: 900, switch: 650, action: 1100 };
  let seq = 0;
  const stamp = e => Object.assign(e, { id: e.id || 'ev' + (++seq) });

  /* ---------- Check logic (mirrors evaluateCoi) ---------- */

  function limitKeys(r) { return ['glOcc', 'agg', 'auto', 'umb', 'wc'].concat(r.pollution ? ['pol'] : []); }

  function evaluate(r) {
    if (!r.values) return [];
    const v = r.values, out = [];
    limitKeys(r).forEach(k => {
      const label = SAMPLE.rules[k][0], min = SAMPLE.rules[k][1], f = v[k];
      const req = min != null ? usd(min) : 'Any amount';
      let found, pass = true, def = '';
      if (f == null) { found = 'Not shown'; pass = false; def = label + ': not shown on the certificate'; }
      else if (min != null && f < min) { found = usd(f); pass = false; def = label + ': ' + usd(f) + ' shown, ' + usd(min) + ' required'; }
      else found = usd(f);
      out.push({ k, kind: 'limit', label, found, req, pass, defText: def, raw: f == null ? '' : usd(f), money: true });
    });
    SAMPLE.checks.forEach(([k, label]) => {
      const ok = v[k] !== false;
      out.push({ k, kind: 'check', label, found: ok ? 'Printed' : 'Not printed', req: 'Printed', pass: ok, defText: ok ? '' : label + ': missing or wrong', raw: ok ? 'Printed' : 'Not printed' });
    });
    const nameOk = (v.insuredName || '').trim() === r.name;
    out.push({ k: 'insured', kind: 'name', label: 'Insured name', found: nameOk ? 'Matches' : 'Does not match', req: 'Matches', pass: nameOk,
      defText: nameOk ? '' : 'Insured name: missing or wrong', sub: 'On the certificate: ' + v.insuredName + ' · On the record: ' + r.name, raw: v.insuredName });
    const d = v.cancel, short = d == null || d < 30;
    out.push({ k: 'cancel', kind: 'cancel', label: 'Cancellation notice', found: d == null ? 'Not shown' : d + ' days', req: '30 days', pass: !short,
      defText: short ? 'Cancellation notice: ' + (d == null ? 'none' : d) + ' days shown, 30 required' : '', raw: d == null ? '' : String(d) });
    out.forEach(l => { l.waivedText = (r.waived && r.waived[l.k]) || ''; l.waived = !!l.waivedText; });
    return out;
  }
  const failNames = r => evaluate(r).filter(l => !l.pass && !l.waived).map(l => l.label.toLowerCase()).join(', ');

  /* ---------- State ---------- */

  const S = {
    opts: null, root: null,
    recKey: 'ridgeline', role: 'project_manager', rec: null,
    editing: null, edits: {}, note: '', noteRefused: false,
    busy: null, loading: true, sheet: false, focusLine: -1
  };

  function freshRecord(key) {
    const r = clone(SAMPLE.records[key]);
    r.waived = {};
    r.timeline.forEach(stamp);
    return r;
  }
  const actor = () => SAMPLE.people[S.role] + ' (' + SAMPLE.roles[S.role] + ')';
  const isEditing = () => S.editing !== null ? S.editing : S.rec.next === 'correct';

  /* ---------- View model (same rules as Round 2) ---------- */

  function panelModel() {
    const r = S.rec, roleLabel = SAMPLE.roles[S.role];
    const isAcc = S.role === 'accountant', isDecider = !isAcc;
    const lines = evaluate(r);
    const refuse = (t, s, btns, stepTitle) => ({ kind: 'refused', title: stepTitle, refTitle: t, refSub: s, refBtns: btns });
    if (isEditing() && lines.length) {
      return isAcc ? { kind: 'correct', title: 'Check each value against the PDF' }
        : refuse('Only the accountant can correct a reading.', 'You are viewing as ' + roleLabel + '. Dana Reyes (Accountant) checks the values.', ['Save and check again'], 'Check each value against the PDF');
    }
    if (r.next === 'approve') {
      return isAcc ? { kind: 'approve', title: 'Approve this certificate' }
        : refuse('Only the accountant can approve a certificate.', 'You are viewing as ' + roleLabel + '. Dana Reyes (Accountant) approves it.', ['Approve', 'Correct a value'], 'Approve this certificate');
    }
    if (r.next === 'decide') {
      return isDecider ? { kind: 'decide', title: 'Decide on the deficiencies' }
        : refuse('Only the project manager or leadership can waive a deficiency.', 'You are viewing as Accountant. Marcus Webb (Project manager) was asked to decide.', ['Waive', 'Reject'], 'Decide on the deficiencies');
    }
    return { kind: 'none', title: 'Nothing needs you' };
  }

  /* ---------- Render: pieces ---------- */

  const kbd = k => S.opts.kbdHints ? '<kbd aria-hidden="true">' + k + '</kbd>' : '';
  const pill = status => {
    const s = STATUS[status] || ['neutral', ICON.minusCircle];
    return '<span class="pill" data-tone="' + s[0] + '" data-status="' + esc(status) + '">' + s[1] + '<span>' + esc(status) + '</span></span>';
  };
  const sampleBadge = (extra) => '<span class="sample' + (extra ? ' ' + extra : '') + '">Sample data</span>';
  const trust = (source, updated) => '<p class="trust"><span>Source: ' + esc(source) + '</span>' + (updated ? '<span>Updated ' + esc(updated) + '</span>' : '') + sampleBadge() + '</p>';

  function renderChrome() {
    const roles = Object.keys(SAMPLE.roles).map(k =>
      '<button type="button" class="seg-btn" data-role="' + k + '" aria-pressed="' + (S.role === k) + '">' + SAMPLE.roles[k] + '</button>').join('');
    const icons = { projects: ICON.grid, dashboard: ICON.gauge, worklist: ICON.list, hold: ICON.pause, roi: ICON.coin };
    const nav = SAMPLE.nav.map(([k, label]) =>
      '<li><a href="#" class="nav-item" data-nav="' + k + '"' + (k === 'worklist' ? ' aria-current="page"' : '') + '>' + icons[k] + '<span>' + label + '</span></a></li>').join('');
    const recs = SAMPLE.recordOrder.map(([k, label]) => '<option value="' + k + '"' + (S.recKey === k ? ' selected' : '') + '>' + esc(label) + '</option>').join('');
    return '' +
      '<div class="brand"><span class="brand-mark" aria-hidden="true"></span><span class="brand-text"><strong>Certificate compliance</strong><span>' + SAMPLE.firm + '</span></span></div>' +
      '<nav class="nav" aria-label="Main"><ul>' + nav + '</ul></nav>' +
      '<div class="chrome-util">' +
        '<span class="sample sample-chrome">Sample data · all names fictional</span>' +
        '<div class="demo" role="group" aria-label="Demo only controls">' +
          '<span class="demo-tag">Demo only</span>' +
          '<div class="demo-row"><span class="demo-label" id="demo-role-l">View as</span><div class="seg" role="group" aria-labelledby="demo-role-l">' + roles + '</div></div>' +
          '<label class="demo-row"><span class="demo-label">Record</span><select id="demo-record" class="demo-select">' + recs + '</select></label>' +
          '<button type="button" class="demo-reset" data-act="reset">Reset demo</button>' +
        '</div>' +
      '</div>';
  }

  function renderHead() {
    const r = S.rec;
    const facts = r.facts.map(f => '<div class="fact"><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>').join('');
    const hold = r.hold.length ? '<span class="hold-flag">' + ICON.flag + '<span>On payment hold</span></span><span class="hold-reasons">Reasons: ' + esc(r.hold.join('; ')) + '</span>' : '';
    return '' +
      '<div class="rec-id">' +
        '<p class="eyebrow">Compliance record <span class="dot" aria-hidden="true">·</span> ' + esc(r.scope) + ' <span class="dot" aria-hidden="true">·</span> ' + esc(r.project) + ' <span class="rid">' + r.id + '</span></p>' +
        '<div class="rec-title-row"><h1 class="rec-title">' + esc(r.name) + '</h1>' + sampleBadge('sample-head') + '</div>' +
        '<div class="rec-state">' + pill(r.status) + (r.waiting ? '<span class="waiting">' + esc(r.waiting) + '</span>' : '') + hold + '</div>' +
      '</div>' +
      '<dl class="facts">' + facts + '</dl>' +
      trust('Compliance records', r.updated);
  }

  function pdfPages() {
    const r = S.rec, v = r.values || {}, t = r.pdfTrue || {};
    const rows = limitKeys(r).map(k => '<div class="cert-row" data-k="' + k + '"><span>' + SAMPLE.rules[k][0] + '</span><span class="cert-num">' + (t[k] != null ? usd(t[k]) : (v[k] == null ? '' : usd(v[k]))) + '</span></div>').join('');
    const field = (k, label, value, mono) => '<div class="cert-field" data-k="' + k + '"><span class="cert-cap">' + label + '</span><span class="cert-val' + (mono ? ' cert-num' : '') + '">' + esc(value) + '</span></div>';
    const bars = n => Array.from({ length: n }, (_, i) => '<i class="cert-bar" style="width:' + [92, 78, 86, 64, 81][i % 5] + '%"></i>').join('');
    return '' +
      '<figure class="cert-page" role="img" aria-label="Page 1 of 2 of the certificate PDF">' +
        '<div class="cert-top"><div><strong>Certificate of insurance</strong><span>Generic certificate-style layout</span></div><span class="cert-stamp">SAMPLE: fictional certificate</span></div>' +
        '<div class="cert-grid">' +
          field('insured', 'Insured', v.insuredName || r.name) + field('issuer', 'Issued by', 'Fairhaven Insurance Agency') +
          field('holder', 'Certificate holder', 'Harborline Builders') + field('period', 'Policy period', r.period, true) +
          field('addr', 'Project', r.project + ', ' + r.address) +
        '</div>' +
        '<div class="cert-table"><div class="cert-row cert-th"><span>Coverage</span><span>Limit</span></div>' + rows + '</div>' +
        '<div class="cert-bars">' + bars(3) + '</div>' +
        '<span class="cert-water" aria-hidden="true">SAMPLE</span>' +
      '</figure>' +
      '<figure class="cert-page" role="img" aria-label="Page 2 of 2 of the certificate PDF">' +
        '<div class="cert-top"><div><strong>Page 2 · Endorsements and notes</strong></div><span class="cert-stamp">SAMPLE: fictional certificate</span></div>' +
        field('ai', 'Additional insured', v.ai === false ? 'No additional insured endorsement is attached.' : 'Harborline Builders is named as additional insured by endorsement.') +
        field('cancel', 'Cancellation', (v.cancel || 30) + ' days written notice of cancellation to the certificate holder.') +
        '<div class="cert-field"><span class="cert-cap">Description of operations</span><div class="cert-bars">' + bars(4) + '</div></div>' +
        '<span class="cert-water" aria-hidden="true">SAMPLE</span>' +
      '</figure>';
  }

  function renderPdf() {
    const r = S.rec;
    return '' +
      '<div class="pane-head pdf-head">' +
        '<div class="pane-title-wrap"><h2 class="pane-title">Certificate PDF</h2><p class="pane-sub">' + esc(r.uploadedLine) + '</p></div>' +
        '<a href="#" class="link link-out" data-act="noop">' + ICON.out + '<span>Open the original file (owner only)</span></a>' +
      '</div>' +
      '<div class="pdf-scroll" tabindex="0" aria-label="Certificate pages">' + pdfPages() + '</div>';
  }

  function btn(cls, act, label, key, extra) {
    const busy = S.busy === act;
    return '<button type="button" class="btn ' + cls + (busy ? ' is-busy' : '') + '" data-act="' + act + '"' +
      (S.busy ? ' disabled' : '') + (busy ? ' aria-busy="true"' : '') + (extra || '') + '>' +
      '<span class="btn-label">' + (busy ? esc(busyLabel[act] || label) : esc(label)) + '</span>' + (busy ? '' : (key ? kbd(key) : '')) +
      '<span class="btn-progress" aria-hidden="true"></span></button>';
  }
  const busyLabel = { approve: 'Approving…', save: 'Checking again…', waive: 'Waiving…', reject: 'Sending…', w9: 'Saving…' };

  function renderPanel() {
    const r = S.rec, m = panelModel(), lines = evaluate(r);
    const fails = lines.filter(l => !l.pass && !l.waived);
    let body = '';
    if (m.kind === 'approve') {
      body = '<p>Every line passes. Nothing goes to the subcontractor until you approve.</p>' +
        '<div class="actions">' + btn('btn-primary', 'approve', 'Approve', 'A') + btn('btn-secondary', 'edit', 'Correct a value', 'E') + '</div>' +
        '<p class="fine">Approving emails ' + esc(r.name) + ' and records your name: ' + esc(actor()) + '.</p>';
    } else if (m.kind === 'correct') {
      const low = r.conf != null && r.conf < 85;
      body = '<p>' + (low ? 'Reading confidence is below 85%, so a person checks every value. Compare each value with the PDF, change any that are wrong, then save. The check runs again.'
        : 'Change any value that does not match the PDF, then save. The check runs again before anything is approved.') + '</p>' +
        '<div class="actions">' + btn('btn-primary', 'save', 'Save and check again', S.opts.kbdHints ? 'Ctrl ↵' : '') +
        (r.next !== 'correct' ? btn('btn-secondary', 'cancel', 'Cancel', 'Esc') : '') + '</div>' +
        '<p class="fine">Each change is kept in the timeline as old value to new value, with your name: ' + esc(actor()) + '.</p>';
    } else if (m.kind === 'decide') {
      const defs = fails.map(l => '<li>' + ICON.cross + '<span><span class="def-text">' + esc(l.defText) + ' <span class="def-fail">· Fail</span></span>' + (l.sub ? '<span class="def-sub">' + esc(l.sub) + '</span>' : '') + '</span></li>').join('');
      const corr = 'Your certificate does not meet the project requirements. Please send a corrected certificate.\n' + fails.map(l => '- ' + l.defText).join('\n') + '\nUpload it here: [upload link]';
      body = '<p>The check found these deficiencies. Waive them with a note, or reject. Reject sends ' + esc(r.name) + ' a fixed correction request that lists each one.</p>' +
        '<ul class="defs">' + defs + '</ul>' +
        '<label class="field-label" for="waiver-note">Waiver note <span>(required to waive)</span></label>' +
        '<textarea id="waiver-note" class="field note" rows="3" placeholder="Why is this acceptable? For example: the owner agreed in writing."' + (S.noteRefused ? ' aria-invalid="true" aria-describedby="note-refused"' : '') + (S.busy ? ' disabled' : '') + '>' + esc(S.note) + '</textarea>' +
        (S.noteRefused ? '<div class="refusal m-enter" id="note-refused" role="status">' + ICON.lock + '<span><strong>A waiver needs a note. Write why this is acceptable, then waive.</strong><span>Nothing was changed. The note is saved in the timeline with your name.</span></span></div>' : '') +
        '<div class="actions">' + btn('btn-primary', 'waive', 'Waive', S.opts.kbdHints ? 'Ctrl ↵' : '') + btn('btn-secondary', 'reject', 'Reject') + '</div>' +
        '<details class="disclose"><summary>What Reject sends to ' + esc(r.name) + '</summary><pre class="email">' + esc(corr) + '</pre></details>' +
        '<p class="fine">Your decision is saved with your name: ' + esc(actor()) + '.</p>';
    } else if (m.kind === 'refused') {
      body = '<div class="actions">' + m.refBtns.map((b, i) => '<button type="button" class="btn ' + (i === 0 ? 'btn-primary' : 'btn-secondary') + '" disabled aria-describedby="refusal">' + esc(b) + '</button>').join('') + '</div>' +
        '<div class="refusal" id="refusal" role="status">' + ICON.lock + '<span><strong>' + esc(m.refTitle) + '</strong><span>' + esc(m.refSub) + '</span></span></div>';
    } else {
      body = '<p class="quiet">' + esc(r.noneText || 'Nothing needs you on this record.') + '</p>';
    }
    return '<div class="step-head"><p class="eyebrow">Your next step · ' + SAMPLE.roles[S.role] + '</p><h2 class="step-title">' + esc(m.title) + '</h2></div><div class="step-body" data-kind="' + m.kind + '">' + body + '</div>';
  }

  function renderValues() {
    const r = S.rec, lines = evaluate(r), m = panelModel();
    const editing = isEditing() && m.kind === 'correct';
    const fails = lines.filter(l => !l.pass && !l.waived);
    const above = r.conf >= 85;
    const conf = '<div class="conf" data-band="' + (above ? 'above' : 'below') + '">' +
      '<div class="conf-top"><span class="conf-label">Reading confidence</span><span class="conf-val">' + r.conf + '%</span></div>' +
      '<div class="conf-track" role="img" aria-label="Reading confidence ' + r.conf + '%. The line is at 85%."><span class="conf-fill" style="--w:' + r.conf + '%"></span><span class="conf-mark" style="--at:85%"><span>85%</span></span></div>' +
      '<p class="conf-text">' + (above ? esc(r.confText) : (r.confText ? esc(r.confText) : '<strong>Below 85%: a person checks every value.</strong>')) + '</p></div>';
    let summary;
    if (editing) summary = '<p class="summary" data-tone="neutral">' + ICON.pencil + '<span><strong>Checking:</strong> compare each value with the PDF. Point at a line to find it on the page.</span></p>';
    else if (fails.length) summary = '<p class="summary" data-tone="red">' + ICON.crossCircle + '<span><strong>Fails:</strong> ' + esc(fails.map(l => l.label.toLowerCase()).join(', ')) + '</span></p>';
    else if (lines.some(l => l.waived)) summary = '<p class="summary" data-tone="neutral">' + ICON.minusCircle + '<span><strong>Waived:</strong> every deficiency was waived with a note.</span></p>';
    else summary = '<p class="summary" data-tone="green">' + ICON.checkCircle + '<span><strong>Pass:</strong> every line meets the requirement.</span></p>';
    const hints = { limit: 'Leave empty if not shown', name: 'Name as printed on the certificate', cancel: 'Days' };
    const rows = lines.map((l, i) => {
      const state = editing ? 'edit' : (l.waived ? 'waived' : (l.pass ? 'pass' : 'fail'));
      let found;
      if (editing) {
        const val = S.edits[l.k] !== undefined ? S.edits[l.k] : l.raw;
        const changed = S.edits[l.k] !== undefined && S.edits[l.k] !== l.raw;
        const id = 'edit-' + l.k;
        const control = l.kind === 'check'
          ? '<select id="' + id + '" class="field cell-field" data-edit="' + l.k + '" aria-label="' + esc(l.label) + ', value on the certificate"><option' + (val === 'Printed' ? ' selected' : '') + '>Printed</option><option' + (val === 'Not printed' ? ' selected' : '') + '>Not printed</option></select>'
          : '<input id="' + id + '" class="field cell-field' + (l.money || l.kind === 'cancel' ? ' num' : '') + '" data-edit="' + l.k + '" value="' + esc(val) + '" aria-label="' + esc(l.label) + ', value on the certificate" autocomplete="off" spellcheck="false">';
        found = control + '<span class="edit-note" data-note="' + l.k + '">' + (changed ? 'Checks again on save' : esc(hints[l.kind] || 'Unchanged')) + '</span>';
      } else {
        found = '<span class="' + (l.money ? 'num' : '') + '">' + esc(l.found) + '</span>';
      }
      const res = state === 'edit' ? '<span class="res" data-tone="neutral">' + ICON.pencil + '<span>Checking</span></span>'
        : state === 'pass' ? '<span class="res" data-tone="green">' + ICON.check + '<span>Pass</span></span>'
        : state === 'fail' ? '<span class="res" data-tone="red">' + ICON.cross + '<span>Fail</span></span>'
        : '<span class="res" data-tone="neutral">' + ICON.minus + '<span>Waived</span></span>';
      const sub = (l.sub ? '<span class="line-sub">' + esc(l.sub) + '</span>' : '') + (l.waived ? '<span class="line-sub">' + esc(l.waivedText) + '</span>' : '');
      return '<div class="line" role="row" data-k="' + l.k + '" data-i="' + i + '" data-result="' + state + '"' + (editing ? '' : ' tabindex="-1"') + '>' +
        '<span class="c-label" role="rowheader"><span>' + esc(l.label) + '</span>' + sub + '</span>' +
        '<span class="c-found" role="cell" data-cap="Found">' + found + '</span>' +
        '<span class="c-req" role="cell" data-cap="Required"><span class="' + (l.money ? 'num' : '') + '">' + esc(l.req) + '</span></span>' +
        '<span class="c-res" role="cell">' + res + '</span></div>';
    }).join('');
    return '' +
      '<div class="pane-head"><div class="pane-title-wrap"><h2 class="pane-title">Values read against the requirements</h2><p class="pane-sub">Requirements for ' + esc(r.project) + '</p></div>' +
        (S.opts.kbdHints && !editing ? '<p class="pane-hint"><kbd>J</kbd><kbd>K</kbd> move through lines</p>' : '') + '</div>' +
      conf + summary +
      '<div class="lines' + (S.busy === 'save' ? ' is-checking' : '') + '" role="table" aria-label="Values against requirements">' +
        '<div class="line line-head" role="row"><span role="columnheader">Coverage</span><span role="columnheader">Found</span><span role="columnheader">Required</span><span role="columnheader">Result</span></div>' +
        rows + '</div>' +
      trust('Certificates, Projects', r.updated);
  }

  function renderW9() {
    const r = S.rec, isAcc = S.role === 'accountant';
    const text = r.w9 ? 'On file.' : 'Not on file. Whether this holds payment is decided at the next pay-cycle check.';
    return '<div class="w9-row"><div class="w9-text"><h2 class="pane-title">W-9</h2><p>' + (r.w9 ? ICON.check : ICON.alert) + '<span>' + text + '</span></p></div>' +
      (isAcc ? btn('btn-quiet', 'w9', r.w9 ? 'Mark W-9 missing' : 'Mark W-9 on file') : '<p class="w9-refused">' + ICON.lock + '<span>Only the accountant can mark a W-9.</span></p>') + '</div>';
  }

  function renderTimeline() {
    const items = S.rec.timeline.map(t => {
      const mark = t.kind === 'decision' ? ICON.person : t.kind === 'correction' ? ICON.pencil : ICON.gear;
      return '<li class="tl-item" data-id="' + t.id + '" data-kind="' + t.kind + '">' +
        '<span class="tl-mark" aria-hidden="true">' + mark + '</span>' +
        '<div class="tl-body"><p class="tl-meta"><time>' + esc(t.when) + '</time><span class="tl-who">' + esc(t.who) + (t.role ? ' <span>(' + esc(t.role) + ')</span>' : '') + '</span></p>' +
        '<p class="tl-text">' + esc(t.text) + '</p>' +
        (t.from ? '<p class="tl-change"><span class="num old">' + esc(t.from) + '</span><span class="arrow" aria-label="changed to">→</span><span class="num new">' + esc(t.to) + '</span></p>' : '') +
        (t.note ? '<p class="tl-note">Note: “' + esc(t.note) + '”</p>' : '') +
        '</div></li>';
    }).join('');
    return '<div class="pane-head"><div class="pane-title-wrap"><h2 class="pane-title">Timeline</h2><p class="pane-sub">Newest first · Source: Activity log</p></div>' + sampleBadge() + '</div><ol class="tl">' + items + '</ol>';
  }

  function renderSkeleton() {
    const bar = (w, h, cls) => '<i class="skel' + (cls ? ' ' + cls : '') + '" style="width:' + w + ';height:' + h + 'px"></i>';
    return {
      head: '<div class="rec-id">' + bar('260px', 12) + bar('380px', 30) + bar('300px', 24, 'skel-pill') + '</div>',
      pdf: '<div class="pane-head pdf-head"><div class="pane-title-wrap">' + bar('140px', 14) + bar('260px', 10) + '</div></div><div class="pdf-scroll"><div class="cert-page cert-skel"></div></div>',
      step: bar('160px', 10) + bar('280px', 22) + bar('92%', 14) + bar('220px', 40, 'skel-btn'),
      values: bar('280px', 18) + Array.from({ length: 8 }, () => '<div class="line line-skel">' + bar('70%', 13) + bar('60%', 12) + bar('55%', 12) + bar('56px', 20) + '</div>').join(''),
      w9: bar('60px', 14) + bar('120px', 12),
      tl: bar('120px', 16) + Array.from({ length: 4 }, () => '<div class="tl-skel">' + bar('40%', 10) + bar('85%', 12) + '</div>').join('')
    };
  }

  /* ---------- Render: assemble + motion ---------- */

  const $ = sel => S.root.querySelector(sel);
  const $$ = sel => Array.from(S.root.querySelectorAll(sel));

  function snapshot() {
    const snap = { results: {}, status: null, tl: {}, kind: null, w9: null };
    $$('.values .line[data-k]').forEach(el => { snap.results[el.dataset.k] = el.dataset.result; });
    const p = $('.rec-state .pill'); snap.status = p && p.dataset.status;
    $$('.tl-item').forEach(el => { snap.tl[el.dataset.id] = el.getBoundingClientRect().top; });
    const sb = $('.step-body'); snap.kind = sb && sb.dataset.kind;
    snap.role = S.role;
    return snap;
  }

  function render(opts) {
    opts = opts || {};
    const before = opts.animate ? snapshot() : null;
    const focusId = document.activeElement && S.root.contains(document.activeElement) ? (document.activeElement.id || (document.activeElement.dataset && document.activeElement.dataset.act && 'act:' + document.activeElement.dataset.act)) : null;

    $('.chrome').innerHTML = renderChrome();
    const body = $('.page');
    body.setAttribute('aria-busy', S.loading ? 'true' : 'false');
    if (S.loading) {
      const sk = renderSkeleton();
      $('.rec-head').innerHTML = sk.head;
      $('.pane.pdf').innerHTML = sk.pdf;
      $('.pane.step').innerHTML = sk.step;
      $('.pane.values').innerHTML = sk.values;
      $('.pane.w9').innerHTML = sk.w9;
      $('.pane.timeline').innerHTML = sk.tl;
      body.classList.add('is-loading');
      return;
    }
    const wasLoading = body.classList.contains('is-loading');
    body.classList.remove('is-loading');
    $('.back-label').textContent = 'Worklist: ' + S.rec.project;
    $('.rec-head').innerHTML = renderHead();
    if (!opts.keepPdf) $('.pane.pdf').innerHTML = renderPdf();
    $('.pane.step').innerHTML = renderPanel();
    $('.pane.values').innerHTML = renderValues();
    $('.pane.w9').innerHTML = renderW9();
    $('.pane.timeline').innerHTML = renderTimeline();

    if (wasLoading) {
      // Skeletons resolve into content; the PDF page draws in.
      ['.rec-head', '.pane.step', '.pane.values', '.pane.w9', '.pane.timeline'].forEach((s, i) => play($(s), 'm-resolve', i * 30));
      $$('.cert-page').forEach((el, i) => play(el, 'm-draw', 60 + i * 80));
    }
    if (before) animateDiff(before);

    if (focusId) {
      const el = focusId.startsWith('act:') ? $('[data-act="' + focusId.slice(4) + '"]') : document.getElementById(focusId);
      if (el && !el.disabled) el.focus({ preventScroll: true });
      else if (opts.focusPanel) { const t = $('.step-title'); if (t) { t.setAttribute('tabindex', '-1'); t.focus({ preventScroll: true }); } }
    }
  }

  function play(el, cls, delay) {
    if (!el) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    if (delay && !reduced()) el.style.animationDelay = delay + 'ms'; else el.style.animationDelay = '';
    el.classList.add(cls);
    el.addEventListener('animationend', function done(e) { if (e.target !== el) return; el.classList.remove(cls); el.style.animationDelay = ''; el.removeEventListener('animationend', done); });
  }

  function animateDiff(before) {
    // Result cells that changed word (Fail -> Pass, Fail -> Waived).
    $$('.values .line[data-k]').forEach(el => {
      const prev = before.results[el.dataset.k];
      if (prev && prev !== el.dataset.result && prev !== 'edit' && el.dataset.result !== 'edit') play(el, 'm-changed');
      if (prev === 'edit' && el.dataset.result !== 'edit') play(el.querySelector('.c-res'), 'm-swap', 30 * (+el.dataset.i || 0));
    });
    const p = $('.rec-state .pill');
    if (p && before.status && before.status !== p.dataset.status) play(p, 'm-status');
    const sb = $('.step-body');
    if (sb && (before.kind !== sb.dataset.kind || before.role !== S.role)) play($('.pane.step'), 'm-panel');
    play($('.summary'), before.kind !== (sb && sb.dataset.kind) ? 'm-fade' : '');
    // Timeline: new rows enter, existing rows slide to their new place (FLIP, transform only).
    const dur = cssMs(S.root, '--dur-2', 200);
    $$('.tl-item').forEach(el => {
      const old = before.tl[el.dataset.id];
      if (old === undefined) { play(el, 'm-enter'); return; }
      const dy = old - el.getBoundingClientRect().top;
      if (dy && !reduced() && el.animate) el.animate([{ transform: 'translateY(' + dy + 'px)' }, { transform: 'none' }], { duration: dur, easing: getComputedStyle(S.root).getPropertyValue('--ease-out').trim() || 'ease-out' });
    });
  }

  /* ---------- Toasts ---------- */

  function toast(text) {
    const host = $('.toasts');
    const t = document.createElement('div');
    t.className = 'toast m-toast-in';
    t.setAttribute('role', 'status');
    t.innerHTML = ICON.check + '<span>' + esc(text) + '</span><button type="button" class="toast-x" aria-label="Dismiss">' + ICON.x + '</button>';
    host.appendChild(t);
    const close = () => { t.classList.add('m-toast-out'); setTimeout(() => t.remove(), reduced() ? 0 : cssMs(S.root, '--dur-2', 200)); };
    t.querySelector('.toast-x').addEventListener('click', close);
    setTimeout(close, 5200);
    while (host.children.length > 3) host.firstChild.remove();
  }

  /* ---------- Actions ---------- */

  function serverCall(act, fn, message) {
    S.busy = act;
    render({ keepPdf: true });
    setTimeout(() => {
      S.busy = null;
      fn(S.rec);
      render({ animate: true, keepPdf: act !== 'save', focusPanel: true });
      if (message) toast(message);
    }, LATENCY.action);
  }

  function addEvent(r, e) { r.timeline.unshift(stamp(e)); }

  const ACTIONS = {
    approve() {
      if (panelModel().kind !== 'approve' || S.busy) return;
      const a = actor();
      serverCall('approve', r => {
        r.status = 'Compliant'; r.waiting = ''; r.next = null;
        if (r.afterApproveFacts) r.facts = r.afterApproveFacts;
        r.noneText = 'Nothing needs you on this record.';
        // Round 2 wrote "Above the 85% line" here even for a 78% reading. Say which side of the line it is.
        r.confText = (r.conf >= 85 ? 'Above the 85% line. ' : 'Below the 85% line, so a person checked every value. ') + 'Approved by ' + a + ', Oct 8.';
        r.updated = SAMPLE.nowShort;
        addEvent(r, { when: SAMPLE.now, who: SAMPLE.people[S.role], role: SAMPLE.roles[S.role], text: 'Approved the certificate. ' + r.name + ' was emailed.', kind: 'decision' });
      }, 'Approved. The subcontractor has been emailed.');
    },
    edit() { if (panelModel().kind !== 'approve' || S.busy) return; S.editing = true; S.edits = {}; render({ animate: true, keepPdf: true }); focusFirstField(); },
    cancel() { if (S.busy) return; S.editing = false; S.edits = {}; render({ animate: true, keepPdf: true }); },
    save() {
      if (panelModel().kind !== 'correct' || S.busy) return;
      const edits = Object.assign({}, S.edits), a = actor(), who = SAMPLE.people[S.role], roleLabel = SAMPLE.roles[S.role];
      serverCall('save', r => {
        const changes = [];
        evaluate(r).forEach(l => {
          const v = edits[l.k];
          if (v === undefined || v === l.raw) return;
          let nv, shown;
          if (l.kind === 'limit') { nv = num(v); shown = nv == null ? 'Not shown' : usd(nv); }
          else if (l.kind === 'cancel') { nv = num(v); shown = nv == null ? 'Not shown' : nv + ' days'; }
          else if (l.kind === 'check') { nv = v === 'Printed'; shown = v; }
          else { nv = v.trim(); shown = nv; }
          r.values[l.k === 'insured' ? 'insuredName' : l.k] = nv;
          changes.push(stamp({ when: SAMPLE.now, who, role: roleLabel, text: 'Corrected ' + l.label.toLowerCase() + '.', from: l.raw || 'Not shown', to: shown, kind: 'correction' }));
        });
        const bad = evaluate(r).filter(l => !l.pass);
        r.waiting = bad.length ? 'Waiting for a decision on a deficiency' : 'Waiting for approval';
        r.next = bad.length ? 'decide' : 'approve';
        if (!r.currentStatus) r.status = 'In review';
        r.confText = 'Values confirmed by ' + a + ' against the PDF.';
        r.updated = 'Oct 8, 2026, 10:41 AM';
        r.timeline = [stamp({ when: SAMPLE.now, who: 'System', text: bad.length ? 'Checked again. Fails: ' + bad.map(l => l.label.toLowerCase()).join(', ') + '.' : 'Checked again. Every line passes. Waiting for approval.', kind: 'system' })]
          .concat(changes.reverse(), r.timeline);
        S.editing = false; S.edits = {};
      }, 'Correction saved and the check run again.');
    },
    waive() {
      if (panelModel().kind !== 'decide' || S.busy) return;
      const note = S.note.trim();
      if (!note) { S.noteRefused = true; render({ keepPdf: true }); const ta = $('#waiver-note'); if (ta) ta.focus(); return; }
      const a = actor(), who = SAMPLE.people[S.role], roleLabel = SAMPLE.roles[S.role];
      serverCall('waive', r => {
        const names = failNames(r);
        evaluate(r).forEach(l => { if (!l.pass) r.waived[l.k] = 'Waived by ' + a + ', Oct 8: "' + note + '"'; });
        r.status = 'Compliant'; r.waiting = ''; r.next = null; r.updated = SAMPLE.nowShort;
        r.noneText = 'Nothing needs you on this record. The waiver and its note are in the timeline.';
        addEvent(r, { when: SAMPLE.now, who, role: roleLabel, text: 'Waived the deficiencies: ' + names + '.', note, kind: 'decision' });
        S.note = ''; S.noteRefused = false;
      }, 'Waived. The subcontractor has been emailed that the certificate is approved.');
    },
    reject() {
      if (panelModel().kind !== 'decide' || S.busy) return;
      const who = SAMPLE.people[S.role], roleLabel = SAMPLE.roles[S.role];
      serverCall('reject', r => {
        addEvent(r, { when: SAMPLE.now, who, role: roleLabel, text: 'Rejected. Correction request sent, listing: ' + failNames(r) + '.', kind: 'decision' });
        r.waiting = ''; r.next = null; r.updated = SAMPLE.nowShort;
        r.status = 'Awaiting';
        r.noneText = 'Waiting for ' + r.name + ' to upload a corrected certificate.';
        S.noteRefused = false;
      }, 'Rejected. The correction request has been sent to the subcontractor.');
    },
    w9() {
      if (S.role !== 'accountant' || S.busy) return;
      const was = S.rec.w9, who = SAMPLE.people[S.role], roleLabel = SAMPLE.roles[S.role];
      serverCall('w9', r => {
        r.w9 = !r.w9; r.updated = SAMPLE.nowShort;
        addEvent(r, { when: SAMPLE.now, who, role: roleLabel, text: r.w9 ? 'Marked the W-9 on file.' : 'Marked the W-9 missing.', kind: 'decision' });
      }, was ? 'W-9 marked missing.' : 'W-9 marked on file.');
    },
    reset() { load(S.recKey, S.recKey === 'summit' ? 'accountant' : 'project_manager'); },
    noop() {}
  };

  function focusFirstField() { const f = $('.cell-field'); if (f) f.focus(); }

  function load(key, role) {
    S.recKey = key; S.rec = freshRecord(key); S.role = role || S.role;
    S.editing = null; S.edits = {}; S.note = ''; S.noteRefused = false; S.busy = null;
    S.loading = true; render();
    setTimeout(() => { S.loading = false; render(); }, S.firstLoad ? LATENCY.switch : LATENCY.load);
    S.firstLoad = true;
  }

  /* ---------- PDF cross-highlight ---------- */

  function link(k, scroll) {
    $$('.cert-page [data-k].is-linked').forEach(el => el.classList.remove('is-linked'));
    $$('.line.is-linked').forEach(el => el.classList.remove('is-linked'));
    if (!k) return;
    const line = $('.values .line[data-k="' + k + '"]');
    if (line) line.classList.add('is-linked');
    const target = $('.cert-page [data-k="' + k + '"]');
    if (!target) return;
    target.classList.add('is-linked');
    if (line) target.dataset.result = line.dataset.result;
    if (scroll) {
      const box = $('.pdf-scroll');
      const tr = target.getBoundingClientRect(), br = box.getBoundingClientRect();
      if (tr.top < br.top || tr.bottom > br.bottom) box.scrollTo({ top: box.scrollTop + (tr.top - br.top) - br.height / 3, behavior: reduced() ? 'auto' : 'smooth' });
    }
  }

  /* ---------- Events ---------- */

  function bind() {
    const root = S.root;
    root.addEventListener('click', e => {
      const roleBtn = e.target.closest('[data-role]');
      if (roleBtn) {
        if (S.busy || S.role === roleBtn.dataset.role) return;
        S.role = roleBtn.dataset.role; S.noteRefused = false;
        render({ animate: true, keepPdf: true });
        root.querySelector('[data-role="' + S.role + '"]').focus();
        return;
      }
      const nav = e.target.closest('[data-nav]');
      if (nav) { e.preventDefault(); if (nav.dataset.nav !== 'worklist') toast('This study shows the record detail only. Other screens come in step 3.'); return; }
      const actEl = e.target.closest('[data-act]');
      if (actEl && ACTIONS[actEl.dataset.act]) { e.preventDefault(); ACTIONS[actEl.dataset.act](); return; }
      if (e.target.closest('.back')) { e.preventDefault(); toast('This study shows the record detail only. The worklist comes in step 3.'); return; }
      if (e.target.closest('.sheet-close') || e.target.classList.contains('sheet')) { toggleSheet(false); }
    });
    root.addEventListener('change', e => {
      if (e.target.id === 'demo-record') { load(e.target.value, e.target.value === 'summit' ? 'accountant' : 'project_manager'); return; }
      if (e.target.dataset.edit) onEdit(e.target);
    });
    root.addEventListener('input', e => {
      if (e.target.dataset.edit) onEdit(e.target);
      if (e.target.id === 'waiver-note') {
        S.note = e.target.value;
        if (S.noteRefused && S.note.trim()) { S.noteRefused = false; const r = $('#note-refused'); if (r) r.remove(); e.target.removeAttribute('aria-invalid'); }
      }
    });
    root.addEventListener('pointerover', e => {
      const line = e.target.closest('.values .line[data-k]');
      const cert = e.target.closest('.cert-page [data-k]');
      if (line) link(line.dataset.k, false); else if (cert) link(cert.dataset.k, false);
    });
    root.addEventListener('pointerleave', () => link(null), true);
    root.addEventListener('focusin', e => {
      const line = e.target.closest('.values .line[data-k]');
      if (line) link(line.dataset.k, true);
    });
    document.addEventListener('keydown', onKey);
  }

  function onEdit(el) {
    const k = el.dataset.edit;
    const l = evaluate(S.rec).find(x => x.k === k);
    S.edits[k] = el.value;
    const note = $('[data-note="' + k + '"]');
    const changed = l && el.value !== l.raw;
    const hints = { limit: 'Leave empty if not shown', name: 'Name as printed on the certificate', cancel: 'Days', check: 'Unchanged' };
    if (note) { note.textContent = changed ? 'Checks again on save' : (hints[l.kind] || 'Unchanged'); note.classList.toggle('is-changed', !!changed); }
    el.closest('.line').classList.toggle('is-changed', !!changed);
  }

  function toggleSheet(open) {
    S.sheet = open === undefined ? !S.sheet : open;
    const sheet = $('.sheet');
    sheet.hidden = !S.sheet;
    if (S.sheet) { play(sheet.querySelector('.sheet-card'), 'm-pop'); sheet.querySelector('.sheet-close').focus(); }
  }

  function onKey(e) {
    if (S.loading) return;
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select';
    const kind = panelModel().kind;
    if (e.key === 'Escape') {
      if (S.sheet) { toggleSheet(false); return; }
      if (kind === 'correct') {
        if (S.rec.next !== 'correct') { ACTIONS.cancel(); }
        else if (Object.keys(S.edits).length) { S.edits = {}; render({ keepPdf: true }); toast('Unsaved changes cleared.'); }
        e.preventDefault();
      }
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      if (kind === 'correct') { e.preventDefault(); ACTIONS.save(); }
      else if (kind === 'decide') { e.preventDefault(); ACTIONS.waive(); }
      return;
    }
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === '?' || (e.shiftKey && k === '/')) { e.preventDefault(); toggleSheet(); return; }
    if (k === 'a' && kind === 'approve') { e.preventDefault(); ACTIONS.approve(); return; }
    if (k === 'e' && kind === 'approve') { e.preventDefault(); ACTIONS.edit(); return; }
    if ((k === 'j' || k === 'k') && !isEditing()) {
      e.preventDefault();
      const rows = $$('.values .line[data-k]');
      if (!rows.length) return;
      const cur = rows.indexOf(document.activeElement);
      const next = cur < 0 ? 0 : Math.max(0, Math.min(rows.length - 1, cur + (k === 'j' ? 1 : -1)));
      rows[next].focus();
    }
  }

  /* ---------- Mount ---------- */

  function shell() {
    return '' +
      '<header class="chrome"></header>' +
      '<main class="page" id="main">' +
        '<a href="#" class="back">' + ICON.back + '<span class="back-label">Worklist</span></a>' +
        '<section class="rec-head" aria-label="Record summary"></section>' +
        '<div class="rd-body">' +
          '<section class="pane pdf" aria-label="Certificate PDF"></section>' +
          '<section class="pane step" aria-label="Your next step"></section>' +
          '<section class="pane values" aria-label="Values read against the requirements"></section>' +
          '<section class="pane w9" aria-label="W-9"></section>' +
          '<section class="pane timeline" aria-label="Timeline"></section>' +
        '</div>' +
      '</main>' +
      '<div class="toasts" aria-live="polite"></div>' +
      '<div class="sheet" hidden><div class="sheet-card" role="dialog" aria-modal="true" aria-labelledby="sheet-t">' +
        '<div class="sheet-head"><h2 id="sheet-t">Keyboard</h2><button type="button" class="sheet-close" aria-label="Close">' + ICON.x + '</button></div>' +
        '<dl class="keys">' +
          '<div><dt><kbd>A</kbd></dt><dd>Approve, when approval is your next step</dd></div>' +
          '<div><dt><kbd>E</kbd></dt><dd>Correct a value</dd></div>' +
          '<div><dt><kbd>Ctrl</kbd><kbd>↵</kbd></dt><dd>Save and check again, or waive</dd></div>' +
          '<div><dt><kbd>Esc</kbd></dt><dd>Cancel an edit or clear unsaved changes</dd></div>' +
          '<div><dt><kbd>J</kbd><kbd>K</kbd></dt><dd>Move through value lines and find each on the PDF</dd></div>' +
          '<div><dt><kbd>?</kbd></dt><dd>Show or hide this list</dd></div>' +
        '</dl></div></div>';
  }

  window.RecordDetail = {
    SAMPLE,
    mount(options) {
      S.opts = Object.assign({ kbdHints: false }, options || {});
      S.root = document.querySelector(S.opts.root || '#app');
      S.root.innerHTML = shell();
      bind();
      load('ridgeline', 'project_manager');
    }
  };
})();
