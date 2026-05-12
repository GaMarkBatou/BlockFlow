let workflows = [];
let activeWorkflow = null;
let selectedBlockId = null;
let targetTabId = Number(new URLSearchParams(location.search).get('targetTabId')) || null;

const $ = sel => document.querySelector(sel);
const CONTAINERS = new Set(['ifBlock', 'repeatBlock', 'rowLoop']);

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
  $('#targetInfo').textContent = res.ok ? `Cél tab: ${safeHost(res.url)}` : 'Nincs weboldal cél tab';
}

function renderAll() {
  normalizeWorkflow(activeWorkflow);
  renderWorkflowList();
  renderPalette();
  renderBlocks();
  renderInspector();
  renderVariables();
  renderImportWarning();
  renderValidation();
  renderWatcherPanel();
  renderTemplates();
  renderVersions();
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
  const hint = selected && CONTAINERS.has(selected.type)
    ? `<div class="status">Kiválasztott konténer: <b>${escapeHtml(BF.BLOCKS[selected.type].name)}</b>. Az új blokkok ide, behúzva kerülnek.</div>`
    : `<div class="status muted">Konténer kijelölésekor az új blokkok automatikusan alá kerülnek behúzva.</div>`;
  $('#palette').innerHTML = hint + Object.entries(grouped).map(([cat, items]) => `<div class="section-title">${cat}</div>` + items.map(item => `<button class="palette-btn" data-add="${item.type}"><span>${BF.BLOCKS[item.type].name}</span><span>+</span></button>`).join('')).join('');
  document.querySelectorAll('[data-add]').forEach(b => b.onclick = () => addBlock(b.dataset.add));
}

function addBlock(type) {
  if (type === 'trigger' && containsType(activeWorkflow.blocks, 'trigger')) return alert('Egy manuális indító blokk már van a workflow tetején.');
  const block = BF.newBlock(type);
  const selected = findBlock(selectedBlockId)?.block;
  if (selected && CONTAINERS.has(selected.type)) {
    selected.children ||= [];
    selected.children.push(block);
  } else {
    activeWorkflow.blocks.push(block);
  }
  selectedBlockId = block.id;
  markDirty();
  renderAll();
}

function containsType(blocks, type) {
  let found = false;
  walk(blocks, b => { if (b.type === type) found = true; });
  return found;
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
  if (!blocks || !blocks.length) return level ? '<div class="empty nested-empty">Húzz ide blokkokat, vagy jelöld ki a konténert és adj hozzá blokkot a bal oldalon.</div>' : '<div class="empty">Adj hozzá blokkokat a bal oldali palettából.</div>';
  return blocks.map((b, idx) => {
    let childHtml = '';
    if (CONTAINERS.has(b.type)) {
      childHtml = `<div class="container-body" data-drop-container="${b.id}">
        <div class="container-label">${b.type === 'ifBlock' ? 'HA IGAZ - behúzott blokkok' : 'A blokk hatása alá tartozó behúzott blokkok'}</div>
        ${renderBlockList(b.children || [], level + 1, b.id)}
      </div>`;
      if (b.type === 'ifBlock') {
        childHtml += `<div class="container-body else-body" data-drop-container="else:${b.id}">
          <div class="container-label">KÜLÖNBEN - behúzott blokkok</div>
          ${renderBlockList(b.elseChildren || [], level + 1, `else:${b.id}`)}
        </div>`;
      }
    }
    return `<div class="block-wrap" data-wrap="${b.id}" style="--level:${level}">
      <div class="block block-${b.type} ${b.id===selectedBlockId?'selected':''}" draggable="true" data-block="${b.id}" data-parent="${parentId || 'root'}">
        <div class="block-actions">
          <button class="small" title="Fel" data-up="${b.id}">↑</button>
          <button class="small" title="Le" data-down="${b.id}">↓</button>
          ${parentId ? `<button class="small" title="Kihúzás fő szintre" data-outdent="${b.id}">⇤</button>` : ''}
          ${b.type!=='trigger'?`<button class="small danger" title="Törlés" data-del="${b.id}">×</button>`:''}
        </div>
        <div class="row"><span class="pill">${level ? '↳' : idx+1}</span><span class="block-title">${escapeHtml(BF.blockTitle(b))}</span></div>
        <div class="block-desc">${escapeHtml(BF.blockDesc(b))}</div>
      </div>
      ${childHtml}
    </div>`;
  }).join('');
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
  document.querySelectorAll('[data-up]').forEach(b => b.onclick = e => { e.stopPropagation(); reorder(b.dataset.up, -1); });
  document.querySelectorAll('[data-down]').forEach(b => b.onclick = e => { e.stopPropagation(); reorder(b.dataset.down, 1); });
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
  if (!found || found.block.type === 'trigger') return null;
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
  if (containerId !== 'root') {
    const realContainerId = String(containerId).startsWith('else:') ? String(containerId).slice(5) : containerId;
    const target = findBlock(realContainerId)?.block;
    if (!target || !CONTAINERS.has(target.type)) return;
    if (id === realContainerId || isDescendant(id, realContainerId)) return alert('Egy blokk nem húzható saját maga alá.');
  }
  const item = removeBlock(id);
  if (!item) return;
  const list = listForContainer(containerId);
  list.push(item);
  selectedBlockId = item.id;
  markDirty();
  renderAll();
}

