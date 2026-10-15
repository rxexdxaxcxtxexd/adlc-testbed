// The portfolio seed is fictional. It sends no email and creates no calendar events.
function demoPortfolioRows(today) {
  var projectNames = ['Maple Court Residences', 'Cedar Park Offices', 'Harbor View Commons', 'Willow Creek School'];
  var scopes = ['roofing', 'electrical', 'earthwork', 'cleaning', 'plumbing'];
  var trades = { roofing: 'Roofing', electrical: 'Electrical', earthwork: 'Earthwork', cleaning: 'Cleaning', plumbing: 'Plumbing' };
  // Fixed fictional lists, picked by index so every seed run is the same. The lead word turns every row
  // (28 lead words), so neighbouring rows never share one. 28 and the 5 trades share no factor, so each
  // lead word meets each trade once in 140 rows, and all 140 company names are unique.
  var leads = ['Alder Ridge', 'Copper Hollow', 'Juniper Bend', 'Northgate', 'Stonehaven', 'Westbrook', 'Larch Hill',
    'Ashford', 'Oakvale', 'Pinecrest', 'Fernwood', 'Granite Hollow', 'Millbrook', 'Harrow Lane', 'Quarry Bend',
    'Redfield', 'Thistle Creek', 'Wrenfield', 'Marlow Point', 'Lindenmere', 'Briarwood', 'Kestrel Ridge', 'Sable Creek',
    'Tamarack', 'Whitlow', 'Elmstead', 'Fallow Brook', 'Dunmore'];
  var tails = { roofing: ['Roofing', 'Roof Systems', 'Roofworks', 'Roofing & Sheet Metal'],
    electrical: ['Electric', 'Electrical Services', 'Electrical Contractors', 'Electrical Systems'],
    earthwork: ['Earthworks', 'Excavating', 'Site Grading', 'Earth Movers'],
    cleaning: ['Cleaning', 'Cleaning Services', 'Janitorial', 'Site Cleanup'],
    plumbing: ['Plumbing', 'Plumbing & Heating', 'Pipe Works', 'Mechanical'] };
  var forms = ['LLC', 'Inc.', 'Co.'];
  var firstNames = ['Marcus', 'Elena', 'Darnell', 'Priya', 'Tomas', 'Hannah', 'Walter', 'Imani', 'Gabriel', 'Nora',
    'Callum', 'Rosa', 'Dmitri', 'Leah', 'Anders', 'Yuki', 'Beatrice', 'Omar', 'Colleen', 'Felix'];
  var lastNames = ['Hartwell', 'Okafor', 'Lindqvist', 'Brennan', 'Castellano', 'Whitfield', 'Nakamura', 'Delacroix',
    'Abernathy', 'Kowalski', 'Montoya', 'Fairbanks', 'Ostrander', 'Valdez', 'Prescott', 'Haverford', 'Ng', 'Sandoval',
    'Thackeray', 'Ellison', 'Marchetti', 'Rudolph', 'Quigley', 'Bellamy', 'Jorgensen', 'Tilghman', 'Vasquez', 'Wexler'];
  var rows = [];
  projectNames.forEach(function (name, p) {
    for (var i = 1; i <= 35; i++) {
      var n = p * 35 + i;
      var id = String(n).padStart(3, '0');
      var baseScope = scopes[(i - 1) % scopes.length];
      var subName = leads[(n - 1) % leads.length] + ' ' + tails[baseScope][Math.floor((n - 1) / leads.length) % 4] + ' ' + forms[(n - 1) % 3];
      if (n === 1) subName = 'Ridgeline Roofing LLC';
      if (n === 3) subName = 'Cedar Masonry LLC';
      if (n === 14) subName = 'Brightway Electric Inc.';
      var scope = n === 14 ? 'electrical' : baseScope;
      // 20 first names and 28 last names only repeat as a pair every 140 records, so each contact is unique.
      var contact = firstNames[(n - 1) % firstNames.length] + ' ' + lastNames[(n - 1) % lastNames.length];
      // Phones are 555-0100 to 555-0199 only. There are 140 subcontractors, so numbers repeat by index:
      // (n - 1) % 100 gives records 1 and 101 the same phone, 555-0100.
      var phone = '555-01' + String((n - 1) % 100).padStart(2, '0');
      var values = JSON.parse(JSON.stringify(SAMPLE_READING.values));
      values.insured_name = subName;
      values.expiration_date = addDays(today, 180 + i * 3);
      if (scope !== 'roofing' && scope !== 'earthwork') values.limits.pollution_liability = null;
      if (scope === 'cleaning') values.limits.umbrella = null;
      var kind = 'compliant';
      if (p === 0 && i === 1) kind = 'deficiency';
      if (p === 0 && i === 2) kind = 'awaiting';
      if (p === 0 && i === 3) kind = 'expired';
      if (p === 0 && i === 14) kind = 'misread';
      if (p === 1 && i === 1) kind = 'expiring';
      if (p === 1 && i === 2) kind = 'low_confidence';
      if (p === 1 && i === 3) kind = 'unreadable';
      if (p === 2 && i === 1) kind = 'missing_w9';
      if (kind === 'expired') values.expiration_date = addDays(today, -8);
      if (kind === 'expiring') values.expiration_date = addDays(today, 18);
      if (kind === 'deficiency') {
        values.insured_name = 'Ridgeline Roofing Partners LLC';
        values.limits.umbrella = 1000000;
      }
      rows.push({ record_id: 'REC-' + id, sub_id: 'SUB-' + id, project_id: 'PRJ-00' + (p + 1),
        project: name, name: subName, scope: scope, trade: trades[scope], contact: contact, phone: phone, kind: kind, values: values,
        amount: kind === 'expired' ? 6250 : kind === 'missing_w9' ? 2800 : 0 });
    }
  });
  return rows;
}

