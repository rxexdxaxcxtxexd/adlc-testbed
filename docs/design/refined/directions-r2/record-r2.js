/* Direction studies use fictional data only. All actions stay in this page. */
(function () {
 'use strict';
 const data = window.STUDY_DATA;
 const esc = value => String(value == null ? '' : value).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 const usd = value => '$' + Number(value).toLocaleString('en-US');
 const clone = value => JSON.parse(JSON.stringify(value));
 const roles = {accountant:'Accountant',project_manager:'Project manager',leadership:'Leadership'};
 const people = {accountant:'Dana Reyes',project_manager:'Marcus Webb',leadership:'Elena Park'};
 const paths = {
  check:'M4 8l3 3 5-6', cross:'M4 4l8 8M12 4l-8 8', back:'M10 3L5 8l5 5',
  doc:'M4 2h5l3 3v9H4V2Zm5 0v4h3', ring:'M8 2a6 6 0 1 0 0 12A6 6 0 0 0 8 2Zm0 0v12',
  arrow:'M3 8h10M9 4l4 4-4 4'
 };
 const icon = name => '<svg class="icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+paths[name]+'"/></svg>';
 const tones = {'In review':'violet','Compliant':'green','Awaiting certificate':'blue','Needs review':'amber','Expired':'red','Expiring soon':'amber','Closed':'neutral'};
 let key='ridgeline', role='project_manager', records=clone(data.records), edit=false, busy=false, loadGeneration=0;
 let pendingNote='', formError='';
 const root=document.getElementById('app');
 const record=()=>records[key];
 const actor=()=>people[role]+' ('+roles[role]+')';
 const trust=(source,updated)=>'<p class="trust"><span>Source: '+esc(source)+'</span><span>Updated '+esc(updated)+'</span><span>Sample data</span></p>';
 const button=(action,label,kind)=>'<button type="button" class="button '+(kind||'secondary')+'" data-action="'+action+'"'+(busy?' disabled':'')+'>'+esc(label)+'</button>';
 function lines() {
  const r=record(),v=r.values;
  const result=[];
  data.limits.forEach(([k,label,min])=>{
   if(k==='pol'&&!r.pollution)return;
   const found=v[k], pass=found!=null&&(min==null||found>=min);
   result.push({key:k,label,found:found==null?'Not shown':usd(found),required:min==null?'Any amount':usd(min),pass,money:true,
    deficiency:label+': '+(found==null?'not shown':usd(found)+' shown')+', '+(min==null?'coverage required':usd(min)+' required')});
  });
  [['ai','Additional insured endorsement'],['addr','Project address'],['holder','Certificate holder']].forEach(([k,label])=>{
   const pass=v[k]===true;
   result.push({key:k,label,found:pass?'Printed':'Not printed',required:'Printed',pass,
    deficiency:label+': not shown; required'});
  });
  const pass=v.insuredName===r.name;
  result.push({key:'insuredName',label:'Insured name',found:pass?'Matches':'Does not match',required:'Matches',pass,
   sub:'On the certificate: '+v.insuredName+' · On the record: '+r.name,
   deficiency:'Insured name: certificate shows '+v.insuredName+'; must read '+r.name});
  result.push({key:'cancel',label:'Cancellation notice',found:v.cancel+' days',required:'30 days',pass:v.cancel>=30,
   deficiency:'Cancellation notice: '+v.cancel+' days shown, 30 days required'});
  return result;
 }
 const failures=()=>lines().filter(l=>!l.pass&&!record().waived);
 function mode() {
  if(edit)return role==='accountant'?'edit':'refused-edit';
  if(record().next==='decide')return role==='accountant'?'refused-decide':'decide';
  if(record().next==='approve')return role==='accountant'?'approve':'refused-approve';
  return 'none';
 }
 function chrome() {
  const nav=['Projects','Compliance dashboard','Worklist','Payment hold list','Return on investment'];
  return '<div class="brand">'+icon('doc')+'<div><strong>Certificate compliance</strong><span>'+esc(data.firm)+'</span></div></div>'+
   '<nav class="navigation" aria-label="Main">'+nav.map(label=>'<a href="#" data-navigation="'+label+'"'+(label==='Worklist'?' aria-current="page"':'')+'>'+label+'</a>').join('')+'</nav>'+
   '<div class="demo" aria-label="Demo only controls"><strong class="demo-label">Demo only</strong><label>View as <select id="role"'+(busy?' disabled':'')+'>'+Object.entries(roles).map(([k,v])=>'<option value="'+k+'"'+(role===k?' selected':'')+'>'+v+'</option>').join('')+'</select></label>'+
   '<label>Record <select id="record"'+(busy?' disabled':'')+'>'+Object.entries(records).map(([k,v])=>'<option value="'+k+'"'+(key===k?' selected':'')+'>'+v.name+'</option>').join('')+'</select></label>'+button('reset','Reset demo','text-button')+'</div>';
 }
 function header() {
  const r=record();
  return '<div class="header-top"><p class="eyebrow">Compliance record · '+r.scope+' · <span class="record-id">'+r.id+'</span></p><span class="sample">Sample data · all names fictional</span></div>'+
   '<h1>'+r.name+'</h1><p class="project-name">'+r.project+'</p>'+
   '<div class="head-state"><span class="status" data-tone="'+tones[r.status]+'">'+icon(r.status==='Compliant'?'check':'ring')+r.status+'</span><p class="waiting">'+r.waiting+'</p></div>'+
   '<dl class="facts"><div><dt>Current certificate</dt><dd>'+r.current+'</dd></div>'+(r.status==='In review'?'<div><dt>Certificate under review expires</dt><dd>'+r.expiry+'</dd></div>':'')+'<div><dt>Payment hold</dt><dd>Not on hold. No bill this pay cycle.</dd></div></dl>'+
   trust('Compliance records',r.updated);
 }
 function nextStep() {
  const r=record(), m=mode();
  const titles={decide:'Decide on the deficiencies',approve:'Approve this certificate',edit:'Check each value against the PDF','refused-decide':'Decide on the deficiencies','refused-approve':'Approve this certificate','refused-edit':'Check each value against the PDF',none:'Nothing needs you'};
  let body='';
  if(m==='decide') {
   const fails=failures();
   const email='Your certificate does not meet the project requirements. Please send a corrected certificate.\n'+fails.map(l=>'- '+l.deficiency).join('\n')+'\nUpload it here: [upload link]';
   body='<p>The check found these deficiencies. Waive them with a note, or reject. Reject sends '+r.name+' a fixed correction request that lists each one.</p>'+
    '<ul class="deficiencies">'+fails.map(l=>'<li><span class="failure-mark" data-tone="red">'+icon('cross')+'</span><span>'+esc(l.deficiency)+' <span class="failure-word" data-tone="red">· Fail</span></span></li>').join('')+'</ul>'+
    '<label class="field-label" for="decision-note">Waiver note <span>(required to waive)</span></label><textarea class="field" id="decision-note" rows="2" placeholder="Why is this acceptable?"'+(formError?' aria-invalid="true" aria-describedby="form-error"':'')+'>'+esc(pendingNote)+'</textarea>'+
    (formError?'<p id="form-error" class="refusal" role="alert">'+esc(formError)+'</p>':'')+
    '<div class="actions">'+button('waive','Waive','decision')+button('reject','Reject','decision')+'</div>'+
    '<details><summary>What Reject sends to '+r.name+'</summary><pre class="email">'+esc(email)+'</pre></details>';
  } else if(m==='approve') {
   body='<p>Every line passes. Nothing goes to the subcontractor until you approve.</p><div class="actions">'+button('approve','Approve','primary')+button('edit','Correct a value')+'</div>';
  } else if(m==='edit') {
   body='<p>Change any value that does not match the PDF, then save. The check runs again before anything is approved.</p>'+
    '<label class="field-label" for="correction-note">Correction note <span>(required)</span></label><textarea class="field" id="correction-note" rows="2" placeholder="Why did you change the value?"'+(formError?' aria-invalid="true" aria-describedby="form-error"':'')+'>'+esc(pendingNote)+'</textarea>'+
    (formError?'<p id="form-error" class="refusal" role="alert">'+esc(formError)+'</p>':'')+
    '<div class="actions">'+button('save','Save and check again','primary')+button('cancel','Cancel')+'</div>'+
    '<p class="fine">Each change is kept in the timeline as old value to new value, with your name: '+esc(actor())+'.</p>';
  } else if(m.startsWith('refused')) {
   const reason=m==='refused-decide'?'Only the project manager or leadership can waive a deficiency.':m==='refused-approve'?'Only the accountant can approve a certificate.':'Only the accountant can correct a reading.';
   body='<p class="refusal" role="status">'+reason+'</p><p>You are viewing as '+roles[role]+'.</p>';
  } else body='<p>'+esc(r.noneText||'Nothing needs you on this record.')+'</p>';
  return '<div class="pane-head"><p class="eyebrow">Your next step · '+roles[role]+'</p></div><h2>'+titles[m]+'</h2><div class="step-body">'+body+'</div>'+
   (m!=='none'?'<p class="fine">Your decision is saved with your name: '+esc(actor())+'.</p>':'');
 }
 function values() {
  const r=record(), m=mode(), canEdit=m==='edit';
  const rows=lines().map(l=>{
   let found='<span class="'+(l.money?'money':'')+'">'+esc(l.found)+'</span>';
   if(canEdit) {
    const value=r.values[l.key];
    found=typeof value==='boolean'?'<select class="field" data-edit="'+l.key+'" aria-label="'+l.label+', value on the certificate"><option value="true"'+(value?' selected':'')+'>Printed</option><option value="false"'+(!value?' selected':'')+'>Not printed</option></select>':
     '<input class="field" data-edit="'+l.key+'" aria-label="'+l.label+', value on the certificate" value="'+esc(value)+'"'+(typeof value==='number'?' inputmode="numeric"':'')+'>';
   }
   const word=canEdit?'Checking':record().waived&&!l.pass?'Waived':l.pass?'Pass':'Fail';
   const tone=canEdit||word==='Waived'?'neutral':l.pass?'green':'red';
   return '<div class="value-row" role="row" data-key="'+l.key+'" tabindex="-1"><div class="label" role="rowheader">'+l.label+(l.sub?'<small>'+esc(l.sub)+'</small>':'')+'</div><div role="cell" class="found" data-caption="Found">'+found+'</div><div role="cell" class="required" data-caption="Required"><span class="'+(l.money?'money':'')+'">'+l.required+'</span></div><div role="cell" class="result" data-tone="'+tone+'">'+icon(word==='Pass'?'check':word==='Fail'?'cross':'ring')+word+'</div></div>';
  }).join('');
  return '<div class="pane-head"><h2>Values read against the requirements</h2></div><div class="confidence"><div class="confidence-top"><span>Reading confidence</span><strong>'+r.confidence+'%</strong></div>'+
   '<div class="confidence-track" role="img" aria-label="Reading confidence '+r.confidence+'%. The line is at 85%."><span class="confidence-fill" style="--confidence:'+r.confidence+'%"></span><span class="confidence-mark"></span></div>'+
   '<p class="fine">85% line · '+esc(r.confText)+'</p></div>'+
   '<div class="value-table" role="table" aria-label="Values against requirements"><div class="value-row table-head" role="row"><span role="columnheader">Coverage</span><span role="columnheader">Found</span><span role="columnheader">Required</span><span role="columnheader">Result</span></div>'+rows+'</div>'+trust('Certificates · Project requirements',r.updated);
 }
 function pdfPane() {
  return '<div class="pane-head"><h2>Certificate PDF</h2><a class="text-link" href="certificates/'+key+'-sample.pdf" target="_blank" rel="noopener">Open the original file (owner only)</a></div>'+
   '<p class="fine">Uploaded Oct 8, 2026 by '+record().name+' (Subcontractor)</p>'+button('pdf','View certificate','pdf-mobile secondary')+
   '<div class="pdf-pages" aria-label="Certificate PDF pages"><p class="pdf-loading" role="status">Drawing the certificate…</p></div>'+trust('Certificates',record().updated);
 }
 function timeline() {
  const r=record();
  return '<div class="pane-head"><h2>Timeline</h2></div><p class="fine">Newest first · Source: Activity log · Updated '+esc(r.updated)+' · Sample data</p><ol>'+
   r.timeline.map(t=>'<li><p class="timeline-meta"><strong>'+esc(t.who)+'</strong><time>'+esc(t.when)+'</time></p><p>'+esc(t.text)+'</p></li>').join('')+'</ol>';
 }
 function render(keepPdf) {
  const hadPdf=root.querySelector('.pdf-pages');
  const stored=keepPdf&&hadPdf?hadPdf:null;
  const focus=document.activeElement;
  const focusId=focus&&focus.id;
  const orders={vault:['pdf','step','values','w9','timeline'],ledger:['step','values','w9','timeline','pdf'],signal:['values','step','pdf','w9','timeline'],drafting:['step','values','pdf','w9','timeline']};
  const content={step:nextStep(),values:values(),pdf:pdfPane(),w9:'<div class="pane-head"><h2>W-9</h2></div><p>'+ (record().w9?'On file.':'Not on file. Whether this holds payment is decided at the next pay-cycle check.')+'</p>'+ (role==='accountant'?button('w9',record().w9?'Mark W-9 missing':'Mark W-9 on file','text-button'):'<p class="fine">Only the accountant can mark a W-9.</p>')+trust('Compliance records',record().updated),timeline:timeline()};
  root.innerHTML='<header class="chrome">'+chrome()+'</header><main class="page" id="main"'+(busy?' aria-busy="true"':'')+'><a class="back" href="#" data-navigation="Worklist">'+icon('back')+' Worklist: '+record().project+'</a><section class="record-head" aria-label="Record summary">'+header()+'</section><div class="layout">'+orders[data.direction].map(name=>'<section class="pane '+name+'" aria-label="'+({pdf:'Certificate PDF',step:'Your next step',values:'Values read against the requirements',w9:'W-9',timeline:'Timeline'}[name])+'">'+content[name]+'</section>').join('')+'</div></main>';
  if(stored)root.querySelector('.pdf-pages').replaceWith(stored);else drawPdf();
  if(focusId)document.getElementById(focusId)?.focus({preventScroll:true});
  root.querySelector('.step').classList.add('reveal');
  document.documentElement.dataset.ready='true';
 }
 async function drawPdf() {
  const generation=++loadGeneration;
  const host=root.querySelector('.pdf-pages');
  try {
   if(!window.pdfjsLib)throw Error('The PDF viewer could not load. Open the original file to review the certificate.');
   window.pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
   const bytes=Uint8Array.from(atob(window.STUDY_PDFS[key]),c=>c.charCodeAt(0));
   const pdf=await window.pdfjsLib.getDocument({data:bytes}).promise;
   const fragments=document.createDocumentFragment();
   for(let n=1;n<=pdf.numPages;n++) {
    const page=await pdf.getPage(n), viewport=page.getViewport({scale:1.8});
    const figure=document.createElement('figure');figure.className='pdf-page';
    const canvas=document.createElement('canvas');canvas.width=viewport.width;canvas.height=viewport.height;
    canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Certificate page '+n+' of '+pdf.numPages+'. SAMPLE: fictional certificate.');
    await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
    const text=await page.getTextContent(), accessible=document.createElement('figcaption');accessible.className='pdf-text';accessible.textContent=text.items.map(i=>i.str).join(' ');
    figure.append(canvas,accessible);fragments.append(figure);
   }
   if(generation!==loadGeneration)return;
   host.replaceChildren(fragments);host.dataset.rendered='true';
  } catch(error) {
   if(generation!==loadGeneration)return;
   host.innerHTML='<p class="refusal" role="status">'+esc(error.message)+'</p>';
   host.dataset.rendered='error';
  }
 }
 function notify(text) {
  const host=document.querySelector('.toasts');
  host.innerHTML='<div class="toast reveal" role="status"><span>'+esc(text)+'</span><button type="button" aria-label="Dismiss message">×</button></div>';
  const message=host.firstElementChild;
  host.querySelector('button').onclick=()=>message.remove();
  window.setTimeout(()=>message.remove(),5200);
 }
 function event(text) { record().timeline.unshift({who:actor(),when:data.now,text});record().updated=data.updatedNow; }
 function finish(fn,message) {
  busy=true; render(true);
  window.setTimeout(()=>{fn();busy=false;pendingNote='';formError='';render(true);notify(message);root.querySelector('.step h2').setAttribute('tabindex','-1');root.querySelector('.step h2').focus({preventScroll:true});},1100);
 }
 const actions={
  reset(){records=clone(data.records);edit=false;pendingNote='';formError='';role=key==='brightway'?'accountant':'project_manager';render(false);notify('Demo reset.');},
  edit(){if(role!=='accountant'||record().next!=='approve')return;edit=true;pendingNote='';render(true);root.querySelector('[data-edit]').focus();},
  cancel(){edit=false;pendingNote='';formError='';render(true);},
  save(){
   if(mode()!=='edit')return;
   const note=document.getElementById('correction-note').value.trim();
   if(!note){notify('A correction needs a short note. Nothing was changed.');document.getElementById('correction-note').setAttribute('aria-invalid','true');document.getElementById('correction-note').focus();return;}
   const edits=Array.from(root.querySelectorAll('[data-edit]')).map(el=>{
    const k=el.dataset.edit, old=record().values[k], value=typeof old==='boolean'?el.value==='true':typeof old==='number'?(el.value.trim()===''?null:Number(el.value)):el.value.trim();
    return {k,old,value};
   });
   if(edits.some(e=>typeof e.value==='number'&&(!Number.isFinite(e.value)||e.value<0||!Number.isInteger(e.value)))){notify('Use a whole number of dollars or days. Nothing was changed.');return;}
   finish(()=>{
    edits.filter(e=>e.old!==e.value).forEach(e=>{
     record().values[e.k]=e.value;
     const l=lines().find(l=>l.key===e.k);
     const show=v=>l.money?(v==null?'Not shown':usd(v)):String(v);
     event(l.label+' corrected from '+show(e.old)+' to '+show(e.value)+'. Note: '+note);
    });
    edit=false;record().next=failures().length?'decide':'approve';record().waiting=failures().length?'Waiting for a decision on a deficiency':'Waiting for approval';
    record().confText='Values confirmed by '+actor()+' against the PDF.';
   },'Correction saved and the check run again.');
  },
  approve(){
   if(mode()!=='approve')return;
   if(failures().length){notify('The certificate has deficiencies. A project manager or leadership must decide.');return;}
   finish(()=>{record().status='Compliant';record().waiting='Nothing waiting';record().next=null;record().current='Expires '+record().expiry;event('Approved the certificate. '+record().name+' was emailed.');},'Approved. The subcontractor has been emailed.');
  },
  waive(){
   if(mode()!=='decide')return;
   const note=document.getElementById('decision-note').value.trim();
   if(!note){formError='A waiver needs a note. Write why this is acceptable, then waive.';render(true);document.getElementById('decision-note').focus();return;}
   finish(()=>{event('Waived the deficiencies: '+failures().map(l=>l.label.toLowerCase()).join(', ')+'. Note: '+note);record().waived=true;record().status='Compliant';record().waiting='Nothing waiting';record().next=null;record().current='Expires '+record().expiry;},'Waived. The subcontractor has been emailed that the certificate is approved.');
  },
  reject(){
   if(mode()!=='decide')return;
   finish(()=>{event('Rejected. Correction request sent. '+failures().map(l=>l.deficiency).join('; '));record().status='Awaiting certificate';record().waiting='Nothing waiting';record().next=null;record().noneText='Waiting for '+record().name+' to upload a corrected certificate.';},'Rejected. The correction request has been sent to the subcontractor.');
  },
  w9(){if(role!=='accountant')return;finish(()=>{record().w9=!record().w9;event(record().w9?'Marked the W-9 on file.':'Marked the W-9 missing.');},record().w9?'W-9 marked missing.':'W-9 marked on file.');},
  pdf(){const pane=root.querySelector('.pdf');pane.classList.toggle('is-open');pane.querySelector('[data-action="pdf"]').textContent=pane.classList.contains('is-open')?'Hide certificate':'View certificate';}
 };
 root.addEventListener('click',e=>{
  const control=e.target.closest('[data-action]');
  if(control&&!busy)actions[control.dataset.action]?.();
  if(e.target.closest('[data-navigation]')){e.preventDefault();notify('This study shows the record detail only.');}
 });
 root.addEventListener('change',e=>{
  if(busy)return;
  if(e.target.id==='record'){key=e.target.value;role=key==='brightway'?'accountant':'project_manager';edit=false;pendingNote='';formError='';render(false);document.getElementById('record').focus();}
  if(e.target.id==='role'){role=e.target.value;edit=false;pendingNote='';formError='';render(true);document.getElementById('role').focus();}
 });
 root.addEventListener('input',e=>{if(e.target.id==='decision-note'||e.target.id==='correction-note')pendingNote=e.target.value;});
 document.addEventListener('keydown',e=>{
  if(busy)return;
  const typing=['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName);
  if(e.key==='Escape'&&edit){e.preventDefault();actions.cancel();return;}
  if((e.ctrlKey||e.metaKey)&&e.key==='Enter'&&mode()==='edit'){e.preventDefault();actions.save();return;}
  if(typing||e.ctrlKey||e.metaKey||e.altKey)return;
  if(e.key.toLowerCase()==='a'&&mode()==='approve'){e.preventDefault();actions.approve();}
  if(e.key.toLowerCase()==='e'&&mode()==='approve'){e.preventDefault();actions.edit();}
  if(['j','k'].includes(e.key.toLowerCase())){e.preventDefault();const rows=Array.from(root.querySelectorAll('.value-row[data-key]')),index=rows.indexOf(document.activeElement);rows[Math.max(0,Math.min(rows.length-1,index+(e.key.toLowerCase()==='j'?1:-1)))].focus();}
 });
 render(false);
})();