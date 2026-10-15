// AI drafts of the people-facing messages (docs/decisions.md, Phase 6). The model writes wording only:
// one opening sentence and one line per deficiency. Code writes every fact line, the closing and the link.
// The model receives no source amounts, dates or names. The check rejects common number, date, link and ID forms.
// The check cannot prove tone or facts or detect every personal name. A rejected draft uses the template.

// Who reads each kind of message.
var DRAFT_AUDIENCE = { deficiency_notice: 'project manager', correction_request: 'subcontractor' };

var DRAFT_OPENING_MAX = 200;
var DRAFT_EXPLANATION_MAX = 240;

var DRAFT_SCHEMA = {
  type: 'object', required: ['opening', 'explanations'],
  properties: {
    opening: { type: 'string' },
    explanations: { type: 'array', items: { type: 'object', required: ['id', 'text'],
      properties: { id: { type: 'string' }, text: { type: 'string' } } } }
  }
};

var DRAFT_PROMPT = [
  'You write short, plain emails for a construction firm\'s insurance compliance team.',
  'Audience: {audience}. Tone: polite, direct, no blame.',
  'You get a list of problems with a certificate of insurance, each with an id, a kind and the field it is about.',
  'Kind "limit" means a coverage limit is missing or too low. Kind "requirement" means something the project needs is not on the certificate.',
  'Write one opening sentence. Then, for each id, one sentence saying what fixes the problem, such as what to ask the insurance agent for.',
  'The system prints the facts above each of your sentences, so do not repeat them and do not count the problems.',
  'Never write a number, an amount, a date, a link or a name. The system adds those.',
  'Use each id you were given exactly once, and no other id.'
].join('\n');

// A deficiency has no id of its own (evaluateCoi returns { field, kind, text }). Its id is its position
// from 1 and its kind, such as D1-limit. evaluateCoi lists deficiencies in a fixed order and the
// certificate row stores that list, so the id of a stored deficiency never changes.
function draftIds(deficiencies) {
  return deficiencies.map(function (d, i) { return 'D' + (i + 1) + '-' + d.kind; });
}

// All the model is told about a certificate: the audience, and per deficiency its id, kind and field label.
function draftInput(audience, deficiencies) {
  var ids = draftIds(deficiencies);
  return {
    audience: audience,
    items: deficiencies.map(function (d, i) { return { id: ids[i], kind: d.kind, field_label: COI_LABEL[d.field] }; })
  };
}

// reply = the parsed model JSON. ids = the deficiency ids sent. Returns { ok, reason }. Pure.
// Only the text is checked for digits: the ids carry digits by design.
function checkDraft(reply, ids) {
  function fail(reason) { return { ok: false, reason: reason }; }
  if (!reply || typeof reply.opening !== 'string' || !Array.isArray(reply.explanations)) return fail('not the expected shape');
  var shapeOk = reply.explanations.every(function (e) { return e && typeof e.id === 'string' && typeof e.text === 'string'; });
  if (!shapeOk) return fail('not the expected shape');
  var texts = [reply.opening].concat(reply.explanations.map(function (e) { return e.text; }));
  if (texts.some(function (t) { return !t.trim(); })) return fail('empty text');
  if (texts.some(function (t) { return /[0-9]/.test(t); })) return fail('contains a number');
  if (texts.some(function (t) { return /[$€£]/.test(t); })) return fail('contains a currency sign');
  var numberWords = /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundreds?|thousands?|millions?|billions?|trillions?|dozens?|half|halves|quarters?|percent|percentage|dollars?|cents?|euros?|pounds?)\b/i;
  if (texts.some(function (t) { return numberWords.test(t); })) return fail('contains a number word');
  // Lowercase "may" remains a modal verb. A capitalized May or a date phrase is rejected.
  var namedDates = /\b(january|jan|february|feb|march|mar|april|apr|june|jun|july|jul|august|aug|september|sept?|october|oct|november|nov|december|dec|monday|mon|tuesday|tues?|wednesday|wed|thursday|thu(?:rs?)?|friday|fri|saturday|sat|sunday|sun|today|tomorrow|yesterday|tonight)\b/i;
  if (texts.some(function (t) {
    return namedDates.test(t) || /\bMay\b/.test(t) || /\b(by|before|after|on|in|until|during|through|due|next|this|last)\s+may\b/i.test(t);
  })) return fail('contains a date');
  var links = /http|www\.|\b[a-z][a-z0-9+.-]*:\/\/|\b(mailto|javascript|data):|\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}\b/i;
  if (texts.some(function (t) { return links.test(t); })) return fail('contains a link');
  var embeddedIds = /\b(CERT|REC|PRJ|SUB|UPL|DRF|SMP|SC|POLICY|ID)[-_][a-z][a-z_-]*\b|\b[a-f]{8}(?:-[a-f]{4}){3}-[a-f]{12}\b/i;
  if (texts.some(function (t) { return embeddedIds.test(t); })) return fail('contains an id');
  var seen = [];
  for (var i = 0; i < reply.explanations.length; i++) {
    var id = reply.explanations[i].id;
    if (ids.indexOf(id) < 0) return fail('unknown id ' + id);
    if (seen.indexOf(id) >= 0) return fail('repeated id ' + id);
    seen.push(id);
  }
  var missing = ids.filter(function (id) { return seen.indexOf(id) < 0; })[0];
  if (missing) return fail('missing id ' + missing);
  if (reply.opening.length > DRAFT_OPENING_MAX) return fail('opening is over ' + DRAFT_OPENING_MAX + ' characters');
  var long = reply.explanations.some(function (e) { return e.text.length > DRAFT_EXPLANATION_MAX; });
  if (long) return fail('an explanation is over ' + DRAFT_EXPLANATION_MAX + ' characters');
  return { ok: true, reason: '' };
}

