let workflows = [];
let activeWorkflow = null;
let selectedBlockId = null;
let targetTabId = Number(new URLSearchParams(location.search).get('targetTabId')) || null;
let lastInspectorBlockId = null;
let currentTargetUrl = '';
let currentTargetHost = '';
let currentTargetPath = '/';
let isDirty = false;
let paletteCollapsed = {};
try { paletteCollapsed = JSON.parse(localStorage.getItem('bf_palette_collapsed') || '{}') || {}; } catch { paletteCollapsed = {}; }
let recorderState = { active: false, paused: false, startedAt: 0, count: 0 };

const $ = sel => document.querySelector(sel);
const CONTAINERS = new Set(['ifBlock', 'repeatBlock', 'rowLoop', 'triggerGroup', 'conditionGroup', 'tryBlock', 'retryBlock', 'elementLoop', 'iframeBlock', 'groupBlock']);

async function init() {
  const store = await BF.getStore();
  workflows = store.workflows;
  workflows.forEach(w => normalizeWorkflow(w));
  activeWorkflow = workflows.find(w => w.id === store.activeWorkflowId) || workflows[0];
  normalizeWorkflow(activeWorkflow);
  selectedBlockId = firstBlock(activeWorkflow.blocks)?.id;
  await refreshTarget();
  renderAll();
}

function normalizeWorkflow(workflow) {
  const walk = blocks => {
    for (let i = 0; i < (blocks || []).length; i++) {
      const b = blocks[i];
      if (!b || typeof b !== 'object') continue;
      if (!b.id) b.id = crypto.randomUUID();
      // v0.39: a Record által létrehozott blokkok teljesen normál blokkok.
      // Régi workflow-kból eltávolítunk minden csak vizuális/record/lock jelölést, hogy
      // semmi ne kezelje őket külön szerkesztés, mozgatás vagy törlés közben.
      ['recorded','locked','readOnly','readonly','recordOnly','recordedBlock'].forEach(k => { if (Object.prototype.hasOwnProperty.call(b, k)) delete b[k]; });
      if (b.source === 'record') delete b.source;
      if (CONTAINERS.has(b.type) && !Array.isArray(b.children)) b.children = [];
      if (b.type === 'groupBlock') {
        if (typeof b.groupEnabled !== 'boolean') b.groupEnabled = true;
        if (typeof b.collapsed !== 'boolean') b.collapsed = false;
      }
      if (b.type === 'ifBlock' && !Array.isArray(b.elseChildren)) b.elseChildren = [];
      if (b.type === 'tryBlock' && !Array.isArray(b.elseChildren)) b.elseChildren = [];
      if (b.type === 'triggerGroup' && !Array.isArray(b.children)) b.children = [];

      // Régi Figyelő: szöveg / Figyelő: elem blokkok migrálása új Figyelő trigger + feltétel modellre.
      if (b.type === 'watchText') {
        b.type = 'triggerGroup';
        b.logic = b.logic || 'all';
        b.triggerEnabled = b.triggerEnabled !== false;
        b.children = [{ id: crypto.randomUUID(), type: 'conditionText', text: b.text || '', caseSensitive: Boolean(b.caseSensitive) }];
        delete b.text; delete b.caseSensitive; delete b.timeoutMs;
      }
      if (b.type === 'watchElement') {
        b.type = 'triggerGroup';
        b.logic = b.logic || 'all';
        b.triggerEnabled = b.triggerEnabled !== false;
        b.children = [{ id: crypto.randomUUID(), type: 'conditionElement', target: b.target || null, requireVisible: true }];
        delete b.target; delete b.timeoutMs;
      }

      // Automatikus migráció a régi v0.2-v0.5 lineáris modellből:
      // az if/repeat után következő N blokk bekerül vizuális gyermekblokknak.
      if (b.type === 'repeatBlock' && (!b.children || !b.children.length) && Number(b.blockCount || 0) > 0) {
        const n = Math.max(0, Math.min(50, Number(b.blockCount || 0)));
        b.children = blocks.splice(i + 1, n);
        delete b.blockCount;
      }
      if (b.type === 'ifBlock' && (!b.children || !b.children.length) && Number(b.skipCount || 0) > 0) {
        const n = Math.max(0, Math.min(50, Number(b.skipCount || 0)));
        b.children = blocks.splice(i + 1, n);
        delete b.skipCount;
      }
      if (Array.isArray(b.children)) walk(b.children);
      if (Array.isArray(b.elseChildren)) walk(b.elseChildren);
    }
  };
  workflow.blocks ||= [];
  walk(workflow.blocks);
}

function firstBlock(blocks) {
  for (const b of blocks || []) return b;
  return null;
}

async function refreshTarget() {
  const res = await BF.getTargetTab(targetTabId);
  targetTabId = res.tabId;
  currentTargetUrl = res.ok ? (res.url || '') : '';
  try {
    const u = new URL(currentTargetUrl);
    currentTargetHost = u.hostname || '';
    currentTargetPath = u.pathname || '/';
  } catch {
    currentTargetHost = '';
    currentTargetPath = '/';
  }
  $('#targetInfo').textContent = res.ok ? `Cél tab: ${safeHost(res.url)}` : 'Nincs weboldal cél tab';
}

function renderSaveState() {
  const el = $('#saveState');
  if (!el) return;
  el.textContent = isDirty ? 'Nem mentett módosítás' : 'Mentve';
  el.className = `status save-state ${isDirty ? 'dirty' : 'saved'}`;
}

function hasAnyStarter(blocks = activeWorkflow?.blocks || []) {
  let found = false;
  walk(blocks, b => { if (isStarterBlock(b)) found = true; });
  return found;
}

function renderAll() {
  try { normalizeWorkflow(activeWorkflow); } catch (err) { console.error('normalizeWorkflow', err); }
  const safe = (name, fn) => {
    try {
      const r = fn();
      if (r && typeof r.catch === 'function') r.catch(err => { console.error(name, err); showPanelError(name, err); });
    } catch (err) {
      console.error(name, err);
      showPanelError(name, err);
    }
  };
  renderSaveState();
  renderRecordControls();
  safe('workflowList', renderWorkflowList);
  safe('palette', renderPalette);
  safe('blocks', renderBlocks);
  safe('inspector', renderInspector);
  safe('variables', renderVariables);
  safe('importWarning', renderImportWarning);
  safe('validationPanel', renderValidation);
  safe('watcherPanel', renderWatcherPanel);
  safe('templatePanel', renderTemplates);
  safe('versionPanel', renderVersions);
}

