// Sheet tabs, columns and the Drive folder tree. Frozen after milestone 1:
// tests/init-project.test.js fails on any rename. Column names used in
// docs/metric-definitions.md must match these.

var SCHEMA = {
  projects: ['project_id', 'name', 'review_mode', 'accountant_email', 'project_manager_email', 'leadership_email', 'status', 'created_date',
    'accountant_name', 'project_manager_name', 'leadership_name'],
  subcontractors: ['sub_id', 'name', 'email', 'scope_of_work', 'contact_name', 'phone', 'trade'],
  compliance_records: [
    'record_id', 'project_id', 'sub_id', 'subcontract_number', 'upload_token', 'status',
    'current_certificate_id', 'queued_certificate_id', 'payment_hold', 'payment_hold_reasons', 'w9_on_file',
    'reminder_30d_sent', 'reminder_7d_sent', 'closed', 'last_updated'
  ],
  certificates: [
    'certificate_id', 'record_id', 'received_date', 'file_fingerprint', 'queue_stage', 'queue_reason', 'confidence',
    'insured_name', 'commercial_liability_usd', 'aggregate_usd', 'auto_usd', 'umbrella_usd', 'workers_comp_usd',
    'pollution_liability_usd', 'professional_liability_usd', 'additional_insured_endorsement', 'project_address',
    'certificate_holder', 'cancellation_notice_days', 'expiration_date', 'check_result', 'deficiencies', 'decision',
    'replaces_certificate_id', 'outcome', 'pdf_link', 'reading_link', 'decision_note', 'calendar_event_id'
  ],
  pay_applications: ['project_id', 'sub_id', 'pay_cycle', 'amount_billed_usd'],
  activity_log: ['record_id', 'time', 'who', 'event_type', 'summary', 'drive_link'],
  uploads: ['upload_id', 'upload_token', 'received_time', 'file_name', 'file_fingerprint', 'drive_link', 'processed', 'attempts', 'last_error'],
  ai_calls: ['call_id', 'time', 'purpose', 'model', 'record_id', 'certificate_id', 'input_tokens', 'output_tokens', 'thinking_tokens', 'cost_usd', 'outcome', 'outcome_reason'],
  ai_drafts: ['draft_id', 'record_id', 'certificate_id', 'kind', 'drafted_by', 'fallback_reason', 'opening', 'explanations_json', 'call_id', 'time'],
  calibration_samples: ['sample_id', 'source', 'certificate_id', 'record_id', 'pdf_link', 'expected_json', 'corrected_by', 'note', 'time', 'active']
};

var DRIVE_ROOT = 'COI Compliance (Sample data)';
var DRIVE_CONFIG = DRIVE_ROOT + '/_config';
var DRIVE_INBOX = DRIVE_ROOT + '/_inbox';
var DRIVE_PROJECTS = DRIVE_ROOT + '/Projects';
var RECORD_FOLDERS = ['certificates', 'decisions', 'correspondence'];

function projectFolderPath(project) {
  return DRIVE_PROJECTS + '/' + project.project_id + ' ' + project.name;
}

function subFolderPath(project, sub) {
  return projectFolderPath(project) + '/' + sub.sub_id + ' ' + sub.name;
}