// Each fact line exactly as evaluateCoi wrote it, with the model's line for that deficiency under it.
function draftedLines(deficiencies, draft) {
  var ids = draftIds(deficiencies);
  var lines = [];
  deficiencies.forEach(function (d, i) {
    var said = draft.explanations.filter(function (e) { return e.id === ids[i]; })[0];
    lines.push('- ' + d.text);
    lines.push('  ' + said.text);
  });
  return lines;
}

// The email to the project manager. With draft null it is the template nextStatus sends, byte for byte. Pure.
function assembleDeficiencyNotice(subName, deficiencies, draft, recordLink) {
  var closing = 'Waive or reject?' + (recordLink ? ' Open the record: ' + recordLink : '');
  if (!draft) return subName + ': ' + deficiencies.map(function (d) { return d.text; }).join('; ') + '. ' + closing;
  return [subName + ': ' + draft.opening].concat(draftedLines(deficiencies, draft), [closing]).join('\n');
}

// The email to the subcontractor after a reject. With draft null it is correctionText, byte for byte. Pure.
function assembleCorrectionRequest(deficiencies, draft, uploadLink) {
  if (!draft) return correctionText(deficiencies, uploadLink);
  return [draft.opening].concat(draftedLines(deficiencies, draft), ['Please send a corrected certificate.'])
    .join('\n') + (uploadLink ? '\nUpload it here: ' + uploadLink : '');
}

// --- The ai_drafts tab ---

// Every ai_drafts row. A Sheet built before Phase 6 has no ai_drafts tab until the daily job adds it,
// and reads as no drafts. A missing draft means the template, so nothing is lost.
function draftRows(store) {
  try { return store.readRows('ai_drafts'); } catch (err) { return []; }
}

// The stored draft for a certificate and kind: { drafted_by, fallback_reason, draft }, or null. Pure.
function draftFromRows(rows, certificateId, kind) {
  var row = rows.filter(function (r) { return r.certificate_id === certificateId && r.kind === kind; })[0];
  if (!row) return null;
  var draft = null;
  if (row.drafted_by === 'AI') {
    try {
      draft = { opening: row.opening, explanations: JSON.parse(row.explanations_json || '[]') };
    } catch (err) {
      draft = null;
    }
  }
  return { drafted_by: row.drafted_by, fallback_reason: row.fallback_reason, draft: draft };
}

function findDraft(store, certificateId, kind) {
  return draftFromRows(draftRows(store), certificateId, kind);
}

// The model wording to show, or null for the template.
// Stored rows pass the same text and ID checks before display or send.
function usableDraft(found, deficiencies) {
  if (!found || found.drafted_by !== 'AI' || !found.draft) return null;
  return checkDraft(found.draft, draftIds(deficiencies)).ok ? found.draft : null;
}

// fields = { record_id, certificate_id, kind, drafted_by, fallback_reason, draft, call_id }. Writes once per
// certificate and kind: a second call for the same pair changes nothing. Call only inside withScriptLock.
function storeDraft(store, now, fields) {
  if (findDraft(store, fields.certificate_id, fields.kind)) return;
  store.appendRow('ai_drafts', {
    draft_id: nextId(store, 'ai_drafts', 'draft_id', 'DRF-'), record_id: fields.record_id, certificate_id: fields.certificate_id,
    kind: fields.kind, drafted_by: fields.drafted_by, fallback_reason: fields.fallback_reason || '',
    opening: fields.draft ? fields.draft.opening : '',
    explanations_json: fields.draft ? JSON.stringify(fields.draft.explanations) : '',
    call_id: fields.call_id || '', time: now
  });
}

