const BF = (() => {
  const SCHEMA_VERSION = 5;

  const DEFAULT_WORKFLOW = () => ({
    id: crypto.randomUUID(),
    name: 'Új automatizmus',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    verified: true,
    blocks: [{ id: crypto.randomUUID(), type: 'trigger', label: 'Amikor kézzel indítom' }]
  });

  const BLOCKS = {
    trigger: { name: 'Indítás', desc: 'A workflow manuálisan indul.' },
    watchText: { name: 'Figyeld a szöveget', desc: 'Megvárja, amíg egy szöveg vagy karakter megjelenik.' },
    watchElement: { name: 'Figyeld az elemet', desc: 'Megvárja, amíg egy kiválasztott elem megjelenik.' },
    click: { name: 'Kattintás', desc: 'Kattint egy kiválasztott oldalelemre.' },
    fill: { name: 'Beillesztés / kitöltés', desc: 'Szöveget ír egy mezőbe.' },
    extract: { name: 'Adat kinyerése', desc: 'Szöveget vagy mezőértéket változóba ment.' },
    wait: { name: 'Várakozás', desc: 'Időre, szövegre vagy elemre vár.' },
    ifBlock: { name: 'Ha...', desc: 'Feltételt ellenőriz, és hamis esetben átugorhat blokkokat.' },
    repeatBlock: { name: 'Ismételd...', desc: 'A következő N blokkot többször lefuttatja.' },
    popupWait: { name: 'Várj popupra', desc: 'Megvárja, amíg weboldali modal/popup megjelenik.' },
    popupExtract: { name: 'Popup adat kinyerése', desc: 'Popup címét vagy szövegét változóba menti.' },
    popupClick: { name: 'Popup gomb', desc: 'Popupban gombot nyom szöveg alapján.' },
    copy: { name: 'Vágólapra másolás', desc: 'Szöveget vagy változót másol.' },
    email: { name: 'Email összeállítása', desc: 'Email draftot készít változókból.' },
    openEmail: { name: 'Email megnyitása', desc: 'Mailto linket nyit; hosszú törzsnél vágólapra másol.' },
    rowLoop: { name: 'Minden sorra...', desc: 'Egyszerű táblázat/lista sorfeldolgozó konténer.' },
    mask: { name: 'Maszkolás', desc: 'Kinyert adat maszkolása karakterek vagy sorok alapján.' }
  };

  const PALETTE = [
    { cat: 'Indítás', type: 'trigger' },
    { cat: 'Figyelés', type: 'watchText' },
    { cat: 'Figyelés', type: 'watchElement' },
    { cat: 'Műveletek', type: 'click' },
    { cat: 'Műveletek', type: 'fill' },
    { cat: 'Műveletek', type: 'wait' },
    { cat: 'Műveletek', type: 'copy' },
    { cat: 'Adatkinyerés', type: 'extract' },
    { cat: 'Logika', type: 'ifBlock' },
    { cat: 'Logika', type: 'repeatBlock' },
    { cat: 'Popup', type: 'popupWait' },
    { cat: 'Popup', type: 'popupExtract' },
    { cat: 'Popup', type: 'popupClick' },
    { cat: 'Email', type: 'email' },
    { cat: 'Email', type: 'openEmail' },
    { cat: 'Táblázat', type: 'rowLoop' },
    { cat: 'Adatkinyerés', type: 'mask' }
  ];

  function newBlock(type) {
    const id = crypto.randomUUID();
    if (type === 'click') return { id, type, target: null, timeoutMs: 5000, confirmRisky: true };
    if (type === 'fill') return { id, type, target: null, value: '', timeoutMs: 5000 };
    if (type === 'extract') return { id, type, target: null, extractMode: 'text', varName: 'adat', timeoutMs: 5000 };
    if (type === 'wait') return { id, type, waitMode: 'time', ms: 1000, text: '', target: null, timeoutMs: 5000 };
    if (type === 'watchText') return { id, type, text: '', timeoutMs: 30000, caseSensitive: false };
    if (type === 'watchElement') return { id, type, target: null, timeoutMs: 30000 };
    if (type === 'ifBlock') return { id, type, conditionMode: 'textExists', text: '', target: null, timeoutMs: 1000, value: '', children: [], elseChildren: [] };
    if (type === 'repeatBlock') return { id, type, repeatCount: 2, children: [] };
    if (type === 'popupWait') return { id, type, timeoutMs: 10000 };
    if (type === 'popupExtract') return { id, type, extractMode: 'text', varName: 'popup_szoveg' };
    if (type === 'popupClick') return { id, type, buttonText: 'OK', timeoutMs: 5000 };
    if (type === 'copy') return { id, type, value: '' };
    if (type === 'email') return { id, type, to: '{{email}}', subject: '', body: '', resultName: 'email_draft' };
    if (type === 'openEmail') return { id, type, draftName: 'email_draft', maxUrlLength: 1800 };
    if (type === 'rowLoop') return { id, type, target: null, rowVar: 'sor_szoveg', maxRows: 20, children: [] };
    if (type === 'mask') return { id, type, source: '{{adat}}', resultName: 'maszkolt_adat', maskMode: 'characters', maskChar: '*', keepStart: 2, keepEnd: 2, keepFirstLines: 1, keepLastLines: 1, maskLineText: '***' };
    return { id, type };
  }

  function blockTitle(block) {
    const meta = BLOCKS[block.type] || { name: block.type };
    if (block.type === 'click') return `Kattints: ${block.target?.label || 'nincs kiválasztva'}`;
    if (block.type === 'fill') return `Illeszd be ide: ${block.target?.label || 'nincs kiválasztva'}`;
    if (block.type === 'extract') return `Nyerd ki: ${block.target?.label || 'nincs kiválasztva'} → {{${block.varName || 'adat'}}}`;
    if (block.type === 'wait') return block.waitMode === 'time' ? `Várj ${block.ms || 1000} ms` : `Várakozás: ${block.waitMode}`;
    if (block.type === 'watchText') return `Figyeld: ${short(block.text || 'szöveg/karakter')}`;
    if (block.type === 'watchElement') return `Figyeld az elemet: ${block.target?.label || 'nincs kiválasztva'}`;
    if (block.type === 'ifBlock') return `Ha: ${conditionLabel(block)}`;
    if (block.type === 'repeatBlock') return `Ismételd ${block.repeatCount || 2} alkalommal`;
    if (block.type === 'popupWait') return 'Várj weboldali popupra';
    if (block.type === 'popupExtract') return `Popupból nyerd ki → {{${block.varName || 'popup_szoveg'}}}`;
    if (block.type === 'popupClick') return `Popup gomb: ${block.buttonText || 'OK'}`;
    if (block.type === 'copy') return 'Másold vágólapra';
    if (block.type === 'email') return `Email összeállítása → {{${block.resultName || 'email_draft'}}}`;
    if (block.type === 'openEmail') return `Email megnyitása: {{${block.draftName || 'email_draft'}}}`;
    if (block.type === 'rowLoop') return `Minden sorra: ${block.target?.label || 'nincs lista/táblázat'}`;
    if (block.type === 'mask') return `Maszkolás → {{${block.resultName || 'maszkolt_adat'}}}`;
    return meta.name;
  }

  function conditionLabel(block) {
    if (block.conditionMode === 'textExists') return `szöveg létezik: ${short(block.text || '')}`;
    if (block.conditionMode === 'elementExists') return `elem létezik: ${block.target?.label || 'nincs elem'}`;
    if (block.conditionMode === 'valueContains') return `elem értéke tartalmazza: ${short(block.value || '')}`;
    return block.conditionMode || 'feltétel';
  }

  function blockDesc(block) {
    if (block.type === 'fill') return `Mit: ${short(block.value || '')}`;
    if (block.type === 'extract') return `Mód: ${block.extractMode || 'text'}`;
    if (block.type === 'wait') return block.waitMode === 'text' ? `Szöveg: ${block.text || ''}` : (block.target?.label || '');
    if (block.type === 'watchText') return `Timeout: ${block.timeoutMs || 30000} ms`;
    if (block.type === 'ifBlock') return `Az alá behúzott ${Array.isArray(block.children)?block.children.length:0} blokk csak igaz feltételnél fut.`;
    if (block.type === 'repeatBlock') return `Az alá behúzott ${Array.isArray(block.children)?block.children.length:0} blokk ismétlődik.`;
    if (block.type === 'rowLoop') return `Max sor: ${block.maxRows || 20} · gyermek blokkok: ${(block.children||[]).length}`;
    if (block.type === 'email') return `Címzett: ${block.to || ''} | Tárgy: ${short(block.subject || '')}`;
    if (block.type === 'copy') return short(block.value || '');
    if (block.type === 'mask') return `${block.maskMode === 'lines' ? 'Soralapú' : 'Karakteralapú'} · Forrás: ${short(block.source || '')}`;
    return (BLOCKS[block.type] || {}).desc || '';
  }

  function short(s, n=90){ s=String(s||''); return s.length>n?s.slice(0,n-1)+'…':s; }

  async function getStore() {
    const data = await chrome.storage.local.get(['workflows', 'activeWorkflowId', 'templates']);
    let workflows = data.workflows || [];
    if (!workflows.length) {
      const w = DEFAULT_WORKFLOW();
      workflows = [w];
      await chrome.storage.local.set({ workflows, activeWorkflowId: w.id, templates: defaultTemplates() });
      return { workflows, activeWorkflowId: w.id, templates: defaultTemplates() };
    }
    if (!Array.isArray(data.templates)) await chrome.storage.local.set({ templates: defaultTemplates() });
    return { workflows, activeWorkflowId: data.activeWorkflowId || workflows[0].id, templates: Array.isArray(data.templates) ? data.templates : defaultTemplates() };
  }

  function defaultTemplates() {
    return [{ id: crypto.randomUUID(), name: 'Alap email sablon', subject: 'Megkeresés - {{nev}}', body: 'Kedves {{nev}},\n\n{{popup_szoveg}}\n\nÜdvözlettel,' }];
  }

  async function getTemplates() {
    const data = await chrome.storage.local.get('templates');
    if (Array.isArray(data.templates)) return data.templates;
    const t = defaultTemplates();
    await chrome.storage.local.set({ templates: t });
    return t;
  }

  async function saveTemplates(templates) { await chrome.storage.local.set({ templates }); }

  async function pushVersion(workflow) {
    if (!workflow?.id) return;
    const key = `versions_${workflow.id}`;
    const data = await chrome.storage.local.get(key);
    const versions = Array.isArray(data[key]) ? data[key] : [];
    versions.unshift({ at: new Date().toISOString(), workflow: typeof structuredClone === 'function' ? structuredClone(workflow) : JSON.parse(JSON.stringify(workflow)) });
    await chrome.storage.local.set({ [key]: versions.slice(0, 20) });
  }

  async function getVersions(workflowId) {
    const key = `versions_${workflowId}`;
    const data = await chrome.storage.local.get(key);
    return Array.isArray(data[key]) ? data[key] : [];
  }

  async function saveWorkflow(workflow) {
    const store = await getStore();
    workflow.updatedAt = new Date().toISOString();
    const workflows = store.workflows.map(w => w.id === workflow.id ? workflow : w);
    const existing = store.workflows.find(w => w.id === workflow.id);
    if (existing) await pushVersion(existing);
    if (!workflows.find(w => w.id === workflow.id)) workflows.push(workflow);
    await chrome.storage.local.set({ workflows, activeWorkflowId: workflow.id });
  }

  async function setActiveWorkflow(id) { await chrome.storage.local.set({ activeWorkflowId: id }); }

  function downloadJson(name, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function exportPayload(workflows) {
    return { app: 'BlockFlow Automation MVP', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), workflows };
  }

  function walkBlocks(blocks, fn) {
    for (const b of blocks || []) {
      fn(b);
      if (Array.isArray(b.children)) walkBlocks(b.children, fn);
      if (Array.isArray(b.elseChildren)) walkBlocks(b.elseChildren, fn);
    }
  }

  function analyzeImport(payload) {
    const incoming = Array.isArray(payload?.workflows) ? payload.workflows : (payload?.blocks ? [payload] : []);
    if (!incoming.length) throw new Error('Nem található importálható workflow.');
    const workflows = incoming.map(w => {
      const types = [];
      let riskyCount = 0;
      walkBlocks(w.blocks || [], b => {
        if (b.type) types.push(b.type);
        if (['click','fill','openEmail','popupClick','copy'].includes(b.type)) riskyCount++;
      });
      return {
        name: w.name || 'Importált automatizmus',
        blockCount: types.length,
        blocks: types,
        riskyCount,
        originalId: w.id || null
      };
    });
    return { schemaVersion: payload?.schemaVersion || 1, workflows, rawCount: incoming.length };
  }

  async function importPayload(payload) {
    const incoming = Array.isArray(payload?.workflows) ? payload.workflows : (payload?.blocks ? [payload] : []);
    if (!incoming.length) throw new Error('Nem található importálható workflow.');
    const store = await getStore();
    const stamp = new Date().toISOString();
    const prepared = incoming.map(w => ({
      ...w,
      id: crypto.randomUUID(),
      imported: true,
      verified: false,
      importedAt: stamp,
      name: `${w.name || 'Importált automatizmus'} (import)`
    }));
    await chrome.storage.local.set({ workflows: [...store.workflows, ...prepared], activeWorkflowId: prepared[0].id });
    return prepared;
  }

  async function sendToTarget(payload, tabId) {
    return chrome.runtime.sendMessage({ type: 'SEND_TO_TARGET_TAB', payload, tabId });
  }

  async function getTargetTab(tabId) { return chrome.runtime.sendMessage({ type: 'GET_TARGET_TAB', tabId }); }

  function collectVariables(workflow) {
    const vars = new Set(['current_url', 'today', 'selected_text', 'popup_szoveg']);
    walkBlocks(workflow.blocks || [], b => {
      if (['extract','popupExtract'].includes(b.type) && b.varName) vars.add(b.varName);
      if (b.type === 'mask' && b.resultName) vars.add(b.resultName);
      if (b.type === 'email' && b.resultName) vars.add(b.resultName);
      if (b.type === 'rowLoop' && b.rowVar) vars.add(b.rowVar);
    });
    return [...vars];
  }

  function collectVariableRefs(workflow) {
    const refs = new Set();
    const re = /{{\s*([\w.-]+)\s*}}/g;
    walkBlocks(workflow.blocks || [], b => {
      for (const v of Object.values(b)) {
        if (typeof v === 'string') { let m; while ((m = re.exec(v))) refs.add(m[1]); }
      }
    });
    return [...refs];
  }

  function validateWorkflow(workflow) {
    const issues = [];
    const defined = new Set(['current_url','today','selected_text','row_index','sor_szoveg']);
    walkBlocks(workflow.blocks || [], b => {
      if (b.type === 'extract' && b.varName) defined.add(b.varName);
      if (b.type === 'popupExtract' && b.varName) defined.add(b.varName);
      if (b.type === 'email' && b.resultName) defined.add(b.resultName);
      if (b.type === 'rowLoop' && b.rowVar) defined.add(b.rowVar);
      if (b.type === 'mask' && b.resultName) defined.add(b.resultName);
    });
    const needsTarget = ['click','fill','extract','watchElement','rowLoop'];
    walkBlocks(workflow.blocks || [], b => {
      if (needsTarget.includes(b.type) && !b.target) issues.push({ level:'error', blockId:b.id, text:`${BLOCKS[b.type]?.name || b.type}: hiányzik a cél elem.` });
      if (b.type === 'wait' && b.waitMode === 'element' && !b.target) issues.push({ level:'error', blockId:b.id, text:'Várakozás elemre: hiányzik a cél elem.' });
      if (b.type === 'ifBlock' && ['elementExists','valueContains'].includes(b.conditionMode) && !b.target) issues.push({ level:'error', blockId:b.id, text:'Ha blokk: hiányzik a cél elem.' });
      if (b.type === 'ifBlock' && b.conditionMode === 'textExists' && !String(b.text||'').trim()) issues.push({ level:'warning', blockId:b.id, text:'Ha blokk: üres keresett szöveg.' });
      if (b.type === 'watchText' && !String(b.text||'').trim()) issues.push({ level:'error', blockId:b.id, text:'Watcher: üres figyelt szöveg.' });
      if (b.type === 'email' && !String(b.to||'').trim()) issues.push({ level:'error', blockId:b.id, text:'Email blokk: hiányzik a címzett.' });
      if (b.type === 'mask' && !String(b.source||'').trim()) issues.push({ level:'error', blockId:b.id, text:'Maszkolás blokk: hiányzik a forrás szöveg vagy változó.' });
      if (b.type === 'mask' && !String(b.resultName||'').trim()) issues.push({ level:'error', blockId:b.id, text:'Maszkolás blokk: hiányzik az eredmény változó neve.' });
      if (b.type === 'openEmail' && !String(b.draftName||'').trim()) issues.push({ level:'error', blockId:b.id, text:'Email megnyitása: hiányzik a draft változó neve.' });
      if (b.type === 'click' && /delete|remove|send|submit|pay|confirm|order|törl|küld|fizet|rendel|végleges/i.test(`${b.target?.label || ''} ${b.target?.text || ''}`)) issues.push({ level:'warning', blockId:b.id, text:`Kockázatos kattintás lehet: ${b.target?.label || 'cél elem'}.` });
    });
    for (const ref of collectVariableRefs(workflow)) {
      if (!defined.has(ref)) issues.push({ level:'warning', blockId:null, text:`A {{${ref}}} változó nincs korábban létrehozva.` });
    }
    return { ok: !issues.some(i => i.level === 'error'), issues };
  }

  function countBlocks(blocks) {
    let n = 0;
    walkBlocks(blocks || [], () => n++);
    return n;
  }

  return { SCHEMA_VERSION, DEFAULT_WORKFLOW, BLOCKS, PALETTE, newBlock, blockTitle, blockDesc, getStore, saveWorkflow, setActiveWorkflow, downloadJson, exportPayload, analyzeImport, importPayload, sendToTarget, getTargetTab, collectVariables, collectVariableRefs, validateWorkflow, getTemplates, saveTemplates, getVersions, pushVersion, countBlocks, walkBlocks, short };
})();
