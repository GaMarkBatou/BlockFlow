let workflows = [];
let activeWorkflow = null;
let selectedBlockId = null;
let targetTabId = Number(new URLSearchParams(location.search).get('targetTabId')) || null;
let lastInspectorBlockId = null;
let currentTargetUrl = '';
let currentTargetHost = '';
let currentTargetPath = '/';
let isDirty = false;

const $ = sel => document.querySelector(sel);
const CONTAINERS = new Set(['ifBlock', 'repeatBlock', 'rowLoop', 'triggerGroup', 'tryBlock', 'retryBlock', 'elementLoop', 'iframeBlock', 'groupBlock']);

async function init() {
  const store = await BF.getStore();
  workflows = store.workflows;
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
      if (CONTAINERS.has(b.type) && !Array.isArray(b.children)) b.children = [];
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

function renderWorkflowList() {
  $('#workflowList').innerHTML = workflows.map(w => `<div class="list-item ${w.id===activeWorkflow.id?'selected':''}">
    <div class="list-title">${escapeHtml(w.name)}</div>
    <div class="muted">${BF.countBlocks ? BF.countBlocks(w.blocks) : (w.blocks||[]).length} blokk ${w.imported?' · importált':''} ${w.verified===false?' · nem ellenőrzött':''}</div>
    <div class="split" style="margin-top:8px"><button class="small" data-open="${w.id}">Megnyitás</button><button class="small danger" data-delwf="${w.id}">Törlés</button></div>
  </div>`).join('');
  document.querySelectorAll('[data-open]').forEach(b => b.onclick = async () => {
    await saveCurrent();
    activeWorkflow = workflows.find(w => w.id === b.dataset.open);
    normalizeWorkflow(activeWorkflow);
    selectedBlockId = firstBlock(activeWorkflow.blocks)?.id;
    await BF.setActiveWorkflow(activeWorkflow.id);
    renderAll();
  });
  document.querySelectorAll('[data-delwf]').forEach(b => b.onclick = async () => {
    if (workflows.length < 2) return alert('Legalább egy automatizmusnak maradnia kell.');
    if (!confirm('Törlöd ezt az automatizmust?')) return;
    workflows = workflows.filter(w => w.id !== b.dataset.delwf);
    activeWorkflow = workflows[0];
    normalizeWorkflow(activeWorkflow);
    selectedBlockId = firstBlock(activeWorkflow.blocks)?.id;
    await chrome.storage.local.set({ workflows, activeWorkflowId: activeWorkflow.id });
    renderAll();
  });
}

function renderPalette() {
  const selected = findBlock(selectedBlockId)?.block;
  const grouped = {};
  BF.PALETTE.forEach(p => (grouped[p.cat] ||= []).push(p));
  const needsStarter = !hasAnyStarter();
  const hint = needsStarter
    ? `<div class="status warning-soft"><b>Válassz indítást.</b><br>Új automatizmusnál először kötelező egy indító blokk: Indítás vagy Figyelő trigger. Addig más blokk nem adható hozzá.</div>`
    : (selected && CONTAINERS.has(selected.type)
      ? `<div class="status">Kiválasztott konténer: <b>${escapeHtml(BF.BLOCKS[selected.type].name)}</b>. Az új blokkok ide, behúzva kerülnek.</div>`
      : `<div class="status muted">Konténer kijelölésekor az új blokkok automatikusan alá kerülnek behúzva.</div>`);
  $('#palette').innerHTML = hint + Object.entries(grouped).map(([cat, items]) => `<div class="section-title">${cat}</div>` + items.map(item => {
    const disabled = (needsStarter && !['trigger','triggerGroup','scheduledTrigger'].includes(item.type)) || (item.type.startsWith('condition') && selected?.type !== 'triggerGroup');
    return `<button class="palette-btn ${disabled?'disabled':''}" data-add="${item.type}" draggable="${disabled ? 'false' : 'true'}" ${disabled?'disabled title="Először válassz indító blokkot, figyelő feltételnél pedig jelölj ki egy Figyelő triggert."':'title="Kattints a hozzáadáshoz, vagy húzd be a megfelelő helyre."'}><span>${BF.BLOCKS[item.type].name}</span><span>+</span></button>`;
  }).join('')).join('');
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
  const isStarter = ['trigger','triggerGroup','scheduledTrigger'].includes(type);
  if (!hasAnyStarter() && !isStarter) return alert('Először válassz indító blokkot: Indítás, Figyelő trigger vagy Időzített indítás.');
  if (type === 'trigger' && containsType(activeWorkflow.blocks, 'trigger')) return alert('Egy manuális indító blokk már van a workflow-ban.');
  const selected = findBlock(selectedBlockId)?.block;
  const block = BF.newBlock(type);

  if (type.startsWith('condition')) {
    const targetTrigger = selected?.type === 'triggerGroup' ? selected : findSingleTriggerGroup();
    if (!targetTrigger) return alert('Figyelő feltételt csak Figyelő trigger alá lehet tenni. Jelöld ki a Figyelő triggert, vagy húzd a feltételt a trigger behúzott területére.');
    targetTrigger.children ||= [];
    targetTrigger.children.push(block);
  } else if (!isStarter && selected && CONTAINERS.has(selected.type) && selected.type !== 'triggerGroup') {
    selected.children ||= [];
    selected.children.push(block);
  } else {
    activeWorkflow.blocks.push(block);
  }
  selectedBlockId = block.id;
  markDirty();
  renderAll();
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
  if (target.type === 'triggerGroup' && !isCondition) {
    if (!silent) alert('A Figyelő trigger alá csak figyelő feltétel blokkok húzhatók.');
    return false;
  }
  if (target.type !== 'triggerGroup' && isCondition) {
    if (!silent) alert('Figyelő feltétel csak Figyelő trigger alá kerülhet.');
    return false;
  }
  return true;
}

function createBlockInContainer(type, containerId) {
  const block = BF.newBlock(type);
  if (!canPlaceBlockInContainer(block, containerId)) return;
  const list = listForContainer(containerId);
  if (!list) return;
  list.push(block);
  selectedBlockId = block.id;
  markDirty();
  renderAll();
}

function containsType(blocks, type) {
  let found = false;
  walk(blocks, b => { if (b.type === type) found = true; });
  return found;
}

function isStarterBlock(b) {
  return b && (b.type === 'trigger' || (b.type === 'triggerGroup' && b.triggerEnabled !== false) || (b.type === 'scheduledTrigger' && b.triggerEnabled !== false));
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

function renderBlockList(blocks, level, parentId) {
  if (!blocks || !blocks.length) return level ? '<div class="empty nested-empty">Húzz ide blokkokat, vagy jelöld ki a konténert és adj hozzá blokkot a bal oldalon.</div>' : '<div class="empty starter-empty"><b>Válassz indítást a bal oldalon.</b><br>Indítás vagy Figyelő trigger szükséges az automatizmushoz.</div>';
  return blocks.map((b, idx) => {
    let childHtml = '';
    if (CONTAINERS.has(b.type)) {
      childHtml = `<div class="container-body" data-drop-container="${b.id}">
        <div class="container-label">${b.type === 'triggerGroup' ? 'FIGYELŐ FELTÉTELEK - ezek döntik el, indul-e az automatizmus' : (b.type === 'ifBlock' ? 'HA IGAZ - behúzott blokkok' : (b.type === 'tryBlock' ? 'PRÓBÁLD MEG - behúzott blokkok' : 'A blokk hatása alá tartozó behúzott blokkok'))}</div>
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
      <div class="block block-${b.type} ${b.id===selectedBlockId?'selected':''}" draggable="true" data-block="${b.id}" data-parent="${parentId || 'root'}">
        <div class="block-actions">
          <button class="small" title="Legfelülre" data-top="${b.id}">⇈</button>
          <button class="small" title="Fel" data-up="${b.id}">↑</button>
          <button class="small" title="Le" data-down="${b.id}">↓</button>
          <button class="small" title="Legalulra" data-bottom="${b.id}">⇊</button>
          ${parentId ? `<button class="small" title="Kihúzás fő szintre" data-outdent="${b.id}">⇤</button>` : ''}
          ${canDeleteBlock(b)?`<button class="small danger" title="Törlés" data-del="${b.id}">×</button>`:''}
        </div>
        <div class="shortcut-line"><span class="block-icon">${blockIcon(b)}</span><span class="block-title">${escapeHtml(BF.blockTitle(b))}</span></div>
        <div class="block-inline">${blockInline(b)}</div>
        <div class="block-desc">${escapeHtml(BF.blockDesc(b))}</div>
      </div>
      ${childHtml}
    </div>`;
  }).join('');
}

function blockIcon(b) {
  const map = { trigger:'▶', triggerGroup:'◎', scheduledTrigger:'⏲', conditionText:'T', conditionElement:'◇', conditionField:'▣', conditionUrl:'URL', conditionChange:'Δ', click:'⌁', fill:'✎', extract:'⇣', wait:'⏱', waitUntil:'⏳', ifBlock:'?', repeatBlock:'↻', retryBlock:'⟳', tryBlock:'⚑', popupWait:'▣', popupExtract:'▣', popupClick:'▣', popupWindowWait:'◱', popupWindowExtract:'⇣', popupWindowClose:'×', copy:'⧉', clipboardRead:'⧉', email:'✉', emailTemplate:'✉', emailPreview:'✉', openEmail:'↗', rowLoop:'≡', elementLoop:'⋮', tableExtract:'▦', mask:'◩', transform:'A', textSlice:'✂', regex:'.*', setVar:'=', userPrompt:'💬', userInput:'⌨', userChoice:'☑', systemNotify:'🔔', scroll:'↕', keyPress:'⌨', openUrl:'↗', pageInfo:'ⓘ', screenshot:'▣', preflight:'✓', localSet:'⬇', localGet:'⬆', compare:'=', math:'#', iframeBlock:'▤', findElements:'◇', validateData:'✓', comment:'//', groupBlock:'▣', callWorkflow:'↪', returnResult:'↩', stopRun:'■', sound:'♪' };
  return map[b.type] || '•';
}
function inlineChip(label, value) { return `<span class="inline-chip"><span>${escapeHtml(label)}</span><b>${escapeHtml(value || '—')}</b></span>`; }
function inlineInput(field, value, placeholder='', cls='') { return `<input class="inline-input ${cls}" data-inline-field="${field}" value="${escapeAttr(value ?? '')}" placeholder="${escapeAttr(placeholder)}">`; }
function inlineNumber(field, value, placeholder='', cls='tiny') { return `<input class="inline-input ${cls}" type="number" data-inline-field="${field}" value="${escapeAttr(value ?? '')}" placeholder="${escapeAttr(placeholder)}">`; }
function inlineCheck(field, checked, label) { return `<label class="inline-check"><input type="checkbox" data-inline-check="${field}" ${checked ? 'checked' : ''}> ${escapeHtml(label)}</label>`; }
function inlineSelect(field, value, options, cls='') { return `<select class="inline-select ${cls}" data-inline-field="${field}">${options.map(([v,l])=>`<option value="${escapeAttr(v)}" ${v===value?'selected':''}>${escapeHtml(l)}</option>`).join('')}</select>`; }
function inlinePick(b, label='Cél elem') { return `<button class="inline-pick ${b.target ? 'has-target' : ''}" data-inline-pick="target" title="Elem kiválasztása az oldalról"><span>${escapeHtml(label)}</span><b>${escapeHtml(targetLabel(b))}</b></button>`; }
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
  if (b.type === 'conditionText') return `${inlineInput('text', b.text || '', 'figyelt szöveg/karakter', 'wide')} ${inlineCheck('caseSensitive', Boolean(b.caseSensitive), 'kis/nagybetű')}`;
  if (b.type === 'conditionElement') return `${inlinePick(b)} ${inlineCheck('requireVisible', b.requireVisible !== false, 'látható')}`;
  if (b.type === 'conditionField') return `${inlinePick(b, 'Mező')} ${inlineSelect('operator', b.operator || 'contains', [['contains','tartalmazza'],['notContains','nem tartalmazza'],['equals','pontosan'],['notEquals','nem pontosan'],['empty','üres'],['notEmpty','nem üres'],['startsWith','ezzel kezdődik'],['endsWith','ezzel végződik']])} ${['empty','notEmpty'].includes(b.operator || 'contains') ? '' : inlineInput('value', b.value || '', 'érték')}`;
  if (b.type === 'conditionUrl') return `${inlineSelect('operator', b.operator || 'contains', [['contains','tartalmazza'],['notContains','nem tartalmazza'],['equals','pontosan'],['notEquals','nem pontosan'],['startsWith','ezzel kezdődik'],['endsWith','ezzel végződik']])} ${inlineInput('value', b.value || '', 'URL érték', 'wide')}`;
  if (b.type === 'conditionChange') return `${inlinePick(b, 'Forrás')} ${inlineSelect('changeMode', b.changeMode || 'fromTo', [['fromTo','miről → mire'],['anyTo','bármiről → mire'],['fromAny','miről → bármire'],['anyChange','bármilyen változás']])} ${['fromTo','fromAny'].includes(b.changeMode || 'fromTo') ? inlineInput('fromValue', b.fromValue || '', 'miről') : ''} ${['fromTo','anyTo'].includes(b.changeMode || 'fromTo') ? inlineInput('toValue', b.toValue || '', 'mire') : ''} ${inlineSelect('operator', b.operator || 'equals', [['equals','pontosan'],['contains','tartalmazza'],['regex','regex']])} ${inlineCheck('caseSensitive', Boolean(b.caseSensitive), 'kis/nagybetű')}`;
  if (b.type === 'click') return `${inlinePick(b)} ${inlineCheck('confirmRisky', b.confirmRisky !== false, 'megerősítés')}`;
  if (b.type === 'fill') return `${inlinePick(b, 'Hova')} ${inlineInput('value', b.value || '', 'mit illesszen be', 'wide')}`;
  if (b.type === 'extract') return `${inlinePick(b, 'Honnan')} ${inlineSelect('extractMode', b.extractMode || 'auto', [['auto','automatikus'],['value','mezőérték'],['text','szöveg'],['html','HTML'],['attribute','attribútum']])} ${inlineSelect('searchScope', b.searchScope || 'dom', [['dom','teljes DOM'],['visible','látható']])} ${inlineInput('varName', b.varName || 'adat', 'változó neve')}`;
  if (b.type === 'wait') return `${inlineSelect('waitMode', b.waitMode || 'time', [['time','idő'],['text','szöveg'],['element','elem']])} ${b.waitMode === 'time' ? inlineNumber('ms', b.ms || 1000, 'ms') : b.waitMode === 'text' ? inlineInput('text', b.text || '', 'várt szöveg', 'wide') : inlinePick(b)} ${inlineNumber('timeoutMs', b.timeoutMs || 5000, 'timeout')}`;
  if (b.type === 'ifBlock') return `${inlineSelect('conditionMode', b.conditionMode || 'textExists', [['textExists','szöveg létezik'],['elementExists','elem létezik'],['valueContains','érték tartalmazza']])} ${b.conditionMode === 'textExists' ? inlineInput('text', b.text || '', 'keresett szöveg', 'wide') : inlinePick(b)} ${b.conditionMode === 'valueContains' ? inlineInput('value', b.value || '', 'keresett érték') : ''}`;
  if (b.type === 'repeatBlock') return `${inlineNumber('repeatCount', b.repeatCount || 2, 'alkalom')} ${inlineChip('ismétli', `${(b.children || []).length} blokk`)}`;
  if (b.type === 'copy') return inlineInput('value', b.value || '', 'másolandó szöveg/változó', 'wide');
  if (b.type === 'userPrompt') return `${inlineSelect('mode', b.mode || 'wait', [['wait','vár visszajelzésre'],['notify','csak felugró üzenet']])} ${inlineInput('title', b.title || 'BlockFlow', 'cím')} ${inlineInput('message', b.message || '', 'üzenet', 'wide')}`;
  if (b.type === 'systemNotify') return `${inlineInput('title', b.title || 'BlockFlow', 'cím')} ${inlineInput('message', b.message || '', 'értesítés szövege', 'wide')}`;
  if (b.type === 'email') return `${inlineInput('to', b.to || '', 'címzett')} ${inlineInput('subject', b.subject || '', 'tárgy')} ${inlineInput('resultName', b.resultName || 'email_draft', 'draft változó')}`;
  if (b.type === 'openEmail') return `${inlineInput('draftName', b.draftName || 'email_draft', 'draft változó')} ${inlineNumber('maxUrlLength', b.maxUrlLength || 1800, 'mailto max')}`;
  if (b.type === 'mask') return `${inlineInput('source', b.source || '{{adat}}', 'forrás', 'wide')} ${inlineSelect('maskMode', b.maskMode || 'characters', [['characters','karakter'],['lines','sor']])} ${inlineCheck('invertMask', Boolean(b.invertMask), 'invert')} ${inlineInput('resultName', b.resultName || 'maszkolt_adat', 'eredmény')}`;
  if (b.type === 'popupWait') return `${inlineNumber('timeoutMs', b.timeoutMs || 10000, 'timeout')}`;
  if (b.type === 'popupClick') return `${inlineInput('buttonText', b.buttonText || 'OK', 'gomb szövege')} ${inlineNumber('timeoutMs', b.timeoutMs || 5000, 'timeout')}`;
  if (b.type === 'popupExtract') return `${inlineSelect('extractMode', b.extractMode || 'text', [['text','teljes szöveg'],['title','cím']])} ${inlineInput('varName', b.varName || 'popup_szoveg', 'változó neve')}`;
  if (b.type === 'rowLoop') return `${inlinePick(b, 'Lista/tábla')} ${inlineInput('rowVar', b.rowVar || 'sor_szoveg', 'sor változó')} ${inlineNumber('maxRows', b.maxRows || 20, 'max')}`;
  if (b.type === 'scheduledTrigger') return `${inlineCheck('triggerEnabled', b.triggerEnabled !== false, 'aktív')} ${inlineSelect('scheduleMode', b.scheduleMode || 'interval', [['interval','percenként'],['daily','napi időpont']])} ${b.scheduleMode === 'daily' ? inlineInput('timeOfDay', b.timeOfDay || '08:00', 'HH:MM') : inlineNumber('intervalMinutes', b.intervalMinutes || 15, 'perc')}`;
  if (b.type === 'transform') return `${inlineInput('source', b.source || '{{adat}}', 'forrás', 'wide')} ${inlineSelect('operation', b.operation || 'trim', [['trim','trim'],['upper','NAGY'],['lower','kis'],['singleLine','egy sor'],['removeEmptyLines','üres sor törlés'],['digitsOnly','csak szám'],['lettersOnly','csak betű'],['noAccents','ékezet nélkül']])} ${inlineInput('resultName', b.resultName || 'atalakitott_adat', 'eredmény')}`;
  if (b.type === 'textSlice') return `${inlineInput('source', b.source || '{{adat}}', 'forrás', 'wide')} ${inlineSelect('mode', b.mode || 'between', [['between','között'],['line','sor'],['chars','karakterek']])} ${inlineInput('resultName', b.resultName || 'szovegresz', 'eredmény')}`;
  if (b.type === 'regex') return `${inlineInput('source', b.source || '{{adat}}', 'forrás')} ${inlineInput('pattern', b.pattern || '', 'regex minta', 'wide')} ${inlineInput('resultName', b.resultName || 'regex_talalat', 'eredmény')}`;
  if (b.type === 'setVar') return `${inlineInput('varName', b.varName || 'valtozo', 'változó')} ${inlineInput('value', b.value || '', 'érték', 'wide')}`;
  if (b.type === 'userInput') return `${inlineInput('message', b.message || '', 'kérdés', 'wide')} ${inlineInput('resultName', b.resultName || 'user_input', 'eredmény')}`;
  if (b.type === 'userChoice') return `${inlineInput('message', b.message || '', 'kérdés', 'wide')} ${inlineInput('options', b.options || '', 'opciók soronként')} ${inlineInput('resultName', b.resultName || 'valasztas', 'eredmény')}`;
  if (b.type === 'tableExtract') return `${inlinePick(b, 'Tábla/lista')} ${inlineSelect('rowMode', b.rowMode || 'first', [['first','első sor'],['last','utolsó sor'],['contains','sor tartalmazza']])} ${inlineNumber('columnIndex', b.columnIndex || 1, 'oszlop')} ${inlineInput('resultName', b.resultName || 'tabla_adat', 'eredmény')}`;
  if (b.type === 'elementLoop') return `${inlinePick(b, 'Konténer')} ${inlineInput('selector', b.selector || '', 'selector opcionális')} ${inlineInput('itemVar', b.itemVar || 'elem_szoveg', 'elem változó')} ${inlineNumber('maxItems', b.maxItems || 20, 'max')}`;
  if (b.type === 'waitUntil') return `${inlineSelect('conditionMode', b.conditionMode || 'textExists', [['textExists','szöveg'],['elementExists','elem'],['valueContains','mezőérték'],['urlContains','URL']])} ${b.conditionMode === 'elementExists' || b.conditionMode === 'valueContains' ? inlinePick(b) : inlineInput('text', b.text || b.value || '', 'várt érték', 'wide')} ${inlineNumber('timeoutMs', b.timeoutMs || 10000, 'timeout')}`;
  if (b.type === 'scroll') return `${inlineSelect('mode', b.mode || 'element', [['element','elemhez'],['page','oldal']])} ${b.mode === 'page' ? inlineSelect('direction', b.direction || 'down', [['down','le'],['up','fel'],['top','tetejére'],['bottom','aljára']]) + inlineNumber('amount', b.amount || 500, 'px') : inlinePick(b)}`;
  if (b.type === 'keyPress') return `${inlinePick(b, 'Cél opcionális')} ${inlineInput('key', b.key || 'Enter', 'billentyű')} ${inlineCheck('ctrl', Boolean(b.ctrl), 'Ctrl')} ${inlineCheck('shift', Boolean(b.shift), 'Shift')}`;
  if (b.type === 'clipboardRead') return inlineInput('resultName', b.resultName || 'clipboard', 'eredmény');
  if (b.type === 'openUrl') return `${inlineInput('url', b.url || '', 'URL', 'wide')} ${inlineSelect('mode', b.mode || 'newTab', [['sameTab','aktuális tab'],['newTab','új tab'],['newWindow','új ablak']])}`;
  if (b.type === 'pageInfo') return inlineInput('prefix', b.prefix || 'page', 'változó prefix');
  if (b.type === 'screenshot') return `${inlineInput('resultName', b.resultName || 'screenshot_data_url', 'eredmény')} ${inlineSelect('action', b.action || (b.openPreview ? 'preview' : 'preview'), [['preview','előnézet'],['download','letöltés'],['clipboard','vágólap'],['variable','csak változó']])} ${inlineInput('fileName', b.fileName || 'blockflow-screenshot', 'fájlnév')}`;
  if (b.type === 'tryBlock') return `${inlineChip('próba', `${(b.children || []).length} blokk`)} ${inlineChip('hiba ág', `${(b.elseChildren || []).length} blokk`)}`;
  if (b.type === 'preflight') return `${inlinePick(b, 'Ellenőrzött elem')} ${inlineSelect('onFail', b.onFail || 'stop', [['stop','álljon le'],['warn','csak napló'],['notify','értesítsen']])}`;
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
  if (b.type === 'groupBlock') return `${inlineInput('title', b.title || 'Csoport', 'cím')} ${inlineChip('blokkok', `${(b.children || []).length}`)}`;
  if (b.type === 'callWorkflow') return `${inlineInput('workflowId', b.workflowId || '', 'workflow ID vagy név')} ${inlineInput('resultPrefix', b.resultPrefix || 'called', 'eredmény prefix')}`;
  if (b.type === 'returnResult') return `${inlineInput('value', b.value || '{{adat}}', 'érték')} ${inlineInput('resultName', b.resultName || 'result', 'név')}`;
  if (b.type === 'stopRun') return inlineInput('message', b.message || 'Futás leállítva.', 'üzenet', 'wide');
  if (b.type === 'sound') return inlineSelect('tone', b.tone || 'success', [['success','siker'],['error','hiba'],['notify','jelzés']]);
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
      block[field] = ['timeoutMs','ms','maxUrlLength','repeatCount','maxRows','keepStart','keepEnd','keepFirstLines','keepLastLines','throttleSec','intervalSec','intervalMinutes','charStart','charEnd','lineNumber','group','columnIndex','maxItems','attempts','delayMs','amount'].includes(field) ? Number(input.value) : input.value;
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
    if (!found || found.type !== 'ifBlock') return null;
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
  if (activeWorkflow.imported) activeWorkflow.verified = false;
  renderSaveState();
}

function renderInspector() {
  const b = findBlock(selectedBlockId)?.block;
  const changedBlock = b && b.id !== lastInspectorBlockId;
  if (!b) { $('#inspector').innerHTML = '<div class="empty">Válassz blokkot.</div>'; return; }
  let html = `<div class="inspector-current"><div class="list-title">${escapeHtml(BF.BLOCKS[b.type]?.name || b.type)}</div><div class="muted">A fő beállítások a középső blokkon is szerkeszthetők, itt a részletes opciók vannak.</div></div>`;
  if (['click','fill','extract','conditionElement','conditionField','conditionChange','tableExtract','scroll','keyPress','preflight','popupWindowExtract','iframeBlock','findElements','waitUntil'].includes(b.type)) html += targetEditor(b);
  if (b.type === 'click') html += checkboxField('confirmRisky','Kockázatos kattintásnál kérjen megerősítést', b.confirmRisky !== false) + numberField('timeoutMs','Max várakozás ms', b.timeoutMs || 5000);
  if (b.type === 'fill') html += valueSourceHelp() + textArea('value','Mit illesszen be?', b.value || '') + numberField('timeoutMs','Max várakozás ms', b.timeoutMs || 5000);
  if (b.type === 'extract') html += selectField('extractMode','Mit nyerjen ki?', b.extractMode || 'auto', [['auto','Automatikus - legjobb érték'],['value','Mezőérték'],['text','Szöveg'],['html','HTML tartalom'],['attribute','Attribútum']]) + selectField('searchScope','Hol keressen?', b.searchScope || 'dom', [['dom','Teljes DOM-ban, rejtett mezőkben is'],['visible','Csak látható elemek között']]) + checkboxField('allowHidden','Rejtett / inaktív fülön lévő mezőt is elfogad', b.allowHidden !== false) + textField('attributeName','Attribútum neve attribute módnál', b.attributeName || 'title') + textField('varName','Változó neve', b.varName || 'adat') + numberField('timeoutMs','Max várakozás ms', b.timeoutMs || 5000);
  if (b.type === 'triggerGroup') html += watcherAdvanced(b) + selectField('logic','Indítás, ha', b.logic || 'all', [['all','Minden feltétel igaz'],['any','Bármelyik feltétel igaz'],['none','Egyik feltétel sem igaz']]) + numberField('intervalSec','Ellenőrzés gyakorisága mp-ben', b.intervalSec || 2) + `<div class="status">Feltételek száma: ${(b.children || []).length}. Húzz alá feltételblokkokat a Figyelő feltételek kategóriából.</div>`;
  if (b.type === 'conditionText') html += textField('text','Figyelt szöveg vagy karakter', b.text || '') + checkboxField('caseSensitive','Kis/nagybetű számítson', Boolean(b.caseSensitive));
  if (b.type === 'conditionElement') html += checkboxField('requireVisible','Csak látható elem számítson', b.requireVisible !== false);
  if (b.type === 'conditionField') html += selectField('operator','Feltétel', b.operator || 'contains', [['contains','Tartalmazza'],['notContains','Nem tartalmazza'],['equals','Pontosan ez'],['notEquals','Nem pontosan ez'],['empty','Üres'],['notEmpty','Nem üres'],['startsWith','Ezzel kezdődik'],['endsWith','Ezzel végződik']]) + textField('value','Érték', b.value || '') + checkboxField('caseSensitive','Kis/nagybetű számítson', Boolean(b.caseSensitive));
  if (b.type === 'conditionUrl') html += selectField('operator','URL feltétel', b.operator || 'contains', [['contains','Tartalmazza'],['notContains','Nem tartalmazza'],['equals','Pontosan ez'],['notEquals','Nem pontosan ez'],['startsWith','Ezzel kezdődik'],['endsWith','Ezzel végződik']]) + textField('value','URL érték', b.value || '');
  if (b.type === 'conditionChange') html += selectField('readMode','Mit olvasson?', b.readMode || 'auto', [['auto','Automatikus érték'],['value','Mezőérték'],['text','Szöveg'],['attribute','Attribútum']]) + (b.readMode === 'attribute' ? textField('attributeName','Attribútum neve', b.attributeName || 'title') : '') + selectField('searchScope','Keresés módja', b.searchScope || 'dom', [['dom','Teljes DOM-ban, rejtett mezőkben is'],['visible','Csak látható elemek között']]) + selectField('changeMode','Változás típusa', b.changeMode || 'fromTo', [['fromTo','Miről → mire'],['anyTo','Bármiről → mire'],['fromAny','Miről → bármire'],['anyChange','Bármilyen változás']]) + textField('fromValue','Miről', b.fromValue || '') + textField('toValue','Mire', b.toValue || '') + selectField('operator','Összehasonlítás', b.operator || 'equals', [['equals','Pontos egyezés'],['contains','Tartalmazza'],['regex','Regex']]) + checkboxField('caseSensitive','Kis/nagybetű számítson', Boolean(b.caseSensitive)) + selectField('firstRun','Első ellenőrzéskor', b.firstRun || 'learn', [['learn','Csak jegyezze meg, ne indítson'],['allowTo','Indítson, ha már a célértéken van']]) + `<div class="status">Az előző érték a tabon belül, workflow + trigger + feltétel szerint tárolódik. Oldalfrissítés után újratanul.</div>`;
  if (b.type === 'wait') html += selectField('waitMode','Várakozás típusa', b.waitMode || 'time', [['time','Idő'],['text','Szöveg megjelenése'],['element','Elem megjelenése']]) + (b.waitMode === 'time' ? numberField('ms','Idő ms', b.ms || 1000) : b.waitMode === 'text' ? textField('text','Szöveg', b.text || '') + numberField('timeoutMs','Timeout ms', b.timeoutMs || 5000) : targetEditor(b) + numberField('timeoutMs','Timeout ms', b.timeoutMs || 5000));
  if (b.type === 'ifBlock') html += selectField('conditionMode','Feltétel', b.conditionMode || 'textExists', [['textExists','Szöveg létezik'],['elementExists','Elem létezik'],['valueContains','Elem értéke tartalmazza']]) + (b.conditionMode === 'elementExists' || b.conditionMode === 'valueContains' ? targetEditor(b) : '') + (b.conditionMode === 'valueContains' ? textField('value','Keresett érték', b.value || '') : b.conditionMode === 'textExists' ? textField('text','Keresett szöveg', b.text || '') : '') + numberField('timeoutMs','Elemkeresési timeout ms', b.timeoutMs || 1000) + `<div class="status">Igaz ág: ${(b.children||[]).length} blokk · Különben ág: ${(b.elseChildren||[]).length} blokk</div>`;
  if (b.type === 'repeatBlock') html += numberField('repeatCount','Ismétlések száma', b.repeatCount || 2) + `<div class="status">Az alá behúzott blokkok ismétlődnek. Gyermek blokkok: ${(b.children||[]).length}</div>`;
  if (b.type === 'rowLoop') html += targetEditor(b) + textField('rowVar','Sor szövegének változóneve', b.rowVar || 'sor_szoveg') + numberField('maxRows','Max sor', b.maxRows || 20) + `<div class="status">Egyszerű lista/táblázat feldolgozás: a kiválasztott elem sorait/listaelemeit járja be.</div>`;
  if (b.type === 'popupWait') html += numberField('timeoutMs','Popup timeout ms', b.timeoutMs || 10000) + `<button id="testPopup" class="ghost">Popup tesztelése</button>`;
  if (b.type === 'popupExtract') html += selectField('extractMode','Mit nyerjen ki?', b.extractMode || 'text', [['text','Teljes popup szöveg'],['title','Popup cím']]) + textField('varName','Változó neve', b.varName || 'popup_szoveg');
  if (b.type === 'popupClick') html += textField('buttonText','Popup gomb szövege', b.buttonText || 'OK') + numberField('timeoutMs','Timeout ms', b.timeoutMs || 5000);
  if (b.type === 'copy') html += valueSourceHelp() + textArea('value','Mit másoljon?', b.value || '');
  if (b.type === 'userPrompt') html += selectField('mode','Működés', b.mode || 'wait', [['wait','Felugró ablak és várjon felhasználói visszajelzésre'],['notify','Csak felugró üzenet, automatikusan továbbmegy']]) + textField('title','Ablak címe', b.title || 'BlockFlow') + textArea('message','Üzenet szövege', b.message || '') + textField('buttonText','Folytatás gomb szövege', b.buttonText || 'Folytatás') + textField('cancelText','Megszakítás gomb szövege', b.cancelText || 'Megszakítás') + textField('resultName','Eredmény változó neve opcionális', b.resultName || '') + `<div class="status">Várakozó módban a futás megáll, amíg a felhasználó folytatja vagy megszakítja. Értesítő módban csak megjelenik egy rövid felugró üzenet.</div>`;
  if (b.type === 'systemNotify') html += textField('title','Értesítés címe', b.title || 'BlockFlow') + textArea('message','Értesítés szövege', b.message || '') + `<div class="status">Chrome rendszerértesítést küld. Ehhez az extension értesítési jogosultságot használ.</div>`;
  if (b.type === 'mask') html += valueSourceHelp() + textArea('source','Forrás szöveg vagy változó', b.source || '{{adat}}') + selectField('maskMode','Maszkolás módja', b.maskMode || 'characters', [['characters','Karakterek alapján'],['lines','Sorok alapján']]) + checkboxField('invertMask','Invert maszkolás: a megadott részeket maszkolja, a többit hagyja meg', Boolean(b.invertMask)) + textField('resultName','Eredmény változó neve', b.resultName || 'maszkolt_adat') + textField('maskChar','Maszk karakter üresen hagyható', b.maskChar ?? '*') + (b.maskMode === 'lines' ? numberField('keepFirstLines','Érintett/meghagyott első sorok', b.keepFirstLines ?? 1) + numberField('keepLastLines','Érintett/meghagyott utolsó sorok', b.keepLastLines ?? 1) + textField('maskLineText','Maszkolt sor szövege üresen hagyható', b.maskLineText ?? '***') : numberField('keepStart','Érintett/meghagyott első karakterek', b.keepStart ?? 2) + numberField('keepEnd','Érintett/meghagyott utolsó karakterek', b.keepEnd ?? 2)) + `<div class="status">Normál mód: a megadott első/utolsó rész látható marad. Invert módban pont ezek lesznek maszkolva. Üres maszk esetén a maszkolt rész nem kap helyettesítő karaktert.</div>`;
  if (b.type === 'email') html += textField('to','Címzett', b.to || '') + textField('subject','Tárgy', b.subject || '') + textArea('body','Törzs', b.body || '') + textField('resultName','Draft változó neve', b.resultName || 'email_draft');
  if (b.type === 'openEmail') html += textField('draftName','Email draft változó', b.draftName || 'email_draft') + numberField('maxUrlLength','Mailto max hossz', b.maxUrlLength || 1800) + `<div class="status">Az extension nem küld emailt. Csak mailto ablakot nyit; hosszú törzs esetén vágólapra másol.</div>`;
  if (b.type === 'scheduledTrigger') html += checkboxField('triggerEnabled','Időzítő aktív', b.triggerEnabled !== false) + selectField('scheduleMode','Időzítés módja', b.scheduleMode || 'interval', [['interval','Percenként'],['daily','Napi időpont']]) + numberField('intervalMinutes','Intervallum percben', b.intervalMinutes || 15) + textField('timeOfDay','Napi időpont HH:MM', b.timeOfDay || '08:00') + textField('days','Napok', b.days || 'mon,tue,wed,thu,fri');
  if (b.type === 'transform') html += textField('source','Forrás', b.source || '{{adat}}') + selectField('operation','Művelet', b.operation || 'trim', [['trim','Trim'],['upper','Nagybetű'],['lower','Kisbetű'],['singleLine','Egy sorba'],['removeEmptyLines','Üres sorok törlése'],['digitsOnly','Csak számok'],['lettersOnly','Csak betűk'],['noAccents','Ékezetek eltávolítása']]) + textField('resultName','Eredmény változó', b.resultName || 'atalakitott_adat');
  if (b.type === 'textSlice') html += textField('source','Forrás', b.source || '{{adat}}') + selectField('mode','Mód', b.mode || 'between', [['between','Kezdő és záró szöveg között'],['line','Adott sor'],['chars','Karakter tartomány']]) + textField('startText','Kezdő szöveg', b.startText || '') + textField('endText','Záró szöveg', b.endText || '') + numberField('lineNumber','Sor száma', b.lineNumber || 1) + numberField('charStart','Karakter kezdete', b.charStart || 0) + numberField('charEnd','Karakter vége', b.charEnd || 100) + textField('resultName','Eredmény változó', b.resultName || 'szovegresz');
  if (b.type === 'regex') html += textField('source','Forrás', b.source || '{{adat}}') + textField('pattern','Regex minta', b.pattern || '') + textField('flags','Flagek', b.flags || 'i') + numberField('group','Capture group', b.group || 0) + checkboxField('allMatches','Összes találat', Boolean(b.allMatches)) + textField('resultName','Eredmény változó', b.resultName || 'regex_talalat');
  if (b.type === 'setVar') html += textField('varName','Változó neve', b.varName || 'valtozo') + textArea('value','Érték', b.value || '');
  if (b.type === 'userInput') html += textField('title','Cím', b.title || '') + textArea('message','Kérdés', b.message || '') + selectField('inputType','Mező típusa', b.inputType || 'text', [['text','Rövid szöveg'],['textarea','Hosszú szöveg']]) + textField('placeholder','Placeholder', b.placeholder || '') + textField('defaultValue','Alapérték', b.defaultValue || '') + textField('resultName','Eredmény változó', b.resultName || 'user_input');
  if (b.type === 'userChoice') html += textField('title','Cím', b.title || '') + textArea('message','Kérdés', b.message || '') + textArea('options','Opciók soronként', b.options || '') + textField('resultName','Eredmény változó', b.resultName || 'valasztas');
  if (b.type === 'tableExtract') html += selectField('rowMode','Sor kiválasztása', b.rowMode || 'first', [['first','Első'],['last','Utolsó'],['contains','Tartalmazza']]) + textField('rowContains','Sor tartalmazza', b.rowContains || '') + numberField('columnIndex','Oszlop száma', b.columnIndex || 1) + textField('resultName','Eredmény változó', b.resultName || 'tabla_adat');
  if (b.type === 'elementLoop') html += textField('selector','Selector opcionális', b.selector || '') + textField('itemVar','Elem szöveg változó', b.itemVar || 'elem_szoveg') + textField('indexVar','Index változó', b.indexVar || 'elem_index') + numberField('maxItems','Maximum elem', b.maxItems || 20);
  if (b.type === 'waitUntil') html += selectField('conditionMode','Feltétel', b.conditionMode || 'textExists', [['textExists','Szöveg megjelenik'],['elementExists','Elem megjelenik'],['valueContains','Mezőérték tartalmazza'],['urlContains','URL tartalmazza']]) + textField('text','Szöveg', b.text || '') + textField('value','Érték', b.value || '') + numberField('timeoutMs','Timeout ms', b.timeoutMs || 10000);
  if (b.type === 'openUrl') html += textField('url','URL', b.url || '') + selectField('mode','Megnyitás', b.mode || 'newTab', [['sameTab','Aktuális tab'],['newTab','Új tab'],['newWindow','Új ablak']]);
  if (b.type === 'screenshot') html += selectField('action','Képernyőkép kezelése', b.action || (b.openPreview ? 'preview' : 'preview'), [['preview','Előnézet új tabon'],['download','Letöltés PNG-ként'],['clipboard','Vágólapra másolás'],['variable','Csak változóba mentés']]) + textField('fileName','Letöltési fájlnév előtag', b.fileName || 'blockflow-screenshot') + textField('resultName','Eredmény változó', b.resultName || 'screenshot_data_url') + `<div class="status">A Chrome csak az aktív, látható tabról tud képernyőképet készíteni. A BlockFlow röviden fókuszálja a cél tabot, elkészíti a képet, majd visszaállítja a fókuszt, ha nem előnézetet kérsz.</div>`;
  if (b.type === 'localSet') html += textField('key','Kulcs', b.key || '') + textArea('value','Érték', b.value || '');
  if (b.type === 'localGet') html += textField('key','Kulcs', b.key || '') + textField('defaultValue','Alapérték ha nincs', b.defaultValue || '') + textField('resultName','Eredmény változó', b.resultName || 'local_adat');
  if (b.type === 'compare') html += textField('left','Bal oldal', b.left || '') + selectField('operator','Operátor', b.operator || 'equals', [['equals','Egyenlő'],['notEquals','Nem egyenlő'],['contains','Tartalmazza'],['greater','Nagyobb'],['less','Kisebb']]) + textField('right','Jobb oldal', b.right || '') + textField('resultName','Eredmény változó', b.resultName || 'osszehasonlitas');
  if (b.type === 'math') html += textField('left','A', b.left || '0') + selectField('operator','Művelet', b.operator || 'add', [['add','Összeadás'],['subtract','Kivonás'],['multiply','Szorzás'],['divide','Osztás']]) + textField('right','B', b.right || '1') + textField('resultName','Eredmény változó', b.resultName || 'szamitas');
  if (b.type === 'validateData') html += textField('source','Forrás', b.source || '{{adat}}') + selectField('validation','Validáció', b.validation || 'notEmpty', [['notEmpty','Nem üres'],['email','Email formátum'],['contains','Tartalmazza'],['regex','Regex']]) + textField('pattern','Minta', b.pattern || '') + selectField('onFail','Hiba esetén', b.onFail || 'stop', [['stop','Leállítás'],['warn','Csak napló']]);

  if (CONTAINERS.has(b.type)) html += `<div class="hr"></div><div class="status">Tipp: ${b.type === 'triggerGroup' ? 'húzz ide Figyelő feltétel blokkokat. Ezek nem futási lépések, csak eldöntik, induljon-e az automatizmus.' : 'húzz blokkokat a blokk alatti behúzott területre, vagy hagyd kijelölve ezt a blokkot és adj hozzá új blokkot a bal oldali palettából.'}</div>`;
  html += `<div class="hr"></div><button id="testBlock" class="ghost">Blokk tesztelése</button>`;
  $('#inspector').innerHTML = html;
  $('#inspector').querySelectorAll('[data-field]').forEach(input => {
    const handler = () => updateField(input.dataset.field, input.type === 'checkbox' ? input.checked : input.value);
    input.oninput = handler; input.onchange = handler;
  });
  const pick = $('#pickElement'); if (pick) pick.onclick = () => startPick(b.id, 'target');
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
function selectField(field,label,value,options){ return `<div class="field"><label>${label}</label><select data-field="${field}">${options.map(([v,l])=>`<option value="${v}" ${v===value?'selected':''}>${l}</option>`).join('')}</select></div>`; }
function updateField(field, value) {
  const b = findBlock(selectedBlockId)?.block;
  if (!b) return;
  b[field] = ['timeoutMs','ms','maxUrlLength','repeatCount','maxRows','keepStart','keepEnd','keepFirstLines','keepLastLines','throttleSec','intervalSec','intervalMinutes','charStart','charEnd','lineNumber','group','columnIndex','maxItems','attempts','delayMs','amount'].includes(field) ? Number(value) : value;
  markDirty();
  renderBlocks();
  renderVariables();
  renderImportWarning();
  if (['waitMode','conditionMode','maskMode','scope','domain','path','url','urlContains','logic','operator','changeMode','readMode','searchScope','firstRun'].includes(field)) renderInspector();
}

function renderVariables() {
  const defs = BF.collectVariables(activeWorkflow);
  const refs = BF.collectVariableRefs ? BF.collectVariableRefs(activeWorkflow) : [];
  const all = [...new Set([...defs, ...refs])];
  $('#variables').innerHTML = all.length ? all.map(v => `<span class="var-chip ${defs.includes(v)?'':'var-warn'}" data-var="${v}">{{${v}}}</span>`).join('') : '<div class="muted">Még nincs változó.</div>';
  document.querySelectorAll('[data-var]').forEach(chip => chip.onclick = async () => { await navigator.clipboard.writeText(`{{${chip.dataset.var}}}`); $('#log').textContent = `Változó vágólapra másolva: {{${chip.dataset.var}}}`; });
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
    if (b.type !== 'triggerGroup') return;
    if (b.triggerEnabled === false) return;
    const conditions = (b.children || []).filter(c => String(c.type || '').startsWith('condition')).map(c => ({
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
      id: c.id
    }));
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
async function runCurrent(dryRun=false) {
  await saveCurrent(); await refreshTarget();
  if (!dryRun && (activeWorkflow.verified === false || activeWorkflow.imported)) {
    if (!confirm('Ez importált vagy nem ellenőrzött automatizmus. Javasolt előbb Dry-run módban tesztelni. Mégis futtatod?')) return;
  }
  const canRun = await validateBeforeRun({ allowContinue: dryRun });
  if (!canRun) return;
  $('#log').textContent = dryRun ? 'Dry-run futtatás...' : 'Futtatás...';
  const res = await BF.sendToTarget({ type: 'BF_RUN_WORKFLOW', workflow: activeWorkflow, options: { dryRun } }, targetTabId);
  if (res.response?.ok) {
    renderLiveVariables(res.response.result.vars);
    $('#log').textContent = `Kész.${dryRun?' [dry-run]':''}\n${JSON.stringify(res.response.result.vars, null, 2)}\n\n${(res.response.result.log || []).join('\n')}`;
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

$('#workflowName').oninput = () => { activeWorkflow.name = $('#workflowName').value; markDirty(); renderWorkflowList(); };
$('#saveWorkflow').onclick = async () => { await saveCurrent(); $('#log').textContent = 'Mentve.'; renderAll(); };
$('#newWorkflow').onclick = async () => { await saveCurrent(); const w = BF.DEFAULT_WORKFLOW(); workflows.push(w); activeWorkflow = w; selectedBlockId = null; await BF.saveWorkflow(w); isDirty = false; renderAll(); };
$('#duplicateWorkflow').onclick = async () => { const w = JSON.parse(JSON.stringify(activeWorkflow)); w.id = crypto.randomUUID(); w.name += ' másolat'; w.imported = false; w.verified = true; reidBlocks(w.blocks); workflows.push(w); activeWorkflow = w; selectedBlockId = firstBlock(w.blocks)?.id; await BF.saveWorkflow(w); renderAll(); };
$('#markVerified').onclick = async () => { activeWorkflow.verified = true; activeWorkflow.imported = false; await saveCurrent(); renderAll(); $('#log').textContent = 'Automatizmus ellenőrzöttként jelölve.'; };
$('#validateWorkflow').onclick = () => { renderValidation(); $('#log').textContent = 'Ellenőrzés lefuttatva.'; };
$('#runWorkflow').onclick = () => runCurrent(false);
$('#dryRunWorkflow').onclick = () => runCurrent(true);
$('#stopRun').onclick = async () => { const res = await BF.sendToTarget({ type: 'BF_STOP_RUN' }, targetTabId); $('#log').textContent = res.ok ? 'Stop kérés elküldve.' : (res.error || 'Stop hiba.'); };
$('#exportOne').onclick = () => BF.downloadJson(`${safeFile(activeWorkflow.name)}.json`, BF.exportPayload([activeWorkflow]));
$('#exportAll').onclick = () => BF.downloadJson(`blockflow-backup.json`, BF.exportPayload(workflows));
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
