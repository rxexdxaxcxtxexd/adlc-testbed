// Real adapters: the only code that calls Google services. Fakes.gs has the same interfaces.

// Store: Sheet tabs in one spreadsheet, files in the Drive tree under My Drive.
function SheetStore(spreadsheetId) {
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var tz = Session.getScriptTimeZone();

  // Sheets turns ISO text into Dates; turn them back so the core only sees strings.
  // Many cells share a time, so each time is formatted once.
  var formatted = {};
  function cell(v) {
    if (!(v instanceof Date)) return v;
    var key = v.getTime();
    if (formatted[key] === undefined) {
      var isMidnight = v.getHours() === 0 && v.getMinutes() === 0 && v.getSeconds() === 0;
      formatted[key] = Utilities.formatDate(v, tz, isMidnight ? 'yyyy-MM-dd' : "yyyy-MM-dd'T'HH:mm:ss");
    }
    return formatted[key];
  }

  function sheet(tab) {
    var s = ss.getSheetByName(tab);
    if (!s) throw new Error('No Sheet tab named ' + tab + '. Run setupDemo first.');
    return s;
  }

  function folderAt(path) {
    var folder = DriveApp.getRootFolder();
    path.split('/').forEach(function (name) {
      var it = folder.getFoldersByName(name);
      folder = it.hasNext() ? it.next() : folder.createFolder(name);
    });
    return folder;
  }

  return {
    ensureTab: function (name, columns) {
      var existing = ss.getSheetByName(name);
      if (existing) {
        // An older tab gains any column added since it was built.
        var have = existing.getRange(1, 1, 1, existing.getLastColumn()).getValues()[0];
        columns.filter(function (c) { return have.indexOf(c) < 0; }).forEach(function (c, i) {
          existing.getRange(1, have.length + i + 1).setValue(c).setFontWeight('bold');
        });
        return;
      }
      var s = ss.insertSheet(name);
      s.getRange(1, 1, 1, columns.length).setValues([columns]).setFontWeight('bold');
      s.setFrozenRows(1);
    },
    ensureFolder: function (path) { folderAt(path); },
    writeFile: function (folderPath, name, content, mimeType) {
      var folder = folderAt(folderPath);
      var old = folder.getFilesByName(name);
      while (old.hasNext()) old.next().setTrashed(true);
      return folder.createFile(name, content, mimeType).getUrl();
    },
    writeBlob: function (folderPath, name, base64, mimeType) {
      var blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, name);
      return folderAt(folderPath).createFile(blob).getUrl();
    },
    readRows: function (tab) {
      var values = sheet(tab).getDataRange().getValues();
      var header = values.shift();
      return values.map(function (row) {
        var o = {};
        header.forEach(function (c, i) { o[c] = cell(row[i]); });
        return o;
      });
    },
    appendRow: function (tab, row) {
      var s = sheet(tab);
      var header = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
      s.appendRow(header.map(function (c) { return row[c] === undefined ? '' : row[c]; }));
    },
    appendRows: function (tab, rows) {
      if (!rows.length) return;
      var s = sheet(tab);
      var header = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
      var values = rows.map(function (row) {
        return header.map(function (column) { return row[column] === undefined ? '' : row[column]; });
      });
      s.getRange(s.getLastRow() + 1, 1, values.length, header.length).setValues(values);
    },
    updateRow: function (tab, keyColumn, keyValue, patch) {
      var s = sheet(tab);
      var values = s.getDataRange().getValues();
      var header = values[0];
      var key = header.indexOf(keyColumn);
      for (var i = 1; i < values.length; i++) {
        if (cell(values[i][key]) !== keyValue) continue;
        var row = header.map(function (c, j) { return patch[c] === undefined ? values[i][j] : patch[c]; });
        s.getRange(i + 1, 1, 1, header.length).setValues([row]);
        return;
      }
      throw new Error('No ' + tab + ' row with ' + keyColumn + ' = ' + keyValue);
    }
  };
}

