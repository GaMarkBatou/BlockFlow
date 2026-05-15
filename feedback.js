const params = new URLSearchParams(location.search);
const id = params.get('id') || '';
const titleEl = document.getElementById('title');
const messageEl = document.getElementById('message');
const cancelBtn = document.getElementById('cancel');
const continueBtn = document.getElementById('continue');

async function load() {
  const key = `feedback_${id}`;
  const data = await chrome.storage.local.get(key);
  const item = data[key] || {};
  titleEl.textContent = item.title || 'BlockFlow';
  messageEl.textContent = item.message || '';
  cancelBtn.textContent = item.cancelText || 'Megszakítás';
  continueBtn.textContent = item.buttonText || 'Folytatás';
  if (item.mode === 'notify') {
    document.body.classList.add('notify');
    continueBtn.textContent = 'Rendben';
  }
}

async function respond(action) {
  try {
    await chrome.runtime.sendMessage({ type: 'BF_FEEDBACK_RESPONSE', id, action });
  } catch (_) {
    window.close();
  }
}

cancelBtn.addEventListener('click', () => respond('cancel'));
continueBtn.addEventListener('click', () => respond('continue'));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') respond('cancel');
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) respond('continue');
});
load().catch(err => {
  titleEl.textContent = 'BlockFlow hiba';
  messageEl.textContent = String(err?.message || err);
});