function moveBefore(id, beforeId) {
  if (!id || id === beforeId) return;
  if (isDescendant(id, beforeId)) return alert('Egy konténer nem húzható saját gyermekblokkja elé.');
  const before = findBlock(beforeId);
  const item = removeBlock(id);
  if (!before || !item) return;
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
  if (activeWorkflow.imported) activeWorkflow.verified = false;
}

function renderInspector() {
  const b = findBlock(selectedBlockId)?.block;
  if (!b) { $('#inspector').innerHTML = '<div class="empty">Válassz blokkot.</div>'; return; }
  let html = `<div class="list-title">${escapeHtml(BF.BLOCKS[b.type]?.name || b.type)}</div>`;
  if (['click','fill','extract','watchElement'].includes(b.type)) html += targetEditor(b);
  if (b.type === 'click') html += checkboxField('confirmRisky','Kockázatos kattintásnál kérjen megerősítést', b.confirmRisky !== false) + numberField('timeoutMs','Max várakozás ms', b.timeoutMs || 5000);
  if (b.type === 'fill') html += valueSourceHelp() + textArea('value','Mit illesszen be?', b.value || '') + numberField('timeoutMs','Max várakozás ms', b.timeoutMs || 5000);
  if (b.type === 'extract') html += selectField('extractMode','Mit nyerjen ki?', b.extractMode || 'text', [['text','Látható szöveg'],['value','Mezőérték']]) + textField('varName','Változó neve', b.varName || 'adat') + numberField('timeoutMs','Max várakozás ms', b.timeoutMs || 5000);
  if (b.type === 'watchText') html += textField('text','Figyelt szöveg vagy karakter', b.text || '') + numberField('timeoutMs','Timeout ms', b.timeoutMs || 30000) + checkboxField('caseSensitive','Kis/nagybetű számítson', Boolean(b.caseSensitive));
  if (b.type === 'watchElement') html += numberField('timeoutMs','Timeout ms', b.timeoutMs || 30000);
  if (b.type === 'wait') html += selectField('waitMode','Várakozás típusa', b.waitMode || 'time', [['time','Idő'],['text','Szöveg megjelenése'],['element','Elem megjelenése']]) + (b.waitMode === 'time' ? numberField('ms','Idő ms', b.ms || 1000) : b.waitMode === 'text' ? textField('text','Szöveg', b.text || '') + numberField('timeoutMs','Timeout ms', b.timeoutMs || 5000) : targetEditor(b) + numberField('timeoutMs','Timeout ms', b.timeoutMs || 5000));
  if (b.type === 'ifBlock') html += selectField('conditionMode','Feltétel', b.conditionMode || 'textExists', [['textExists','Szöveg létezik'],['elementExists','Elem létezik'],['valueContains','Elem értéke tartalmazza']]) + (b.conditionMode === 'elementExists' || b.conditionMode === 'valueContains' ? targetEditor(b) : '') + (b.conditionMode === 'valueContains' ? textField('value','Keresett érték', b.value || '') : b.conditionMode === 'textExists' ? textField('text','Keresett szöveg', b.text || '') : '') + numberField('timeoutMs','Elemkeresési timeout ms', b.timeoutMs || 1000) + `<div class="status">Igaz ág: ${(b.children||[]).length} blokk · Különben ág: ${(b.elseChildren||[]).length} blokk</div>`;
  if (b.type === 'repeatBlock') html += numberField('repeatCount','Ismétlések száma', b.repeatCount || 2) + `<div class="status">Az alá behúzott blokkok ismétlődnek. Gyermek blokkok: ${(b.children||[]).length}</div>`;
  if (b.type === 'rowLoop') html += targetEditor(b) + textField('rowVar','Sor szövegének változóneve', b.rowVar || 'sor_szoveg') + numberField('maxRows','Max sor', b.maxRows || 20) + `<div class="status">Egyszerű lista/táblázat feldolgozás: a kiválasztott elem sorait/listaelemeit járja be.</div>`;
  if (b.type === 'popupWait') html += numberField('timeoutMs','Popup timeout ms', b.timeoutMs || 10000) + `<button id="testPopup" class="ghost">Popup tesztelése</button>`;
  if (b.type === 'popupExtract') html += selectField('extractMode','Mit nyerjen ki?', b.extractMode || 'text', [['text','Teljes popup szöveg'],['title','Popup cím']]) + textField('varName','Változó neve', b.varName || 'popup_szoveg');
  if (b.type === 'popupClick') html += textField('buttonText','Popup gomb szövege', b.buttonText || 'OK') + numberField('timeoutMs','Timeout ms', b.timeoutMs || 5000);
  if (b.type === 'copy') html += valueSourceHelp() + textArea('value','Mit másoljon?', b.value || '');
  if (b.type === 'mask') html += valueSourceHelp() + textArea('source','Forrás szöveg vagy változó', b.source || '{{adat}}') + selectField('maskMode','Maszkolás módja', b.maskMode || 'characters', [['characters','Karakterek alapján'],['lines','Sorok alapján']]) + textField('resultName','Eredmény változó neve', b.resultName || 'maszkolt_adat') + textField('maskChar','Maszk karakter', b.maskChar || '*') + (b.maskMode === 'lines' ? numberField('keepFirstLines','Meghagyott első sorok', b.keepFirstLines ?? 1) + numberField('keepLastLines','Meghagyott utolsó sorok', b.keepLastLines ?? 1) + textField('maskLineText','Maszkolt sor szövege', b.maskLineText || '***') : numberField('keepStart','Meghagyott első karakterek', b.keepStart ?? 2) + numberField('keepEnd','Meghagyott utolsó karakterek', b.keepEnd ?? 2)) + `<div class="status">Példa: {{email}} → jo******@domain.com, vagy több sor esetén csak az első/utolsó sor marad látható.</div>`;
  if (b.type === 'email') html += textField('to','Címzett', b.to || '') + textField('subject','Tárgy', b.subject || '') + textArea('body','Törzs', b.body || '') + textField('resultName','Draft változó neve', b.resultName || 'email_draft');
  if (b.type === 'openEmail') html += textField('draftName','Email draft változó', b.draftName || 'email_draft') + numberField('maxUrlLength','Mailto max hossz', b.maxUrlLength || 1800) + `<div class="status">Az extension nem küld emailt. Csak mailto ablakot nyit; hosszú törzs esetén vágólapra másol.</div>`;
  if (CONTAINERS.has(b.type)) html += `<div class="hr"></div><div class="status">Tipp: húzz blokkokat a blokk alatti behúzott területre, vagy hagyd kijelölve ezt a blokkot és adj hozzá új blokkot a bal oldali palettából.</div>`;
  html += `<div class="hr"></div><button id="testBlock" class="ghost">Blokk tesztelése</button>`;
  $('#inspector').innerHTML = html;
  $('#inspector').querySelectorAll('[data-field]').forEach(input => {
    const handler = () => updateField(input.dataset.field, input.type === 'checkbox' ? input.checked : input.value);
    input.oninput = handler; input.onchange = handler;
  });
  const pick = $('#pickElement'); if (pick) pick.onclick = () => startPick(b.id, 'target');
  const test = $('#testBlock'); if (test) test.onclick = () => testBlock(b);
  const popupTest = $('#testPopup'); if (popupTest) popupTest.onclick = testPopup;
}

