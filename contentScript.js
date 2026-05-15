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
      if (label) return label.innerText.trim();
    }
    const wrapping = el.closest('label');
    if (wrapping) return wrapping.innerText.trim();
    const aria = el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('placeholder') || '';
    if (aria) return aria.trim();
    const nearby = el.parentElement?.innerText?.trim();
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
    const text = (el.innerText || el.value || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim();
    return {
      label: labelFor(el) || text.slice(0, 80) || el.name || el.id || el.tagName.toLowerCase(),
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
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
    };
  }

  function attrEq(name, value) {
    return `[${name}="${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`;
  }

  function candidateSelectors(d) {
    const out = [];
    if (!d) return out;
    if (d.id) out.push({ selector: `#${CSS.escape(d.id)}`, weight: 60 });
    if (d.name) out.push({ selector: `${d.tag || ''}${attrEq('name', d.name)}`, weight: 45 });
    if (d.ariaLabel) out.push({ selector: `${d.tag || ''}${attrEq('aria-label', d.ariaLabel)}`, weight: 40 });
    if (d.placeholder) out.push({ selector: `${d.tag || ''}${attrEq('placeholder', d.placeholder)}`, weight: 35 });
    if (d.title) out.push({ selector: `${d.tag || ''}${attrEq('title', d.title)}`, weight: 30 });
    if (d.css) out.push({ selector: d.css, weight: 20 });
    return out.filter(x => x.selector);
  }

  function scoreElement(el, d, base = 0) {
    if (!el || !d || !isVisible(el)) return -999;
    let score = base;
    if (d.tag && el.tagName.toLowerCase() === d.tag) score += 10;
    if (d.type && el.getAttribute('type') === d.type) score += 8;
    if (d.name && el.getAttribute('name') === d.name) score += 25;
    if (d.id && el.id === d.id) score += 35;
    if (d.ariaLabel && el.getAttribute('aria-label') === d.ariaLabel) score += 20;
    if (d.placeholder && el.getAttribute('placeholder') === d.placeholder) score += 20;
    const t = (el.innerText || el.value || '').trim().toLowerCase();
    const dt = String(d.text || '').trim().toLowerCase();
    if (dt && t) {
      if (t === dt) score += 24;
      else if (t.includes(dt.slice(0, 80)) || dt.includes(t.slice(0, 80))) score += 12;
    }
    const lab = labelFor(el).toLowerCase();
    const dl = String(d.label || '').toLowerCase();
    if (lab && dl && (lab.includes(dl) || dl.includes(lab))) score += 14;
    if (d.rect) {
      const r = el.getBoundingClientRect();
      const dist = Math.abs(r.x - d.rect.x) + Math.abs(r.y - d.rect.y);
      if (dist < 50) score += 8;
      else if (dist < 160) score += 3;
    }
    return score;
  }

  function findElement(target) {
    let best = null;
    let bestScore = -999;
    for (const c of candidateSelectors(target)) {
      try {
        const els = [...document.querySelectorAll(c.selector)].slice(0, 20);
        for (const el of els) {
          const score = scoreElement(el, target, c.weight);
          if (score > bestScore) { best = el; bestScore = score; }
        }
      } catch (_) {}
    }
    if (target?.text || target?.label) {
      const needle = String(target.text || target.label || '').trim().toLowerCase().slice(0, 100);
      const all = [...document.querySelectorAll('button,a,input,textarea,select,[role="button"],label,div,span')].filter(isVisible).slice(0, 1500);
      for (const el of all) {
        const hay = ((el.innerText || el.value || labelFor(el) || '').trim().toLowerCase());
        if (needle && hay.includes(needle)) {
          const score = scoreElement(el, target, 18);
          if (score > bestScore) { best = el; bestScore = score; }
        }
      }
    }
    return bestScore >= 20 ? best : null;
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

  async function waitForElement(target, timeoutMs = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (stopRequested) throw new Error('Futtatás megszakítva.');
      const el = findElement(target);
      if (el) return el;
      await sleep(150);
    }
    return null;
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

  async function executeBlock(block, vars, options = {}) {
    const dryRun = Boolean(options.dryRun);
    if (block.type === 'trigger') return { skipped: true };

    if (block.type === 'watchText') {
      const ok = await waitForText(interpolate(block.text || '', vars), Number(block.timeoutMs || 30000), Boolean(block.caseSensitive));
      if (!ok) throw new Error(`Nem jelent meg a figyelt szöveg: ${block.text || ''}`);
      return { ok: true };
    }
    if (block.type === 'watchElement') {
      const el = await waitForElement(block.target, Number(block.timeoutMs || 30000));
      if (!el) throw new Error(`Nem jelent meg a figyelt elem: ${block.target?.label || ''}`);
      return { ok: true };
    }
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
      const el = await waitForElement(block.target, Number(block.timeoutMs || 5000));
      if (!el) throw new Error(`Nem található kinyerendő elem: ${block.target?.label || 'nincs megadva'}`);
      const val = block.extractMode === 'value' ? (el.value || '') : ((el.innerText || el.textContent || el.value || '').trim());
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
          chrome.runtime.sendMessage({ type: 'OPEN_MAILTO', url: shortUrl });
          alert('Az email törzse túl hosszú volt a mailto linkhez, ezért vágólapra került. Illeszd be a megnyíló emailbe.');
        } else {
          chrome.runtime.sendMessage({ type: 'OPEN_MAILTO', url: full });
        }
      }
      return { ok: true, dryRun };
    }
    return { ok: true, ignored: true };
  }

  async function conditionPass(block, vars) {
    if (block.conditionMode === 'elementExists') return Boolean(await waitForElement(block.target, Number(block.timeoutMs || 1000)));
    if (block.conditionMode === 'valueContains') {
      const el = await waitForElement(block.target, Number(block.timeoutMs || 1000));
      const hay = (el?.value || el?.innerText || el?.textContent || '').toLowerCase();
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

        if (b.type === 'trigger' || b.type === 'watchText' || b.type === 'watchElement') { i++; continue; }

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
  const firedWatchers = new Map();

  async function loadWatchersAndWorkflows() {
    const data = await chrome.storage.local.get(['watchers','workflows']);
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
    if (block.type !== 'watchText' && block.type !== 'watchElement') return false;
    return block.triggerEnabled !== false;
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

  async function checkWatchers() {
    const { watchers, workflows } = await loadWatchersAndWorkflows();
    const active = watchers.filter(w => w.enabled !== false && watcherScopeMatches(w));
    for (const w of active) {
      try {
        let hit = false;
        if (w.mode === 'element') hit = Boolean(findElement(w.target));
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
            const data = await chrome.storage.local.get('watchers');
            const all = Array.isArray(data.watchers) ? data.watchers : [];
            const ww = all.find(x => x.id === w.id);
            if (ww) { ww.enabled = false; await chrome.storage.local.set({ watchers: all }); }
          }
        }
      } catch (err) { console.warn('BlockFlow figyelő ellenőrzési hiba', err); }
    }
  }

  function startWatchers() {
    if (watcherObserver) watcherObserver.disconnect();
    watcherObserver = new MutationObserver(() => {
      clearTimeout(watcherTimer);
      watcherTimer = setTimeout(checkWatchers, 250);
    });
    watcherObserver.observe(document.documentElement || document.body, { childList: true, subtree: true, characterData: true, attributes: true });
    setTimeout(checkWatchers, 800);
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
      if (msg?.type === 'BF_REFRESH_WATCHERS') { startWatchers(); sendResponse({ ok: true }); return; }
    })().catch(err => sendResponse({ ok: false, error: String(err.message || err) }));
    return true;
  });
  startWatchers();
})();
