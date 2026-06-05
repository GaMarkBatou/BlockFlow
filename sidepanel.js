let workflows = [], targetTabId = null;
const $ = s => document.querySelector(s);

function sideT(key, vars){ return BF.t ? BF.t(key, vars) : key; }
function sideUnknown(){ return sideT('status.unknownError'); }
function formatRunResult(res, dryRun, forceRun){
  if (!res?.response?.ok) {
    const log = (res?.response?.log || []).join('\n');
    return `${sideT('status.error')}: ${res?.response?.error || res?.error || sideUnknown()}${log ? '\n\n' + log : ''}`;
  }
  const result = res.response.result || {};
  const status = result.skipped ? sideT('status.notStarted') : sideT('status.done');
  const flags = `${dryRun ? ' [dry-run]' : ''}${forceRun ? ' [force]' : ''}`;
  const vars = JSON.stringify(result.vars || {}, null, 2);
  const log = (result.log || []).join('\n');
  return `${status}${flags}\n${vars}${log ? '\n\n' + log : ''}`;
}
async function init(){
  await BF.initI18n();
  BF.applyI18nToDom(document);
  await refreshTarget();
  const store = await BF.getStore();
  workflows=store.workflows;
  $('#workflowSelect').innerHTML = workflows.map(w=>`<option value="${w.id}" ${w.id===store.activeWorkflowId?'selected':''}>${w.name}${w.verified===false?' · '+sideT('workflow.unverifiedSuffix'):''}</option>`).join('');
}
async function refreshTarget(){
  const res = await BF.getTargetTab();
  targetTabId = res.tabId;
  $('#target').textContent = res.ok ? res.url : sideT('side.noActiveWebPage');
}
$('#workflowSelect').onchange=()=>BF.setActiveWorkflow($('#workflowSelect').value);
$('#openBuilder').onclick=async()=>{
  const { lastActiveTabId } = await chrome.storage.local.get('lastActiveTabId');
  chrome.runtime.sendMessage({type:'OPEN_BUILDER', tabId:lastActiveTabId});
};
async function run(dryRun=false, forceRun=false){
  await refreshTarget();
  const wf=workflows.find(w=>w.id===$('#workflowSelect').value);
  if(!wf) return;
  const validation = BF.validateWorkflow(wf);
  if(!dryRun && !validation.ok){ $('#log').textContent=sideT('status.checkError')+':\n'+validation.issues.map(i=>`${i.level}: ${i.text}`).join('\n'); return; }
  if(!dryRun && validation.issues.length && !confirm(sideT('confirm.validationWarnings'))) return;
  if(!dryRun && wf && wf.verified===false && !confirm(sideT('confirm.unverifiedWorkflow'))) return;
  $('#log').textContent=forceRun?sideT('status.forceRunning'):(dryRun?'Dry-run...':sideT('status.running'));
  const res=await BF.sendToTarget({type:'BF_RUN_WORKFLOW', workflow:wf, options:{dryRun, forceRun}}, targetTabId);
  $('#log').textContent=formatRunResult(res,dryRun,forceRun);
}
$('#run').onclick=()=>run(false,false);
$('#dryRun').onclick=()=>run(true,false);
$('#forceRun').onclick=()=>run(false,true);
$('#stop').onclick=async()=>{ const res=await BF.sendToTarget({type:'BF_STOP_RUN'}, targetTabId); $('#log').textContent=res.ok?sideT('side.stopSent'):(res.error || sideUnknown()); };
$('#scan').onclick=async()=>{
  await refreshTarget();
  const res=await BF.sendToTarget({type:'BF_PAGE_SUMMARY'}, targetTabId);
  const s=res.response?.summary;
  $('#log').textContent=s?sideT('side.pageSummary', { title:s.title, count:s.elements.length, popup:s.popupDetected?sideT('common.yes'):sideT('common.no') }):`${sideT('status.error')}: ${res.response?.error || res.error || sideUnknown()}`;
};
$('#pick').onclick=async()=>{
  await refreshTarget();
  const res=await BF.sendToTarget({type:'BF_START_PICKER', context:{source:'sidepanel'}}, targetTabId);
  $('#log').textContent=res.ok?sideT('side.pickInstruction'):sideT('side.pickStartFailed');
};
chrome.runtime.onMessage.addListener(msg=>{ if(msg?.type==='BF_ELEMENT_PICKED' && msg.context?.source==='sidepanel'){ $('#picked').textContent=JSON.stringify(msg.element,null,2); $('#log').textContent=sideT('side.elementPicked', { label: msg.element.label || '' }); }});
init();
