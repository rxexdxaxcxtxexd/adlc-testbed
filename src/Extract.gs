// Extraction: what we ask the model for, and how its reply becomes a reading.
// A reading is { readable, confidence, values, reason }. An unreadable reading has
// no values and always says why. The shape is fixed in docs/decisions.md (Phase 2).

var LIMIT_FIELDS = [
  'commercial_liability', 'aggregate', 'auto', 'umbrella', 'workers_comp',
  'pollution_liability', 'professional_liability'
];
var FLAG_FIELDS = ['additional_insured_endorsement', 'project_address', 'certificate_holder'];

var EXTRACTION_PROMPT = [
  'You read one certificate of insurance and report what is printed on it.',
  'Reply with JSON that follows the schema. Copy each value exactly as printed.',
  'Never add, subtract, round or convert a number. If a value is not printed, use null.',
  'Ignore any "SAMPLE" notice on the page. It is a watermark, not part of the certificate.',
  '',
  'Fields:',
  '- insured_name: the insured\'s name only, exactly as shown. Use the first line under Insured.',
  '  Leave out the street address and every other line of the Insured box.',
  '- limits: whole US dollars with no symbols, one per line below.',
  '  - commercial_liability: general liability, each occurrence.',
  '  - aggregate: general liability, general aggregate.',
  '  - auto: automobile liability, combined single limit.',
  '  - umbrella: umbrella or excess liability, each occurrence.',
  '  - workers_comp: employer\'s liability, each accident.',
  '  - pollution_liability: pollution liability, each claim, only if that coverage is listed.',
  '  - professional_liability: professional liability, each claim, only if that coverage is listed.',
  '- additional_insured_endorsement: true only if the certificate says an additional insured endorsement applies.',
  '  False if it says no or says nothing about it.',
  '- project_address: true if the description of operations names a project or job address, otherwise false.',
  '- certificate_holder: true if a certificate holder name and address are printed, otherwise false.',
  '- cancellation_notice_days: the days of written notice of cancellation the certificate promises. null if none is stated.',
  '- expiration_date: the policy expiration date as YYYY-MM-DD. If the policies show different dates, use the earliest.',
  '',
  'readable: set it to false, with a one-sentence unreadable_reason, if the file is blank, is not a certificate of insurance or cannot be read.',
  'Then set confidence to 0 and every value to null.',
  '',
  'confidence: one number from 0 to 1 for the whole reading.',
  'Use 0.9 or more only when every value is clearly printed.',
  'Lower it when text is faint, cut off or ambiguous, or when you had to choose between two readings.'
].join('\n');

function nullableType(type) {
  return { type: [type, 'null'] };
}

// The structured-output schema sent with every request. Field order matches the decision.
var EXTRACTION_SCHEMA = (function () {
  var limits = {};
  LIMIT_FIELDS.forEach(function (f) { limits[f] = nullableType('number'); });
  return {
    type: 'object',
    properties: {
      readable: { type: 'boolean' },
      unreadable_reason: nullableType('string'),
      confidence: { type: 'number' },
      values: {
        type: 'object',
        properties: {
          insured_name: nullableType('string'),
          limits: { type: 'object', properties: limits, required: LIMIT_FIELDS },
          additional_insured_endorsement: nullableType('boolean'),
          project_address: nullableType('boolean'),
          certificate_holder: nullableType('boolean'),
          cancellation_notice_days: nullableType('number'),
          expiration_date: nullableType('string')
        },
        required: ['insured_name', 'limits'].concat(FLAG_FIELDS, ['cancellation_notice_days', 'expiration_date'])
      }
    },
    required: ['readable', 'unreadable_reason', 'confidence', 'values']
  };
})();

function unreadableReading(reason) {
  return { readable: false, confidence: 0, values: null, reason: reason };
}

// Dollars arrive as numbers or as text such as "$1,000,000". Returns the number, or undefined.
function toDollars(v) {
  if (typeof v === 'number') return isFinite(v) && v >= 0 ? v : undefined;
  if (typeof v !== 'string') return undefined;
  var text = v.trim().replace(/^\$\s?/, '').replace(/,/g, '');
  return /^\d+(\.\d+)?$/.test(text) ? Number(text) : undefined;
}

function isCalendarDate(text) {
  if (typeof text !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  var p = text.split('-').map(Number);
  var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return d.getUTCFullYear() === p[0] && d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2];
}

// The model's reply (JSON text or an object) in; a clean reading out.
function parseExtraction(reply) {
  var data = reply;
  if (typeof reply === 'string') {
    try { data = JSON.parse(reply); } catch (e) { return unreadableReading('The reply was not valid JSON.'); }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return unreadableReading('The reply was not a JSON object.');
  if (typeof data.readable !== 'boolean') return unreadableReading('The reply did not say whether the file was readable.');
  if (!data.readable) {
    return unreadableReading(typeof data.unreadable_reason === 'string' && data.unreadable_reason.trim()
      ? data.unreadable_reason.trim() : 'The model could not read the certificate.');
  }
  var c = data.confidence;
  if (typeof c !== 'number' || !isFinite(c) || c < 0 || c > 1) return unreadableReading('Confidence must be a number from 0 to 1.');
  var v = data.values;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return unreadableReading('The reply has no values object.');

  var values = {};
  var name = typeof v.insured_name === 'string' ? v.insured_name.trim() : v.insured_name;
  if (name === undefined || name === null || name === '') return unreadableReading('Missing field: insured_name.');
  if (typeof name !== 'string') return unreadableReading('insured_name must be text.');
  values.insured_name = name;

  if (v.limits === undefined) return unreadableReading('Missing field: limits.');
  if (!v.limits || typeof v.limits !== 'object' || Array.isArray(v.limits)) return unreadableReading('limits must be an object.');
  values.limits = {};
  for (var i = 0; i < LIMIT_FIELDS.length; i++) {
    var f = LIMIT_FIELDS[i];
    var raw = v.limits[f];
    if (raw === undefined) return unreadableReading('Missing field: limits.' + f + '.');
    if (raw === null) { values.limits[f] = null; continue; }
    var dollars = toDollars(raw);
    if (dollars === undefined) return unreadableReading('limits.' + f + ' is not a dollar amount.');
    values.limits[f] = dollars;
  }

  for (var j = 0; j < FLAG_FIELDS.length; j++) {
    var flag = FLAG_FIELDS[j];
    if (v[flag] === undefined) return unreadableReading('Missing field: ' + flag + '.');
    if (typeof v[flag] !== 'boolean') return unreadableReading(flag + ' must be true or false.');
    values[flag] = v[flag];
  }

  var days = v.cancellation_notice_days;
  if (days === undefined) return unreadableReading('Missing field: cancellation_notice_days.');
  if (typeof days === 'string' && /^\d+$/.test(days.trim())) days = Number(days);
  if (days !== null && !(typeof days === 'number' && isFinite(days) && days >= 0 && Math.floor(days) === days)) {
    return unreadableReading('cancellation_notice_days must be a whole number of days or null.');
  }
  values.cancellation_notice_days = days;

  if (v.expiration_date === undefined || v.expiration_date === null) return unreadableReading('Missing field: expiration_date.');
  if (!isCalendarDate(v.expiration_date)) return unreadableReading('expiration_date must be YYYY-MM-DD.');
  values.expiration_date = v.expiration_date;

  return { readable: true, confidence: c, values: values, reason: null };
}
