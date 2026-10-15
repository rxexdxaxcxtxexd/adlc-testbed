// Compliance core: the comparison logic. Pure: no Google services.
// Every limit comes from the tolerance matrix; this file holds no dollar amounts
// (scripts/checks/dollar-amounts.js enforces it). Keep other code out of this file.

var COI_LIMITS = ['commercial_liability', 'aggregate', 'auto', 'umbrella', 'workers_comp', 'pollution_liability', 'professional_liability'];
var COI_CHECKS = ['additional_insured_endorsement', 'project_address', 'certificate_holder', 'insured_name_matches'];
var COI_LABEL = {
  commercial_liability: 'General liability', aggregate: 'Aggregate', auto: 'Auto', umbrella: 'Umbrella',
  workers_comp: "Workers' comp", pollution_liability: 'Pollution', professional_liability: 'Professional',
  additional_insured_endorsement: 'Additional insured endorsement', project_address: 'Project address',
  certificate_holder: 'Certificate holder', insured_name_matches: 'Insured name', cancellation_notice_days: 'Cancellation notice'
};

function formatUsd(n) {
  return '$' + Number(n).toLocaleString('en-US');
}

function normalizeName(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function mergeRules(scope, matrix) {
  var rules = JSON.parse(JSON.stringify(matrix.default));
  var overrides = matrix.scopes[scope] || {};
  Object.keys(overrides).forEach(function (k) { rules[k] = Object.assign({}, rules[k], overrides[k]); });
  return rules;
}

// Seam: evaluateCoi(extracted, scope, matrix, context). context.insuredName is the subcontractor's name.
function evaluateCoi(extracted, scope, matrix, context) {
  var rules = mergeRules(scope, matrix);
  var v = Object.assign({}, extracted, {
    insured_name_matches: normalizeName(extracted.insured_name) === normalizeName(context && context.insuredName)
  });
  var limits = v.limits || {};
  var deficiencies = [];
  var lines = [];
  function line(field, found, required, pass) {
    lines.push({ field: field, label: COI_LABEL[field], found: found, required: required, pass: pass });
  }
  COI_LIMITS.forEach(function (f) {
    var rule = rules[f];
    if (!rule.required) return;
    var found = limits[f];
    var needs = rule.minimum != null ? formatUsd(rule.minimum) : 'Any amount';
    if (found == null) {
      deficiencies.push({ field: f, kind: 'limit', text: COI_LABEL[f] + ': not shown; ' + needs + ' required' });
      line(f, 'Not shown', needs, false);
    } else if (rule.minimum != null && found < rule.minimum) {
      deficiencies.push({ field: f, kind: 'limit', text: COI_LABEL[f] + ': ' + formatUsd(found) + ' shown, ' + formatUsd(rule.minimum) + ' required' });
      line(f, formatUsd(found), needs, false);
    } else {
      line(f, formatUsd(found), needs, true);
    }
  });
  COI_CHECKS.forEach(function (f) {
    if (!rules[f].required) return;
    var ok = v[f] === true;
    if (!ok) deficiencies.push({ field: f, kind: 'requirement', text: f === 'insured_name_matches'
      ? 'Insured name: certificate shows ' + (extracted.insured_name || 'Not shown') + '; must read ' + (context && context.insuredName || 'Not shown')
      : COI_LABEL[f] + ': not shown; required' });
    if (f === 'insured_name_matches') line(f, ok ? 'Matches' : 'Does not match', 'Matches', ok);
    else line(f, ok ? 'Printed' : 'Not printed', 'Printed', ok);
  });
  var c = rules.cancellation_notice_days;
  if (c.required) {
    var days = v.cancellation_notice_days;
    var short = days == null || days < c.minimum;
    if (short) {
      var shown = days == null ? 'none' : days;
      deficiencies.push({ field: 'cancellation_notice_days', kind: 'requirement', text: 'Cancellation notice: ' + shown + ' days shown, ' + c.minimum + ' required' });
    }
    line('cancellation_notice_days', days == null ? 'Not shown' : days + ' days', c.minimum + ' days', !short);
  }
  return { pass: deficiencies.length === 0, deficiencies: deficiencies, lines: lines };
}
