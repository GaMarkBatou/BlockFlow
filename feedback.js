const params = new URLSearchParams(location.search);
const id = params.get('id') || '';
const titleEl = document.getElementById('title');
const messageEl = document.getElementById('message');
const inputArea = document.getElementById('inputArea');
const cancelBtn = document.getElementById('cancel');
const continueBtn = document.getElementById('continue');
let item = {};
let valueControl = null;

function renderControl() {
  inputArea.innerHTML = '';
  inputArea.classList.add('hidden');
  valueControl = null;
  if (item.promptType === 'input') {
    inputArea.classList.remove('hidden');
    if (item.inputType === 'textarea') {
      const ta = document.createElement('textarea');
      ta.placeholder = item.placeholder || '';
      ta.value = item.defaultValue || '';
      inputArea.appendChild(ta);
      valueControl = ta;
    } else {
      const input = document.createElement('input');
      input.placeholder = item.placeholder || '';
      input.value = item.defaultValue || '';
      inputArea.appendChild(input);
      valueControl = input;
    }
  }
  if (item.promptType === 'choice' || item.promptType === 'emailPreview') {
    inputArea.classList.remove('hidden');
    const select = document.createElement('select');
    const opts = Array.isArray(item.options) && item.options.length ? item.options : ['OK'];
    for (const opt of opts) {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      select.appendChild(o);
    }
    inputArea.appendChild(select);
    valueControl = select;
  }
  setTimeout(() => valueControl?.focus?.(), 80);
}

async function load() {
  const key = `feedback_${id}`;
  const data = await chrome.storage.local.get(key);
  item = data[key] || {};
  titleEl.textContent = item.title || 'BlockFlow';
  messageEl.textContent = item.message || '';
  cancelBtn.textContent = item.cancelText || 'Megszakítás';
  continueBtn.textContent = item.buttonText || 'Folytatás';
  if (item.mode === 'notify') {
    document.body.classList.add('notify');
    continueBtn.textContent = 'Rendben';
  }
  renderControl();
}

async function respond(action) {
  const value = valueControl ? valueControl.value : '';
  try {
    await chrome.runtime.sendMessage({ type: 'BF_FEEDBACK_RESPONSE', id, action, value });
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
