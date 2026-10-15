// Public app seams. Literal outcomes cover controls, portfolio figures and the ROI floor.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {loadGsRaw, plain} = require('./load-gs');
const LockService = {getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})};
// Demo Proj: demo mode off, so a correction may write a calibration sample.
const PropertiesService = {getScriptProperties:()=>({getProperty:k=>k==='DEMO_MODE'?'off':null})};
const c = loadGsRaw(['FakeStore','FakeClock','FakeMailer','FakeCalendar','initProject','seedDemoPortfolio','demoPortfolioRows',
  'portfolioView','paymentHoldList','worklistView','appData','reviewAction','recordDetail','roiLines','ROI_INPUTS'],{LockService,PropertiesService});
function setup() {
  let sequence=0;
  const deps={store:c.FakeStore(),clock:c.FakeClock('2026-10-08','2026-10-08T10:00:00'),mailer:c.FakeMailer(),
    calendar:c.FakeCalendar(),newToken:()=> 'token-'+(++sequence),encodePdf:text=>Buffer.from(text).toString('base64'),
    uploadBaseUrl:'https://example.test/upload'};
  c.initProject(deps.store); assert.equal(c.seedDemoPortfolio(deps).ok,true); return deps;
}
test('four projects have 140 unique records; Maple has 32 of 35 compliant and one expired bill',()=>{
  const deps=setup(), view=plain(c.portfolioView(deps)), maple=view.projects[0];
  assert.equal(view.projects.length,4);
  assert.deepEqual([maple.compliant_count,maple.expected_count,maple.expired_count,maple.below_limits_count,maple.dollars_on_hold_usd,maple.word],
    [32,35,1,1,6250,'At risk']);
  assert.deepEqual(view.projects.map(p=>p.word),['At risk','Watch','At risk','On track']);
  assert.deepEqual(view.totals,{expected_count:140,compliant_count:135,expired_count:1,expiring_30d_count:1,below_limits_count:1,dollars_on_hold_usd:9050});
  const rows=plain(deps.store.readRows('compliance_records'));
  assert.equal(new Set(rows.map(r=>r.record_id)).size,140);
  assert.ok(rows.every(r=>/^REC-\d{3}$/.test(r.record_id)));
  assert.equal(deps.mailer.sent().length,0);
  assert.equal(deps.calendar.events().length,0);
  const before=plain(deps.store.snapshot());
  assert.equal(c.seedDemoPortfolio(deps).ok,false);
  assert.deepEqual(plain(deps.store.snapshot()),before);
});
test('tile and hold list use the same amount, source and newest held-record timestamp',()=>{
  const deps=setup();
  deps.store.updateRow('compliance_records','record_id','REC-003',{last_updated:'2026-10-08T10:10:00'});
  deps.store.updateRow('compliance_records','record_id','REC-014',{last_updated:'2026-10-08T10:30:00'});
  const tile=c.portfolioView(deps).projects[0], holds=c.paymentHoldList(deps,'PRJ-001');
  assert.equal(tile.dollars_on_hold_usd,6250); assert.equal(holds.total_usd,6250);
  assert.equal(tile.hold_source,holds.source);
  assert.equal(tile.last_updated.dollars_on_hold_usd,'2026-10-08T10:10:00');
  assert.equal(tile.last_updated.dollars_on_hold_usd,holds.last_updated);
});
test('a correction without a note changes no rows and sends no email',()=>{
  const deps=setup(), detail=c.recordDetail(deps,'REC-014'), before=plain(deps.store.snapshot());
  const values=plain(detail.values); values.limits.commercial_liability=1000000;
  assert.deepEqual(plain(c.reviewAction(deps,'REC-014','accountant','correct',{values,note:' '})),
    {ok:false,message:'A correction needs a note. Write what you changed and why.'});
  assert.deepEqual(plain(deps.store.snapshot()),before);
  assert.equal(deps.mailer.sent().length,0);
});
test('Brightway can be corrected at 96% confidence, logs old/new/note, then requires approval',()=>{
  const deps=setup(), detail=c.recordDetail(deps,'REC-014');
  assert.equal(detail.confidence,0.96);
  const values=plain(detail.values); values.limits.commercial_liability=1000000;
  assert.equal(c.reviewAction(deps,'REC-014','accountant','correct',{values,note:'Misread on page 1.'}).ok,true);
  const corrected=c.recordDetail(deps,'REC-014');
  assert.equal(corrected.next,'approve');
  assert.equal(corrected.timeline[1].event_type,'reading_confirmed');
  assert.ok(corrected.timeline.some(t=>t.who==='Dana Reyes (Accountant)' &&
    t.summary==='Changed General liability from $2,000,000 to $1,000,000 on CERT-014. Note: Misread on page 1. Added to the test set.'));
  assert.deepEqual(plain(deps.store.readRows('calibration_samples')).map(r=>[r.sample_id,r.record_id,r.active]),[['SMP-CERT-014','REC-014',true]]);
  assert.equal(deps.mailer.sent().length,0);
  assert.equal(c.reviewAction(deps,'REC-014','accountant','approve',{}).ok,true);
  assert.equal(c.recordDetail(deps,'REC-014').next,null);
  assert.equal(c.recordDetail(deps,'REC-014').values.limits.commercial_liability,1000000);
  assert.equal(deps.mailer.sent().length,2);
});
test('Ridgeline rejection names both found and required values and returns to awaiting',()=>{
  const deps=setup();
  const detail=c.recordDetail(deps,'REC-001');
  assert.equal(detail.rejection_text,
    'Your certificate does not meet the project requirements. Please send a corrected certificate.\n'+
    '- Umbrella: $1,000,000 shown, $2,000,000 required\n'+
    '- Insured name: certificate shows Ridgeline Roofing Partners LLC; must read Ridgeline Roofing LLC\n'+
    'Upload it here: https://example.test/upload?t=token-1');
  assert.equal(c.reviewAction(deps,'REC-001','project_manager','reject',{}).ok,true);
  assert.equal(c.recordDetail(deps,'REC-001').status,'Awaiting certificate');
});
test('low-confidence and unreadable records wait for the accountant; an expired record stays held',()=>{
  const deps=setup();
  assert.deepEqual([c.recordDetail(deps,'REC-037').status,c.recordDetail(deps,'REC-037').next],['Needs review','correct']);
  assert.deepEqual([c.recordDetail(deps,'REC-038').waiting,c.recordDetail(deps,'REC-038').next],['Unreadable file','resend']);
  assert.deepEqual(plain(c.recordDetail(deps,'REC-003').hold_reasons),['Policy expired']);
  assert.deepEqual(plain(c.recordDetail(deps,'REC-071').hold_reasons),['No W-9 on file']);
  assert.equal(c.reviewAction(deps,'REC-071','accountant','w9',{onFile:true}).ok,true);
  assert.equal(c.paymentHoldList(deps,'PRJ-003').total_usd,0);
});
test('every attached sample PDF prints its banner; Brightway PDF prints the correct value',()=>{
  const deps=setup(), files=plain(deps.store.snapshot().files).filter(f=>f.mimeType==='application/pdf');
  assert.equal(files.length,7);
  for (const f of files) {
    const pdf=Buffer.from(f.content.slice(7),'base64').toString();
    assert.ok(pdf.startsWith('%PDF-1.4\n'));
    assert.ok(pdf.endsWith('%%EOF\n'));
    assert.ok(pdf.includes('SAMPLE: fictional certificate'));
  }
  const brightway=files.find(f=>f.path.endsWith('/CERT-014.pdf'));
  const text=Buffer.from(brightway.content.slice(7),'base64').toString();
  assert.ok(text.includes('General liability: $1,000,000'));
  assert.ok(!text.includes('General liability: $2,000,000'));
});
test('ROI uses literal annual outcomes and the least favourable input values for the floor',()=>{
  const r=plain(c.roiLines(c.ROI_INPUTS));
  assert.deepEqual([r.net.low,r.net.likely,r.net.high],[518.67,5284.47,21933.06]);
  assert.deepEqual(r.lines.filter(l=>['api_cost_usd','upkeep_cost_usd','running_cost_usd'].includes(l.key)).map(l=>[l.key,l.low,l.likely,l.high]),
    [['api_cost_usd',1.33,0.53,0.27],['upkeep_cost_usd',360,240,150],['running_cost_usd',361.33,240.53,150.27]]);
});
test('missing ROI value, basis, invalid number or placeholder hides affected lines and names the input',()=>{
  for (const change of [v=>delete v.low,v=>delete v.basis,v=>v.likely=NaN,v=>v.basis='estimate: placeholder']) {
    const input=plain(c.ROI_INPUTS); change(input.inputs.min_per_cert_today);
    const r=plain(c.roiLines(input));
    assert.equal(r.lines[0].likely,null);
    assert.deepEqual(r.lines[0].missing,['min_per_cert_today']);
    assert.equal(r.net.low,null); assert.equal(r.lines[1].likely,1125);
  }
});
test('deployed ROI inputs match the documented inputs',()=>{
  const file=JSON.parse(fs.readFileSync(path.join(__dirname,'../docs/roi-inputs.json'),'utf8'));
  assert.deepEqual(plain(c.ROI_INPUTS),file);
});