function showPanelError(name, err) {
  const map = {
    inspector: 'inspector',
    variables: 'variables',
    validationPanel: 'validationPanel',
    watcherPanel: 'watcherPanel',
    templatePanel: 'templatePanel',
    versionPanel: 'versionPanel'
  };
  const id = map[name] || name;
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div class="issue-error">Betöltési hiba: ${escapeHtml(err?.message || err)}</div>`;
}


function renderImportWarning() {
  const warn = $('#importWarning');
  if (activeWorkflow?.verified === false || activeWorkflow?.imported) {
    warn.classList.remove('hidden');
    warn.textContent = 'Importált vagy még nem ellenőrzött automatizmus. Futtatás előtt használd a Dry-run módot és ellenőrizd az elemeket.';
  } else {
    warn.classList.add('hidden');
  }
}


function setWorkflowVerified(reason = 'check') {
  if (!activeWorkflow) return;
  activeWorkflow.verified = true;
  activeWorkflow.imported = false;
  activeWorkflow.verifiedAt = new Date().toISOString();
  activeWorkflow.verifiedBy = reason;
}

function setWorkflowUnverified(reason = 'modified') {
  if (!activeWorkflow) return;
  if (activeWorkflow.verified !== false || activeWorkflow.imported) {
    activeWorkflow.verified = false;
    activeWorkflow.imported = Boolean(activeWorkflow.imported);
    activeWorkflow.unverifiedReason = reason;
  }
}

async function selectWorkflow(workflowId, options = {}) {
  const next = workflows.find(w => w.id === workflowId);
  if (!next || next.id === activeWorkflow?.id) return;
  try {
    if (activeWorkflow && options.saveCurrent !== false) await saveCurrent();
  } catch (err) {
    console.warn('Workflow váltás előtti mentés nem sikerült:', err);
  }
  workflows.forEach(w => normalizeWorkflow(w));
  activeWorkflow = next;
  normalizeWorkflow(activeWorkflow);
  selectedBlockId = firstBlock(activeWorkflow.blocks)?.id || null;
  lastInspectorBlockId = null;
  isDirty = false;
  renderAll();
  try { await BF.setActiveWorkflow(activeWorkflow.id); } catch (err) { console.warn('Aktív workflow mentése sikertelen:', err); }
}

async function verifyAndPersist(reason = 'check') {
  setWorkflowVerified(reason);
  isDirty = false;
  await saveCurrent();
  renderAll();
}


function renderRecordControls() {
  const start = $('#recordStart'), pause = $('#recordPause'), stop = $('#recordStop'), status = $('#recordStatus');
  if (!start || !pause || !stop || !status) return;
  start.classList.toggle('hidden', recorderState.active);
  start.classList.toggle('recording', recorderState.active);
  pause.classList.toggle('hidden', !recorderState.active);
  stop.classList.toggle('hidden', !recorderState.active);
  status.classList.toggle('hidden', !recorderState.active);
  pause.textContent = recorderState.paused ? '▶ Folytatás' : '⏸ Pause';
  status.textContent = recorderState.active ? `Record ${recorderState.paused ? 'szünetel' : 'fut'} · ${recorderState.count || 0} lépés` : '';
}

function recordedEventToBlock(ev) {
  const target = ev.target || null;

  // A Record csak egy gyors blokk-generátor. A létrejövő blokkok ne legyenek
  // külön, lezárt/record-only objektumok: ugyanazt a sémát kapják, mint a
  // kézzel hozzáadott blokkok. Így a középső inline mezők, jobb oldali
  // inspector, mozgatás és törlés ugyanúgy működik rajtuk.
  if (ev.type === 'click') {
    const b = BF.newBlock('click');
    b.target = target;
    b.targetMode = 'manual';
    b.confirmRisky = false;
    return b;
  }
  if (ev.type === 'fill') {
    const b = BF.newBlock('fill');
    b.target = target;
    b.value = ev.sensitive ? '' : String(ev.value ?? '');
    b.fillMode = 'framework';
    b.blurAfter = true;
    b.shadowSearch = true;
    return b;
  }
  if (ev.type === 'keyPress') {
    const b = BF.newBlock('keyPress');
    b.target = null;
    b.key = ev.key || 'Enter';
    b.ctrl = Boolean(ev.ctrl);
    b.alt = Boolean(ev.alt);
    b.shift = Boolean(ev.shift);
    b.meta = Boolean(ev.meta);
    return b;
  }
  if (ev.type === 'wait') {
    const b = BF.newBlock('wait');
    b.waitMode = 'time';
    b.ms = Number(ev.ms || 1000);
    return b;
  }
  return null;
}

function normalizeRecordedEvents(events) {
  const out = [];
  let lastTs = 0;
  for (const ev of events || []) {
    if (lastTs && ev.ts && ev.ts - lastTs > 1500) out.push({ type:'wait', ms: Math.min(5000, Math.round((ev.ts - lastTs) / 500) * 500) });
    const b = recordedEventToBlock(ev);
    if (b) out.push(b);
    if (ev.ts) lastTs = ev.ts;
  }
  return out;
}

function appendRecordedBlocks(events) {
  const blocks = normalizeRecordedEvents(events);
  if (!blocks.length) return 0;
  if (!hasAnyStarter()) activeWorkflow.blocks.push(BF.newBlock('trigger'));
  activeWorkflow.blocks.push(...blocks);
  selectedBlockId = blocks[blocks.length - 1].id;
  markDirty();
  renderAll();
  return blocks.length;
}

async function startRecording() {
  try {
    await saveCurrent();
    const res = await BF.sendToTarget({ type:'BF_START_RECORDING' }, targetTabId);
    if (!res.ok || res.response?.ok === false) throw new Error(res.response?.error || res.error || 'Record indítása sikertelen.');
    recorderState = { active:true, paused:false, startedAt:Date.now(), count:0 };
    renderRecordControls();
    $('#log').textContent = 'Record elindult. A céloldalon végzett kattintások, mezőkitöltések és fő billentyűk rögzülnek.';
  } catch (err) { alert(err.message || String(err)); }
}

async function toggleRecordingPause() {
  if (!recorderState.active) return;
  try {
    const paused = !recorderState.paused;
    const res = await BF.sendToTarget({ type:'BF_PAUSE_RECORDING', paused }, targetTabId);
    if (!res.ok || res.response?.ok === false) throw new Error(res.response?.error || res.error || 'Record szüneteltetés sikertelen.');
    recorderState.paused = paused;
    renderRecordControls();
  } catch (err) { alert(err.message || String(err)); }
}

async function stopRecording() {
  if (!recorderState.active) return;
  try {
    const res = await BF.sendToTarget({ type:'BF_STOP_RECORDING' }, targetTabId);
    if (!res.ok || res.response?.ok === false) throw new Error(res.response?.error || res.error || 'Record leállítása sikertelen.');
    const events = res.response?.events || [];
    const added = appendRecordedBlocks(events);
    recorderState = { active:false, paused:false, startedAt:0, count:0 };
    renderRecordControls();
    $('#log').textContent = `Record leállt. ${events.length} műveletből ${added} blokk készült.`;
  } catch (err) {
    recorderState = { active:false, paused:false, startedAt:0, count:0 };
    renderRecordControls();
    alert(err.message || String(err));
  }
}

function renderWorkflowList() {
  $('#workflowList').innerHTML = workflows.map(w => `<div class="list-item ${w.id===activeWorkflow.id?'selected':''}" data-workflow-row="${w.id}">
    <div class="list-title">${escapeHtml(w.name)}</div>
    <div class="muted">${BF.countBlocks ? BF.countBlocks(w.blocks) : (w.blocks||[]).length} blokk ${w.imported?' · importált':''} ${w.verified===false?' · nem ellenőrzött':''}</div>
    <div class="split" style="margin-top:8px"><button class="small" data-open="${w.id}">Megnyitás</button><button class="small danger" data-delwf="${w.id}">Törlés</button></div>
  </div>`).join('');
  document.querySelectorAll('[data-workflow-row]').forEach(row => row.onclick = async (e) => {
    if (e.target.closest('button')) return;
    await selectWorkflow(row.dataset.workflowRow);
  });
  document.querySelectorAll('[data-open]').forEach(b => b.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    await selectWorkflow(b.dataset.open);
  });
  document.querySelectorAll('[data-delwf]').forEach(b => b.onclick = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (workflows.length < 2) return alert('Legalább egy automatizmusnak maradnia kell.');
    if (!confirm('Törlöd ezt az automatizmust?')) return;
    const deletedCurrent = activeWorkflow?.id === b.dataset.delwf;
    workflows = workflows.filter(w => w.id !== b.dataset.delwf);
    activeWorkflow = deletedCurrent ? workflows[0] : (workflows.find(w => w.id === activeWorkflow?.id) || workflows[0]);
    normalizeWorkflow(activeWorkflow);
    selectedBlockId = firstBlock(activeWorkflow.blocks)?.id || null;
    await chrome.storage.local.set({ workflows, activeWorkflowId: activeWorkflow.id });
    isDirty = false;
    renderAll();
  });
}

function renderPalette() {
  const selectedInfo = findBlock(selectedBlockId);
  const selected = selectedInfo?.block;
  const grouped = {};
  BF.PALETTE.forEach(p => (grouped[p.cat] ||= []).push(p));
  const needsStarter = !hasAnyStarter();
  const hint = needsStarter
    ? `<div class="status warning-soft"><b>Válassz indítást.</b><br>Új automatizmusnál először kötelező egy indító blokk: Indítás, Figyelő trigger, Kattintás trigger vagy Időzített indítás. Addig más blokk nem adható hozzá.</div>`
    : (selected
      ? `<div class="status">Új blokk kattintásra a kijelölt blokk után kerül: <b>${escapeHtml(BF.BLOCKS[selected.type]?.name || selected.type)}</b>. Konténer belsejébe továbbra is húzással teheted.</div>`
      : `<div class="status muted">Nincs kijelölt blokk: az új blokk a workflow végére kerül. Jelölj ki egy blokkot, ha utána szeretnél beszúrni.</div>`);
  const controls = `<div class="palette-tools"><button class="small" id="paletteOpenAll">Mind nyitása</button><button class="small" id="paletteCloseAll">Mind zárása</button></div>`;
  $('#palette').innerHTML = hint + controls + Object.entries(grouped).map(([cat, items]) => {
    const collapsed = Boolean(paletteCollapsed[cat]);
    return `<div class="palette-category ${collapsed ? 'collapsed' : ''}" data-palette-cat="${escapeAttr(cat)}">
      <button class="section-title palette-category-title" data-toggle-palette="${escapeAttr(cat)}" title="Kategória nyitása/zárása"><span>${collapsed ? '▸' : '▾'}</span><b>${escapeHtml(cat)}</b><small>${items.length}</small></button>
      <div class="palette-category-body" ${collapsed ? 'hidden' : ''}>${items.map(item => {
        const canAddConditionByClick = item.type.startsWith('condition') && (['triggerGroup','conditionGroup'].includes(selected?.type) || ['triggerGroup','conditionGroup'].includes(selectedInfo?.parent?.type) || Boolean(findSingleTriggerGroup()));
        const disabled = (needsStarter && !['trigger','triggerGroup','clickTrigger','scheduledTrigger'].includes(item.type)) || (item.type.startsWith('condition') && !canAddConditionByClick);
        return `<button class="palette-btn ${disabled?'disabled':''}" data-add="${item.type}" draggable="${disabled ? 'false' : 'true'}" ${disabled?'disabled title="Először válassz indító blokkot, figyelő feltételnél pedig jelölj ki egy Figyelő triggert vagy feltételt."':'title="Kattints a kijelölt blokk után beszúráshoz, vagy húzd be a megfelelő helyre."'}><span>${BF.BLOCKS[item.type].name}</span><span>+</span></button>`;
      }).join('')}</div>
    </div>`;
  }).join('');
  document.querySelectorAll('[data-toggle-palette]').forEach(btn => btn.onclick = () => {
    const cat = btn.dataset.togglePalette;
    paletteCollapsed[cat] = !paletteCollapsed[cat];
    localStorage.setItem('bf_palette_collapsed', JSON.stringify(paletteCollapsed));
    renderPalette();
  });
  const openAll = $('#paletteOpenAll'); if (openAll) openAll.onclick = () => { paletteCollapsed = {}; localStorage.setItem('bf_palette_collapsed', JSON.stringify(paletteCollapsed)); renderPalette(); };
  const closeAll = $('#paletteCloseAll'); if (closeAll) closeAll.onclick = () => { Object.keys(grouped).forEach(cat => paletteCollapsed[cat] = true); localStorage.setItem('bf_palette_collapsed', JSON.stringify(paletteCollapsed)); renderPalette(); };
  document.querySelectorAll('[data-add]').forEach(b => {
    b.onclick = () => addBlock(b.dataset.add);
    b.ondragstart = e => {
      if (b.disabled || b.classList.contains('disabled')) { e.preventDefault(); return; }
      e.dataTransfer.setData('text/plain', `new:${b.dataset.add}`);
      e.dataTransfer.effectAllowed = 'copy';
    };
  });
}

function addBlock(type) {
  const isStarter = ['trigger','triggerGroup','clickTrigger','scheduledTrigger'].includes(type);
  if (!hasAnyStarter() && !isStarter) return alert('Először válassz indító blokkot: Indítás, Figyelő trigger, Kattintás trigger vagy Időzített indítás.');
  if (type === 'trigger' && containsType(activeWorkflow.blocks, 'trigger')) return alert('Egy manuális indító blokk már van a workflow-ban.');

  const selectedInfo = findBlock(selectedBlockId);
  const selected = selectedInfo?.block;
  const block = BF.newBlock(type);

  const insertAt = (list, index, previous) => {
    autoPrefillBlock(block, previous || null);
    list.splice(index, 0, block);
  };

  if (type.startsWith('condition')) {
    if (selectedInfo?.parent && ['triggerGroup','conditionGroup'].includes(selectedInfo.parent.type)) {
      insertAt(selectedInfo.list, selectedInfo.index + 1, selectedInfo.block);
    } else if (selected && ['triggerGroup','conditionGroup'].includes(selected.type)) {
      selected.children ||= [];
      insertAt(selected.children, selected.children.length, selected.children[selected.children.length - 1] || selected);
    } else {
      const targetTrigger = findSingleTriggerGroup();
      if (!targetTrigger) return alert('Figyelő feltételt csak Figyelő trigger alá lehet tenni. Jelöld ki a Figyelő triggert, feltételcsoportot vagy egy meglévő feltételt, esetleg húzd be a feltételt a trigger alá.');
      targetTrigger.children ||= [];
      insertAt(targetTrigger.children, targetTrigger.children.length, targetTrigger.children[targetTrigger.children.length - 1] || targetTrigger);
    }
  } else if (selectedInfo) {
    const containerId = selectedInfo.parent ? (selectedInfo.parent.elseChildren === selectedInfo.list ? `else:${selectedInfo.parent.id}` : selectedInfo.parent.id) : 'root';
    if (canPlaceBlockInContainer(block, containerId, true)) {
      insertAt(selectedInfo.list, selectedInfo.index + 1, selectedInfo.block);
    } else {
      const top = topLevelAncestorInfo(selectedBlockId);
      if (top) insertAt(activeWorkflow.blocks, top.index + 1, top.block);
      else insertAt(activeWorkflow.blocks, activeWorkflow.blocks.length, activeWorkflow.blocks[activeWorkflow.blocks.length - 1] || null);
    }
  } else {
    insertAt(activeWorkflow.blocks, activeWorkflow.blocks.length, activeWorkflow.blocks[activeWorkflow.blocks.length - 1] || null);
  }

  selectedBlockId = block.id;
  markDirty();
  renderAll();
}

function blockPrimaryOutput(block) {
  if (!block) return null;
  const token = name => `{{${name}}}`;
  if (block.type === 'extract') return { kind:'text', varName:block.varName || 'adat', token:token(block.varName || 'adat') };
  if (block.type === 'textSearch') return { kind:'elementText', varName:block.resultName || 'szoveg_talalat', token:token(block.selectorName || 'szoveg_talalat_selector'), textToken:token(block.contextName || 'szoveg_talalat_szoveg'), elementVar:block.elementName || 'szoveg_talalat_elem', selectorVar:block.selectorName || 'szoveg_talalat_selector', xpathVar:block.xpathName || 'szoveg_talalat_xpath', primaryTargetMode:'selector', primaryTargetVar:block.selectorName || 'szoveg_talalat_selector' };
  if (block.type === 'screenshot') return { kind:'image', varName:block.resultName || 'screenshot_data_url', token:token(block.resultName || 'screenshot_data_url') };
  if (block.type === 'userInput') return { kind:'text', varName:block.resultName || 'user_input', token:token(block.resultName || 'user_input') };
  if (block.type === 'userChoice') return { kind:'text', varName:block.resultName || 'valasztas', token:token(block.resultName || 'valasztas') };
  if (['transform','textSlice','regex','tableExtract','clipboardRead','localGet','compare','math','returnResult'].includes(block.type) && (block.resultName || block.varName)) return { kind:'text', varName:block.resultName || block.varName, token:token(block.resultName || block.varName) };
  if (block.type === 'findElements') return { kind:'elements', varName:block.resultName || 'talalatok', token:token(block.countName || 'talalat_db') };
  return null;
}

function autoPrefillBlock(block, previous) {
  const out = blockPrimaryOutput(previous);
  if (!block || !out) return;
  const token = out.token || '';
  const textToken = out.textToken || token;
  if (['transform','textSlice','regex','mask','validateData'].includes(block.type) && textToken) block.source = textToken;
  if (block.type === 'copy' && textToken) block.value = textToken;
  if (block.type === 'fill' && textToken) block.value = textToken;
  if (block.type === 'email' && textToken) block.body = textToken;
  if (block.type === 'pdfText' && textToken) block.text = textToken;
  if (block.type === 'pdfScreenshot' && out.kind === 'image') { block.source = 'variable'; block.dataVar = out.varName; }
  if ((block.type === 'click' || block.type === 'scroll' || block.type === 'preflight' || block.type === 'selectOption') && (out.selectorVar || out.elementVar)) { block.targetMode = out.primaryTargetMode || (out.selectorVar ? 'selector' : 'last'); block.targetVar = out.primaryTargetVar || out.selectorVar || out.elementVar; }
  if (block.type === 'ifBlock' && previous?.type === 'textSearch') { block.conditionMode = 'textExists'; block.text = `{{${previous.contextName || 'szoveg_talalat_szoveg'}}`; }
}

function findSingleTriggerGroup() {
  const groups = [];
  walk(activeWorkflow.blocks || [], b => { if (b.type === 'triggerGroup') groups.push(b); });
  return groups.length === 1 ? groups[0] : null;
}

function canPlaceBlockInContainer(block, containerId, silent = false) {
  if (!block) return false;
  if (!containerId || containerId === 'root') {
    if (String(block.type || '').startsWith('condition')) {
      if (!silent) alert('Figyelő feltétel csak Figyelő trigger alá kerülhet.');
      return false;
    }
    return true;
  }
  const realContainerId = String(containerId).startsWith('else:') ? String(containerId).slice(5) : containerId;
  const target = findBlock(realContainerId)?.block;
  if (!target || !CONTAINERS.has(target.type)) return false;
  const isCondition = String(block.type || '').startsWith('condition');
  const isWatcherConditionContainer = target.type === 'triggerGroup' || target.type === 'conditionGroup';
  if (isWatcherConditionContainer && !isCondition) {
    if (!silent) alert('A Figyelő trigger/feltételcsoport alá csak figyelő feltétel blokkok húzhatók.');
    return false;
  }
  if (!isWatcherConditionContainer && isCondition) {
    if (!silent) alert('Figyelő feltétel csak Figyelő trigger vagy Feltételcsoport alá kerülhet.');
    return false;
  }
  return true;
}

function createBlockInContainer(type, containerId) {
  const block = BF.newBlock(type);
  if (!canPlaceBlockInContainer(block, containerId)) return;
  const list = listForContainer(containerId);
  if (!list) return;
  autoPrefillBlock(block, list[list.length - 1] || findBlock(containerId)?.block);
  list.push(block);
  selectedBlockId = block.id;
  markDirty();
  renderAll();
}

function topLevelAncestorInfo(id) {
  let current = findBlock(id);
  if (!current) return null;
  while (current.parent) {
    const parentInfo = findBlock(current.parent.id);
    if (!parentInfo) break;
    current = parentInfo;
  }
  return current;
}

function containsType(blocks, type) {
  let found = false;
  walk(blocks, b => { if (b.type === type) found = true; });
  return found;
}

function isStarterBlock(b) {
  return b && (b.type === 'trigger' || (b.type === 'triggerGroup' && b.triggerEnabled !== false) || (b.type === 'clickTrigger' && b.triggerEnabled !== false) || (b.type === 'scheduledTrigger' && b.triggerEnabled !== false));
}

function starterCount(blocks = activeWorkflow.blocks) {
  let n = 0;
  walk(blocks, b => { if (isStarterBlock(b)) n++; });
  return n;
}

function canDeleteBlock(b) {
  if (!b) return false;
  if (isStarterBlock(b)) return starterCount() > 1;
  return true;
}

function walk(blocks, fn) {
  for (const b of blocks || []) {
    fn(b);
    if (Array.isArray(b.children)) walk(b.children, fn);
    if (Array.isArray(b.elseChildren)) walk(b.elseChildren, fn);
  }
}

function renderBlocks() {
  $('#workflowName').value = activeWorkflow.name;
  $('#blocks').innerHTML = `<div class="drop-zone root-drop" data-drop-container="root">Workflow gyökér szint</div>` +
    renderBlockList(activeWorkflow.blocks, 0, null) +
    `<div class="drop-zone root-drop" data-drop-container="root">Ide húzhatsz blokkot a fő szintre</div>`;
  bindBlockEvents();
}

function isWatcherOnlyBlockType(type) { return ['conditionText','conditionElement','conditionField','conditionUrl','conditionChange','conditionGroup'].includes(type); }
function canOutdentToRoot(block, parentId) {
  if (!parentId) return false;
  if (String(parentId).startsWith('else:')) return true;
  if (isWatcherOnlyBlockType(block.type)) return false;
  return true;
}
function blockActionButtons(b, idx, total, parentId) {
  const parts = [];
  if (idx > 0) {
    parts.push(`<button class="small" title="Legfelülre" data-top="${b.id}">⇈</button>`);
    parts.push(`<button class="small" title="Fel" data-up="${b.id}">↑</button>`);
  }
  if (idx < total - 1) {
    parts.push(`<button class="small" title="Le" data-down="${b.id}">↓</button>`);
    parts.push(`<button class="small" title="Legalulra" data-bottom="${b.id}">⇊</button>`);
  }
  if (canOutdentToRoot(b, parentId)) parts.push(`<button class="small" title="Kihúzás fő szintre" data-outdent="${b.id}">⇤</button>`);
  if (canDeleteBlock(b)) parts.push(`<button class="small danger" title="Törlés" data-del="${b.id}">×</button>`);
  return parts.join('');
}

function groupChildIconSummary(b) {
  const children = Array.isArray(b.children) ? b.children : [];
  if (!children.length) return '<span class="group-mini muted">üres</span>';
  const max = 14;
  const icons = children.slice(0, max).map(child => `<span class="group-mini-icon" title="${escapeAttr(BF.blockTitle(child))}">${escapeHtml(blockIcon(child))}</span>`).join('');
  const more = children.length > max ? `<span class="group-mini more">+${children.length - max}</span>` : '';
  return `<div class="group-collapsed-icons" title="A csoportban lévő blokkok ikonjai">${icons}${more}</div>`;
}

function renderBlockList(blocks, level, parentId) {
  if (!blocks || !blocks.length) return level ? '<div class="empty nested-empty">Húzz ide blokkokat, vagy jelöld ki a konténert és adj hozzá blokkot a bal oldalon.</div>' : '<div class="empty starter-empty"><b>Válassz indítást a bal oldalon.</b><br>Indítás vagy Figyelő trigger szükséges az automatizmushoz.</div>';
  return blocks.map((b, idx) => {
    let childHtml = '';
    if (CONTAINERS.has(b.type)) {
      const isCollapsedGroup = b.type === 'groupBlock' && b.collapsed === true;
      childHtml = isCollapsedGroup
        ? `<div class="container-body group-collapsed" data-drop-container="${b.id}">
            <div class="container-label">CSOPORT ÖSSZECSUKVA - a benne lévő blokkok ikonként látszanak</div>
            ${groupChildIconSummary(b)}
          </div>`
        : `<div class="container-body" data-drop-container="${b.id}">
        <div class="container-label">${b.type === 'triggerGroup' ? 'FIGYELŐ FELTÉTELEK - ezek döntik el, indul-e az automatizmus' : (b.type === 'conditionGroup' ? 'FELTÉTELCSOPORT - ide további figyelő feltételek kerülnek' : (b.type === 'ifBlock' ? 'HA IGAZ - behúzott blokkok' : (b.type === 'tryBlock' ? 'PRÓBÁLD MEG - behúzott blokkok' : (b.type === 'groupBlock' ? 'CSOPORT BLOKKJAI' : 'A blokk hatása alá tartozó behúzott blokkok'))))}</div>
        ${renderBlockList(b.children || [], level + 1, b.id)}
      </div>`;
      if (b.type === 'ifBlock' || b.type === 'tryBlock') {
        childHtml += `<div class="container-body else-body" data-drop-container="else:${b.id}">
          <div class="container-label">${b.type === 'tryBlock' ? 'HIBA ESETÉN - behúzott blokkok' : 'KÜLÖNBEN - behúzott blokkok'}</div>
          ${renderBlockList(b.elseChildren || [], level + 1, `else:${b.id}`)}
        </div>`;
      }
    }
    return `<div class="block-wrap" data-wrap="${b.id}" style="--level:${level}">
      <div class="block block-${b.type} ${b.id===selectedBlockId?'selected':''} ${b.type === 'groupBlock' && b.groupEnabled === false ? 'group-disabled' : ''} ${b.type === 'groupBlock' && b.collapsed === true ? 'group-is-collapsed' : ''}" draggable="true" data-block="${b.id}" data-parent="${parentId || 'root'}">
        <div class="block-actions">
          ${blockActionButtons(b, idx, blocks.length, parentId)}
        </div>
        <div class="shortcut-line"><span class="block-icon">${blockIcon(b)}</span><span class="block-title">${escapeHtml(BF.blockTitle(b))}</span></div>
        <div class="block-inline">${blockInline(b)}</div>
        <div class="block-desc">${escapeHtml(BF.blockDesc(b))}</div>
        ${blockOutputHtml(b)}
      </div>
      ${childHtml}
    </div>`;
  }).join('');
}

function blockOutputHtml(b) {
  const out = blockPrimaryOutput(b);
  if (!out) return '';
  const chips = [];
  if (out.varName) chips.push(`{{${escapeHtml(out.varName)}}}`);
  if (out.elementVar) chips.push(`elem: {{${escapeHtml(out.elementVar)}}}`);
  if (out.selectorVar) chips.push(`selector: {{${escapeHtml(out.selectorVar)}}}`);
  if (!chips.length) return '';
  return `<div class="block-output"><span>Továbbadja:</span>${chips.map(c => `<b>${c}</b>`).join('')}</div>`;
}

function blockIcon(b) {
  const map = { trigger:'▶', triggerGroup:'◎', clickTrigger:'☝', scheduledTrigger:'⏲', conditionText:'T', conditionElement:'◇', conditionField:'▣', conditionUrl:'URL', conditionChange:'Δ', conditionGroup:'∧∨', click:'⌁', fill:'✎', selectOption:'▾', injectCss:'CSS', extract:'⇣', wait:'⏱', waitUntil:'⏳', waitLoad:'⌛', ifBlock:'?', repeatBlock:'↻', retryBlock:'⟳', tryBlock:'⚑', popupWait:'▣', popupExtract:'▣', popupClick:'▣', popupWindowWait:'◱', popupWindowExtract:'⇣', popupWindowClose:'×', copy:'⧉', clipboardRead:'⧉', email:'✉', emailTemplate:'✉', emailPreview:'✉', openEmail:'↗', rowLoop:'≡', elementLoop:'⋮', tableExtract:'▦', mask:'◩', transform:'A', textSlice:'✂', regex:'.*', textSearch:'⌕', errorSearch:'⚠', fieldByLabel:'🏷', setVar:'=', userPrompt:'💬', pageButton:'▣', userInput:'⌨', userChoice:'☑', systemNotify:'🔔', scroll:'↕', keyPress:'⌨', openUrl:'↗', pageInfo:'ⓘ', screenshot:'▣', pdfStart:'PDF', pdfText:'¶', pdfTable:'▦', pdfScreenshot:'▣', pdfPageBreak:'↡', pdfSave:'⬇', docxStart:'DOCX', docxText:'¶', docxTable:'▦', docxScreenshot:'▣', docxPageBreak:'↡', docxSave:'⬇', preflight:'✓', localSet:'⬇', localGet:'⬆', compare:'=', math:'#', iframeBlock:'▤', findElements:'◇', validateData:'✓', comment:'//', groupBlock:'▣', callWorkflow:'↪', returnResult:'↩', stopRun:'■', sound:'♪' };
  return map[b.type] || '•';
}
function inlineChip(label, value) { return `<span class="inline-chip"><span>${escapeHtml(label)}</span><b>${escapeHtml(value || '—')}</b></span>`; }
function inlineInput(field, value, placeholder='', cls='') { return `<input class="inline-input ${cls}" data-inline-field="${field}" value="${escapeAttr(value ?? '')}" placeholder="${escapeAttr(placeholder)}">`; }
function inlineNumber(field, value, placeholder='', cls='tiny') { return `<input class="inline-input ${cls}" type="number" data-inline-field="${field}" value="${escapeAttr(value ?? '')}" placeholder="${escapeAttr(placeholder)}">`; }
function inlineCheck(field, checked, label) { return `<label class="inline-check"><input type="checkbox" data-inline-check="${field}" ${checked ? 'checked' : ''}> ${escapeHtml(label)}</label>`; }
function inlineSelect(field, value, options, cls='') {
  const opts = Array.isArray(options) ? options : [];
  return `<select class="inline-select ${cls}" data-inline-field="${field}">${opts.map(([v,l])=>`<option value="${escapeAttr(v)}" ${v===value?'selected':''}>${escapeHtml(l)}</option>`).join('')}</select>`;
}
function inlinePick(b, label='Cél elem') { return `<button class="inline-pick ${b.target ? 'has-target' : ''}" data-inline-pick="target" title="Elem kiválasztása az oldalról"><span>${escapeHtml(label)}</span><b>${escapeHtml(targetLabel(b))}</b></button>`; }
function inlineTargetSource(b) { return `${inlineSelect('targetMode', b.targetMode || 'manual', [['manual','kézi elem'],['last','előző találat'],['var','elem változó'],['selector','selector változó'],['xpath','XPath változó']])}${(b.targetMode === 'var' || b.targetMode === 'selector' || b.targetMode === 'xpath') ? inlineInput('targetVar', b.targetVar || (b.targetMode === 'selector' ? 'szoveg_talalat_selector' : b.targetMode === 'xpath' ? 'szoveg_talalat_xpath' : 'szoveg_talalat_elem'), 'változó') : ''}`; }
function inlineOpenInspector(label='Bővített') { return `<button class="inline-more" data-inline-more="1" title="Bővített beállítások a jobb oldalon">${escapeHtml(label)}</button>`; }
function targetLabel(b) { return b.target ? (b.target.label || b.target.tag || 'kiválasztott elem') : 'nincs cél'; }
function scopeLabel(scope) {
  return ({ domain:'domain', path:'domain + path', exact:'pontos URL', contains:'URL tartalmazza', any:'bármely oldal' })[scope || 'domain'] || 'domain';
}
function scopeDetailValue(b) {
  const scope = b.scope || 'domain';
  if (scope === 'domain') return b.domain || currentTargetHost || '';
  if (scope === 'path') return `${b.domain || currentTargetHost || ''}${b.path || currentTargetPath || '/'}`;
  if (scope === 'exact') return b.url || currentTargetUrl || '';
  if (scope === 'contains') return b.urlContains || '';
  return 'minden oldal';
}
function watchScopeInline(b) {
  const scope = b.scope || 'domain';
  const scopeSelect = inlineSelect('scope', scope, [['domain','domain'],['path','domain+path'],['exact','pontos URL'],['contains','URL tartalmazza'],['any','bármely']]);
  if (scope === 'domain') return `${scopeSelect} ${inlineInput('domain', b.domain || currentTargetHost || '', 'domain', 'medium')}`;
  if (scope === 'path') return `${scopeSelect} ${inlineInput('domain', b.domain || currentTargetHost || '', 'domain', 'medium')} ${inlineInput('path', b.path || currentTargetPath || '/', 'path prefix', 'medium')}`;
  if (scope === 'exact') return `${scopeSelect} ${inlineInput('url', b.url || currentTargetUrl || '', 'pontos URL', 'wide')}`;
  if (scope === 'contains') return `${scopeSelect} ${inlineInput('urlContains', b.urlContains || '', 'URL részlet', 'wide')}`;
  return scopeSelect;
}
function blockInline(b) {
  if (b.type === 'triggerGroup') return `${inlineCheck('triggerEnabled', b.triggerEnabled !== false, 'aktív')} ${inlineSelect('logic', b.logic || 'all', [['all','minden feltétel'],['any','bármelyik feltétel'],['none','egyik sem']])} ${watchScopeInline(b)} ${inlineNumber('intervalSec', b.intervalSec || 2, 'ellenőrzés mp')} ${inlineNumber('throttleSec', b.throttleSec || 15, 'szünet mp')}`;
  if (b.type === 'clickTrigger') return `${inlineCheck('triggerEnabled', b.triggerEnabled !== false, 'aktív')} ${inlinePick(b)} ${watchScopeInline(b)} ${inlineNumber('throttleSec', b.throttleSec || 15, 'szünet mp')}`;
  if (b.type === 'conditionText') return `${inlineInput('text', b.text || '', 'figyelt szöveg/karakter', 'wide')} ${inlineCheck('caseSensitive', Boolean(b.caseSensitive), 'kis/nagybetű')}`;
  if (b.type === 'conditionElement') return `${inlinePick(b)} ${inlineCheck('requireVisible', b.requireVisible !== false, 'látható')}`;
  if (b.type === 'conditionField') return `${inlinePick(b, 'Mező')} ${inlineSelect('operator', b.operator || 'contains', [['contains','tartalmazza'],['notContains','nem tartalmazza'],['equals','pontosan'],['notEquals','nem pontosan'],['empty','üres'],['notEmpty','nem üres'],['startsWith','ezzel kezdődik'],['endsWith','ezzel végződik']])} ${['empty','notEmpty'].includes(b.operator || 'contains') ? '' : inlineInput('value', b.value || '', 'érték')}`;
  if (b.type === 'conditionUrl') return `${inlineSelect('operator', b.operator || 'contains', [['contains','tartalmazza'],['notContains','nem tartalmazza'],['equals','pontosan'],['notEquals','nem pontosan'],['startsWith','ezzel kezdődik'],['endsWith','ezzel végződik']])} ${inlineInput('value', b.value || '', 'URL érték', 'wide')}`;
  if (b.type === 'conditionChange') return `${inlinePick(b, 'Forrás')} ${inlineSelect('changeMode', b.changeMode || 'fromTo', [['fromTo','miről → mire'],['anyTo','bármiről → mire'],['fromAny','miről → bármire'],['anyChange','bármilyen változás']])} ${['fromTo','fromAny'].includes(b.changeMode || 'fromTo') ? inlineInput('fromValue', b.fromValue || '', 'miről') : ''} ${['fromTo','anyTo'].includes(b.changeMode || 'fromTo') ? inlineInput('toValue', b.toValue || '', 'mire') : ''} ${inlineSelect('operator', b.operator || 'equals', [['equals','pontosan'],['contains','tartalmazza'],['regex','regex']])} ${inlineCheck('caseSensitive', Boolean(b.caseSensitive), 'kis/nagybetű')}`;

  if (b.type === 'conditionGroup') return `${inlineSelect('logic', b.logic || 'all', [['all','minden feltétel'],['any','bármelyik feltétel'],['none','egyik sem']])} ${(b.children || []).length} feltétel`;
  if (b.type === 'pdfStart') return `${inlineInput('fileName', b.fileName || 'riport.pdf', 'fájlnév', 'wide')} ${inlineSelect('pageSize', b.pageSize || 'a4', [['a4','A4'],['letter','Letter'],['legal','Legal']])} ${inlineSelect('orientation', b.orientation || 'portrait', [['portrait','álló'],['landscape','fekvő']])}`;
  if (b.type === 'pdfText') return `${inlineInput('heading', b.heading || '', 'címsor')} ${inlineInput('text', b.text || '', 'szöveg', 'wide')}`;
  if (b.type === 'pdfTable') return `${inlineInput('title', b.title || 'Adatok', 'táblázat címe')} ${inlineCheck('border', b.border !== false, 'szegély')}`;
  if (b.type === 'pdfScreenshot') return `${inlineSelect('source', b.source || 'current', [['current','aktuális oldal'],['last','utolsó screenshot'],['variable','változó']])} ${inlineInput('caption', b.caption || '', 'felirat')} ${inlineSelect('sizeMode', b.sizeMode || 'fitWidth', [['fitWidth','teljes szélesség'],['original','eredeti'],['fitPage','oldalhoz igazítva']])}`;
  if (b.type === 'pdfPageBreak') return `${inlineCheck('onlyIfLowSpace', Boolean(b.onlyIfLowSpace), 'csak ha kevés hely van')}`;
  if (b.type === 'pdfSave') return `${inlineSelect('action', b.action || 'downloadPreview', [['download','letöltés'],['preview','előnézet'],['downloadPreview','letöltés + előnézet']])} ${inlineInput('fileName', b.fileName || '{{today}}_riport.pdf', 'fájlnév', 'wide')}`;
  if (b.type === 'docxStart') return `${inlineInput('fileName', b.fileName || 'riport.docx', 'fájlnév', 'wide')} ${inlineSelect('pageSize', b.pageSize || 'a4', [['a4','A4'],['letter','Letter']])} ${inlineSelect('orientation', b.orientation || 'portrait', [['portrait','álló'],['landscape','fekvő']])}`;
  if (b.type === 'docxText') return `${inlineInput('heading', b.heading || '', 'címsor')} ${inlineInput('text', b.text || '', 'szöveg', 'wide')}`;
  if (b.type === 'docxTable') return `${inlineInput('title', b.title || 'Adatok', 'táblázat címe')} ${inlineCheck('border', b.border !== false, 'szegély')}`;
  if (b.type === 'docxScreenshot') return `${inlineSelect('source', b.source || 'current', [['current','aktuális oldal'],['last','utolsó screenshot'],['variable','változó']])} ${inlineInput('caption', b.caption || '', 'felirat')} ${inlineNumber('width', b.width || 600, 'szélesség px')}`;
  if (b.type === 'docxPageBreak') return 'Új oldal beszúrása a DOCX dokumentumba';
  if (b.type === 'docxSave') return `${inlineInput('fileName', b.fileName || '{{today}}_riport.docx', 'fájlnév', 'wide')}`;
  if (b.type === 'click') return `${inlineTargetSource(b)} ${b.targetMode && b.targetMode !== 'manual' ? '' : inlinePick(b)} ${inlineCheck('confirmRisky', b.confirmRisky !== false, 'megerősítés')}`;
  if (b.type === 'fill') return `${inlinePick(b, 'Hova')} ${inlineInput('value', b.value || '', 'mit illesszen be', 'wide')} ${inlineSelect('fillMode', b.fillMode || 'framework', [['framework','framework mód'],['simple','egyszerű'],['typing','gépelés'],['paste','paste event']])}`;
  if (b.type === 'selectOption') return `${inlinePick(b, 'Dropdown')} ${inlineInput('optionText', b.optionText || '', 'opció szövege', 'wide')} ${inlineSelect('matchMode', b.matchMode || 'contains', [['contains','tartalmazza'],['equals','pontosan'],['starts','ezzel kezdődik']])}`;
  if (b.type === 'injectCss') return `${inlineSelect('mode', b.mode || 'add', [['add','CSS hozzáadása'],['remove','CSS eltávolítása']])} ${inlineInput('styleId', b.styleId || 'blockflow-custom-style', 'stílus azonosító')} ${b.mode === 'remove' ? '' : inlineInput('cssText', b.cssText || '', 'CSS szabályok', 'wide')} ${inlineCheck('replaceExisting', b.replaceExisting !== false, 'felülír')}`;
  if (b.type === 'extract') return `${inlinePick(b, 'Honnan')} ${inlineSelect('extractMode', b.extractMode || 'auto', [['auto','automatikus'],['value','mezőérték'],['text','szöveg'],['html','HTML'],['attribute','attribútum']])} ${inlineSelect('searchScope', b.searchScope || 'dom', [['dom','teljes DOM'],['visible','látható']])} ${inlineInput('varName', b.varName || 'adat', 'változó neve')}`;
  if (b.type === 'wait') return `${inlineSelect('waitMode', b.waitMode || 'time', [['time','idő'],['text','szöveg'],['element','elem']])} ${b.waitMode === 'time' ? inlineNumber('ms', b.ms || 1000, 'ms') : b.waitMode === 'text' ? inlineInput('text', b.text || '', 'várt szöveg', 'wide') : inlinePick(b)} ${inlineNumber('timeoutMs', b.timeoutMs || 5000, 'timeout')}`;
  if (b.type === 'ifBlock') return `${inlineSelect('conditionMode', b.conditionMode || 'textExists', [['textExists','szöveg létezik'],['elementExists','elem létezik'],['valueContains','érték tartalmazza']])} ${b.conditionMode === 'textExists' ? inlineInput('text', b.text || '', 'keresett szöveg', 'wide') : inlinePick(b)} ${b.conditionMode === 'valueContains' ? inlineInput('value', b.value || '', 'keresett érték') : ''}`;
  if (b.type === 'repeatBlock') return `${inlineNumber('repeatCount', b.repeatCount || 2, 'alkalom')} ${inlineChip('ismétli', `${(b.children || []).length} blokk`)}`;
  if (b.type === 'copy') return inlineInput('value', b.value || '', 'másolandó szöveg/változó', 'wide');
  if (b.type === 'userPrompt') return `${inlineSelect('mode', b.mode || 'wait', [['wait','vár visszajelzésre'],['notify','csak felugró üzenet']])} ${inlineInput('title', b.title || 'BlockFlow', 'cím')} ${inlineInput('message', b.message || '', 'üzenet', 'wide')}`;
  if (b.type === 'pageButton') return `${inlineInput('label', b.label || 'Folytatás', 'gomb felirata')} ${inlineSelect('position', b.position || 'bottomRight', [['bottomRight','jobb alsó'],['bottomLeft','bal alsó'],['topRight','jobb felső'],['topLeft','bal felső'],['bottomCenter','középen alul'],['afterTarget','elem után'],['beforeTarget','elem elé']])} ${inlineSelect('waitForClick', String(b.waitForClick !== false), [['true','vár kattintásra'],['false','csak megjelenít']])}`;
  if (b.type === 'systemNotify') return `${inlineInput('title', b.title || 'BlockFlow', 'cím')} ${inlineInput('message', b.message || '', 'értesítés szövege', 'wide')}`;
  if (b.type === 'email') return `${inlineInput('to', b.to || '', 'címzett')} ${inlineInput('subject', b.subject || '', 'tárgy')} ${inlineInput('resultName', b.resultName || 'email_draft', 'draft változó')}`;
  if (b.type === 'openEmail') return `${inlineInput('draftName', b.draftName || 'email_draft', 'draft változó')} ${inlineNumber('maxUrlLength', b.maxUrlLength || 1800, 'mailto max')}`;
  if (b.type === 'mask') return `${inlineInput('source', b.source || '{{adat}}', 'forrás', 'wide')} ${inlineSelect('maskMode', b.maskMode || 'characters', [['characters','karakter'],['lines','sor']])} ${inlineCheck('invertMask', Boolean(b.invertMask), 'invert')} ${inlineCheck('clearTrim', Boolean(b.clearTrim), 'clear/trim')} ${inlineInput('resultName', b.resultName || 'maszkolt_adat', 'eredmény')}`;
  if (b.type === 'popupWait') return `${inlineNumber('timeoutMs', b.timeoutMs || 10000, 'timeout')}`;
  if (b.type === 'popupClick') return `${inlineInput('buttonText', b.buttonText || 'OK', 'gomb szövege')} ${inlineNumber('timeoutMs', b.timeoutMs || 5000, 'timeout')}`;
  if (b.type === 'popupExtract') return `${inlineSelect('extractMode', b.extractMode || 'text', [['text','teljes szöveg'],['title','cím']])} ${inlineInput('varName', b.varName || 'popup_szoveg', 'változó neve')}`;
  if (b.type === 'rowLoop') return `${inlinePick(b, 'Lista/tábla')} ${inlineInput('rowVar', b.rowVar || 'sor_szoveg', 'sor változó')} ${inlineNumber('maxRows', b.maxRows || 20, 'max')}`;
  if (b.type === 'scheduledTrigger') return `${inlineCheck('triggerEnabled', b.triggerEnabled !== false, 'aktív')} ${inlineSelect('scheduleMode', b.scheduleMode || 'interval', [['interval','percenként'],['daily','napi időpont']])} ${b.scheduleMode === 'daily' ? inlineInput('timeOfDay', b.timeOfDay || '08:00', 'HH:MM') : inlineNumber('intervalMinutes', b.intervalMinutes || 15, 'perc')}`;
  if (b.type === 'transform') return `${inlineInput('source', b.source || '{{adat}}', 'forrás', 'wide')} ${inlineSelect('operation', b.operation || 'trim', [['trim','trim'],['upper','NAGY'],['lower','kis'],['singleLine','egy sor'],['removeEmptyLines','üres sor törlés'],['digitsOnly','csak szám'],['lettersOnly','csak betű'],['noAccents','ékezet nélkül']])} ${inlineInput('resultName', b.resultName || 'atalakitott_adat', 'eredmény')}`;
  if (b.type === 'textSlice') return `${inlineInput('source', b.source || '{{adat}}', 'forrás', 'wide')} ${inlineSelect('mode', b.mode || 'between', [['between','között'],['line','sor'],['chars','karakterek']])} ${inlineInput('resultName', b.resultName || 'szovegresz', 'eredmény')}`;
  if (b.type === 'regex') return `${inlineInput('source', b.source || '{{adat}}', 'forrás')} ${inlineInput('pattern', b.pattern || '', 'regex minta', 'wide')} ${inlineInput('resultName', b.resultName || 'regex_talalat', 'eredmény')}`;
  if (b.type === 'textSearch') return `${inlineInput('query', b.query || '', 'keresett szöveg', 'wide')} ${inlineSelect('operator', b.operator || 'contains', [['contains','tartalmazza'],['equals','pontosan']])} ${inlineSelect('searchScope', b.searchScope || 'all', [['all','teljes oldal'],['visible','látható'],['dom','teljes DOM']])} ${inlineCheck('scrollSearch', Boolean(b.scrollSearch), 'görgetve is')} ${inlineCheck('caseSensitive', Boolean(b.caseSensitive), 'kis/nagybetű')} ${inlineInput('selectorName', b.selectorName || 'szoveg_talalat_selector', 'selector')}`;
  if (b.type === 'errorSearch') return `${inlineInput('textName', b.textName || 'hiba_szoveg', 'hiba szöveg változó')} ${inlineInput('selectorName', b.selectorName || 'hiba_selector', 'selector változó')}`;
  if (b.type === 'fieldByLabel') return `${inlineInput('labelText', b.labelText || '', 'mező címkéje', 'wide')} ${inlineSelect('matchMode', b.matchMode || 'contains', [['contains','tartalmazza'],['equals','pontosan']])} ${inlineInput('resultName', b.resultName || 'mezo_ertek', 'eredmény')}`;
  if (b.type === 'setVar') return `${inlineInput('varName', b.varName || 'valtozo', 'változó')} ${inlineInput('value', b.value || '', 'érték', 'wide')}`;
  if (b.type === 'userInput') return `${inlineInput('message', b.message || '', 'kérdés', 'wide')} ${inlineInput('resultName', b.resultName || 'user_input', 'eredmény')}`;
  if (b.type === 'userChoice') return `${inlineInput('message', b.message || '', 'kérdés', 'wide')} ${inlineInput('options', b.options || '', 'opciók soronként')} ${inlineInput('resultName', b.resultName || 'valasztas', 'eredmény')}`;
  if (b.type === 'tableExtract') return `${inlinePick(b, 'Tábla/lista')} ${inlineSelect('rowMode', b.rowMode || 'first', [['first','első sor'],['last','utolsó sor'],['nth','N. sor'],['contains','sor tartalmazza']])} ${b.rowMode === 'nth' ? inlineNumber('rowIndex', b.rowIndex || 1, 'N') : ''} ${inlineSelect('columnMode', b.columnMode || 'index', [['index','oszlop szám'],['header','fejléc név']])} ${b.columnMode === 'header' ? inlineInput('columnHeader', b.columnHeader || '', 'fejléc') : inlineNumber('columnIndex', b.columnIndex || 1, 'oszlop')} ${inlineInput('resultName', b.resultName || 'tabla_adat', 'eredmény')}`;
  if (b.type === 'elementLoop') return `${inlinePick(b, 'Konténer')} ${inlineInput('selector', b.selector || '', 'selector opcionális')} ${inlineInput('itemVar', b.itemVar || 'elem_szoveg', 'elem változó')} ${inlineNumber('maxItems', b.maxItems || 20, 'max')}`;
  if (b.type === 'waitUntil') return `${inlineSelect('conditionMode', b.conditionMode || 'textExists', [['textExists','szöveg'],['elementExists','elem megjelenik'],['elementVisible','elem látható'],['elementHidden','elem eltűnik'],['elementClickable','kattintható'],['valueContains','mezőérték'],['valueChanges','érték változik'],['urlContains','URL'],['urlChanges','URL változik'],['spinnerGone','spinner eltűnik'],['domStable','DOM stabil']])} ${['elementExists','elementVisible','elementHidden','elementClickable','valueContains','valueChanges'].includes(b.conditionMode) ? inlinePick(b) : inlineInput('text', b.text || b.value || '', 'várt érték', 'wide')} ${inlineNumber('timeoutMs', b.timeoutMs || 10000, 'timeout')}`;
  if (b.type === 'waitLoad') return `${inlineSelect('loadMode', b.loadMode || 'auto', [['auto','automatikus'],['pageReady','oldal betöltődött'],['domStable','DOM stabil'],['spinnerGone','spinner eltűnt'],['elementVisible','elem megjelent'],['elementClickable','elem kattintható']])} ${['elementVisible','elementClickable'].includes(b.loadMode) ? inlinePick(b) : ''} ${inlineNumber('timeoutMs', b.timeoutMs || 15000, 'timeout')}`;
  if (b.type === 'scroll') return `${inlineSelect('mode', b.mode || 'element', [['element','elemhez'],['page','oldal/konténer']])} ${b.mode === 'page' ? inlineSelect('direction','loadMode','onTimeout','position','waitForClick', b.direction || 'down', [['down','le'],['up','fel'],['top','tetejére'],['bottom','aljára'],['untilText','szövegig']]) + (b.direction === 'untilText' ? inlineInput('searchText', b.searchText || '', 'keresett szöveg') : inlineNumber('amount', b.amount || 500, 'px')) : inlineTargetSource(b) + (b.targetMode && b.targetMode !== 'manual' ? '' : inlinePick(b))}`;
  if (b.type === 'keyPress') return `${inlinePick(b, 'Cél opcionális')} ${inlineInput('key', b.key || 'Enter', 'billentyű')} ${inlineCheck('ctrl', Boolean(b.ctrl), 'Ctrl')} ${inlineCheck('shift', Boolean(b.shift), 'Shift')}`;
  if (b.type === 'clipboardRead') return inlineInput('resultName', b.resultName || 'clipboard', 'eredmény');
  if (b.type === 'openUrl') return `${inlineInput('url', b.url || '', 'URL', 'wide')} ${inlineSelect('mode', b.mode || 'newTab', [['sameTab','aktuális tab'],['newTab','új tab'],['newWindow','új ablak']])}`;
  if (b.type === 'pageInfo') return inlineInput('prefix', b.prefix || 'page', 'változó prefix');
  if (b.type === 'screenshot') return `${inlineInput('resultName', b.resultName || 'screenshot_data_url', 'eredmény')} ${inlineSelect('action', b.action || (b.openPreview ? 'preview' : 'preview'), [['preview','előnézet'],['download','letöltés'],['clipboard','vágólap'],['variable','csak változó']])} ${inlineInput('fileName', b.fileName || 'blockflow-screenshot', 'fájlnév')}`;
  if (b.type === 'tryBlock') return `${inlineChip('próba', `${(b.children || []).length} blokk`)} ${inlineChip('hiba ág', `${(b.elseChildren || []).length} blokk`)}`;
  if (b.type === 'preflight') return `${inlineTargetSource(b)} ${b.targetMode && b.targetMode !== 'manual' ? '' : inlinePick(b, 'Ellenőrzött elem')} ${inlineSelect('onFail', b.onFail || 'stop', [['stop','álljon le'],['warn','csak napló'],['notify','értesítsen']])}`;
  if (b.type === 'localSet') return `${inlineInput('key', b.key || '', 'kulcs')} ${inlineInput('value', b.value || '', 'érték', 'wide')}`;
  if (b.type === 'localGet') return `${inlineInput('key', b.key || '', 'kulcs')} ${inlineInput('resultName', b.resultName || 'local_adat', 'eredmény')}`;
  if (b.type === 'compare') return `${inlineInput('left', b.left || '', 'bal oldal')} ${inlineSelect('operator', b.operator || 'equals', [['equals','=' ],['notEquals','≠'],['contains','tartalmazza'],['greater','>'],['less','<']])} ${inlineInput('right', b.right || '', 'jobb oldal')} ${inlineInput('resultName', b.resultName || 'osszehasonlitas', 'eredmény')}`;
  if (b.type === 'math') return `${inlineInput('left', b.left || '0', 'A')} ${inlineSelect('operator', b.operator || 'add', [['add','+'],['subtract','-'],['multiply','×'],['divide','÷']])} ${inlineInput('right', b.right || '1', 'B')} ${inlineInput('resultName', b.resultName || 'szamitas', 'eredmény')}`;
  if (b.type === 'retryBlock') return `${inlineNumber('attempts', b.attempts || 3, 'próba')} ${inlineNumber('delayMs', b.delayMs || 1000, 'szünet ms')} ${inlineChip('futtatja', `${(b.children || []).length} blokk`)}`;
  if (b.type === 'popupWindowWait') return `${inlineSelect('matchMode', b.matchMode || 'urlContains', [['urlContains','URL tartalmazza'],['titleContains','cím tartalmazza']])} ${inlineInput('value', b.value || '', 'keresett részlet')} ${inlineInput('resultName', b.resultName || 'popup_tab_id', 'tab változó')}`;
  if (b.type === 'popupWindowExtract') return `${inlineInput('tabVar', b.tabVar || 'popup_tab_id', 'tab változó')} ${inlinePick(b, 'Honnan')} ${inlineInput('varName', b.varName || 'popup_adat', 'eredmény')}`;
  if (b.type === 'popupWindowClose') return inlineInput('tabVar', b.tabVar || 'popup_tab_id', 'tab változó');
  if (b.type === 'iframeBlock') return `${inlinePick(b, 'Iframe')} ${inlineChip('benne', `${(b.children || []).length} blokk`)}`;
  if (b.type === 'findElements') return `${inlinePick(b, 'Minta/konténer')} ${inlineInput('selector', b.selector || '', 'selector opcionális')} ${inlineInput('countName', b.countName || 'talalat_db', 'darab változó')}`;
  if (b.type === 'emailTemplate') return `${inlineInput('templateId', b.templateId || '', 'sablon ID/név')} ${inlineInput('to', b.to || '{{email}}', 'címzett')} ${inlineInput('resultName', b.resultName || 'email_draft', 'draft változó')}`;
  if (b.type === 'emailPreview') return `${inlineInput('draftName', b.draftName || 'email_draft', 'draft')} ${inlineInput('resultName', b.resultName || 'email_preview_action', 'eredmény')}`;
  if (b.type === 'validateData') return `${inlineInput('source', b.source || '{{adat}}', 'forrás')} ${inlineSelect('validation', b.validation || 'notEmpty', [['notEmpty','nem üres'],['email','email'],['contains','tartalmazza'],['regex','regex']])} ${inlineInput('pattern', b.pattern || '', 'minta')}`;
  if (b.type === 'comment') return inlineInput('note', b.note || '', 'megjegyzés', 'wide');
  if (b.type === 'groupBlock') return `${inlineInput('title', b.title || 'Csoport', 'cím')} ${inlineCheck('groupEnabled', b.groupEnabled !== false, 'aktív')} ${inlineCheck('collapsed', Boolean(b.collapsed), 'összecsukva')} ${inlineChip('blokkok', `${(b.children || []).length}`)}`;
  if (b.type === 'callWorkflow') return `${inlineInput('workflowId', b.workflowId || '', 'workflow ID vagy név')} ${inlineInput('resultPrefix', b.resultPrefix || 'called', 'eredmény prefix')}`;
  if (b.type === 'returnResult') return `${inlineInput('value', b.value || '{{adat}}', 'érték')} ${inlineInput('resultName', b.resultName || 'result', 'név')}`;
  if (b.type === 'stopRun') return inlineInput('message', b.message || 'Futás leállítva.', 'üzenet', 'wide');
  if (b.type === 'sound') return `${inlineSelect('soundSource', b.soundSource || 'builtIn', [['builtIn','beépített'],['custom','saját hang']])} ${b.soundSource === 'custom' ? `<span class="pill">${escapeHtml(b.customSoundName || 'nincs fájl')}</span>` : inlineSelect('tone', b.tone || 'success', [['success','siker'],['error','hiba'],['notify','jelzés']])}`;
  return '';
}

function bindBlockEvents() {
  document.querySelectorAll('[data-block]').forEach(el => {
    el.onclick = e => { if (e.target.tagName !== 'BUTTON') { selectedBlockId = el.dataset.block; renderAll(); }};
    el.ondragstart = e => {
      e.dataTransfer.setData('text/plain', el.dataset.block);
      e.dataTransfer.effectAllowed = 'move';
    };
    el.ondragover = e => { e.preventDefault(); e.stopPropagation(); el.classList.add('drop-before'); };
    el.ondragleave = () => el.classList.remove('drop-before');
    el.ondrop = e => {
      e.preventDefault(); e.stopPropagation(); el.classList.remove('drop-before');
      const id = e.dataTransfer.getData('text/plain');
      moveBefore(id, el.dataset.block);
    };
  });
  document.querySelectorAll('[data-drop-container]').forEach(zone => {
    zone.ondragover = e => { e.preventDefault(); e.stopPropagation(); zone.classList.add('drop-active'); };
    zone.ondragleave = () => zone.classList.remove('drop-active');
    zone.ondrop = e => {
      e.preventDefault(); e.stopPropagation(); zone.classList.remove('drop-active');
      const id = e.dataTransfer.getData('text/plain');
      moveInto(id, zone.dataset.dropContainer);
    };
  });
  document.querySelectorAll('[data-inline-field]').forEach(input => {
    input.onclick = e => e.stopPropagation();
    input.oninput = e => {
      e.stopPropagation();
      const blockEl = input.closest('[data-block]');
      const block = findBlock(blockEl?.dataset.block)?.block;
      if (!block) return;
      const field = input.dataset.inlineField;
      block[field] = ['timeoutMs','ms','maxUrlLength','repeatCount','maxRows','keepStart','keepEnd','keepFirstLines','keepLastLines','throttleSec','intervalSec','intervalMinutes','charStart','charEnd','lineNumber','group','columnIndex','rowIndex','maxItems','attempts','delayMs','amount','volume','stableMs','maxOptionScrolls','matchIndex'].includes(field) ? Number(input.value) : input.value;
      markDirty();
      renderVariables();
    };
    input.onchange = e => { e.stopPropagation(); renderAll(); };
  });
  document.querySelectorAll('[data-inline-check]').forEach(input => {
    input.onclick = e => e.stopPropagation();
    input.onchange = e => {
      e.stopPropagation();
      const blockEl = input.closest('[data-block]');
      const block = findBlock(blockEl?.dataset.block)?.block;
      if (!block) return;
      block[input.dataset.inlineCheck] = input.checked;
      markDirty();
      renderAll();
    };
  });
  document.querySelectorAll('[data-inline-pick]').forEach(btn => {
    btn.onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      const blockEl = btn.closest('[data-block]');
      const blockId = blockEl?.dataset.block;
      if (!blockId) return;
      selectedBlockId = blockId;
      renderAll();
      startPick(blockId, btn.dataset.inlinePick || 'target');
    };
  });
  document.querySelectorAll('[data-inline-more]').forEach(btn => {
    btn.onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      const blockEl = btn.closest('[data-block]');
      if (blockEl?.dataset.block) { selectedBlockId = blockEl.dataset.block; renderAll(); }
    };
  });
  document.querySelectorAll('[data-top]').forEach(b => b.onclick = e => { e.stopPropagation(); moveToEdge(b.dataset.top, 'top'); });
  document.querySelectorAll('[data-up]').forEach(b => b.onclick = e => { e.stopPropagation(); reorder(b.dataset.up, -1); });
  document.querySelectorAll('[data-down]').forEach(b => b.onclick = e => { e.stopPropagation(); reorder(b.dataset.down, 1); });
  document.querySelectorAll('[data-bottom]').forEach(b => b.onclick = e => { e.stopPropagation(); moveToEdge(b.dataset.bottom, 'bottom'); });
  document.querySelectorAll('[data-outdent]').forEach(b => b.onclick = e => { e.stopPropagation(); outdentToRoot(b.dataset.outdent); });
  document.querySelectorAll('[data-del]').forEach(b => b.onclick = e => { e.stopPropagation(); deleteBlock(b.dataset.del); });
}

function listForContainer(containerId) {
  if (!containerId || containerId === 'root') return activeWorkflow.blocks;
  if (String(containerId).startsWith('else:')) {
    const found = findBlock(String(containerId).slice(5))?.block;
    if (!found || !['ifBlock','tryBlock'].includes(found.type)) return null;
    found.elseChildren ||= [];
    return found.elseChildren;
  }
  const found = findBlock(containerId)?.block;
  if (!found || !CONTAINERS.has(found.type)) return null;
  found.children ||= [];
  return found.children;
}

function findBlock(id, blocks = activeWorkflow.blocks, parent = null) {
  if (!id) return null;
  for (let i = 0; i < (blocks || []).length; i++) {
    const b = blocks[i];
    if (b.id === id) return { block: b, list: blocks, index: i, parent };
    const child = findBlock(id, b.children || [], b);
    if (child) return child;
    const elseChild = findBlock(id, b.elseChildren || [], b);
    if (elseChild) return elseChild;
  }
  return null;
}

function removeBlock(id) {
  const found = findBlock(id);
  if (!found) return null;
  if (isStarterBlock(found.block) && starterCount() <= 1) {
    alert('Legalább egy indító blokk szükséges: Indítás vagy Figyelő trigger.');
    return null;
  }
  return found.list.splice(found.index, 1)[0];
}

function isDescendant(containerId, possibleChildId) {
  const container = findBlock(containerId)?.block;
  let yes = false;
  walk(container?.children || [], b => { if (b.id === possibleChildId) yes = true; });
  walk(container?.elseChildren || [], b => { if (b.id === possibleChildId) yes = true; });
  return yes;
}

function moveInto(id, containerId) {
  if (!id) return;
  if (String(id).startsWith('new:')) return createBlockInContainer(String(id).slice(4), containerId);
  if (containerId !== 'root') {
    const realContainerId = String(containerId).startsWith('else:') ? String(containerId).slice(5) : containerId;
    const target = findBlock(realContainerId)?.block;
    if (!target || !CONTAINERS.has(target.type)) return;
    if (id === realContainerId || isDescendant(id, realContainerId)) return alert('Egy blokk nem húzható saját maga alá.');
  }
  const found = findBlock(id);
  if (!found) return;
  if (!canPlaceBlockInContainer(found.block, containerId)) return;
  const item = removeBlock(id);
  if (!item) return;
  const list = listForContainer(containerId);
  if (!list) return;
  list.push(item);
  selectedBlockId = item.id;
  markDirty();
  renderAll();
}

function moveBefore(id, beforeId) {
  if (!id || id === beforeId) return;
  const before = findBlock(beforeId);
  if (!before) return;
  if (String(id).startsWith('new:')) {
    const block = BF.newBlock(String(id).slice(4));
    const containerId = before.parent?.id || (before.list === activeWorkflow.blocks ? 'root' : null);
    if (!canPlaceBlockInContainer(block, containerId || 'root')) return;
    autoPrefillBlock(block, before.list[before.index - 1] || before.parent || null);
    before.list.splice(before.index, 0, block);
    selectedBlockId = block.id;
    markDirty();
    renderAll();
    return;
  }
  if (isDescendant(id, beforeId)) return alert('Egy konténer nem húzható saját gyermekblokkja elé.');
  const found = findBlock(id);
  if (!found) return;
  const containerId = before.parent?.id || (before.list === activeWorkflow.blocks ? 'root' : null);
  if (!canPlaceBlockInContainer(found.block, containerId || 'root')) return;
  const item = removeBlock(id);
  if (!item) return;
  const updatedBefore = findBlock(beforeId);
  const insertAt = updatedBefore ? updatedBefore.index : before.index;
  const list = updatedBefore ? updatedBefore.list : before.list;
  list.splice(insertAt, 0, item);
  selectedBlockId = item.id;
  markDirty();
  renderAll();
}

function reorder(id, dir) {
  const found = findBlock(id);
  if (!found) return;
  const j = found.index + dir;
  if (j < 0 || j >= found.list.length) return;
  [found.list[found.index], found.list[j]] = [found.list[j], found.list[found.index]];
  markDirty();
  renderAll();
}

function moveToEdge(id, edge) {
  const found = findBlock(id);
  if (!found) return;
  const [item] = found.list.splice(found.index, 1);
  if (!item) return;
  if (edge === 'top') found.list.unshift(item);
  else found.list.push(item);
  selectedBlockId = item.id;
  markDirty();
  renderAll();
}

function outdentToRoot(id) {
  const item = removeBlock(id);
  if (!item) return;
  activeWorkflow.blocks.push(item);
  selectedBlockId = item.id;
  markDirty();
  renderAll();
}

function deleteBlock(id) {
  removeBlock(id);
  selectedBlockId = firstBlock(activeWorkflow.blocks)?.id;
  markDirty();
  renderAll();
}

function markDirty() {
  isDirty = true;
  setWorkflowUnverified('modified');
  renderSaveState();
  renderImportWarning();
}


const BLOCK_HELP = {
  trigger: { purpose:'Manuális indítópont. Akkor hasznos, ha az automatizmust kézzel szeretnéd futtatni.', params:['Nem igényel külön beállítást.','Ha csak Figyelő trigger van a workflow-ban, a sima Futtatás a feltételeket is ellenőrzi.'] },
  scheduledTrigger: { purpose:'Időzített indítás: megadott időközönként vagy napi időpontban futtatja az automatizmust.', params:['Intervallum percben: milyen gyakran induljon.','Napi időpont: HH:MM formátum.','Napok: vesszővel elválasztva, például mon,tue,wed.'] },
  triggerGroup: { purpose:'Automatikus figyelő indító. A benne lévő feltételek döntik el, elinduljon-e az automatizmus.', params:['Hol figyelje: domain, path, pontos URL, URL-részlet vagy bármely oldal.','Indítás, ha: minden/bármelyik/egyik sem feltétel igaz.','Ellenőrzés gyakorisága: milyen sűrűn nézze az oldalt.','Újraindítási szünet: ennyi ideig ne induljon újra sikeres indítás után.'] },
  clickTrigger: { purpose:'Automatikus indító: akkor indítja a workflow-t, amikor a felhasználó a kiválasztott oldalelemen kattint.', params:['Cél elem: az elem, amelyre kattintva induljon az automatizmus.','Hol figyelje: domain, path, pontos URL, URL-részlet vagy bármely oldal.','Újraindítási szünet: ennyi ideig ne induljon újra újabb kattintásra.'] },
  conditionText: { purpose:'Figyelőfeltétel: akkor igaz, ha a megadott szöveg megtalálható az oldalon.', params:['Figyelt szöveg: amit keresni kell.','Kis/nagybetű: bekapcsolva pontosan számít a betűméret.'] },
  conditionElement: { purpose:'Figyelőfeltétel: akkor igaz, ha a kiválasztott elem létezik vagy látható.', params:['Cél elem: az oldalon kiválasztott mező/gomb/szöveg.','Csak látható elem: rejtett DOM elem ne számítson találatnak.'] },
  conditionField: { purpose:'Figyelőfeltétel: egy mező vagy elem aktuális értékét ellenőrzi.', params:['Cél elem: a figyelt mező.','Feltétel: tartalmazza, pontosan ez, üres, nem üres stb.','Érték: ehhez hasonlítja a mező tartalmát.'] },
  conditionUrl: { purpose:'Figyelőfeltétel: az aktuális URL alapján ad igaz/hamis eredményt.', params:['URL feltétel: tartalmazza, pontosan ez, ezzel kezdődik stb.','URL érték: a keresett domain, path vagy teljes URL-részlet.'] },
  conditionChange: { purpose:'Figyelőfeltétel: csak akkor igaz, ha az előző ellenőrzéshez képest értékváltozás történt.', params:['Forrás elem: a figyelt mező vagy elem.','Változás típusa: miről→mire, bármiről→mire, miről→bármire vagy bármilyen változás.','Első ellenőrzéskor alapból csak megtanulja az aktuális értéket.','Az előző érték tabonként és workflow-nként külön tárolódik.'] },
  conditionGroup: { purpose:'Logikai csoport a Figyelő trigger alatt. Több feltételt fog össze egyetlen feltétellé.', params:['Csoport logikája: minden igaz / bármelyik igaz / egyik sem igaz.','Alá csak figyelőfeltétel vagy újabb feltételcsoport kerüljön.'] },
  click: { purpose:'Rákattint egy kiválasztott oldalelemre.', params:['Cél elem: a kattintandó gomb/link/mező.','Megerősítés: kockázatos kattintás előtt kérhet jóváhagyást.','Timeout: meddig keresse az elemet.'] },
  fill: { purpose:'Szöveget illeszt vagy ír be egy mezőbe. Modern React/Vue/Angular/SNOW felületeken framework-kompatibilis eseményeket is küld.', params:['Cél elem: a kitöltendő input/textarea/select vagy textbox szerepű elem.','Kitöltési mód: framework mód, egyszerű értékadás, szimulált gépelés vagy paste esemény.','A framework mód native value settert, input/change/blur eseményeket használ.'] },
  selectOption: { purpose:'Modern, div-alapú vagy custom legördülőből választ opciót.', params:['Dropdown: a megnyitandó mező vagy gomb.','Opció szövege: az elem, amit a megnyíló listában keres.','SNOW/React/Vue/Angular komponenseknél hasznos, ahol nincs valódi select elem.'] },
  injectCss: { purpose:'Egyedi CSS szabályokat szúr be az aktuális oldalba futás közben, vagy eltávolítja a korábban beszúrt stílust.', params:['Mód: CSS hozzáadása vagy eltávolítása.','Stílus azonosító: ezzel lehet ugyanazt a CSS-t később felülírni vagy törölni.','CSS szabályok: normál CSS, változókkal is használható. Példa: .status { outline: 2px solid red; }','Felülír: ha aktív, az azonos ID-jú korábbi style tag előbb törlődik.'] },
  extract: { purpose:'Adatot olvas ki egy elemből vagy mezőből, majd változóba menti.', params:['Mit nyerjen ki: automatikus érték, mezőérték, szöveg, HTML vagy attribútum.','Hol keressen: teljes DOM-ban vagy csak látható elemek között.','Változó neve: ezen a néven használható később, például {{adat}}.'] },
  wait: { purpose:'Várakoztatja a futást időre, szövegre vagy elemre.', params:['Idő mód: fix ms várakozás.','Szöveg/elem mód: timeoutig vár a találatra.'] },
  waitUntil: { purpose:'Addig vár, amíg egy feltétel teljesül, vagy lejár a timeout.', params:['Feltétel: szöveg, elem, mezőérték, URL, spinner eltűnése vagy DOM stabilitás.','Modern SPA/SNOW felületeken hasznos a spinner eltűnik, elem kattintható és DOM stabil mód.','Timeout: maximális várakozási idő ms-ben.'] },
  waitLoad: { purpose:'Kattintás, URL megnyitás vagy SPA frissülés után megvárja, amíg az oldal vagy panel használható állapotba kerül.', params:['Automatikus mód: oldal ready, spinner eltűnés és DOM stabilitás kombinációja.','DOM stabil: akkor enged tovább, ha rövid ideig nincs érdemi változás.','Elem módok: kiválasztott elem megjelenésére vagy kattinthatóságára vár.','Timeout: maximális várakozási idő ms-ben.'] },
  ifBlock: { purpose:'Futás közbeni elágazás. Igaz esetén az alatta lévő blokkok futnak, különben az else ág.', params:['Feltétel: szöveg, elem vagy mezőérték.','Igaz/különben ág: a behúzott blokkok száma a jobb panelen látszik.'] },
  repeatBlock: { purpose:'A behúzott blokkokat többször lefuttatja.', params:['Ismétlések száma: hányszor fusson a belső blokklista.','A blokkokat a sárga behúzott területre kell tenni.'] },
  retryBlock: { purpose:'Bizonytalan műveleteknél többször újrapróbálja a behúzott blokkokat.', params:['Próbálkozások száma és várakozás két próbálkozás között.','Ha sikerül, továbbmegy; ha nem, hibát naplóz.'] },
  tryBlock: { purpose:'Hibakezelő konténer: megpróbálja a fő ágat, hiba esetén a hibaág futhat.', params:['Siker ág: normál blokkok.','Hiba ág: értesítés, naplózás, leállítás vagy alternatív művelet.'] },
  scroll: { purpose:'Oldalt, belső panelt vagy kiválasztott görgethető konténert görget, illetve cél elemet hoz nézetbe.', params:['Automatikus módban a cél elem legközelebbi görgethető szülőjét próbálja görgetni.','Dinamikus/virtualizált oldalaknál keresett szövegig is görgethet, több lépésben.'] },
  keyPress: { purpose:'Billentyűt vagy billentyűkombinációt küld az oldalnak.', params:['Cél elem opcionális: előbb fókuszba kerül.','Billentyű: Enter, Tab, Escape, Ctrl+A/C/V vagy saját kombináció.'] },
  copy: { purpose:'Szöveget vagy változót másol a vágólapra.', params:['Érték: fix szöveg vagy változókkal összeállított tartalom.'] },
  clipboardRead: { purpose:'A vágólap aktuális szövegét változóba menti.', params:['Eredmény változó: később {{clipboard}} jelleggel használható.'] },
  openUrl: { purpose:'URL-t nyit meg aktuális tabon, új tabon vagy új ablakban.', params:['URL: lehet változózott cím is.','Megnyitás módja: aktuális tab / új tab / új ablak.'] },
  pageInfo: { purpose:'Az aktuális oldal adatait változókba menti.', params:['Menthető: URL, cím, domain.','Prefix: a létrejövő változónevek előtagja.'] },
  screenshot: { purpose:'Képernyőképet készít az aktív cél tab látható részéről.', params:['Kezelés: előnézet, letöltés, vágólap vagy változóba mentés.','A Chrome csak látható/aktív tabról tud képernyőképet készíteni.'] },
  setVar: { purpose:'Fix vagy változózott értéket ment egy új változóba.', params:['Változó neve: például statusz.','Érték: használhat {{adat}} típusú változókat.'] },
  transform: { purpose:'Szöveget tisztít vagy átalakít.', params:['Forrás: kiinduló változó/szöveg.','Művelet: trim, kisbetű, nagybetű, csak számok, üres sorok törlése stb.','Eredmény változó: ide menti az átalakított szöveget.'] },
  textSlice: { purpose:'Egy hosszabb szövegből részletet vág ki.', params:['Mód: két szöveg között, adott sor, vagy karaktertartomány.','Eredmény változó: a kivágott rész neve.'] },
  regex: { purpose:'Reguláris kifejezéssel keres mintát egy szövegben.', params:['Minta: regex kifejezés.','Capture group: melyik zárójeles találatot mentse.','Összes találat: több eredményt is menthet.'] },
  textSearch: { purpose:'Egyszerű szöveget keres az oldalon regex nélkül, és visszaadja azt is, hogy hol találta meg.', params:['Keresett szöveg: a keresendő szó vagy mondatrész.','Dinamikus/virtualizált oldalaknál görgetéssel is kereshet, így olyan elemeket is megtalálhat, amelyek csak görgetés után töltődnek be.','Eredmények: igaz/hamis, találatszám, környező szöveg, selector, XPath, találati sor, kattintható szülő és közeli gomb változókba kerül.'] },
  errorSearch: { purpose:'Hibaüzenet, validációs üzenet vagy alert jellegű elem keresése.', params:['Alert/aria-live/error class/invalid mezők alapján keres.','Eredményként true/false, első hiba szövege, selector és találatszám változókat ad.'] },
  fieldByLabel: { purpose:'Mező keresése címke, aria-label, title vagy enterprise data attribútum alapján.', params:['Label: a látható mezőcímke vagy aria/data név.','Visszaadja a mező értékét, selectorát, XPath-ját és elemhivatkozását.'] },
  mask: { purpose:'Érzékeny adatot maszkol karakterek vagy sorok alapján.', params:['Karakter mód: eleje/vége megtartása, köztes rész maszkolása.','Sor mód: első/utolsó sorok megtartása.','Invert: a kijelölt részt maszkolja. Clear/trim: a maszkolandó rész törlődik, nem helyettesítődik.'] },
  tableExtract: { purpose:'Táblázatból vagy listából olvas ki egy adott cellát/sort.', params:['Sor mód: első, utolsó, N. sor vagy tartalmazza.','Oszlop választható sorszámmal vagy fejlécnév alapján.','Virtualizált tábláknál görgetéssel újraolvassa a látható sorokat.'] },
  findElements: { purpose:'Több elemet keres, és találatszámot vagy szöveges listát ment.', params:['Cél elem vagy selector: a találatok mintája.','Maximum elem: mennyi találatot dolgozzon fel.','Változók: találatok és darabszám.'] },
  elementLoop: { purpose:'Több megtalált elemre ismétli a behúzott blokkokat.', params:['Selector vagy kiválasztott minta alapján keres.','Item változó: az aktuális elem szövege.','Index változó: az aktuális sorszám.'] },
  rowLoop: { purpose:'Táblázat/lista sorain fut végig egyszerűen.', params:['Cél táblázat/lista.','Sor változó: az aktuális sor szövege.','Maximum sor: véd a túl hosszú feldolgozástól.'] },
  userPrompt: { purpose:'Extension ablakban üzenetet mutat, és opcionálisan megállítja a workflow-t válaszig.', params:['Mód: csak értesít vagy visszajelzésre vár.','Gombszövegek: Folytatás/Megszakítás felirat.','Eredmény változó: a döntés menthető.'] },
  pageButton: { purpose:'Gombot illeszt az aktuális weboldalra. A workflow opcionálisan addig vár, amíg a felhasználó rákattint.', params:['Elhelyezés: lebegő sarokban vagy kiválasztott elem elé/után.','Timeout: kattintás nélküli várakozás kezelése.','Eredmény változó: true/false értéket kap, és létrejön a kattintási időpont is.'] },
  userInput: { purpose:'Adatot kér be a felhasználótól futás közben.', params:['Mező típusa: rövid vagy hosszú szöveg.','Alapérték és placeholder segíti a kitöltést.','Eredmény változó: ide kerül a megadott adat.'] },
  userChoice: { purpose:'Opciók közül választást kér a felhasználótól.', params:['Opciók: soronként egy válasz.','Eredmény változó: a kiválasztott opció.'] },
  systemNotify: { purpose:'Chrome rendszerértesítést küld.', params:['Cím és üzenet változókkal is kitölthető.','Nem állítja meg a workflow-t.'] },
  sound: { purpose:'Rövid hangjelzést ad visszajelzésként.', params:['Beépített hang vagy saját feltöltött mp3/wav/ogg használható.','Állítható hangerő és ismétlésszám.'] },
  email: { purpose:'Email draft adatot állít össze változókból.', params:['Címzett, tárgy, törzs.','Nem küld emailt, csak draft változót készít.'] },
  emailTemplate: { purpose:'Mentett email sablont tölt be és draft változóvá alakít.', params:['Sablon kiválasztása.','Címzett és eredményváltozó állítható.'] },
  emailPreview: { purpose:'Megmutatja az email tartalmát, mielőtt megnyitod vagy másolod.', params:['Döntési ablak: megnyitás, másolás vagy megszakítás.','Eredmény változóba menthető a választás.'] },
  openEmail: { purpose:'Mailto ablakot nyit a korábban összeállított email draftból.', params:['Hosszú email esetén a törzset vágólapra teszi.','Az extension nem küld levelet automatikusan.'] },
  localSet: { purpose:'Értéket ment a böngésző lokális extension storage-ába.', params:['Kulcs: név, amin később visszaolvasható.','Érték: változózott szöveg is lehet.'] },
  localGet: { purpose:'Lokálisan mentett értéket olvas vissza.', params:['Kulcs: korábban mentett név.','Alapérték: ha nincs ilyen kulcs.','Eredmény változó: ide kerül az érték.'] },
  compare: { purpose:'Két értéket hasonlít össze, és igaz/hamis eredményt ment.', params:['Bal és jobb oldal lehet fix szöveg vagy változó.','Operátor: egyenlő, tartalmazza, nagyobb, kisebb.'] },
  math: { purpose:'Egyszerű számítást végez két értékkel.', params:['Művelet: összeadás, kivonás, szorzás, osztás.','Eredmény változóba ment.'] },
  validateData: { purpose:'Adatot ellenőriz forma vagy tartalom alapján.', params:['Validáció: nem üres, email, tartalmazza, regex.','Hiba esetén: leállítás vagy csak naplózás.'] },
  popupWait: { purpose:'Weboldali modal/popup megjelenésére vár.', params:['Timeout: meddig várjon.','A weboldal saját popupjaira vonatkozik, nem Chrome popupra.'] },
  popupExtract: { purpose:'Weboldali popupból címet vagy szöveget ment változóba.', params:['Kinyerési mód: popup szöveg/cím.','Változó neve: ide kerül az adat.'] },
  popupClick: { purpose:'Weboldali popupban gombra kattint szöveg alapján.', params:['Gombszöveg: például OK, Mentés, Bezárás.','Timeout: meddig keresse.'] },
  popupWindowWait: { purpose:'Új tabra vagy böngészőablakra vár.', params:['Egyezés: URL vagy cím alapján.','Eredmény változó: a megtalált tab azonosítója.'] },
  popupWindowExtract: { purpose:'Korábban megtalált új tab/ablak oldaláról nyer ki adatot.', params:['Tab változó: melyik ablakból olvasson.','Cél elem és kinyerési mód ugyanúgy működik, mint az Adat kinyerése blokknál.'] },
  popupWindowClose: { purpose:'Bezárja a korábban megtalált popup/tab ablakot.', params:['Tab változó: a bezárandó ablak azonosítója.'] },
  preflight: { purpose:'Futás előtt ellenőrzi, hogy egy elem elérhető-e.', params:['Ha nincs meg: leállhat vagy csak figyelmeztethet.','Hasznos kritikus lépések előtt.'] },
  iframeBlock: { purpose:'A behúzott blokkokat iframe kontextusban próbálja futtatni.', params:['Cél iframe kiválasztása.','Cross-origin iframe-eket a böngésző korlátozhat.'] },
  groupBlock: { purpose:'Blokkok vizuális és futási csoportosítása hosszabb workflow-k rendszerezéséhez.', params:['Cím: a csoport neve.','Aktív: ha ki van kapcsolva, a benne lévő blokkok futáskor kimaradnak.','Összecsukva: a belső blokkok helyett csak ikonösszefoglaló látszik.'] },
  comment: { purpose:'Megjegyzés a workflow-ban. Nem fut le.', params:['Használható dokumentálásra vagy emlékeztetőként.'] },
  callWorkflow: { purpose:'Másik automatizmust hív meg alfolyamatként.', params:['Workflow: melyik automatizmust futtassa.','Eredmény prefix: a meghívott folyamat eredményeinek előtagja.'] },
  returnResult: { purpose:'Eredményt ad vissza egy workflow-ból.', params:['Érték: amit vissza szeretnél adni.','Eredmény neve: milyen változóként legyen elérhető.'] },
  stopRun: { purpose:'Megállítja az aktuális futást.', params:['Üzenet: a naplóban és visszajelzésben látható ok.'] },
  pdfStart: { purpose:'Új PDF dokumentumot indít a futásban.', params:['Cím és fájlnév változókkal is megadható.','Papírméret, tájolás, margó, fejléc/lábléc itt állítható.'] },
  pdfText: { purpose:'Szöveges részt ad az aktuális PDF-hez.', params:['Címsor és szöveg változókkal.','Stílus, igazítás, betűméret és térköz állítható.'] },
  pdfTable: { purpose:'Kulcs-érték táblázatot ad a PDF-hez.', params:['Sorok formátuma: Név | Érték.','Üres érték helyettesítése, szegély és oszlopszélesség állítható.'] },
  pdfScreenshot: { purpose:'Screenshotot illeszt az aktuális PDF-be.', params:['Forrás: aktuális oldal, utolsó screenshot vagy változó.','Méret, felirat, keret és oldaltörés állítható.'] },
  pdfPageBreak: { purpose:'Új oldalt szúr be az aktuális PDF-be.', params:['Opcionálisan csak akkor, ha kevés hely maradt az oldalon.'] },
  pdfSave: { purpose:'Lezárja és letölti vagy előnézetben megnyitja az elkészült PDF-et.', params:['Művelet: letöltés, előnézet vagy mindkettő.','Fájlnév: változókat is tartalmazhat.'] },
  docxStart: { purpose:'Új szerkeszthető DOCX/Word riportot indít.', params:['Fájlnév, cím, lapméret, tájolás és margó változókkal is megadható.'] },
  docxText: { purpose:'Szöveget vagy címsort ad az aktuális DOCX riporthoz.', params:['Változókat is használhatsz, például {{adat}}.'] },
  docxTable: { purpose:'Kulcs-érték táblázatot ad a DOCX riporthoz.', params:['Sorok formátuma: Név | Érték.'] },
  docxScreenshot: { purpose:'Screenshotot vagy képváltozót illeszt a DOCX riportba.', params:['Forrás: aktuális oldal, utolsó screenshot vagy változó.'] },
  docxPageBreak: { purpose:'Oldaltörést szúr be a DOCX dokumentumba.', params:['A következő tartalom új oldalon kezdődik.'] },
  docxSave: { purpose:'Letölti az összeállított DOCX riportot.', params:['A fájlnév változókat is tartalmazhat.'] }
};

function inspectorIntro(b) {
  const meta = BF.BLOCKS[b.type] || { name: b.type, desc: '' };
  const help = BLOCK_HELP[b.type] || { purpose: meta.desc || 'Ez a blokk a workflow egyik lépése.', params: ['A fő mezők a középső blokkon, a részletes opciók itt módosíthatók.'] };
  const params = Array.isArray(help.params) ? help.params : [];
  return `<div class="inspector-current"><div class="list-title">${escapeHtml(meta.name || b.type)}</div><div class="inspector-help"><div><b>Mire jó?</b> ${escapeHtml(help.purpose || meta.desc || '')}</div>${params.length ? `<div class="help-list"><b>Paraméterek:</b><ul>${params.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul></div>` : ''}</div></div>`;
}

function renderInspector() {
  const b = findBlock(selectedBlockId)?.block;
  const changedBlock = b && b.id !== lastInspectorBlockId;
  if (!b) { $('#inspector').innerHTML = '<div class="empty">Válassz blokkot.</div>'; return; }
  let html = inspectorIntro(b);
  if (['click','fill','selectOption','extract','conditionElement','conditionField','conditionChange','clickTrigger','tableExtract','scroll','keyPress','preflight','popupWindowExtract','iframeBlock','findElements','waitUntil','waitLoad'].includes(b.type)) html += targetEditor(b);
  if (b.type === 'click') html += checkboxField('confirmRisky','Kockázatos kattintásnál kérjen megerősítést', b.confirmRisky !== false) + numberField('timeoutMs','Max várakozás ms', b.timeoutMs || 5000);
  if (b.type === 'fill') html += valueSourceHelp() + textArea('value','Mit illesszen be?', b.value || '') + selectField('fillMode','Kitöltési mód', b.fillMode || 'framework', [['framework','Framework-kompatibilis értékadás'],['simple','Egyszerű értékadás'],['typing','Szimulált gépelés'],['paste','Vágólap/paste esemény jellegű mód']]) + checkboxField('blurAfter','Kitöltés után blur esemény', b.blurAfter !== false) + checkboxField('shadowSearch','Shadow DOM keresés', b.shadowSearch !== false) + numberField('typeDelayMs','Gépelési késleltetés ms', b.typeDelayMs || 25) + numberField('timeoutMs','Max várakozás ms', b.timeoutMs || 5000) + `<div class="status">Framework mód: React/Vue/Angular/SNOW mezőkhöz native value setter + input/change/blur eseményeket küld. Ha egy mező érzékeny, próbáld a szimulált gépelést.</div>`;
  if (b.type === 'injectCss') html += selectField('mode','Mód', b.mode || 'add', [['add','CSS hozzáadása / frissítése'],['remove','CSS eltávolítása']]) + textField('styleId','Stílus azonosító', b.styleId || 'blockflow-custom-style') + (b.mode === 'remove' ? '' : textArea('cssText','CSS szabályok', b.cssText || '')) + checkboxField('replaceExisting','Azonos ID-jú korábbi CSS felülírása', b.replaceExisting !== false) + textField('resultName','Eredmény változó', b.resultName || 'css_injektalva') + `<div class="status">A CSS az aktuális oldal DOM-jába kerül style tagként. Hasznos kiemeléshez, ideiglenes elrejtéshez, nagyobb betűmérethez vagy nyomtatási/riport előkészítéshez.</div>`;
  if (b.type === 'selectOption') html += textField('optionText','Kiválasztandó opció szövege', b.optionText || '') + selectField('matchMode','Egyezés', b.matchMode || 'contains', [['contains','Tartalmazza'],['equals','Pontosan egyezik'],['starts','Ezzel kezdődik']]) + checkboxField('caseSensitive','Kis/nagybetű számítson', Boolean(b.caseSensitive)) + checkboxField('scrollOptions','Opciólista görgetése keresés közben', b.scrollOptions !== false) + numberField('maxOptionScrolls','Max opciólista görgetés', b.maxOptionScrolls || 10) + checkboxField('shadowSearch','Shadow DOM keresés', b.shadowSearch !== false) + numberField('openDelayMs','Nyitás utáni várakozás ms', b.openDelayMs || 250) + numberField('timeoutMs','Max várakozás ms', b.timeoutMs || 5000) + `<div class="status">A blokk először rákattint a dropdownra, majd a megjelenő opciók között szöveg alapján keres és kattint. Custom SNOW/React/Vue/Angular legördülőkhöz készült.</div>`;
  if (b.type === 'extract') html += selectField('extractMode','Mit nyerjen ki?', b.extractMode || 'auto', [['auto','Automatikus - legjobb érték'],['value','Mezőérték'],['text','Szöveg'],['html','HTML tartalom'],['attribute','Attribútum']]) + selectField('searchScope','Hol keressen?', b.searchScope || 'dom', [['dom','Teljes DOM-ban, rejtett mezőkben is'],['visible','Csak látható elemek között']]) + checkboxField('allowHidden','Rejtett / inaktív fülön lévő mezőt is elfogad', b.allowHidden !== false) + textField('attributeName','Attribútum neve attribute módnál', b.attributeName || 'title') + textField('varName','Változó neve', b.varName || 'adat') + numberField('timeoutMs','Max várakozás ms', b.timeoutMs || 5000);
  if (b.type === 'triggerGroup') html += watcherAdvanced(b) + selectField('logic','Indítás, ha', b.logic || 'all', [['all','Minden feltétel igaz'],['any','Bármelyik feltétel igaz'],['none','Egyik feltétel sem igaz']]) + numberField('intervalSec','Ellenőrzés gyakorisága mp-ben', b.intervalSec || 2) + `<div class="status">Feltételek száma: ${(b.children || []).length}. Húzz alá feltételblokkokat a Figyelő feltételek kategóriából.</div>`;
  if (b.type === 'clickTrigger') html += watcherAdvanced(b) + checkboxField('triggerEnabled','Aktív', b.triggerEnabled !== false) + numberField('throttleSec','Újraindítási szünet mp-ben', b.throttleSec || 15);
  if (b.type === 'conditionText') html += textField('text','Figyelt szöveg vagy karakter', b.text || '') + checkboxField('caseSensitive','Kis/nagybetű számítson', Boolean(b.caseSensitive));
  if (b.type === 'conditionElement') html += checkboxField('requireVisible','Csak látható elem számítson', b.requireVisible !== false);
  if (b.type === 'conditionField') html += selectField('operator','Feltétel', b.operator || 'contains', [['contains','Tartalmazza'],['notContains','Nem tartalmazza'],['equals','Pontosan ez'],['notEquals','Nem pontosan ez'],['empty','Üres'],['notEmpty','Nem üres'],['startsWith','Ezzel kezdődik'],['endsWith','Ezzel végződik']]) + textField('value','Érték', b.value || '') + checkboxField('caseSensitive','Kis/nagybetű számítson', Boolean(b.caseSensitive));
  if (b.type === 'conditionUrl') html += selectField('operator','URL feltétel', b.operator || 'contains', [['contains','Tartalmazza'],['notContains','Nem tartalmazza'],['equals','Pontosan ez'],['notEquals','Nem pontosan ez'],['startsWith','Ezzel kezdődik'],['endsWith','Ezzel végződik']]) + textField('value','URL érték', b.value || '');
  if (b.type === 'conditionChange') html += selectField('readMode','Mit olvasson?', b.readMode || 'auto', [['auto','Automatikus érték'],['value','Mezőérték'],['text','Szöveg'],['attribute','Attribútum']]) + (b.readMode === 'attribute' ? textField('attributeName','Attribútum neve', b.attributeName || 'title') : '') + selectField('searchScope','Keresés módja', b.searchScope || 'dom', [['dom','Teljes DOM-ban, rejtett mezőkben is'],['visible','Csak látható elemek között']]) + selectField('changeMode','Változás típusa', b.changeMode || 'fromTo', [['fromTo','Miről → mire'],['anyTo','Bármiről → mire'],['fromAny','Miről → bármire'],['anyChange','Bármilyen változás']]) + textField('fromValue','Miről', b.fromValue || '') + textField('toValue','Mire', b.toValue || '') + selectField('operator','Összehasonlítás', b.operator || 'equals', [['equals','Pontos egyezés'],['contains','Tartalmazza'],['regex','Regex']]) + checkboxField('caseSensitive','Kis/nagybetű számítson', Boolean(b.caseSensitive)) + selectField('firstRun','Első ellenőrzéskor', b.firstRun || 'learn', [['learn','Csak jegyezze meg, ne indítson'],['allowTo','Indítson, ha már a célértéken van']]) + `<div class="status">Az előző érték a tabon belül, workflow + trigger + feltétel szerint tárolódik. Oldalfrissítés után újratanul.</div>`;

  if (b.type === 'conditionGroup') html += selectField('logic','Csoport logikája', b.logic || 'all', [['all','Minden feltétel igaz'],['any','Bármelyik feltétel igaz'],['none','Egyik feltétel sem igaz']]) + `<div class="status">A csoport alá húzott figyelőfeltételek együtt értékelődnek ki. A csoport maga egy feltételként számít a felette lévő triggerben.</div>`;
  if (b.type === 'pdfStart') html += textField('title','PDF címe', b.title || '') + textField('fileName','Alap fájlnév', b.fileName || 'blockflow-riport.pdf') + selectField('pageSize','Papírméret', b.pageSize || 'a4', [['a4','A4'],['letter','Letter'],['legal','Legal']]) + selectField('orientation','Tájolás', b.orientation || 'portrait', [['portrait','Álló'],['landscape','Fekvő']]) + numberField('margin','Margó pt', b.margin || 40) + numberField('fontSize','Alap betűméret', b.fontSize || 11) + textField('header','Fejléc szövege', b.header || '') + textField('footer','Lábléc opciók/szöveg', b.footer || 'date,page,url');
  if (b.type === 'pdfText') html += textField('heading','Címsor', b.heading || '') + textArea('text','Szöveg', b.text || '') + selectField('style','Stílus', b.style || 'normal', [['normal','Normál'],['heading','Címsor'],['subtitle','Alcím'],['note','Megjegyzés'],['mono','Monospace']]) + selectField('align','Igazítás', b.align || 'left', [['left','Balra'],['center','Középre'],['right','Jobbra']]) + numberField('fontSize','Betűméret', b.fontSize || 11) + numberField('spaceAfter','Térköz utána', b.spaceAfter || 10);
  if (b.type === 'pdfTable') html += textField('title','Táblázat címe', b.title || '') + textArea('rows','Sorok: kulcs | érték', b.rows || '') + checkboxField('border','Szegély mutatása', b.border !== false) + selectField('columnMode','Oszlopszélesség', b.columnMode || '30/70', [['auto','Automatikus'],['30/70','30/70'],['50/50','50/50']]) + textField('emptyValue','Üres érték helyett', b.emptyValue || '-');
  if (b.type === 'pdfScreenshot') html += selectField('source','Forrás', b.source || 'current', [['current','Aktuális oldal screenshot'],['last','Utolsó screenshot változó'],['variable','Megadott változóban tárolt screenshot']]) + textField('dataVar','Screenshot változó neve', b.dataVar || 'screenshot_data_url') + textField('caption','Felirat', b.caption || '') + selectField('sizeMode','Méret', b.sizeMode || 'fitWidth', [['fitWidth','Teljes szélesség'],['original','Eredeti méret'],['fitPage','Oldalhoz igazítva']]) + checkboxField('pageBreakBefore','Oldaltörés előtte', Boolean(b.pageBreakBefore)) + checkboxField('border','Vékony keret', b.border !== false);
  if (b.type === 'pdfPageBreak') html += checkboxField('onlyIfLowSpace','Csak akkor új oldal, ha kevés hely maradt', Boolean(b.onlyIfLowSpace));
  if (b.type === 'pdfSave') html += selectField('action','Művelet', b.action || 'downloadPreview', [['download','Letöltés'],['preview','Megnyitás új tabon'],['downloadPreview','Letöltés és megnyitás']]) + textField('fileName','Fájlnév', b.fileName || '{{today}}_blockflow-riport.pdf') + checkboxField('previewBeforeSave','Előnézet mentés előtt', Boolean(b.previewBeforeSave));
  if (b.type === 'wait') html += selectField('waitMode','Várakozás típusa', b.waitMode || 'time', [['time','Idő'],['text','Szöveg megjelenése'],['element','Elem megjelenése']]) + (b.waitMode === 'time' ? numberField('ms','Idő ms', b.ms || 1000) : b.waitMode === 'text' ? textField('text','Szöveg', b.text || '') + numberField('timeoutMs','Timeout ms', b.timeoutMs || 5000) : targetEditor(b) + numberField('timeoutMs','Timeout ms', b.timeoutMs || 5000));
  if (b.type === 'ifBlock') html += selectField('conditionMode','Feltétel', b.conditionMode || 'textExists', [['textExists','Szöveg létezik'],['elementExists','Elem létezik'],['valueContains','Elem értéke tartalmazza']]) + (b.conditionMode === 'elementExists' || b.conditionMode === 'valueContains' ? targetEditor(b) : '') + (b.conditionMode === 'valueContains' ? textField('value','Keresett érték', b.value || '') : b.conditionMode === 'textExists' ? textField('text','Keresett szöveg', b.text || '') : '') + numberField('timeoutMs','Elemkeresési timeout ms', b.timeoutMs || 1000) + `<div class="status">Igaz ág: ${(b.children||[]).length} blokk · Különben ág: ${(b.elseChildren||[]).length} blokk</div>`;
  if (b.type === 'repeatBlock') html += numberField('repeatCount','Ismétlések száma', b.repeatCount || 2) + `<div class="status">Az alá behúzott blokkok ismétlődnek. Gyermek blokkok: ${(b.children||[]).length}</div>`;
  if (b.type === 'rowLoop') html += targetEditor(b) + textField('rowVar','Sor szövegének változóneve', b.rowVar || 'sor_szoveg') + numberField('maxRows','Max sor', b.maxRows || 20) + `<div class="status">Egyszerű lista/táblázat feldolgozás: a kiválasztott elem sorait/listaelemeit járja be.</div>`;
  if (b.type === 'popupWait') html += numberField('timeoutMs','Popup timeout ms', b.timeoutMs || 10000) + `<button id="testPopup" class="ghost">Popup tesztelése</button>`;
  if (b.type === 'popupExtract') html += selectField('extractMode','Mit nyerjen ki?', b.extractMode || 'text', [['text','Teljes popup szöveg'],['title','Popup cím']]) + textField('varName','Változó neve', b.varName || 'popup_szoveg');
  if (b.type === 'popupClick') html += textField('buttonText','Popup gomb szövege', b.buttonText || 'OK') + numberField('timeoutMs','Timeout ms', b.timeoutMs || 5000);
  if (b.type === 'copy') html += valueSourceHelp() + textArea('value','Mit másoljon?', b.value || '');
  if (b.type === 'userPrompt') html += selectField('mode','Működés', b.mode || 'wait', [['wait','Felugró ablak és várjon felhasználói visszajelzésre'],['notify','Csak felugró üzenet, automatikusan továbbmegy']]) + textField('title','Ablak címe', b.title || 'BlockFlow') + textArea('message','Üzenet szövege', b.message || '') + textField('buttonText','Folytatás gomb szövege', b.buttonText || 'Folytatás') + textField('cancelText','Megszakítás gomb szövege', b.cancelText || 'Megszakítás') + textField('resultName','Eredmény változó neve opcionális', b.resultName || '') + `<div class="status">Várakozó módban a futás megáll, amíg a felhasználó folytatja vagy megszakítja. Értesítő módban csak megjelenik egy rövid felugró üzenet.</div>`;
  if (b.type === 'pageButton') html += textField('label','Gomb felirata', b.label || 'Folytatás') + textField('tooltip','Tooltip', b.tooltip || 'Kattints a BlockFlow folytatásához') + selectField('waitForClick','Működés', String(b.waitForClick !== false), [['true','Várjon kattintásra'],['false','Csak jelenítse meg, majd folytassa']]) + selectField('position','Elhelyezés', b.position || 'bottomRight', [['bottomRight','Jobb alsó lebegő gomb'],['bottomLeft','Bal alsó lebegő gomb'],['topRight','Jobb felső lebegő gomb'],['topLeft','Bal felső lebegő gomb'],['bottomCenter','Középen alul'],['afterTarget','Kiválasztott elem után'],['beforeTarget','Kiválasztott elem elé']]) + ((b.position === 'afterTarget' || b.position === 'beforeTarget') ? targetPickerHtml(b) : '') + numberField('timeoutSec','Timeout másodperc', b.timeoutSec || 300) + selectField('onTimeout','Timeout esetén', b.onTimeout || 'stop', [['stop','Álljon le hibával'],['continue','Folytassa']]) + checkboxField('removeAfterClick','Kattintás után eltávolítás', b.removeAfterClick !== false) + textField('resultName','Eredmény változó', b.resultName || 'button_clicked') + `<div class="status">A kattintás ideje automatikusan a <code>{{button_clicked_at}}</code> változóba kerül.</div>`;
  if (b.type === 'systemNotify') html += textField('title','Értesítés címe', b.title || 'BlockFlow') + textArea('message','Értesítés szövege', b.message || '') + `<div class="status">Chrome rendszerértesítést küld. Ehhez az extension értesítési jogosultságot használ.</div>`;
  if (b.type === 'sound') html += selectField('soundSource','Hangforrás', b.soundSource || 'builtIn', [['builtIn','Beépített hang'],['custom','Saját feltöltött hang']]) + (b.soundSource === 'custom' ? `<div class="field"><label>Saját hangfájl</label><input type="file" id="customSoundFile" accept="audio/*"><small class="muted">Jelenlegi: ${escapeHtml(b.customSoundName || 'nincs feltöltve')}</small></div><button class="small" id="previewCustomSound">Hang előnézet</button>` : selectField('tone','Hang típusa', b.tone || 'success', [['success','Siker'],['error','Hiba'],['notify','Jelzés']])) + numberField('volume','Hangerő 0-1', b.volume ?? 0.7) + numberField('repeatCount','Ismétlés száma', b.repeatCount || 1);
  if (b.type === 'mask') html += valueSourceHelp() + textArea('source','Forrás szöveg vagy változó', b.source || '{{adat}}') + selectField('maskMode','Maszkolás módja', b.maskMode || 'characters', [['characters','Karakterek alapján'],['lines','Sorok alapján']]) + checkboxField('invertMask','Invert maszkolás: a megadott részeket maszkolja, a többit hagyja meg', Boolean(b.invertMask)) + checkboxField('clearTrim','Clear / trim mód: a maszkolandó rész törlődik', Boolean(b.clearTrim)) + textField('resultName','Eredmény változó neve', b.resultName || 'maszkolt_adat') + textField('maskChar','Maszk karakter üresen hagyható', b.maskChar ?? '*') + (b.maskMode === 'lines' ? numberField('keepFirstLines','Érintett/meghagyott első sorok', b.keepFirstLines ?? 1) + numberField('keepLastLines','Érintett/meghagyott utolsó sorok', b.keepLastLines ?? 1) + textField('maskLineText','Maszkolt sor szövege üresen hagyható', b.maskLineText ?? '***') : numberField('keepStart','Érintett/meghagyott első karakterek', b.keepStart ?? 2) + numberField('keepEnd','Érintett/meghagyott utolsó karakterek', b.keepEnd ?? 2)) + `<div class="status">Clear/trim módban a maszkolandó rész teljesen törlődik. Normál módban maszk karakter vagy sorhelyettesítő kerül a helyére.</div>`;
  if (b.type === 'email') html += textField('to','Címzett', b.to || '') + textField('subject','Tárgy', b.subject || '') + textArea('body','Törzs', b.body || '') + textField('resultName','Draft változó neve', b.resultName || 'email_draft');
  if (b.type === 'openEmail') html += textField('draftName','Email draft változó', b.draftName || 'email_draft') + numberField('maxUrlLength','Mailto max hossz', b.maxUrlLength || 1800) + `<div class="status">Az extension nem küld emailt. Csak mailto ablakot nyit; hosszú törzs esetén vágólapra másol.</div>`;
  if (b.type === 'scheduledTrigger') html += checkboxField('triggerEnabled','Időzítő aktív', b.triggerEnabled !== false) + selectField('scheduleMode','Időzítés módja', b.scheduleMode || 'interval', [['interval','Percenként'],['daily','Napi időpont']]) + numberField('intervalMinutes','Intervallum percben', b.intervalMinutes || 15) + textField('timeOfDay','Napi időpont HH:MM', b.timeOfDay || '08:00') + textField('days','Napok', b.days || 'mon,tue,wed,thu,fri');
  if (b.type === 'transform') html += textField('source','Forrás', b.source || '{{adat}}') + selectField('operation','Művelet', b.operation || 'trim', [['trim','Trim'],['upper','Nagybetű'],['lower','Kisbetű'],['singleLine','Egy sorba'],['removeEmptyLines','Üres sorok törlése'],['digitsOnly','Csak számok'],['lettersOnly','Csak betűk'],['noAccents','Ékezetek eltávolítása']]) + textField('resultName','Eredmény változó', b.resultName || 'atalakitott_adat');
  if (b.type === 'textSlice') html += textField('source','Forrás', b.source || '{{adat}}') + selectField('mode','Mód', b.mode || 'between', [['between','Kezdő és záró szöveg között'],['line','Adott sor'],['chars','Karakter tartomány']]) + textField('startText','Kezdő szöveg', b.startText || '') + textField('endText','Záró szöveg', b.endText || '') + numberField('lineNumber','Sor száma', b.lineNumber || 1) + numberField('charStart','Karakter kezdete', b.charStart || 0) + numberField('charEnd','Karakter vége', b.charEnd || 100) + textField('resultName','Eredmény változó', b.resultName || 'szovegresz');
  if (b.type === 'regex') html += textField('source','Forrás', b.source || '{{adat}}') + textField('pattern','Regex minta', b.pattern || '') + textField('flags','Flagek', b.flags || 'i') + numberField('group','Capture group', b.group || 0) + checkboxField('allMatches','Összes találat', Boolean(b.allMatches)) + textField('resultName','Eredmény változó', b.resultName || 'regex_talalat');
  if (b.type === 'textSearch') html += textField('query','Keresett szöveg', b.query || '') + selectField('operator','Egyezés módja', b.operator || 'contains', [['contains','Tartalmazza'],['equals','Pontosan egyezik']]) + selectField('searchScope','Hol keressen?', b.searchScope || 'all', [['all','Teljes oldal: szöveg + mezőérték + attribútum'],['visible','Csak látható szöveg'],['dom','Teljes DOM szövege']]) + checkboxField('caseSensitive','Kis/nagybetű számítson', Boolean(b.caseSensitive)) + checkboxField('includeValues','Input/textarea/select értékeket is keresse', b.includeValues !== false) + checkboxField('includeAttributes','Title/aria/placeholder/alt attribútumokban is keressen', b.includeAttributes !== false) + checkboxField('scrollSearch','Dinamikus/virtualizált oldalon görgetéssel is keressen', Boolean(b.scrollSearch)) + selectField('scrollTarget','Görgetési cél keresés közben', b.scrollTarget || 'auto', [['auto','Automatikus'],['page','Teljes oldal'],['nearest','Legnagyobb belső görgethető konténer'],['container','Kézzel kiválasztott görgethető konténer']]) + (b.scrollTarget === 'container' ? '<div class="field"><label>Görgethető konténer</label><button class="btn pick-btn" data-pick="scrollContainer">Elem kiválasztása</button></div>' : '') + numberField('maxScrolls','Max görgetési próbálkozás', b.maxScrolls || 25) + numberField('scrollAmount','Görgetés mértéke px', b.scrollAmount || 700) + numberField('scrollDelayMs','Várakozás görgetés után ms', b.scrollDelayMs || 250) + textField('resultName','Találat igaz/hamis változó', b.resultName || 'szoveg_talalat') + textField('countName','Találatszám változó', b.countName || 'szoveg_talalat_db') + textField('contextName','Első találat környezete változó', b.contextName || 'szoveg_talalat_szoveg') + textField('placeName','Találat helye változó', b.placeName || 'szoveg_talalat_hely') + textField('selectorName','CSS selector változó', b.selectorName || 'szoveg_talalat_selector') + textField('xpathName','XPath változó', b.xpathName || 'szoveg_talalat_xpath') + textField('elementName','Elemhivatkozás változó', b.elementName || 'szoveg_talalat_elem') + textField('rowSelectorName','Találati sor selector változó', b.rowSelectorName || 'szoveg_talalat_sor_selector') + textField('clickableSelectorName','Kattintható szülő selector változó', b.clickableSelectorName || 'szoveg_talalat_click_selector') + textField('parentSelectorName','Panel/kártya selector változó', b.parentSelectorName || 'szoveg_talalat_panel_selector') + textField('nearButtonSelectorName','Közeli gomb selector változó', b.nearButtonSelectorName || 'szoveg_talalat_gomb_selector') + `<div class="status">Görgetéses keresésnél a blokk több körben görgeti az oldalt vagy a belső listát, minden kör után újraolvassa a DOM-ot, majd az első megtalált elem selectorát adja tovább kattintáshoz/görgetéshez.</div>`;
  if (b.type === 'setVar') html += textField('varName','Változó neve', b.varName || 'valtozo') + textArea('value','Érték', b.value || '');
  if (b.type === 'userInput') html += textField('title','Cím', b.title || '') + textArea('message','Kérdés', b.message || '') + selectField('inputType','Mező típusa', b.inputType || 'text', [['text','Rövid szöveg'],['textarea','Hosszú szöveg']]) + textField('placeholder','Placeholder', b.placeholder || '') + textField('defaultValue','Alapérték', b.defaultValue || '') + textField('resultName','Eredmény változó', b.resultName || 'user_input');
  if (b.type === 'userChoice') html += textField('title','Cím', b.title || '') + textArea('message','Kérdés', b.message || '') + textArea('options','Opciók soronként', b.options || '') + textField('resultName','Eredmény változó', b.resultName || 'valasztas');
  if (b.type === 'errorSearch') html += checkboxField('includeAlerts','Alert / notification elemek', b.includeAlerts !== false) + checkboxField('includeAriaLive','aria-live üzenetek', b.includeAriaLive !== false) + checkboxField('includeErrorClasses','error/invalid classok', b.includeErrorClasses !== false) + checkboxField('includeInvalidFields','aria-invalid / invalid mezők', b.includeInvalidFields !== false) + textField('resultName','Hiba van változó', b.resultName || 'hiba_van') + textField('textName','Hiba szöveg változó', b.textName || 'hiba_szoveg') + textField('selectorName','Hiba selector változó', b.selectorName || 'hiba_selector') + textField('countName','Találatszám változó', b.countName || 'hiba_db');
  if (b.type === 'fieldByLabel') html += textField('labelText','Mező címkéje / aria / data név', b.labelText || '') + selectField('matchMode','Egyezés', b.matchMode || 'contains', [['contains','Tartalmazza'],['equals','Pontosan egyezik']]) + checkboxField('caseSensitive','Kis/nagybetű számítson', Boolean(b.caseSensitive)) + checkboxField('shadowSearch','Shadow DOM keresés', b.shadowSearch !== false) + textField('resultName','Eredmény érték változó', b.resultName || 'mezo_ertek') + textField('selectorName','Selector változó', b.selectorName || 'mezo_selector') + textField('xpathName','XPath változó', b.xpathName || 'mezo_xpath') + textField('elementName','Elemhivatkozás változó', b.elementName || 'mezo_elem');
  if (b.type === 'tableExtract') html += selectField('rowMode','Sor kiválasztása', b.rowMode || 'first', [['first','Első'],['last','Utolsó'],['nth','N. sor'],['contains','Tartalmazza']]) + (b.rowMode === 'nth' ? numberField('rowIndex','N. sor száma', b.rowIndex || 1) : '') + textField('rowContains','Sor tartalmazza', b.rowContains || '') + checkboxField('includeHeader','Fejlécsort is beleszámolja', Boolean(b.includeHeader)) + checkboxField('skipEmptyRows','Üres sorokat kihagyja', b.skipEmptyRows !== false) + checkboxField('virtualSearch','Virtualizált lista/tábla: görgetéssel keressen tovább', Boolean(b.virtualSearch)) + numberField('maxScrolls','Max görgetési próbálkozás', b.maxScrolls || 10) + numberField('scrollAmount','Görgetés mértéke px', b.scrollAmount || 600) + selectField('missingRowMode','Ha nincs ilyen sor', b.missingRowMode || 'empty', [['empty','Üres érték'],['error','Hiba']]) + selectField('columnMode','Oszlop kiválasztása', b.columnMode || 'index', [['index','Oszlop száma'],['header','Fejlécnév alapján']]) + (b.columnMode === 'header' ? textField('columnHeader','Fejléc neve', b.columnHeader || '') : numberField('columnIndex','Oszlop száma', b.columnIndex || 1)) + textField('resultName','Eredmény változó', b.resultName || 'tabla_adat') + `<div class="status">Virtualizált SNOW/React/Vue tábláknál a DOM-ban gyakran csak a látható sorok vannak jelen. A görgetéses keresés ilyenkor több körben újraolvassa a sorokat.</div>`;
  if (b.type === 'elementLoop') html += textField('selector','Selector opcionális', b.selector || '') + textField('itemVar','Elem szöveg változó', b.itemVar || 'elem_szoveg') + textField('indexVar','Index változó', b.indexVar || 'elem_index') + numberField('maxItems','Maximum elem', b.maxItems || 20);
  if (b.type === 'scroll') html += selectField('mode','Görgetés módja', b.mode || 'element', [['element','Elemhez görget'],['page','Oldal/konténer görgetése']]) + selectField('scrollTarget','Görgetési cél', b.scrollTarget || 'auto', [['auto','Automatikus'],['page','Teljes oldal'],['nearest','Cél elem legközelebbi görgethető konténere / nagy belső lista'],['container','Kézzel kiválasztott görgethető konténer']]) + (b.scrollTarget === 'container' ? '<div class="field"><label>Görgethető konténer</label><button class="btn pick-btn" data-pick="scrollContainer">Elem kiválasztása</button></div>' : '') + selectField('align','Elem igazítása', b.align || 'center', [['center','Középre'],['top','Felülre'],['bottom','Alulra']]) + selectField('direction','loadMode','onTimeout','position','waitForClick','Irány', b.direction || 'down', [['down','Le'],['up','Fel'],['top','Tetejére'],['bottom','Aljára'],['untilText','Görgetés szövegig']]) + (b.direction === 'untilText' ? textField('searchText','Keresett szöveg görgetés közben', b.searchText || '') + numberField('maxScrolls','Max görgetési próbálkozás', b.maxScrolls || 25) + numberField('scrollDelayMs','Várakozás görgetés után ms', b.scrollDelayMs || 250) : numberField('amount','Mennyiség px', b.amount || 500)) + '<div class="status">Automatikus módban a blokk megkeresi a cél elem vagy dinamikus találat legjobb belső görgethető konténerét, és azt görgeti, nem feltétlenül az egész oldalt.</div>';
  if (b.type === 'waitUntil') html += selectField('conditionMode','Feltétel', b.conditionMode || 'textExists', [['textExists','Szöveg megjelenik'],['elementExists','Elem megjelenik'],['elementVisible','Elem látható'],['elementHidden','Elem eltűnik'],['elementClickable','Elem kattintható'],['valueContains','Mezőérték tartalmazza'],['valueChanges','Mezőérték megváltozik'],['urlContains','URL tartalmazza'],['urlChanges','URL megváltozik'],['spinnerGone','Spinner/betöltés eltűnik'],['domStable','DOM stabil']]) + textField('text','Szöveg', b.text || '') + textField('value','Érték', b.value || '') + textField('spinnerSelector','Spinner selector opcionális', b.spinnerSelector || '') + numberField('stableMs','DOM stabil idő ms', b.stableMs || 800) + numberField('timeoutMs','Timeout ms', b.timeoutMs || 10000);
  if (b.type === 'waitLoad') html += selectField('loadMode','Betöltés típusa', b.loadMode || 'auto', [['auto','Automatikus'],['pageReady','Oldal betöltődött'],['domStable','DOM stabil'],['spinnerGone','Spinner/betöltés eltűnt'],['elementVisible','Kiválasztott elem megjelent'],['elementClickable','Kiválasztott elem kattintható']]) + textField('spinnerSelector','Spinner selector opcionális', b.spinnerSelector || '') + numberField('stableMs','DOM stabil idő ms', b.stableMs || 800) + numberField('timeoutMs','Timeout ms', b.timeoutMs || 15000) + selectField('onTimeout','Timeout esetén', b.onTimeout || 'error', [['error','Hibával álljon meg'],['continue','Folytassa']]) + `<div class="status">Tipp: kattintás vagy URL megnyitása után tedd be ezt a blokkot, majd utána jöhet az adatkinyerés.</div>`;
  if (b.type === 'openUrl') html += textField('url','URL', b.url || '') + selectField('mode','Megnyitás', b.mode || 'newTab', [['sameTab','Aktuális tab'],['newTab','Új tab'],['newWindow','Új ablak']]);
  if (b.type === 'screenshot') html += selectField('action','Képernyőkép kezelése', b.action || (b.openPreview ? 'preview' : 'preview'), [['preview','Előnézet új tabon'],['download','Letöltés PNG-ként'],['clipboard','Vágólapra másolás'],['variable','Csak változóba mentés']]) + textField('fileName','Letöltési fájlnév előtag', b.fileName || 'blockflow-screenshot') + textField('resultName','Eredmény változó', b.resultName || 'screenshot_data_url') + `<div class="status">A Chrome csak az aktív, látható tabról tud képernyőképet készíteni. A BlockFlow röviden fókuszálja a cél tabot, elkészíti a képet, majd visszaállítja a fókuszt, ha nem előnézetet kérsz.</div>`;
  if (b.type === 'localSet') html += textField('key','Kulcs', b.key || '') + textArea('value','Érték', b.value || '');
  if (b.type === 'localGet') html += textField('key','Kulcs', b.key || '') + textField('defaultValue','Alapérték ha nincs', b.defaultValue || '') + textField('resultName','Eredmény változó', b.resultName || 'local_adat');
  if (b.type === 'compare') html += textField('left','Bal oldal', b.left || '') + selectField('operator','Operátor', b.operator || 'equals', [['equals','Egyenlő'],['notEquals','Nem egyenlő'],['contains','Tartalmazza'],['greater','Nagyobb'],['less','Kisebb']]) + textField('right','Jobb oldal', b.right || '') + textField('resultName','Eredmény változó', b.resultName || 'osszehasonlitas');
  if (b.type === 'math') html += textField('left','A', b.left || '0') + selectField('operator','Művelet', b.operator || 'add', [['add','Összeadás'],['subtract','Kivonás'],['multiply','Szorzás'],['divide','Osztás']]) + textField('right','B', b.right || '1') + textField('resultName','Eredmény változó', b.resultName || 'szamitas');
  if (b.type === 'validateData') html += textField('source','Forrás', b.source || '{{adat}}') + selectField('validation','Validáció', b.validation || 'notEmpty', [['notEmpty','Nem üres'],['email','Email formátum'],['contains','Tartalmazza'],['regex','Regex']]) + textField('pattern','Minta', b.pattern || '') + selectField('onFail','Hiba esetén', b.onFail || 'stop', [['stop','Leállítás'],['warn','Csak napló']]);
  if (b.type === 'groupBlock') html += checkboxField('groupEnabled','A csoport blokkjai aktívak', b.groupEnabled !== false) + checkboxField('collapsed','Csoport összecsukása a munkaterületen', Boolean(b.collapsed)) + `<div class="status">Ha a csoport inaktív, a benne lévő blokkok futáskor kimaradnak. Összecsukva a gyermekblokkok helyett csak az ikonjaik látszanak, a workflow áttekinthetőbb marad.</div>`;

  if (CONTAINERS.has(b.type)) html += `<div class="hr"></div><div class="status">Tipp: ${b.type === 'triggerGroup' ? 'húzz ide Figyelő feltétel blokkokat. Ezek nem futási lépések, csak eldöntik, induljon-e az automatizmus.' : 'húzz blokkokat a blokk alatti behúzott területre, vagy hagyd kijelölve ezt a blokkot és adj hozzá új blokkot a bal oldali palettából.'}</div>`;
  html += `<div class="hr"></div><button id="testBlock" class="ghost">Blokk tesztelése</button>`;
  $('#inspector').innerHTML = html;
  $('#inspector').querySelectorAll('[data-field]').forEach(input => {
    const handler = () => updateField(input.dataset.field, input.type === 'checkbox' ? input.checked : input.value);
    input.oninput = handler; input.onchange = handler;
  });
  const soundFile = $('#customSoundFile');
  if (soundFile) soundFile.onchange = async e => {
    const f = e.target.files?.[0]; if (!f) return;
    if (!/^audio\//.test(f.type || '') && !/\.(mp3|wav|ogg|m4a)$/i.test(f.name || '')) return alert('Csak hangfájl tölthető fel.');
    if (f.size > 1024 * 1024) return alert('A saját hang legyen rövid, maximum 1 MB.');
    const dataUrl = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(f); });
    const block = findBlock(selectedBlockId)?.block; if (!block) return;
    block.soundSource = 'custom'; block.customSoundName = f.name; block.customSoundData = dataUrl;
    markDirty(); renderInspector(); renderBlocks(); $('#log').textContent = `Saját hang feltöltve: ${f.name}`;
  };
  const previewSound = $('#previewCustomSound');
  if (previewSound) previewSound.onclick = () => {
    const block = findBlock(selectedBlockId)?.block;
    if (block?.customSoundData) { const a = new Audio(block.customSoundData); a.volume = Math.max(0, Math.min(1, Number(block.volume ?? 0.7))); a.play().catch(()=>{}); }
    else alert('Nincs feltöltött saját hang.');
  };
  const pick = $('#pickElement'); if (pick) pick.onclick = () => startPick(b.id, 'target');
  document.querySelectorAll('[data-pick]').forEach(btn => btn.onclick = () => startPick(b.id, btn.dataset.pick || 'target'));
  const test = $('#testBlock'); if (test) test.onclick = () => testBlock(b);
  const popupTest = $('#testPopup'); if (popupTest) popupTest.onclick = testPopup;
  const fillScope = $('#fillCurrentScope');
  if (fillScope) fillScope.onclick = () => {
    const block = findBlock(selectedBlockId)?.block;
    if (!block) return;
    block.domain = currentTargetHost || block.domain || '';
    block.path = currentTargetPath || block.path || '/';
    block.url = currentTargetUrl || block.url || '';
    if (!block.urlContains) block.urlContains = currentTargetHost || '';
    markDirty();
    renderBlocks();
    renderInspector();
  };
  if (changedBlock) {
    const inspectorCol = document.querySelector('.inspector');
    if (inspectorCol) inspectorCol.scrollTo({ top: 0, behavior: 'smooth' });
    lastInspectorBlockId = b.id;
  }
}

function targetEditor(b){ return `<div class="field"><label>Cél elem</label><div class="status">${b.target ? escapeHtml(b.target.label + ' · ' + b.target.tag) : 'Nincs elem kiválasztva'}</div><button id="pickElement" class="primary">Elem kiválasztása az oldalról</button></div>`; }
function watcherAdvanced(b){
  const scope = b.scope || 'domain';
  let detail = '';
  if (scope === 'domain') detail = textField('domain','Figyelt domain', b.domain || currentTargetHost || '');
  if (scope === 'path') detail = `<div class="form-grid two">${textField('domain','Figyelt domain', b.domain || currentTargetHost || '')}${textField('path','Path prefix', b.path || currentTargetPath || '/')}</div>`;
  if (scope === 'exact') detail = textField('url','Pontos URL', b.url || currentTargetUrl || '');
  if (scope === 'contains') detail = textField('urlContains','URL tartalmazza ezt', b.urlContains || '');
  if (scope === 'any') detail = '<div class="status">Bármely weboldalon aktív, ahol az extension hozzáfér a laphoz.</div>';
  return `<div class="status">Ez indító/figyelő blokk. Mentés után automatikusan aktív figyelőként működik a nyitott weboldalon.</div>` +
    `<div class="status"><b>Aktuális scope:</b> ${escapeHtml(scopeLabel(scope))} · ${escapeHtml(scopeDetailValue(b))}</div>` +
    checkboxField('triggerEnabled','Automatikus figyelő aktív', b.triggerEnabled !== false) +
    checkboxField('runOnce','Csak egyszer fusson', Boolean(b.runOnce)) +
    selectField('scope','Hol figyelje?', scope, [['domain','Ezen a domainen'],['path','Domain + path alatt'],['exact','Pontos URL-en'],['contains','URL tartalmazza'],['any','Bármely oldalon']]) +
    detail +
    `<button type="button" class="small" id="fillCurrentScope">Jelenlegi oldal adataival kitöltés</button>` +
    numberField('throttleSec','Újraindítási szünet másodpercben', b.throttleSec || 15);
}

function valueSourceHelp(){ return `<div class="status">Használható változók: {{email}}, {{nev}}, {{popup_szoveg}}. A jobb oldali változóra kattintva vágólapra másolódik.</div>`; }
function textField(field,label,value){ return `<div class="field"><label>${label}</label><input data-field="${field}" value="${escapeAttr(value)}"></div>`; }
function numberField(field,label,value){ return `<div class="field"><label>${label}</label><input data-field="${field}" type="number" value="${escapeAttr(value)}"></div>`; }
function checkboxField(field,label,value){ return `<label class="check"><input data-field="${field}" type="checkbox" ${value?'checked':''}> ${label}</label>`; }
function textArea(field,label,value){ return `<div class="field"><label>${label}</label><textarea data-field="${field}">${escapeHtml(value)}</textarea></div>`; }
function selectField(field,label,value,options){
  const opts = Array.isArray(options) ? options : [];
  return `<div class="field"><label>${label}</label><select data-field="${field}">${opts.map(([v,l])=>`<option value="${escapeAttr(v)}" ${v===value?'selected':''}>${escapeHtml(l)}</option>`).join('')}</select></div>`;
}
function updateField(field, value) {
  const b = findBlock(selectedBlockId)?.block;
  if (!b) return;
  b[field] = ['timeoutMs','ms','maxUrlLength','repeatCount','maxRows','keepStart','keepEnd','keepFirstLines','keepLastLines','throttleSec','intervalSec','intervalMinutes','charStart','charEnd','lineNumber','group','columnIndex','rowIndex','maxItems','attempts','delayMs','amount','volume','stableMs','maxOptionScrolls','matchIndex'].includes(field) ? Number(value) : value;
  markDirty();
  renderBlocks();
  renderVariables();
  renderImportWarning();
  if (['waitMode','conditionMode','maskMode','scope','domain','path','url','urlContains','logic','operator','changeMode','readMode','searchScope','firstRun','pageSize','orientation','source','action','style','align','soundSource','rowMode','columnMode','scrollTarget','mode','direction','loadMode','onTimeout','position','waitForClick'].includes(field)) renderInspector();
}

function renderVariables() {
  const defs = BF.collectVariables(activeWorkflow);
  const refs = BF.collectVariableRefs ? BF.collectVariableRefs(activeWorkflow) : [];
  const all = [...new Set([...defs, ...refs])];
  $('#variables').innerHTML = all.length ? all.map(v => `<button class="var-chip ${defs.includes(v)?'':'var-warn'}" type="button" data-var="${v}" title="Másolás vágólapra: {{${v}}}">{{${v}}}</button>`).join('') : '<div class="muted">Még nincs változó.</div>';
  document.querySelectorAll('[data-var]').forEach(chip => chip.onclick = async () => { await navigator.clipboard.writeText(`{{${chip.dataset.var}}}`); chip.classList.add('copied'); setTimeout(()=>chip.classList.remove('copied'), 800); $('#log').textContent = `Változó vágólapra másolva: {{${chip.dataset.var}}}`; });
}

function renderLiveVariables(vars) {
  const panel = $('#liveVariables');
  if (!panel) return;
  if (!vars) { panel.textContent = 'Még nincs futási eredmény.'; return; }
  panel.innerHTML = Object.entries(vars).map(([k,v]) => `<div><b>{{${escapeHtml(k)}}}</b> = ${escapeHtml(typeof v === 'object' ? JSON.stringify(v) : String(v)).slice(0, 300)}</div>`).join('') || 'Nincs változó.';
}

function renderValidation() {
  const panel = $('#validationPanel');
  if (!panel) return;
  const validation = BF.validateWorkflow(activeWorkflow);
  panel.innerHTML = validation.issues.length ? validation.issues.map(i => `<div class="${i.level === 'error' ? 'issue-error' : 'issue-warn'}" data-issue-block="${i.blockId || ''}">${i.level === 'error' ? '✕' : '⚠'} ${escapeHtml(i.text)}</div>`).join('') : '<div class="issue-ok">✓ Nincs ismert hiba.</div>';
  panel.querySelectorAll('[data-issue-block]').forEach(el => el.onclick = () => { if (el.dataset.issueBlock) { selectedBlockId = el.dataset.issueBlock; renderAll(); } });
}

async function validateBeforeRun({ allowContinue=false } = {}) {
  const v = BF.validateWorkflow(activeWorkflow);
  renderValidation();
  if (!v.ok && !allowContinue) {
    $('#log').textContent = 'Az ellenőrzés hibát talált. Javítsd a piros hibákat, vagy indítsd Dry-run módban.';
    return false;
  }
  if (v.issues.some(i => i.level === 'warning') && !allowContinue) {
    return confirm('Az ellenőrzés figyelmeztetéseket talált. Folytatod?');
  }
  return true;
}

async function startPick(blockId, field) {
  await refreshTarget();
  $('#log').textContent = 'Elemkiválasztás indítása. Válts vissza automatikusan a cél oldalra, majd kattints a kijelölt elemre.';
  const res = await BF.sendToTarget({ type: 'BF_START_PICKER', context: { source: 'builder', workflowId: activeWorkflow.id, blockId, field } }, targetTabId);
  if (!res.ok || !res.response?.ok) alert(res.error || res.response?.error || 'Nem sikerült elindítani az elemkiválasztást.');
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'BF_ELEMENT_PICKED' && msg.context?.source === 'builder') {
    const b = findBlock(msg.context.blockId)?.block;
    if (b) { b[msg.context.field || 'target'] = msg.element; selectedBlockId = b.id; markDirty(); renderAll(); $('#log').textContent = `Elem kiválasztva: ${msg.element.label}`; }
  }
});

async function testBlock(b) {
  await refreshTarget();
  if (b.target) {
    const res = await BF.sendToTarget({ type: 'BF_TEST_TARGET', target: b.target }, targetTabId);
    $('#log').textContent = res.response?.ok ? `Teszt OK: ${res.response.element.label}` : `Teszt hiba: elem nem található`;
  } else if (b.type === 'popupWait' || b.type === 'popupExtract' || b.type === 'popupClick') {
    await testPopup();
  } else $('#log').textContent = 'Ehhez a blokkhoz nincs külön cél elem. Használd a Dry-run futtatást.';
}
async function testPopup() { await refreshTarget(); const res = await BF.sendToTarget({ type: 'BF_TEST_POPUP' }, targetTabId); $('#log').textContent = res.response?.ok ? `Popup találva:\n${res.response.text}` : `Nem találtam popupot.`; }

function reidBlocks(blocks) {
  for (const b of blocks || []) {
    b.id = crypto.randomUUID();
    if (Array.isArray(b.children)) reidBlocks(b.children);
    if (Array.isArray(b.elseChildren)) reidBlocks(b.elseChildren);
  }
}

async function saveCurrent(){
  normalizeWorkflow(activeWorkflow);
  activeWorkflow.name = $('#workflowName').value || 'Névtelen automatizmus';
  workflows = workflows.map(w => w.id === activeWorkflow.id ? activeWorkflow : w);
  await BF.saveWorkflow(activeWorkflow);
  await syncTriggerWatchersFromBlocks(activeWorkflow);
  await syncSchedulesForWorkflow(activeWorkflow);
  const store = await BF.getStore(); workflows = store.workflows;
  isDirty = false;
  renderSaveState();
}

async function syncTriggerWatchersFromBlocks(workflow) {
  const data = await chrome.storage.local.get('watchers');
  const all = Array.isArray(data.watchers) ? data.watchers : [];
  let tabInfo = null;
  try { tabInfo = await BF.getTargetTab(targetTabId); } catch {}
  const currentUrl = tabInfo?.url || '';
  let u = null; try { u = new URL(currentUrl); } catch {}
  const domain = u?.hostname || '';
  const path = u?.pathname || '/';
  const blockWatchers = [];
  BF.walkBlocks(workflow.blocks || [], b => {
    if (b.type === 'clickTrigger') {
      if (b.triggerEnabled === false || !b.target) return;
      blockWatchers.push({
        id: `click:${workflow.id}:${b.id}`,
        source: 'block',
        sourceBlockId: b.id,
        workflowId: workflow.id,
        enabled: true,
        mode: 'click',
        target: b.target || null,
        scope: b.scope || 'domain',
        domain: b.domain || domain,
        path: b.path || path,
        url: b.url || currentUrl,
        urlContains: b.urlContains || '',
        intervalSec: 2,
        throttleSec: Math.max(1, Number(b.throttleSec || 15)),
        runOnce: Boolean(b.runOnce),
        createdAt: b.createdAt || new Date().toISOString()
      });
      return;
    }
    if (b.type !== 'triggerGroup') return;
    if (b.triggerEnabled === false) return;
    const cloneCondition = c => ({
      type: c.type,
      text: c.text || '',
      caseSensitive: Boolean(c.caseSensitive),
      target: c.target || null,
      requireVisible: c.requireVisible !== false,
      operator: c.operator || 'contains',
      value: c.value || '',
      readMode: c.readMode || 'auto',
      attributeName: c.attributeName || 'title',
      searchScope: c.searchScope || 'dom',
      changeMode: c.changeMode || 'fromTo',
      fromValue: c.fromValue || '',
      toValue: c.toValue || '',
      firstRun: c.firstRun || 'learn',
      logic: c.logic || 'all',
      children: (c.children || []).filter(x => String(x.type || '').startsWith('condition')).map(cloneCondition),
      id: c.id
    });
    const conditions = (b.children || []).filter(c => String(c.type || '').startsWith('condition')).map(cloneCondition);
    if (!conditions.length) return;
    blockWatchers.push({
      id: `block:${workflow.id}:${b.id}`,
      source: 'block',
      sourceBlockId: b.id,
      workflowId: workflow.id,
      enabled: true,
      mode: 'group',
      logic: b.logic || 'all',
      conditions,
      scope: b.scope || 'domain',
      domain: b.domain || domain,
      path: b.path || path,
      url: b.url || currentUrl,
      urlContains: b.urlContains || '',
      intervalSec: Math.max(1, Number(b.intervalSec || 2)),
      throttleSec: Math.max(1, Number(b.throttleSec || 15)),
      runOnce: Boolean(b.runOnce),
      createdAt: b.createdAt || new Date().toISOString()
    });
  });
  const kept = all.filter(w => w.workflowId !== workflow.id);
  await chrome.storage.local.set({ watchers: [...kept, ...blockWatchers] });
  await chrome.runtime.sendMessage({ type:'BF_REFRESH_ALL_WATCHERS' }).catch(async () => {
    await BF.sendToTarget({ type:'BF_REFRESH_WATCHERS' }, targetTabId).catch(()=>{});
  });
}
async function runCurrent(dryRun=false, forceRun=false) {
  await saveCurrent(); await refreshTarget();
  if (!dryRun && (activeWorkflow.verified === false || activeWorkflow.imported)) {
    if (!confirm('Ez importált vagy nem ellenőrzött automatizmus. Javasolt előbb Dry-run módban tesztelni. Mégis futtatod?')) return;
  }
  const canRun = await validateBeforeRun({ allowContinue: dryRun });
  if (!canRun) return;
  $('#log').textContent = forceRun ? 'Kényszerített futtatás...' : (dryRun ? 'Dry-run futtatás...' : 'Futtatás...');
  const res = await BF.sendToTarget({ type: 'BF_RUN_WORKFLOW', workflow: activeWorkflow, options: { dryRun, forceRun } }, targetTabId);
  if (res.response?.ok) {
    renderLiveVariables(res.response.result.vars);
    $('#log').textContent = `${res.response.result.skipped ? 'Nem indult el' : 'Kész'}${dryRun?' [dry-run]':''}${forceRun?' [force]':''}\n${JSON.stringify(res.response.result.vars, null, 2)}\n\n${(res.response.result.log || []).join('\n')}`;
  } else {
    const failing = res.response?.blockId;
    if (failing) selectedBlockId = failing;
    $('#log').textContent = `Hiba: ${res.response?.error || res.error}\n\n${(res.response?.log || []).join('\n')}`;
    renderAll();
  }
}



async function syncSchedulesForWorkflow(workflow) {
  const data = await chrome.storage.local.get('schedules');
  const all = Array.isArray(data.schedules) ? data.schedules : [];
  const schedules = [];
  BF.walkBlocks(workflow.blocks || [], b => {
    if (b.type !== 'scheduledTrigger' || b.triggerEnabled === false) return;
    schedules.push({ id: `sched:${workflow.id}:${b.id}`, workflowId: workflow.id, sourceBlockId: b.id, enabled: true, scheduleMode: b.scheduleMode || 'interval', intervalMinutes: Math.max(1, Number(b.intervalMinutes || 15)), timeOfDay: b.timeOfDay || '08:00', days: b.days || 'mon,tue,wed,thu,fri' });
  });
  await chrome.storage.local.set({ schedules: [...all.filter(s => s.workflowId !== workflow.id), ...schedules] });
  await chrome.runtime.sendMessage({ type:'BF_REFRESH_SCHEDULES' }).catch(()=>{});
}

async function renderWatcherPanel() {
  const panel = $('#watcherPanel'); if (!panel) return;
  const data = await chrome.storage.local.get('watchers');
  const watchers = Array.isArray(data.watchers) ? data.watchers : [];
  const mine = watchers.filter(w => w.workflowId === activeWorkflow.id);
  let triggerBlocks = [];
  BF.walkBlocks(activeWorkflow.blocks || [], b => { if (b.type === 'triggerGroup') triggerBlocks.push(b); });
  const activeCount = triggerBlocks.filter(b => b.triggerEnabled !== false).length;
  panel.innerHTML = `
    <div class="compact-head">
      <div><b>${triggerBlocks.length} figyelő trigger</b><br><span class="muted">${activeCount} aktív · Indítás kategória blokkjai</span></div>
    </div>
    <div class="compact-help">A figyelők most már blokkok. Add hozzá őket bal oldalt az <b>Indítás</b> kategóriából. A fő beállítások a blokkon látszanak, a részletesek a jobb oldali panelen.</div>
    ${triggerBlocks.length ? triggerBlocks.map(b => `<div class="compact-row trigger-row" data-trigger-block="${b.id}">
      <label class="toggle-mini"><input type="checkbox" data-trigger-enable="${b.id}" ${b.triggerEnabled!==false?'checked':''}></label>
      <div class="compact-main"><b>${escapeHtml(BF.blockTitle(b))}</b><span>${escapeHtml(`${(b.children||[]).length} feltétel · ${BF.triggerLogicLabel ? BF.triggerLogicLabel(b.logic || 'all') : (b.logic || 'all')}`)}</span><small>${escapeHtml(scopeLabel(b.scope || 'domain'))}: ${escapeHtml(scopeDetailValue(b))} · ${Number(b.throttleSec || 15)} mp szünet${b.runOnce ? ' · egyszer fut' : ''}</small></div>
      <button class="small" data-select-trigger="${b.id}">Beállítás</button>
    </div>`).join('') : '<div class="compact-empty">Nincs figyelő trigger. Adj hozzá egy „Figyelő trigger” blokkot az Indítás kategóriából, majd húzz alá feltételeket.</div>'}
  `;
  panel.querySelectorAll('[data-select-trigger]').forEach(btn => btn.onclick = () => { selectedBlockId = btn.dataset.selectTrigger; renderAll(); });
  panel.querySelectorAll('[data-trigger-enable]').forEach(input => input.onchange = async () => {
    const b = findBlock(input.dataset.triggerEnable)?.block; if (!b) return;
    b.triggerEnabled = input.checked;
    await saveCurrent(); renderAll();
  });
}

async function openWatcherEditor(watcherId) {
  const data = await chrome.storage.local.get('watchers');
  const watchers = Array.isArray(data.watchers) ? data.watchers : [];
  const w = watchers.find(x => x.id === watcherId); if (!w) return;
  let tabInfo = null;
  try { tabInfo = await BF.getTargetTab(targetTabId); } catch {}
  const currentUrl = tabInfo?.url || '';
  let u = null; try { u = new URL(currentUrl); } catch {}
  const currentDomain = u?.hostname || '';
  const currentPath = u?.pathname || '/';
  const scope = w.scope || 'domain';
  openModal(`
    <div class="modal-title">Figyelő szerkesztése</div>
    <div class="modal-subtitle">Automatikusan indítja ezt az automatizmust, ha a feltétel teljesül a nyitott weboldalon.</div>
    <div class="form-grid two">
      <label class="check"><input type="checkbox" id="mwEnabled" ${w.enabled!==false?'checked':''}> aktív</label>
      <label class="check"><input type="checkbox" id="mwRunOnce" ${w.runOnce?'checked':''}> csak egyszer fusson</label>
    </div>
    <div class="field"><label>Típus</label><select id="mwMode"><option value="text" ${w.mode!=='element'?'selected':''}>Szöveg / karakter megjelenik</option><option value="element" ${w.mode==='element'?'selected':''}>Elem megjelenik</option></select></div>
    <div id="mwTextFields" class="${w.mode==='element'?'hidden':''}">
      <div class="field"><label>Figyelt szöveg vagy karakter</label><input id="mwText" value="${escapeAttr(w.text || '')}" placeholder="pl. Available vagy #"></div>
      <label class="check"><input type="checkbox" id="mwCase" ${w.caseSensitive?'checked':''}> kis/nagybetű számítson</label>
    </div>
    <div id="mwElementFields" class="${w.mode==='element'?'':'hidden'}">
      <div class="field"><label>Cél elem</label><div class="status">${w.target ? escapeHtml((w.target.label || '') + ' · ' + (w.target.tag || '')) : 'Nincs cél elem'}</div></div>
      <button class="small" id="mwUseSelected">Kijelölt blokk cél elemének használata</button>
    </div>
    <div class="field"><label>Hol figyelje?</label><select id="mwScope">
      <option value="domain" ${scope==='domain'?'selected':''}>Ezen a domainen</option>
      <option value="path" ${scope==='path'?'selected':''}>Ezen a domainen és path alatt</option>
      <option value="exact" ${scope==='exact'?'selected':''}>Csak ezen a pontos URL-en</option>
      <option value="contains" ${scope==='contains'?'selected':''}>URL tartalmazza</option>
      <option value="any" ${scope==='any'?'selected':''}>Bármely oldalon</option>
    </select></div>
    <div class="form-grid two">
      <div class="field"><label>Domain</label><input id="mwDomain" value="${escapeAttr(w.domain || currentDomain)}"></div>
      <div class="field"><label>Path prefix</label><input id="mwPath" value="${escapeAttr(w.path || currentPath)}"></div>
    </div>
    <div class="field"><label>Pontos URL / URL részlet</label><input id="mwUrl" value="${escapeAttr(w.url || w.urlContains || currentUrl)}"></div>
    <div class="form-grid two">
      <div class="field"><label>Újraindítási szünet másodpercben</label><input id="mwThrottle" type="number" min="1" value="${escapeAttr(w.throttleSec || 15)}"></div>
      <div class="field"><label>Gyors kitöltés</label><button class="small" id="mwFillCurrent">Jelenlegi domain/path/URL</button></div>
    </div>
    <div class="modal-actions"><button id="modalCancel">Mégse</button><button id="mwSave" class="primary">Mentés</button></div>
  `);
  $('#mwMode').onchange = () => {
    $('#mwTextFields').classList.toggle('hidden', $('#mwMode').value === 'element');
    $('#mwElementFields').classList.toggle('hidden', $('#mwMode').value !== 'element');
  };
  $('#mwFillCurrent').onclick = () => { $('#mwDomain').value = currentDomain; $('#mwPath').value = currentPath; $('#mwUrl').value = currentUrl; };
  $('#mwUseSelected').onclick = () => {
    const selected = findBlock(selectedBlockId)?.block;
    if (!selected?.target) return alert('Jelölj ki olyan blokkot, amelynek van cél eleme.');
    w.target = selected.target;
    const st = $('#mwElementFields .status'); if (st) st.textContent = `${selected.target.label || ''} · ${selected.target.tag || ''}`;
  };
  $('#modalCancel').onclick = closeModal;
  $('#mwSave').onclick = async () => {
    w.enabled = $('#mwEnabled').checked;
    w.runOnce = $('#mwRunOnce').checked;
    w.mode = $('#mwMode').value;
    w.text = $('#mwText')?.value || '';
    w.caseSensitive = $('#mwCase')?.checked || false;
    w.scope = $('#mwScope').value;
    w.domain = $('#mwDomain').value.trim();
    w.path = $('#mwPath').value.trim() || '/';
    w.url = $('#mwUrl').value.trim();
    w.urlContains = $('#mwUrl').value.trim();
    w.throttleSec = Math.max(1, Number($('#mwThrottle').value || 15));
    await chrome.storage.local.set({ watchers });
    await BF.sendToTarget({ type:'BF_REFRESH_WATCHERS' }, targetTabId).catch(()=>{});
    closeModal();
    renderWatcherPanel();
  };
}

function findFirstTarget(blocks){ let found=null; BF.walkBlocks(blocks||[], b => { if(!found && b.target) found=b; }); return found; }

async function renderTemplates() {
  const panel = $('#templatePanel'); if (!panel) return;
  const templates = await BF.getTemplates();
  panel.innerHTML = `
    <div class="compact-head">
      <div><b>${templates.length} sablon</b><br><span class="muted">Email összeállítása blokkokhoz</span></div>
      <button id="newTemplate" class="small primary">+ Új sablon</button>
    </div>
    <div class="compact-help">A sablonok részletes szerkesztőablakban nyílnak meg. A jobb panelen csak a rövid lista látszik.</div>
    ${templates.length ? templates.map(t => `<div class="compact-row template-compact-row" data-template="${t.id}">
      <div class="compact-main"><b>${escapeHtml(t.name || 'Névtelen sablon')}</b><span>${escapeHtml(t.subject || 'Nincs tárgy')}</span><small>${escapeHtml((t.body || '').slice(0, 80))}${(t.body || '').length > 80 ? '...' : ''}</small></div>
      <div class="compact-actions template-compact-actions">
        <button class="small" data-edit-template="${t.id}">Szerkesztés</button>
        <button class="small" data-use-template="${t.id}">Beillesztés</button>
        <button class="small danger" data-del-template="${t.id}">Törlés</button>
      </div>
    </div>`).join('') : '<div class="compact-empty">Nincs email sablon.</div>'}
  `;
  $('#newTemplate').onclick = async () => {
    const t = { id: crypto.randomUUID(), name: 'Új sablon', subject: '', body: '' };
    templates.unshift(t);
    await BF.saveTemplates(templates);
    renderTemplates();
    openTemplateEditor(t.id);
  };
  panel.querySelectorAll('[data-edit-template]').forEach(btn => btn.onclick = () => openTemplateEditor(btn.dataset.editTemplate));
  panel.querySelectorAll('[data-use-template]').forEach(btn => btn.onclick = async () => {
    const t=templates.find(x=>x.id===btn.dataset.useTemplate);
    const b=findBlock(selectedBlockId)?.block;
    if(!t || !b || b.type!=='email') return alert('Jelölj ki egy Email összeállítása blokkot.');
    b.subject=t.subject||''; b.body=t.body||''; markDirty(); renderAll(); $('#log').textContent = `Sablon beillesztve: ${t.name || 'sablon'}`;
  });
  panel.querySelectorAll('[data-del-template]').forEach(btn => btn.onclick = async () => {
    if (!confirm('Törlöd ezt a sablont?')) return;
    await BF.saveTemplates(templates.filter(t=>t.id!==btn.dataset.delTemplate)); renderTemplates();
  });
}

async function openTemplateEditor(templateId) {
  const templates = await BF.getTemplates();
  const t = templates.find(x => x.id === templateId); if (!t) return;
  openModal(`
    <div class="modal-title">Email sablon szerkesztése</div>
    <div class="modal-subtitle">Használhatsz változókat, például {{nev}}, {{email}}, {{popup_szoveg}}.</div>
    <div class="field"><label>Sablon neve</label><input id="mtName" value="${escapeAttr(t.name || '')}"></div>
    <div class="field"><label>Tárgy</label><input id="mtSubject" value="${escapeAttr(t.subject || '')}"></div>
    <div class="field"><label>Törzs</label><textarea id="mtBody" class="large-textarea">${escapeHtml(t.body || '')}</textarea></div>
    <div class="modal-actions"><button id="modalCancel">Mégse</button><button id="mtUse" class="ghost">Mentés és beillesztés</button><button id="mtSave" class="primary">Mentés</button></div>
  `, 'wide');
  $('#modalCancel').onclick = closeModal;
  async function saveTemplate() {
    t.name = $('#mtName').value.trim() || 'Névtelen sablon';
    t.subject = $('#mtSubject').value;
    t.body = $('#mtBody').value;
    await BF.saveTemplates(templates);
  }
  $('#mtSave').onclick = async () => { await saveTemplate(); closeModal(); renderTemplates(); $('#log').textContent = 'Sablon mentve.'; };
  $('#mtUse').onclick = async () => {
    await saveTemplate();
    const b=findBlock(selectedBlockId)?.block;
    if(!b || b.type!=='email') { closeModal(); renderTemplates(); return alert('Jelölj ki egy Email összeállítása blokkot.'); }
    b.subject=t.subject||''; b.body=t.body||''; markDirty(); closeModal(); renderAll(); $('#log').textContent = `Sablon mentve és beillesztve: ${t.name || 'sablon'}`;
  };
}

function openModal(html, size='') {
  let root = $('#bfModalRoot');
  if (!root) {
    root = document.createElement('div');
    root.id = 'bfModalRoot';
    document.body.appendChild(root);
  }
  root.innerHTML = `<div class="bf-modal-backdrop"><div class="bf-modal ${size === 'wide' ? 'wide' : ''}">${html}</div></div>`;
  root.querySelector('.bf-modal-backdrop').addEventListener('click', e => { if (e.target.classList.contains('bf-modal-backdrop')) closeModal(); });
}
function closeModal(){ const root=$('#bfModalRoot'); if(root) root.innerHTML=''; }


async function renderVersions() {
  const panel = $('#versionPanel'); if (!panel || !activeWorkflow?.id) return;
  const versions = await BF.getVersions(activeWorkflow.id);
  panel.innerHTML = versions.length ? versions.slice(0,8).map((v,i)=>`<div class="version-item">${escapeHtml(new Date(v.at).toLocaleString())}<br><button class="small" data-restore-version="${i}">visszaállítás</button></div>`).join('') : 'Még nincs előző mentett verzió.';
  panel.querySelectorAll('[data-restore-version]').forEach(btn => btn.onclick = async () => { const v=versions[Number(btn.dataset.restoreVersion)]; if(!v || !confirm('Visszaállítod ezt a verziót?')) return; const restored=v.workflow; restored.id=activeWorkflow.id; activeWorkflow=restored; normalizeWorkflow(activeWorkflow); selectedBlockId=firstBlock(activeWorkflow.blocks)?.id; await BF.saveWorkflow(activeWorkflow); const store=await BF.getStore(); workflows=store.workflows; renderAll(); });
}


function buildWatchersForExport(workflow) {
  const blockWatchers = [];
  BF.walkBlocks(workflow.blocks || [], b => {
    if (b.type === 'clickTrigger') {
      if (b.triggerEnabled === false || !b.target) return;
      blockWatchers.push({
        id: `click:${workflow.id}:${b.id}`,
        source: 'block', sourceBlockId: b.id, workflowId: workflow.id, enabled: true,
        mode: 'click', target: b.target || null,
        scope: b.scope || 'any', domain: b.domain || '', path: b.path || '/', url: b.url || '', urlContains: b.urlContains || '',
        intervalSec: 2, throttleSec: Math.max(1, Number(b.throttleSec || 15)),
        runOnce: Boolean(b.runOnce), createdAt: b.createdAt || new Date().toISOString()
      });
      return;
    }
    if (b.type !== 'triggerGroup' || b.triggerEnabled === false) return;
    const cloneCondition = c => ({
      type: c.type,
      text: c.text || '',
      caseSensitive: Boolean(c.caseSensitive),
      target: c.target || null,
      requireVisible: c.requireVisible !== false,
      operator: c.operator || 'contains',
      value: c.value || '',
      readMode: c.readMode || 'auto',
      attributeName: c.attributeName || 'title',
      searchScope: c.searchScope || 'dom',
      changeMode: c.changeMode || 'fromTo',
      fromValue: c.fromValue || '',
      toValue: c.toValue || '',
      firstRun: c.firstRun || 'learn',
      logic: c.logic || 'all',
      children: (c.children || []).filter(x => String(x.type || '').startsWith('condition')).map(cloneCondition),
      id: c.id
    });
    const conditions = (b.children || []).filter(c => String(c.type || '').startsWith('condition')).map(cloneCondition);
    if (!conditions.length) return;
    blockWatchers.push({
      id: `block:${workflow.id}:${b.id}`,
      source: 'block', sourceBlockId: b.id, workflowId: workflow.id, enabled: true,
      mode: 'group', logic: b.logic || 'all', conditions,
      scope: b.scope || 'any', domain: b.domain || '', path: b.path || '/', url: b.url || '', urlContains: b.urlContains || '',
      intervalSec: Math.max(1, Number(b.intervalSec || 2)), throttleSec: Math.max(1, Number(b.throttleSec || 15)),
      runOnce: Boolean(b.runOnce), createdAt: b.createdAt || new Date().toISOString()
    });
  });
  return blockWatchers;
}

function buildSchedulesForExport(workflow) {
  const schedules = [];
  BF.walkBlocks(workflow.blocks || [], b => {
    if (b.type !== 'scheduledTrigger' || b.triggerEnabled === false) return;
    schedules.push({ id: `sched:${workflow.id}:${b.id}`, workflowId: workflow.id, sourceBlockId: b.id, enabled: true, scheduleMode: b.scheduleMode || 'interval', intervalMinutes: Math.max(1, Number(b.intervalMinutes || 15)), timeOfDay: b.timeOfDay || '08:00', days: b.days || 'mon,tue,wed,thu,fri' });
  });
  return schedules;
}

function resolveWorkflowReference(ref, allWorkflows) {
  const key = String(ref || '').trim();
  if (!key) return null;
  return (allWorkflows || []).find(w => w.id === key || w.name === key) || null;
}

function collectWorkflowDependencyGraph(rootWorkflow, allWorkflows) {
  const collected = [];
  const missing = [];
  const cycles = [];
  const visited = new Set();
  const stack = [];

  function addWorkflow(workflow) {
    if (!workflow?.id) return;
    if (stack.includes(workflow.id)) {
      cycles.push([...stack, workflow.id]);
      return;
    }
    if (visited.has(workflow.id)) return;
    visited.add(workflow.id);
    stack.push(workflow.id);
    collected.push(JSON.parse(JSON.stringify(workflow)));
    BF.walkBlocks(workflow.blocks || [], b => {
      if (b.type !== 'callWorkflow') return;
      const target = resolveWorkflowReference(b.workflowId, allWorkflows);
      if (!target) {
        missing.push({ fromId: workflow.id, fromName: workflow.name || workflow.id, ref: b.workflowId || '' });
        return;
      }
      addWorkflow(target);
    });
    stack.pop();
  }

  addWorkflow(rootWorkflow);
  return { workflows: collected, missing, cycles };
}

function makeStandaloneBackground(mainWorkflow, allExportedWorkflows, watchers, schedules, baseBackground) {
  const mainWorkflowJson = JSON.stringify(mainWorkflow);
  const workflowsJson = JSON.stringify(allExportedWorkflows);
  const watchersJson = JSON.stringify(watchers);
  const schedulesJson = JSON.stringify(schedules);
  return `// Generated by BlockFlow Mini extension export.
const GENERATED_MAIN_WORKFLOW = ${mainWorkflowJson};
const GENERATED_WORKFLOWS = ${workflowsJson};
const GENERATED_WATCHERS = ${watchersJson};
const GENERATED_SCHEDULES = ${schedulesJson};

${baseBackground}

async function bfInstallGeneratedAutomation(){
  try {
    await chrome.storage.local.set({ workflows:GENERATED_WORKFLOWS, activeWorkflowId:GENERATED_MAIN_WORKFLOW.id, watchers:GENERATED_WATCHERS, schedules:GENERATED_SCHEDULES });
    if (typeof refreshSchedules === 'function') await refreshSchedules();
  } catch(e) { console.warn('BlockFlow generated install hiba', e); }
}
chrome.runtime.onInstalled.addListener(bfInstallGeneratedAutomation);
chrome.runtime.onStartup.addListener(bfInstallGeneratedAutomation);
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await bfInstallGeneratedAutomation();
    const target = await getUsableTargetTab(tab?.id);
    if (!target?.id) return;
    await ensureContentScript(target.id);
    const workflow = GENERATED_WORKFLOWS.find(w => w.id === GENERATED_MAIN_WORKFLOW.id) || GENERATED_MAIN_WORKFLOW;
    await chrome.tabs.sendMessage(target.id, { type:'BF_RUN_WORKFLOW', workflow, options:{ forceRun:false } });
  } catch(e) { console.error('Generated BlockFlow futtatási hiba', e); try { chrome.notifications?.create({type:'basic', iconUrl:'icons/icon128.png', title:GENERATED_MAIN_WORKFLOW.name || 'Automatizmus', message:String(e.message || e).slice(0,500)}); } catch(_) {} }
});
`;
}

function makeCrc32Table(){
  const table = new Uint32Array(256);
  for (let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1); table[n]=c>>>0; }
  return table;
}
const BF_ZIP_CRC_TABLE = makeCrc32Table();
function crc32Bytes(bytes){ let crc = 0xffffffff; for (const b of bytes) crc = (crc >>> 8) ^ BF_ZIP_CRC_TABLE[(crc ^ b) & 255]; return (crc ^ 0xffffffff) >>> 0; }
function dosTime(date=new Date()) { return ((date.getHours()<<11) | (date.getMinutes()<<5) | Math.floor(date.getSeconds()/2)) & 0xffff; }
function dosDate(date=new Date()) { return (((date.getFullYear()-1980)<<9) | ((date.getMonth()+1)<<5) | date.getDate()) & 0xffff; }
function pushU16(out,n){ out.push(n & 255, (n>>>8)&255); }
function pushU32(out,n){ out.push(n & 255, (n>>>8)&255, (n>>>16)&255, (n>>>24)&255); }
function bytesHeaderLocal(crc,size,nameLen,t,d){ const out=[0x50,0x4b,0x03,0x04]; pushU16(out,20); pushU16(out,0); pushU16(out,0); pushU16(out,t); pushU16(out,d); pushU32(out,crc); pushU32(out,size); pushU32(out,size); pushU16(out,nameLen); pushU16(out,0); return new Uint8Array(out); }
function bytesHeaderCentral(crc,size,nameLen,offset,t,d){ const out=[0x50,0x4b,0x01,0x02]; pushU16(out,20); pushU16(out,20); pushU16(out,0); pushU16(out,0); pushU16(out,t); pushU16(out,d); pushU32(out,crc); pushU32(out,size); pushU32(out,size); pushU16(out,nameLen); pushU16(out,0); pushU16(out,0); pushU16(out,0); pushU16(out,0); pushU32(out,0); pushU32(out,offset); return new Uint8Array(out); }
function bytesEnd(count,centralSize,centralOffset){ const out=[0x50,0x4b,0x05,0x06]; pushU16(out,0); pushU16(out,0); pushU16(out,count); pushU16(out,count); pushU32(out,centralSize); pushU32(out,centralOffset); pushU16(out,0); return new Uint8Array(out); }
async function filesToZipBlob(files) {
  const encoder = new TextEncoder();
  const chunks = []; const central = []; let offset = 0;
  const now = new Date(); const t = dosTime(now); const d = dosDate(now);
  for (const f of files) {
    const nameBytes = encoder.encode(f.name);
    const contentBytes = typeof f.content === 'string' ? encoder.encode(f.content) : new Uint8Array(f.content || []);
    const crc = crc32Bytes(contentBytes);
    const local = bytesHeaderLocal(crc, contentBytes.length, nameBytes.length, t, d);
    chunks.push(local, nameBytes, contentBytes);
    const centralHeader = bytesHeaderCentral(crc, contentBytes.length, nameBytes.length, offset, t, d);
    central.push(centralHeader, nameBytes);
    offset += local.length + nameBytes.length + contentBytes.length;
  }
  const centralSize = central.reduce((a,c)=>a+c.length,0);
  const centralOffset = offset;
  return new Blob([...chunks, ...central, bytesEnd(files.length, centralSize, centralOffset)], { type:'application/zip' });
}

async function exportMiniExtension() {
  await saveCurrent();
  const wf = JSON.parse(JSON.stringify(activeWorkflow));
  const name = prompt('Mini extension neve', wf.name || 'BlockFlow automatizmus');
  if (name === null) return;
  const version = prompt('Verzió', '1.0.0');
  if (version === null) return;
  const desc = prompt('Leírás', 'BlockFlow-ból generált önálló automatizmus.') || 'BlockFlow-ból generált önálló automatizmus.';
  const dependencyGraph = collectWorkflowDependencyGraph(wf, workflows);
  if (dependencyGraph.missing.length) {
    const details = dependencyGraph.missing.map(m => `${m.fromName}: ${m.ref || '(üres hivatkozás)'}`).join('\n');
    alert('A mini extension export nem folytatható, mert hiányzó meghívott automatizmus van:\n' + details);
    return;
  }
  const exportedWorkflows = dependencyGraph.workflows.length ? dependencyGraph.workflows : [wf];
  const watchers = buildWatchersForExport(wf);
  const schedules = buildSchedulesForExport(wf);
  const [bg, cs, css, fbHtml, fbCss, fbJs, clipHtml, clipCss, clipJs, icon16, icon48, icon128] = await Promise.all([
    fetch(chrome.runtime.getURL('background.js')).then(r=>r.text()),
    fetch(chrome.runtime.getURL('contentScript.js')).then(r=>r.text()),
    fetch(chrome.runtime.getURL('contentScript.css')).then(r=>r.text()),
    fetch(chrome.runtime.getURL('feedback.html')).then(r=>r.text()),
    fetch(chrome.runtime.getURL('feedback.css')).then(r=>r.text()),
    fetch(chrome.runtime.getURL('feedback.js')).then(r=>r.text()),
    fetch(chrome.runtime.getURL('clipboard.html')).then(r=>r.text()),
    fetch(chrome.runtime.getURL('clipboard.css')).then(r=>r.text()),
    fetch(chrome.runtime.getURL('clipboard.js')).then(r=>r.text()),
    fetch(chrome.runtime.getURL('icons/icon16.png')).then(r=>r.arrayBuffer()).catch(()=>new ArrayBuffer(0)),
    fetch(chrome.runtime.getURL('icons/icon48.png')).then(r=>r.arrayBuffer()).catch(()=>new ArrayBuffer(0)),
    fetch(chrome.runtime.getURL('icons/icon128.png')).then(r=>r.arrayBuffer()).catch(()=>new ArrayBuffer(0))
  ]);
  const manifest = {
    manifest_version: 3,
    name: name || wf.name || 'BlockFlow Mini Automation',
    description: desc,
    version: /^\d+\.\d+\.\d+$/.test(version || '') ? version : '1.0.0',
    minimum_chrome_version: '116',
    permissions: ['storage','activeTab','scripting','tabs','clipboardWrite','notifications','clipboardRead','alarms','downloads'],
    host_permissions: ['<all_urls>'],
    action: { default_title: name || wf.name || 'Automatizmus futtatása' },
    background: { service_worker: 'background.js' },
    content_scripts: [{ matches: ['<all_urls>'], js: ['contentScript.js'], css: ['contentScript.css'], run_at: 'document_idle' }],
    icons: { '16':'icons/icon16.png', '48':'icons/icon48.png', '128':'icons/icon128.png' }
  };
  const readme = `# ${name || wf.name}\n\nBlockFlow-ból generált, Builder nélküli mini Chrome extension.\n\nTelepítés: chrome://extensions → Developer mode → Load unpacked → válaszd ki a kicsomagolt mappát.\n\nMűködés: ikonra kattintva futtat, a figyelők/időzítők pedig automatikusan regisztrálódnak.\n`;
  const files = [
    { name:'manifest.json', content: JSON.stringify(manifest, null, 2) },
    { name:'background.js', content: makeStandaloneBackground(wf, exportedWorkflows, watchers, schedules, bg) },
    { name:'contentScript.js', content: cs },
    { name:'contentScript.css', content: css },
    { name:'README_MINI.md', content: readme },
    { name:'feedback.html', content: fbHtml },
    { name:'feedback.css', content: fbCss },
    { name:'feedback.js', content: fbJs },
    { name:'clipboard.html', content: clipHtml },
    { name:'clipboard.css', content: clipCss },
    { name:'clipboard.js', content: clipJs },
    { name:'icons/icon16.png', content: new Uint8Array(icon16) },
    { name:'icons/icon48.png', content: new Uint8Array(icon48) },
    { name:'icons/icon128.png', content: new Uint8Array(icon128) }
  ];
  const blob = await filesToZipBlob(files);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `${safeFile(name || wf.name || 'blockflow-mini')}.zip`; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  $('#log').textContent = `Mini extension ZIP elkészült: ${a.download}`;
}

