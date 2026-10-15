// parseExtraction: the model's reply in, a clean reading or an unreadable result out.
// Expected values are written by hand.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGs } = require('./load-gs');

const { parseExtraction } = loadGs(['parseExtraction']);

const reply = (overrides = {}) => ({
  readable: true,
  unreadable_reason: null,
  confidence: 0.93,
  values: {
    insured_name: 'Ridgeline Roofing LLC',
    limits: {
      commercial_liability: 1000000, aggregate: 2000000, auto: 1000000, umbrella: 2000000,
      workers_comp: 1000000, pollution_liability: 1000000, professional_liability: null
    },
    additional_insured_endorsement: true, project_address: true, certificate_holder: true,
    cancellation_notice_days: 30, expiration_date: '2027-09-30'
  },
  ...overrides
});

const withValues = (patch) => {
  const r = reply();
  Object.assign(r.values, patch);
  return r;
};
const withLimits = (patch) => {
  const r = reply();
  Object.assign(r.values.limits, patch);
  return r;
};

const unreadable = (reason) => ({ readable: false, confidence: 0, values: null, reason });

test('a well-formed reply becomes a clean reading', () => {
  assert.deepEqual(parseExtraction(reply()), {
    readable: true,
    confidence: 0.93,
    reason: null,
    values: {
      insured_name: 'Ridgeline Roofing LLC',
      limits: {
        commercial_liability: 1000000, aggregate: 2000000, auto: 1000000, umbrella: 2000000,
        workers_comp: 1000000, pollution_liability: 1000000, professional_liability: null
      },
      additional_insured_endorsement: true, project_address: true, certificate_holder: true,
      cancellation_notice_days: 30, expiration_date: '2027-09-30'
    }
  });
});

test('the reply may arrive as JSON text', () => {
  assert.equal(parseExtraction(JSON.stringify(reply())).confidence, 0.93);
});

test('text that is not JSON is unreadable', () => {
  assert.deepEqual(parseExtraction('I could not read this file.'), unreadable('The reply was not valid JSON.'));
});

test('a wrong shape is unreadable', () => {
  assert.deepEqual(parseExtraction('[1, 2]'), unreadable('The reply was not a JSON object.'));
  assert.deepEqual(parseExtraction(null), unreadable('The reply was not a JSON object.'));
  assert.deepEqual(
    parseExtraction(reply({ values: 'none' })),
    unreadable('The reply has no values object.')
  );
  assert.deepEqual(
    parseExtraction(reply({ readable: 'yes' })),
    unreadable('The reply did not say whether the file was readable.')
  );
});

test('the model saying it cannot read the file is unreadable, with its reason', () => {
  assert.deepEqual(
    parseExtraction({ readable: false, unreadable_reason: 'The file is encrypted.', confidence: 0, values: null }),
    unreadable('The file is encrypted.')
  );
  assert.deepEqual(
    parseExtraction({ readable: false, confidence: 0, values: null }),
    unreadable('The model could not read the certificate.')
  );
});

test('dollars as strings become numbers', () => {
  const out = parseExtraction(withLimits({ commercial_liability: '$1,000,000', aggregate: '2,000,000', auto: '1000000.00', umbrella: ' $2,000,000 ' }));
  assert.equal(out.readable, true);
  assert.equal(out.values.limits.commercial_liability, 1000000);
  assert.equal(out.values.limits.aggregate, 2000000);
  assert.equal(out.values.limits.auto, 1000000);
  assert.equal(out.values.limits.umbrella, 2000000);
});

test('a limit that is not a dollar amount is unreadable', () => {
  assert.deepEqual(
    parseExtraction(withLimits({ auto: 'one million' })),
    unreadable('limits.auto is not a dollar amount.')
  );
  assert.deepEqual(
    parseExtraction(withLimits({ umbrella: -5 })),
    unreadable('limits.umbrella is not a dollar amount.')
  );
});

test('a limit shown as null stays null', () => {
  assert.equal(parseExtraction(withLimits({ umbrella: null })).values.limits.umbrella, null);
});

test('a missing field is unreadable and names the field', () => {
  const noExpiry = reply();
  delete noExpiry.values.expiration_date;
  assert.deepEqual(parseExtraction(noExpiry), unreadable('Missing field: expiration_date.'));

  const noLimit = reply();
  delete noLimit.values.limits.workers_comp;
  assert.deepEqual(parseExtraction(noLimit), unreadable('Missing field: limits.workers_comp.'));

  const noConfidence = reply();
  delete noConfidence.confidence;
  assert.deepEqual(parseExtraction(noConfidence), unreadable('Confidence must be a number from 0 to 1.'));
});

test('an empty insured name or a null expiry date is unreadable', () => {
  assert.deepEqual(parseExtraction(withValues({ insured_name: '  ' })), unreadable('Missing field: insured_name.'));
  assert.deepEqual(parseExtraction(withValues({ expiration_date: null })), unreadable('Missing field: expiration_date.'));
});

test('confidence out of range is unreadable', () => {
  assert.deepEqual(parseExtraction(reply({ confidence: 1.4 })), unreadable('Confidence must be a number from 0 to 1.'));
  assert.deepEqual(parseExtraction(reply({ confidence: -0.1 })), unreadable('Confidence must be a number from 0 to 1.'));
  assert.deepEqual(parseExtraction(reply({ confidence: '0.9' })), unreadable('Confidence must be a number from 0 to 1.'));
});

test('confidence at the edges is accepted', () => {
  assert.equal(parseExtraction(reply({ confidence: 0 })).confidence, 0);
  assert.equal(parseExtraction(reply({ confidence: 1 })).confidence, 1);
});

test('a date that is not a real calendar day is unreadable', () => {
  assert.deepEqual(parseExtraction(withValues({ expiration_date: '09/30/2027' })), unreadable('expiration_date must be YYYY-MM-DD.'));
  assert.deepEqual(parseExtraction(withValues({ expiration_date: '2027-02-30' })), unreadable('expiration_date must be YYYY-MM-DD.'));
});

test('the yes/no fields must be true or false', () => {
  assert.deepEqual(
    parseExtraction(withValues({ additional_insured_endorsement: 'yes' })),
    unreadable('additional_insured_endorsement must be true or false.')
  );
  assert.deepEqual(
    parseExtraction(withValues({ certificate_holder: null })),
    unreadable('certificate_holder must be true or false.')
  );
});

test('cancellation notice days may be a whole number, a digit string or null', () => {
  assert.equal(parseExtraction(withValues({ cancellation_notice_days: '10' })).values.cancellation_notice_days, 10);
  assert.equal(parseExtraction(withValues({ cancellation_notice_days: null })).values.cancellation_notice_days, null);
  assert.deepEqual(
    parseExtraction(withValues({ cancellation_notice_days: 'thirty' })),
    unreadable('cancellation_notice_days must be a whole number of days or null.')
  );
});

test('extra fields the model adds are dropped', () => {
  const r = withValues({ policy_number: 'GL-000123' });
  assert.equal('policy_number' in parseExtraction(r).values, false);
});
