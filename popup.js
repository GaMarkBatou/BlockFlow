let workflows = [];
const $ = s => document.querySelector(s);

function renderLanguageControl(){
  const btn = $('#langButton');
  const code = BF.i18n.selected === 'auto' ? 'AUTO' : (BF.i18n.active || 'hu').toUpperCase();
  const label = $('#langCode');
  if (label) label.textContent = code;
  if (!btn) return;
  btn.onclick = () => {
    const old = document.querySelector('.lang-menu');
    if (old) { old.remove(); return; }
    const menu = document.createElement('div');
    menu.className = 'lang-menu';
    menu.innerHTML = (BF.i18n.languages || []).map(l => `<button data-lang="${l.code}">${l.nativeName || l.label || l.code}</button>`).join('');
    document.body.appendChild(menu);
    menu.querySelectorAll('[data-lang]').forEach(x => x.onclick = async () => {
      await BF.setLanguage(x.dataset.lang);
      menu.remove();
      BF.applyI18nToDom(document);
      renderLanguageControl();
      await init();
    });
  };
}

async function init(){
  await BF.initI18n();
  renderLanguageControl();
  const store = await BF.getStore();
  workflows = store.workflows;
  $('#workflowSelect').innerHTML = workflows.map(w=>`<option value="${w.id}" ${w.id===store.activeWorkflowId?'selected':''}>${w.name}${w.verified===false?' · '+BF.t('workflow.unverifiedSuffix'):''}</option>`).join('');
}

$('#openBuilder').onclick = async () => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs.find(t => t?.id && t.url && /^https?:|^file:/.test(t.url));
  chrome.runtime.sendMessage({ type:'OPEN_BUILDER', tabId: tab?.id });
};

$('#openSide').onclick = async () => {
  $('#status').textContent = BF.t('status.openingSidebar');
  try {
    if (!chrome.sidePanel?.open) throw new Error(BF.t('popup.sidePanelApiUnavailable'));

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tab = tabs.find(t => t?.id && t.url && /^https?:|^file:/.test(t.url));
    if (!tab?.id) throw new Error(BF.t('popup.sidebarErrorNormalPage'));

    await chrome.storage.local.set({ lastActiveTabId: tab.id, lastActiveTabUrl: tab.url });
    if (chrome.sidePanel?.setOptions) {
      await chrome.sidePanel.setOptions({ tabId: tab.id, path: 'sidepanel.html', enabled: true });
    }

    // This must be called directly from the popup button's user gesture.
    // Do not proxy it through the service worker, otherwise Chrome rejects it.
    await chrome.sidePanel.open({ tabId: tab.id });
    $('#status').textContent = BF.t('status.sidebarOpened');
  } catch (err) {
    $('#status').textContent = BF.t('popup.sidebarErrorWithMessage', { message: err?.message || err || BF.t('status.unknownError') });
  }
};

$('#workflowSelect').onchange = () => BF.setActiveWorkflow($('#workflowSelect').value);
$('#run').onclick = async () => {
  const workflow = workflows.find(w=>w.id===$('#workflowSelect').value);
  if (!workflow) return;
  const validation = BF.validateWorkflow(workflow);
  if (!validation.ok) { $('#status').textContent = BF.t('status.checkError') + ': ' + validation.issues.filter(i=>i.level==='error').map(i=>i.text).join('; '); return; }
  if (validation.issues.length && !confirm(BF.t('confirm.validationWarnings'))) return;
  if (workflow.verified === false && !confirm(BF.t('confirm.unverifiedWorkflow'))) return;
  $('#status').textContent=BF.t('status.running');
  const res = await BF.sendToTarget({ type:'BF_RUN_WORKFLOW', workflow, options: { dryRun: false } });
  $('#status').textContent = res?.response?.ok ? (res.response.result?.skipped ? BF.t('status.notStarted') : BF.t('status.done')) : `${BF.t('status.error')}: ${res?.response?.error || res?.error || BF.t('status.unknown')}`;
};
init();
