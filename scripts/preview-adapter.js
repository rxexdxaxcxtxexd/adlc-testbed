// Browser adapter for a local preview. Use the same functions as the Apps Script server.
var LockService = {getScriptLock:function(){return {tryLock:function(){return true;},releaseLock:function(){}};}};
// Use default settings in the local browser. No Google property service is called.
var PropertiesService = {getScriptProperties:function(){return {getProperty:function(){return null;}};}};
var previewSequence = 0;
var previewDeps = {store:FakeStore(),clock:FakeClock('2026-10-08','2026-10-08T10:00:00'),mailer:FakeMailer(),calendar:FakeCalendar(),
  newToken:function(){previewSequence++;return 'preview-token-'+previewSequence;},encodePdf:function(text){return btoa(text);},
  uploadBaseUrl:'https://example.test/upload',internalBaseUrl:'https://example.test/app'};
initProject(previewDeps.store);
seedDemoPortfolio(previewDeps);
if (new URLSearchParams(location.search).get('state')==='threshold') previewDeps.store.updateRow('certificates','certificate_id','CERT-037',{confidence:0.849});
// ?state=trust-fail stores a stale status on one record, so the stored status check shows its Fail state.
if (new URLSearchParams(location.search).get('state')==='trust-fail') previewDeps.store.updateRow('compliance_records','record_id','REC-004',{status:'expired'});
var previewApi = {
  getDirectory:function(){return directoryView(previewDeps);},
  getTrustChecks:function(){return trustView(previewDeps);},
  getNotifications:function(){return notificationLog(previewDeps);},
  getPortfolio:function(){return portfolioView(previewDeps);},
  getAppData:function(){return appData(previewDeps);},
  getWorklist:function(id){return worklistView(previewDeps,id);},
  getPaymentHoldList:function(id){return id==='all' ? portfolioHoldList(previewDeps) : paymentHoldList(previewDeps,id);},
  getRecordDetail:function(id){return recordDetail(previewDeps,id);},
  getRoi:function(){return roiLines(ROI_INPUTS);},
  runReviewAction:function(id,role,action,payload){return reviewAction(previewDeps,id,role,action,payload);},
  changeReviewMode:function(role,mode,id){return setReviewMode(previewDeps,id,role,mode);},
  getPdfData:function(id){
    var link=recordPdfLink(previewDeps,id);
    var file=previewDeps.store.snapshot().files.filter(function(f){return 'fake://'+f.path===link;})[0];
    if (file) return file.content.replace(/^base64:/,'');
    var row=findRow(previewDeps.store.readRows('compliance_records'),'record_id',id);
    var record=loadRecord(previewDeps.store,row), cert=shownCertificate(record);
    var project=findRow(previewDeps.store.readRows('projects'),'project_id',row.project_id);
    return cert && cert.values && /^sample-/.test(cert.fingerprint) ? btoa(demoCertificatePdf(cert.values,record.sub.name,project.name)) : '';
  },
  getUploadStatus:function(token,id){
    var upload=findRow(previewDeps.store.readRows('uploads'),'upload_id',id);
    if (upload && upload.processed===false) {
      var record=findRow(previewDeps.store.readRows('compliance_records'),'upload_token',token);
      var model=loadRecord(previewDeps.store,record);
      var reading=JSON.parse(JSON.stringify(SAMPLE_READING));
      reading.values.insured_name=model.sub.name;
      if (new URLSearchParams(location.search).get('state')==='unreadable') reading={readable:false,values:null,confidence:0};
      previewDeps.reader=FakeReader(reading);
      processNextUpload(previewDeps);
    }
    return uploadProgress(previewDeps,token,id);
  },
  submitUpload:function(token,name,base64){
    var text=atob(base64);
    return acceptUpload(previewDeps,token,{name:name,size:text.length,header:text.slice(0,5),fingerprint:base64,base64:base64});
  }
};
window.COIPreview={call:function(name,args,yes,no){
  setTimeout(function(){
    try {
      var scenario=new URLSearchParams(location.search).get('state');
      if(scenario==='error') throw new Error('Preview error');
      if(scenario==='empty' && name==='getPortfolio') {yes({projects:[],totals:{},last_updated:{}});return;}
      if(scenario==='empty' && name==='getAppData') {var e=appData(previewDeps);e.portfolio={projects:[],totals:{},last_updated:{}};yes(e);return;}
      if(scenario==='roi-missing' && name==='getAppData') {var m=appData(previewDeps),r0=JSON.parse(JSON.stringify(ROI_INPUTS));delete r0.inputs.min_per_cert_today.basis;m.roi=roiLines(r0);yes(m);return;}
      if(scenario==='roi-missing' && name==='getRoi') {var d=JSON.parse(JSON.stringify(ROI_INPUTS));delete d.inputs.min_per_cert_today.basis;yes(roiLines(d));return;}
      yes(previewApi[name].apply(null,args));
    }catch(err){no(err);}
  }, new URLSearchParams(location.search).get('state')==='loading' ? 30000 : 180);
}};
