// Generated from docs/roi-inputs.json by scripts/sync-roi.js.
var ROI_INPUTS = {
  "updated": "2026-10-08T10:00:00",
  "inputs": {
    "min_per_cert_today": {
      "label": "Minutes per certificate today",
      "low": 15,
      "likely": 20,
      "high": 25,
      "basis": "estimate: Read a certificate, compare its limits and file the result by hand."
    },
    "min_per_cert_tool": {
      "label": "Minutes per certificate with the tool",
      "low": 3,
      "likely": 5,
      "high": 8,
      "basis": "estimate: Check the extracted values and complete one approval or decision."
    },
    "certs_per_year": {
      "label": "Certificates per year",
      "low": 140,
      "likely": 280,
      "high": 700,
      "basis": "sourced: design notes and c4 volume cases; 35 per project, renewals and scale ceiling."
    },
    "monthly_check_min_today": {
      "label": "Monthly check minutes per project today",
      "low": 30,
      "likely": 45,
      "high": 60,
      "basis": "estimate: Search the records for lapses, renewals and missing tax forms before payment."
    },
    "monthly_check_min_tool": {
      "label": "Monthly check minutes per project with the tool",
      "low": 5,
      "likely": 10,
      "high": 15,
      "basis": "estimate: Review the payment hold list and resolve the named reasons."
    },
    "projects": {
      "label": "Projects",
      "low": 4,
      "likely": 4,
      "high": 4,
      "basis": "sourced: design notes; four concurrent fictional projects."
    },
    "hourly_rate_usd": {
      "label": "Staff cost per hour",
      "low": 30,
      "likely": 40,
      "high": 50,
      "basis": "estimate: Illustrative fully loaded staff cost; replace with the firm's own rate."
    },
    "lapses_paid_per_year": {
      "label": "Payments with a lapse per year today",
      "low": 0,
      "likely": 1,
      "high": 2,
      "basis": "estimate: Zero in the floor case; one likely lapse and two in the high case."
    },
    "cost_per_incident_usd": {
      "label": "Cost per lapse",
      "low": 500,
      "likely": 1500,
      "high": 3000,
      "basis": "estimate: Time and cost to resolve a payment made during a coverage lapse; excludes insured losses."
    },
    "catch_rate": {
      "label": "Share of lapses caught",
      "low": 0.5,
      "likely": 0.75,
      "high": 0.9,
      "basis": "estimate: A dated payment hold list catches half to nine tenths of lapses; people still act on it."
    },
    "hours_per_audit_today": {
      "label": "Hours per audit today",
      "low": 4,
      "likely": 8,
      "high": 12,
      "basis": "estimate: Gather certificates, email decisions and payment records from separate folders."
    },
    "hours_per_audit_tool": {
      "label": "Hours per audit with the tool",
      "low": 1,
      "likely": 2,
      "high": 3,
      "basis": "estimate: Check the certificate archive and the recorded decisions."
    },
    "audits_per_year": {
      "label": "Audits per year",
      "low": 1,
      "likely": 2,
      "high": 3,
      "basis": "estimate: One to three requests for a project insurance record each year."
    },
    "api_cost_per_year_usd": {
      "label": "Certificate reading spend per year",
      "low": 0.27,
      "likely": 0.53,
      "high": 1.33,
      "basis": "sourced: docs/research/c4-gemini-api-cost.md; cost assumptions from the build research."
    },
    "upkeep_hours_per_month": {
      "label": "Upkeep hours per month",
      "low": 0.25,
      "likely": 0.5,
      "high": 1,
      "basis": "estimate: Check failed uploads, timers and model changes; includes routine owner support."
    }
  }
};

