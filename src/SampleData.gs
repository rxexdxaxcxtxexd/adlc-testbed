// Fictional sample data. Every name is fictional; the About page says so.

var SAMPLE_PROJECT = {
  project_id: 'PRJ-001', name: 'Maple Court Residences', review_mode: 'review_all',
  accountant_email: 'accountant@example.com', project_manager_email: 'pm@example.com',
  leadership_email: 'leadership@example.com', status: 'active',
  accountant_name: 'Dana Reyes', project_manager_name: 'Marcus Webb', leadership_name: 'Elena Park'
};

var SAMPLE_SUB = { sub_id: 'SUB-001', name: 'Ridgeline Roofing LLC', email: 'ridgeline@example.com', scope_of_work: 'roofing',
  contact_name: 'Jordan Ellis', phone: '555-0142', trade: 'Roofing' };

// The canned reading FakeReader returns in ticket 02, before real reading exists.
var SAMPLE_READING = {
  readable: true,
  confidence: 0.96,
  values: {
    insured_name: 'Ridgeline Roofing LLC',
    limits: {
      commercial_liability: 1000000, aggregate: 2000000, auto: 1000000, umbrella: 2000000,
      workers_comp: 1000000, pollution_liability: 1000000, professional_liability: null
    },
    additional_insured_endorsement: true, project_address: true, certificate_holder: true,
    cancellation_notice_days: 30, expiration_date: '2027-09-30'
  }
};

// An older sample project row has blank staff name cells. Fill only the blank ones.
function fillSampleNames(store) {
  var row = findRow(store.readRows('projects'), 'project_id', SAMPLE_PROJECT.project_id);
  if (!row) return;
  var patch = {};
  ['accountant_name', 'project_manager_name', 'leadership_name'].forEach(function (c) {
    if (!row[c]) patch[c] = SAMPLE_PROJECT[c];
  });
  if (Object.keys(patch).length) store.updateRow('projects', 'project_id', row.project_id, patch);
}

function seedSampleProject(deps) {
  var store = deps.store;
  var now = deps.clock.now();
  withScriptLock(function () {
    store.appendRow('projects', Object.assign({}, SAMPLE_PROJECT, { created_date: deps.clock.today() }));
    store.appendRow('subcontractors', SAMPLE_SUB);
    var recordId = nextId(store, 'compliance_records', 'record_id', 'REC-');
    store.appendRow('compliance_records', {
      record_id: recordId, project_id: SAMPLE_PROJECT.project_id, sub_id: SAMPLE_SUB.sub_id,
      subcontract_number: 'SC-1001', upload_token: deps.newToken(), status: 'awaiting',
      payment_hold: false, payment_hold_reasons: '[]', w9_on_file: true,
      reminder_30d_sent: false, reminder_7d_sent: false, closed: false, last_updated: now
    });
    store.appendRow('activity_log', { record_id: recordId, time: now, who: 'System', event_type: 'record_created', summary: 'Record created; awaiting certificate.' });
  });
  addProjectFolders(store, SAMPLE_PROJECT, [SAMPLE_SUB]);
}