test('receipt progress waits, reports an unreadable result and refuses another token',()=>{
  const x=loadGsRaw(['acceptUpload','uploadProgress','processNextUpload','FakeReader'],{LockService});
  const deps=setup(), token='token-2';
  const accepted=x.acceptUpload(deps,token,{name:'sample.pdf',size:20,header:'%PDF-',fingerprint:'new-pdf',base64:'JVBERi0='});
  assert.equal(accepted.ok,true);
  assert.deepEqual(plain(x.uploadProgress(deps,token,accepted.upload_id)),
    {state:'waiting',complete:false,message:'Your file is saved. Waiting for the certificate check.'});
  assert.deepEqual(plain(x.uploadProgress(deps,'token-1',accepted.upload_id)),
    {state:'inactive',complete:true,message:'This upload receipt is not active. Contact the project team.'});
  deps.reader=x.FakeReader({readable:false,confidence:0,values:null});
  x.processNextUpload(deps);
  assert.deepEqual(plain(x.uploadProgress(deps,token,accepted.upload_id)),
    {state:'unreadable',complete:true,message:'The certificate could not be read. Please resend a readable standard PDF.'});
});
test('receipt progress reports approval waiting and a failed check without exposing raw errors',()=>{
  const x=loadGsRaw(['acceptUpload','uploadProgress','processNextUpload','FakeReader','SAMPLE_READING'],{LockService});
  const deps=setup(), token='token-2';
  const result=x.acceptUpload(deps,token,{name:'sample.pdf',size:20,header:'%PDF-',fingerprint:'new-pdf',base64:'JVBERi0='});
  const reading=plain(x.SAMPLE_READING);reading.values.insured_name='Copper Hollow Electric Inc.';
  deps.reader=x.FakeReader(reading);x.processNextUpload(deps);
  assert.deepEqual(plain(x.uploadProgress(deps,token,result.upload_id)),
    {state:'approval',complete:true,message:'The certificate was read. It is waiting for the accountant to approve.'});
  deps.store.updateRow('uploads','upload_id',result.upload_id,{processed:'failed',last_error:'private error'});
  assert.deepEqual(plain(x.uploadProgress(deps,token,result.upload_id)),
    {state:'failed',complete:true,message:'The certificate check could not finish. Contact the project team for help. Your file is saved.'});
});
test('a below-threshold confidence stays visibly below 85%',()=>{
  const deps=setup();
  deps.store.updateRow('certificates','certificate_id','CERT-037',{confidence:0.849});
  assert.equal(c.recordDetail(deps,'REC-037').confidence_label,'84.9%');
  deps.store.updateRow('certificates','certificate_id','CERT-037',{confidence:0.849999});
  assert.equal(c.recordDetail(deps,'REC-037').confidence_label,'84.99%');
});
test('portfolio data reads each Sheet tab once per request',()=>{
  const deps=setup(), original=deps.store, counts={};
  deps.store={readRows:tab=>{counts[tab]=(counts[tab]||0)+1;return original.readRows(tab);}};
  c.portfolioView(deps);
  assert.deepEqual(counts,{projects:1,compliance_records:1,subcontractors:1,certificates:1,pay_applications:1});
});
test('a negative time saving uses the higher staff rate for the lower net value',()=>{
  const input=plain(c.ROI_INPUTS);
  for (const key of ['min_per_cert_today','monthly_check_min_today','hours_per_audit_today','lapses_paid_per_year']) {
    input.inputs[key].low=0;input.inputs[key].likely=0;input.inputs[key].high=0;
  }
  const r=plain(c.roiLines(input));
  assert.deepEqual([r.net.low,r.net.likely,r.net.high],[-6318,-1653.86,-450.27]);
  // Floor: -$5,266.67 staff time, -$450 audit prep and $601.33 running cost.
});

