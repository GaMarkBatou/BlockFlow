let workflows = [], targetTabId = null;
const $ = s => document.querySelector(s);
async function init(){ await refreshTarget(); const store = await BF.getStore(); workflows=store.workflows; $('#workflowSelect').innerHTML = workflows.map(w=>`<option value="${w.id}" ${w.id===store.activeWorkflowId?'selected':''}>${w.name}${w.verified===false?' · nem ellenőrzött':''}</option>`).join(''); }
async function refreshTarget(){ const res = await BF.getTargetTab(); targetTabId = res.tabId; $('#target').textContent = res.ok ? res.url : 'Nincs aktív weboldal.'; }
$('#workflowSelect').onchange=()=>BF.setActiveWorkflow($('#workflowSelect').value);
$('#openBuilder').onclick=async()=>{
  const { lastActiveTabId } = await chrome.storage.local.get('lastActiveTabId');
  chrome.runtime.sendMessage({type:'OPEN_BUILDER', tabId:lastActiveTabId});
};
async function run(dryRun=false){ await refreshTarget(); const wf=workflows.find(w=>w.id===$('#workflowSelect').value); if(!wf) return; const validation = BF.validateWorkflow(wf); if(!dryRun && !validation.ok){ $('#log').textContent='Ellenőrzési hiba:\n'+validation.issues.map(i=>`${i.level}: ${i.text}`).join('\n'); return; } if(!dryRun && validation.issues.length && !confirm('Az ellenőrzés figyelmeztetéseket talált. Folytatod?')) return; if(!dryRun && wf && wf.verified===false && !confirm('Ez importált vagy nem ellenőrzött automatizmus. Javasolt előbb Dry-run módban tesztelni. Mégis futtatod?')) return; $('#log').textContent=dryRun?'Dry-run...':'Futtatás...'; const res=await BF.sendToTarget({type:'BF_RUN_WORKFLOW', workflow:wf, options:{dryRun}}, targetTabId); $('#log').textContent=res.response?.ok ? `Kész.${dryRun?' [dry-run]':''}\n${JSON.stringify(res.response.result.vars,null,2)}\n\n${(res.response.result.log||[]).join('\n')}` : `Hiba: ${res.response?.error || res.error}\n\n${(res.response?.log||[]).join('\n')}`; }
$('#run').onclick=()=>run(false);
$('#dryRun').onclick=()=>run(true);
$('#stop').onclick=async()=>{ const res=await BF.sendToTarget({type:'BF_STOP_RUN'}, targetTabId); $('#log').textContent=res.ok?'Stop elküldve.':res.error; };
$('#scan').onclick=async()=>{ await refreshTarget(); const res=await BF.sendToTarget({type:'BF_PAGE_SUMMARY'}, targetTabId); const s=res.response?.summary; $('#log').textContent=s?`Cím: ${s.title}\nElemek: ${s.elements.length}\nPopup észlelve: ${s.popupDetected?'igen':'nem'}`:`Hiba: ${res.response?.error || res.error}`; };
$('#pick').onclick=async()=>{ await refreshTarget(); const res=await BF.sendToTarget({type:'BF_START_PICKER', context:{source:'sidepanel'}}, targetTabId); $('#log').textContent=res.ok?'Kattints egy elemre az oldalon.':'Nem sikerült indítani.'; };
chrome.runtime.onMessage.addListener(msg=>{ if(msg?.type==='BF_ELEMENT_PICKED' && msg.context?.source==='sidepanel'){ $('#picked').textContent=JSON.stringify(msg.element,null,2); $('#log').textContent=`Elem kiválasztva: ${msg.element.label}`; }});
init();