function targetEditor(b){ return `<div class="field"><label>Cél elem</label><div class="status">${b.target ? escapeHtml(b.target.label + ' · ' + b.target.tag) : 'Nincs elem kiválasztva'}</div><button id="pickElement" class="primary">Elem kiválasztása az oldalról</button></div>`; }
function valueSourceHelp(){ return `<div class="status">Használható változók: {{email}}, {{nev}}, {{popup_szoveg}}. A jobb oldali változóra kattintva vágólapra másolódik.</div>`; }
function textField(field,label,value){ return `<div class="field"><label>${label}</label><input data-field="${field}" value="${escapeAttr(value)}"></div>`; }
function numberField(field,label,value){ return `<div class="field"><label>${label}</label><input data-field="${field}" type="number" value="${escapeAttr(value)}"></div>`; }
function checkboxField(field,label,value){ return `<label class="check"><input data-field="${field}" type="checkbox" ${value?'checked':''}> ${label}</label>`; }
function textArea(field,label,value){ return `<div class="field"><label>${label}</label><textarea data-field="${field}">${escapeHtml(value)}</textarea></div>`; }
function selectField(field,label,value,options){ return `<div class="field"><label>${label}</label><select data-field="${field}">${options.map(([v,l])=>`<option value="${v}" ${v===value?'selected':''}>${l}</option>`).join('')}</select></div>`; }
function updateField(field, value) {
  const b = findBlock(selectedBlockId)?.block;
  if (!b) return;
  b[field] = ['timeoutMs','ms','maxUrlLength','repeatCount','maxRows','keepStart','keepEnd','keepFirstLines','keepLastLines'].includes(field) ? Number(value) : value;
  markDirty();
  renderBlocks();
  renderVariables();
  renderImportWarning();
  if (['waitMode','conditionMode','maskMode'].includes(field)) renderInspector();
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

async function saveCurrent(){ activeWorkflow.name = $('#workflowName').value || 'Névtelen automatizmus'; workflows = workflows.map(w => w.id === activeWorkflow.id ? activeWorkflow : w); await BF.saveWorkflow(activeWorkflow); const store = await BF.getStore(); workflows = store.workflows; }
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


async function renderWatcherPanel() {
  const panel = $('#watcherPanel'); if (!panel) return;
  const data = await chrome.storage.local.get('watchers');
  const watchers = Array.isArray(data.watchers) ? data.watchers : [];
  const mine = watchers.filter(w => w.workflowId === activeWorkflow.id);
  let tabInfo = null;
  try { tabInfo = await BF.getTargetTab(targetTabId); } catch {}
  const currentUrl = tabInfo?.url || '';
  let u = null; try { u = new URL(currentUrl); } catch {}
  const currentDomain = u?.hostname || '';
  const currentPath = u?.pathname || '/';
  const activeCount = mine.filter(w => w.enabled !== false).length;
  panel.innerHTML = `
    <div class="compact-head">
      <div><b>${mine.length} watcher</b><br><span class="muted">${activeCount} aktív · cél: ${escapeHtml(currentDomain || 'nincs cél tab')}</span></div>
      <button id="addTextWatcher" class="small primary">+ Szöveg</button>
      <button id="addElementWatcher" class="small">+ Elem</button>
    </div>
    <div class="compact-help">A részletes beállítások külön szerkesztőablakban nyílnak meg, így nem foglalják a jobb panelt.</div>
    ${mine.length ? mine.map(watcherRow).join('') : '<div class="compact-empty">Nincs watcher ehhez a workflow-hoz.</div>'}
  `;
  function watcherRow(w) {
    const mode = w.mode === 'element' ? 'Elem' : 'Szöveg';
    const scopeLabel = ({domain:'domain', path:'domain+path', exact:'pontos URL', contains:'URL részlet', any:'bármely oldal'})[w.scope || 'domain'] || 'domain';
    const trigger = w.mode === 'element'
      ? (w.target ? `${w.target.label || w.target.tag || 'cél elem'}` : 'nincs cél elem')
      : (w.text ? `"${w.text}"` : 'nincs szöveg');
    return `<div class="compact-row" data-watch-row="${w.id}">
      <label class="toggle-mini" title="Aktív/inaktív"><input type="checkbox" data-watch-quick-enable="${w.id}" ${w.enabled!==false?'checked':''}></label>
      <div class="compact-main"><b>${escapeHtml(mode)} watcher</b><span>${escapeHtml(trigger)}</span><small>${escapeHtml(scopeLabel)} · ${Number(w.throttleSec || 15)} mp szünet${w.runOnce ? ' · egyszer fut' : ''}</small></div>
      <button class="small" data-edit-watch="${w.id}">Szerkesztés</button>
      <button class="small danger" data-del-watch="${w.id}">Törlés</button>
    </div>`;
  }
  async function addWatcher(mode) {
    const found = mode === 'element' ? findFirstTarget(activeWorkflow.blocks) : null;
    const w = { id: crypto.randomUUID(), workflowId: activeWorkflow.id, enabled: true, mode, text: '', caseSensitive: false, target: found?.target || null, scope: 'domain', domain: currentDomain, path: currentPath, url: currentUrl, urlContains: currentUrl, throttleSec: 15, runOnce: false, createdAt: new Date().toISOString() };
    watchers.push(w);
    await chrome.storage.local.set({ watchers });
    await BF.sendToTarget({ type:'BF_REFRESH_WATCHERS' }, targetTabId).catch(()=>{});
    renderWatcherPanel();
    openWatcherEditor(w.id);
  }
  $('#addTextWatcher').onclick = () => addWatcher('text');
  $('#addElementWatcher').onclick = () => addWatcher('element');
  panel.querySelectorAll('[data-watch-quick-enable]').forEach(input => input.onchange = async () => {
    const w = watchers.find(x => x.id === input.dataset.watchQuickEnable); if (!w) return;
    w.enabled = input.checked;
    await chrome.storage.local.set({ watchers });
    await BF.sendToTarget({ type:'BF_REFRESH_WATCHERS' }, targetTabId).catch(()=>{});
    renderWatcherPanel();
  });
  panel.querySelectorAll('[data-edit-watch]').forEach(btn => btn.onclick = () => openWatcherEditor(btn.dataset.editWatch));
  panel.querySelectorAll('[data-del-watch]').forEach(btn => btn.onclick = async () => {
    if (!confirm('Törlöd ezt a watchert?')) return;
    await chrome.storage.local.set({ watchers: watchers.filter(w => w.id !== btn.dataset.delWatch) });
    await BF.sendToTarget({ type:'BF_REFRESH_WATCHERS' }, targetTabId).catch(()=>{});
    renderWatcherPanel();
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
    <div class="modal-title">Watcher szerkesztése</div>
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

$('#workflowName').oninput = () => { activeWorkflow.name = $('#workflowName').value; renderWorkflowList(); };
$('#saveWorkflow').onclick = async () => { await saveCurrent(); $('#log').textContent = 'Mentve.'; renderAll(); };
$('#newWorkflow').onclick = async () => { await saveCurrent(); const w = BF.DEFAULT_WORKFLOW(); workflows.push(w); activeWorkflow = w; selectedBlockId = w.blocks[0].id; await BF.saveWorkflow(w); renderAll(); };
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
