const params = new URLSearchParams(location.search);
const id = params.get('id') || '';
const statusEl = document.getElementById('status');
const retryBtn = document.getElementById('retry');

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
  statusEl.textContent = 'A BlockFlow beolvassa a vágólap szövegét...';
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
    statusEl.textContent = 'Vágólap beolvasva.';
    return;
  }
  statusEl.textContent = 'Nem sikerült automatikusan beolvasni a vágólapot. Kattints az Újrapróbálás gombra.';
  retryBtn.hidden = false;
}

retryBtn.addEventListener('click', readClipboard);
window.addEventListener('load', () => setTimeout(readClipboard, 50));
