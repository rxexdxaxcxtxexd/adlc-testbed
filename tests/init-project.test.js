// initProject: the exact Sheet tabs, columns and Drive folders (frozen after milestone 1).
// The names below are literals on purpose: a rename in code must fail this test.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGsRaw, plain } = require('./load-gs');

const { initProject, addProjectFolders, FakeStore } = loadGsRaw(['initProject', 'addProjectFolders', 'FakeStore']);

function runInitProject(times = 1) {
  const store = FakeStore();
  for (let i = 0; i < times; i++) initProject(store);
  return plain(store.snapshot());
}

function runAddProject(project, subs) {
  const store = FakeStore();
  initProject(store);
  addProjectFolders(store, project, subs);
  return plain(store.snapshot());
}

const TABS = {
  projects: ['project_id', 'name', 'review_mode', 'accountant_email', 'project_manager_email', 'leadership_email', 'status', 'created_date',
    'accountant_name', 'project_manager_name', 'leadership_name'],
  subcontractors: ['sub_id', 'name', 'email', 'scope_of_work', 'contact_name', 'phone', 'trade'],
  compliance_records: [
    'record_id', 'project_id', 'sub_id', 'subcontract_number', 'upload_token', 'status',
    'current_certificate_id', 'queued_certificate_id', 'payment_hold', 'payment_hold_reasons', 'w9_on_file',
    'reminder_30d_sent', 'reminder_7d_sent', 'closed', 'last_updated',
  ],
  certificates: [
    'certificate_id', 'record_id', 'received_date', 'file_fingerprint', 'queue_stage', 'queue_reason', 'confidence',
    'insured_name', 'commercial_liability_usd', 'aggregate_usd', 'auto_usd', 'umbrella_usd', 'workers_comp_usd',
    'pollution_liability_usd', 'professional_liability_usd', 'additional_insured_endorsement', 'project_address',
    'certificate_holder', 'cancellation_notice_days', 'expiration_date', 'check_result', 'deficiencies', 'decision',
    'replaces_certificate_id', 'outcome', 'pdf_link', 'reading_link', 'decision_note', 'calendar_event_id',
  ],
  pay_applications: ['project_id', 'sub_id', 'pay_cycle', 'amount_billed_usd'],
  activity_log: ['record_id', 'time', 'who', 'event_type', 'summary', 'drive_link'],
  uploads: ['upload_id', 'upload_token', 'received_time', 'file_name', 'file_fingerprint', 'drive_link', 'processed', 'attempts', 'last_error'],
  ai_calls: ['call_id', 'time', 'purpose', 'model', 'record_id', 'certificate_id', 'input_tokens', 'output_tokens', 'thinking_tokens', 'cost_usd', 'outcome', 'outcome_reason'],
  ai_drafts: ['draft_id', 'record_id', 'certificate_id', 'kind', 'drafted_by', 'fallback_reason', 'opening', 'explanations_json', 'call_id', 'time'],
  calibration_samples: ['sample_id', 'source', 'certificate_id', 'record_id', 'pdf_link', 'expected_json', 'corrected_by', 'note', 'time', 'active'],
};

test('initProject builds exactly the frozen tabs and columns', () => {
  assert.deepEqual(runInitProject().tabs, TABS);
});

test('initProject builds the root Drive tree and writes the tolerance matrix to _config', () => {
  const state = runInitProject();
  assert.deepEqual(state.folders, [
    'COI Compliance (Sample data)',
    'COI Compliance (Sample data)/_config',
    'COI Compliance (Sample data)/_inbox',
    'COI Compliance (Sample data)/Projects',
  ]);
  assert.deepEqual(state.files.map((f) => f.path), ['COI Compliance (Sample data)/_config/tolerance-matrix.json']);
});

test('initProject run twice changes nothing', () => {
  assert.deepEqual(runInitProject(2), runInitProject(1));
});

test('adding a project builds one folder per subcontractor with the three record folders', () => {
  const state = runAddProject(
    { project_id: 'PRJ-001', name: 'Maple Court Residences' },
    [{ sub_id: 'SUB-001', name: 'Ridgeline Roofing LLC' }],
  );
  assert.deepEqual(state.folders.slice(4), [
    'COI Compliance (Sample data)/Projects/PRJ-001 Maple Court Residences',
    'COI Compliance (Sample data)/Projects/PRJ-001 Maple Court Residences/SUB-001 Ridgeline Roofing LLC',
    'COI Compliance (Sample data)/Projects/PRJ-001 Maple Court Residences/SUB-001 Ridgeline Roofing LLC/certificates',
    'COI Compliance (Sample data)/Projects/PRJ-001 Maple Court Residences/SUB-001 Ridgeline Roofing LLC/decisions',
    'COI Compliance (Sample data)/Projects/PRJ-001 Maple Court Residences/SUB-001 Ridgeline Roofing LLC/correspondence',
  ]);
});
