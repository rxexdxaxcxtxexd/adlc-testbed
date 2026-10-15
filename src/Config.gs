// Settings. Secrets and IDs live in Script Properties, never here.

// The only place the model ID lives (docs/decisions.md, Phase 2). To switch models, change this line.
var GEMINI_MODEL = 'gemini-3.5-flash-lite';

// Google list price, USD per million tokens (docs/research/c4-gemini-api-cost.md). Thinking tokens bill at the
// output rate. A model with no row here has an unknown price: the screen says so and never shows $0.
var MODEL_PRICES = { 'gemini-3.5-flash-lite': { input_per_m: 0.30, output_per_m: 2.50 } };

// AI drafts of people-facing messages (docs/decisions.md, Phase 6). 'off' forces the template wording.
var PROP_AI_DRAFTS = 'AI_DRAFTS';

// Script Property names. The wizard sets GEMINI_API_KEY; setupDemo sets SHEET_ID.
var PROP_GEMINI_API_KEY = 'GEMINI_API_KEY';
var PROP_SHEET_ID = 'SHEET_ID';
// The public upload page address, used in resend emails (docs/decisions.md, Phase 3). The wizard sets it.
var PROP_UPLOAD_BASE_URL = 'UPLOAD_BASE_URL';

// The internal app address, used in the deficiency email to the project manager (docs/decisions.md, Phase 3). The wizard sets it.
var PROP_INTERNAL_BASE_URL = 'INTERNAL_BASE_URL';

// Demo mode (docs/decisions.md, Phase 5, ticket 14). The public app runs as the owner for anonymous
// visitors, so in demo mode no browser call writes, sends, reads with Gemini or creates a trigger.
// Only "off" or "false" turns it off. A missing or unknown value keeps it on (fail safe).
var PROP_DEMO_MODE = 'DEMO_MODE';

function demoModeFromValue(value) {
  var v = String(value == null ? '' : value).trim().toLowerCase();
  return v !== 'off' && v !== 'false';
}

// The one place the switch is read.
function isDemoMode() {
  return demoModeFromValue(PropertiesService.getScriptProperties().getProperty(PROP_DEMO_MODE));
}

// Daily job (docs/decisions.md, Phase 5, ticket 07): 10 records a run, the next run 60 seconds later, the daily timer at 6 AM.
var PROP_DAILY_CURSOR = 'DAILY_CURSOR';
var DAILY_BATCH_SIZE = 10;
var DAILY_RETRIGGER_MS = 60000;
var DAILY_HOUR = 6;

// Upload page and job (docs/decisions.md, Phase 2, ticket 04).
var MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
var MAX_UPLOAD_ATTEMPTS = 3;
