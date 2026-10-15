// Metering: one ai_calls row per model call (docs/decisions.md, Phase 6). Code counts the tokens and the cost.

// usage = Gemini usageMetadata. Returns the call row without time and IDs. Pure.
// Thinking tokens bill at the output rate. A model with no MODEL_PRICES row gives cost_usd null, never 0.
function meterCall(model, usage, purpose) {
  var u = usage || {};
  var price = MODEL_PRICES[model];
  var input = u.promptTokenCount || 0;
  var output = u.candidatesTokenCount || 0;
  var thinking = u.thoughtsTokenCount || 0;
  return {
    purpose: purpose, model: model,
    input_tokens: input, output_tokens: output, thinking_tokens: thinking,
    cost_usd: price ? (input * price.input_per_m + (output + thinking) * price.output_per_m) / 1e6 : null
  };
}

// Appends one ai_calls row and returns its call_id. newId() gives the ID (Utilities.getUuid in production).
// meta = { purpose, record_id, certificate_id, outcome, outcome_reason }. Share Proj writes nothing and returns ''.
// Takes the script lock, so call it outside withScriptLock.
function recordAiCall(store, clock, newId, model, usage, meta) {
  if (isDemoMode()) return '';
  var m = meta || {};
  var call = meterCall(model, usage, m.purpose);
  return withScriptLock(function () {
    var callId = newId();
    store.appendRow('ai_calls', {
      call_id: callId, time: clock.now(), purpose: call.purpose, model: call.model,
      record_id: m.record_id || '', certificate_id: m.certificate_id || '',
      input_tokens: call.input_tokens, output_tokens: call.output_tokens, thinking_tokens: call.thinking_tokens,
      cost_usd: call.cost_usd === null ? '' : call.cost_usd,
      outcome: m.outcome || '', outcome_reason: m.outcome_reason || ''
    });
    return callId;
  });
}
