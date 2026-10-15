// Finds Google services that deployed code calls without the permission listed in appsscript.json.
// Apps Script refuses such a call at run time, and no Node test can see it (ticket 04 retro).
const SERVICE_SCOPES = {
  ScriptApp: 'https://www.googleapis.com/auth/script.scriptapp',
  UrlFetchApp: 'https://www.googleapis.com/auth/script.external_request',
  MailApp: 'https://www.googleapis.com/auth/script.send_mail',
  SpreadsheetApp: 'https://www.googleapis.com/auth/spreadsheets',
  DriveApp: 'https://www.googleapis.com/auth/drive',
  CalendarApp: 'https://www.googleapis.com/auth/calendar',
};

// One entry per service whose scope is missing, with the first line that uses it.
function findMissingScopes(source, scopes) {
  const listed = new Set(scopes);
  const lines = source.split(/\r?\n/);
  const missing = [];
  for (const [service, scope] of Object.entries(SERVICE_SCOPES)) {
    if (listed.has(scope)) continue;
    const index = lines.findIndex((line) => !/^\s*\/\//.test(line) && new RegExp('\\b' + service + '\\b').test(line));
    if (index >= 0) missing.push({ line: index + 1, service, scope });
  }
  return missing;
}

module.exports = { findMissingScopes, SERVICE_SCOPES };
