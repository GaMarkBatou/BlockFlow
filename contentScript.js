(() => {
  if (window.__blockFlowLoaded) return;
  window.__blockFlowLoaded = true;

  let picker = null;
  let stopRequested = false;

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

  function elementByXPath(xpath) {
    if (!xpath) return null;
    try {
      const res = document.evaluate(String(xpath), document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
      return res.singleNodeValue && res.singleNodeValue.nodeType === 1 ? res.singleNodeValue : null;
    } catch (_) { return null; }
  }

  function isVisible(el) {
    if (!el || el.nodeType !== 1) return false;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity || 1) > 0 && rect.width > 0 && rect.height > 0;
  }

  function labelFor(el) {
    if (!el) return '';
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) return (label.innerText || label.textContent || '').trim();
    }
    const wrapping = el.closest('label');
    if (wrapping) return (wrapping.innerText || wrapping.textContent || '').trim();
    const aria = el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('placeholder') || '';
    if (aria) return aria.trim();
    const nearby = (el.parentElement?.innerText || el.parentElement?.textContent || '').trim();
    return nearby ? nearby.slice(0, 120) : '';
  }

  function pickableElement(raw) {
    if (!raw || raw.nodeType !== 1) return raw;
    if (raw.dataset?.bfBadge || raw.dataset?.bfOverlay) return null;
    const direct = raw.closest('button,a,input,textarea,select,[role="button"],[role="link"],[contenteditable="true"],summary,label');
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
    const container = el.closest('[arid],[ardbn],[artype],.df,.Panel') || el.parentElement;
    const label = labelFor(el);
    const text = (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('title') || '').trim();
    return {
      label: label || text.slice(0, 80) || el.name || el.id || el.tagName.toLowerCase(),
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type') || '',
      id: el.id || '',
      name: el.getAttribute('name') || '',
      role: el.getAttribute('role') || '',
      ariaLabel: el.getAttribute('aria-label') || '',
      placeholder: el.getAttribute('placeholder') || '',
      title: el.getAttribute('title') || '',
      text: text.slice(0, 220),
      href: el.getAttribute('href') || '',
      css: cssPath(el),
      arid: el.getAttribute('arid') || container?.getAttribute('arid') || '',
      ardbn: el.getAttribute('ardbn') || container?.getAttribute('ardbn') || '',
      artype: el.getAttribute('artype') || container?.getAttribute('artype') || '',
      containerId: container?.id || '',
      containerArid: container?.getAttribute('arid') || '',
      containerArdbn: container?.getAttribute('ardbn') || '',
      labelFor: el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`) ? el.id : '',
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
    };
  }

  function attrEq(name, value) {
    return `[${name}="${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
  }

  function candidateSelectors(d) {
    const out = [];
    if (!d) return out;
    if (d.id) out.push({ selector: `#${CSS.escape(d.id)}`, weight: 80 });
    if (d.containerId) out.push({ selector: `#${CSS.escape(d.containerId)} input, #${CSS.escape(d.containerId)} textarea, #${CSS.escape(d.containerId)} select, #${CSS.escape(d.containerId)} [contenteditable="true"]`, weight: 76 });
    if (d.ardbn) out.push({ selector: `${attrEq('ardbn', d.ardbn)} input, ${attrEq('ardbn', d.ardbn)} textarea, ${attrEq('ardbn', d.ardbn)} select, ${attrEq('ardbn', d.ardbn)}`, weight: 72 });
    if (d.arid) out.push({ selector: `${attrEq('arid', d.arid)} input, ${attrEq('arid', d.arid)} textarea, ${attrEq('arid', d.arid)} select, ${attrEq('arid', d.arid)}`, weight: 70 });
    if (d.containerArdbn) out.push({ selector: `${attrEq('ardbn', d.containerArdbn)} input, ${attrEq('ardbn', d.containerArdbn)} textarea, ${attrEq('ardbn', d.containerArdbn)} select`, weight: 68 });
    if (d.containerArid) out.push({ selector: `${attrEq('arid', d.containerArid)} input, ${attrEq('arid', d.containerArid)} textarea, ${attrEq('arid', d.containerArid)} select`, weight: 66 });
    if (d.name) out.push({ selector: `${d.tag || ''}${attrEq('name', d.name)}`, weight: 45 });
    if (d.ariaLabel) out.push({ selector: `${d.tag || ''}${attrEq('aria-label', d.ariaLabel)}`, weight: 40 });
    if (d.placeholder) out.push({ selector: `${d.tag || ''}${attrEq('placeholder', d.placeholder)}`, weight: 35 });
    if (d.title) out.push({ selector: `${d.tag || ''}${attrEq('title', d.title)}`, weight: 30 });
    if (d.css) out.push({ selector: d.css, weight: 20 });
    return out.filter(x => x.selector);
  }

  function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function fieldControlIn(el) {
    if (!el || el.nodeType !== 1) return null;
    if (el.matches('input,textarea,select,[contenteditable="true"]')) return el;
    return el.querySelector('input,textarea,select,[contenteditable="true"]') || el;
  }

  function scoreElement(el, d, base = 0, options = {}) {
    if (!el || !d) return -999;
    const requireVisible = options.requireVisible !== false;
    if (requireVisible && !isVisible(el)) return -999;
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
    const t = normalizeText(control.innerText || control.value || control.textContent || control.getAttribute('title') || '');
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
    if (d.rect && isVisible(control)) {
      const r = control.getBoundingClientRect();
      const dist = Math.abs(r.x - d.rect.x) + Math.abs(r.y - d.rect.y);
      if (dist < 50) score += 8;
      else if (dist < 160) score += 3;
    }
    if (!isVisible(control)) score -= 3;
    return score;
  }

  function controlsNearLabel(labelEl) {
    const out = [];
    const forId = labelEl.getAttribute('for');
    if (forId) {
      const byFor = document.getElementById(forId);
      if (byFor) out.push(byFor);
    }
    const container = labelEl.closest('[arid],[ardbn],[artype],.df,.Panel,div,td,li,section') || labelEl.parentElement;
    if (container) out.push(...container.querySelectorAll('input,textarea,select,[contenteditable="true"]'));
    let sib = labelEl.nextElementSibling;
    for (let i = 0; sib && i < 4; i++, sib = sib.nextElementSibling) {
      if (sib.matches?.('input,textarea,select,[contenteditable="true"]')) out.push(sib);
      out.push(...(sib.querySelectorAll?.('input,textarea,select,[contenteditable="true"]') || []));
    }
    return [...new Set(out)];
  }

  function findElement(target, options = {}) {
    const requireVisible = options.requireVisible !== false;
    if (target?.xpath) { const xel = elementByXPath(target.xpath); if (xel && (!requireVisible || isVisible(xel))) return fieldControlIn(xel) || xel; }
    const requireClickable = Boolean(options.requireClickable);
    let best = null;
    let bestScore = -999;
    for (const c of candidateSelectors(target)) {
      try {
        const els = [...document.querySelectorAll(c.selector)].slice(0, 60);
        for (const raw of els) {
          const el = fieldControlIn(raw);
          const score = scoreElement(el, target, c.weight, { requireVisible });
          if (score > bestScore) { best = el; bestScore = score; }
        }
      } catch (_) {}
    }
    if (target?.label) {
      const needle = normalizeText(target.label).slice(0, 120);
      const labels = [...document.querySelectorAll('label,[aria-label],[title]')].slice(0, 3000);
      for (const lab of labels) {
        const txt = normalizeText(lab.innerText || lab.textContent || lab.getAttribute('aria-label') || lab.getAttribute('title') || '');
        if (needle && (txt === needle || txt.includes(needle) || needle.includes(txt))) {
          for (const el of controlsNearLabel(lab)) {
            const score = scoreElement(el, target, 26, { requireVisible });
            if (score > bestScore) { best = el; bestScore = score; }
          }
        }
      }
    }
    if (target?.text || target?.label) {
      const needle = normalizeText(target.text || target.label || '').slice(0, 100);
      const poolSelector = 'button,a,input,textarea,select,[role="button"],label,div,span,[contenteditable="true"]';
      let all = [...document.querySelectorAll(poolSelector)].slice(0, 5000);
      if (requireVisible) all = all.filter(isVisible);
      for (const raw of all) {
        const el = fieldControlIn(raw);
        const hay = normalizeText(el.innerText || el.value || el.textContent || labelFor(el) || el.getAttribute('title') || '');
        if (needle && hay.includes(needle)) {
          const score = scoreElement(el, target, 18, { requireVisible });
          if (score > bestScore) { best = el; bestScore = score; }
        }
      }
    }
    return bestScore >= (requireVisible ? 20 : 15) ? best : null;
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

  function startPicker(context) {
    stopPicker();
    showBadge('BlockFlow elemkiválasztás aktív. Kattints egy elemre. ESC: megszakítás.');
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

  async function waitForElement(target, timeoutMs = 5000, options = {}) {
    const start = Date.now();
    const minWait = Math.max(150, Number(timeoutMs || 0));
    while (Date.now() - start < minWait) {
      if (stopRequested) throw new Error('Futtatás megszakítva.');
      const el = findElement(target, options);
      if (el) return el;
      await sleep(150);
    }
    return findElement(target, options);
  }

  function getElementValue(el, mode = 'auto', attributeName = 'title') {
    if (!el) return '';
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
    if (el.isContentEditable) return (el.innerText || el.textContent || '').trim();
    return (el.value || el.innerText || el.textContent || el.getAttribute('title') || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim();
  }

  async function waitForText(text, timeoutMs = 5000, caseSensitive = false) {
    const start = Date.now();
    const needle = caseSensitive ? String(text || '') : String(text || '').toLowerCase();
    while (Date.now() - start < timeoutMs) {
      if (stopRequested) throw new Error('Futtatás megszakítva.');
      const hay = caseSensitive ? document.body.innerText : document.body.innerText.toLowerCase();
      if (needle && hay.includes(needle)) return true;
      await sleep(150);
    }
    return false;
  }

  function interpolate(input, vars) {
    return String(input || '').replace(/{{\s*([\w.-]+)\s*}}/g, (_, key) => vars[key] ?? '');
  }

  function descriptorFromVars(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    const raw = String(value || '').trim();
    if (!raw) return null;
    if (raw.startsWith('{')) { try { return JSON.parse(raw); } catch (_) {} }
    if (raw.startsWith('/') || raw.startsWith('(')) return { xpath: raw, label: 'XPath változó' };
    return { css: raw, label: 'Selector változó' };
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
    if (block.type === 'screenshot') { const name = block.resultName || 'screenshot_data_url'; vars.last_screenshot = vars[name] || vars.last_screenshot || ''; vars.last_result = vars.last_screenshot; }
    if (block.type === 'findElements') { vars.last_result = vars[block.countName || 'talalat_db'] || ''; }
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
      if (stopRequested) throw new Error('Futtatás megszakítva.');
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
    else rows = [...el.querySelectorAll('tbody tr,tr,li,[role="row"],.row,[class*="row"]')];
    rows = rows.filter(isVisible);
    const seen = new Set();
    rows = rows.filter(r => { const key = r.innerText || r.textContent || r.outerHTML.slice(0,80); if (seen.has(key)) return false; seen.add(key); return true; });
    return rows.slice(0, Math.max(0, Math.min(500, Number(maxRows || 20))));
  }


  function maskValue(block, vars) {
    const raw = interpolate(block.source || '', vars);
    const invert = Boolean(block.invertMask);
    const maskChar = block.maskChar == null ? '*' : String(block.maskChar).slice(0, 1);
    const repeatMask = n => maskChar ? maskChar.repeat(Math.max(0, n)) : '';
    if ((block.maskMode || 'characters') === 'lines') {
      const lines = String(raw).split(/\r?\n/);
      const keepFirst = Math.max(0, Number(block.keepFirstLines || 0));
      const keepLast = Math.max(0, Number(block.keepLastLines || 0));
      const maskText = block.maskLineText == null ? '***' : String(block.maskLineText);
      return lines.map((line, idx) => {
        const fromEnd = lines.length - idx;
        const inEdge = idx < keepFirst || fromEnd <= keepLast;
        if (!invert) return inEdge ? line : maskText;
        return inEdge ? maskText : line;
      }).join('\n');
    }
    const text = String(raw);
    const chars = Array.from(text);
    const keepStart = Math.max(0, Number(block.keepStart || 0));
    const keepEnd = Math.max(0, Number(block.keepEnd || 0));
    return chars.map((ch, idx) => {
      const inEdge = idx < keepStart || idx >= chars.length - keepEnd;
      const shouldMask = invert ? inEdge : !inEdge;
      return shouldMask ? repeatMask(1) : ch;
    }).join('');
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
      const base = findElement(block.target, { requireVisible: false });
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
      hits.push({
        element: el || document.body,
        value: String(value),
        place,
        selector,
        xpath: el ? xpathFor(el) : '/html/body',
        context: shortContext(value, needle, caseSensitive)
      });
    }

    if (scope === 'visible') {
      addHit(document.body, document.body.innerText || '', 'látható oldal szöveg');
      return hits;
    }

    const elements = [document.body, ...document.body.querySelectorAll('*')].slice(0, 12000)
      .filter(el => !['SCRIPT','STYLE','NOSCRIPT','TEMPLATE'].includes(el.tagName));

    for (const el of elements) {
      if (scope === 'dom') {
        if (!el.children.length || ['INPUT','TEXTAREA','SELECT','OPTION','BUTTON','A'].includes(el.tagName)) {
          addHit(el, el.textContent || '', 'DOM szöveg');
        }
      } else {
        if (!el.children.length || ['BUTTON','A','LABEL','OPTION','SUMMARY'].includes(el.tagName)) {
          addHit(el, el.innerText || el.textContent || '', 'oldal szöveg');
        }
      }
      if (includeValues && ['INPUT','TEXTAREA','SELECT'].includes(el.tagName)) addHit(el, getElementValue(el, 'auto'), `${el.tagName.toLowerCase()} value`);
      if (includeAttributes) {
        for (const attr of ['title','aria-label','placeholder','alt','value','name']) {
          const val = el.getAttribute?.(attr);
          if (val) addHit(el, val, `attribútum: ${attr}`);
        }
      }
    }
    return hits;
  }

  function tableCellValue(container, block) {
    const rows = rowsFromContainer(container, 500);
    let row = null;
    if ((block.rowMode || 'first') === 'last') row = rows[rows.length - 1];
    else if (block.rowMode === 'contains') {
      const needle = interpolate(block.rowContains || '', {}).toLowerCase();
      row = rows.find(r => (r.innerText || r.textContent || '').toLowerCase().includes(needle));
    } else row = rows[0];
    if (!row) return '';
    const cells = [...row.querySelectorAll('td,th,[role="cell"],input,textarea,select')];
    const idx = Math.max(0, Number(block.columnIndex || 1) - 1);
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
      buttonText: block.buttonText || 'Folytatás',
      cancelText: block.cancelText || 'Megszakítás'
    });

    if (!response || response.ok === false) {
      const errText = String(response?.error || 'Nem sikerült megnyitni a felhasználói üzenet ablakot.');
      throw new Error(errText);
    }
    if (response.action === 'cancel' || response.action === 'closed') {
      throw Object.assign(new Error('Felhasználó megszakította a futást.'), { userCancelled: true });
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
      cancelText: 'Mégse'
    });
    if (!response || response.ok === false) throw new Error(response?.error || 'Felhasználói ablak hiba.');
    if (['cancel','closed'].includes(response.action)) throw Object.assign(new Error('Felhasználó megszakította a futást.'), { userCancelled: true });
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
      img.onerror = () => reject(new Error('Screenshot kép nem tölthető be PDF-hez.'));
      img.src = dataUrl;
    });
  }

  async function getPdfScreenshotData(block, vars, dryRun) {
    if (dryRun) return '';
    if ((block.source || 'current') === 'last') return vars[block.dataVar || 'screenshot_data_url'] || '';
    if ((block.source || 'current') === 'variable') return vars[block.dataVar || 'screenshot_data_url'] || '';
    const res = await safeRuntimeSend({ type: 'BF_CAPTURE_VISIBLE_TAB', openPreview: false, restoreFocus: true });
    if (!res?.ok) throw new Error(res?.error || 'PDF screenshot készítése sikertelen.');
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
    const url = URL.createObjectURL(blob);
    if (action === 'preview' || action === 'downloadPreview') window.open(url, '_blank');
    if (action === 'download' || action === 'downloadPreview') {
      const a = document.createElement('a');
      a.href = url; a.download = makeDownloadName(fileName);
      document.documentElement.appendChild(a); a.click(); a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function executeBlock(block, vars, options = {}) {
    const dryRun = Boolean(options.dryRun);
    if (block.type === 'trigger' || block.type === 'triggerGroup' || String(block.type || '').startsWith('condition')) return { skipped: true };

    if (block.type === 'wait') {
      if (block.waitMode === 'element' && block.target) {
        const el = await waitForElement(block.target, Number(block.timeoutMs || 5000));
        if (!el) throw new Error(`Nem jelent meg az elem: ${block.target.label || block.target.css}`);
      } else if (block.waitMode === 'text') {
        const ok = await waitForText(interpolate(block.text || '', vars), Number(block.timeoutMs || 5000), false);
        if (!ok) throw new Error(`Nem jelent meg a szöveg: ${block.text || ''}`);
      } else {
        await sleep(Number(block.ms || 1000));
      }
      return { ok: true };
    }
    if (block.type === 'click') {
      const target = targetForBlock(block, vars);
      const el = await waitForElement(target, Number(block.timeoutMs || 5000));
      if (!el) throw new Error(`Nem található kattintási cél: ${target?.label || block.target?.label || 'nincs megadva'}`);
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.add('bf-run-outline');
      await sleep(100);
      if (!dryRun) {
        if (block.confirmRisky && shouldConfirmClick(el) && !confirm(`BlockFlow: kockázatosnak tűnő kattintás: "${(el.innerText || el.value || '').trim()}". Folytatod?`)) throw new Error('Felhasználó megszakította a kockázatos kattintást.');
        el.click();
      }
      setTimeout(() => el.classList.remove('bf-run-outline'), 700);
      return { ok: true, dryRun };
    }
    if (block.type === 'fill') {
      const target = targetForBlock(block, vars);
      const el = await waitForElement(target, Number(block.timeoutMs || 5000));
      if (!el) throw new Error(`Nem található mező: ${target?.label || block.target?.label || 'nincs megadva'}`);
      const value = interpolate(block.value || '', vars);
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      el.classList.add('bf-run-outline');
      if (!dryRun) {
        el.focus();
        if ('value' in el) el.value = value;
        else el.textContent = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      setTimeout(() => el.classList.remove('bf-run-outline'), 700);
      return { ok: true, value, dryRun };
    }
    if (block.type === 'extract') {
      const requireVisible = (block.searchScope || 'dom') === 'visible' || block.allowHidden === false;
      const target = targetForBlock(block, vars);
      const el = await waitForElement(target, Number(block.timeoutMs || 5000), { requireVisible });
      if (!el) throw new Error(`Nem található kinyerendő elem: ${target?.label || block.target?.label || 'nincs megadva'}`);
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
      if (!val) throw new Error('Nem sikerült popup adatot kinyerni.');
      vars[block.varName || 'popup_szoveg'] = val;
      return { ok: true, value: val };
    }
    if (block.type === 'popupClick') {
      const btn = findPopupButton(interpolate(block.buttonText || '', vars));
      if (!btn) throw new Error(`Nem található popup gomb: ${block.buttonText || ''}`);
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
      } catch (err) { throw new Error('Hibás regex minta: ' + err.message); }
      vars[block.resultName || 'regex_talalat'] = value;
      return { ok: true, value };
    }

    if (block.type === 'textSearch') {
      const hits = findTextOccurrences(block, vars);
      const first = hits[0] || null;
      vars[block.resultName || 'szoveg_talalat'] = hits.length ? 'true' : 'false';
      vars[block.countName || 'szoveg_talalat_db'] = String(hits.length);
      vars[block.contextName || 'szoveg_talalat_szoveg'] = first?.context || '';
      vars[block.placeName || 'szoveg_talalat_hely'] = first?.place || '';
      vars[block.selectorName || 'szoveg_talalat_selector'] = first?.selector || '';
      vars[block.xpathName || 'szoveg_talalat_xpath'] = first?.xpath || '';
      vars[block.elementName || 'szoveg_talalat_elem'] = first?.element ? descriptor(first.element) : '';
      vars.szoveg_talalat_lista = hits.slice(0, 25).map(h => `${h.place} | ${h.selector} | ${h.context}`).join('\n');
      return { ok: true, found: hits.length > 0, count: hits.length, first: first ? { place: first.place, selector: first.selector, context: first.context } : null };
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
      if (!el) throw new Error(`Nem található táblázat/lista: ${block.target?.label || ''}`);
      const value = tableCellValue(el, block);
      vars[block.resultName || 'tabla_adat'] = value;
      return { ok: true, value };
    }
    if (block.type === 'waitUntil') {
      const start = Date.now();
      const timeout = Number(block.timeoutMs || 10000);
      let ok = false;
      while (Date.now() - start < timeout) {
        if (block.conditionMode === 'elementExists') ok = Boolean(findElement(block.target, { requireVisible: false }));
        else if (block.conditionMode === 'valueContains') {
          const el = findElement(block.target, { requireVisible: false });
          ok = el ? compareTextValue(getElementValue(el, 'auto'), block.operator || 'contains', interpolate(block.value || block.text || '', vars), false) : false;
        } else if (block.conditionMode === 'urlContains') ok = location.href.includes(interpolate(block.value || block.text || '', vars));
        else ok = (document.body.innerText || '').toLowerCase().includes(interpolate(block.text || block.value || '', vars).toLowerCase());
        if (ok) break;
        await sleep(200);
      }
      if (!ok) throw new Error('Várj amíg: timeout, feltétel nem teljesült.');
      return { ok: true };
    }
    if (block.type === 'scroll') {
      if (block.mode === 'page') {
        if (!dryRun) {
          if (block.direction === 'top') window.scrollTo({ top: 0, behavior: 'smooth' });
          else if (block.direction === 'bottom') window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
          else window.scrollBy({ top: (block.direction === 'up' ? -1 : 1) * Number(block.amount || 500), behavior: 'smooth' });
        }
      } else {
        const target = targetForBlock(block, vars);
        const el = await waitForElement(target, 5000, { requireVisible: false });
        if (!el) throw new Error('Nem található görgetési cél.');
        if (!dryRun) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
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
      if (!dryRun) value = await navigator.clipboard.readText().catch(() => '');
      vars[block.resultName || 'clipboard'] = value;
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
      if (!dryRun && !res?.ok) throw new Error(res?.error || 'Képernyőkép készítése sikertelen.');
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
      if (!pdf.items.length) throw new Error('PDF mentés: nincs PDF tartalom.' );
      const fileName = interpolate(block.fileName || pdf.options.fileName || 'blockflow-riport.pdf', vars);
      if (!dryRun) {
        const blob = await buildPdfBlob(pdf, vars);
        saveOrPreviewPdfBlob(blob, fileName, block.action || 'downloadPreview');
      }
      vars.pdf_file_name = makeDownloadName(fileName);
      return { ok: true, fileName: vars.pdf_file_name, dryRun };
    }
    if (block.type === 'preflight') {
      const target = targetForBlock(block, vars);
      const ok = Boolean(findElement(target, { requireVisible: Boolean(block.requireVisible) }));
      if (!ok && block.onFail === 'stop') throw new Error(`Elem ellenőrzés sikertelen: ${target?.label || block.target?.label || ''}`);
      if (!ok && block.onFail === 'notify' && !dryRun) await safeRuntimeSend({ type: 'BF_SYSTEM_NOTIFICATION', title: 'BlockFlow ellenőrzés', message: `Nem található elem: ${target?.label || block.target?.label || ''}` });
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
      if (!draft) throw new Error('Nincs email draft az előnézethez.');
      const res = await safeRuntimeSend({ type: 'BF_USER_PROMPT', promptType: 'emailPreview', title: draft.subject || 'Email előnézet', message: `Címzett: ${draft.to}\n\n${draft.body}`, mode: 'wait', options: ['Megnyitás levelezőben','Törzs vágólapra','Megszakítás'], buttonText: 'OK', cancelText: 'Megszakítás' });
      const action = res?.value || res?.action || '';
      vars[block.resultName || 'email_preview_action'] = action;
      if (!dryRun && action === 'Megnyitás levelezőben') await executeBlock({ type:'openEmail', draftName: block.draftName || 'email_draft', maxUrlLength: 1800 }, vars, options);
      if (!dryRun && action === 'Törzs vágólapra') await copyText(draft.body || '');
      if (action === 'Megszakítás' || res?.action === 'cancel') throw new Error('Email előnézet megszakítva.');
      return { ok: true, action };
    }
    if (block.type === 'validateData') {
      const value = interpolate(block.source || '', vars);
      const ok = validateValue(value, block.validation || 'notEmpty', interpolate(block.pattern || '', vars));
      if (!ok && (block.onFail || 'stop') === 'stop') throw new Error(`Validálás sikertelen: ${block.validation || 'notEmpty'}`);
      return { ok };
    }
    if (block.type === 'comment') return { ok: true, skipped: true };
    if (block.type === 'returnResult') {
      vars[block.resultName || 'result'] = interpolate(block.value || '', vars);
      return { ok: true };
    }
    if (block.type === 'stopRun') throw new Error(interpolate(block.message || 'Futás leállítva.', vars));
    if (block.type === 'sound') {
      if (!dryRun) {
        const ac = new AudioContext();
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.frequency.value = block.tone === 'error' ? 220 : block.tone === 'notify' ? 660 : 880;
        gain.gain.value = 0.04;
        osc.connect(gain); gain.connect(ac.destination); osc.start(); setTimeout(() => { osc.stop(); ac.close(); }, 180);
      }
      return { ok: true, dryRun };
    }
    if (block.type === 'popupWindowWait') {
      const res = dryRun ? { tabId: 'dry-run' } : await safeRuntimeSend({ type: 'BF_WAIT_FOR_TAB', matchMode: block.matchMode || 'urlContains', value: interpolate(block.value || '', vars), timeoutMs: Number(block.timeoutMs || 15000) });
      if (!res?.ok && !dryRun) throw new Error(res?.error || 'Nem jelent meg új ablak/tab.');
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
      if (!dryRun && !res?.ok) throw new Error(res?.error || 'Popup/tab adatkinyerés hiba.');
      vars[block.varName || 'popup_adat'] = res?.value || '';
      return { ok: true };
    }
    if (block.type === 'userPrompt') {
      const result = await showUserPrompt(block, vars, dryRun);
      if (block.resultName) vars[block.resultName] = result.action || 'continue';
      return { ok: true, action: result.action, dryRun };
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
      if (!draft) throw new Error('Nincs email draft. Tegyél elé Email összeállítása blokkot.');
      const full = `mailto:${encodeURIComponent(draft.to)}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
      if (!dryRun) {
        if (full.length > Number(block.maxUrlLength || 1800)) {
          await copyText(draft.body);
          const shortUrl = `mailto:${encodeURIComponent(draft.to)}?subject=${encodeURIComponent(draft.subject)}`;
          await safeRuntimeSend({ type: 'OPEN_MAILTO', url: shortUrl, preserveFocus: true });
          alert('Az email törzse túl hosszú volt a mailto linkhez, ezért vágólapra került. Illeszd be a megnyíló emailbe.');
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
      const el = await waitForElement(block.target, Number(block.timeoutMs || 1000), { requireVisible: false });
      const hay = getElementValue(el, 'auto').toLowerCase();
      return hay.includes(interpolate(block.value || '', vars).toLowerCase());
    }
    return document.body.innerText.toLowerCase().includes(interpolate(block.text || '', vars).toLowerCase());
  }

  async function runWorkflow(workflow, options = {}) {
    stopRequested = false;
    const vars = { current_url: location.href, today: new Date().toISOString().slice(0, 10), selected_text: String(getSelection?.() || ''), last_result: '', last_text: '', last_value: '', last_selector: '', last_xpath: '', last_element: '', last_screenshot: '' };
    const log = [];
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
        throttleSec: block.throttleSec || 15
      };
    }

    function checkWorkflowStartGate() {
      if (options.forceRun || options.skipTriggerGate || options.triggeredByWatcher || options.scheduled) {
        log.push(options.forceRun ? 'Kényszerített futtatás: az indítófeltételek kihagyva.' : 'Automatikus/alworkflow futás: indítófeltételek nem kerülnek újraellenőrzésre.');
        return true;
      }
      const manualTriggers = collectBlocks(rootBlocks, b => b.type === 'trigger');
      if (manualTriggers.length) {
        log.push('Manuális Indítás blokk található: a kézi Futtatás azonnal indít.');
        return true;
      }
      const triggerGroups = collectBlocks(rootBlocks, b => b.type === 'triggerGroup' && b.triggerEnabled !== false);
      if (!triggerGroups.length) {
        log.push('Nincs aktív figyelő trigger. A workflow műveleti része elindul.');
        return true;
      }
      log.push(`Figyelő trigger ellenőrzése kézi futtatáshoz: ${triggerGroups.length} aktív trigger.`);
      let anyPassed = false;
      for (const tg of triggerGroups) {
        const watcher = watcherFromTriggerBlock(tg);
        const scopeOk = watcherScopeMatches(watcher);
        const conditionCount = Array.isArray(watcher.conditions) ? watcher.conditions.length : 0;
        let passed = false;
        if (scopeOk && conditionCount) passed = evalWatcherGroup(watcher);
        log.push(`Figyelő trigger ${tg.id || ''}: scope=${scopeOk ? 'igaz' : 'hamis'}, feltételek=${conditionCount}, eredmény=${passed ? 'igaz' : 'hamis'}.`);
        if (passed) anyPassed = true;
      }
      if (!anyPassed) {
        log.push('Automatizmus nem indult el: egyik figyelő trigger feltétele sem igaz. Kényszerített futtatással a műveleti blokkok tesztelhetők.');
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
        if (stopRequested) throw new Error('Futtatás megszakítva.');
        const b = list[i];
        log.push(`${label} · ${i + 1}: ${b.type}${options.dryRun ? ' [dry-run]' : ''}`);

        if (b.type === 'trigger' || b.type === 'triggerGroup' || String(b.type || '').startsWith('condition')) { i++; continue; }

        if (b.type === 'ifBlock') {
          const ok = await conditionPass(b, vars);
          const children = Array.isArray(b.children) ? b.children : [];
          const elseChildren = Array.isArray(b.elseChildren) ? b.elseChildren : [];
          log.push(ok ? `Feltétel: igaz · gyermek blokkok: ${children.length}` : `Feltétel: hamis · különben blokkok: ${elseChildren.length}`);
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
              log.push(`Ismétlés ${r + 1}/${count} · gyermek blokkok: ${children.length}`);
              await runList(children, 'repeat');
            }
          } else if (b.blockCount) {
            // Backward compatibility for old linear repeat blocks.
            const childStart = i + 1;
            const childEnd = Math.min(list.length, childStart + Math.max(0, Math.min(50, Number(b.blockCount || 1))));
            const legacyChildren = list.slice(childStart, childEnd);
            for (let r = 0; r < count; r++) {
              log.push(`Ismétlés ${r + 1}/${count} · legacy blokkok: ${legacyChildren.length}`);
              await runList(legacyChildren, 'repeat');
            }
            i = childEnd;
            continue;
          } else {
            log.push('Ismétlés: nincs behúzott blokk.');
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

        if (b.type === 'groupBlock' || b.type === 'iframeBlock') {
          await runList(Array.isArray(b.children) ? b.children : [], b.type === 'iframeBlock' ? 'iframe' : 'group');
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
          if (!target) throw new Error('Nem található meghívott automatizmus: ' + (b.workflowId || ''));
          const sub = await runWorkflow(target, { ...options, skipTriggerGate: true });
          const prefix = b.resultPrefix || 'called';
          Object.entries(sub.vars || {}).forEach(([k,v]) => { vars[`${prefix}_${k}`] = v; });
          i++;
          continue;
        }

        if (b.type === 'rowLoop') {
          const container = await waitForElement(b.target, Number(b.timeoutMs || 5000));
          if (!container) throw Object.assign(new Error(`Nem található lista/táblázat: ${b.target?.label || ''}`), { blockId: b.id });
          const rows = rowsFromContainer(container, Number(b.maxRows || 20));
          const children = Array.isArray(b.children) ? b.children : [];
          log.push(`Sor feldolgozás: ${rows.length} sor · gyermek blokkok: ${children.length}`);
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
        } catch (err) {
          err.blockId = err.blockId || b.id;
          err.partialVars = vars;
          err.partialLog = log;
          throw err;
        }
        i++;
      }
    }

    await runList(rootBlocks);
    return { vars, log };
  }

  function pageSummary() {
    const elements = [...document.querySelectorAll('input,textarea,select,button,a,[role="button"],[role="dialog"],[aria-modal="true"]')].filter(isVisible).slice(0, 250).map(descriptor);
    return { title: document.title, url: location.href, elements, popupDetected: Boolean(findPopup()) };
  }


  let watcherObserver = null;
  let watcherTimer = null;
  let watcherInterval = null;
  const firedWatchers = new Map();
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
    if (reason) console.info('BlockFlow figyelők leállítva:', reason);
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

  async function checkWatchers() {
    if (!isExtensionContextAlive()) { stopWatchers('context not alive'); return; }
    let watchers, workflows;
    try {
      ({ watchers, workflows } = await loadWatchersAndWorkflows());
    } catch (err) {
      if (isContextInvalidatedError(err)) return;
      console.warn('BlockFlow figyelők betöltési hiba', err);
      return;
    }
    const active = watchers.filter(w => w.enabled !== false && watcherScopeMatches(w));
    for (const w of active) {
      try {
        let hit = false;
        if (w.mode === 'group') hit = evalWatcherGroup(w);
        else if (w.mode === 'element') hit = Boolean(findElement(w.target));
        else {
          const bodyText = document.body.innerText || '';
          const needle = String(w.text || '');
          hit = Boolean(needle && (w.caseSensitive ? bodyText.includes(needle) : bodyText.toLowerCase().includes(needle.toLowerCase())));
        }
        if (!hit) { firedWatchers.delete(w.id); continue; }
        const last = firedWatchers.get(w.id) || 0;
        if (Date.now() - last < Math.max(1000, Number(w.throttleSec || 15) * 1000)) continue;
        firedWatchers.set(w.id, Date.now());
        const workflow = workflows.find(x => x.id === w.workflowId);
        if (workflow) {
          // Stale watcher védelem: a mentett watcher rekord csak akkor indíthat,
          // ha a hozzá tartozó figyelő blokk még létezik és aktív a workflow-ban.
          if (!watcherBlockStillActive(w, workflow)) { firedWatchers.delete(w.id); continue; }
          showBadge(`BlockFlow figyelő indítja: ${workflow.name || 'workflow'}`);
          setTimeout(removeBadge, 2000);
          runWorkflow(workflow, { dryRun: false, triggeredByWatcher: true }).catch(err => console.warn('BlockFlow figyelő hiba', err));
          if (w.runOnce) {
            const data = await safeStorageGet('watchers');
            if (!data) continue;
            const all = Array.isArray(data.watchers) ? data.watchers : [];
            const ww = all.find(x => x.id === w.id);
            if (ww) { ww.enabled = false; await safeStorageSet({ watchers: all }); }
          }
        }
      } catch (err) { console.warn('BlockFlow figyelő ellenőrzési hiba', err); }
    }
  }

  async function startWatchers() {
    extensionContextDead = false;
    if (!isExtensionContextAlive()) { stopWatchers('context not alive'); return; }
    if (watcherObserver) watcherObserver.disconnect();
    if (watcherInterval) clearInterval(watcherInterval);
    watcherObserver = new MutationObserver(() => {
      clearTimeout(watcherTimer);
      watcherTimer = setTimeout(() => { checkWatchers().catch(err => { if (isContextInvalidatedError(err)) stopWatchers('extension context invalidated'); }); }, 250);
    });
    try {
      watcherObserver.observe(document.documentElement || document.body, { childList: true, subtree: true, characterData: true, attributes: true });
    } catch (err) {
      console.warn('BlockFlow figyelő observer hiba', err);
    }
    let minInterval = 2;
    try {
      const { watchers } = await loadWatchersAndWorkflows();
      const scoped = watchers.filter(w => w.enabled !== false && watcherScopeMatches(w));
      minInterval = Math.max(1, Math.min(30, ...scoped.map(w => Number(w.intervalSec || 2)).filter(Boolean), 2));
    } catch {}
    watcherInterval = setInterval(() => { checkWatchers().catch(err => { if (isContextInvalidatedError(err)) stopWatchers('extension context invalidated'); }); }, minInterval * 1000);
    setTimeout(() => { checkWatchers().catch(err => { if (isContextInvalidatedError(err)) stopWatchers('extension context invalidated'); }); }, 800);
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    (async () => {
      if (msg?.type === 'BF_PING') { sendResponse({ ok: true, loaded: true }); return; }
      if (msg?.type === 'BF_START_PICKER') { startPicker(msg.context || {}); sendResponse({ ok: true }); return; }
      if (msg?.type === 'BF_STOP_PICKER') { stopPicker(); sendResponse({ ok: true }); return; }
      if (msg?.type === 'BF_PAGE_SUMMARY') { sendResponse({ ok: true, summary: pageSummary() }); return; }
      if (msg?.type === 'BF_TEST_TARGET') { const el = findElement(msg.target); sendResponse({ ok: Boolean(el), element: el ? descriptor(el) : null }); return; }
      if (msg?.type === 'BF_RUN_WORKFLOW') { try { const result = await runWorkflow(msg.workflow, msg.options || {}); sendResponse({ ok: true, result }); } catch (err) { sendResponse({ ok: false, error: String(err.message || err), blockId: err.blockId || null, vars: err.partialVars || null, log: err.partialLog || [] }); } return; }
      if (msg?.type === 'BF_STOP_RUN') { stopRequested = true; sendResponse({ ok: true }); return; }
      if (msg?.type === 'BF_TEST_POPUP') { const p = findPopup(); sendResponse({ ok: Boolean(p), text: p ? (p.innerText || '').slice(0, 500) : '' }); return; }
      if (msg?.type === 'BF_EXTRACT_ONCE') {
        const el = await waitForElement(msg.target, Number(msg.timeoutMs || 5000), { requireVisible: false });
        if (!el) { sendResponse({ ok: false, error: 'Nem található kinyerendő elem.' }); return; }
        sendResponse({ ok: true, value: getElementValue(el, msg.extractMode || 'auto', msg.attributeName || 'title') });
        return;
      }
      if (msg?.type === 'BF_REFRESH_WATCHERS') { startWatchers().catch(err => { if (isContextInvalidatedError(err)) stopWatchers('extension context invalidated'); }); sendResponse({ ok: true }); return; }
    })().catch(err => {
      if (isContextInvalidatedError(err)) { stopWatchers('extension context invalidated'); return; }
      sendResponse({ ok: false, error: String(err.message || err) });
    });
    return true;
  });
  startWatchers().catch(err => { if (isContextInvalidatedError(err)) stopWatchers('extension context invalidated'); });
})();
