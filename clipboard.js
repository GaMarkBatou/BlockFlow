const params = new URLSearchParams(location.search);
const id = params.get('id') || '';
const statusEl = document.getElementById('status');
const retryBtn = document.getElementById('retry');

const CLIP_I18N = { selected:'auto', active:'hu', fallback:'hu', languages:[], dict:{}, fallbackDict:{}, loaded:false };
async function fetchJson(path, fallback = {}) {
  try {
    const res = await fetch(chrome.runtime.getURL(path));
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } catch (_) { return fallback; }
}
function normalizeLanguage(code) { return String(code || 'hu').toLowerCase().split('-')[0]; }
function resolveLanguage(selected, languages) {
  const list = (languages || []).filter(l => l.code && l.code !== 'auto');
  const supported = new Set(list.map(l => l.code));
  if (selected && selected !== 'auto' && supported.has(selected)) return selected;
  const browser = normalizeLanguage(navigator.language || 'hu');
  return supported.has(browser) ? browser : (CLIP_I18N.fallback || 'hu');
}
async function initI18n() {
  const meta = await fetchJson('locales/languages.json', { fallback:'hu', languages:[{ code:'hu', file:'hu.json' }] });
  CLIP_I18N.languages = meta.languages || [];
  CLIP_I18N.fallback = meta.fallback || 'hu';
  let selected = meta.default || 'auto';
  try { const st = await chrome.storage.local.get(['uiLanguage']); selected = st.uiLanguage || selected; } catch (_) {}
  CLIP_I18N.selected = selected;
  CLIP_I18N.active = resolveLanguage(selected, CLIP_I18N.languages);
  const activeInfo = CLIP_I18N.languages.find(l => l.code === CLIP_I18N.active) || { file: CLIP_I18N.active + '.json' };
  const fallbackInfo = CLIP_I18N.languages.find(l => l.code === CLIP_I18N.fallback) || { file: CLIP_I18N.fallback + '.json' };
  CLIP_I18N.fallbackDict = await fetchJson('locales/' + (fallbackInfo.file || (CLIP_I18N.fallback + '.json')), {});
  CLIP_I18N.dict = CLIP_I18N.active === CLIP_I18N.fallback ? CLIP_I18N.fallbackDict : await fetchJson('locales/' + (activeInfo.file || (CLIP_I18N.active + '.json')), {});
  CLIP_I18N.loaded = true;
  document.documentElement.lang = CLIP_I18N.active || 'hu';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const value = t(el.dataset.i18n);
    if (el.tagName === 'TITLE') document.title = value;
    else el.textContent = value;
  });
}
function t(key, vars) {
  const d = CLIP_I18N.dict || {}, f = CLIP_I18N.fallbackDict || {};
  const str = Object.prototype.hasOwnProperty.call(d, key) ? d[key] : (Object.prototype.hasOwnProperty.call(f, key) ? f[key] : key);
  if (!vars) return str;
  return String(str).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : '');
}

async function legacyPasteRead() {
  const ta = document.createElement('textarea');
  ta.style.cssText = 'position:fixed;left:12px;top:110px;width:1px;height:1px;opacity:0;';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    document.execCommand('paste');
    return ta.value || '';
  } finally {
    ta.remove();
  }
}

async function readClipboard() {
  statusEl.textContent = t('clipboard.reading');
  retryBtn.hidden = true;
  let text = '';
  try {
    if (navigator.clipboard?.readText) text = await navigator.clipboard.readText();
  } catch (_) {}
  if (!text) {
    try { text = await legacyPasteRead(); } catch (_) {}
  }
  if (typeof text === 'string') {
    chrome.runtime.sendMessage({ type: 'BF_CLIPBOARD_READ_RESULT', id, ok: true, text });
    statusEl.textContent = t('clipboard.done');
    return;
  }
  statusEl.textContent = t('clipboard.failed');
  retryBtn.hidden = false;
}

retryBtn.addEventListener('click', readClipboard);
window.addEventListener('load', async () => { await initI18n(); setTimeout(readClipboard, 50); });