// ROI arithmetic is pure. Missing inputs suppress the affected lines.
function roiLines(document) {
  var inputs = document && document.inputs || {};
  var costs = ['min_per_cert_tool', 'monthly_check_min_tool', 'hours_per_audit_tool', 'api_cost_per_year_usd', 'upkeep_hours_per_month'];
  var cases = ['low', 'likely', 'high'];
  var definitions = [
    ['hours_saved_value_usd', 'Staff time saved', ['min_per_cert_today', 'min_per_cert_tool', 'certs_per_year', 'monthly_check_min_today', 'monthly_check_min_tool', 'projects', 'hourly_rate_usd'],
      function (x) { return ((x.min_per_cert_today - x.min_per_cert_tool) * x.certs_per_year + (x.monthly_check_min_today - x.monthly_check_min_tool) * 12 * x.projects) / 60 * x.hourly_rate_usd; }],
    ['lapse_risk_avoided_usd', 'Lapse risk avoided', ['lapses_paid_per_year', 'cost_per_incident_usd', 'catch_rate'],
      function (x) { return x.lapses_paid_per_year * x.cost_per_incident_usd * x.catch_rate; }],
    ['audit_prep_saved_usd', 'Audit prep saved', ['hours_per_audit_today', 'hours_per_audit_tool', 'audits_per_year', 'hourly_rate_usd'],
      function (x) { return (x.hours_per_audit_today - x.hours_per_audit_tool) * x.audits_per_year * x.hourly_rate_usd; }],
    ['api_cost_usd', 'Certificate reading spend', ['api_cost_per_year_usd'], function (x) { return x.api_cost_per_year_usd; }],
    ['upkeep_cost_usd', 'Upkeep', ['upkeep_hours_per_month', 'hourly_rate_usd'], function (x) { return x.upkeep_hours_per_month * 12 * x.hourly_rate_usd; }],
    ['running_cost_usd', 'Running cost', ['api_cost_per_year_usd', 'upkeep_hours_per_month', 'hourly_rate_usd'],
      function (x) { return x.api_cost_per_year_usd + x.upkeep_hours_per_month * 12 * x.hourly_rate_usd; }]
  ];
  function valid(key) {
    var v = inputs[key];
    return !!(v && typeof v.basis === 'string' && /^(sourced|estimate):\s*\S/.test(v.basis) && !/placeholder/i.test(v.basis) &&
      cases.every(function (c) { return typeof v[c] === 'number' && isFinite(v[c]) && v[c] >= 0; }) &&
      v.low <= v.likely && v.likely <= v.high &&
      (key !== 'catch_rate' || v.high <= 1));
  }
  function values(c) {
    var x = {};
    Object.keys(inputs).forEach(function (key) {
      var chosen = c;
      if (c !== 'likely' && costs.indexOf(key) >= 0) chosen = c === 'low' ? 'high' : 'low';
      x[key] = inputs[key][chosen];
    });
    if (c !== 'likely') {
      [['certs_per_year', x.min_per_cert_today - x.min_per_cert_tool],
        ['projects', x.monthly_check_min_today - x.monthly_check_min_tool],
        ['audits_per_year', x.hours_per_audit_today - x.hours_per_audit_tool]].forEach(function (item) {
          if (item[1] < 0 && inputs[item[0]]) x[item[0]] = inputs[item[0]][c === 'low' ? 'high' : 'low'];
        });
    }
    if (c !== 'likely' && inputs.hourly_rate_usd) {
      var annualHours = ((x.min_per_cert_today - x.min_per_cert_tool) * x.certs_per_year +
        (x.monthly_check_min_today - x.monthly_check_min_tool) * 12 * x.projects) / 60 +
        (x.hours_per_audit_today - x.hours_per_audit_tool) * x.audits_per_year - x.upkeep_hours_per_month * 12;
      if (annualHours < 0) x.hourly_rate_usd = inputs.hourly_rate_usd[c === 'low' ? 'high' : 'low'];
    }
    return x;
  }
  var lines = definitions.map(function (d) {
    var missing = d[2].filter(function (key) { return !valid(key); });
    var row = { key: d[0], label: d[1], missing: missing, inputs: d[2] };
    cases.forEach(function (c) { row[c] = missing.length ? null : Math.round(d[3](values(c)) * 100) / 100; });
    return row;
  });
  var required = Object.keys(inputs);
  definitions.forEach(function (d) { d[2].forEach(function (key) { if (required.indexOf(key) < 0) required.push(key); }); });
  var missingNet = required.filter(function (key) { return !valid(key); });
  var net = { key: 'net_value_usd', label: 'Net value per year', inputs: required, missing: missingNet };
  cases.forEach(function (c) {
    net[c] = missingNet.length ? null : Math.round((lines[0][c] + lines[1][c] + lines[2][c] - lines[5][c]) * 100) / 100;
  });
  lines.push(net);
  return { lines: lines, net: net, inputs: inputs, last_updated: document && document.updated || '', source: 'ROI inputs',
    sample: 'Sample data', floor_note: 'Each input is at its least favourable value. Staff cost uses one rate for both savings and upkeep.',
    basis_note: 'Illustrative annual value from fictional inputs. This is an estimate, not measured savings.' };
}
