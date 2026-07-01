(() => {
  if (window.__blockFlowLoaded) return;
  window.__blockFlowLoaded = true;

  let picker = null;
  let stopRequested = false;
  let recorder = null;
  let bfRootStack = [];
  const runningWorkflowLocks = new Set();
  const activePanelWorkflowLocks = new Set();
  const runningActionLocks = new Set();
  const workflowSessions = new Map();
  function getSearchRoot() { return bfRootStack.length ? bfRootStack[bfRootStack.length - 1] : document; }
  function rootDocument(root = getSearchRoot()) { return root && root.nodeType === 9 ? root : document; }

  const BF_SNOW_HOST_SELECTOR = 'now-input,now-textarea,now-select,now-record-picker,sn-record-picker,now-rich-text-editor,now-rich-text-area,now-html-editor,now-combobox,now-dropdown';
  const BF_NATIVE_FIELD_SELECTOR = 'input,textarea,select,[contenteditable],[role="textbox"],[role="combobox"],[role="searchbox"],[aria-multiline="true"],.ql-editor,.tox-edit-area iframe';
  const BF_FIELD_CONTROL_SELECTOR = `${BF_NATIVE_FIELD_SELECTOR},${BF_SNOW_HOST_SELECTOR}`;
  const BF_SNOW_ATTRS = ['name','field','field-name','data-field','data-field-name','data-name','data-column','data-property','data-record-field','data-testid','data-test-id','data-test','data-qa','data-cy','component-id','sys-id','table','data-table','aria-label','label','data-label','data-label-text','placeholder','title'];


  const BF_RUNTIME_FALLBACKS = {
    hu: {
      'publicLog.title': 'BlockFlow napló',
      'publicLog.txt': 'TXT',
      'publicLog.starting': 'Futási napló indul...',
      'publicLog.workflowRun': 'Automatizmus futása',
      'publicLog.downloadHint': 'A TXT gombbal letölthető a futási napló.',
      'runtime.runStarted': 'Futás indult. URL: {{url}}',
      'runtime.runFinished': 'Futás befejeződött.',
      'runtime.autoSubRunGate': 'Automatikus/alworkflow futás: indítófeltételek nem kerülnek újraellenőrzésre.',
      'runtime.forceRunGate': 'Kényszerített futtatás: az indítófeltételek kihagyva.',
      'runtime.blockStep': '{{label}} · {{index}}: {{type}}{{dry}}',
      'runtime.output': 'Átadás: {{type}}{{details}}',
      'runtime.importantVars': 'Fontos változók: {{values}}',
      'runtime.errorPrefix': 'HIBA',
      'runtime.detailValue': 'érték',
      'runtime.detailCount': 'db',
      'runtime.detailFile': 'fájl',
      'runtime.doneWord': 'kész',
      'button.cancel': 'Mégsem',
      'runtime.workflowAlreadyRunning': 'Ez az automatizmus már fut ezen az oldalon.',
      'runtime.actionAlreadyRunning': 'A művelet már fut: {{action}}',
      'runtime.actionStarted': 'Művelet indult: {{action}}',
      'runtime.actionFinished': 'Művelet befejezve: {{action}}',
      'runtime.actionRunning': 'Fut: {{action}}',
      'runtime.actionDone': 'Kész: {{action}}',
      'runtime.actionFailed': 'Hiba: {{action}} - {{error}}',
      'runtime.actionGroupMissing': 'Nem található műveletcsoport ehhez a kulcshoz: {{action}}',
      'runtime.sessionCleared': 'Munkamenet törölve.',
      'runtime.panelReady': 'Panel kész.',
      'runtime.panelNoButtons': 'Nincs beállított gomb.',
      'runtime.pageLoadOnceSkipped': 'Ez a trigger már lefutott ezen az oldalbetöltésen.',
      'runtime.textShortcutExpanded': 'Szövegcsere: {{shortcut}}'
    },
    en: {
      'publicLog.title': 'BlockFlow log',
      'publicLog.txt': 'TXT',
      'publicLog.starting': 'Run log starting...',
      'publicLog.workflowRun': 'Automation run',
      'publicLog.downloadHint': 'Use the TXT button to download the run log.',
      'runtime.runStarted': 'Run started. URL: {{url}}',
      'runtime.runFinished': 'Run finished.',
      'runtime.autoSubRunGate': 'Automatic/sub-workflow run: start conditions are not checked again.',
      'runtime.forceRunGate': 'Force run: start conditions skipped.',
      'runtime.blockStep': '{{label}} · {{index}}: {{type}}{{dry}}',
      'runtime.output': 'Output: {{type}}{{details}}',
      'runtime.importantVars': 'Important variables: {{values}}',
      'runtime.errorPrefix': 'ERROR',
      'runtime.detailValue': 'value',
      'runtime.detailCount': 'count',
      'runtime.detailFile': 'file',
      'runtime.doneWord': 'done',
      'button.cancel': 'Cancel',
      'runtime.workflowAlreadyRunning': 'This automation is already running on this page.',
      'runtime.actionAlreadyRunning': 'The action is already running: {{action}}',
      'runtime.actionStarted': 'Action started: {{action}}',
      'runtime.actionFinished': 'Action finished: {{action}}',
      'runtime.actionRunning': 'Running: {{action}}',
      'runtime.actionDone': 'Done: {{action}}',
      'runtime.actionFailed': 'Error: {{action}} - {{error}}',
      'runtime.actionGroupMissing': 'No action group found for key: {{action}}',
      'runtime.sessionCleared': 'Session cleared.',
      'runtime.panelReady': 'Panel ready.',
      'runtime.panelNoButtons': 'No buttons configured.',
      'runtime.pageLoadOnceSkipped': 'This trigger has already run on this page load.',
      'runtime.textShortcutExpanded': 'Text shortcut expanded: {{shortcut}}'
    }
  };
  const BF_I18N = { loaded:false, selected:'auto', active:'hu', fallback:'hu', languages:[], dict:{}, fallbackDict:BF_RUNTIME_FALLBACKS.hu };
  async function bfFetchJson(path, fallback = {}) {
    try {
      const res = await fetch(chrome.runtime.getURL(path));
      if (!res.ok) throw new Error(String(res.status));
      return await res.json();
    } catch (_) { return fallback; }
  }
  function bfNormalizeLang(code) { return String(code || 'hu').toLowerCase().split('-')[0]; }
  function bfResolveLang(selected, languages) {
    const list = (languages || []).filter(l => l.code && l.code !== 'auto');
    const supported = new Set(list.map(l => l.code));
    if (selected && selected !== 'auto' && supported.has(selected)) return selected;
    const browser = bfNormalizeLang(navigator.language || 'hu');
    return supported.has(browser) ? browser : (BF_I18N.fallback || 'hu');
  }
  async function ensureRuntimeI18n() {
    if (BF_I18N.loaded) return BF_I18N;
    const meta = await bfFetchJson('locales/languages.json', { fallback:'hu', languages:[{code:'hu',file:'hu.json'}] });
    BF_I18N.languages = meta.languages || [];
    BF_I18N.fallback = meta.fallback || 'hu';
    let selected = meta.default || 'auto';
    try { const st = await chrome.storage.local.get(['uiLanguage']); selected = st.uiLanguage || selected; } catch (_) {}
    BF_I18N.selected = selected;
    BF_I18N.active = bfResolveLang(selected, BF_I18N.languages);
    const activeInfo = BF_I18N.languages.find(l => l.code === BF_I18N.active) || { file: BF_I18N.active + '.json' };
    const fallbackInfo = BF_I18N.languages.find(l => l.code === BF_I18N.fallback) || { file: BF_I18N.fallback + '.json' };
    const builtInFallback = BF_RUNTIME_FALLBACKS[BF_I18N.fallback] || BF_RUNTIME_FALLBACKS.hu || {};
    const builtInActive = BF_RUNTIME_FALLBACKS[BF_I18N.active] || builtInFallback;
    const fetchedFallback = await bfFetchJson('locales/' + (fallbackInfo.file || (BF_I18N.fallback + '.json')), {});
    BF_I18N.fallbackDict = { ...builtInFallback, ...fetchedFallback };
    const fetchedActive = BF_I18N.active === BF_I18N.fallback ? {} : await bfFetchJson('locales/' + (activeInfo.file || (BF_I18N.active + '.json')), {});
    BF_I18N.dict = BF_I18N.active === BF_I18N.fallback ? BF_I18N.fallbackDict : { ...builtInActive, ...fetchedActive };
    BF_I18N.loaded = true;
    return BF_I18N;
  }
  function rt(key, vars) {
    const d = BF_I18N.dict || {}, f = BF_I18N.fallbackDict || {};
    const str = Object.prototype.hasOwnProperty.call(d, key) ? d[key] : (Object.prototype.hasOwnProperty.call(f, key) ? f[key] : key);
    if (!vars) return str;
    return String(str).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : '');
  }


  function makePublicRunLogger(workflow, options = {}) {
    if (!workflow?.publicLogEnabled || options?.silentPublicLog) {
      return { append(){}, done(){}, error(){} };
    }
    const width = Math.max(220, Math.min(520, Number(workflow.publicLogWidth || 300)));
    const opacity = Math.max(0.35, Math.min(1, Number(workflow.publicLogOpacity ?? 0.86)));
    const lines = [];
    let host = document.getElementById('bf-public-run-log');
    if (host) host.remove();
    host = document.createElement('div');
    host.id = 'bf-public-run-log';
    Object.assign(host.style, {
      all: 'initial',
      position: 'fixed',
      top: '12px',
      right: '12px',
      width: width + 'px',
      minHeight: '140px',
      maxHeight: 'calc(100vh - 24px)',
      zIndex: '2147483647',
      display: 'block',
      pointerEvents: 'auto'
    });
    const mount = document.body || document.documentElement;
    mount.appendChild(host);

    let root = host;
    try {
      root = host.attachShadow({ mode: 'open' });
    } catch (_) {
      root = host;
    }

    const html = `
      <style>
        :host{all:initial;position:fixed!important;top:12px!important;right:12px!important;width:${width}px!important;z-index:2147483647!important;display:block!important;pointer-events:auto!important;color-scheme:light dark;}
        *{box-sizing:border-box;}
        .panel{width:100%;min-height:140px;max-height:calc(100vh - 24px);display:flex;flex-direction:column;overflow:hidden;border-radius:14px;border:1px solid rgba(255,255,255,.28);background:rgba(15,23,42,${opacity});color:#f8fafc;box-shadow:0 20px 60px rgba(0,0,0,.38);font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;backdrop-filter:blur(8px);}
        .head{display:flex;gap:6px;align-items:center;padding:8px 10px;background:rgba(255,255,255,.12);border-bottom:1px solid rgba(255,255,255,.14);}
        .head b{flex:1;font:700 12px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        button{appearance:none;border:0;border-radius:8px;padding:4px 8px;font:700 11px/1 system-ui,-apple-system,Segoe UI,sans-serif;cursor:pointer;background:#dbeafe;color:#0f172a;}
        button:hover{filter:brightness(.96);}
        .title{padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.14);font:700 12px/1.25 system-ui,-apple-system,Segoe UI,sans-serif;color:#e0f2fe;word-break:break-word;}
        .body{padding:8px 10px;overflow:auto;max-height:calc(100vh - 122px);white-space:pre-wrap;word-break:break-word;scrollbar-width:thin;}
        .line{padding:4px 0;border-bottom:1px dashed rgba(255,255,255,.10);color:#f8fafc;}
        .ok{color:#bbf7d0;}
        .err{color:#fecaca;}
        .muted{color:#cbd5e1;}
        .empty{color:#cbd5e1;font-style:italic;}
      </style>
      <div class="panel" role="log" aria-live="polite">
        <div class="head"><b>${rt('publicLog.title')}</b><button type="button" data-download>${rt('publicLog.txt')}</button><button type="button" data-close>×</button></div>
        <div class="title"></div>
        <div class="body"><div class="empty">${rt('publicLog.starting')}</div></div>
      </div>`;
    root.innerHTML = html;

    const title = root.querySelector('.title');
    const body = root.querySelector('.body');
    const empty = root.querySelector('.empty');
    if (title) title.textContent = workflow.name || rt('publicLog.workflowRun');

    const append = (text, cls = '') => {
      const line = `[${new Date().toLocaleTimeString()}] ${String(text ?? '')}`;
      lines.push(line);
      if (!body) return;
      if (empty && empty.isConnected) empty.remove();
      const div = document.createElement('div');
      div.className = `line ${cls || ''}`.trim();
      div.textContent = line;
      body.appendChild(div);
      while (body.children.length > 350) body.firstElementChild?.remove();
      body.scrollTop = body.scrollHeight;
    };

    const closeBtn = root.querySelector('[data-close]');
    if (closeBtn) closeBtn.onclick = () => host.remove();
    const downloadBtn = root.querySelector('[data-download]');
    if (downloadBtn) downloadBtn.onclick = () => {
      const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${(workflow.name || 'blockflow').toLowerCase().replace(/[^a-z0-9_-]+/gi,'-')}-debug-log.txt`;
      a.style.display = 'none';
      (document.body || document.documentElement).appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    };

    append(rt('runtime.runStarted', { url: location.href }), 'muted');
    return {
      append,
      done(vars) {
        append(rt('runtime.runFinished'), 'ok');
        const keys = Object.keys(vars || {}).filter(k => /^last_|_file_name$|result|talalat|hiba|button|docx|pdf/i.test(k)).slice(0, 20);
        if (keys.length) append(rt('runtime.importantVars', { values: keys.map(k => `${k}=${String(vars[k]).slice(0,80)}`).join(' | ') }), 'muted');
        if (workflow.publicLogDownload) append(rt('publicLog.downloadHint'), 'muted');
      },
      error(err) { append(rt('runtime.errorPrefix') + ': ' + String(err?.message || err), 'err'); }
    };
  }

  function cssPath(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 6) {
      let part = node.tagName.toLowerCase();
      const classes = [...node.classList].filter(c => !String(c).startsWith('bf-')).slice(0, 3);
      if (classes.length) part += '.' + classes.map(c => CSS.escape(c)).join('.');
      const parent = node.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter(x => x.tagName === node.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      }
      parts.unshift(part);
      node = parent;
    }
    return parts.join(' > ');
  }

  function cssPathDeep(el) {
    if (!el || el.nodeType !== 1) return '';
    const parts = [];
    let node = el;
    const seen = new Set();
    while (node && node.nodeType === 1 && !seen.has(node)) {
      seen.add(node);
      parts.unshift(cssPath(node));
      const root = node.getRootNode?.();
      if (root && root.host && root.host.nodeType === 1) node = root.host;
      else break;
    }
    return parts.filter(Boolean).join(' >>> ');
  }

  function elementByShadowCss(path) {
    const parts = String(path || '').split(/\s*>>>\s*/).map(x => x.trim()).filter(Boolean);
    if (!parts.length) return null;
    let root = document;
    let current = null;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      try {
        current = root?.querySelector?.(part) || null;
      } catch (_) { current = null; }
      if (!current && root === document) current = querySelectorAllDeep(part, true, document, 1)[0] || null;
      if (!current) return null;
      if (i < parts.length - 1) root = current.shadowRoot || current;
    }
    return current && current.nodeType === 1 ? current : null;
  }

  function elementByXPath(xpath) {
    if (!xpath) return null;
    const roots = [document];
    try {
      for (const el of allElementsDeep(document, true, 20000)) {
        if (el.shadowRoot) roots.push(el.shadowRoot);
      }
    } catch (_) {}
    for (const root of roots) {
      try {
        const doc = root.ownerDocument || document;
        const res = doc.evaluate(String(xpath), root, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        if (res.singleNodeValue && res.singleNodeValue.nodeType === 1) return res.singleNodeValue;
      } catch (_) {}
    }
    return null;
  }




  function allElementsDeep(root = getSearchRoot(), includeShadow = true, limit = 20000) {
    const out = [];
    const seen = new Set();
    function add(el) {
      if (!el || el.nodeType !== 1 || seen.has(el) || out.length >= limit) return;
      seen.add(el);
      out.push(el);
      if (includeShadow && el.shadowRoot) walk(el.shadowRoot);
      if (includeShadow && el.tagName === 'SLOT' && typeof el.assignedElements === 'function') {
        for (const assigned of el.assignedElements({ flatten: true })) {
          add(assigned);
          walk(assigned);
          if (out.length >= limit) break;
        }
      }
    }
    function walk(node) {
      if (!node || out.length >= limit) return;
      if (includeShadow && node.nodeType === 1 && node.tagName === 'SLOT' && typeof node.assignedElements === 'function') {
        for (const assigned of node.assignedElements({ flatten: true })) {
          add(assigned);
          walk(assigned);
          if (out.length >= limit) break;
        }
      }
      const children = node.children ? Array.from(node.children) : [];
      for (const child of children) {
        add(child);
        walk(child);
        if (out.length >= limit) break;
      }
    }
    if (root === document) {
      add(document.documentElement);
      walk(document);
    } else {
      if (root.nodeType === 1) add(root);
      else if (root.host) add(root.host);
      walk(root);
    }
    return out;
  }

  function querySelectorAllDeep(selector, includeShadow = true, root = getSearchRoot(), limit = 5000) {
    const out = [];
    const seen = new Set();
    function addMany(scope) {
      try {
        const found = scope.querySelectorAll ? Array.from(scope.querySelectorAll(selector)) : [];
        for (const el of found) {
          if (!seen.has(el)) { seen.add(el); out.push(el); if (out.length >= limit) return; }
        }
      } catch (_) {}
    }
    addMany(root);
    if (includeShadow) {
      for (const el of allElementsDeep(root, true, limit * 3)) {
        if (el.shadowRoot) { addMany(el.shadowRoot); if (out.length >= limit) break; }
      }
    }
    return out.slice(0, limit);
  }

  function getAttrAny(el, names) {
    for (const name of names) {
      const value = el?.getAttribute?.(name);
      if (value) return value;
    }
    return '';
  }

  function getPropertyAny(el, names) {
    for (const name of names) {
      try {
        const value = el?.[name];
        if (value !== undefined && value !== null && String(value) !== '') return value;
      } catch (_) {}
    }
    return '';
  }

  function getAttrOrPropAny(el, names) {
    return getAttrAny(el, names) || getPropertyAny(el, names);
  }

  function isServiceNowHostName(hostname = location.hostname) {
    const h = String(hostname || '').toLowerCase();
    return h.includes('service-now') || h.includes('servicenow') || h.endsWith('.now.com');
  }

  function hasServiceNowDomHint() {
    try {
      if (window.NOW || window.g_form || window.NOW_UI) return true;
    } catch (_) {}
    try {
      if (document.querySelector('now-record-form,now-workspace,now-input,now-textarea,now-select,now-record-picker,sn-record-picker')) return true;
    } catch (_) {}
    return false;
  }

  function isServiceNowContext() {
    const path = String(location.pathname || '').toLowerCase();
    return isServiceNowHostName() || path.startsWith('/now/') || path.includes('/now/cwf/agent/') || hasServiceNowDomHint();
  }

  function isServiceNowFieldHost(el) {
    if (!el || el.nodeType !== 1) return false;
    const tag = el.tagName?.toLowerCase?.() || '';
    return /^(now-input|now-textarea|now-select|now-record-picker|sn-record-picker|now-rich-text-editor|now-rich-text-area|now-html-editor|now-combobox|now-dropdown)$/.test(tag);
  }

  function isServiceNowElement(el) {
    if (!el || el.nodeType !== 1) return false;
    const tag = el.tagName?.toLowerCase?.() || '';
    return tag.startsWith('now-') || tag.startsWith('sn-') || Boolean(el.closest?.('now-record-form,now-workspace,now-input,now-textarea,now-select,now-record-picker,sn-record-picker'));
  }

  function shadowHostFor(el) {
    try {
      const root = el?.getRootNode?.();
      return root && root.host && root.host.nodeType === 1 ? root.host : null;
    } catch (_) { return null; }
  }

  function snowFieldHostFor(el) {
    let node = el;
    for (let i = 0; node && i < 8; i++) {
      if (isServiceNowFieldHost(node)) return node;
      const host = shadowHostFor(node);
      if (host) { node = host; continue; }
      node = node.parentElement;
    }
    return null;
  }

  function uniqueElements(list) {
    const out = [];
    const seen = new Set();
    for (const el of list || []) {
      if (el && el.nodeType === 1 && !seen.has(el)) { seen.add(el); out.push(el); }
    }
    return out;
  }

  function fieldSelectorForChildren() {
    return 'input,textarea,select,[contenteditable],[role="textbox"],[role="combobox"],[role="searchbox"],[aria-multiline="true"],.ql-editor';
  }

  function elementTextAndAttrs(el) {
    if (!el) return '';
    const values = [
      el.innerText,
      el.textContent,
      getAttrOrPropAny(el, ['aria-label','label','data-label','data-label-text','placeholder','title','name','field','field-name','data-field','data-field-name','data-name','data-column','data-property','displayValue','display-value','value'])
    ];
    const host = shadowHostFor(el);
    if (host) values.push(elementTextAndAttrs(host));
    return values.filter(Boolean).map(v => String(v).trim()).filter(Boolean).join(' ');
  }

  function getSnowComparableAttrs(el) {
    const host = snowFieldHostFor(el) || shadowHostFor(el);
    const parent = el?.parentElement || null;
    const out = {};
    for (const attr of BF_SNOW_ATTRS) {
      const value = getAttrOrPropAny(el, [attr]) || getAttrOrPropAny(host, [attr]) || getAttrOrPropAny(parent, [attr]);
      if (value) out[attr] = String(value);
    }
    return out;
  }

  function notifySpaNavigation() {
    try { window.dispatchEvent(new CustomEvent('BF_SPA_NAVIGATION', { detail: { href: location.href } })); } catch (_) {}
  }

  (function patchSpaNavigationOnce() {
    if (window.__blockFlowSpaPatched) return;
    window.__blockFlowSpaPatched = true;
    for (const name of ['pushState','replaceState']) {
      const original = history[name];
      if (typeof original === 'function') {
        history[name] = function(...args) {
          const result = original.apply(this, args);
          setTimeout(notifySpaNavigation, 0);
          return result;
        };
      }
    }
    window.addEventListener('popstate', notifySpaNavigation, true);
    window.addEventListener('hashchange', notifySpaNavigation, true);
  })();

  function isVisible(el) {
    if (!el || el.nodeType !== 1) return false;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
  }

  function labelFor(el) {
    if (!el) return '';
    const host = snowFieldHostFor(el) || shadowHostFor(el);
    const candidates = uniqueElements([el, host, el.parentElement, host?.parentElement, el.closest?.('[aria-label],[label],[data-label],[data-label-text],[title],[placeholder]')]);
    for (const item of candidates) {
      const direct = getAttrOrPropAny(item, ['aria-label','label','data-label','data-label-text','data-field-label','placeholder','title','name','field','field-name','data-field','data-field-name','data-name']);
      if (direct) return String(direct).trim();
    }
    if (el.id) {
      try {
        const labels = querySelectorAllDeep(`label[for="${CSS.escape(el.id)}"]`, true, document, 10);
        const label = labels.find(Boolean);
        if (label) return (label.innerText || label.textContent || '').trim();
      } catch (_) {}
    }
    const wrapping = el.closest?.('label');
    if (wrapping) return (wrapping.innerText || wrapping.textContent || '').trim();
    const hostLabel = host ? (host.innerText || host.textContent || '') : '';
    if (hostLabel && hostLabel.trim().length <= 160) return hostLabel.trim();
    const nearby = (el.parentElement?.innerText || el.parentElement?.textContent || host?.parentElement?.innerText || host?.parentElement?.textContent || '').trim();
    return nearby ? nearby.slice(0, 120) : '';
  }



  function pickableElement(raw) {
    if (!raw || raw.nodeType !== 1) return raw;
    if (raw.dataset?.bfBadge || raw.dataset?.bfOverlay) return null;
    const direct = raw.closest(`button,a,${BF_FIELD_CONTROL_SELECTOR},[role="button"],[role="link"],summary,label,now-button`);
    if (direct && direct !== document.documentElement && direct !== document.body) return direct;
    let node = raw;
    while (node && node !== document.body && node !== document.documentElement) {
      const rect = node.getBoundingClientRect();
      const text = (node.innerText || node.value || '').trim();
      if (isVisible(node) && rect.width >= 8 && rect.height >= 8 && (text || node.id || node.getAttribute('aria-label') || node.getAttribute('placeholder'))) return node;
      node = node.parentElement;
    }
    return raw;
  }

  function descriptor(el) {
    const rect = el.getBoundingClientRect();
    const host = snowFieldHostFor(el) || shadowHostFor(el);
    const container = el.closest?.('[arid],[ardbn],[artype],.df,.Panel,[data-field],[data-name],[data-column],now-record-form,now-workspace') || host?.closest?.('[arid],[ardbn],[artype],.df,.Panel,[data-field],[data-name],[data-column],now-record-form,now-workspace') || host?.parentElement || el.parentElement;
    const label = labelFor(el);
    const text = (el.innerText || el.value || el.textContent || getAttrOrPropAny(el, ['aria-label','placeholder','title','label']) || getAttrOrPropAny(host, ['aria-label','placeholder','title','label']) || '').trim();
    const attrFromAny = names => getAttrAny(el, names) || getAttrAny(host, names) || getAttrAny(container, names);
    return {
      label: label || text.slice(0, 80) || el.name || el.id || host?.id || el.tagName.toLowerCase(),
      tag: el.tagName.toLowerCase(),
      hostTag: host?.tagName?.toLowerCase?.() || '',
      type: el.getAttribute('type') || '',
      id: el.id || host?.id || '',
      name: attrFromAny(['name','field','field-name']),
      role: el.getAttribute('role') || host?.getAttribute?.('role') || '',
      dataTestId: attrFromAny(['data-testid','data-test-id','data-test','data-qa','data-cy','data-component-id','component-id']),
      dataField: attrFromAny(['data-field','data-field-name','data-name','data-column','data-property','data-record-field','field','field-name','name']),
      snName: attrFromAny(['data-field','data-field-name','data-name','data-column','data-property','field','field-name','name','component-id','sys-id']),
      ariaLabel: attrFromAny(['aria-label','label','data-label','data-label-text']),
      placeholder: attrFromAny(['placeholder']),
      title: attrFromAny(['title']),
      text: text.slice(0, 220),
      href: el.getAttribute('href') || host?.getAttribute?.('href') || '',
      css: cssPath(el),
      shadowCss: cssPathDeep(el),
      xpath: xpathFor(el),
      arid: el.getAttribute('arid') || host?.getAttribute?.('arid') || container?.getAttribute?.('arid') || '',
      ardbn: el.getAttribute('ardbn') || host?.getAttribute?.('ardbn') || container?.getAttribute?.('ardbn') || '',
      artype: el.getAttribute('artype') || host?.getAttribute?.('artype') || container?.getAttribute?.('artype') || '',
      containerId: container?.id || '',
      containerArid: container?.getAttribute?.('arid') || '',
      containerArdbn: container?.getAttribute?.('ardbn') || '',
      labelFor: el.id && querySelectorAllDeep(`label[for="${CSS.escape(el.id)}"]`, true, document, 1)[0] ? el.id : '',
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
    };
  }



  function attrEq(name, value) {
    return `[${name}="${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
  }

  function candidateSelectors(d) {
    const out = [];
    if (!d) return out;
    const controls = BF_FIELD_CONTROL_SELECTOR;
    const addAttr = (attr, value, weight, tag = '') => { if (value) out.push({ selector: `${tag || ''}${attrEq(attr, value)}`, weight }); };
    if (d.shadowCss) out.push({ selector: d.shadowCss, weight: 96, shadowPath: true });
    if (d.id) {
      out.push({ selector: `#${CSS.escape(d.id)}`, weight: 86 });
      out.push({ selector: `#${CSS.escape(d.id)} ${controls}`, weight: 84 });
    }
    if (d.containerId) out.push({ selector: `#${CSS.escape(d.containerId)} ${controls}`, weight: 78 });
    if (d.ardbn) out.push({ selector: `${attrEq('ardbn', d.ardbn)} ${controls}, ${attrEq('ardbn', d.ardbn)}`, weight: 74 });
    if (d.arid) out.push({ selector: `${attrEq('arid', d.arid)} ${controls}, ${attrEq('arid', d.arid)}`, weight: 72 });
    if (d.containerArdbn) out.push({ selector: `${attrEq('ardbn', d.containerArdbn)} ${controls}`, weight: 68 });
    if (d.containerArid) out.push({ selector: `${attrEq('arid', d.containerArid)} ${controls}`, weight: 66 });
    if (d.name) {
      for (const a of ['name','field','field-name','data-field','data-field-name','data-name']) addAttr(a, d.name, 50, d.tag || '');
      for (const a of ['name','field','field-name','data-field','data-field-name','data-name']) addAttr(a, d.name, 49);
    }
    if (d.dataTestId) {
      for (const a of ['data-testid','data-test-id','data-test','data-qa','data-cy','data-component-id','component-id']) addAttr(a, d.dataTestId, 46, d.tag || '');
      for (const a of ['data-testid','data-test-id','data-test','data-qa','data-cy','data-component-id','component-id']) addAttr(a, d.dataTestId, 45);
    }
    if (d.dataField) {
      for (const a of ['data-field','data-field-name','data-name','data-column','data-property','data-record-field','field','field-name','name']) addAttr(a, d.dataField, 44, d.tag || '');
      for (const a of ['data-field','data-field-name','data-name','data-column','data-property','data-record-field','field','field-name','name']) addAttr(a, d.dataField, 43);
    }
    if (d.snName) {
      for (const a of ['data-field','data-field-name','data-name','data-column','data-property','data-record-field','field','field-name','name','component-id','sys-id']) addAttr(a, d.snName, 44);
    }
    if (d.ariaLabel) {
      for (const a of ['aria-label','label','data-label','data-label-text']) addAttr(a, d.ariaLabel, 42, d.tag || '');
      for (const a of ['aria-label','label','data-label','data-label-text']) addAttr(a, d.ariaLabel, 41);
    }
    if (d.placeholder) { addAttr('placeholder', d.placeholder, 35, d.tag || ''); addAttr('placeholder', d.placeholder, 34); }
    if (d.title) { addAttr('title', d.title, 30, d.tag || ''); addAttr('title', d.title, 29); }
    if (d.css) out.push({ selector: d.css, weight: 20 });
    return out.filter(x => x.selector);
  }



  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function fieldControlIn(el) {
    if (!el || el.nodeType !== 1) return null;
    if (isServiceNowFieldHost(el)) {
      const inner = querySelectorAllDeep(fieldSelectorForChildren(), true, el.shadowRoot || el, 8).find(x => x !== el);
      return inner || el;
    }
    const host = snowFieldHostFor(el);
    if (host && host !== el) {
      const inner = querySelectorAllDeep(fieldSelectorForChildren(), true, host.shadowRoot || host, 8).find(x => x !== host) || el;
      return inner;
    }
    if (el.matches?.(BF_FIELD_CONTROL_SELECTOR)) return el;
    return querySelectorAllDeep(BF_FIELD_CONTROL_SELECTOR, true, el, 8)[0] || el;
  }



  function scoreElement(el, d, base = 0, options = {}) {
    if (!el || !d) return -999;
    const requireVisible = options.requireVisible !== false;
    if (requireVisible && !isVisible(el) && !isVisible(snowFieldHostFor(el))) return -999;
    let score = base;
    const control = fieldControlIn(el) || el;
    const container = control.closest('[arid],[ardbn],[artype],.df,.Panel') || el.closest('[arid],[ardbn],[artype],.df,.Panel') || el;
    if (d.tag && control.tagName?.toLowerCase() === d.tag) score += 10;
    if (d.type && control.getAttribute('type') === d.type) score += 8;
    if (d.name && control.getAttribute('name') === d.name) score += 25;
    if (d.id && control.id === d.id) score += 45;
    if (d.containerId && container.id === d.containerId) score += 38;
    if (d.arid && (control.getAttribute('arid') === d.arid || container.getAttribute('arid') === d.arid)) score += 34;
    if (d.ardbn && (control.getAttribute('ardbn') === d.ardbn || container.getAttribute('ardbn') === d.ardbn)) score += 34;
    if (d.containerArid && container.getAttribute('arid') === d.containerArid) score += 28;
    if (d.containerArdbn && container.getAttribute('ardbn') === d.containerArdbn) score += 28;
    if (d.ariaLabel && control.getAttribute('aria-label') === d.ariaLabel) score += 20;
    if (d.placeholder && control.getAttribute('placeholder') === d.placeholder) score += 20;
    if (d.title && control.getAttribute('title') === d.title) score += 14;
    const snowAttrs = getSnowComparableAttrs(control);
    if (d.dataField && Object.values(snowAttrs).includes(String(d.dataField))) score += 24;
    if (d.snName && Object.values(snowAttrs).includes(String(d.snName))) score += 24;
    if (d.dataTestId && Object.values(snowAttrs).includes(String(d.dataTestId))) score += 18;
    if (d.hostTag && (snowFieldHostFor(control)?.tagName?.toLowerCase?.() === d.hostTag || control.tagName?.toLowerCase?.() === d.hostTag)) score += 12;
    const t = normalizeText(elementTextAndAttrs(control));
    const dt = normalizeText(d.text || '');
    if (dt && t) {
      if (t === dt) score += 24;
      else if (t.includes(dt.slice(0, 80)) || dt.includes(t.slice(0, 80))) score += 12;
    }
    const lab = normalizeText(labelFor(control) || labelFor(container));
    const dl = normalizeText(d.label || '');
    if (lab && dl) {
      if (lab === dl) score += 30;
      else if (lab.includes(dl) || dl.includes(lab)) score += 18;
    }
    if (d.rect && (isVisible(control) || isVisible(snowFieldHostFor(control)))) {
      const r = control.getBoundingClientRect();
      const dist = Math.abs(r.x - d.rect.x) + Math.abs(r.y - d.rect.y);
      if (dist < 50) score += 8;
      else if (dist < 160) score += 3;
    }
    if (!isVisible(control) && !isVisible(snowFieldHostFor(control))) score -= 3;
    return score;
  }

  function controlsNearLabel(labelEl) {
    const out = [];
    const forId = labelEl.getAttribute?.('for');
    if (forId) {
      try { out.push(...querySelectorAllDeep(`#${CSS.escape(forId)}`, true, document, 5)); } catch (_) {}
    }
    if (isServiceNowFieldHost(labelEl)) out.push(labelEl);
    const container = labelEl.closest?.('[arid],[ardbn],[artype],.df,.Panel,[data-field],[data-name],[data-column],now-record-form,now-workspace,div,td,li,section') || labelEl.parentElement || shadowHostFor(labelEl)?.parentElement;
    if (container) out.push(...querySelectorAllDeep(BF_FIELD_CONTROL_SELECTOR, true, container, 80));
    const host = shadowHostFor(labelEl);
    if (host) out.push(...querySelectorAllDeep(BF_FIELD_CONTROL_SELECTOR, true, host, 80));
    let sib = labelEl.nextElementSibling;
    for (let i = 0; sib && i < 6; i++, sib = sib.nextElementSibling) {
      if (sib.matches?.(BF_FIELD_CONTROL_SELECTOR)) out.push(sib);
      out.push(...querySelectorAllDeep(BF_FIELD_CONTROL_SELECTOR, true, sib, 80));
    }
    return uniqueElements(out).map(fieldControlIn).filter(Boolean);
  }



  function findElement(target, options = {}) {
    if (!target) return null;
    const requireVisible = options.requireVisible !== false;
    if (target?.shadowCss) {
      const sh = elementByShadowCss(target.shadowCss);
      if (sh && (!requireVisible || isVisible(sh) || isVisible(snowFieldHostFor(sh)))) return fieldControlIn(sh) || sh;
    }
    if (target?.xpath) { const xel = elementByXPath(target.xpath); if (xel && (!requireVisible || isVisible(xel) || isVisible(snowFieldHostFor(xel)))) return fieldControlIn(xel) || xel; }
    const requireClickable = Boolean(options.requireClickable);
    let best = null;
    let bestScore = -999;
    for (const c of candidateSelectors(target)) {
      try {
        const rawEls = c.shadowPath ? [elementByShadowCss(c.selector)].filter(Boolean) : querySelectorAllDeep(c.selector, options.shadowSearch !== false, document, 80);
        for (const raw of rawEls) {
          const el = fieldControlIn(raw);
          const score = scoreElement(el, target, c.weight, { requireVisible });
          if (score > bestScore) { best = el; bestScore = score; }
        }
      } catch (_) {}
    }
    if (target?.label) {
      const needle = normalizeText(target.label).slice(0, 120);
      const labels = querySelectorAllDeep('label,[aria-label],[label],[data-label],[data-label-text],[title],[placeholder],[data-field],[data-field-name],[data-name],[data-column],[data-testid],[data-test-id],now-input,now-textarea,now-select,now-record-picker,sn-record-picker', options.shadowSearch !== false, document, 6000);
      for (const lab of labels) {
        const txt = normalizeText(elementTextAndAttrs(lab));
        if (needle && (txt === needle || txt.includes(needle) || needle.includes(txt))) {
          for (const el of controlsNearLabel(lab)) {
            const score = scoreElement(el, target, 28, { requireVisible });
            if (score > bestScore) { best = el; bestScore = score; }
          }
        }
      }
    }
    if (target?.text || target?.label) {
      const needle = normalizeText(target.text || target.label || '').slice(0, 100);
      const poolSelector = `button,a,${BF_FIELD_CONTROL_SELECTOR},[role="button"],[role="link"],label,div,span,now-button`;
      let all = querySelectorAllDeep(poolSelector, options.shadowSearch !== false, document, 8000);
      if (requireVisible) all = all.filter(el => isVisible(el) || isVisible(snowFieldHostFor(el)));
      for (const raw of all) {
        const el = fieldControlIn(raw);
        const hay = normalizeText(elementTextAndAttrs(el) || labelFor(el));
        if (needle && hay.includes(needle)) {
          const score = scoreElement(el, target, 18, { requireVisible });
          if (score > bestScore) { best = el; bestScore = score; }
        }
      }
    }
    const threshold = isServiceNowContext() ? (requireVisible ? 14 : 10) : (requireVisible ? 20 : 15);
    if (requireClickable && best) return closestClickable(best) || best;
    return bestScore >= threshold ? best : null;
  }



  function showBadge(text) {
    removeBadge();
    const badge = document.createElement('div');
    badge.className = 'bf-picker-badge';
    badge.dataset.bfBadge = '1';
    badge.textContent = text;
    document.documentElement.appendChild(badge);
  }
  function removeBadge() { document.querySelectorAll('[data-bf-badge="1"]').forEach(x => x.remove()); }

  function shouldShowTriggerStartBadge(workflow) {
    return workflow?.triggerStartBadgeEnabled !== false;
  }

  function startPicker(context) {
    stopPicker();
    showBadge(rt('runtime.pickerActive'));
    const overlay = document.createElement('div');
    overlay.dataset.bfOverlay = '1';
    overlay.className = 'bf-picker-overlay-box';
    overlay.style.display = 'none';
    document.documentElement.appendChild(overlay);
    picker = { hovered: null, overlay, context };

    const placeOverlay = el => {
      if (!el || !picker?.overlay) return;
      const r = el.getBoundingClientRect();
      Object.assign(picker.overlay.style, {
        display: 'block',
        left: `${Math.max(0, r.left)}px`,
        top: `${Math.max(0, r.top)}px`,
        width: `${Math.max(1, r.width)}px`,
        height: `${Math.max(1, r.height)}px`
      });
    };

    const mark = raw => {
      const el = pickableElement(raw);
      if (!el || el === document.documentElement || el === document.body) return;
      if (picker.hovered && picker.hovered !== el) picker.hovered.classList.remove('bf-hover-outline');
      picker.hovered = el;
      el.classList.add('bf-hover-outline');
      placeOverlay(el);
    };

    const pointer = ev => {
      const raw = document.elementFromPoint(ev.clientX, ev.clientY) || ev.target;
      mark(raw);
    };
    const click = ev => {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      const raw = document.elementFromPoint(ev.clientX, ev.clientY) || ev.target;
      const chosen = picker.hovered || pickableElement(raw) || raw;
      if (chosen?.classList) chosen.classList.remove('bf-hover-outline');
      const picked = descriptor(chosen);
      stopPicker();
      chrome.runtime.sendMessage({ type: 'BF_ELEMENT_PICKED', context, element: picked });
    };
    const key = ev => { if (ev.key === 'Escape') stopPicker(); };
    picker.listeners = { pointer, click, key };
    document.addEventListener('pointerover', pointer, true);
    document.addEventListener('pointermove', pointer, true);
    document.addEventListener('mousemove', pointer, true);
    document.addEventListener('click', click, true);
    document.addEventListener('mousedown', click, true);
    document.addEventListener('keydown', key, true);
  }

  function stopPicker() {
    if (!picker) return;
    if (picker.hovered) picker.hovered.classList.remove('bf-hover-outline');
    if (picker.overlay) picker.overlay.remove();
    const { pointer, click, key } = picker.listeners || {};
    document.removeEventListener('pointerover', pointer, true);
    document.removeEventListener('pointermove', pointer, true);
    document.removeEventListener('mousemove', pointer, true);
    document.removeEventListener('click', click, true);
    document.removeEventListener('mousedown', click, true);
    document.removeEventListener('keydown', key, true);
    picker = null;
    removeBadge();
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));


  function isScrollable(el) {
    if (!el || el === document || el === document.documentElement || el === document.body) return false;
    try {
      const st = getComputedStyle(el);
      const oy = st.overflowY || st.overflow;
      const ox = st.overflowX || st.overflow;
      return /(auto|scroll|overlay)/.test(`${oy} ${ox}`) && (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2);
    } catch (_) { return false; }
  }

  function scrollableParent(el) {
    let n = el?.parentElement;
    while (n && n !== document.body && n !== document.documentElement) {
      if (isScrollable(n)) return n;
      n = n.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  }

  function resolveScrollContainer(block, targetEl) {
    const mode = block?.scrollTarget || 'auto';
    if (mode === 'page') return document.scrollingElement || document.documentElement;
    if (mode === 'container' && block.scrollContainer) return findElement(block.scrollContainer, { requireVisible: false, shadowSearch: block.shadowSearch !== false }) || scrollableParent(targetEl);
    if (mode === 'nearest' || mode === 'auto') return scrollableParent(targetEl);
    return document.scrollingElement || document.documentElement;
  }

  async function scrollElementIntoViewSmart(el, opts = {}) {
    if (!el) return false;
    const container = resolveScrollContainer(opts.block || {}, el);
    const align = opts.align || opts.block?.align || 'center';
    try {
      if (!container || container === document.scrollingElement || container === document.documentElement || container === document.body) {
        el.scrollIntoView({ block: align === 'top' ? 'start' : align === 'bottom' ? 'end' : 'center', inline: 'nearest', behavior: opts.behavior || 'smooth' });
      } else {
        const cr = container.getBoundingClientRect();
        const er = el.getBoundingClientRect();
        let delta = er.top - cr.top;
        if (align === 'center') delta -= (cr.height / 2) - (er.height / 2);
        if (align === 'bottom') delta -= cr.height - er.height;
        container.scrollTop += delta;
      }
      await sleep(Number(opts.delayMs || 120));
      return true;
    } catch (_) {
      try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {}
      return false;
    }
  }


  function allScrollableContainers(root = document) {
    const list = [];
    try {
      const docScroller = document.scrollingElement || document.documentElement;
      if (docScroller) list.push(docScroller);
      const els = allElementsDeep(root, true, 16000);
      for (const el of els) {
        if (isScrollable(el)) list.push(el);
      }
    } catch (_) {}
    return Array.from(new Set(list)).sort((a, b) => {
      const ar = a === document.scrollingElement || a === document.documentElement ? { width: innerWidth, height: innerHeight } : a.getBoundingClientRect();
      const br = b === document.scrollingElement || b === document.documentElement ? { width: innerWidth, height: innerHeight } : b.getBoundingClientRect();
      return (br.width * br.height) - (ar.width * ar.height);
    });
  }

  function resolveSearchScrollContainers(block = {}) {
    const mode = block.scrollTarget || 'auto';
    if (mode === 'container' && block.scrollContainer) {
      const el = findElement(block.scrollContainer, { requireVisible: false, shadowSearch: block.shadowSearch !== false });
      if (el) return [el];
    }
    if (mode === 'page') return [document.scrollingElement || document.documentElement];
    const all = allScrollableContainers(document);
    if (mode === 'nearest') return all.filter(el => el !== document.scrollingElement && el !== document.documentElement).concat(all.filter(el => el === document.scrollingElement || el === document.documentElement)).slice(0, 8);
    return all.slice(0, 10);
  }

  function getScrollPos(scroller) {
    if (!scroller || scroller === document.scrollingElement || scroller === document.documentElement || scroller === document.body) return window.scrollY || document.documentElement.scrollTop || 0;
    return scroller.scrollTop || 0;
  }

  function getMaxScroll(scroller) {
    if (!scroller || scroller === document.scrollingElement || scroller === document.documentElement || scroller === document.body) return Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - innerHeight;
    return Math.max(0, scroller.scrollHeight - scroller.clientHeight);
  }

  function scrollContainerBy(scroller, amount) {
    if (!scroller || scroller === document.scrollingElement || scroller === document.documentElement || scroller === document.body) {
      window.scrollBy(0, amount);
      return;
    }
    scroller.scrollTop += amount;
  }

  async function scanWithScrolling(findFn, block = {}) {
    let hits = findFn();
    if (hits && hits.length) return hits;
    if (!block.scrollSearch && !block.virtualSearch && block.direction !== 'untilText') return hits || [];
    const containers = resolveSearchScrollContainers(block);
    const maxScrolls = Math.max(1, Number(block.maxScrolls || 25));
    const amount = Math.max(80, Number(block.scrollAmount || block.amount || 700));
    const delay = Math.max(50, Number(block.scrollDelayMs || 250));
    const visited = new Set();
    for (const scroller of containers) {
      let noMoveCount = 0;
      for (let i = 0; i < maxScrolls; i++) {
        const before = getScrollPos(scroller);
        const max = getMaxScroll(scroller);
        const key = `${containers.indexOf(scroller)}:${Math.round(before)}:${Math.round(max)}`;
        if (visited.has(key)) break;
        visited.add(key);
        if (max <= 0 || before >= max - 2) break;
        scrollContainerBy(scroller, amount);
        await sleep(delay);
        hits = findFn();
        if (hits && hits.length) return hits;
        const after = getScrollPos(scroller);
        if (Math.abs(after - before) < 2) noMoveCount++; else noMoveCount = 0;
        if (noMoveCount >= 2) break;
      }
    }
    return hits || [];
  }

  function closestClickable(el) {
    return el?.closest?.('button,a,now-button,[role="button"],[role="link"],input[type="button"],input[type="submit"],summary,label,[tabindex]') || shadowHostFor(el)?.closest?.('button,a,now-button,[role="button"],[role="link"],[tabindex]') || el;
  }

  function closestRow(el) {
    return el?.closest?.('tr,[role="row"],li,.row,[class*="row"],[data-row-id],[data-list-item]') || null;
  }

  function closestPanel(el) {
    return el?.closest?.('[role="dialog"],[role="tabpanel"],[role="region"],section,article,.card,.panel,.modal,.workspace,[class*="panel"],[class*="card"]') || null;
  }

  function firstNearbyButton(el) {
    const row = closestRow(el);
    const base = row || closestPanel(el) || el?.parentElement;
    if (!base) return null;
    return querySelectorAllDeep('button,a,now-button,[role="button"],[role="link"],input[type="button"],input[type="submit"]', true, base, 20)[0] || null;
  }

  function spinnerCandidates(selector = '') {
    const custom = selector ? querySelectorAllDeep(selector, true, getSearchRoot(), 200) : [];
    const generic = querySelectorAllDeep('[role="progressbar"],[aria-busy="true"],.spinner,.loading,.loader,.progress,.skeleton,[class*="spinner"],[class*="loading"],[class*="loader"],[class*="skeleton"]', true, getSearchRoot(), 1000);
    return [...new Set([...custom, ...generic])].filter(isVisible);
  }

  async function waitDomStable(stableMs = 800, timeoutMs = 10000) {
    return await new Promise(resolve => {
      let timer = null;
      const doneAt = Date.now() + Number(timeoutMs || 10000);
      const obs = new MutationObserver(() => reset());
      function finish(ok) { try { obs.disconnect(); } catch (_) {} clearTimeout(timer); resolve(ok); }
      function reset() {
        clearTimeout(timer);
        if (Date.now() > doneAt) return finish(false);
        timer = setTimeout(() => finish(true), Number(stableMs || 800));
      }
      try { obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true }); } catch (_) { return resolve(true); }
      reset();
      setTimeout(() => finish(false), Number(timeoutMs || 10000));
    });
  }

  async function waitForLoadBlock(block, vars = {}) {
    const mode = block.loadMode || 'auto';
    const timeout = Number(block.timeoutMs || 15000);
    const stableMs = Number(block.stableMs || 800);
    const start = Date.now();
    async function waitReady() {
      while (Date.now() - start < timeout) {
        if (document.readyState === 'complete' || document.readyState === 'interactive') return true;
        await sleep(100);
      }
      return false;
    }
    async function waitSpinnersGone() {
      while (Date.now() - start < timeout) {
        if (spinnerCandidates(block.spinnerSelector || '').length === 0) return true;
        await sleep(150);
      }
      return false;
    }
    async function waitElement(kind) {
      while (Date.now() - start < timeout) {
        const el = findElement(block.target, { requireVisible: true, shadowSearch: block.shadowSearch !== false });
        if (kind === 'visible' && el) return true;
        if (kind === 'clickable' && el && closestClickable(el)) return true;
        await sleep(150);
      }
      return false;
    }
    let ok = false;
    if (mode === 'pageReady') ok = await waitReady();
    else if (mode === 'domStable') ok = await waitDomStable(stableMs, timeout);
    else if (mode === 'spinnerGone') ok = await waitSpinnersGone();
    else if (mode === 'elementVisible') ok = await waitElement('visible');
    else if (mode === 'elementClickable') ok = await waitElement('clickable');
    else {
      await waitReady();
      await waitSpinnersGone();
      const remain = Math.max(250, timeout - (Date.now() - start));
      ok = await waitDomStable(stableMs, remain);
      if (!ok && Date.now() - start < timeout) ok = spinnerCandidates(block.spinnerSelector || '').length === 0;
    }
    return ok;
  }

  async function waitForElement(target, timeoutMs = 5000, options = {}) {
    const start = Date.now();
    const minWait = Math.max(150, Number(timeoutMs || 0));
    while (Date.now() - start < minWait) {
      if (stopRequested) throw new Error(rt('runtime.runStopped'));
      const el = findElement(target, options);
      if (el) return el;
      await sleep(150);
    }
    return findElement(target, options);
  }

  function getElementActualFieldValue(el) {
    if (!el) return '';
    const host = isServiceNowFieldHost(el) ? el : snowFieldHostFor(el);
    if (host && host === el) {
      const inner = querySelectorAllDeep(fieldSelectorForChildren(), true, host.shadowRoot || host, 8).find(x => x !== host);
      if (inner) return getElementActualFieldValue(inner);
      const hostValue = getPropertyAny(host, ['value','displayValue','selectedValue','text']) || getAttrAny(host, ['value','display-value','selected-value']);
      return hostValue === undefined || hostValue === null ? '' : String(hostValue).trim();
    }
    const tag = el.tagName?.toLowerCase();
    if (tag === 'select') {
      const opt = el.selectedOptions?.[0];
      return (opt?.value || opt?.textContent || el.value || '').trim();
    }
    if (tag === 'input') {
      const type = String(el.getAttribute('type') || '').toLowerCase();
      if (['checkbox','radio'].includes(type)) return el.checked ? String(el.value || 'true') : '';
      return String(el.value ?? '').trim();
    }
    if (tag === 'textarea') return String(el.value ?? '').trim();
    if (el.isContentEditable || el.getAttribute?.('contenteditable') != null || el.classList?.contains('ql-editor')) return (el.innerText || el.textContent || '').trim();
    const role = el.getAttribute?.('role') || '';
    if (['textbox','combobox','searchbox'].includes(role)) return String(el.value || el.getAttribute('aria-valuetext') || el.innerText || el.textContent || '').trim();
    if ('value' in el) return String(el.value ?? '').trim();
    return (el.innerText || el.textContent || '').trim();
  }

  function getElementValue(el, mode = 'auto', attributeName = 'title') {
    if (!el) return '';
    const host = isServiceNowFieldHost(el) ? el : snowFieldHostFor(el);
    if (host && host === el && mode === 'auto') {
      const inner = querySelectorAllDeep(fieldSelectorForChildren(), true, host.shadowRoot || host, 8).find(x => x !== host);
      if (inner) return getElementValue(inner, mode, attributeName);
      const hostValue = getAttrOrPropAny(host, ['value','displayValue','display-value','selectedValue','selected-value','text','label','aria-label','title']);
      if (hostValue) return String(hostValue).trim();
    }
    const tag = el.tagName?.toLowerCase();
    if (mode === 'html') return el.innerHTML || '';
    if (mode === 'attribute') return el.getAttribute(attributeName || 'title') || '';
    if (mode === 'text') return (el.innerText || el.textContent || el.value || el.getAttribute('title') || '').trim();
    if (tag === 'select') {
      const opt = el.selectedOptions?.[0];
      return (opt?.textContent || opt?.value || el.value || '').trim();
    }
    if (tag === 'input') {
      const type = String(el.getAttribute('type') || '').toLowerCase();
      if (['checkbox','radio'].includes(type)) return el.checked ? (el.value || 'true') : 'false';
      return el.value || el.getAttribute('value') || el.getAttribute('title') || el.getAttribute('aria-label') || '';
    }
    if (tag === 'textarea') return el.value || el.textContent || el.getAttribute('title') || el.getAttribute('aria-label') || '';
    if (el.isContentEditable || el.getAttribute?.('contenteditable') != null || el.classList?.contains('ql-editor')) return (el.innerText || el.textContent || '').trim();
    const role = el.getAttribute('role') || '';
    if (['textbox','combobox','searchbox'].includes(role)) return (el.value || el.getAttribute('aria-valuetext') || el.getAttribute('aria-label') || el.innerText || el.textContent || '').trim();
    return (el.value || el.innerText || el.textContent || el.getAttribute('title') || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim();
  }

  function valueSetterFor(el) {
    const tag = el?.tagName?.toLowerCase?.();
    const preferred = tag === 'textarea' ? HTMLTextAreaElement.prototype : tag === 'select' ? HTMLSelectElement.prototype : tag === 'input' ? HTMLInputElement.prototype : null;
    if (preferred) {
      const desc = Object.getOwnPropertyDescriptor(preferred, 'value');
      if (desc?.set) return desc.set;
    }
    let proto = el ? Object.getPrototypeOf(el) : null;
    while (proto) {
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc?.set) return desc.set;
      proto = Object.getPrototypeOf(proto);
    }
    return null;
  }

  function setNativeValue(el, value) {
    if (!el) return;
    const tag = el.tagName?.toLowerCase();
    if (el.isContentEditable || el.getAttribute?.('contenteditable') != null || el.classList?.contains('ql-editor')) {
      el.textContent = String(value ?? '');
      return;
    }
    const setter = valueSetterFor(el);
    if (setter && 'value' in el) {
      try { setter.call(el, value); return; } catch (_) {}
    }
    if ('value' in el) el.value = value;
    else if ('text' in el) { try { el.text = value; } catch (_) { el.textContent = value; } }
    else el.textContent = value;
  }

  function dispatchBeforeInput(el, value = '') {
    if (!el) return;
    try { el.dispatchEvent(new InputEvent('beforeinput', { data: String(value), inputType: 'insertText', bubbles: true, composed: true, cancelable: true })); }
    catch (_) { el.dispatchEvent(new Event('beforeinput', { bubbles: true, composed: true, cancelable: true })); }
  }

  function dispatchFrameworkEvents(el, opts = {}) {
    dispatchBeforeInput(el, opts.data || '');
    el.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    el.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, composed: true, key: opts.key || '' }));
    if (opts.blurAfter !== false) { try { el.blur(); } catch (_) {} el.dispatchEvent(new Event('blur', { bubbles: true, composed: true })); }
  }

  async function simulatedType(el, value, delayMs = 25) {
    el.focus();
    setNativeValue(el, '');
    dispatchFrameworkEvents(el, { blurAfter: false });
    for (const ch of String(value)) {
      el.dispatchEvent(new KeyboardEvent('keydown', { key: ch, bubbles: true, composed: true }));
      dispatchBeforeInput(el, ch);
      setNativeValue(el, (el.value || el.textContent || '') + ch);
      el.dispatchEvent(new InputEvent('input', { data: ch, inputType: 'insertText', bubbles: true, composed: true }));
      el.dispatchEvent(new KeyboardEvent('keyup', { key: ch, bubbles: true, composed: true }));
      if (delayMs > 0) await sleep(delayMs);
    }
    dispatchFrameworkEvents(el);
  }

  function fieldWriteTargets(el) {
    const host = isServiceNowFieldHost(el) ? el : snowFieldHostFor(el);
    const inner = host ? querySelectorAllDeep(fieldSelectorForChildren(), true, host.shadowRoot || host, 12).find(x => x !== host) : null;
    return uniqueElements([inner, el, host].filter(Boolean));
  }

  function setHostServiceNowValue(host, value) {
    if (!host || !isServiceNowFieldHost(host)) return;
    for (const prop of ['value','displayValue','selectedValue','text']) {
      try { if (prop in host) host[prop] = value; } catch (_) {}
    }
    for (const attr of ['value','display-value','selected-value']) {
      try { host.setAttribute(attr, String(value ?? '')); } catch (_) {}
    }
  }

  async function setServiceNowElementValueCompat(el, value, block = {}) {
    const targets = fieldWriteTargets(el);
    const primary = targets.find(t => ['input','textarea','select'].includes(t.tagName?.toLowerCase?.())) || targets.find(t => t.isContentEditable || t.getAttribute?.('contenteditable') != null || ['textbox','combobox','searchbox'].includes(t.getAttribute?.('role') || '')) || targets[0] || el;
    const host = targets.find(isServiceNowFieldHost) || snowFieldHostFor(primary);
    try { primary.focus(); } catch (_) { try { host?.focus(); } catch (_) {} }
    for (const t of targets) dispatchBeforeInput(t, value);
    const tag = primary.tagName?.toLowerCase();
    if (tag === 'select') {
      const text = String(value);
      const opt = Array.from(primary.options || []).find(o => o.value === text || (o.textContent || '').trim() === text);
      if (opt) primary.value = opt.value; else setNativeValue(primary, value);
    } else if (primary.getAttribute?.('type') === 'checkbox') {
      primary.checked = ['true','1','yes','igen','on'].includes(String(value).toLowerCase());
    } else if (primary.getAttribute?.('type') === 'radio') {
      primary.checked = true;
    } else {
      setNativeValue(primary, value);
    }
    setHostServiceNowValue(host, value);
    for (const t of targets) dispatchFrameworkEvents(t, { blurAfter: false, data: value });
    if (block.blurAfter !== false) { try { primary.blur(); } catch (_) {} try { host?.blur?.(); } catch (_) {} }
  }

  async function setElementValueCompat(el, value, block = {}) {
    const mode = block.fillMode || 'framework';
    const snowCompat = isServiceNowContext() || isServiceNowElement(el) || Boolean(snowFieldHostFor(el));
    if (snowCompat && mode !== 'typing' && mode !== 'paste') {
      await setServiceNowElementValueCompat(el, value, block);
      return;
    }
    el.focus();
    if (mode === 'typing') { await simulatedType(el, value, Number(block.typeDelayMs || 25)); return; }
    if (mode === 'paste') {
      dispatchBeforeInput(el, value);
      setNativeValue(el, value);
      el.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, composed: true, clipboardData: new DataTransfer() }));
      dispatchFrameworkEvents(el, { blurAfter: block.blurAfter !== false, data: value });
      return;
    }
    dispatchBeforeInput(el, value);
    if (el.tagName?.toLowerCase() === 'select') {
      const text = String(value);
      const opt = Array.from(el.options || []).find(o => o.value === text || (o.textContent || '').trim() === text);
      if (opt) el.value = opt.value; else setNativeValue(el, value);
    } else if (el.getAttribute('type') === 'checkbox') {
      el.checked = ['true','1','yes','igen','on'].includes(String(value).toLowerCase());
    } else if (el.getAttribute('type') === 'radio') {
      el.checked = true;
    } else {
      if (mode === 'simple') { if ('value' in el) el.value = value; else el.textContent = value; }
      else setNativeValue(el, value);
    }
    if (mode !== 'simple') dispatchFrameworkEvents(el, { blurAfter: block.blurAfter !== false, data: value });
    else el.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }

  function shouldSoftFailMissingField(block) {
    return isServiceNowContext() && ['fill','selectOption','extract','fieldByLabel'].includes(String(block?.type || ''));
  }



  async function waitForText(text, timeoutMs = 5000, caseSensitive = false) {
    const start = Date.now();
    const needle = caseSensitive ? String(text || '') : String(text || '').toLowerCase();
    while (Date.now() - start < timeoutMs) {
      if (stopRequested) throw new Error(rt('runtime.runStopped'));
      const hay = caseSensitive ? document.body.innerText : document.body.innerText.toLowerCase();
      if (needle && hay.includes(needle)) return true;
      await sleep(150);
    }
    return false;
  }

  function interpolate(input, vars) {
    return String(input || '').replace(/{{\s*([\w.-]+)\s*}}/g, (_, key) => vars[key] ?? '');
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[ch]));
  }

  function descriptorFromVars(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (raw.startsWith('{')) { try { return JSON.parse(raw); } catch (_) {} }
    if (raw.startsWith('/') || raw.startsWith('(')) return { xpath: raw, label: rt('runtime.xpathVariable') };
    return { css: raw, label: rt('runtime.selectorVariable') };
  }

  function targetForBlock(block, vars = {}) {
    const mode = block.targetMode || 'manual';
    if (mode === 'manual') return block.target;
    if (mode === 'last') return descriptorFromVars(vars.last_element) || descriptorFromVars(vars[block.targetVar || 'szoveg_talalat_elem']) || descriptorFromVars(vars.last_selector) || descriptorFromVars(vars.last_xpath) || block.target;
    if (mode === 'var') return descriptorFromVars(vars[block.targetVar || 'last_element']) || block.target;
    if (mode === 'selector') return descriptorFromVars(vars[block.targetVar || 'szoveg_talalat_selector']) || block.target;
    if (mode === 'xpath') return descriptorFromVars(vars[block.targetVar || 'szoveg_talalat_xpath']) || block.target;
    return block.target;
  }

  function updateLastOutput(vars, block, res = {}) {
    if (!vars || !block) return;
    if (res.value !== undefined) { vars.last_result = res.value; vars.last_value = res.value; if (typeof res.value === 'string') vars.last_text = res.value; }
    if (block.type === 'extract') { const name = block.varName || 'adat'; vars.last_result = vars[name] || ''; vars.last_value = vars[name] || ''; vars.last_text = vars[name] || ''; }
    if (block.type === 'textSearch') {
      const elementName = block.elementName || 'szoveg_talalat_elem';
      vars.last_result = vars[block.resultName || 'szoveg_talalat'];
      vars.last_text = vars[block.contextName || 'szoveg_talalat_szoveg'] || '';
      vars.last_selector = vars[block.selectorName || 'szoveg_talalat_selector'] || '';
      vars.last_xpath = vars[block.xpathName || 'szoveg_talalat_xpath'] || '';
      vars.last_element = vars[elementName] || '';
    }
    if (block.type === 'fieldByLabel') {
      vars.last_result = vars[block.resultName || 'mezo_ertek'] || '';
      vars.last_value = vars.last_result;
      vars.last_text = vars.last_result;
      vars.last_selector = vars[block.selectorName || 'mezo_selector'] || '';
      vars.last_xpath = vars[block.xpathName || 'mezo_xpath'] || '';
      vars.last_element = vars[block.elementName || 'mezo_elem'] || '';
    }
    if (block.type === 'screenshot') { const name = block.resultName || 'screenshot_data_url'; vars.last_screenshot = vars[name] || vars.last_screenshot || ''; vars.last_result = vars.last_screenshot; }
    if (block.type === 'findElements') { vars.last_result = vars[block.countName || 'talalat_db'] || ''; }
    if (block.type === 'errorSearch') { vars.last_result = vars[block.resultName || 'hiba_van'] || ''; vars.last_text = vars[block.textName || 'hiba_szoveg'] || ''; vars.last_selector = vars[block.selectorName || 'hiba_selector'] || ''; }
    if (block.type === 'fieldByLabel') { vars.last_result = vars[block.resultName || 'mezo_ertek'] || ''; vars.last_value = vars.last_result; vars.last_text = vars.last_result; vars.last_selector = vars[block.selectorName || 'mezo_selector'] || ''; vars.last_xpath = vars[block.xpathName || 'mezo_xpath'] || ''; vars.last_element = vars[block.elementName || 'mezo_elem'] || ''; }
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(String(text || ''));
    } catch (_) {
      const ta = document.createElement('textarea');
      ta.value = String(text || '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      try { document.execCommand('copy'); } finally { ta.remove(); }
    }
  }


  async function readClipboardTextSafe() {
    // Clipboard reading is stricter than writing on many pages. Try the modern
    // Clipboard API first, then the legacy paste command, then fall back to an
    // extension-owned focused helper window. The helper avoids page-level
    // restrictions that can affect content scripts even with clipboardRead.
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (typeof text === 'string') return text;
      }
    } catch (_) {}

    try {
      const ta = document.createElement('textarea');
      ta.setAttribute('aria-hidden', 'true');
      ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;';
      document.documentElement.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand('paste');
      const text = ta.value || '';
      ta.remove();
      if (ok || text) return text;
    } catch (_) {}

    const response = await safeRuntimeSend({ type: 'BF_CLIPBOARD_READ' });
    if (response?.ok) return String(response.text || '');
    throw new Error(response?.error || rt('runtime.clipboardReadFailed'));
  }

  function findPopup() {
    const explicit = [...document.querySelectorAll('[role="dialog"],[aria-modal="true"],dialog,.modal,.popup,[class*="modal"],[class*="popup"]')].filter(isVisible);
    if (explicit.length) return explicit.sort((a, b) => area(b) - area(a))[0];
    const fixed = [...document.querySelectorAll('body *')].filter(el => {
      if (!isVisible(el)) return false;
      const s = getComputedStyle(el);
      const z = Number(s.zIndex || 0);
      const r = el.getBoundingClientRect();
      return ['fixed','absolute'].includes(s.position) && z >= 10 && r.width > 180 && r.height > 80;
    });
    return fixed.sort((a, b) => area(b) - area(a))[0] || null;
  }
  function area(el) { const r = el.getBoundingClientRect(); return r.width * r.height; }

  async function waitForPopup(timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (stopRequested) throw new Error(rt('runtime.runStopped'));
      const p = findPopup();
      if (p) return p;
      await sleep(150);
    }
    return null;
  }

  function extractPopup(mode) {
    const popup = findPopup();
    if (!popup) return '';
    if (mode === 'title') {
      const title = popup.querySelector('h1,h2,h3,[role="heading"],.title,[class*="title"]');
      return (title?.innerText || '').trim();
    }
    return (popup.innerText || popup.textContent || '').trim();
  }

  function findPopupButton(buttonText) {
    const popup = findPopup();
    if (!popup) return null;
    const needle = String(buttonText || '').trim().toLowerCase();
    const buttons = [...popup.querySelectorAll('button,a,[role="button"],input[type="button"],input[type="submit"]')].filter(isVisible);
    return buttons.find(b => ((b.innerText || b.value || b.getAttribute('aria-label') || '').trim().toLowerCase()).includes(needle)) || null;
  }

  function shouldConfirmClick(el) {
    const text = (el.innerText || el.value || el.getAttribute('aria-label') || '').toLowerCase();
    return /delete|remove|send|submit|pay|confirm|order|törl|küld|fizet|rendel|végleges/.test(text);
  }


  function rowsFromContainer(el, maxRows = 20) {
    if (!el) return [];
    let rows = [];
    if (el.matches('tr,li,[role="row"]')) rows = [el];
    else rows = querySelectorAllDeep('tbody tr,tr,li,[role="row"],.row,[class*="row"]', true, el, maxRows * 3 || 500);
    rows = rows.filter(isVisible);
    const seen = new Set();
    rows = rows.filter(r => { const key = r.innerText || r.textContent || r.outerHTML.slice(0,80); if (seen.has(key)) return false; seen.add(key); return true; });
    return rows.slice(0, Math.max(0, Math.min(500, Number(maxRows || 20))));
  }


  function maskValue(block, vars) {
    const raw = interpolate(block.source || '', vars);
    const invert = Boolean(block.invertMask);
    const clearTrim = Boolean(block.clearTrim);
    const maskChar = block.maskChar == null ? '*' : String(block.maskChar).slice(0, 1);
    const repeatMask = n => maskChar ? maskChar.repeat(Math.max(0, n)) : '';
    if ((block.maskMode || 'characters') === 'lines') {
      const lines = String(raw).split(/\r?\n/);
      const keepFirst = Math.max(0, Number(block.keepFirstLines || 0));
      const keepLast = Math.max(0, Number(block.keepLastLines || 0));
      const maskText = block.maskLineText == null ? '***' : String(block.maskLineText);
      const out = [];
      lines.forEach((line, idx) => {
        const fromEnd = lines.length - idx;
        const inEdge = idx < keepFirst || fromEnd <= keepLast;
        const shouldMask = invert ? inEdge : !inEdge;
        if (shouldMask) { if (!clearTrim) out.push(maskText); }
        else out.push(line);
      });
      return out.join('\n');
    }
    const chars = Array.from(String(raw));
    const keepStart = Math.max(0, Number(block.keepStart || 0));
    const keepEnd = Math.max(0, Number(block.keepEnd || 0));
    const out = [];
    chars.forEach((ch, idx) => {
      const inEdge = idx < keepStart || idx >= chars.length - keepEnd;
      const shouldMask = invert ? inEdge : !inEdge;
      if (shouldMask) { if (!clearTrim) out.push(repeatMask(1)); }
      else out.push(ch);
    });
    return out.join('');
  }


  function transformValue(text, op) {
    const s = String(text || '');
    if (op === 'upper') return s.toUpperCase();
    if (op === 'lower') return s.toLowerCase();
    if (op === 'singleLine') return s.replace(/\s+/g, ' ').trim();
    if (op === 'removeEmptyLines') return s.split(/\r?\n/).filter(x => x.trim()).join('\n');
    if (op === 'digitsOnly') return s.replace(/\D+/g, '');
    if (op === 'lettersOnly') return s.replace(/[^\p{L}]+/gu, '');
    if (op === 'noAccents') return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return s.trim();
  }

  function sliceTextValue(block, vars) {
    const s = String(interpolate(block.source || '', vars));
    if ((block.mode || 'between') === 'line') return (s.split(/\r?\n/)[Math.max(0, Number(block.lineNumber || 1) - 1)] || '').trim();
    if (block.mode === 'chars') return Array.from(s).slice(Math.max(0, Number(block.charStart || 0)), Math.max(0, Number(block.charEnd || 0))).join('');
    const start = interpolate(block.startText || '', vars);
    const end = interpolate(block.endText || '', vars);
    let from = start ? s.indexOf(start) : 0;
    if (from < 0) return '';
    from += start ? start.length : 0;
    let to = end ? s.indexOf(end, from) : s.length;
    if (to < 0) to = s.length;
    return s.slice(from, to).trim();
  }

  function findElementsForBlock(block, maxItems = 50) {
    let els = [];
    if (block.selector) {
      try { els = [...document.querySelectorAll(block.selector)]; } catch (_) { els = []; }
    } else if (block.target) {
      const base = findElement(block.target, { requireVisible: false, shadowSearch: block.shadowSearch !== false });
      if (base) {
        if (base.matches('tr,li,[role="row"],.row,[class*="row"]')) els = [base];
        else els = rowsFromContainer(base, maxItems);
        if (!els.length) els = [...base.querySelectorAll('input,textarea,select,button,a,[role="button"],tr,li,[role="row"],.row,[class*="row"]')];
      }
    }
    const seen = new Set();
    return els.filter(el => {
      const key = cssPath(el) || (el.outerHTML || '').slice(0, 80);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, Math.max(0, Math.min(500, Number(maxItems || 50))));
  }



  function xpathFor(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return `//*[@id="${String(el.id).replace(/"/g, '\\"')}"]`;
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.documentElement) {
      const tag = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (!parent) break;
      const siblings = [...parent.children].filter(x => x.tagName === node.tagName);
      const idx = siblings.indexOf(node) + 1;
      parts.unshift(`${tag}[${idx}]`);
      node = parent;
    }
    return '/html/' + parts.join('/');
  }

  function shortContext(text, needle, caseSensitive = false, size = 80) {
    const raw = String(text || '').replace(/\s+/g, ' ').trim();
    if (!raw) return '';
    const hay = caseSensitive ? raw : raw.toLowerCase();
    const n = caseSensitive ? String(needle || '') : String(needle || '').toLowerCase();
    const idx = n ? hay.indexOf(n) : -1;
    if (idx < 0) return raw.slice(0, size * 2);
    const start = Math.max(0, idx - size);
    const end = Math.min(raw.length, idx + String(needle || '').length + size);
    return `${start > 0 ? '…' : ''}${raw.slice(start, end)}${end < raw.length ? '…' : ''}`;
  }

  function matchesPlainText(value, needle, operator = 'contains', caseSensitive = false) {
    let hay = String(value || '');
    let n = String(needle || '');
    if (!caseSensitive) { hay = hay.toLowerCase(); n = n.toLowerCase(); }
    if (!n) return false;
    if (operator === 'equals') return hay.trim() === n.trim();
    return hay.includes(n);
  }

  function findTextOccurrences(block, vars = {}) {
    const needle = interpolate(block.query || '', vars);
    const operator = block.operator || 'contains';
    const caseSensitive = Boolean(block.caseSensitive);
    const scope = block.searchScope || 'all';
    const includeValues = block.includeValues !== false;
    const includeAttributes = block.includeAttributes !== false;
    const hits = [];
    const seen = new Set();

    function addHit(el, value, place) {
      if (!value || !matchesPlainText(value, needle, operator, caseSensitive)) return;
      const selector = el ? cssPath(el) : 'body';
      const key = `${selector}|${place}|${String(value).slice(0, 180)}`;
      if (seen.has(key)) return;
      seen.add(key);
      const row = closestRow(el);
      const clickable = closestClickable(el);
      const panel = closestPanel(el);
      const nearButton = firstNearbyButton(el);
      const selectorFor = node => node ? (node.getAttribute('id') ? '#' + CSS.escape(node.id) : cssPath(node)) : '';
      hits.push({
        element: el || document.body,
        value: String(value),
        place,
        selector,
        xpath: el ? xpathFor(el) : '/html/body',
        context: shortContext(value, needle, caseSensitive),
        rowSelector: selectorFor(row),
        clickableSelector: selectorFor(clickable),
        parentSelector: selectorFor(panel),
        nearButtonSelector: selectorFor(nearButton)
      });
    }

    if (scope === 'visible') {
      addHit(document.body, document.body.innerText || '', rt('runtime.visiblePageText'));
      return hits;
    }

    const elements = [document.body, ...allElementsDeep(document, block.shadowSearch !== false, 12000)].slice(0, 12000)
      .filter(el => !['SCRIPT','STYLE','NOSCRIPT','TEMPLATE'].includes(el.tagName));

    for (const el of elements) {
      if (scope === 'dom') {
        if (!el.children.length || ['INPUT','TEXTAREA','SELECT','OPTION','BUTTON','A'].includes(el.tagName)) {
          addHit(el, el.textContent || '', rt('runtime.domText'));
        }
      } else {
        if (!el.children.length || ['BUTTON','A','LABEL','OPTION','SUMMARY'].includes(el.tagName)) {
          addHit(el, el.innerText || el.textContent || '', rt('runtime.pageText'));
        }
      }
      if (includeValues && ['INPUT','TEXTAREA','SELECT'].includes(el.tagName)) addHit(el, getElementValue(el, 'auto'), `${el.tagName.toLowerCase()} value`);
      if (includeAttributes) {
        for (const attr of ['title','aria-label','placeholder','alt','value','name','data-testid','data-test-id','data-field','data-name','role']) {
          const val = el.getAttribute?.(attr);
          if (val) addHit(el, val, rt('runtime.attributeHit', { attr }));
        }
      }
    }
    return hits;
  }

  function findErrorMessages(block = {}) {
    const selectors = [];
    if (block.includeAlerts !== false) selectors.push('[role="alert"],.alert,.notification,.toast');
    if (block.includeAriaLive !== false) selectors.push('[aria-live]');
    if (block.includeErrorClasses !== false) selectors.push('.error,.invalid,.validation,.field-error,.form-error,[class*="error"],[class*="invalid"]');
    if (block.includeInvalidFields !== false) selectors.push('[aria-invalid="true"],input:invalid,textarea:invalid,select:invalid');
    const els = selectors.length ? querySelectorAllDeep(selectors.join(','), true, getSearchRoot(), 2000) : [];
    const hits = [];
    const seen = new Set();
    for (const el of els) {
      if (!isVisible(el)) continue;
      const text = (el.innerText || el.textContent || el.getAttribute('aria-label') || el.validationMessage || '').trim();
      const key = cssPath(el) + '|' + text;
      if (seen.has(key)) continue;
      seen.add(key);
      hits.push({ el, text, selector: cssPath(el), xpath: xpathFor(el) });
    }
    return hits;
  }

  function findFieldByLabelText(labelText, block = {}) {
    const needleRaw = String(labelText || '').trim();
    if (!needleRaw) return null;
    const needle = block.caseSensitive ? needleRaw : needleRaw.toLowerCase();
    const mode = block.matchMode || 'contains';
    const candidates = querySelectorAllDeep(`label,[aria-label],[label],[data-label],[data-label-text],[title],[placeholder],[data-field],[data-field-name],[data-name],[data-column],[data-testid],[data-test-id],[role="textbox"],[role="combobox"],span,div,${BF_SNOW_HOST_SELECTOR}`, block.shadowSearch !== false, getSearchRoot(), 9000);
    function ok(text) {
      let t = String(text || '').trim();
      if (!block.caseSensitive) t = t.toLowerCase();
      if (!needle) return false;
      return mode === 'equals' ? t === needle : t.includes(needle);
    }
    let best = null;
    let bestScore = -999;
    for (const lab of candidates) {
      const txt = elementTextAndAttrs(lab);
      if (!ok(txt)) continue;
      const controls = controlsNearLabel(lab);
      const pool = controls.length ? controls : [fieldControlIn(lab), lab].filter(Boolean);
      for (const found of pool) {
        const score = (isServiceNowFieldHost(lab) ? 40 : 20) + (isVisible(found) ? 8 : 0) + (ok(labelFor(found)) ? 12 : 0);
        if (score > bestScore) { best = found; bestScore = score; }
      }
    }
    return best;
  }



  async function tableCellValueWithVirtualScroll(container, block, vars = {}) {
    let value = tableCellValue(container, block);
    if (value || block.virtualSearch !== true || block.rowMode !== 'contains') return value;
    const maxScrolls = Math.max(1, Math.min(50, Number(block.maxScrolls || 10)));
    const scroller = isScrollable(container) ? container : (container.closest('[style*="overflow"],.table,.list,[role="grid"]') || scrollableParent(container));
    for (let i = 0; i < maxScrolls; i++) {
      const before = scroller.scrollTop || window.scrollY || 0;
      if (scroller === document.scrollingElement || scroller === document.documentElement) window.scrollBy(0, Number(block.scrollAmount || 600));
      else scroller.scrollTop = before + Number(block.scrollAmount || 600);
      await sleep(Number(block.scrollDelayMs || 250));
      value = tableCellValue(container, block);
      if (value) return value;
      const after = scroller.scrollTop || window.scrollY || 0;
      if (after === before) break;
    }
    return '';
  }

  function tableCellValue(container, block) {
    let rows = rowsFromContainer(container, 500);
    if (block.skipEmptyRows !== false) rows = rows.filter(r => (r.innerText || r.textContent || '').trim() || r.querySelector('input,textarea,select'));
    if (!block.includeHeader) {
      const first = rows[0];
      if (first && first.querySelectorAll('th').length && !first.querySelector('td')) rows = rows.slice(1);
    }
    let row = null;
    if ((block.rowMode || 'first') === 'last') row = rows[rows.length - 1];
    else if (block.rowMode === 'contains') {
      const needle = interpolate(block.rowContains || '', {}).toLowerCase();
      row = rows.find(r => (r.innerText || r.textContent || '').toLowerCase().includes(needle));
    } else if (block.rowMode === 'nth') {
      const n = Math.max(1, Number(interpolate(block.rowIndex || 1, {}) || 1));
      row = rows[n - 1];
    } else row = rows[0];
    if (!row) {
      if (block.missingRowMode === 'error') throw new Error(rt('runtime.tableRowNotFound'));
      return '';
    }
    const cells = [...row.querySelectorAll('td,th,[role="cell"],[role="gridcell"],input,textarea,select')];
    let idx = Math.max(0, Number(block.columnIndex || 1) - 1);
    if ((block.columnMode || 'index') === 'header' && block.columnHeader) {
      const headerRows = rowsFromContainer(container, 5).filter(r => r.querySelector('th,[role="columnheader"]'));
      const headers = headerRows.length ? [...headerRows[0].querySelectorAll('th,[role="columnheader"],td')] : [...container.querySelectorAll('th,[role="columnheader"]')];
      const n = normalizeText(block.columnHeader);
      const foundIdx = headers.findIndex(h => normalizeText(h.innerText || h.textContent || h.getAttribute('aria-label') || '').includes(n));
      if (foundIdx >= 0) idx = foundIdx;
    }
    const cell = cells[idx] || row;
    return getElementValue(cell, 'auto') || (cell.innerText || cell.textContent || '').trim();
  }

  function compareGeneric(left, op, right) {
    if (op === 'greater' || op === 'less') {
      const a = Number(String(left).replace(',', '.'));
      const b = Number(String(right).replace(',', '.'));
      if (Number.isNaN(a) || Number.isNaN(b)) return false;
      return op === 'greater' ? a > b : a < b;
    }
    return compareTextValue(left, op || 'equals', right, false);
  }

  function mathValue(left, op, right) {
    const a = Number(String(left || 0).replace(',', '.'));
    const b = Number(String(right || 0).replace(',', '.'));
    if (op === 'subtract') return a - b;
    if (op === 'multiply') return a * b;
    if (op === 'divide') return b === 0 ? '' : a / b;
    return a + b;
  }

  function validateValue(value, validation, pattern) {
    const s = String(value || '');
    if (validation === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
    if (validation === 'contains') return pattern ? s.includes(pattern) : true;
    if (validation === 'regex') { try { return new RegExp(pattern).test(s); } catch (_) { return false; } }
    return Boolean(s.trim());
  }

  async function showUserPrompt(block, vars, dryRun) {
    const title = interpolate(block.title || 'BlockFlow', vars);
    const message = interpolate(block.message || '', vars);
    const mode = block.mode || 'wait';
    if (dryRun) return { action: 'dry-run' };

    // Use an extension-owned window instead of injecting a modal into the page.
    // This avoids CSS/z-index conflicts and makes the wait-for-user workflow stable.
    const response = await safeRuntimeSend({
      type: 'BF_USER_PROMPT',
      title,
      message,
      mode,
      buttonText: block.buttonText || rt('button.continue'),
      cancelText: block.cancelText || rt('button.cancel'),
      feedbackStyle: block.feedbackStyle || 'default',
      accent: block.accent || 'blue',
      windowSize: block.windowSize || 'normal'
    });

    if (!response || response.ok === false) {
      const errText = String(response?.error || rt('runtime.userPromptOpenFailed'));
      throw new Error(errText);
    }
    if (response.action === 'cancel' || response.action === 'closed') {
      throw Object.assign(new Error(rt('runtime.userCancelledRun')), { userCancelled: true });
    }
    return { action: response.action || 'continue' };
  }


  async function showInputPrompt(block, vars, dryRun, kind) {
    if (dryRun) return { action: 'dry-run', value: '' };
    const response = await safeRuntimeSend({
      type: 'BF_USER_PROMPT',
      promptType: kind,
      title: interpolate(block.title || 'BlockFlow', vars),
      message: interpolate(block.message || '', vars),
      mode: 'wait',
      inputType: block.inputType || 'text',
      placeholder: interpolate(block.placeholder || '', vars),
      defaultValue: interpolate(block.defaultValue || '', vars),
      options: String(block.options || '').split(/\r?\n/).map(x => interpolate(x.trim(), vars)).filter(Boolean),
      buttonText: 'OK',
      cancelText: rt('button.cancel'),
      feedbackStyle: block.feedbackStyle || 'default',
      accent: block.accent || 'blue',
      windowSize: block.windowSize || 'normal'
    });
    if (!response || response.ok === false) throw new Error(response?.error || rt('runtime.userWindowError'));
    if (['cancel','closed'].includes(response.action)) throw Object.assign(new Error(rt('runtime.userCancelledRun')), { userCancelled: true });
    return response;
  }


  function pdfDefaultOptions(block = {}, vars = {}) {
    const size = (block.pageSize || 'a4').toLowerCase();
    const base = size === 'letter' ? [612, 792] : size === 'legal' ? [612, 1008] : [595.28, 841.89];
    const landscape = (block.orientation || 'portrait') === 'landscape';
    return {
      title: interpolate(block.title || 'BlockFlow riport', vars),
      fileName: interpolate(block.fileName || 'blockflow-riport.pdf', vars),
      width: landscape ? base[1] : base[0],
      height: landscape ? base[0] : base[1],
      margin: Number(block.margin || 40),
      fontSize: Number(block.fontSize || 11),
      header: interpolate(block.header || '', vars),
      footer: interpolate(block.footer || 'date,page,url', vars)
    };
  }

  function ensurePdf(vars, block = {}) {
    if (!vars.__bfPdf) vars.__bfPdf = { options: pdfDefaultOptions(block, vars), items: [] };
    return vars.__bfPdf;
  }

  function pdfCleanText(value) {
    return String(value ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  }

  function pdfEscape(value) {
    return pdfCleanText(value)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[őŐűŰ]/g, m => ({'ő':'o','Ő':'O','ű':'u','Ű':'U'}[m] || m))
      .replace(/[\\()]/g, '\\$&')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ');
  }

  function wrapPdfLine(text, maxWidth, fontSize) {
    const approx = Math.max(10, Math.floor(maxWidth / (fontSize * 0.52)));
    const words = String(text || '').split(/\s+/);
    const lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? line + ' ' + word : word;
      if (next.length > approx && line) { lines.push(line); line = word; }
      else line = next;
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  function dataUrlToBinary(dataUrl) {
    const m = String(dataUrl || '').match(/^data:[^,]+,(.*)$/);
    return m ? atob(m[1]) : '';
  }

  async function imageDataUrlToJpeg(dataUrl, maxWidth = 1200) {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, maxWidth / Math.max(1, img.naturalWidth || img.width));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
          canvas.height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.85), width: canvas.width, height: canvas.height });
        } catch (err) { reject(err); }
      };
      img.onerror = () => reject(new Error(rt('runtime.screenshotImageLoadFailed'))) ;
      img.src = dataUrl;
    });
  }

  async function getPdfScreenshotData(block, vars, dryRun) {
    if (dryRun) return '';
    if ((block.source || 'current') === 'last') return vars[block.dataVar || 'screenshot_data_url'] || '';
    if ((block.source || 'current') === 'variable') return vars[block.dataVar || 'screenshot_data_url'] || '';
    const res = await safeRuntimeSend({ type: 'BF_CAPTURE_VISIBLE_TAB', openPreview: false, restoreFocus: true });
    if (!res?.ok) throw new Error(res?.error || rt('runtime.pdfScreenshotFailed'));
    vars[block.dataVar || 'screenshot_data_url'] = res.dataUrl || '';
    return res.dataUrl || '';
  }

  function makeDownloadName(name) {
    const n = String(name || 'blockflow-riport.pdf').trim() || 'blockflow-riport.pdf';
    return n.toLowerCase().endsWith('.pdf') ? n : n + '.pdf';
  }

  async function buildPdfBlob(pdf, vars) {
    const opt = pdf.options || pdfDefaultOptions({}, vars);
    const margin = Number(opt.margin || 40);
    const pageW = Number(opt.width || 595.28);
    const pageH = Number(opt.height || 841.89);
    const contentW = pageW - margin * 2;
    const objects = [];
    const addObj = content => { objects.push(content); return objects.length; };
    const fontId = addObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    const pagesId = addObj('PAGES_PLACEHOLDER');
    const pages = [];
    let page = null;
    function newPage() { page = { ops: [], images: [] }; pages.push(page); addHeaderFooter(); }
    function addHeaderFooter() {
      if (opt.header) addText(opt.header, 9, 'left', 6);
    }
    function ensureSpace(h) { if (!page) newPage(); if (page.y - h < margin) newPage(); }
    function addOp(op) { if (!page) newPage(); page.ops.push(op); }
    function setYInitial() { if (page && page.y == null) page.y = pageH - margin - (opt.header ? 18 : 0); }
    function addText(text, fontSize, align = 'left', spaceAfter = 8) {
      if (!page) newPage(); setYInitial();
      const lines = pdfCleanText(text).split('\n').flatMap(line => wrapPdfLine(line, contentW, fontSize));
      const lineH = fontSize * 1.35;
      ensureSpace(lines.length * lineH + spaceAfter);
      setYInitial();
      for (const ln of lines) {
        let x = margin;
        const approxW = String(ln).length * fontSize * 0.52;
        if (align === 'center') x = margin + Math.max(0, (contentW - approxW) / 2);
        if (align === 'right') x = margin + Math.max(0, contentW - approxW);
        addOp(`BT /F1 ${fontSize} Tf ${x.toFixed(2)} ${page.y.toFixed(2)} Td (${pdfEscape(ln)}) Tj ET`);
        page.y -= lineH;
      }
      page.y -= Number(spaceAfter || 0);
    }
    function addTable(title, rows, block) {
      if (title) addText(title, 13, 'left', 6);
      const parsed = pdfCleanText(rows).split('\n').filter(Boolean).map(r => {
        const parts = r.includes('|') ? r.split('|') : r.split(':');
        return [parts.shift()?.trim() || '', parts.join('|').trim() || ''];
      });
      const fontSize = 10;
      const lineH = 16;
      const firstW = block.columnMode === '50/50' ? contentW * 0.5 : contentW * 0.32;
      for (const [a, b] of parsed) {
        ensureSpace(lineH + 4); setYInitial();
        const y = page.y;
        const empty = block.emptyValue ?? '-';
        addOp(`BT /F1 ${fontSize} Tf ${margin.toFixed(2)} ${y.toFixed(2)} Td (${pdfEscape(a || empty)}) Tj ET`);
        addOp(`BT /F1 ${fontSize} Tf ${(margin + firstW).toFixed(2)} ${y.toFixed(2)} Td (${pdfEscape(b || empty)}) Tj ET`);
        if (block.border !== false) addOp(`${margin.toFixed(2)} ${(y - 4).toFixed(2)} ${contentW.toFixed(2)} ${lineH.toFixed(2)} re S`);
        page.y -= lineH;
      }
      page.y -= 8;
    }
    async function addImage(item) {
      if (!item.dataUrl) return;
      if (item.pageBreakBefore) newPage();
      const jpg = await imageDataUrlToJpeg(item.dataUrl);
      const ratio = jpg.height / Math.max(1, jpg.width);
      let drawW = item.sizeMode === 'original' ? Math.min(contentW, jpg.width * 0.5) : contentW;
      let drawH = drawW * ratio;
      if (item.sizeMode === 'fitPage' && drawH > pageH - margin * 2) { drawH = pageH - margin * 2; drawW = drawH / ratio; }
      ensureSpace(drawH + 40); setYInitial();
      if (item.caption) addText(item.caption, 10, 'left', 4);
      ensureSpace(drawH + 10); setYInitial();
      const name = `Im${page.images.length + 1}`;
      page.images.push({ name, data: dataUrlToBinary(jpg.dataUrl), width: jpg.width, height: jpg.height });
      addOp(`q ${drawW.toFixed(2)} 0 0 ${drawH.toFixed(2)} ${margin.toFixed(2)} ${(page.y - drawH).toFixed(2)} cm /${name} Do Q`);
      if (item.border !== false) addOp(`${margin.toFixed(2)} ${(page.y - drawH).toFixed(2)} ${drawW.toFixed(2)} ${drawH.toFixed(2)} re S`);
      page.y -= drawH + 12;
    }

    newPage();
    if (opt.title) addText(opt.title, 16, 'left', 12);
    for (const item of pdf.items || []) {
      if (item.type === 'pageBreak') { if (!item.onlyIfLowSpace || (page.y < pageH * 0.35)) newPage(); continue; }
      if (item.type === 'text') {
        const size = Number(item.fontSize || opt.fontSize || 11) + (item.style === 'heading' ? 4 : item.style === 'subtitle' ? 2 : 0);
        if (item.heading) addText(item.heading, Math.max(size + 2, 13), item.align || 'left', 5);
        addText(item.text || '', size, item.align || 'left', item.spaceAfter ?? 10);
      }
      if (item.type === 'table') addTable(item.title, item.rows, item);
      if (item.type === 'image') await addImage(item);
    }

    const pageIds = [];
    for (let pi = 0; pi < pages.length; pi++) {
      const pg = pages[pi];
      const xobj = [];
      for (const img of pg.images) {
        const id = addObj(`<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.data.length} >>\nstream\n${img.data}\nendstream`);
        xobj.push(`/${img.name} ${id} 0 R`);
      }
      const footerText = String(opt.footer || '').includes('page') ? `Oldal ${pi + 1}/${pages.length}` : '';
      if (footerText) pg.ops.push(`BT /F1 8 Tf ${margin.toFixed(2)} 22 Td (${pdfEscape(footerText)}) Tj ET`);
      const stream = pg.ops.join('\n');
      const contentId = addObj(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      const pageId = addObj(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageW.toFixed(2)} ${pageH.toFixed(2)}] /Resources << /Font << /F1 ${fontId} 0 R >> ${xobj.length ? `/XObject << ${xobj.join(' ')} >>` : ''} >> /Contents ${contentId} 0 R >>`);
      pageIds.push(pageId);
    }
    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
    const catalogId = addObj(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);
    let out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    const offsets = [0];
    for (let i = 0; i < objects.length; i++) {
      offsets.push(out.length);
      out += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
    }
    const xrefAt = out.length;
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i < offsets.length; i++) out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefAt}\n%%EOF`;
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 255;
    return new Blob([bytes], { type: 'application/pdf' });
  }

  function saveOrPreviewPdfBlob(blob, fileName, action) {
    const cleanName = makeDownloadName(fileName);
    const url = URL.createObjectURL(blob);

    const download = () => {
      const a = document.createElement('a');
      a.href = url;
      a.download = cleanName;
      document.documentElement.appendChild(a);
      a.click();
      a.remove();
    };

    // v0.42: Do not embed PDF blobs into a custom preview iframe/object.
    // Chrome may block extension-hosted iframe PDF previews with
    // "This content is blocked". Preview now opens the PDF blob directly in
    // the browser PDF viewer. Filename-safe saving is handled by the separate
    // download action below.
    if (action === 'download' || action === 'downloadPreview') {
      download();
    }
    if (action === 'preview' || action === 'downloadPreview') {
      try {
        window.open(url, '_blank', 'noopener');
      } catch (_) {
        // If preview is blocked by the browser/popup policy, fall back to a
        // real download using the configured filename.
        if (action === 'preview') download();
      }
    }
    setTimeout(() => URL.revokeObjectURL(url), 300000);
  }


  function docxDefaultOptions(block = {}, vars = {}) {
    const page = (block.pageSize || 'a4') === 'letter' ? { w: 12240, h: 15840 } : { w: 11906, h: 16838 };
    const landscape = block.orientation === 'landscape';
    return {
      title: interpolate(block.title || 'BlockFlow riport', vars),
      fileName: makeDocxName(interpolate(block.fileName || 'blockflow-riport.docx', vars)),
      width: landscape ? page.h : page.w,
      height: landscape ? page.w : page.h,
      margin: Number(block.margin || 720),
      fontSize: Number(block.fontSize || 22)
    };
  }
  function ensureDocx(vars, block = {}) { if (!vars.__bfDocx) vars.__bfDocx = { options: docxDefaultOptions(block, vars), items: [] }; return vars.__bfDocx; }
  function makeDocxName(name) { const n = String(name || 'blockflow-riport.docx').trim() || 'blockflow-riport.docx'; return n.toLowerCase().endsWith('.docx') ? n : n + '.docx'; }
  function xmlEscape(v){ return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;'); }
  function docxParagraph(text, opts = {}) {
    const align = opts.align && opts.align !== 'left' ? `<w:jc w:val="${opts.align}"/>` : '';
    const style = opts.style === 'heading1' ? '<w:pStyle w:val="Heading1"/>' : opts.style === 'heading2' ? '<w:pStyle w:val="Heading2"/>' : '';
    const pPr = (style || align) ? `<w:pPr>${style}${align}</w:pPr>` : '';
    const bold = opts.bold ? '<w:b/>' : '';
    const size = opts.size ? `<w:sz w:val="${Number(opts.size)}"/>` : '';
    const rPr = (bold || size) ? `<w:rPr>${bold}${size}</w:rPr>` : '';
    const lines = String(text ?? '').split(/\r?\n/);
    return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${xmlEscape(lines[0] || '')}</w:t>${lines.slice(1).map(x=>`<w:br/><w:t xml:space="preserve">${xmlEscape(x)}</w:t>`).join('')}</w:r></w:p>`;
  }
  function docxTableXml(rowsText, emptyValue='-', border=true) {
    const rows = String(rowsText || '').split(/\r?\n/).filter(Boolean).map(line => line.split('|').map(x => x.trim()));
    const borders = border ? '<w:tblBorders><w:top w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/><w:insideH w:val="single" w:sz="4"/><w:insideV w:val="single" w:sz="4"/></w:tblBorders>' : '';
    return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>${borders}</w:tblPr>` + rows.map(cols => `<w:tr>${cols.map(c => `<w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/></w:tcPr>${docxParagraph(c || emptyValue)}</w:tc>`).join('')}</w:tr>`).join('') + '</w:tbl>';
  }
  function dataUrlInfo(dataUrl){ const m=String(dataUrl||'').match(/^data:(image\/(png|jpeg|jpg));base64,(.*)$/i); if(!m) return null; return { mime:m[1].toLowerCase().replace('jpg','jpeg'), ext:m[2].toLowerCase()==='jpeg'?'jpg':m[2].toLowerCase(), bytes:Uint8Array.from(atob(m[3]), c=>c.charCodeAt(0)) }; }
  function docxImageXml(relId, widthPx=600){ const cx=Math.max(1, Math.round(Number(widthPx||600)*9525)); const cy=Math.round(cx*0.60); return `<w:p><w:r><w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="1" name="Kép"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="image"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`; }
  function zipMakeCrcTable(){ const table=new Uint32Array(256); for(let n=0;n<256;n++){let c=n; for(let k=0;k<8;k++) c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1); table[n]=c>>>0;} return table; }
  const BF_DOCX_CRC_TABLE = zipMakeCrcTable();
  function zipCrc(bytes){ let crc=0xffffffff; for(const b of bytes) crc=(crc>>>8)^BF_DOCX_CRC_TABLE[(crc^b)&255]; return (crc^0xffffffff)>>>0; }
  function zipU16(out,n){ out.push(n&255,(n>>>8)&255); } function zipU32(out,n){ out.push(n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255); }
  function zipDosTime(d=new Date()){ return ((d.getHours()<<11)|(d.getMinutes()<<5)|Math.floor(d.getSeconds()/2))&0xffff; } function zipDosDate(d=new Date()){ return (((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate())&0xffff; }
  async function filesToZipBlobDocx(files){ const enc=new TextEncoder(); const chunks=[], central=[]; let offset=0; const now=new Date(), t=zipDosTime(now), d=zipDosDate(now); for(const f of files){ const name=enc.encode(f.name); const bytes=typeof f.content==='string'?enc.encode(f.content):new Uint8Array(f.content||[]); const crc=zipCrc(bytes); let h=[0x50,0x4b,0x03,0x04]; zipU16(h,20); zipU16(h,0); zipU16(h,0); zipU16(h,t); zipU16(h,d); zipU32(h,crc); zipU32(h,bytes.length); zipU32(h,bytes.length); zipU16(h,name.length); zipU16(h,0); const lh=new Uint8Array(h); chunks.push(lh,name,bytes); let c=[0x50,0x4b,0x01,0x02]; zipU16(c,20); zipU16(c,20); zipU16(c,0); zipU16(c,0); zipU16(c,t); zipU16(c,d); zipU32(c,crc); zipU32(c,bytes.length); zipU32(c,bytes.length); zipU16(c,name.length); zipU16(c,0); zipU16(c,0); zipU16(c,0); zipU16(c,0); zipU32(c,0); zipU32(c,offset); central.push(new Uint8Array(c),name); offset += lh.length + name.length + bytes.length; } const centralSize=central.reduce((a,b)=>a+b.length,0); let e=[0x50,0x4b,0x05,0x06]; zipU16(e,0); zipU16(e,0); zipU16(e,files.length); zipU16(e,files.length); zipU32(e,centralSize); zipU32(e,offset); zipU16(e,0); return new Blob([...chunks,...central,new Uint8Array(e)],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}); }
  async function buildDocxBlob(docx, vars){
    const opt=docx.options||docxDefaultOptions({},vars); const media=[]; const rels=[]; let body='';
    if (opt.title) body += docxParagraph(opt.title, { style:'heading1', bold:true, size:32 });
    for (const item of docx.items||[]) {
      if (item.type==='pageBreak') body += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      if (item.type==='text') { if(item.heading) body += docxParagraph(item.heading,{style:item.style==='heading2'?'heading2':'heading1', bold:true, size:item.style==='heading2'?28:32}); if(item.text) body += docxParagraph(item.text,{align:item.align||'left'}); }
      if (item.type==='table') { if(item.title) body += docxParagraph(item.title,{style:'heading2', bold:true, size:28}); body += docxTableXml(item.rows, item.emptyValue, item.border); }
      if (item.type==='image' && item.dataUrl) { const info=dataUrlInfo(item.dataUrl); if(info){ const idx=media.length+1; const ext=info.ext==='jpeg'?'jpg':info.ext; const relId='rIdImg'+idx; media.push({name:`word/media/image${idx}.${ext}`, content:info.bytes}); rels.push(`<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image${idx}.${ext}"/>`); if(item.pageBreakBefore) body += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'; if(item.caption) body += docxParagraph(item.caption,{style:'heading2', bold:true, size:24}); body += docxImageXml(relId, item.width||600); } }
    }
    const sect=`<w:sectPr><w:pgSz w:w="${opt.width}" w:h="${opt.height}"/><w:pgMar w:top="${opt.margin}" w:right="${opt.margin}" w:bottom="${opt.margin}" w:left="${opt.margin}" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>`;
    const documentXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}${sect}</w:body></w:document>`;
    const contentTypes=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpg" ContentType="image/jpeg"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`;
    const rootRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;
    const docRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`;
    return filesToZipBlobDocx([{name:'[Content_Types].xml',content:contentTypes},{name:'_rels/.rels',content:rootRels},{name:'word/document.xml',content:documentXml},{name:'word/_rels/document.xml.rels',content:docRels},...media]);
  }
  function downloadDocxBlob(blob, fileName){ const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=makeDocxName(fileName); document.documentElement.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url), 60000); }


  function positionBlockFlowButton(host, position, block = {}) {
    const st = host.style;
    st.position = 'fixed';
    st.zIndex = '2147483647';
    st.fontFamily = 'Arial, sans-serif';
    st.pointerEvents = 'auto';
    st.maxWidth = 'calc(100vw - 32px)';
    if (position === 'custom') {
      const unit = block?.customUnit || 'px';
      const setPos = (prop, val) => { if (val !== undefined && val !== null && String(val) !== '') st[prop] = `${val}${unit}`; };
      setPos('left', block?.customLeft);
      setPos('right', block?.customRight);
      setPos('top', block?.customTop);
      setPos('bottom', block?.customBottom);
      st.zIndex = String(block?.customZIndex || 2147483647);
      if (!st.left && !st.right) st.right = `24${unit}`;
      if (!st.top && !st.bottom) st.bottom = `24${unit}`;
    } else if (position === 'bottomLeft') { st.left = '16px'; st.bottom = '16px'; }
    else if (position === 'topRight') { st.right = '16px'; st.top = '16px'; }
    else if (position === 'topLeft') { st.left = '16px'; st.top = '16px'; }
    else if (position === 'bottomCenter') { st.left = '50%'; st.bottom = '16px'; st.transform = 'translateX(-50%)'; }
    else { st.right = '16px'; st.bottom = '16px'; }
  }

  async function showPageButton(block, vars = {}, dryRun = false) {
    const label = interpolate(block.label || rt('button.continue'), vars) || rt('button.continue');
    const tooltip = interpolate(block.tooltip || '', vars);
    const waitForClick = true;
    const timeoutMs = Math.max(0, Number(block.timeoutSec || 300) * 1000);
    const resultName = block.resultName || 'button_clicked';
    if (dryRun) {
      vars[resultName] = waitForClick ? 'dry-run' : 'shown';
      vars.button_clicked_at = '';
      return { ok: true, dryRun: true };
    }

    const id = `bf-page-button-${block.id || Math.random().toString(36).slice(2)}`;
    document.getElementById(id)?.remove();

    const host = document.createElement('div');
    host.id = id;
    host.setAttribute('data-blockflow-page-button', '1');
    const shadow = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    const style = document.createElement('style');
    style.textContent = `
      :host{all:initial} .wrap{all:initial;font-family:Arial,sans-serif} button{all:initial;box-sizing:border-box;display:inline-flex;align-items:center;gap:8px;min-height:38px;padding:9px 14px;border-radius:999px;background:#2563eb;color:#fff;font:600 14px Arial,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.25);cursor:pointer;border:1px solid rgba(255,255,255,.25)} button:hover{background:#1d4ed8} button:active{transform:translateY(1px)} .dot{width:8px;height:8px;border-radius:50%;background:#93c5fd;display:inline-block}
    `;
    const wrap = document.createElement('div');
    wrap.className = 'wrap';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.title = tooltip;
    btn.innerHTML = `<span class="dot"></span><span></span>`;
    btn.querySelector('span:last-child').textContent = label;
    wrap.appendChild(btn);
    shadow.appendChild(style);
    shadow.appendChild(wrap);

    const pos = block.position || 'bottomRight';
    if (pos === 'afterTarget' || pos === 'beforeTarget') {
      const target = findElement(block.target, { requireVisible: false, shadowSearch: true });
      if (target && target.parentNode) {
        host.style.margin = '6px';
        if (pos === 'beforeTarget') target.parentNode.insertBefore(host, target);
        else target.parentNode.insertBefore(host, target.nextSibling);
      } else {
        positionBlockFlowButton(host, 'bottomRight', block);
        document.body.appendChild(host);
      }
    } else {
      positionBlockFlowButton(host, pos, block);
      document.body.appendChild(host);
    }

    if (!waitForClick) {
      vars[resultName] = 'shown';
      vars.button_clicked_at = '';
      return { ok: true, shown: true };
    }

    return await new Promise((resolve, reject) => {
      let done = false;
      const cleanup = () => {
        done = true;
        if (timer) clearTimeout(timer);
        if (block.removeAfterClick !== false) host.remove();
      };
      const timer = timeoutMs ? setTimeout(() => {
        if (done) return;
        vars[resultName] = 'false';
        vars.button_clicked_at = '';
        cleanup();
        if ((block.onTimeout || 'stop') === 'continue') resolve({ ok: true, timeout: true });
        else reject(new Error('Oldalba illesztett gomb timeout.'));
      }, timeoutMs) : null;
      btn.addEventListener('click', () => {
        if (done) return;
        const at = new Date().toISOString();
        vars[resultName] = 'true';
        vars.button_clicked_at = at;
        cleanup();
        resolve({ ok: true, clicked: true, clickedAt: at });
      }, { once: true });
    });
  }

  async function executeBlock(block, vars, options = {}) {
    const dryRun = Boolean(options.dryRun);
    if (block.type === 'trigger' || block.type === 'triggerGroup' || block.type === 'clickTrigger' || block.type === 'textShortcut' || block.type === 'scheduledTrigger' || block.type === 'actionGroup' || block.type === 'pageControlPanel' || String(block.type || '').startsWith('condition')) return { skipped: true };

    if (block.type === 'wait') {
      if (block.waitMode === 'element' && block.target) {
        const el = await waitForElement(block.target, Number(block.timeoutMs || 5000));
        if (!el) throw new Error(`Nem jelent meg az elem: ${block.target.label || block.target.css}`);
      } else if (block.waitMode === 'text') {
        const ok = await waitForText(interpolate(block.text || '', vars), Number(block.timeoutMs || 5000), false);
        if (!ok) throw new Error(rt('runtime.textDidNotAppear', { text: block.text || '' }));
      } else {
        await sleep(Number(block.ms || 1000));
      }
      return { ok: true };
    }
    if (block.type === 'click') {
      const target = targetForBlock(block, vars);
      const el = await waitForElement(target, Number(block.timeoutMs || 5000), { shadowSearch: block.shadowSearch !== false });
      if (!el) throw new Error(rt('runtime.clickTargetLabelNotFound', { label: target?.label || block.target?.label || rt('runtime.notSpecified') }));
      if (block.autoScroll !== false) await scrollElementIntoViewSmart(el, { block, align: 'center' });
      el.classList.add('bf-run-outline');
      await sleep(100);
      if (!dryRun) {
        const clickEl = block.clickableFallback === false ? el : (closestClickable(el) || el);
        if (block.confirmRisky && shouldConfirmClick(clickEl) && !confirm(`BlockFlow: kockázatosnak tűnő kattintás: "${(clickEl.innerText || clickEl.value || '').trim()}". Folytatod?`)) throw new Error('Felhasználó megszakította a kockázatos kattintást.');
        if (block.clickMode === 'dblclick') clickEl.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, composed: true }));
        else if (block.clickMode === 'events') ['mousedown','mouseup','click'].forEach(t => clickEl.dispatchEvent(new MouseEvent(t, { bubbles: true, composed: true, view: window })));
        else clickEl.click();
      }
      setTimeout(() => el.classList.remove('bf-run-outline'), 700);
      return { ok: true, dryRun };
    }

    if (block.type === 'injectCss') {
      const styleId = String(interpolate(block.styleId || 'blockflow-custom-style', vars) || 'blockflow-custom-style').replace(/[^a-zA-Z0-9_-]/g, '_');
      const domId = `bf-injected-css-${styleId}`;
      const mode = block.mode || 'add';
      if (!dryRun) {
        const existing = document.getElementById(domId);
        if (mode === 'remove') {
          if (existing) existing.remove();
          vars[block.resultName || 'css_injektalva'] = 'removed';
          return { ok: true, action: 'removed', styleId };
        }
        if (existing && block.replaceExisting !== false) existing.remove();
        const style = existing && block.replaceExisting === false ? existing : document.createElement('style');
        style.id = domId;
        style.setAttribute('data-blockflow-css', 'true');
        style.setAttribute('data-style-id', styleId);
        style.textContent = interpolate(block.cssText || '', vars);
        if (!style.parentNode) (document.head || document.documentElement).appendChild(style);
        vars[block.resultName || 'css_injektalva'] = 'true';
      }
      return { ok: true, action: mode, styleId, value: block.cssText || '' };
    }
    if (block.type === 'fill') {
      const target = targetForBlock(block, vars);
      const el = await waitForElement(target, Number(block.timeoutMs || 5000), { shadowSearch: block.shadowSearch !== false });
      if (!el) {
        if (shouldSoftFailMissingField(block)) return { ok: true, skipped: true, value: '', reason: 'snow-field-not-found' };
        throw new Error(rt('runtime.fieldNotFound', { label: target?.label || block.target?.label || rt('runtime.notSpecified') }));
      }
      const value = interpolate(block.value || '', vars);
      await scrollElementIntoViewSmart(el, { block, align: 'center' });
      el.classList.add('bf-run-outline');
      if (!dryRun) await setElementValueCompat(el, value, block);
      setTimeout(() => el.classList.remove('bf-run-outline'), 700);
      return { ok: true, value, dryRun };
    }
    if (block.type === 'selectOption') {
      const target = targetForBlock(block, vars);
      const root = await waitForElement(target, Number(block.timeoutMs || 5000), { requireVisible: true, shadowSearch: block.shadowSearch !== false });
      if (!root) {
        if (shouldSoftFailMissingField(block)) return { ok: true, skipped: true, value: '', reason: 'snow-dropdown-not-found' };
        throw new Error(rt('runtime.dropdownNotFound', { label: target?.label || block.target?.label || rt('runtime.notSpecified') }));
      }
      const optionText = interpolate(block.optionText || '', vars);
      if (!dryRun) root.click();
      await sleep(Number(block.openDelayMs || 250));
      let options = querySelectorAllDeep('option,[role="option"],li,button,div,span', block.shadowSearch !== false, getSearchRoot(), 8000).filter(isVisible);
      const scroller = options.length ? scrollableParent(options[0]) : scrollableParent(root);
      const matchOpt = () => {
        options = querySelectorAllDeep('option,[role="option"],li,button,div,span', block.shadowSearch !== false, getSearchRoot(), 8000).filter(isVisible);
        const needle = block.caseSensitive ? String(optionText || '') : normalizeText(optionText);
        return options.find(o => {
          let t = o.innerText || o.textContent || o.getAttribute('aria-label') || o.getAttribute('title') || o.value || '';
          t = block.caseSensitive ? String(t).trim() : normalizeText(t);
          if (!needle) return false;
          if (block.matchMode === 'equals') return t === needle;
          if (block.matchMode === 'starts') return t.startsWith(needle);
          return t.includes(needle);
        });
      };
      let opt = matchOpt();
      if (!opt && block.scrollOptions !== false && scroller) {
        for (let i = 0; i < Number(block.maxOptionScrolls || 10) && !opt; i++) {
          const before = scroller.scrollTop || window.scrollY || 0;
          if (scroller === document.scrollingElement || scroller === document.documentElement) window.scrollBy(0, 350); else scroller.scrollTop = before + 350;
          await sleep(150);
          opt = matchOpt();
          const after = scroller.scrollTop || window.scrollY || 0;
          if (after === before) break;
        }
      }
      if (!opt) {
        if (shouldSoftFailMissingField(block)) return { ok: true, skipped: true, value: '', reason: 'snow-option-not-found' };
        throw new Error(rt('runtime.dropdownOptionNotFound', { option: optionText }));
      }
      await scrollElementIntoViewSmart(opt, { block, align: 'center' });
      opt.classList.add('bf-run-outline');
      if (!dryRun) opt.click();
      setTimeout(() => opt.classList.remove('bf-run-outline'), 700);
      return { ok: true, value: optionText, dryRun };
    }
    if (block.type === 'extract') {
      const requireVisible = (block.searchScope || 'dom') === 'visible' || block.allowHidden === false;
      const target = targetForBlock(block, vars);
      const el = await waitForElement(target, Number(block.timeoutMs || 5000), { requireVisible, shadowSearch: block.shadowSearch !== false });
      if (!el) {
        if (shouldSoftFailMissingField(block)) { vars[block.varName || 'adat'] = ''; return { ok: true, skipped: true, value: '', reason: 'snow-extract-target-not-found' }; }
        throw new Error(rt('runtime.extractElementNotFound', { label: target?.label || block.target?.label || rt('runtime.notSpecified') }));
      }
      const val = getElementValue(el, block.extractMode || 'auto', block.attributeName || 'title');
      vars[block.varName || 'adat'] = val;
      return { ok: true, value: val };
    }
    if (block.type === 'popupWait') {
      const p = await waitForPopup(Number(block.timeoutMs || 10000));
      if (!p) throw new Error('Nem jelent meg popup/modal.');
      p.classList.add('bf-run-outline');
      setTimeout(() => p.classList.remove('bf-run-outline'), 700);
      return { ok: true };
    }
    if (block.type === 'popupExtract') {
      const val = extractPopup(block.extractMode || 'text');
      if (!val) throw new Error(rt('runtime.popupExtractFailed'));
      vars[block.varName || 'popup_szoveg'] = val;
      return { ok: true, value: val };
    }
    if (block.type === 'popupClick') {
      const btn = findPopupButton(interpolate(block.buttonText || '', vars));
      if (!btn) throw new Error(rt('runtime.popupButtonNotFound', { label: block.buttonText || '' }));
      btn.classList.add('bf-run-outline');
      if (!dryRun) btn.click();
      setTimeout(() => btn.classList.remove('bf-run-outline'), 700);
      return { ok: true, dryRun };
    }

    if (block.type === 'setVar') {
      vars[block.varName || 'valtozo'] = interpolate(block.value || '', vars);
      return { ok: true };
    }
    if (block.type === 'transform') {
      const value = transformValue(interpolate(block.source || '', vars), block.operation || 'trim');
      vars[block.resultName || 'atalakitott_adat'] = value;
      return { ok: true, value };
    }
    if (block.type === 'textSlice') {
      const value = sliceTextValue(block, vars);
      vars[block.resultName || 'szovegresz'] = value;
      return { ok: true, value };
    }
    if (block.type === 'regex') {
      const src = interpolate(block.source || '', vars);
      let value = '';
      try {
        const re = new RegExp(block.pattern || '', block.flags || 'i');
        if (block.allMatches) value = [...src.matchAll(new RegExp(block.pattern || '', (block.flags || 'i').includes('g') ? block.flags : (block.flags || 'i') + 'g'))].map(m => m[Number(block.group || 0)] || '').join('\n');
        else { const m = src.match(re); value = m ? (m[Number(block.group || 0)] || '') : ''; }
      } catch (err) { throw new Error(rt('runtime.invalidRegex') + ': ' + err.message); }
      vars[block.resultName || 'regex_talalat'] = value;
      return { ok: true, value };
    }

    if (block.type === 'textSearch') {
      const hits = await scanWithScrolling(() => findTextOccurrences(block, vars), block);
      const first = hits[0] || null;
      vars[block.resultName || 'szoveg_talalat'] = hits.length ? 'true' : 'false';
      vars[block.countName || 'szoveg_talalat_db'] = String(hits.length);
      vars[block.contextName || 'szoveg_talalat_szoveg'] = first?.context || '';
      vars[block.placeName || 'szoveg_talalat_hely'] = first?.place || '';
      vars[block.selectorName || 'szoveg_talalat_selector'] = first?.selector || '';
      vars[block.xpathName || 'szoveg_talalat_xpath'] = first?.xpath || '';
      vars[block.elementName || 'szoveg_talalat_elem'] = first?.element ? descriptor(first.element) : '';
      vars[block.rowSelectorName || 'szoveg_talalat_sor_selector'] = first?.rowSelector || '';
      vars[block.clickableSelectorName || 'szoveg_talalat_click_selector'] = first?.clickableSelector || '';
      vars[block.parentSelectorName || 'szoveg_talalat_panel_selector'] = first?.parentSelector || '';
      vars[block.nearButtonSelectorName || 'szoveg_talalat_gomb_selector'] = first?.nearButtonSelector || '';
      vars.szoveg_talalat_lista = hits.slice(0, 25).map(h => `${h.place} | ${h.selector} | ${h.context}`).join('\n');
      return { ok: true, found: hits.length > 0, count: hits.length, first: first ? { place: first.place, selector: first.selector, context: first.context } : null };
    }

    if (block.type === 'errorSearch') {
      const hits = findErrorMessages(block);
      const first = hits[0];
      vars[block.resultName || 'hiba_van'] = hits.length ? 'true' : 'false';
      vars[block.countName || 'hiba_db'] = String(hits.length);
      vars[block.textName || 'hiba_szoveg'] = first?.text || '';
      vars[block.selectorName || 'hiba_selector'] = first?.selector || '';
      return { ok: true, found: hits.length > 0, value: first?.text || '' };
    }
    if (block.type === 'fieldByLabel') {
      const el = findFieldByLabelText(interpolate(block.labelText || '', vars), block);
      if (!el) {
        if (shouldSoftFailMissingField(block)) {
          vars[block.resultName || 'mezo_ertek'] = '';
          vars[block.selectorName || 'mezo_selector'] = '';
          vars[block.xpathName || 'mezo_xpath'] = '';
          vars[block.elementName || 'mezo_elem'] = '';
          return { ok: true, skipped: true, value: '', reason: 'snow-field-by-label-not-found' };
        }
        throw new Error(rt('runtime.fieldByLabelNotFound', { label: block.labelText || '' }));
      }
      const val = getElementValue(el, 'auto');
      vars[block.resultName || 'mezo_ertek'] = val;
      vars[block.selectorName || 'mezo_selector'] = cssPath(el);
      vars[block.xpathName || 'mezo_xpath'] = xpathFor(el);
      vars[block.elementName || 'mezo_elem'] = descriptor(el);
      return { ok: true, value: val };
    }

    if (block.type === 'userInput') {
      const res = await showInputPrompt(block, vars, dryRun, 'input');
      vars[block.resultName || 'user_input'] = res.value || '';
      return { ok: true, value: res.value || '', dryRun };
    }
    if (block.type === 'userChoice') {
      const res = await showInputPrompt(block, vars, dryRun, 'choice');
      vars[block.resultName || 'valasztas'] = res.value || '';
      return { ok: true, value: res.value || '', dryRun };
    }
    if (block.type === 'tableExtract') {
      const el = await waitForElement(block.target, Number(block.timeoutMs || 5000), { requireVisible: false });
      if (!el) throw new Error(rt('runtime.tableNotFound', { label: block.target?.label || '' }));
      const value = await tableCellValueWithVirtualScroll(el, block, vars);
      vars[block.resultName || 'tabla_adat'] = value;
      return { ok: true, value };
    }
    if (block.type === 'waitLoad') {
      if (dryRun) return { ok: true, dryRun };
      const ok = await waitForLoadBlock(block, vars);
      if (!ok && block.onTimeout === 'continue') return { ok: true, timeout: true };
      if (!ok) throw new Error(rt('runtime.waitLoadTimeout'));
      return { ok: true };
    }

    if (block.type === 'waitUntil') {
      const start = Date.now();
      const timeout = Number(block.timeoutMs || 10000);
      let ok = false;
      let prevValue = null;
      let prevUrl = location.href;
      if (block.conditionMode === 'domStable') ok = await waitDomStable(Number(block.stableMs || 800), timeout);
      while (!ok && Date.now() - start < timeout) {
        if (block.conditionMode === 'elementExists') ok = Boolean(findElement(block.target, { requireVisible: false, shadowSearch: block.shadowSearch !== false }));
        else if (block.conditionMode === 'elementVisible') ok = Boolean(findElement(block.target, { requireVisible: true, shadowSearch: block.shadowSearch !== false }));
        else if (block.conditionMode === 'elementHidden') ok = !Boolean(findElement(block.target, { requireVisible: true, shadowSearch: block.shadowSearch !== false }));
        else if (block.conditionMode === 'elementClickable') { const e = findElement(block.target, { requireVisible: true, shadowSearch: block.shadowSearch !== false }); ok = Boolean(e && closestClickable(e)); }
        else if (block.conditionMode === 'valueContains') {
          const el = findElement(block.target, { requireVisible: false, shadowSearch: block.shadowSearch !== false });
          ok = el ? compareTextValue(getElementValue(el, 'auto'), block.operator || 'contains', interpolate(block.value || block.text || '', vars), false) : false;
        } else if (block.conditionMode === 'valueChanges') {
          const el = findElement(block.target, { requireVisible: false, shadowSearch: block.shadowSearch !== false });
          const now = el ? getElementValue(el, 'auto') : '';
          if (prevValue != null && now !== prevValue) ok = true;
          prevValue = now;
        } else if (block.conditionMode === 'urlChanges') { ok = location.href !== prevUrl; }
        else if (block.conditionMode === 'urlContains') ok = location.href.includes(interpolate(block.value || block.text || '', vars));
        else if (block.conditionMode === 'spinnerGone') ok = spinnerCandidates(block.spinnerSelector || '').length === 0;
        else ok = (document.body.innerText || '').toLowerCase().includes(interpolate(block.text || block.value || '', vars).toLowerCase());
        if (ok) break;
        await sleep(200);
      }
      if (!ok) throw new Error(rt('runtime.waitUntilTimeout'));
      return { ok: true };
    }
    if (block.type === 'scroll') {
      if (block.mode === 'page') {
        if (!dryRun && block.direction === 'untilText') {
          const searchBlock = {
            ...block,
            query: interpolate(block.searchText || block.query || '', vars),
            operator: block.operator || 'contains',
            searchScope: block.searchScope || 'all',
            includeValues: block.includeValues !== false,
            includeAttributes: block.includeAttributes !== false,
            scrollSearch: true
          };
          const hits = await scanWithScrolling(() => findTextOccurrences(searchBlock, vars), searchBlock);
          const first = hits[0];
          if (first?.element) await scrollElementIntoViewSmart(first.element, { block, align: block.align || 'center' });
          if (!first) throw new Error(rt('runtime.scrollTextNotFound', { text: block.searchText || '' }));
        } else {
          let container = null;
          if (block.scrollTarget === 'container' && block.scrollContainer) container = findElement(block.scrollContainer, { requireVisible: false, shadowSearch: block.shadowSearch !== false });
          if (!container && (block.scrollTarget === 'nearest' || block.scrollTarget === 'auto')) container = resolveSearchScrollContainers(block)[0];
          if (!container) container = document.scrollingElement || document.documentElement;
          if (!dryRun) {
            if (container === document.scrollingElement || container === document.documentElement || container === document.body) {
              if (block.direction === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
              else if (block.direction === 'bottom') window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
              else window.scrollBy({ top: (block.direction === 'up' ? -1 : 1) * Number(block.amount || 500), behavior: 'smooth' });
            } else {
              if (block.direction === 'top') container.scrollTop = 0;
              else if (block.direction === 'bottom') container.scrollTop = container.scrollHeight;
              else container.scrollTop += (block.direction === 'up' ? -1 : 1) * Number(block.amount || 500);
            }
          }
        }
      } else {
        const target = targetForBlock(block, vars);
        const el = await waitForElement(target, 5000, { requireVisible: false, shadowSearch: block.shadowSearch !== false });
        if (!el) throw new Error(rt('runtime.scrollTargetNotFound'));
        if (!dryRun) await scrollElementIntoViewSmart(el, { block, align: block.align || 'center' });
      }
      return { ok: true, dryRun };
    }
    if (block.type === 'keyPress') {
      const el = block.target ? await waitForElement(block.target, 3000, { requireVisible: false }) : document.activeElement;
      if (el && el.focus) el.focus();
      const key = block.key || 'Enter';
      if (!dryRun) {
        const init = { key, bubbles: true, cancelable: true, ctrlKey: Boolean(block.ctrl), altKey: Boolean(block.alt), shiftKey: Boolean(block.shift), metaKey: Boolean(block.meta) };
        (el || document).dispatchEvent(new KeyboardEvent('keydown', init));
        (el || document).dispatchEvent(new KeyboardEvent('keyup', init));
      }
      return { ok: true, key, dryRun };
    }
    if (block.type === 'clipboardRead') {
      let value = '';
      if (!dryRun) value = await readClipboardTextSafe();
      vars[block.resultName || 'clipboard'] = value;
      vars.last_result = value;
      vars.last_text = value;
      vars.last_value = value;
      return { ok: true, value, dryRun };
    }
    if (block.type === 'openUrl') {
      const url = interpolate(block.url || '', vars);
      if (!dryRun) await safeRuntimeSend({ type: 'BF_OPEN_URL', url, mode: block.mode || 'newTab' });
      return { ok: true, url, dryRun };
    }
    if (block.type === 'pageInfo') {
      const p = block.prefix || 'page';
      vars[`${p}_url`] = location.href;
      vars[`${p}_title`] = document.title;
      vars[`${p}_domain`] = location.hostname;
      vars[`${p}_path`] = location.pathname;
      return { ok: true };
    }
    if (block.type === 'screenshot') {
      const mode = block.action || (block.openPreview ? 'preview' : 'preview');
      const res = dryRun ? { ok: true, dataUrl: '' } : await safeRuntimeSend({
        type: 'BF_CAPTURE_VISIBLE_TAB',
        openPreview: mode === 'preview',
        restoreFocus: mode !== 'preview'
      });
      if (!dryRun && !res?.ok) throw new Error(res?.error || rt('runtime.screenshotFailed'));
      const dataUrl = res?.dataUrl || '';
      vars[block.resultName || 'screenshot_data_url'] = dataUrl;
      if (!dryRun && mode === 'download' && dataUrl) {
        const a = document.createElement('a');
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.href = dataUrl;
        a.download = `${block.fileName || 'blockflow-screenshot'}-${stamp}.png`;
        document.documentElement.appendChild(a);
        a.click();
        a.remove();
      }
      if (!dryRun && mode === 'clipboard' && dataUrl && navigator.clipboard && window.ClipboardItem) {
        const blob = await (await fetch(dataUrl)).blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]).catch(async () => { await copyText(dataUrl); });
      }
      return { ok: true, dryRun, dataUrl: dataUrl ? '[captured]' : '' };
    }

    if (block.type === 'pdfStart') {
      vars.__bfPdf = { options: pdfDefaultOptions(block, vars), items: [] };
      return { ok: true, fileName: vars.__bfPdf.options.fileName };
    }
    if (block.type === 'pdfText') {
      const pdf = ensurePdf(vars, {});
      pdf.items.push({ type: 'text', heading: interpolate(block.heading || '', vars), text: interpolate(block.text || '', vars), style: block.style || 'normal', align: block.align || 'left', fontSize: Number(block.fontSize || pdf.options.fontSize || 11), spaceAfter: Number(block.spaceAfter || 10) });
      return { ok: true };
    }
    if (block.type === 'pdfTable') {
      const pdf = ensurePdf(vars, {});
      pdf.items.push({ type: 'table', title: interpolate(block.title || '', vars), rows: interpolate(block.rows || '', vars), border: block.border !== false, columnMode: block.columnMode || '30/70', emptyValue: interpolate(block.emptyValue || '-', vars) });
      return { ok: true };
    }
    if (block.type === 'pdfScreenshot') {
      const pdf = ensurePdf(vars, {});
      const dataUrl = await getPdfScreenshotData(block, vars, dryRun);
      pdf.items.push({ type: 'image', dataUrl, caption: interpolate(block.caption || '', vars), sizeMode: block.sizeMode || 'fitWidth', pageBreakBefore: Boolean(block.pageBreakBefore), border: block.border !== false });
      return { ok: true, dryRun, dataUrl: dataUrl ? '[captured]' : '' };
    }
    if (block.type === 'pdfPageBreak') {
      const pdf = ensurePdf(vars, {});
      pdf.items.push({ type: 'pageBreak', onlyIfLowSpace: Boolean(block.onlyIfLowSpace) });
      return { ok: true };
    }
    if (block.type === 'pdfSave') {
      const pdf = ensurePdf(vars, {});
      if (!pdf.items.length) throw new Error(rt('runtime.pdfNoContent'));
      const fileName = interpolate(block.fileName || pdf.options.fileName || 'blockflow-riport.pdf', vars);
      if (!dryRun) {
        const blob = await buildPdfBlob(pdf, vars);
        saveOrPreviewPdfBlob(blob, fileName, block.action || 'downloadPreview');
      }
      vars.pdf_file_name = makeDownloadName(fileName);
      return { ok: true, fileName: vars.pdf_file_name, dryRun };
    }
    if (block.type === 'docxStart') {
      vars.__bfDocx = { options: docxDefaultOptions(block, vars), items: [] };
      return { ok: true, fileName: vars.__bfDocx.options.fileName };
    }
    if (block.type === 'docxText') {
      const docx = ensureDocx(vars, {});
      docx.items.push({ type:'text', heading: interpolate(block.heading || '', vars), text: interpolate(block.text || '', vars), style: block.style || 'normal', align: block.align || 'left' });
      return { ok: true };
    }
    if (block.type === 'docxTable') {
      const docx = ensureDocx(vars, {});
      docx.items.push({ type:'table', title: interpolate(block.title || '', vars), rows: interpolate(block.rows || '', vars), border: block.border !== false, emptyValue: interpolate(block.emptyValue || '-', vars) });
      return { ok: true };
    }
    if (block.type === 'docxScreenshot') {
      const docx = ensureDocx(vars, {});
      const dataUrl = await getPdfScreenshotData(block, vars, dryRun);
      docx.items.push({ type:'image', dataUrl, caption: interpolate(block.caption || '', vars), width: Number(block.width || 600), pageBreakBefore: Boolean(block.pageBreakBefore) });
      return { ok: true, dryRun, dataUrl: dataUrl ? '[captured]' : '' };
    }
    if (block.type === 'docxPageBreak') {
      const docx = ensureDocx(vars, {});
      docx.items.push({ type:'pageBreak' });
      return { ok: true };
    }
    if (block.type === 'docxSave') {
      const docx = ensureDocx(vars, {});
      if (!docx.items.length) throw new Error(rt('runtime.docxNoContent'));
      // If the save block still has its factory/default filename, prefer the
      // filename configured on DOCX indítása. This makes the document start
      // block the primary place for naming, matching the PDF/DOCX flow UX.
      const rawSaveName = String(block.fileName || '').trim();
      const defaultSaveNames = new Set(['', '{{today}}_blockflow-riport.docx', '{{today}}_riport.docx', 'blockflow-riport.docx', 'riport.docx']);
      const chosenName = defaultSaveNames.has(rawSaveName) && docx.options?.fileName ? docx.options.fileName : rawSaveName;
      const fileName = makeDocxName(interpolate(chosenName || docx.options.fileName || 'blockflow-riport.docx', vars));
      if (!dryRun) {
        const blob = await buildDocxBlob(docx, vars);
        downloadDocxBlob(blob, fileName);
      }
      vars.docx_file_name = makeDocxName(fileName);
      return { ok: true, fileName: vars.docx_file_name, dryRun };
    }
    if (block.type === 'preflight') {
      const target = targetForBlock(block, vars);
      const ok = Boolean(findElement(target, { requireVisible: Boolean(block.requireVisible) }));
      if (!ok && block.onFail === 'stop') throw new Error(rt('runtime.preflightFailed', { label: target?.label || block.target?.label || '' }));
      if (!ok && block.onFail === 'notify' && !dryRun) await safeRuntimeSend({ type: 'BF_SYSTEM_NOTIFICATION', title: rt('runtime.preflightNotificationTitle'), message: rt('runtime.elementNotFound', { label: target?.label || block.target?.label || '' }) });
      return { ok };
    }
    if (block.type === 'localSet') {
      if (!dryRun) await safeStorageSet({ ['bf_local_' + interpolate(block.key || '', vars)]: interpolate(block.value || '', vars) });
      return { ok: true, dryRun };
    }
    if (block.type === 'localGet') {
      const key = 'bf_local_' + interpolate(block.key || '', vars);
      const data = dryRun ? null : await safeStorageGet(key);
      vars[block.resultName || 'local_adat'] = data?.[key] ?? interpolate(block.defaultValue || '', vars);
      return { ok: true, value: vars[block.resultName || 'local_adat'] };
    }
    if (block.type === 'compare') {
      const value = compareGeneric(interpolate(block.left || '', vars), block.operator || 'equals', interpolate(block.right || '', vars));
      vars[block.resultName || 'osszehasonlitas'] = value ? 'true' : 'false';
      return { ok: true, value };
    }
    if (block.type === 'math') {
      const value = mathValue(interpolate(block.left || '0', vars), block.operator || 'add', interpolate(block.right || '0', vars));
      vars[block.resultName || 'szamitas'] = String(value);
      return { ok: true, value };
    }
    if (block.type === 'findElements') {
      const els = findElementsForBlock(block, Number(block.maxItems || 50));
      vars[block.countName || 'talalat_db'] = String(els.length);
      vars[block.resultName || 'talalatok'] = els.map(el => (getElementValue(el, 'auto') || el.innerText || el.textContent || '').trim()).join('\n');
      return { ok: true, count: els.length };
    }
    if (block.type === 'emailTemplate') {
      const res = await safeRuntimeSend({ type: 'BF_GET_TEMPLATES' });
      const templates = Array.isArray(res?.templates) ? res.templates : [];
      const t = templates.find(x => x.id === block.templateId || x.name === block.templateId) || templates[0];
      if (!t) throw new Error('Nincs email sablon.');
      vars[block.resultName || 'email_draft'] = { to: interpolate(block.to || '', vars), subject: interpolate(t.subject || '', vars), body: interpolate(t.body || '', vars) };
      return { ok: true };
    }
    if (block.type === 'emailPreview') {
      const draft = vars[block.draftName || 'email_draft'];
      if (!draft) throw new Error(rt('runtime.noEmailDraftForPreview'));
      const res = await safeRuntimeSend({ type: 'BF_USER_PROMPT', promptType: 'emailPreview', title: draft.subject || rt('runtime.emailPreviewTitle'), message: rt('runtime.emailPreviewMessage', { to: draft.to, body: draft.body }), mode: 'wait', options: [rt('runtime.emailOpenClient'),rt('runtime.emailBodyToClipboard'),rt('button.cancel')], buttonText: 'OK', cancelText: rt('button.cancel'), feedbackStyle: block.feedbackStyle || 'default', accent: block.accent || 'blue', windowSize: block.windowSize || 'large' });
      const action = res?.value || res?.action || '';
      vars[block.resultName || 'email_preview_action'] = action;
      if (!dryRun && action === rt('runtime.emailOpenClient')) await executeBlock({ type:'openEmail', draftName: block.draftName || 'email_draft', maxUrlLength: 1800 }, vars, options);
      if (!dryRun && action === rt('runtime.emailBodyToClipboard')) await copyText(draft.body || '');
      if (action === rt('button.cancel') || res?.action === 'cancel') throw new Error(rt('runtime.emailPreviewCancelled'));
      return { ok: true, action };
    }
    if (block.type === 'validateData') {
      const value = interpolate(block.source || '', vars);
      const ok = validateValue(value, block.validation || 'notEmpty', interpolate(block.pattern || '', vars));
      if (!ok && (block.onFail || 'stop') === 'stop') throw new Error(rt('runtime.validationFailed', { validation: block.validation || 'notEmpty' }));
      return { ok };
    }
    if (block.type === 'comment') return { ok: true, skipped: true };
    if (block.type === 'returnResult') {
      vars[block.resultName || 'result'] = interpolate(block.value || '', vars);
      return { ok: true };
    }
    if (block.type === 'stopRun') throw new Error(interpolate(block.message || rt('runtime.runStopped'), vars));
    if (block.type === 'sound') {
      if (!dryRun) {
        const repeat = Math.max(1, Math.min(10, Number(block.repeatCount || 1)));
        const volume = Math.max(0, Math.min(1, Number(block.volume ?? 0.7)));
        if (block.soundSource === 'custom' && block.customSoundData) {
          for (let i = 0; i < repeat; i++) {
            const audio = new Audio(block.customSoundData);
            audio.volume = volume;
            await audio.play().catch(() => {});
            await new Promise(r => setTimeout(r, Math.max(250, Number(block.customDelayMs || 700))));
          }
        } else {
          for (let i = 0; i < repeat; i++) {
            const ac = new AudioContext();
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.frequency.value = block.tone === 'error' ? 220 : block.tone === 'notify' ? 660 : 880;
            gain.gain.value = 0.04 * volume;
            osc.connect(gain); gain.connect(ac.destination); osc.start();
            await new Promise(r => setTimeout(r, 180));
            try { osc.stop(); ac.close(); } catch (_) {}
          }
        }
      }
      return { ok: true, dryRun };
    }
    if (block.type === 'popupWindowWait') {
      const res = dryRun ? { tabId: 'dry-run' } : await safeRuntimeSend({ type: 'BF_WAIT_FOR_TAB', matchMode: block.matchMode || 'urlContains', value: interpolate(block.value || '', vars), timeoutMs: Number(block.timeoutMs || 15000) });
      if (!res?.ok && !dryRun) throw new Error(res?.error || rt('runtime.popupWindowNotFound'));
      vars[block.resultName || 'popup_tab_id'] = String(res?.tabId || '');
      return { ok: true };
    }
    if (block.type === 'popupWindowClose') {
      if (!dryRun) await safeRuntimeSend({ type: 'BF_CLOSE_TAB', tabId: Number(vars[block.tabVar || 'popup_tab_id']) });
      return { ok: true };
    }
    if (block.type === 'popupWindowExtract') {
      const tabId = Number(vars[block.tabVar || 'popup_tab_id']);
      const res = dryRun ? null : await safeRuntimeSend({ type: 'BF_EXTRACT_FROM_TAB', tabId, target: block.target, extractMode: block.extractMode || 'auto', attributeName: block.attributeName || 'title', timeoutMs: Number(block.timeoutMs || 5000) });
      if (!dryRun && !res?.ok) throw new Error(res?.error || rt('runtime.popupWindowExtractError'));
      vars[block.varName || 'popup_adat'] = res?.value || '';
      return { ok: true };
    }
    if (block.type === 'userPrompt') {
      const result = await showUserPrompt(block, vars, dryRun);
      if (block.resultName) vars[block.resultName] = result.action || 'continue';
      return { ok: true, action: result.action, dryRun };
    }
    if (block.type === 'pageButton') {
      return await showPageButton(block, vars, dryRun);
    }
    if (block.type === 'systemNotify') {
      const title = interpolate(block.title || 'BlockFlow', vars);
      const message = interpolate(block.message || '', vars);
      if (!dryRun) await safeRuntimeSend({ type: 'BF_SYSTEM_NOTIFICATION', title, message });
      return { ok: true, title, message, dryRun };
    }
    if (block.type === 'copy') {
      const value = interpolate(block.value || '', vars);
      if (!dryRun) await copyText(value);
      return { ok: true, value, dryRun };
    }
    if (block.type === 'mask') {
      const value = maskValue(block, vars);
      vars[block.resultName || 'maszkolt_adat'] = value;
      return { ok: true, value };
    }
    if (block.type === 'email') {
      vars[block.resultName || 'email_draft'] = {
        to: interpolate(block.to || '', vars),
        subject: interpolate(block.subject || '', vars),
        body: interpolate(block.body || '', vars)
      };
      return { ok: true };
    }
    if (block.type === 'openEmail') {
      const draft = vars[block.draftName || 'email_draft'];
      if (!draft) throw new Error(rt('runtime.noEmailDraft'));
      const full = `mailto:${encodeURIComponent(draft.to)}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
      if (!dryRun) {
        if (full.length > Number(block.maxUrlLength || 1800)) {
          await copyText(draft.body);
          const shortUrl = `mailto:${encodeURIComponent(draft.to)}?subject=${encodeURIComponent(draft.subject)}`;
          await safeRuntimeSend({ type: 'OPEN_MAILTO', url: shortUrl, preserveFocus: true });
          alert(rt('runtime.emailBodyCopiedBecauseMailtoTooLong'));
        } else {
          await safeRuntimeSend({ type: 'OPEN_MAILTO', url: full, preserveFocus: true });
        }
      }
      return { ok: true, dryRun };
    }
    return { ok: true, ignored: true };
  }

  async function conditionPass(block, vars) {
    if (block.conditionMode === 'elementExists') return Boolean(await waitForElement(block.target, Number(block.timeoutMs || 1000)));
    if (block.conditionMode === 'valueContains') {
      const el = await waitForElement(block.target, Number(block.timeoutMs || 1000), { requireVisible: false, shadowSearch: block.shadowSearch !== false });
      const hay = getElementValue(el, 'auto').toLowerCase();
      return hay.includes(interpolate(block.value || '', vars).toLowerCase());
    }
    if (block.conditionMode === 'valueEmpty') {
      const el = await waitForElement(block.target, Number(block.timeoutMs || 1000), { requireVisible: false, shadowSearch: block.shadowSearch !== false });
      if (!el) return false;
      return !String(getElementActualFieldValue(el) || '').trim();
    }
    return document.body.innerText.toLowerCase().includes(interpolate(block.text || '', vars).toLowerCase());
  }

  function workflowSessionKey(workflow) {
    return `${workflow?.id || 'workflow'}:${location.origin || location.hostname || 'page'}`;
  }

  function getWorkflowSession(workflow) {
    const key = workflowSessionKey(workflow);
    if (!workflowSessions.has(key)) workflowSessions.set(key, { key, vars: {} });
    return workflowSessions.get(key);
  }

  function freshBaseVars() {
    return { current_url: location.href, today: new Date().toISOString().slice(0, 10), selected_text: String(getSelection?.() || ''), last_result: '', last_text: '', last_value: '', last_selector: '', last_xpath: '', last_element: '', last_screenshot: '' };
  }

  function resetSessionVars(vars) {
    for (const key of Object.keys(vars || {})) delete vars[key];
    Object.assign(vars, freshBaseVars());
    return vars;
  }

  function cssSafeId(value) {
    return String(value || '').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'main';
  }

  function parsePanelButtons(text) {
    return String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean).map((line, index) => {
      const parts = line.split('|');
      const label = (parts.shift() || '').trim() || `Gomb ${index + 1}`;
      const actionKey = (parts.join('|') || label).trim();
      return { label, actionKey };
    });
  }

  async function runWorkflow(workflow, options = {}) {
    await ensureRuntimeI18n();
    stopRequested = false;
    const session = getWorkflowSession(workflow);
    const vars = session.vars || {};
    Object.assign(vars, freshBaseVars(), vars);
    vars.current_url = location.href;
    vars.today = new Date().toISOString().slice(0, 10);
    vars.selected_text = String(getSelection?.() || '');
    session.vars = vars;
    const log = [];
    const publicLogger = makePublicRunLogger(workflow, options);
    const rawLogPush = log.push.bind(log);
    log.push = (...items) => {
      const n = rawLogPush(...items);
      try { items.forEach(x => publicLogger.append(x)); } catch (_) {}
      return n;
    };
    const rootBlocks = workflow.blocks || [];

    function collectBlocks(list, predicate, out = []) {
      for (const block of list || []) {
        if (!block) continue;
        if (predicate(block)) out.push(block);
        collectBlocks(block.children || [], predicate, out);
        collectBlocks(block.elseChildren || [], predicate, out);
      }
      return out;
    }

    const actionGroups = collectBlocks(rootBlocks, b => b.type === 'actionGroup');

    function findActionGroup(actionKey) {
      const key = String(actionKey || '').trim();
      return actionGroups.find(g => String(g.actionKey || '').trim() === key || String(g.id || '') === key || String(g.title || '').trim() === key);
    }

    function setPanelStatus(root, text, cls = '') {
      const el = root?.querySelector?.('[data-status]');
      if (!el) return;
      el.className = `status ${cls || ''}`.trim();
      el.textContent = text || '';
    }

    async function runActionGroupFromPanel(group, root, buttonDef) {
      const actionKey = String(group?.actionKey || group?.id || buttonDef?.actionKey || 'action');
      const lockKey = `${workflow.id || 'workflow'}:${actionKey}`;
      if (runningActionLocks.has(lockKey)) {
        setPanelStatus(root, rt('runtime.actionAlreadyRunning', { action: actionKey }), 'warn');
        return { skipped: true, locked: true };
      }
      runningActionLocks.add(lockKey);
      try {
        log.push(rt('runtime.actionStarted', { action: group.title || actionKey }));
        await runList(Array.isArray(group.children) ? group.children : [], `action:${actionKey}`);
        if (group.clearSessionAfterRun) {
          resetSessionVars(vars);
          log.push(rt('runtime.sessionCleared'));
        }
        log.push(rt('runtime.actionFinished', { action: group.title || actionKey }));
        return { ok: true };
      } finally {
        runningActionLocks.delete(lockKey);
      }
    }

    async function showPageControlPanel(block) {
      if (options.dryRun) return { ok: true, dryRun: true };
      const panelId = cssSafeId(`${workflow.id || 'workflow'}-${block.id || block.panelId || 'panel'}-${interpolate(block.panelId || 'main', vars)}`);
      const domId = `bf-page-control-panel-${panelId}`;
      const workflowKey = workflowRunLockKey(workflow);
      const panelSignature = JSON.stringify({
        title: block.title || '', buttonsText: block.buttonsText || '', position: block.position || 'bottomRight',
        customLeft: block.customLeft ?? '', customRight: block.customRight ?? '', customTop: block.customTop ?? '', customBottom: block.customBottom ?? '', customUnit: block.customUnit || 'px', customZIndex: block.customZIndex || 2147483647,
        width: block.width ?? 260, panelTheme: block.panelTheme || 'dark', panelOpacityPct: block.panelOpacityPct ?? block.panelOpacity ?? 94, panelPadding: block.panelPadding ?? 10, panelRadius: block.panelRadius ?? 16,
        layout: block.layout || 'vertical', buttonColumns: block.buttonColumns ?? 2, buttonRowAlign: block.buttonRowAlign || 'stretch',
        buttonSize: block.buttonSize || 'normal', buttonMinHeight: block.buttonMinHeight ?? 38, buttonPaddingY: block.buttonPaddingY ?? 8, buttonPaddingX: block.buttonPaddingX ?? 11,
        buttonGap: block.buttonGap ?? 8, buttonFontSize: block.buttonFontSize ?? 13, buttonRadius: block.buttonRadius ?? 10, buttonOpacityPct: block.buttonOpacityPct ?? block.buttonOpacity ?? 100,
        buttonStyle: block.buttonStyle || 'primary', buttonAlign: block.buttonAlign || 'center', showHeader: block.showHeader !== false, showStatus: block.showStatus !== false, closeButton: block.closeButton !== false
      });
      const existing = document.getElementById(domId);
      const existingSignature = existing?.getAttribute?.('data-blockflow-panel-signature') || '';
      if (existing && (block.duplicateMode || 'keep') === 'keep' && existingSignature === panelSignature) {
        activePanelWorkflowLocks.add(workflowKey);
        return { ok: true, existing: true };
      }
      if (existing) existing.remove();
      activePanelWorkflowLocks.add(workflowKey);

      const buttons = parsePanelButtons(interpolate(block.buttonsText || '', vars));
      const host = document.createElement('div');
      host.id = domId;
      host.setAttribute('data-blockflow-control-panel', '1');
      host.setAttribute('data-blockflow-panel-signature', panelSignature);
      const root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;

      const clampNum = (value, fallback, min, max) => {
        const n = Number(value);
        if (!Number.isFinite(n)) return fallback;
        return Math.max(min, Math.min(max, n));
      };
      const choice = (value, allowed, fallback) => allowed.includes(String(value || '')) ? String(value) : fallback;
      const width = clampNum(block.width, 260, 160, 900);
      const panelOpacityLegacy = block.panelOpacity;
      const panelOpacityRaw = block.panelOpacityPct ?? ((panelOpacityLegacy !== undefined && panelOpacityLegacy !== '') ? (Number(panelOpacityLegacy) <= 1 ? Number(panelOpacityLegacy) * 100 : panelOpacityLegacy) : 94);
      const buttonOpacityLegacy = block.buttonOpacity;
      const buttonOpacityRaw = block.buttonOpacityPct ?? ((buttonOpacityLegacy !== undefined && buttonOpacityLegacy !== '') ? (Number(buttonOpacityLegacy) <= 1 ? Number(buttonOpacityLegacy) * 100 : buttonOpacityLegacy) : 100);
      const panelOpacity = clampNum(panelOpacityRaw, 94, 5, 100) / 100;
      const buttonOpacity = clampNum(buttonOpacityRaw, 100, 5, 100) / 100;
      const panelPadding = clampNum(block.panelPadding, 10, 0, 36);
      const panelRadius = clampNum(block.panelRadius, 16, 0, 48);
      const layout = choice(block.layout, ['vertical', 'horizontal', 'grid'], 'vertical');
      const buttonColumns = Math.round(clampNum(block.buttonColumns, 2, 1, 6));
      const buttonSize = choice(block.buttonSize, ['small', 'normal', 'large', 'custom'], 'normal');
      const buttonGap = clampNum(block.buttonGap, 8, 0, 40);
      const buttonFontSize = clampNum(block.buttonFontSize, 13, 10, 24);
      const buttonRadius = clampNum(block.buttonRadius, 10, 0, 48);
      const buttonAlign = choice(block.buttonAlign, ['left', 'center', 'right'], 'center');
      const buttonRowAlign = choice(block.buttonRowAlign, ['stretch', 'left', 'center', 'right', 'spaceBetween'], 'stretch');
      const buttonJustify = buttonAlign === 'left' ? 'flex-start' : (buttonAlign === 'right' ? 'flex-end' : 'center');
      const rowJustifyMap = { stretch: 'stretch', left: 'flex-start', center: 'center', right: 'flex-end', spaceBetween: 'space-between' };
      const rowAlignMap = { stretch: 'stretch', left: 'flex-start', center: 'center', right: 'flex-end', spaceBetween: 'stretch' };
      const rowJustify = rowJustifyMap[buttonRowAlign] || 'stretch';
      const rowAlignItems = rowAlignMap[buttonRowAlign] || 'stretch';
      const buttonsStretch = buttonRowAlign === 'stretch';
      const showHeader = block.showHeader !== false;

      const sizeMap = {
        small: { minHeight: 30, padY: 6, padX: 9 },
        normal: { minHeight: 38, padY: 8, padX: 11 },
        large: { minHeight: 48, padY: 12, padX: 16 }
      };
      const size = sizeMap[buttonSize] || {
        minHeight: clampNum(block.buttonMinHeight, 38, 24, 96),
        padY: clampNum(block.buttonPaddingY, 8, 0, 40),
        padX: clampNum(block.buttonPaddingX, 11, 0, 60)
      };

      function themeValues(name) {
        const theme = choice(name, ['dark', 'light', 'blue', 'transparent'], 'dark');
        if (theme === 'light') return {
          name: theme,
          bg: 'rgba(255,255,255,.98)', fg: '#0f172a', muted: '#334155',
          border: 'rgba(15,23,42,.18)', headBg: 'rgba(15,23,42,.06)', headBorder: 'rgba(15,23,42,.10)',
          statusBorder: 'rgba(15,23,42,.10)', closeBg: 'rgba(15,23,42,.08)', closeFg: '#0f172a',
          shadow: '0 18px 50px rgba(15,23,42,.22)', empty: '#b91c1c', ok: '#166534', warn: '#92400e', err: '#b91c1c'
        };
        if (theme === 'blue') return {
          name: theme,
          bg: 'rgba(30,64,175,.96)', fg: '#eff6ff', muted: '#dbeafe',
          border: 'rgba(219,234,254,.28)', headBg: 'rgba(255,255,255,.12)', headBorder: 'rgba(255,255,255,.16)',
          statusBorder: 'rgba(255,255,255,.16)', closeBg: 'rgba(255,255,255,.14)', closeFg: '#eff6ff',
          shadow: '0 18px 50px rgba(30,64,175,.28)', empty: '#fecaca', ok: '#bbf7d0', warn: '#fde68a', err: '#fecaca'
        };
        if (theme === 'transparent') return {
          name: theme,
          bg: 'rgba(15,23,42,.78)', fg: '#f8fafc', muted: '#cbd5e1',
          border: 'rgba(255,255,255,.24)', headBg: 'rgba(255,255,255,.08)', headBorder: 'rgba(255,255,255,.12)',
          statusBorder: 'rgba(255,255,255,.12)', closeBg: 'rgba(255,255,255,.10)', closeFg: '#f8fafc',
          shadow: '0 18px 50px rgba(0,0,0,.22)', empty: '#fecaca', ok: '#bbf7d0', warn: '#fde68a', err: '#fecaca'
        };
        return {
          name: 'dark',
          bg: 'rgba(15,23,42,.96)', fg: '#f8fafc', muted: '#cbd5e1',
          border: 'rgba(255,255,255,.20)', headBg: 'rgba(255,255,255,.10)', headBorder: 'rgba(255,255,255,.12)',
          statusBorder: 'rgba(255,255,255,.10)', closeBg: 'rgba(255,255,255,.10)', closeFg: '#f8fafc',
          shadow: '0 18px 50px rgba(0,0,0,.32)', empty: '#fecaca', ok: '#bbf7d0', warn: '#fde68a', err: '#fecaca'
        };
      }

      function buttonValues(name, theme) {
        const style = choice(name, ['primary', 'dark', 'light', 'outline', 'success', 'danger'], 'primary');
        if (style === 'dark') return { bg: '#0f172a', hover: '#111827', fg: '#fff', border: 'rgba(255,255,255,.18)' };
        if (style === 'light') return { bg: '#f8fafc', hover: '#e2e8f0', fg: '#0f172a', border: 'rgba(15,23,42,.18)' };
        if (style === 'outline') return { bg: 'transparent', hover: theme.name === 'light' ? 'rgba(15,23,42,.08)' : 'rgba(255,255,255,.12)', fg: theme.fg, border: theme.name === 'light' ? 'rgba(15,23,42,.26)' : 'rgba(255,255,255,.32)' };
        if (style === 'success') return { bg: '#16a34a', hover: '#15803d', fg: '#fff', border: 'rgba(255,255,255,.16)' };
        if (style === 'danger') return { bg: '#dc2626', hover: '#b91c1c', fg: '#fff', border: 'rgba(255,255,255,.16)' };
        return { bg: '#2563eb', hover: '#1d4ed8', fg: '#fff', border: 'rgba(255,255,255,.16)' };
      }

      const theme = themeValues(block.panelTheme || 'dark');
      const btnStyle = buttonValues(block.buttonStyle || 'primary', theme);
      const horizontalBasis = Math.max(88, Math.floor((width - buttonGap) / 2));
      const layoutCss = layout === 'grid'
        ? (buttonsStretch
          ? `.body{display:grid;grid-template-columns:repeat(${buttonColumns},minmax(0,1fr));justify-content:stretch;justify-items:stretch}.bf-btn{width:100%}`
          : `.body{display:grid;grid-template-columns:repeat(${buttonColumns},max-content);justify-content:${rowJustify};justify-items:${rowAlignItems}}.bf-btn{width:auto;max-width:100%;min-width:80px}`)
        : (layout === 'horizontal'
          ? (buttonsStretch
            ? `.body{display:flex;flex-direction:row;flex-wrap:wrap;justify-content:stretch}.bf-btn{flex:1 1 ${horizontalBasis}px;min-width:80px}`
            : `.body{display:flex;flex-direction:row;flex-wrap:wrap;justify-content:${rowJustify};align-items:center}.bf-btn{flex:0 0 auto;min-width:80px;max-width:100%}`)
          : (buttonsStretch
            ? `.body{display:flex;flex-direction:column;align-items:stretch}.bf-btn{width:100%}`
            : `.body{display:flex;flex-direction:column;align-items:${rowAlignItems}}.bf-btn{width:auto;max-width:100%}`));

      root.innerHTML = `
        <style>
          :host{all:initial}
          *{box-sizing:border-box}
          .panel{width:${width}px;max-width:calc(100vw - 32px);border-radius:${panelRadius}px;background:${theme.bg};color:${theme.fg};border:1px solid ${theme.border};box-shadow:${theme.shadow};font:13px/1.35 system-ui,-apple-system,Segoe UI,Arial,sans-serif;overflow:hidden;backdrop-filter:blur(8px);opacity:${panelOpacity}}
          .head{display:flex;align-items:center;gap:8px;padding:10px 12px;background:${theme.headBg};border-bottom:1px solid ${theme.headBorder}}
          .head b{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:800;color:${theme.fg}}
          .close{all:unset;cursor:pointer;border-radius:8px;padding:2px 8px;background:${theme.closeBg};color:${theme.closeFg};font-weight:800;line-height:1.4}
          .body{gap:${buttonGap}px;padding:${panelPadding}px}
          ${layoutCss}
          .bf-btn{all:unset;display:flex;align-items:center;justify-content:${buttonJustify};gap:8px;min-height:${size.minHeight}px;padding:${size.padY}px ${size.padX}px;border-radius:${buttonRadius}px;background:${btnStyle.bg};color:${btnStyle.fg};font-weight:800;font-size:${buttonFontSize}px;text-align:${buttonAlign};cursor:pointer;box-shadow:inset 0 0 0 1px ${btnStyle.border};border:1px solid ${btnStyle.border};opacity:${buttonOpacity};word-break:break-word}
          .bf-btn:hover{background:${btnStyle.hover};opacity:${Math.min(1, buttonOpacity + 0.08)}}
          .bf-btn:active{transform:translateY(1px)}
          .bf-btn:disabled{opacity:.55;cursor:wait;transform:none}
          .status{padding:8px 10px;border-top:1px solid ${theme.statusBorder};color:${theme.muted};font-size:12px;min-height:30px}
          .status.ok{color:${theme.ok}}
          .status.err{color:${theme.err}}
          .status.warn{color:${theme.warn}}
          .empty{padding:10px;color:${theme.empty}}
        </style>
        <div class="panel">
          ${showHeader ? `<div class="head"><b></b>${block.closeButton === false ? '' : '<button type="button" class="close" title="Close">×</button>'}</div>` : ''}
          <div class="body"></div>
          ${block.showStatus === false ? '' : '<div class="status" data-status></div>'}
        </div>`;
      const titleEl = root.querySelector('.head b');
      if (titleEl) titleEl.textContent = interpolate(block.title || 'BlockFlow', vars);
      const body = root.querySelector('.body');
      if (!buttons.length) {
        const empty = document.createElement('div');
        empty.className = 'empty';
        empty.textContent = rt('runtime.panelNoButtons');
        body.appendChild(empty);
      }
      for (const btnDef of buttons) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bf-btn';
        btn.textContent = btnDef.label;
        btn.title = btnDef.actionKey;
        btn.addEventListener('click', async () => {
          const group = findActionGroup(btnDef.actionKey);
          if (!group) { setPanelStatus(root, rt('runtime.actionGroupMissing', { action: btnDef.actionKey }), 'err'); return; }
          btn.disabled = true;
          setPanelStatus(root, rt('runtime.actionRunning', { action: btnDef.label }), 'warn');
          try {
            await runActionGroupFromPanel(group, root, btnDef);
            setPanelStatus(root, rt('runtime.actionDone', { action: btnDef.label }), 'ok');
          } catch (err) {
            console.warn('BlockFlow action group error', err);
            setPanelStatus(root, rt('runtime.actionFailed', { action: btnDef.label, error: String(err?.message || err) }), 'err');
          } finally {
            btn.disabled = false;
          }
        });
        body.appendChild(btn);
      }
      const close = root.querySelector('.close');
      if (close) close.addEventListener('click', () => { activePanelWorkflowLocks.delete(workflowKey); host.remove(); });
      positionBlockFlowButton(host, block.position || 'bottomRight', block);
      document.body.appendChild(host);
      setPanelStatus(root, rt('runtime.panelReady'), 'ok');
      return { ok: true, buttons: buttons.length, layout };
    }

    function watcherFromTriggerBlock(block) {
      return {
        id: `manual-check:${workflow.id || 'workflow'}:${block.id || Math.random()}`,
        workflowId: workflow.id || '',
        sourceBlockId: block.id || '',
        mode: 'group',
        enabled: block.triggerEnabled !== false,
        logic: block.logic || 'all',
        conditions: Array.isArray(block.children) ? block.children : [],
        scope: block.scope || 'domain',
        domain: block.domain || location.hostname,
        path: block.path || location.pathname,
        url: block.url || location.href,
        urlContains: block.urlContains || '',
        throttleSec: block.throttleSec || 15,
        repeatMode: watcherRepeatMode(block),
        runOnce: watcherRepeatMode(block) === 'once',
        runPerPageLoad: watcherRepeatMode(block) === 'pageLoad'
      };
    }

    function checkWorkflowStartGate() {
      if (options.forceRun || options.skipTriggerGate || options.triggeredByWatcher || options.scheduled) {
        log.push(options.forceRun ? rt('runtime.forceRunGate') : rt('runtime.autoSubRunGate'));
        return true;
      }
      const manualTriggers = collectBlocks(rootBlocks, b => b.type === 'trigger');
      if (manualTriggers.length) {
        log.push(rt('runtime.manualTriggerFound'));
        return true;
      }
      const triggerGroups = collectBlocks(rootBlocks, b => b.type === 'triggerGroup' && b.triggerEnabled !== false);
      const clickTriggers = collectBlocks(rootBlocks, b => b.type === 'clickTrigger' && b.triggerEnabled !== false);
      if (!triggerGroups.length) {
        if (clickTriggers.length) {
          log.push(rt('runtime.clickTriggerFound', { count: clickTriggers.length }));
          return false;
        }
        log.push(rt('runtime.noActiveTrigger'));
        return true;
      }
      log.push(rt('runtime.checkingTriggers', { count: triggerGroups.length }));
      let anyPassed = false;
      for (const tg of triggerGroups) {
        const watcher = watcherFromTriggerBlock(tg);
        const scopeOk = watcherScopeMatches(watcher);
        const conditionCount = Array.isArray(watcher.conditions) ? watcher.conditions.length : 0;
        let passed = false;
        if (scopeOk && conditionCount) passed = evalWatcherGroup(watcher);
        log.push(rt('runtime.triggerResult', { id: tg.id || '', scope: scopeOk ? rt('common.true') : rt('common.false'), count: conditionCount, result: passed ? rt('common.true') : rt('common.false') }));
        if (passed) anyPassed = true;
      }
      if (!anyPassed) {
        log.push(rt('runtime.noTriggerMatched'));
      }
      return anyPassed;
    }

    const startAllowed = checkWorkflowStartGate();
    if (!startAllowed) {
      return { vars, log, skipped: true, triggerPassed: false };
    }

    async function runList(list, label = 'root') {
      let i = 0;
      while (i < list.length) {
        if (stopRequested) throw new Error(rt('runtime.runStopped'));
        const b = list[i];
        log.push(rt('runtime.blockStep', { label, index: i + 1, type: b.type, dry: options.dryRun ? ' [dry-run]' : '' }));

        if (b.type === 'trigger' || b.type === 'triggerGroup' || b.type === 'clickTrigger' || b.type === 'textShortcut' || b.type === 'scheduledTrigger' || String(b.type || '').startsWith('condition')) { i++; continue; }
        if (b.type === 'actionGroup') { i++; continue; }
        if (b.type === 'pageControlPanel') {
          const res = await showPageControlPanel(b);
          updateLastOutput(vars, b, res);
          log.push(rt('runtime.output', { type: b.type, details: ' · ' + rt('runtime.doneWord') }));
          i++;
          continue;
        }

        if (b.type === 'ifBlock') {
          const ok = await conditionPass(b, vars);
          const children = Array.isArray(b.children) ? b.children : [];
          const elseChildren = Array.isArray(b.elseChildren) ? b.elseChildren : [];
          log.push(ok ? rt('runtime.ifTrue', { count: children.length }) : rt('runtime.ifFalse', { count: elseChildren.length }));
          if (ok && children.length) await runList(children, 'if');
          if (!ok && elseChildren.length) await runList(elseChildren, 'else');
          // Backward compatibility for old workflows from v0.2-v0.5.
          if (!children.length && b.skipCount) {
            if (!ok) i += Number(b.skipCount || 0);
          }
          i++;
          continue;
        }

        if (b.type === 'repeatBlock') {
          const count = Math.max(0, Math.min(100, Number(b.repeatCount || 1)));
          const children = Array.isArray(b.children) ? b.children : [];
          if (children.length) {
            for (let r = 0; r < count; r++) {
              log.push(rt('runtime.repeatChildren', { current: r + 1, total: count, count: children.length }));
              await runList(children, 'repeat');
            }
          } else if (b.blockCount) {
            // Backward compatibility for old linear repeat blocks.
            const childStart = i + 1;
            const childEnd = Math.min(list.length, childStart + Math.max(0, Math.min(50, Number(b.blockCount || 1))));
            const legacyChildren = list.slice(childStart, childEnd);
            for (let r = 0; r < count; r++) {
              log.push(rt('runtime.repeatLegacy', { current: r + 1, total: count, count: legacyChildren.length }));
              await runList(legacyChildren, 'repeat');
            }
            i = childEnd;
            continue;
          } else {
            log.push(rt('runtime.repeatEmpty'));
          }
          i++;
          continue;
        }


        if (b.type === 'tryBlock') {
          try { await runList(Array.isArray(b.children) ? b.children : [], 'try'); }
          catch (err) { vars.last_error = String(err.message || err); await runList(Array.isArray(b.elseChildren) ? b.elseChildren : [], 'catch'); }
          i++;
          continue;
        }

        if (b.type === 'retryBlock') {
          const attempts = Math.max(1, Math.min(20, Number(b.attempts || 3)));
          const children = Array.isArray(b.children) ? b.children : [];
          let lastErr = null;
          for (let a = 0; a < attempts; a++) {
            try { await runList(children, `retry ${a + 1}`); lastErr = null; break; }
            catch (err) { lastErr = err; if (a < attempts - 1) await sleep(Number(b.delayMs || 1000)); }
          }
          if (lastErr) throw lastErr;
          i++;
          continue;
        }

        if (b.type === 'groupBlock') {
          if (b.groupEnabled === false) {
            log.push(rt('runtime.groupSkipped', { title: b.title || rt('block.groupBlock.name') }));
            i++;
            continue;
          }
          await runList(Array.isArray(b.children) ? b.children : [], 'group');
          i++;
          continue;
        }
        if (b.type === 'iframeBlock') {
          let frame = null;
          if (b.iframeMode === 'urlContains') frame = [...document.querySelectorAll('iframe,frame')].find(f => String(f.src || '').includes(interpolate(b.urlContains || '', vars)));
          else if (b.iframeMode === 'index') frame = [...document.querySelectorAll('iframe,frame')][Math.max(0, Number(b.iframeIndex || 1) - 1)];
          else frame = b.target ? await waitForElement(b.target, Number(b.timeoutMs || 5000), { requireVisible: false }) : null;
          let doc = null;
          try { doc = frame?.contentDocument; } catch (_) { doc = null; }
          if (!doc) throw new Error(rt('runtime.iframeNotAccessible'));
          bfRootStack.push(doc);
          try { await runList(Array.isArray(b.children) ? b.children : [], 'iframe'); }
          finally { bfRootStack.pop(); }
          i++;
          continue;
        }

        if (b.type === 'elementLoop') {
          const els = findElementsForBlock(b, Number(b.maxItems || 20));
          const children = Array.isArray(b.children) ? b.children : [];
          for (let eidx = 0; eidx < els.length; eidx++) {
            vars[b.itemVar || 'elem_szoveg'] = (getElementValue(els[eidx], 'auto') || els[eidx].innerText || els[eidx].textContent || '').trim();
            vars[b.indexVar || 'elem_index'] = String(eidx + 1);
            await runList(children, `element ${eidx + 1}`);
          }
          i++;
          continue;
        }

        if (b.type === 'callWorkflow') {
          const data = await safeStorageGet('workflows');
          const workflows = Array.isArray(data?.workflows) ? data.workflows : [];
          const target = workflows.find(w => w.id === b.workflowId || w.name === b.workflowId);
          if (!target) throw new Error(rt('runtime.calledWorkflowMissing', { name: b.workflowId || '' }));
          const sub = await runWorkflow(target, { ...options, skipTriggerGate: true });
          const prefix = b.resultPrefix || 'called';
          Object.entries(sub.vars || {}).forEach(([k,v]) => { vars[`${prefix}_${k}`] = v; });
          i++;
          continue;
        }

        if (b.type === 'rowLoop') {
          const container = await waitForElement(b.target, Number(b.timeoutMs || 5000));
          if (!container) throw Object.assign(new Error(rt('runtime.tableMissing', { label: b.target?.label || '' })), { blockId: b.id });
          const rows = rowsFromContainer(container, Number(b.maxRows || 20));
          const children = Array.isArray(b.children) ? b.children : [];
          log.push(rt('runtime.rowLoop', { rows: rows.length, count: children.length }));
          for (let r = 0; r < rows.length; r++) {
            vars[b.rowVar || 'sor_szoveg'] = (rows[r].innerText || rows[r].textContent || '').trim();
            vars.row_index = String(r + 1);
            rows[r].classList.add('bf-run-outline');
            await runList(children, `row ${r + 1}`);
            setTimeout(() => rows[r].classList.remove('bf-run-outline'), 500);
          }
          i++;
          continue;
        }

        try {
          const execRes = await executeBlock(b, vars, options);
          updateLastOutput(vars, b, execRes);
          if (execRes && execRes.ok !== false) {
            const details = [];
            if (execRes.value !== undefined) details.push(rt('runtime.detailValue') + '=' + String(execRes.value).slice(0, 160));
            if (execRes.count !== undefined) details.push(rt('runtime.detailCount') + '=' + execRes.count);
            if (execRes.fileName) details.push(rt('runtime.detailFile') + '=' + execRes.fileName);
            if (vars.last_selector) details.push('selector=' + String(vars.last_selector).slice(0, 120));
            log.push(rt('runtime.output', { type: b.type, details: details.length ? ' · ' + details.join(' · ') : ' · ' + rt('runtime.doneWord') }));
          }
        } catch (err) {
          err.blockId = err.blockId || b.id;
          err.partialVars = vars;
          err.partialLog = log;
          throw err;
        }
        i++;
      }
    }

    try {
      await runList(rootBlocks);
      publicLogger.done(vars);
      return { vars, log };
    } catch (err) {
      publicLogger.error(err);
      throw err;
    }
  }

  function workflowRunLockKey(workflow) {
    return String(workflow?.id || workflow?.name || 'workflow');
  }

  function isWorkflowRunning(workflow) {
    const key = workflowRunLockKey(workflow);
    return runningWorkflowLocks.has(key) || activePanelWorkflowLocks.has(key);
  }

  async function runWorkflowLocked(workflow, options = {}) {
    await ensureRuntimeI18n();
    if (options.allowParallelRuns === true) return runWorkflow(workflow, options);
    const key = workflowRunLockKey(workflow);
    if (runningWorkflowLocks.has(key) || activePanelWorkflowLocks.has(key)) {
      return { skipped: true, locked: true, reason: rt('runtime.workflowAlreadyRunning') };
    }
    runningWorkflowLocks.add(key);
    try {
      return await runWorkflow(workflow, options);
    } finally {
      runningWorkflowLocks.delete(key);
    }
  }


  function pageSummary() {
    const elements = [...document.querySelectorAll('input,textarea,select,button,a,[role="button"],[role="dialog"],[aria-modal="true"]')].filter(isVisible).slice(0, 250).map(descriptor);
    return { title: document.title, url: location.href, elements, popupDetected: Boolean(findPopup()) };
  }


  let watcherObserver = null;
  let watcherTimer = null;
  let watcherInterval = null;
  let watcherClickHandler = null;
  let watcherHotkeyHandler = null;
  let textShortcutWatchersCache = [];
  const firedWatchers = new Map();
  const pageLoadFiredWatchers = new Set();
  const pageLoadId = `${Date.now()}:${Math.random().toString(36).slice(2)}`;
  let watcherLastNavigationHref = location.href.split('#')[0];

  function watcherRepeatMode(w) {
    const mode = String(w?.repeatMode || '').trim();
    if (mode === 'continuous' || mode === 'pageLoad' || mode === 'once') return mode;
    if (w?.runPerPageLoad || w?.pageLoadOnce) return 'pageLoad';
    if (w?.runOnce) return 'once';
    return 'continuous';
  }

  function watcherPageLoadKey(w) {
    return `${pageLoadId}:${w?.id || w?.workflowId || 'watcher'}:${location.href.split('#')[0]}`;
  }

  function watcherAlreadyRanThisPageLoad(w) {
    return watcherRepeatMode(w) === 'pageLoad' && pageLoadFiredWatchers.has(watcherPageLoadKey(w));
  }

  function markWatcherStarted(w) {
    firedWatchers.set(w.id, Date.now());
    if (watcherRepeatMode(w) === 'pageLoad') pageLoadFiredWatchers.add(watcherPageLoadKey(w));
  }
  // Session-alapú értékmemória változásfigyelő feltételekhez.
  // Kulcs: workflow + trigger + feltétel + oldal URL. Oldalfrissítés után újratanul.
  const watcherValueState = new Map();
  let extensionContextDead = false;

  function isExtensionContextAlive() {
    try {
      return !extensionContextDead && Boolean(chrome?.runtime?.id);
    } catch (_) {
      return false;
    }
  }

  function isContextInvalidatedError(err) {
    return String(err?.message || err || '').toLowerCase().includes('extension context invalidated');
  }

  function stopWatchers(reason = '') {
    extensionContextDead = true;
    if (watcherObserver) { try { watcherObserver.disconnect(); } catch (_) {} watcherObserver = null; }
    if (watcherInterval) { clearInterval(watcherInterval); watcherInterval = null; }
    if (watcherTimer) { clearTimeout(watcherTimer); watcherTimer = null; }
    if (watcherClickHandler) { try { document.removeEventListener('click', watcherClickHandler, true); } catch (_) {} watcherClickHandler = null; }
    if (watcherHotkeyHandler) { try { document.removeEventListener('keydown', watcherHotkeyHandler, true); } catch (_) {} watcherHotkeyHandler = null; }
    textShortcutWatchersCache = [];
    if (reason) console.info('BlockFlow watchers stopped:', reason);
  }

  async function safeStorageGet(keys) {
    if (!isExtensionContextAlive()) {
      stopWatchers('extension context invalidated');
      return null;
    }
    try {
      return await chrome.storage.local.get(keys);
    } catch (err) {
      if (isContextInvalidatedError(err)) {
        stopWatchers('extension context invalidated');
        return null;
      }
      throw err;
    }
  }

  async function safeStorageSet(value) {
    if (!isExtensionContextAlive()) {
      stopWatchers('extension context invalidated');
      return null;
    }
    try {
      return await chrome.storage.local.set(value);
    } catch (err) {
      if (isContextInvalidatedError(err)) {
        stopWatchers('extension context invalidated');
        return null;
      }
      throw err;
    }
  }

  async function safeRuntimeSend(message) {
    if (!isExtensionContextAlive()) return { ok: false, error: 'Extension context invalidated' };
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (err) {
      if (isContextInvalidatedError(err)) stopWatchers('extension context invalidated');
      return { ok: false, error: String(err?.message || err) };
    }
  }

  async function loadWatchersAndWorkflows() {
    const data = await safeStorageGet(['watchers','workflows']);
    if (!data) return { watchers: [], workflows: [] };
    return { watchers: Array.isArray(data.watchers) ? data.watchers : [], workflows: Array.isArray(data.workflows) ? data.workflows : [] };
  }


  function findWorkflowBlock(blocks, id) {
    if (!id) return null;
    for (const b of blocks || []) {
      if (b.id === id) return b;
      const child = findWorkflowBlock(b.children || [], id);
      if (child) return child;
      const elseChild = findWorkflowBlock(b.elseChildren || [], id);
      if (elseChild) return elseChild;
    }
    return null;
  }

  function watcherBlockStillActive(w, workflow) {
    if (!w.sourceBlockId) return true;
    const block = findWorkflowBlock(workflow?.blocks || [], w.sourceBlockId);
    if (!block) return false;
    if (block.type === 'clickTrigger') return block.triggerEnabled !== false && Boolean(block.target);
    if (block.type === 'textShortcut') return block.triggerEnabled !== false && Boolean(String(block.shortcut || '').trim());
    if (block.type !== 'triggerGroup') return false;
    return block.triggerEnabled !== false && Array.isArray(block.children) && block.children.length > 0;
  }

  function watcherScopeMatches(w) {
    const scope = w.scope || 'domain';
    if (scope === 'any') return true;
    if (scope === 'domain') return !w.domain || location.hostname === w.domain || location.hostname.endsWith('.' + w.domain);
    if (scope === 'path') return (!w.domain || location.hostname === w.domain || location.hostname.endsWith('.' + w.domain)) && (!w.path || location.pathname.startsWith(w.path));
    if (scope === 'exact') return !w.url || location.href.split('#')[0] === String(w.url).split('#')[0];
    if (scope === 'contains') return !w.urlContains || location.href.includes(w.urlContains);
    return true;
  }


  function normalizeShortcutKeyName(value) {
    const raw = String(value || '').trim();
    const low = raw.toLowerCase();
    if (!raw) return '';
    if (raw === ' ' || low === 'space' || low === 'spacebar' || low === 'szóköz' || low === 'szokoz') return 'Space';
    if (low === 'enter' || low === 'return') return 'Enter';
    if (low === 'tab' || low === 'tabulator') return 'Tab';
    return raw.length === 1 ? raw : raw;
  }

  function eventShortcutKeyName(event) {
    if (!event) return '';
    if (event.key === ' ' || event.key === 'Spacebar') return 'Space';
    return event.key || '';
  }

  function delimiterMatchesShortcutWatcher(w, event) {
    if (!w || event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey) return false;
    const current = normalizeShortcutKeyName(eventShortcutKeyName(event));
    const keys = String(w.delimiterKeys || 'Space,Enter,Tab').split(/[,;\n]/).map(normalizeShortcutKeyName).filter(Boolean);
    return keys.length ? keys.includes(current) : current === 'Space';
  }

  function isTextShortcutEditable(el) {
    if (!el || el.nodeType !== 1) return false;
    const tag = el.tagName?.toLowerCase?.() || '';
    if (el.disabled || el.readOnly || el.getAttribute?.('aria-readonly') === 'true') return false;
    if (tag === 'textarea') return true;
    if (tag === 'input') {
      const type = String(el.getAttribute('type') || 'text').toLowerCase();
      return ['', 'text', 'search', 'url', 'tel'].includes(type);
    }
    if (el.isContentEditable || el.getAttribute?.('contenteditable') != null || el.classList?.contains('ql-editor') || el.getAttribute?.('role') === 'textbox' || el.getAttribute?.('aria-multiline') === 'true') return true;
    return false;
  }

  function resolveTextShortcutTarget(event) {
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    const candidates = [];
    for (const item of path) if (item && item.nodeType === 1) candidates.push(item);
    const raw = event.target && event.target.nodeType === 1 ? event.target : event.target?.parentElement;
    if (raw) candidates.push(raw);
    for (const el of candidates) {
      if (isTextShortcutEditable(el)) return el;
      const host = isServiceNowFieldHost(el) ? el : snowFieldHostFor(el);
      if (host) {
        const inner = fieldWriteTargets(host).find(isTextShortcutEditable);
        if (inner) return inner;
      }
      const closest = el.closest?.('input,textarea,[contenteditable],[role="textbox"],.ql-editor,[aria-multiline="true"]');
      if (isTextShortcutEditable(closest)) return closest;
    }
    return null;
  }

  function textShortcutBoundaryOk(before, shortcut, caseSensitive, matchMode) {
    const rawBefore = String(before || '');
    const rawShortcut = String(shortcut || '');
    if (!rawShortcut) return false;
    const beforeCmp = caseSensitive ? rawBefore : rawBefore.toLowerCase();
    const shortcutCmp = caseSensitive ? rawShortcut : rawShortcut.toLowerCase();
    if (!beforeCmp.endsWith(shortcutCmp)) return false;
    if ((matchMode || 'word') === 'suffix') return true;
    const index = rawBefore.length - rawShortcut.length;
    const prev = index > 0 ? rawBefore.charAt(index - 1) : '';
    return !prev || /[\s.,;:!?()[\]{}"'“”‘’<>\-–—/\\]/.test(prev);
  }

  function getValueSelectionState(el) {
    const value = String(('value' in el ? el.value : el.textContent) || '');
    let start = value.length;
    let end = value.length;
    try {
      if (typeof el.selectionStart === 'number' && typeof el.selectionEnd === 'number') {
        start = el.selectionStart;
        end = el.selectionEnd;
      }
    } catch (_) {}
    return { value, start, end };
  }

  function dispatchTextShortcutEvents(el, value, event) {
    const targets = fieldWriteTargets(el);
    const host = snowFieldHostFor(el);
    if (host) setHostServiceNowValue(host, value);
    for (const t of targets.length ? targets : [el]) dispatchFrameworkEvents(t, { blurAfter: false, data: value, key: event?.key || '' });
  }

  function applyTextShortcutToValueField(el, w, event) {
    const shortcut = String(w.shortcut || '');
    const replacement = String(w.replacement ?? '');
    const state = getValueSelectionState(el);
    if (state.start !== state.end) return false;
    const before = state.value.slice(0, state.start);
    if (!textShortcutBoundaryOk(before, shortcut, w.caseSensitive !== false, w.matchMode || 'word')) return false;
    const replaceStart = state.start - shortcut.length;
    try {
      if (typeof el.setRangeText === 'function') {
        el.setRangeText(replacement, replaceStart, state.start, 'end');
      } else {
        const next = state.value.slice(0, replaceStart) + replacement + state.value.slice(state.end);
        setNativeValue(el, next);
        const pos = replaceStart + replacement.length;
        if (typeof el.setSelectionRange === 'function') el.setSelectionRange(pos, pos);
      }
    } catch (_) {
      const next = state.value.slice(0, replaceStart) + replacement + state.value.slice(state.end);
      setNativeValue(el, next);
      try { const pos = replaceStart + replacement.length; el.setSelectionRange?.(pos, pos); } catch (_) {}
    }
    dispatchTextShortcutEvents(el, ('value' in el ? el.value : el.textContent) || '', event);
    return true;
  }

  function textPositionAtOffset(root, targetOffset) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let count = 0;
    let last = null;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      last = node;
      const len = node.nodeValue.length;
      if (count + len >= targetOffset) return { node, offset: Math.max(0, targetOffset - count) };
      count += len;
    }
    return last ? { node: last, offset: last.nodeValue.length } : { node: root, offset: root.childNodes.length };
  }

  function applyTextShortcutToContentEditable(el, w, event) {
    const shortcut = String(w.shortcut || '');
    const replacement = String(w.replacement ?? '');
    const sel = window.getSelection?.();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return false;
    const range = sel.getRangeAt(0);
    if (!el.contains(range.startContainer)) return false;
    const pre = range.cloneRange();
    pre.selectNodeContents(el);
    pre.setEnd(range.startContainer, range.startOffset);
    const offset = pre.toString().length;
    const fullText = el.innerText || el.textContent || '';
    const before = fullText.slice(0, offset);
    if (!textShortcutBoundaryOk(before, shortcut, w.caseSensitive !== false, w.matchMode || 'word')) return false;
    const startPos = textPositionAtOffset(el, Math.max(0, offset - shortcut.length));
    const replaceRange = document.createRange();
    replaceRange.setStart(startPos.node, startPos.offset);
    replaceRange.setEnd(range.startContainer, range.startOffset);
    replaceRange.deleteContents();
    const textNode = document.createTextNode(replacement);
    replaceRange.insertNode(textNode);
    const caret = document.createRange();
    caret.setStart(textNode, textNode.nodeValue.length);
    caret.collapse(true);
    sel.removeAllRanges();
    sel.addRange(caret);
    dispatchTextShortcutEvents(el, el.innerText || el.textContent || '', event);
    return true;
  }

  function applyTextShortcut(el, w, event) {
    if (!el || !String(w?.shortcut || '').trim()) return false;
    if (el.isContentEditable || el.getAttribute?.('contenteditable') != null || el.classList?.contains('ql-editor') || (!('value' in el) && (el.getAttribute?.('role') === 'textbox' || el.getAttribute?.('aria-multiline') === 'true'))) {
      return applyTextShortcutToContentEditable(el, w, event);
    }
    return applyTextShortcutToValueField(el, w, event);
  }

  async function refreshTextShortcutWatchers() {
    try {
      const { watchers } = await loadWatchersAndWorkflows();
      textShortcutWatchersCache = watchers.filter(w => w.enabled !== false && w.mode === 'textShortcut' && String(w.shortcut || '').trim());
    } catch (err) {
      if (isContextInvalidatedError(err)) stopWatchers('extension context invalidated');
      textShortcutWatchersCache = [];
    }
  }

  function handleTextShortcutKeydown(event) {
    try {
      if (!textShortcutWatchersCache.length) return;
      const el = resolveTextShortcutTarget(event);
      if (!el) return;
      const active = textShortcutWatchersCache
        .filter(w => watcherScopeMatches(w) && delimiterMatchesShortcutWatcher(w, event))
        .sort((a, b) => String(b.shortcut || '').length - String(a.shortcut || '').length);
      for (const w of active) {
        if (applyTextShortcut(el, w, event)) {
          if (w.keepDelimiter === false) {
            event.preventDefault();
            event.stopPropagation();
          }
          if (w.showFeedback !== false) {
            showBadge(rt('runtime.textShortcutExpanded', { shortcut: w.shortcut || '' }));
            setTimeout(removeBadge, 900);
          }
          break;
        }
      }
    } catch (err) {
      console.warn('BlockFlow text shortcut error', err);
    }
  }

  function compareTextValue(haystack, operator, needle, caseSensitive = false) {
    let h = String(haystack || '');
    let n = String(needle || '');
    if (operator === 'empty') return !String(haystack || '').trim();
    if (operator === 'notEmpty') return Boolean(String(haystack || '').trim());
    if (operator === 'regex') {
      try { return new RegExp(n, caseSensitive ? '' : 'i').test(String(haystack || '')); } catch (_) { return false; }
    }
    if (!caseSensitive) { h = h.toLowerCase(); n = n.toLowerCase(); }
    if (operator === 'notContains') return !h.includes(n);
    if (operator === 'equals') return h === n;
    if (operator === 'notEquals') return h !== n;
    if (operator === 'startsWith') return h.startsWith(n);
    if (operator === 'endsWith') return h.endsWith(n);
    return Boolean(n && h.includes(n));
  }

  function watcherStateKey(w, c) {
    const urlKey = location.href.split('#')[0];
    return `${w.workflowId || ''}:${w.sourceBlockId || w.id || ''}:${c.id || c.type || ''}:${urlKey}`;
  }

  function evalChangeCondition(c, w) {
    const el = findElement(c.target, { requireVisible: (c.searchScope || 'dom') === 'visible' });
    if (!el) return false;
    const currentValue = getElementValue(el, c.readMode || 'auto', c.attributeName || 'title');
    const key = watcherStateKey(w || {}, c);
    const prevRecord = watcherValueState.get(key);
    watcherValueState.set(key, { value: currentValue, at: Date.now() });

    const mode = c.changeMode || 'fromTo';
    const operator = c.operator || 'equals';
    const caseSensitive = Boolean(c.caseSensitive);

    // Első ellenőrzéskor alapból csak tanul. Opcionálisan engedhető, hogy
    // bármiről célértékre állapotként induljon, ha már most a célértéken van.
    if (!prevRecord) {
      if (c.firstRun === 'allowTo' && (mode === 'anyTo' || mode === 'fromTo')) {
        return compareTextValue(currentValue, operator, c.toValue || '', caseSensitive);
      }
      return false;
    }

    const previousValue = prevRecord.value;
    if (String(previousValue) === String(currentValue)) return false;

    const fromOk = compareTextValue(previousValue, operator, c.fromValue || '', caseSensitive);
    const toOk = compareTextValue(currentValue, operator, c.toValue || '', caseSensitive);
    if (mode === 'anyChange') return true;
    if (mode === 'anyTo') return toOk;
    if (mode === 'fromAny') return fromOk;
    return fromOk && toOk;
  }

  function evalWatcherCondition(c, w) {
    if (!c) return false;
    if (c.type === 'conditionText') {
      const bodyText = document.body.innerText || '';
      const needle = String(c.text || '');
      if (!needle) return false;
      return c.caseSensitive ? bodyText.includes(needle) : bodyText.toLowerCase().includes(needle.toLowerCase());
    }
    if (c.type === 'conditionElement') {
      const el = findElement(c.target, { requireVisible: c.requireVisible !== false });
      if (!el) return false;
      return c.requireVisible === false ? true : isVisible(el);
    }
    if (c.type === 'conditionField') {
      const el = findElement(c.target, { requireVisible: false });
      if (!el) return false;
      const val = getElementValue(el, 'auto');
      return compareTextValue(val, c.operator || 'contains', c.value || '', Boolean(c.caseSensitive));
    }
    if (c.type === 'conditionUrl') {
      return compareTextValue(location.href, c.operator || 'contains', c.value || '', true);
    }
    if (c.type === 'conditionChange') {
      return evalChangeCondition(c, w);
    }
    if (c.type === 'conditionGroup') {
      const children = Array.isArray(c.children) ? c.children : [];
      if (!children.length) return false;
      const results = children.map(child => evalWatcherCondition(child, w));
      if ((c.logic || 'all') === 'any') return results.some(Boolean);
      if ((c.logic || 'all') === 'none') return !results.some(Boolean);
      return results.every(Boolean);
    }
    return false;
  }

  function evalWatcherGroup(w) {
    const conditions = Array.isArray(w.conditions) ? w.conditions : [];
    if (!conditions.length) return false;
    const results = conditions.map(c => evalWatcherCondition(c, w));
    if ((w.logic || 'all') === 'any') return results.some(Boolean);
    if ((w.logic || 'all') === 'none') return !results.some(Boolean);
    return results.every(Boolean);
  }

  function eventMatchesWatcherTarget(event, w) {
    if (!w || w.mode !== 'click' || !w.target) return false;
    const configured = findElement(w.target, { requireVisible: false });
    if (!configured) return false;
    const rawTarget = event.target;
    const clicked = rawTarget && rawTarget.nodeType === 1 ? rawTarget : rawTarget?.parentElement;
    if (!clicked) return false;
    return configured === clicked || configured.contains(clicked) || Boolean(clicked.closest && configured.contains(clicked.closest('button,a,[role="button"],input,textarea,select,[tabindex]')));
  }

  async function handleWatcherClick(event) {
    if (!isExtensionContextAlive()) { stopWatchers('context not alive'); return; }
    let watchers, workflows;
    try { ({ watchers, workflows } = await loadWatchersAndWorkflows()); } catch (err) { if (isContextInvalidatedError(err)) return; return; }
    const active = watchers.filter(w => w.enabled !== false && w.mode === 'click' && watcherScopeMatches(w));
    for (const w of active) {
      try {
        if (!eventMatchesWatcherTarget(event, w)) continue;
        if (watcherAlreadyRanThisPageLoad(w)) continue;
        const last = firedWatchers.get(w.id) || 0;
        if (watcherRepeatMode(w) !== 'pageLoad' && Date.now() - last < Math.max(1000, Number(w.throttleSec || 15) * 1000)) continue;
        const workflow = workflows.find(x => x.id === w.workflowId);
        if (!workflow) continue;
        if (!watcherBlockStillActive(w, workflow)) { firedWatchers.delete(w.id); continue; }
        if (isWorkflowRunning(workflow)) continue;
        markWatcherStarted(w);
        if (shouldShowTriggerStartBadge(workflow)) {
          showBadge(rt('runtime.clickTriggerStarting', { name: workflow.name || 'workflow' }));
          setTimeout(removeBadge, 2000);
        }
        runWorkflowLocked(workflow, { dryRun: false, triggeredByWatcher: true, triggeredByClick: true }).catch(err => console.warn('BlockFlow click trigger error', err));
        if (watcherRepeatMode(w) === 'once') {
          const data = await safeStorageGet('watchers');
          if (!data) continue;
          const all = Array.isArray(data.watchers) ? data.watchers : [];
          const ww = all.find(x => x.id === w.id);
          if (ww) { ww.enabled = false; await safeStorageSet({ watchers: all }); }
        }
      } catch (err) { console.warn('BlockFlow click trigger check error', err); }
    }
  }

  async function checkWatchers() {
    if (!isExtensionContextAlive()) { stopWatchers('context not alive'); return; }
    let watchers, workflows;
    try {
      ({ watchers, workflows } = await loadWatchersAndWorkflows());
    } catch (err) {
      if (isContextInvalidatedError(err)) return;
      console.warn('BlockFlow watcher load error', err);
      return;
    }
    const active = watchers.filter(w => w.enabled !== false && watcherScopeMatches(w));
    for (const w of active) {
      try {
        if (w.mode === 'textShortcut') continue;
        let hit = false;
        if (w.mode === 'group') hit = evalWatcherGroup(w);
        else if (w.mode === 'element') hit = Boolean(findElement(w.target));
        else {
          const bodyText = document.body.innerText || '';
          const needle = String(w.text || '');
          hit = Boolean(needle && (w.caseSensitive ? bodyText.includes(needle) : bodyText.toLowerCase().includes(needle.toLowerCase())));
        }
        if (!hit) { if (watcherRepeatMode(w) === 'continuous') firedWatchers.delete(w.id); continue; }
        if (watcherAlreadyRanThisPageLoad(w)) continue;
        const last = firedWatchers.get(w.id) || 0;
        if (watcherRepeatMode(w) !== 'pageLoad' && Date.now() - last < Math.max(1000, Number(w.throttleSec || 15) * 1000)) continue;
        const workflow = workflows.find(x => x.id === w.workflowId);
        if (workflow) {
          // Stale watcher védelem: a mentett watcher rekord csak akkor indíthat,
          // ha a hozzá tartozó figyelő blokk még létezik és aktív a workflow-ban.
          if (!watcherBlockStillActive(w, workflow)) { firedWatchers.delete(w.id); continue; }
          if (isWorkflowRunning(workflow)) continue;
          markWatcherStarted(w);
          if (shouldShowTriggerStartBadge(workflow)) {
            showBadge(rt('runtime.watcherStarting', { name: workflow.name || 'workflow' }));
            setTimeout(removeBadge, 2000);
          }
          runWorkflowLocked(workflow, { dryRun: false, triggeredByWatcher: true }).catch(err => console.warn('BlockFlow watcher error', err));
          if (watcherRepeatMode(w) === 'once') {
            const data = await safeStorageGet('watchers');
            if (!data) continue;
            const all = Array.isArray(data.watchers) ? data.watchers : [];
            const ww = all.find(x => x.id === w.id);
            if (ww) { ww.enabled = false; await safeStorageSet({ watchers: all }); }
          }
        }
      } catch (err) { console.warn('BlockFlow watcher check error', err); }
    }
  }

  async function startWatchers() {
    extensionContextDead = false;
    if (!isExtensionContextAlive()) { stopWatchers('context not alive'); return; }
    if (watcherObserver) watcherObserver.disconnect();
    if (watcherInterval) clearInterval(watcherInterval);
    if (watcherClickHandler) { try { document.removeEventListener('click', watcherClickHandler, true); } catch (_) {} watcherClickHandler = null; }
    if (watcherHotkeyHandler) { try { document.removeEventListener('keydown', watcherHotkeyHandler, true); } catch (_) {} watcherHotkeyHandler = null; }
    await ensureRuntimeI18n();
    await refreshTextShortcutWatchers();
    watcherObserver = new MutationObserver(() => {
      clearTimeout(watcherTimer);
      watcherTimer = setTimeout(() => { checkWatchers().catch(err => { if (isContextInvalidatedError(err)) stopWatchers('extension context invalidated'); }); }, 250);
    });
    try {
      watcherObserver.observe(document.documentElement || document.body, { childList: true, subtree: true, characterData: true, attributes: true });
    } catch (err) {
      console.warn('BlockFlow watcher observer error', err);
    }
    let minInterval = 2;
    try {
      const { watchers } = await loadWatchersAndWorkflows();
      const scoped = watchers.filter(w => w.enabled !== false && watcherScopeMatches(w));
      minInterval = Math.max(1, Math.min(30, ...scoped.map(w => Number(w.intervalSec || 2)).filter(Boolean), 2));
    } catch {}
    if (!window.__blockFlowSpaWatcherHook) { window.__blockFlowSpaWatcherHook = true; window.addEventListener('BF_SPA_NAVIGATION', () => { const href = location.href.split('#')[0]; if (href !== watcherLastNavigationHref) { watcherLastNavigationHref = href; pageLoadFiredWatchers.clear(); watcherValueState.clear(); } setTimeout(() => checkWatchers().catch(err => { if (isContextInvalidatedError(err)) stopWatchers('extension context invalidated'); }), 100); }, true); }
    watcherClickHandler = event => { handleWatcherClick(event).catch(err => { if (isContextInvalidatedError(err)) stopWatchers('extension context invalidated'); }); };
    document.addEventListener('click', watcherClickHandler, true);
    watcherHotkeyHandler = event => handleTextShortcutKeydown(event);
    document.addEventListener('keydown', watcherHotkeyHandler, true);
    watcherInterval = setInterval(() => { checkWatchers().catch(err => { if (isContextInvalidatedError(err)) stopWatchers('extension context invalidated'); }); }, minInterval * 1000);
    setTimeout(() => { checkWatchers().catch(err => { if (isContextInvalidatedError(err)) stopWatchers('extension context invalidated'); }); }, 800);
  }


  function recordableTarget(raw) {
    const el = pickableElement(raw);
    if (!el || el.dataset?.bfBadge || el.dataset?.bfOverlay || el.closest?.('[data-bf-badge="1"],[data-bf-overlay="1"]')) return null;
    return el;
  }

  function recordEvent(ev) {
    if (!recorder?.active || recorder.paused) return;
    ev.ts = Date.now();
    recorder.events.push(ev);
    try { chrome.runtime.sendMessage({ type:'BF_RECORD_EVENT', count: recorder.events.length, eventType: ev.type }).catch?.(()=>{}); } catch (_) {}
  }

  function recorderClickHandler(e) {
    if (!recorder?.active || recorder.paused) return;
    const el = recordableTarget(e.target);
    if (!el) return;
    if (el.matches?.('input,textarea,select,[contenteditable="true"]')) return;
    recordEvent({ type:'click', target: descriptor(el) });
  }

  function recorderChangeHandler(e) {
    if (!recorder?.active || recorder.paused) return;
    const el = recordableTarget(e.target);
    if (!el || !el.matches?.('input,textarea,select,[contenteditable="true"]')) return;
    const inputType = String(el.getAttribute('type') || '').toLowerCase();
    const sensitive = inputType === 'password' || /password|jelsz|passwort|secret|token/i.test(labelFor(el) || el.name || el.id || '');
    let value = '';
    if (inputType === 'checkbox' || inputType === 'radio') value = el.checked ? 'true' : 'false';
    else if (el.tagName?.toLowerCase() === 'select') value = el.value || el.options?.[el.selectedIndex]?.text || '';
    else value = 'value' in el ? el.value : (el.innerText || el.textContent || '');
    recordEvent({ type:'fill', target: descriptor(el), value: sensitive ? '' : value, sensitive });
  }

  function recorderKeyHandler(e) {
    if (!recorder?.active || recorder.paused) return;
    if (!['Enter','Tab','Escape'].includes(e.key)) return;
    recordEvent({ type:'keyPress', key:e.key, ctrl:e.ctrlKey, alt:e.altKey, shift:e.shiftKey, meta:e.metaKey });
  }

  function startRecorder() {
    stopRecorder(false);
    recorder = { active:true, paused:false, events:[], startedAt:Date.now() };
    document.addEventListener('click', recorderClickHandler, true);
    document.addEventListener('change', recorderChangeHandler, true);
    document.addEventListener('keydown', recorderKeyHandler, true);
    showBadge('BlockFlow Record fut');
    return { ok:true };
  }

  function pauseRecorder(paused) {
    if (!recorder?.active) return { ok:false, error: rt('runtime.noActiveRecord') };
    recorder.paused = Boolean(paused);
    showBadge(recorder.paused ? rt('runtime.recordPaused') : rt('runtime.recordRunning'));
    return { ok:true, paused: recorder.paused };
  }

  function stopRecorder(returnEvents = true) {
    const events = recorder?.events || [];
    document.removeEventListener('click', recorderClickHandler, true);
    document.removeEventListener('change', recorderChangeHandler, true);
    document.removeEventListener('keydown', recorderKeyHandler, true);
    recorder = null;
    removeBadge();
    return { ok:true, events: returnEvents ? events : [] };
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    (async () => {
      if (msg?.type === 'BF_PING') { sendResponse({ ok: true, loaded: true }); return; }
      if (msg?.type === 'BF_START_PICKER') { startPicker(msg.context || {}); sendResponse({ ok: true }); return; }
      if (msg?.type === 'BF_STOP_PICKER') { stopPicker(); sendResponse({ ok: true }); return; }
      if (msg?.type === 'BF_PAGE_SUMMARY') { sendResponse({ ok: true, summary: pageSummary() }); return; }
      if (msg?.type === 'BF_TEST_TARGET') { const el = findElement(msg.target); sendResponse({ ok: Boolean(el), element: el ? descriptor(el) : null }); return; }
      if (msg?.type === 'BF_TEST_BLOCK') {
        const b = msg.block || {};
        try {
          if (b.type === 'textSearch') { const hits = findTextOccurrences(b, {}); sendResponse({ ok:true, result:{ count:hits.length, first:hits[0] ? { context:hits[0].context, place:hits[0].place, selector:hits[0].selector, rowSelector:hits[0].rowSelector, clickableSelector:hits[0].clickableSelector } : null } }); return; }
          if (b.type === 'fieldByLabel') { const el = findFieldByLabelText(b.labelText || '', b); sendResponse({ ok:true, result:{ found:Boolean(el), selector:el ? cssPath(el) : '', value:el ? getElementValue(el, 'auto') : '' } }); return; }
          if (b.type === 'errorSearch') { const hits = findErrorMessages(b); sendResponse({ ok:true, result:{ count:hits.length, first:hits[0] ? { text:hits[0].text, selector:hits[0].selector } : null } }); return; }
          if (b.type === 'findElements') { const els = findElementsForBlock(b, Number(b.maxItems || 50)); sendResponse({ ok:true, result:{ count:els.length, first:els[0] ? { text:(getElementValue(els[0],'auto') || els[0].innerText || '').trim().slice(0,200), selector:cssPath(els[0]) } : null } }); return; }
          if (b.type === 'tableExtract') { const el = b.target ? findElement(b.target) : null; sendResponse({ ok:true, result:{ targetFound:Boolean(el), rows:el ? rowsFromContainer(el, 500).length : 0 } }); return; }
          sendResponse({ ok:false, error:'Ehhez a blokkhoz nincs teszt handler.' }); return;
        } catch (err) { sendResponse({ ok:false, error:String(err?.message || err) }); return; }
      }
      if (msg?.type === 'BF_RUN_WORKFLOW') { try { const result = await runWorkflowLocked(msg.workflow, msg.options || {}); sendResponse({ ok: true, result }); } catch (err) { sendResponse({ ok: false, error: String(err.message || err), blockId: err.blockId || null, vars: err.partialVars || null, log: err.partialLog || [] }); } return; }
      if (msg?.type === 'BF_STOP_RUN') { stopRequested = true; sendResponse({ ok: true }); return; }
      if (msg?.type === 'BF_TEST_POPUP') { const p = findPopup(); sendResponse({ ok: Boolean(p), text: p ? (p.innerText || '').slice(0, 500) : '' }); return; }
      if (msg?.type === 'BF_EXTRACT_ONCE') {
        const el = await waitForElement(msg.target, Number(msg.timeoutMs || 5000), { requireVisible: false });
        if (!el) { sendResponse(isServiceNowContext() ? { ok: true, value: '' } : { ok: false, error: rt('runtime.extractTargetNotFound') }); return; }
        sendResponse({ ok: true, value: getElementValue(el, msg.extractMode || 'auto', msg.attributeName || 'title') });
        return;
      }
      if (msg?.type === 'BF_START_RECORDING') { sendResponse(startRecorder()); return; }
      if (msg?.type === 'BF_PAUSE_RECORDING') { sendResponse(pauseRecorder(Boolean(msg.paused))); return; }
      if (msg?.type === 'BF_STOP_RECORDING') { sendResponse(stopRecorder(true)); return; }
      if (msg?.type === 'BF_REFRESH_WATCHERS') { startWatchers().catch(err => { if (isContextInvalidatedError(err)) stopWatchers('extension context invalidated'); }); sendResponse({ ok: true }); return; }
    })().catch(err => {
      if (isContextInvalidatedError(err)) { stopWatchers('extension context invalidated'); return; }
      sendResponse({ ok: false, error: String(err.message || err) });
    });
    return true;
  });
  startWatchers().catch(err => { if (isContextInvalidatedError(err)) stopWatchers('extension context invalidated'); });
})();