// One page in an original sample layout. All content is ASCII, so string lengths are byte lengths.
function demoCertificatePdf(values, subName, projectName) {
  var lines = ['SAMPLE: fictional certificate', 'Certificate of insurance', 'Original demonstration form',
    'Insured: ' + values.insured_name, 'Subcontractor: ' + subName, 'Project: ' + projectName, ''];
  COI_LIMITS.forEach(function (field) { lines.push(COI_LABEL[field] + ': ' + (values.limits[field] == null ? 'Not shown' : formatUsd(values.limits[field]))); });
  lines.push('Additional insured endorsement: ' + (values.additional_insured_endorsement ? 'Printed' : 'Not printed'));
  lines.push('Project address: ' + (values.project_address ? 'Printed' : 'Not printed'));
  lines.push('Certificate holder: ' + (values.certificate_holder ? 'Harborline Builders' : 'Not printed'));
  lines.push('Cancellation notice: ' + values.cancellation_notice_days + ' days');
  lines.push('Expires: ' + values.expiration_date);
  var stream = lines.map(function (line, i) {
    var text = line.replace(/[\\()]/g, '\\$&');
    return 'BT /F1 ' + (i < 2 ? 15 : 10) + ' Tf 42 ' + (750 - i * 28) + ' Td (' + text + ') Tj ET';
  }).join('\n');
  var objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [4 0 R] /Count 1 >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>',
    '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream'];
  var pdf = '%PDF-1.4\n', offsets = [];
  objects.forEach(function (obj, i) { offsets.push(pdf.length); pdf += (i + 1) + ' 0 obj\n' + obj + '\nendobj\n'; });
  var xref = pdf.length;
  pdf += 'xref\n0 6\n0000000000 65535 f \n';
  offsets.forEach(function (o) { pdf += String(o).padStart(10, '0') + ' 00000 n \n'; });
  return pdf + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
}