// --- Wiring: the upload job drafts, the reject reads what was stored ---

// Drafts are on unless Script Property AI_DRAFTS is "off" (docs/decisions.md, Phase 6). Off forces the template.
function aiDraftsOn() {
  var v = PropertiesService.getScriptProperties().getProperty(PROP_AI_DRAFTS);
  return String(v == null ? '' : v).trim().toLowerCase() !== 'off';
}

// For a certificate that just landed in stage deficiency: draft both messages once and store them, AI or
// Template with the reason. The model call runs outside the lock; the rows are written under it.
// In Share Proj, or with no drafter in deps, it calls nothing, writes nothing and returns null.
function ensureDrafts(deps, recordId, cert) {
  if (!deps.drafter || isDemoMode()) return null;
  var deficiencies = cert.check.deficiencies;
  var on = aiDraftsOn();
  var made = {};
  Object.keys(DRAFT_AUDIENCE).forEach(function (kind) {
    if (findDraft(deps.store, cert.id, kind)) return;
    made[kind] = on ? deps.drafter.draft(DRAFT_AUDIENCE[kind], deficiencies)
      : { draft: null, reason: 'AI drafts are off (Script Property ' + PROP_AI_DRAFTS + ').', usage: null, skipped: true };
  });
  // One ai_calls row per model call that came back with usage (recordAiCall takes the lock itself). A skipped
  // draft or a request that failed outright has no usage and writes none.
  Object.keys(made).forEach(function (kind) {
    var m = made[kind];
    m.call_id = '';
    if (m.skipped || !m.usage) return;
    try {
      m.call_id = recordAiCall(deps.store, deps.clock, deps.newToken, GEMINI_MODEL, m.usage, {
        purpose: 'draft', record_id: recordId, certificate_id: cert.id,
        outcome: m.draft ? 'ok' : 'rejected', outcome_reason: m.reason
      });
    } catch (err) { console.log('The ai_calls row was not written. ' + String(err && err.message ? err.message : err)); }
  });
  withScriptLock(function () {
    Object.keys(made).forEach(function (kind) {
      var m = made[kind];
      storeDraft(deps.store, deps.clock.now(), {
        record_id: recordId, certificate_id: cert.id, kind: kind, call_id: m.call_id,
        drafted_by: m.draft ? 'AI' : 'Template', fallback_reason: m.reason, draft: m.draft
      });
    });
  });
  return {
    deficiency_notice: findDraft(deps.store, cert.id, 'deficiency_notice'),
    correction_request: findDraft(deps.store, cert.id, 'correction_request')
  };
}

// The effects with the text of one message swapped. nextStatus stays pure and emits the template text;
// the effect whose text is exactly that template is the one to swap.
function replaceEffectText(effects, template, text) {
  return effects.map(function (e) { return e.text === template ? Object.assign({}, e, { text: text }) : e; });
}

// Upload job, after the save and before sendEffects. When the deficiency email is about to go, draft both
// messages (once) and send the drafted notice. Any failure here sends the template: the email always goes.
function withDeficiencyDraft(deps, recordId, record, effects, recordLink) {
  var cert = record.pending;
  if (!cert || cert.stage !== 'deficiency' || !cert.check) return effects;
  var deficiencies = cert.check.deficiencies;
  var template = assembleDeficiencyNotice(record.sub.name, deficiencies, null, recordLink);
  if (!effects.some(function (e) { return e.text === template; })) return effects;
  var stored;
  try { stored = ensureDrafts(deps, recordId, cert); } catch (err) { stored = null; }
  var draft = stored && aiDraftsOn() ? usableDraft(stored.deficiency_notice, deficiencies) : null;
  if (!draft) return effects;
  return replaceEffectText(effects, template, assembleDeficiencyNotice(record.sub.name, deficiencies, draft, recordLink));
}

// The preview and send path use the same stored wording. Off forces the template. No model call.
function correctionRequestText(store, cert, uploadLink) {
  if (!cert || !cert.check) return '';
  var deficiencies = cert.check.deficiencies;
  var draft = usableDraft(findDraft(store, cert.id, 'correction_request'), deficiencies);
  if (draft && !aiDraftsOn()) draft = null;
  return assembleCorrectionRequest(deficiencies, draft, uploadLink);
}

// Reject, before sendEffects: use the same text as the approval preview. No model call.
function withCorrectionDraft(store, cert, effects, uploadLink) {
  if (!cert || !cert.check) return effects;
  return replaceEffectText(effects, correctionText(cert.check.deficiencies, uploadLink), correctionRequestText(store, cert, uploadLink));
}