$('#recordStart').onclick = startRecording;
$('#recordPause').onclick = toggleRecordingPause;
$('#recordStop').onclick = stopRecording;
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'BF_RECORD_EVENT') { recorderState.count = Number(msg.count || recorderState.count || 0); renderRecordControls(); }
});
$('#workflowName').oninput = () => { activeWorkflow.name = $('#workflowName').value; markDirty(); renderWorkflowList(); };
$('#saveWorkflow').onclick = async () => { await saveCurrent(); $('#log').textContent = 'Mentve.'; renderAll(); };
$('#newWorkflow').onclick = async () => { await saveCurrent(); const w = BF.DEFAULT_WORKFLOW(); workflows.push(w); activeWorkflow = w; selectedBlockId = null; await BF.saveWorkflow(w); isDirty = false; renderAll(); };
$('#duplicateWorkflow').onclick = async () => { const w = JSON.parse(JSON.stringify(activeWorkflow)); w.id = crypto.randomUUID(); w.name += ' másolat'; w.imported = false; w.verified = true; reidBlocks(w.blocks); workflows.push(w); activeWorkflow = w; selectedBlockId = firstBlock(w.blocks)?.id; await BF.saveWorkflow(w); renderAll(); };
$('#markVerified').onclick = async () => { activeWorkflow.verified = true; activeWorkflow.imported = false; await saveCurrent(); renderAll(); $('#log').textContent = 'Automatizmus ellenőrzöttként jelölve.'; };
$('#validateWorkflow').onclick = async () => {
  renderValidation();
  const v = BF.validateWorkflow(activeWorkflow);
  if (v.ok) {
    await verifyAndPersist('check');
    $('#log').textContent = 'Ellenőrzés lefuttatva. Nincs hiba, az automatizmus ellenőrzött.';
  } else {
    $('#log').textContent = 'Ellenőrzés lefuttatva. Hibák találhatók, az automatizmus nem ellenőrzött.';
  }
};
$('#runWorkflow').onclick = () => runCurrent(false, false);
$('#forceRunWorkflow').onclick = () => runCurrent(false, true);
$('#dryRunWorkflow').onclick = () => runCurrent(true, false);
$('#stopRun').onclick = async () => { const res = await BF.sendToTarget({ type: 'BF_STOP_RUN' }, targetTabId); $('#log').textContent = res.ok ? 'Stop kérés elküldve.' : (res.error || 'Stop hiba.'); };
$('#exportOne').onclick = () => BF.downloadJson(`${safeFile(activeWorkflow.name)}.json`, BF.exportPayload([activeWorkflow]));
$('#exportAll').onclick = () => BF.downloadJson(`blockflow-backup.json`, BF.exportPayload(workflows));
$('#exportMini').onclick = () => exportMiniExtension().catch(err => { console.error(err); alert(err.message || String(err)); });
$('#importBtn').onclick = () => $('#importFile').click();
$('#importFile').onchange = async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const payload = JSON.parse(await f.text());
    const analysis = BF.analyzeImport(payload);
    $('#importPreview').textContent = `Import előnézet:\nSéma: ${analysis.schemaVersion}\nWorkflow-k: ${analysis.rawCount}\n\n` + analysis.workflows.map(w => `- ${w.name}: ${w.blockCount} blokk, ${w.riskyCount} kockázatos/módosító blokk\n  Típusok: ${w.blocks.join(', ')}`).join('\n');
    if (!confirm(`${analysis.rawCount} workflow importálható. Importálod?`)) return;
    const imported = await BF.importPayload(payload);
    const store = await BF.getStore(); workflows = store.workflows; activeWorkflow = workflows.find(w => w.id === store.activeWorkflowId); normalizeWorkflow(activeWorkflow); selectedBlockId = firstBlock(activeWorkflow.blocks)?.id; renderAll(); $('#log').textContent = `${imported.length} workflow importálva. Első futtatás előtt Dry-run javasolt.`;
  } catch(err) { alert(err.message); } finally { e.target.value=''; }
};

function escapeHtml(s){return String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}
function escapeAttr(s){return escapeHtml(s).replace(/'/g,'&#39;');}
function safeFile(s){return String(s||'automation').toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-|-$/g,'') || 'automation';}
function safeHost(url){ try { return new URL(url).hostname; } catch { return url || 'ismeretlen'; } }

init();