// Fill only an empty data store. IDs and the current date determine the sample.
function seedDemoPortfolio(deps) {
  var target = deps.store;
  if (target.readRows('compliance_records').length || target.readRows('projects').length) {
    return { ok: false, message: 'The data store is not empty. Existing records were kept.' };
  }
  var store = FakeStore();
  Object.keys(SCHEMA).forEach(function (tab) { store.ensureTab(tab, SCHEMA[tab]); });
  var today = deps.clock.today(), now = deps.clock.now();
  var samples = demoPortfolioRows(today);
  var names = [];
  samples.forEach(function (s) { if (names.indexOf(s.project) < 0) names.push(s.project); });
  withScriptLock(function () {
    names.forEach(function (name, i) {
      var project = Object.assign({}, SAMPLE_PROJECT, { project_id: 'PRJ-00' + (i + 1), name: name, created_date: today });
      store.appendRow('projects', project);
    });
    samples.forEach(function (s) {
      var sub = { sub_id: s.sub_id, name: s.name, scope_of_work: s.scope, email: s.sub_id.toLowerCase() + '@example.com',
        contact_name: s.contact, phone: s.phone, trade: s.trade };
      store.appendRow('subcontractors', sub);
      var project = findRow(store.readRows('projects'), 'project_id', s.project_id);

      store.appendRow('compliance_records', { record_id: s.record_id, project_id: s.project_id, sub_id: s.sub_id,
        subcontract_number: 'SC-' + s.record_id.slice(4), upload_token: deps.newToken(), status: 'awaiting',
        payment_hold: false, payment_hold_reasons: '[]', w9_on_file: s.kind !== 'missing_w9',
        reminder_30d_sent: false, reminder_7d_sent: false, closed: false, last_updated: now });
      var record = newRecord({ name: s.name, email: sub.email, scope: s.scope, w9: s.kind !== 'missing_w9' }, s.amount);
      var pdf = '';
      function receive(values, confidence, mode, suffix) {
        var certId = 'CERT-' + s.record_id.slice(4) + (suffix || '');
        var event = { type: 'certificate_received', file: { id: certId, fingerprint: 'sample-' + certId, readable: s.kind !== 'unreadable',
          confidence: confidence, values: s.kind === 'unreadable' ? null : values } };
        record = nextStatus(record, event, today, mode, TOLERANCE_MATRIX).record;
        if (['deficiency', 'expired', 'expiring', 'low_confidence', 'misread', 'missing_w9'].indexOf(s.kind) >= 0) {
          var content = demoCertificatePdf(s.values, s.name, s.project);
          pdf = target.writeBlob(subFolderPath(project, sub) + '/certificates', certId + '.pdf', deps.encodePdf(content), 'application/pdf');
        }
        // The seed sends no email. The approval email of an accepted sample certificate was never sent, so the seed
        // does not log it as a notice (the notification log reports what the code does).
        record.log.forEach(function (entry) {
          if (entry.notice === 'notice_certificate_approved' || entry.notice === 'notice_renewal_accepted') delete entry.notice;
        });
        saveRecord(store, s.record_id, record, now, pdf, 'certificate_received');
        record.log = [];
      }
      if (s.kind !== 'awaiting') {
        if (s.kind === 'misread') {
          receive(s.values, 0.96, 'review_deficiencies', '-CURRENT');
          var wrong = JSON.parse(JSON.stringify(s.values)); wrong.limits.commercial_liability = 2000000;
          receive(wrong, 0.96, 'review_all', '');
        } else receive(s.values, s.kind === 'low_confidence' ? 0.72 : 0.93,
          ['deficiency', 'low_confidence', 'unreadable'].indexOf(s.kind) >= 0 ? 'review_all' : 'review_deficiencies', '');
      }
      if (s.amount) {
        store.appendRow('pay_applications', { project_id: s.project_id, sub_id: s.sub_id, pay_cycle: addDays(today, 7), amount_billed_usd: s.amount });
        record = nextStatus(record, { type: 'pay_check' }, today, 'review_all', TOLERANCE_MATRIX).record;
        saveRecord(store, s.record_id, record, now, '', 'pay_check');
      }
      if (s.kind === 'awaiting') store.appendRow('activity_log', { record_id: s.record_id, time: now, who: 'System', event_type: 'record_created', summary: 'Record created; awaiting certificate.' });
    });
    // Sample ai_calls rows, so Data trust shows the AI cost in Share Proj.
    // Shaped from the cost model in docs/research/c4-gemini-api-cost.md. Replace with measured rows after the first
    // Demo Proj calibration run.
    demoAiCallRows(store.readRows('certificates'), today, now).forEach(function (row) {
      store.appendRow('ai_calls', Object.assign({ call_id: deps.newToken() }, row));
    });
    Object.keys(SCHEMA).forEach(function (tab) {
      var rows = store.readRows(tab);
      if (target.appendRows) target.appendRows(tab, rows);
      else rows.forEach(function (row) { target.appendRow(tab, row); });
    });
  });
  return { ok: true, message: 'Created four fictional projects and 140 compliance records. No emails were sent.', projects: 4, records: samples.length };
}

