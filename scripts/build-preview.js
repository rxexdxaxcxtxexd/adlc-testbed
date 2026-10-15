// Build the local walkthrough from the deployed templates and the same server core.
// Run: node scripts/build-preview.js
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.join(__dirname, '..');
const OUT = process.env.PREVIEW_OUT || path.join(ROOT, 'docs/design/refined/app');
fs.mkdirSync(OUT, {recursive:true});
const read = (file) => fs.readFileSync(path.join(ROOT,file),'utf8').replace(/\r\n?/g,'\n');
const css = read('src/Styles.html');
fs.copyFileSync(path.join(ROOT,'test-fixtures/sample-cois/01-clean.pdf'),path.join(OUT,'sample-certificate.pdf'));
const core = fs.readdirSync(path.join(ROOT,'src')).filter(f=>f.endsWith('.gs')).sort().map(f=>read('src/'+f)).join('\n');
const adapter = '<script>\n'+core+'\n'+read('scripts/preview-adapter.js')+'\n</script>';
function replaceStyles(html) { return html.replace("<?!= include('Styles') ?>",css); }
let app = replaceStyles(read('src/Worklist.html'))
  .replace('<?!= initial ?>','{record:new URLSearchParams(location.search).get("record") || "",role:new URLSearchParams(location.search).get("as") || "",tour:new URLSearchParams(location.search).get("tour") === "play" ? "play" : ""}')
  .replace("<?!= include('AppClient') ?>",()=>adapter+'\n'+read('src/AppClient.html'))
  .replace("<?!= include('TourSteps') ?>",()=>read('src/TourSteps.html'))
  .replace("<?!= include('Tour') ?>",()=>read('src/Tour.html'))
  .replace('<main id="content"', '<div class="well notice" style="max-width:1344px;margin:16px auto 0"><strong>Local preview</strong> · Actions stay in this browser and reset on reload. Emails are kept in the preview. <a href="upload.html">Try the upload page</a> · <a href="components.html">Component states</a></div><main id="content"');
fs.writeFileSync(path.join(OUT,'index.html'),app);
let upload = replaceStyles(read('src/UploadPage.html'))
  .replace('<?!= token ?>','"preview-token-2"')
  .replace('<?!= demo ?>','false')
  .replace('<?!= info ?>','{open:new URLSearchParams(location.search).get("state")!=="inactive",subcontractor:"Copper Hollow Electric Inc.",project:"Maple Court Residences",message:"This upload link is not active. Contact the project team for a new one."}')
  .replace('<script>\nvar TOKEN',()=>adapter+'\n<script>\nvar TOKEN')
  .replace('<main class="upload-main">','<div class="well notice" style="max-width:640px;margin:16px auto 0">Local preview. Files stay in this browser. The reading result is simulated. <a href="sample-certificate.pdf" download>Download a sample PDF</a> · <a href="index.html">Back to the app</a></div><main class="upload-main">');
fs.writeFileSync(path.join(OUT,'upload.html'),upload);
const components = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Drafting components</title>'+css+'</head><body><header class="topbar"><div class="brand">HARBORLINE · DRAFTING</div><span class="sample">Sample data</span></header><main>'+
  '<div class="page-heading"><h1>Components and states</h1><a class="btn secondary" href="index.html">Open the app</a></div><div class="grid tiles">'+
  '<section class="panel"><div class="panel-title"><h2>Status words</h2></div><div class="panel-body tools">'+
  [['green','Compliant'],['green','On track'],['amber','Expiring soon'],['amber','Needs review'],['blue','In review'],['red','Expired'],['red','At risk'],['violet','Waived'],['neutral','Awaiting certificate']].map(([color,label])=>'<span class="badge '+color+'">'+label+'</span>').join('')+'</div></section>'+
  '<section class="panel"><div class="panel-title"><h2>Actions</h2></div><div class="panel-body tools"><button class="btn">Approve certificate</button><button class="btn secondary">Waive</button><button class="btn secondary">Reject</button><button class="btn" disabled>Saving…</button></div></section>'+
  '<section class="panel"><div class="panel-title"><h2>Fields</h2></div><div class="panel-body"><label class="field">Correction note<textarea>General liability corrected from the certificate.</textarea></label><label class="field">Review mode<select><option>Review all</option></select></label></div></section>'+
  '<section class="metric"><span class="stat-label">Dollars on hold</span><strong class="stat-value">$6,250</strong><span class="source">Source Pay applications · Compliance records<br>Updated Oct 8, 2026 · 10:00<br><span class="sample">Sample data</span></span></section>'+
  '<section class="loading">Loading certificates…</section><section class="empty"><h2>Nothing waiting</h2><p>The queue has no certificate waiting for a person.</p></section>'+
  '<section class="empty"><h2>The view could not load</h2><p>Please try again. Your saved records are kept.</p><button class="btn">Try again</button></section>'+
  '<section class="notice"><h2>Action refused</h2><p>A correction needs a note. Write what you changed and why.</p></section></div>'+
  '<section class="panel" style="margin-top:20px"><div class="panel-title"><h2>Try the real screen states</h2></div><div class="panel-body tools">'+
  [['index.html?state=loading','Loading'],['index.html?state=empty&as=leadership','Empty projects'],['index.html?state=error','Load error'],['index.html?state=roi-missing','Missing ROI input'],['upload.html?state=inactive','Inactive upload link']].map(([link,label])=>'<a class="btn secondary" href="'+link+'">'+label+'</a>').join('')+
  '</div></section></main></body></html>';
fs.writeFileSync(path.join(OUT,'components.html'),components);
console.log('Built the app, upload page and component states from src/.');