test('confirming an unchanged reading names the person and labels the reading Confirmed',()=>{
  const deps=setup(), values=plain(c.recordDetail(deps,'REC-037').values);
  const out=c.reviewAction(deps,'REC-037','accountant','correct',{values,note:'Every value matches the certificate.'});
  assert.equal(out.ok,true);
  const detail=c.recordDetail(deps,'REC-037');
  assert.equal(detail.reading_confirmed_by,'Dana Reyes (Accountant)');
  assert.equal(detail.confidence_label,'Confirmed');
  assert.ok(detail.timeline.some(t=>t.summary==='Confirmed the reading of CERT-037 with no changes. Note: Every value matches the certificate.'));
});
test('one app data call gives each project the same worklist and hold list as its own call',()=>{
  const deps=setup(), data=plain(c.appData(deps));
  assert.equal(data.worklist.rows.length,140);
  data.portfolio.projects.forEach(p=>{
    const own=plain(c.worklistView(deps,p.project_id));
    assert.deepEqual(data.worklist.rows.filter(r=>r.project_id===p.project_id),own.rows);
    assert.deepEqual(data.holds[p.project_id],plain(c.paymentHoldList(deps,p.project_id)));
  });
  assert.equal(data.holds.all.total_usd,9050);
});

test('the ROI page is hidden: the nav order has no roi screen and no route title for it',()=>{
  const client=fs.readFileSync(path.join(__dirname,'../src/AppClient.html'),'utf8');
  const order=/var ORDER = (\[[^\]]*\]);/.exec(client);
  assert.ok(order,'ORDER not found');
  assert.deepEqual(JSON.parse(order[1].replace(/'/g,'"')),['projects','dashboard','worklist','holds','directory','notifications']);
  assert.ok(!/name === 'roi' \?/.test(client),'unreachable ROI title branch');
});

// Ticket 20: the three new views. The client is one script with no DOM seam, so these read its text.
const clientText=()=>fs.readFileSync(path.join(__dirname,'../src/AppClient.html'),'utf8');
test('the new views are in the nav in order, with their screen names (Data trust is hidden)',()=>{
  assert.match(clientText(),/NAV_LABEL = \{[^}]*directory:'Subcontractors', notifications:'Notifications'\}/);
});
// Lane H: the Data trust screen is hidden, the same way ROI is. The code stays; no route reaches it.
test('nav has no trust entry and no route reaches it',()=>{
  const client=clientText().replace(/\r\n/g,'\n');
  assert.ok(!/var ORDER = \[[^\]]*'trust'/.test(client),'trust in ORDER');
  assert.ok(!/NAV_LABEL = \{[^}]*trust:/.test(client),'trust in NAV_LABEL');
  assert.ok(!/Data trust'\}/.test(client),'Data trust nav label');
  assert.ok(!/data-route="trust"|data-view="trust"|navigate\('trust'|go\('trust'/.test(client),'a link or call to the trust route');
  assert.ok(!/key === 'trust'/.test(client),'a trust shortcut');
  assert.match(client,/go: function \(name\)[\s\S]*?ORDER\.indexOf\(name\) >= 0\) navigate\(name\)/,'coiApp.go must gate on ORDER');
  const warm=/warm: function \(\) \{[\s\S]*?\n    \}/.exec(client);
  assert.ok(warm&&!/Trust/.test(warm[0]),'the tour warm-up fetches Data trust');
  const steps=fs.readFileSync(path.join(__dirname,'../src/TourSteps.html'),'utf8');
  assert.ok(!/view: *'trust'/.test(steps),'a tour step opens Data trust');
  // The view code, the server call and the AI cost strip are kept.
  assert.match(client,/function renderTrust\(/);
  assert.match(client,/function askTrust\(/);
  assert.match(client,/class="trust-ai"/);
});
test('each new view asks the server from one place, and the overlay goes last in each call',()=>{
  const client=clientText();
  for (const name of ['getDirectory','getTrustChecks','getNotifications']) {
    assert.ok(new RegExp(name+':0[,}]').test(client),name+' overlay position');
    assert.equal((client.match(new RegExp("rpc\\('"+name+"'","g"))||[]).length,1,name+' is called from one place');
  }
  const code=fs.readFileSync(path.join(__dirname,'../src/Code.gs'),'utf8').replace(/\r\n/g,'\n');
  assert.match(code,/function getDirectory\(overlay\) \{\n  return timed\('getDirectory', function \(\) \{ return directoryView\(readViewDeps\(pageDeps\(overlay\)\)\); \}\);/);
  assert.match(code,/function getTrustChecks\(overlay\) \{ return timed\('getTrustChecks', function \(\) \{ return trustView\(readViewDeps\(pageDeps\(overlay\)\)\); \}\); \}/);
});
test('the tour markers sit on the directory table and the notification list',()=>{
  const client=clientText();
  assert.equal((client.match(/data-tour="directory"/g)||[]).length,1);
  assert.equal((client.match(/data-tour="notifications"/g)||[]).length,1);
  assert.match(client,/class="surface table-box dir-box" data-tour="directory"/);
  assert.match(client,/class="surface note-list" data-tour="notifications"/);
});
test('the new views say Awaiting, show the Stored status check name, and have no send button',()=>{
  const client=clientText();
  assert.ok(!/Not received/.test(client));
  assert.match(client,/Stored status check/);
  assert.match(client,/Daily job last finished/);
  const notes=client.slice(client.indexOf('// Notifications: a read-only preview'),client.indexOf('// Keyboard:'));
  assert.ok(notes.length>1000);
  assert.ok(!/<button[^>]*>[^<]*Send/i.test(notes),'a send button');
  assert.match(client,/Preview\. These emails are drafted for review\.'/);
  assert.ok(!/Sample data|sample-pill/.test(client),'no Sample data flag');
  assert.ok(!/count-up|countUp|setInterval/.test(client.slice(client.indexOf('// Subcontractors, notifications and data trust'))));
});
test('the page script parses',()=>{
  const client=clientText();
  assert.doesNotThrow(()=>new Function(client.replace(/^\s*<script>/,'').replace(/<\/script>\s*$/,'')));
});
test('the directory carries the record behind each certificate and the newest record update',()=>{
  const x=loadGsRaw(['directoryView','directoryRows','FakeStore','FakeClock','initProject','seedDemoPortfolio','readViewDeps'],{LockService});
  const deps=setup(), view=plain(x.directoryView(deps)), brightway=view.rows.find(r=>r.company==='Brightway Electric Inc.');
  assert.deepEqual(brightway.record_ids,['REC-014']);
  assert.deepEqual(brightway.certificates.map(c=>c.record_id),['REC-014','REC-014']);
  assert.deepEqual(brightway.certificates.map(c=>c.certificate_id).sort(),['CERT-014','CERT-014-CURRENT']);
  assert.equal(view.last_updated,plain(deps.store.readRows('compliance_records')).map(r=>String(r.last_updated)).sort().pop());
  assert.equal(view.source,'subcontractors');
});

// Ticket B: the AI cost strip on Data trust. The client has no DOM seam, so the strip's own functions
// are cut out of the page script by name and run on their own.
function clientFunctions(names){
  const client=clientText();
  const src=names.map(name=>{
    const start=client.indexOf('function '+name+'(');
    assert.ok(start>=0,name+' not found');
    let depth=0,i=client.indexOf('{',start);
    for(;i<client.length;i++){ if(client[i]==='{')depth++; else if(client[i]==='}'&&--depth===0)break; }
    return client.slice(start,i+1);
  }).join('\n');
  return new Function(src+'\nreturn {'+names.join(',')+'};')();
}
const strip=()=>clientFunctions(['esc','date','stamp','sourceName','updated','aiMoney','aiCostStrip']);
const COST={month:'2026-10',ai_spend_month_usd:0.0504,ai_calls_month:40,ai_cost_per_certificate_usd:0.00126,price_unknown:false,source:'ai_calls',last_updated:'2026-10-08T09:30:00'};
test('the AI cost strip shows three facts with their source and updated time',()=>{
  const html=strip().aiCostStrip(COST);
  assert.match(html,/<h2>AI cost<\/h2>/);
  assert.match(html,/class="facts strip ai-strip"/);
  assert.match(html,/<dt>This month<\/dt><dd class="v">\$0\.05<\/dd>/);
  assert.match(html,/<dt>Calls this month<\/dt><dd class="v">40<\/dd>/);
  assert.match(html,/<dt>Per certificate<\/dt><dd class="v">\$0\.0013<\/dd>/);
  assert.match(html,/Updated Oct 8, 2026, 9:30 AM · Source: AI calls/);
});
test('the AI cost strip says "price unknown", never $0, and is left out when the Sheet has no ai_calls tab',()=>{
  const f=strip();
  const html=f.aiCostStrip({...COST,ai_spend_month_usd:null,ai_cost_per_certificate_usd:null,price_unknown:true});
  assert.match(html,/<dt>This month<\/dt><dd class="v">price unknown<\/dd>/);
  assert.match(html,/<dt>Per certificate<\/dt><dd class="v">price unknown<\/dd>/);
  assert.match(f.aiCostStrip({...COST,ai_spend_month_usd:0,ai_calls_month:0,ai_cost_per_certificate_usd:null,last_updated:''}),/<dt>Per certificate<\/dt><dd class="v">No reads yet<\/dd>/);
  assert.equal(f.aiCostStrip(null),'');
});
test('the strip sits under the stored status check and above expected vs. received',()=>{
  const client=clientText(), at=client.indexOf('aiCostStrip(data.ai_cost)');
  assert.ok(at>client.indexOf('aria-label="Stored status check"') && at<client.indexOf('aria-label="Expected vs. received"'));
});