// Reader: sends the PDF inline to Gemini and turns the reply into a reading.
// file = { name, fingerprint, link }. The PDF itself is fetched from the Drive link.

// Drive file IDs appear in the link as /d/<id>/ or as ?id=<id>.
function driveFileIdFromLink(link) {
  var m = /\/d\/([\w-]+)/.exec(link || '') || /[?&]id=([\w-]+)/.exec(link || '');
  if (!m) throw new Error('No Drive file ID in link: ' + link);
  return m[1];
}

// The one place that knows the request shape. If Google moves to a new API, change this.
function buildModelRequest(base64Pdf) {
  return {
    url: 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent',
    body: {
      contents: [{ parts: [
        { inline_data: { mime_type: 'application/pdf', data: base64Pdf } },
        { text: EXTRACTION_PROMPT }
      ] }],
      generationConfig: { temperature: 0, responseMimeType: 'application/json', responseJsonSchema: EXTRACTION_SCHEMA }
    }
  };
}

// loadBytes(file) -> PDF bytes. send({ url, body }) -> { status, text }. encode(bytes) -> base64.
// Real versions are in GeminiReader; tests pass fakes.
// Every reading carries reading.usage, the reply's usageMetadata, for metering. A 400 carries zero tokens.
function buildReader(loadBytes, send, encode) {
  return {
    read: function (file) {
      var res = send(buildModelRequest(encode(loadBytes(file))));
      if (res.status === 400 && /API key/i.test(res.text)) throw new Error('Gemini rejected the API key. Check Script Property ' + PROP_GEMINI_API_KEY + '.');
      if (res.status === 400) {
        return Object.assign(unreadableReading('The model service rejected the file (HTTP 400).'),
          { usage: { promptTokenCount: 0, candidatesTokenCount: 0, thoughtsTokenCount: 0 } });
      }
      if (res.status !== 200) throw new Error('Gemini request failed (HTTP ' + res.status + '): ' + String(res.text).slice(0, 200));
      var reply = JSON.parse(res.text);
      var usage = reply.usageMetadata || {};
      var candidates = reply.candidates;
      var parts = candidates && candidates[0] && candidates[0].content && candidates[0].content.parts;
      if (!parts || !parts.length || typeof parts[0].text !== 'string') return Object.assign(unreadableReading('The model returned no answer.'), { usage: usage });
      return Object.assign(parseExtraction(parts[0].text), { usage: usage });
    }
  };
}

function GeminiReader() {
  var key = PropertiesService.getScriptProperties().getProperty(PROP_GEMINI_API_KEY);
  return buildReader(
    function (file) { return DriveApp.getFileById(driveFileIdFromLink(file.link)).getBlob().getBytes(); },
    function (request) {
      if (!key) throw new Error('Script Property ' + PROP_GEMINI_API_KEY + ' is not set. Run the setup wizard.');
      var res = UrlFetchApp.fetch(request.url, {
        method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': key },
        payload: JSON.stringify(request.body), muteHttpExceptions: true
      });
      return { status: res.getResponseCode(), text: res.getContentText() };
    },
    function (bytes) { return Utilities.base64Encode(bytes); }
  );
}

// Drafter: asks Gemini for the wording of a deficiency notice or a correction request (src/Draft.gs).
// The model gets only the audience and each deficiency's id, kind and field label.
function buildDraftRequest(audience, deficiencies) {
  return {
    url: 'https://generativelanguage.googleapis.com/v1beta/models/' + GEMINI_MODEL + ':generateContent',
    body: {
      contents: [{ parts: [
        { text: DRAFT_PROMPT.replace('{audience}', audience) },
        { text: JSON.stringify(draftInput(audience, deficiencies)) }
      ] }],
      generationConfig: { temperature: 0.3, responseMimeType: 'application/json', responseJsonSchema: DRAFT_SCHEMA }
    }
  };
}

