// The Reader, driven through fake file loading and a fake model service.
// Expected values are written by hand.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGsRaw, plain } = require('./load-gs');

const { buildReader, driveFileIdFromLink } = loadGsRaw(['buildReader', 'driveFileIdFromLink']);

const FILE = { name: 'ridgeline-coi.pdf', fingerprint: 'sha256-r1', link: 'https://drive.google.com/file/d/1AbC_dEf-123/view?usp=drivesdk' };
const encode = (bytes) => Buffer.from(bytes).toString('base64');

const modelReply = (obj) => ({
  status: 200,
  text: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(obj) }] } }] })
});

const GOOD = {
  readable: true, unreadable_reason: null, confidence: 0.91,
  values: {
    insured_name: 'Ridgeline Roofing LLC',
    limits: {
      commercial_liability: 1000000, aggregate: 2000000, auto: 1000000, umbrella: 2000000,
      workers_comp: 1000000, pollution_liability: null, professional_liability: null
    },
    additional_insured_endorsement: true, project_address: true, certificate_holder: true,
    cancellation_notice_days: 30, expiration_date: '2027-09-30'
  }
};

function fakes(response) {
  const seen = { file: null, request: null };
  return {
    seen,
    reader: buildReader(
      (file) => { seen.file = file; return [37, 80, 68, 70]; },
      (request) => { seen.request = request; return response; },
      encode
    )
  };
}

test('the Reader loads the file, asks the model and returns the parsed reading', () => {
  const { reader, seen } = fakes(modelReply(GOOD));
  const reading = plain(reader.read(FILE));
  assert.equal(reading.readable, true);
  assert.equal(reading.confidence, 0.91);
  assert.equal(reading.values.insured_name, 'Ridgeline Roofing LLC');
  assert.equal(reading.values.limits.pollution_liability, null);
  assert.equal(seen.file.link, FILE.link);
});

test('the request sends the PDF inline, asks for JSON at temperature 0 and names the configured model', () => {
  const { reader, seen } = fakes(modelReply(GOOD));
  reader.read(FILE);
  const req = plain(seen.request);
  assert.equal(req.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
  assert.deepEqual(req.body.contents[0].parts[0], { inline_data: { mime_type: 'application/pdf', data: 'JVBERg==' } });
  assert.equal(typeof req.body.contents[0].parts[1].text, 'string');
  assert.equal(req.body.generationConfig.temperature, 0);
  assert.equal(req.body.generationConfig.responseMimeType, 'application/json');
  assert.equal(req.body.generationConfig.responseJsonSchema.type, 'object');
});

test('the schema sent to the model lists the same fields parseExtraction needs', () => {
  const { reader, seen } = fakes(modelReply(GOOD));
  reader.read(FILE);
  const schema = plain(seen.request).body.generationConfig.responseJsonSchema;
  assert.deepEqual(schema.required, ['readable', 'unreadable_reason', 'confidence', 'values']);
  assert.deepEqual(Object.keys(schema.properties.values.properties), [
    'insured_name', 'limits', 'additional_insured_endorsement', 'project_address',
    'certificate_holder', 'cancellation_notice_days', 'expiration_date'
  ]);
  assert.deepEqual(Object.keys(schema.properties.values.properties.limits.properties), [
    'commercial_liability', 'aggregate', 'auto', 'umbrella', 'workers_comp',
    'pollution_liability', 'professional_liability'
  ]);
});

test('a model reply that fails parsing is unreadable, never a guess', () => {
  const { reader } = fakes(modelReply({ readable: true, confidence: 2, values: GOOD.values }));
  assert.deepEqual(plain(reader.read(FILE)), {
    readable: false, confidence: 0, values: null, reason: 'Confidence must be a number from 0 to 1.', usage: {}
  });
});

test('a 400 from the model service means it rejected the file, so the result is unreadable', () => {
  const { reader } = fakes({ status: 400, text: '{"error":{"message":"The document has no pages."}}' });
  assert.deepEqual(plain(reader.read(FILE)), {
    readable: false, confidence: 0, values: null, reason: 'The model service rejected the file (HTTP 400).',
    usage: { promptTokenCount: 0, candidatesTokenCount: 0, thoughtsTokenCount: 0 }
  });
});

test('a 400 that says the API key is bad stops the job, so no file is marked unreadable by mistake', () => {
  const { reader } = fakes({ status: 400, text: '{"error":{"message":"API key not valid. Please pass a valid API key."}}' });
  assert.throws(() => reader.read(FILE), /Gemini rejected the API key/);
});

test('a reply with no candidates is unreadable', () => {
  const { reader } = fakes({ status: 200, text: JSON.stringify({ candidates: [] }) });
  assert.deepEqual(plain(reader.read(FILE)), {
    readable: false, confidence: 0, values: null, reason: 'The model returned no answer.', usage: {}
  });
});

test('any other failure stops the job so it can run again', () => {
  const { reader } = fakes({ status: 429, text: 'quota' });
  assert.throws(() => reader.read(FILE), /HTTP 429/);
  const { reader: down } = fakes({ status: 503, text: 'unavailable' });
  assert.throws(() => down.read(FILE), /HTTP 503/);
});

// Ticket B: every reading carries the reply's usageMetadata, so the caller can meter the call.
const USAGE = { promptTokenCount: 1712, candidatesTokenCount: 296, thoughtsTokenCount: 0, totalTokenCount: 2008 };
const withUsage = (reply) => {
  const body = JSON.parse(reply.text);
  body.usageMetadata = USAGE;
  return { status: reply.status, text: JSON.stringify(body) };
};

test('a read reading carries the reply usage', () => {
  const { reader } = fakes(withUsage(modelReply(GOOD)));
  const reading = plain(reader.read(FILE));
  assert.equal(reading.readable, true);
  assert.deepEqual(reading.usage, USAGE);
});

test('a "no answer" reading still carries the reply usage, since the call was billed', () => {
  const { reader } = fakes(withUsage({ status: 200, text: JSON.stringify({ candidates: [] }) }));
  const reading = plain(reader.read(FILE));
  assert.equal(reading.reason, 'The model returned no answer.');
  assert.deepEqual(reading.usage, USAGE);
});

test('a reply the parser rejects still carries the reply usage', () => {
  const { reader } = fakes(withUsage(modelReply({ readable: true, confidence: 2, values: GOOD.values })));
  assert.deepEqual(plain(reader.read(FILE)).usage, USAGE);
});

test('driveFileIdFromLink finds the file ID in the link forms Drive gives out', () => {
  assert.equal(driveFileIdFromLink('https://drive.google.com/file/d/1AbC_dEf-123/view?usp=drivesdk'), '1AbC_dEf-123');
  assert.equal(driveFileIdFromLink('https://drive.google.com/open?id=1AbC_dEf-123'), '1AbC_dEf-123');
  assert.throws(() => driveFileIdFromLink('fake://inbox/ridgeline-coi.pdf'), /No Drive file ID in link/);
  assert.throws(() => driveFileIdFromLink(''), /No Drive file ID in link/);
});