// About 40 read calls this month, one per seeded certificate, near 1,700 tokens in and 300 out with a small fixed
// spread, so every seed run is the same. Cost comes from meterCall. Rows carry no call_id; the caller adds it.
// A call lands on a day from the 1st to yesterday, or at now on the 1st of the month.
function demoAiCallRows(certificates, today, now) {
  var dayOfMonth = Number(String(today).slice(8, 10));
  var monthStart = String(today).slice(0, 8) + '01';
  return certificates.slice(0, 40).map(function (cert, i) {
    var usage = { promptTokenCount: 1700 + (i * 37) % 121 - 60, candidatesTokenCount: 300 + (i * 13) % 41 - 20 };
    var call = meterCall(GEMINI_MODEL, usage, 'read');
    var hour = 8 + i % 9, minute = (i * 7) % 60;
    var time = dayOfMonth > 1 ? addDays(monthStart, i % (dayOfMonth - 1)) + 'T' + (hour < 10 ? '0' : '') + hour + ':' +
      (minute < 10 ? '0' : '') + minute + ':00' : now;
    var unreadable = cert.queue_reason === 'Unreadable file';
    return {
      time: time, purpose: call.purpose, model: call.model, record_id: cert.record_id, certificate_id: cert.certificate_id,
      input_tokens: call.input_tokens, output_tokens: call.output_tokens, thinking_tokens: call.thinking_tokens,
      cost_usd: call.cost_usd, outcome: unreadable ? 'unreadable' : 'ok', outcome_reason: unreadable ? 'The model could not read the certificate.' : ''
    };
  });
}

// Owner runs this once from the editor. Keep the previous Sheet as an archive.
function setupPortfolioDemo() {
  if (isDemoMode()) return demoRefusal('setupPortfolioDemo');
  return setupPortfolioDemo_();
}

function setupPortfolioDemo_() {
  var props = PropertiesService.getScriptProperties();
  var previous = props.getProperty(PROP_SHEET_ID);
  var ss = SpreadsheetApp.create('Harborline portfolio (Sample data)');
  ss.setSpreadsheetTimeZone(Session.getScriptTimeZone());
  var store = SheetStore(ss.getId());
  withScriptLock(function () { initProject(store); });
  var deps = { store: store, clock: ScriptClock(), newToken: Utilities.getUuid,
    encodePdf: function (text) { return Utilities.base64Encode(text); } };
  var result = seedDemoPortfolio(deps);
  if (result.ok) withScriptLock(function () {
    if (previous) props.setProperty('PREVIOUS_DEMO_SHEET_ID', previous);
    props.setProperty(PROP_SHEET_ID, ss.getId());
  });
  console.log(result.message);
  return result;
}

// Attach the seeded certificate PDF when first opened. Pending readings already have PDFs.
function ensureSamplePdfLink(deps, recordId) {
  var existing = recordPdfLink(deps, recordId);
  if (existing) return existing;
  return withScriptLock(function () {
    var sample = samplePdf(deps.store, recordId);
    if (!sample) return '';
    var certificate = findRow(deps.store.readRows('certificates'), 'certificate_id', sample.certificateId);
    if (certificate.pdf_link) return certificate.pdf_link;
    var link = deps.store.writeBlob(sample.folder, sample.certificateId + '.pdf', Utilities.base64Encode(sample.text), 'application/pdf');
    deps.store.updateRow('certificates', 'certificate_id', sample.certificateId, {pdf_link:link});
    return link;
  });
}

// The seeded certificate PDF a record shows, built in memory: { certificateId, folder, text }.
// Null when the shown certificate is not a seeded sample.
function samplePdf(store, recordId) {
  var row = findRow(store.readRows('compliance_records'), 'record_id', recordId);
  if (!row) throw new Error('No such record.');
  var record = loadRecord(store, row), cert = shownCertificate(record);
  if (!cert || !cert.values || !/^sample-/.test(cert.fingerprint)) return null;
  var project = findRow(store.readRows('projects'), 'project_id', row.project_id);
  var sub = findRow(store.readRows('subcontractors'), 'sub_id', row.sub_id);
  return { certificateId: cert.id, folder: subFolderPath(project, sub) + '/certificates',
    text: demoCertificatePdf(cert.values, record.sub.name, project.name) };
}

// Demo mode: the PDF as base64 with nothing saved. A saved PDF is read from Drive; a seeded certificate with
// no saved PDF is built in memory. Reads the real rows only, never the browser's overlay, so a visitor
// cannot point the call at another Drive file.
function demoPdfData(deps, recordId, readDrive) {
  var link = recordPdfLink(deps, recordId);
  if (link) return readDrive(link);
  var sample = samplePdf(deps.store, recordId);
  return sample ? deps.encodePdf(sample.text) : '';
}