// send({ url, body }) -> { status, text }. draft() returns { draft, reason, usage }: draft is null when
// the call failed or the reply broke a rule, and reason says why. usage is Gemini's usageMetadata, or null.
// It never throws, so a failed draft never stops the upload job: the template goes instead.
function buildDrafter(send) {
  return {
    draft: function (audience, deficiencies) {
      var usage = null;
      function none(reason) { return { draft: null, reason: reason, usage: usage }; }
      try {
        var res = send(buildDraftRequest(audience, deficiencies));
        if (res.status !== 200) return none('The model service failed (HTTP ' + res.status + ').');
        var body;
        try { body = JSON.parse(res.text); } catch (err) { return none('The model reply was not valid JSON.'); }
        usage = body.usageMetadata || null;
        var parts = body.candidates && body.candidates[0] && body.candidates[0].content && body.candidates[0].content.parts;
        if (!parts || !parts.length || typeof parts[0].text !== 'string') return none('The model returned no answer.');
        var reply;
        try { reply = JSON.parse(parts[0].text); } catch (err) { return none('The model reply was not valid JSON.'); }
        var check = checkDraft(reply, draftIds(deficiencies));
        if (!check.ok) return none('Draft rejected: ' + check.reason + '.');
        var draft = {
          opening: reply.opening,
          explanations: reply.explanations.map(function (e) { return { id: e.id, text: e.text }; })
        };
        return { draft: draft, reason: '', usage: usage };
      } catch (err) {
        return none(String(err && err.message ? err.message : err));
      }
    }
  };
}

function GeminiDrafter() {
  var key = PropertiesService.getScriptProperties().getProperty(PROP_GEMINI_API_KEY);
  return buildDrafter(function (request) {
    if (!key) throw new Error('Script Property ' + PROP_GEMINI_API_KEY + ' is not set.');
    var res = UrlFetchApp.fetch(request.url, {
      method: 'post', contentType: 'application/json', headers: { 'x-goog-api-key': key },
      payload: JSON.stringify(request.body), muteHttpExceptions: true
    });
    return { status: res.getResponseCode(), text: res.getContentText() };
  });
}

// Mailer: plain-text email from the owner's account.
function GmailMailer() {
  return { send: function (to, subject, body) { MailApp.sendEmail(to, subject, body); } };
}

// Calendar: all-day events on the owner's default calendar. Noon is used so the day holds
// whichever zone the calendar reads the date in.
function GoogleCalendar() {
  return {
    createAllDay: function (title, isoDate) {
      var p = isoDate.split('-');
      var day = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]), 12, 0, 0);
      return CalendarApp.getDefaultCalendar().createAllDayEvent(title, day).getId();
    },
    deleteEvent: function (eventId) {
      var event = CalendarApp.getDefaultCalendar().getEventById(eventId);
      if (event) event.deleteEvent();
    }
  };
}

// Cursor: the daily job's saved place, kept in Script Properties as JSON.
function ScriptCursor() {
  var props = PropertiesService.getScriptProperties();
  return {
    get: function () {
      var raw = props.getProperty(PROP_DAILY_CURSOR);
      return raw ? JSON.parse(raw) : null;
    },
    set: function (cursor) { props.setProperty(PROP_DAILY_CURSOR, JSON.stringify(cursor)); },
    clear: function () { props.deleteProperty(PROP_DAILY_CURSOR); }
  };
}

// Timers: the one-off timers that continue a daily pass. Each one fires once and is deleted by the next run.
function ScriptTimers() {
  return {
    scheduleContinuation: function (ms) { ScriptApp.newTrigger('continueDailyJob').timeBased().after(ms).create(); },
    clearContinuations: function () {
      ScriptApp.getProjectTriggers().forEach(function (t) {
        if (t.getHandlerFunction() === 'continueDailyJob') ScriptApp.deleteTrigger(t);
      });
    }
  };
}

// Clock: today and now in the script time zone.
function ScriptClock() {
  var tz = Session.getScriptTimeZone();
  return {
    today: function () { return Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'); },
    now: function () { return Utilities.formatDate(new Date(), tz, "yyyy-MM-dd'T'HH:mm:ss"); }
  };
}
