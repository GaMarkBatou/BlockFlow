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
      const el = await waitForElement(block.target, Number(block.timeoutMs || 5000));
      if (!el) throw new Error(`Nem található kattintási cél: ${block.target?.label || 'nincs megadva'}`);
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
      const el = await waitForElement(block.target, Number(block.timeoutMs || 5000));
      if (!el) throw new Error(`Nem található mező: ${block.target?.label || 'nincs megadva'}`);
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
      const el = await waitForElement(block.target, Number(block.timeoutMs || 5000), { requireVisible });
      if (!el) throw new Error(`Nem található kinyerendő elem: ${block.target?.label || 'nincs megadva'}`);
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
        const el = await waitForElement(block.target, 5000, { requireVisible: false });
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
    if (block.type === 'preflight') {
      const ok = Boolean(findElement(block.target, { requireVisible: Boolean(block.requireVisible) }));
      if (!ok && block.onFail === 'stop') throw new Error(`Elem ellenőrzés sikertelen: ${block.target?.label || ''}`);
      if (!ok && block.onFail === 'notify' && !dryRun) await safeRuntimeSend({ type: 'BF_SYSTEM_NOTIFICATION', title: 'BlockFlow ellenőrzés', message: `Nem található elem: ${block.target?.label || ''}` });
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
    const vars = { current_url: location.href, today: new Date().toISOString().slice(0, 10), selected_text: String(getSelection?.() || '') };
    const log = [];
    const rootBlocks = workflow.blocks || [];

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
          const sub = await runWorkflow(target, options);
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
          await executeBlock(b, vars, options);
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
    if (!caseSensitive) { h = h.toLowerCase(); n = n.toLowerCase(); }
    if (operator === 'empty') return !String(haystack || '').trim();
    if (operator === 'notEmpty') return Boolean(String(haystack || '').trim());
    if (operator === 'notContains') return !h.includes(n);
    if (operator === 'equals') return h === n;
    if (operator === 'notEquals') return h !== n;
    if (operator === 'startsWith') return h.startsWith(n);
    if (operator === 'endsWith') return h.endsWith(n);
    return Boolean(n && h.includes(n));
  }

  function evalWatcherCondition(c) {
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
    return false;
  }

  function evalWatcherGroup(w) {
    const conditions = Array.isArray(w.conditions) ? w.conditions : [];
    if (!conditions.length) return false;
    const results = conditions.map(evalWatcherCondition);
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
          runWorkflow(workflow, { dryRun: false }).catch(err => console.warn('BlockFlow figyelő hiba', err));
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
