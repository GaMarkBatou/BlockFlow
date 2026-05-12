let workflows = [];
const $ = s => document.querySelector(s);

async function init(){
  const store = await BF.getStore();
  workflows = store.workflows;
  $('#workflowSelect').innerHTML = workflows.map(w=>`<option value="${w.id}" ${w.id===store.activeWorkflowId?'selected':''}>${w.name}${w.verified===false?' · nem ellenőrzött':''}</option>`).join('');
}

$('#openBuilder').onclick = async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs.find(t => t?.id && t.url && /^https?:|^file:/.test(t.url));
  chrome.runtime.sendMessage({ type:'OPEN_BUILDER', tabId: tab?.id });
};

$('#openSide').onclick = async () => {
  $('#status').textContent = 'Sidebar nyitása...';
  try {
    if (!chrome.sidePanel?.open) throw new Error('A Chrome sidePanel API nem elérhető ebben a böngészőben. Friss Chrome szükséges.');

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs.find(t => t?.id && t.url && /^https?:|^file:/.test(t.url));
    if (!tab?.id) throw new Error('Nyiss meg egy normál weboldalt, majd onnan nyisd meg a sidebart. Chrome belső oldalakon nem futtatható.');

    await chrome.storage.local.set({ lastActiveTabId: tab.id, lastActiveTabUrl: tab.url });
    if (chrome.sidePanel?.setOptions) {
      await chrome.sidePanel.setOptions({ tabId: tab.id, path: 'sidepanel.html', enabled: true });
    }

    // This must be called directly from the popup button's user gesture.
    // Do not proxy it through the service worker, otherwise Chrome rejects it.
    await chrome.sidePanel.open({ tabId: tab.id });
    $('#status').textContent = 'Sidebar megnyitva.';
  } catch (err) {
    $('#status').textContent = `Sidebar hiba: ${err?.message || err || 'ismeretlen hiba'}`;
  }
};

$('#workflowSelect').onchange = () => BF.setActiveWorkflow($('#workflowSelect').value);
$('#run').onclick = async () => {
  const workflow = workflows.find(w=>w.id===$('#workflowSelect').value);
  if (!workflow) return;
  const validation = BF.validateWorkflow(workflow);
  if (!validation.ok) { $('#status').textContent = 'Ellenőrzési hiba: ' + validation.issues.filter(i=>i.level==='error').map(i=>i.text).join('; '); return; }
  if (validation.issues.length && !confirm('Az ellenőrzés figyelmeztetéseket talált. Folytatod?')) return;
  if (workflow.verified === false && !confirm('Ez importált vagy nem ellenőrzött automatizmus. Javasolt előbb Dry-run módban tesztelni. Mégis futtatod?')) return;
  $('#status').textContent='Futtatás...';
  const res = await BF.sendToTarget({ type:'BF_RUN_WORKFLOW', workflow, options: { dryRun: false } });
  $('#status').textContent = res?.response?.ok ? 'Kész.' : `Hiba: ${res?.response?.error || res?.error || 'ismeretlen'}`;
};
init();
