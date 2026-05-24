const EXT_PREFIX = chrome.runtime.getURL('');
const INJECTABLE_URL_RE = /^(https?:|file:)/;
const pendingFeedback = new Map();

async function setLastActiveTab(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab && tab.url && !tab.url.startsWith(EXT_PREFIX) && INJECTABLE_URL_RE.test(tab.url)) {
      await chrome.storage.local.set({ lastActiveTabId: tabId, lastActiveTabUrl: tab.url });
    }
  } catch (_) {}
}

async function getUsableTargetTab(preferredTabId) {
  if (preferredTabId) {
    try {
      const tab = await chrome.tabs.get(preferredTabId);
      if (tab?.id && tab.url && !tab.url.startsWith(EXT_PREFIX) && INJECTABLE_URL_RE.test(tab.url)) return tab;
    } catch (_) {}
  }

  // Prefer the currently active real web page. This matters when the user opens
  // the builder from a page and immediately starts picking an element: stale
  // lastActiveTabId values must not steal the target.
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeWebTab = tabs.find(t => t?.id && t.url && !t.url.startsWith(EXT_PREFIX) && INJECTABLE_URL_RE.test(t.url));
  if (activeWebTab) return activeWebTab;

  const { lastActiveTabId } = await chrome.storage.local.get('lastActiveTabId');
  if (lastActiveTabId) {
    try {
      const tab = await chrome.tabs.get(lastActiveTabId);
      if (tab?.id && tab.url && !tab.url.startsWith(EXT_PREFIX) && INJECTABLE_URL_RE.test(tab.url)) return tab;
    } catch (_) {}
  }

  const allTabs = await chrome.tabs.query({ currentWindow: true });
  return allTabs.find(t => t?.id && t.url && !t.url.startsWith(EXT_PREFIX) && INJECTABLE_URL_RE.test(t.url));
}
async function ensureContentScript(tabId) {
  let pinged = false;
  try {
    const ping = await chrome.tabs.sendMessage(tabId, { type: 'BF_PING' });
    pinged = Boolean(ping?.ok);
  } catch (_) {}
  if (pinged) return;

  await chrome.scripting.insertCSS({ target: { tabId }, files: ['contentScript.css'] }).catch(() => {});
  await chrome.scripting.executeScript({ target: { tabId }, files: ['contentScript.js'] });

  // Give the content script one small tick to register its message listener.
  await new Promise(resolve => setTimeout(resolve, 25));
}

chrome.runtime.onInstalled.addListener(async () => {
  if (chrome.sidePanel?.setPanelBehavior) {
    try { await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }); } catch (_) {}
  }
});

chrome.tabs.onActivated.addListener(info => setLastActiveTab(info.tabId));
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) setLastActiveTab(tabId);
});


chrome.windows.onRemoved.addListener(windowId => {
  for (const [id, item] of [...pendingFeedback.entries()]) {
    if (item.windowId === windowId) {
      pendingFeedback.delete(id);
      try { item.sendResponse({ ok: true, action: 'closed' }); } catch (_) {}
      chrome.storage.local.remove(`feedback_${id}`).catch(() => {});
    }
  }
});


async function refreshSchedules() {
  if (!chrome.alarms) return;
  const data = await chrome.storage.local.get('schedules');
  const schedules = Array.isArray(data.schedules) ? data.schedules : [];
  const alarms = await chrome.alarms.getAll();
  await Promise.all(alarms.filter(a => a.name.startsWith('blockflow-schedule:')).map(a => chrome.alarms.clear(a.name)));
  for (const s of schedules) {
    if (s.enabled === false) continue;
    const name = `blockflow-schedule:${s.id}`;
    if ((s.scheduleMode || 'interval') === 'daily') {
      const [hh, mm] = String(s.timeOfDay || '08:00').split(':').map(Number);
      const d = new Date(); d.setHours(hh || 8, mm || 0, 0, 0);
      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
      await chrome.alarms.create(name, { when: d.getTime(), periodInMinutes: 24 * 60 });
    } else {
      await chrome.alarms.create(name, { delayInMinutes: Math.max(1, Number(s.intervalMinutes || 15)), periodInMinutes: Math.max(1, Number(s.intervalMinutes || 15)) });
    }
  }
}

async function runScheduledWorkflow(scheduleId) {
  const data = await chrome.storage.local.get(['schedules','workflows']);
  const schedules = Array.isArray(data.schedules) ? data.schedules : [];
  const workflows = Array.isArray(data.workflows) ? data.workflows : [];
  const sched = schedules.find(s => `blockflow-schedule:${s.id}` === scheduleId || s.id === scheduleId);
  if (!sched || sched.enabled === false) return;
  const wf = workflows.find(w => w.id === sched.workflowId);
  if (!wf) return;
  const target = await getUsableTargetTab();
  if (!target?.id) return;
  await ensureContentScript(target.id);
  await chrome.tabs.sendMessage(target.id, { type:'BF_RUN_WORKFLOW', workflow: wf, options:{ scheduled: true } }).catch(() => {});
}

if (chrome.alarms) {
  chrome.alarms.onAlarm.addListener(alarm => {
    if (alarm.name.startsWith('blockflow-schedule:')) runScheduledWorkflow(alarm.name).catch(() => {});
  });
  refreshSchedules().catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type === 'OPEN_BUILDER') {
      const target = await getUsableTargetTab(msg.tabId || sender?.tab?.id);
      if (target?.id) await setLastActiveTab(target.id);
      const qs = target?.id ? `?targetTabId=${encodeURIComponent(target.id)}` : '';
      await chrome.windows.create({
        url: chrome.runtime.getURL('builder.html') + qs,
        type: 'popup',
        width: 1460,
        height: 900,
        focused: true
      });
      sendResponse({ ok: true, targetTabId: target?.id });
      return;
    }

    if (msg?.type === 'OPEN_SIDEPANEL') {
      const target = await getUsableTargetTab(sender?.tab?.id);
      if (!target?.id) throw new Error('Nincs használható weboldal tab a sidebarhoz.');
      await setLastActiveTab(target.id);
      if (chrome.sidePanel?.setOptions) {
        await chrome.sidePanel.setOptions({ tabId: target.id, path: 'sidepanel.html', enabled: true });
      }
      // sidePanel.open() cannot be called from here reliably because Chrome
      // requires it to run directly inside a user gesture. The popup opens it
      // from its own button click handler.
      sendResponse({ ok: true, needsUserGestureOpen: true, tabId: target.id });
      return;
    }

    if (msg?.type === 'GET_TARGET_TAB') {
      const target = await getUsableTargetTab(msg.tabId);
      if (target?.id) await setLastActiveTab(target.id);
      sendResponse({ ok: Boolean(target?.id), tabId: target?.id, url: target?.url });
      return;
    }

    if (msg?.type === 'SEND_TO_TARGET_TAB') {
      const target = await getUsableTargetTab(msg.tabId);
      if (!target?.id) throw new Error('Nincs használható aktív weboldal tab. Nyiss meg egy http/https oldalt, majd próbáld újra.');
      await setLastActiveTab(target.id);
      await ensureContentScript(target.id);
      if (msg.payload?.type === 'BF_START_PICKER' || msg.payload?.type === 'BF_START_RECORDING') {
        try { await chrome.windows.update(target.windowId, { focused: true }); } catch (_) {}
        try { await chrome.tabs.update(target.id, { active: true }); } catch (_) {}
        await new Promise(resolve => setTimeout(resolve, 80));
      }
      const response = await chrome.tabs.sendMessage(target.id, msg.payload);
      sendResponse({ ok: true, response, tabId: target.id, url: target.url });
      return;
    }



    if (msg?.type === 'BF_REFRESH_ALL_WATCHERS') {
      const tabs = await chrome.tabs.query({});
      let refreshed = 0;
      for (const tab of tabs) {
        if (!tab?.id || !tab.url || tab.url.startsWith(EXT_PREFIX) || !INJECTABLE_URL_RE.test(tab.url)) continue;
        try {
          await ensureContentScript(tab.id);
          await chrome.tabs.sendMessage(tab.id, { type: 'BF_REFRESH_WATCHERS' });
          refreshed++;
        } catch (_) {}
      }
      sendResponse({ ok: true, refreshed });
      return;
    }

    if (msg?.type === 'OPEN_MAILTO') {
      const preferredWindowId = sender?.tab?.windowId;
      const preferredTabId = sender?.tab?.id;
      let previousActiveId = null;
      let created = null;
      try {
        const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
        previousActiveId = activeTabs?.[0]?.id || preferredTabId || null;
      } catch (_) {}
      // Mailto links should not steal the user's working tab. Opening inactive is
      // enough for most mail handlers; if Chrome still activates it, refocus the
      // originating tab immediately afterwards.
      const createProps = { url: msg.url, active: false };
      if (preferredWindowId) createProps.windowId = preferredWindowId;
      created = await chrome.tabs.create(createProps);
      const refocusId = msg.returnToTabId || preferredTabId || previousActiveId;
      if (refocusId && msg.preserveFocus !== false) {
        setTimeout(() => { chrome.tabs.update(refocusId, { active: true }).catch(() => {}); }, 150);
      }
      sendResponse({ ok: true, tabId: created?.id || null });
      return;
    }

    if (msg?.type === 'BF_USER_PROMPT') {
      const id = `fb-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const mode = msg.mode || 'wait';
      await chrome.storage.local.set({
        [`feedback_${id}`]: {
          id,
          title: String(msg.title || 'BlockFlow').slice(0, 160),
          message: String(msg.message || '').slice(0, 8000),
          mode,
          promptType: String(msg.promptType || 'message'),
          inputType: String(msg.inputType || 'text'),
          placeholder: String(msg.placeholder || '').slice(0, 500),
          defaultValue: String(msg.defaultValue || '').slice(0, 8000),
          options: Array.isArray(msg.options) ? msg.options.slice(0, 20).map(x => String(x).slice(0, 500)) : [],
          buttonText: String(msg.buttonText || 'Folytatás').slice(0, 80),
          cancelText: String(msg.cancelText || 'Megszakítás').slice(0, 80)
        }
      });
      const win = await chrome.windows.create({
        url: chrome.runtime.getURL('feedback.html') + `?id=${encodeURIComponent(id)}`,
        type: 'popup',
        width: 520,
        height: mode === 'notify' ? 320 : 390,
        focused: true
      });
      pendingFeedback.set(id, { sendResponse, windowId: win.id });

      // Notify-only messages should not block the workflow indefinitely.
      if (mode === 'notify') {
        setTimeout(() => {
          const item = pendingFeedback.get(id);
          if (!item) return;
          pendingFeedback.delete(id);
          try { item.sendResponse({ ok: true, action: 'shown' }); } catch (_) {}
        }, 300);
      }
      return;
    }

    if (msg?.type === 'BF_FEEDBACK_RESPONSE') {
      const id = String(msg.id || '');
      const item = pendingFeedback.get(id);
      if (item) {
        pendingFeedback.delete(id);
        try { item.sendResponse({ ok: true, action: msg.action || 'continue', value: msg.value || '' }); } catch (_) {}
        try { await chrome.storage.local.remove(`feedback_${id}`); } catch (_) {}
        if (item.windowId) { try { await chrome.windows.remove(item.windowId); } catch (_) {} }
      }
      sendResponse({ ok: true });
      return;
    }


    if (msg?.type === 'BF_OPEN_URL') {
      const url = String(msg.url || '');
      if (!url) throw new Error('Nincs megadva URL.');
      if (msg.mode === 'sameTab') {
        const target = await getUsableTargetTab(sender?.tab?.id);
        if (!target?.id) throw new Error('Nincs cél tab.');
        await chrome.tabs.update(target.id, { url });
      } else if (msg.mode === 'newWindow') {
        await chrome.windows.create({ url, type: 'popup', width: 1100, height: 800, focused: true });
      } else {
        await chrome.tabs.create({ url, active: true });
      }
      sendResponse({ ok: true });
      return;
    }

    if (msg?.type === 'BF_CAPTURE_VISIBLE_TAB') {
      const sourceTabId = msg.tabId || sender?.tab?.id;
      const sourceWindowId = msg.windowId || sender?.tab?.windowId;
      let previousActiveId = null;
      try {
        const q = sourceWindowId ? { active: true, windowId: sourceWindowId } : { active: true, currentWindow: true };
        const activeTabs = await chrome.tabs.query(q);
        previousActiveId = activeTabs?.[0]?.id || null;
      } catch (_) {}
      // chrome.tabs.captureVisibleTab can only capture the visible active tab in a
      // window. For watcher-triggered runs the source tab may not be active, so we
      // briefly activate it, capture it, then restore the previous tab.
      if (sourceTabId) {
        try { await chrome.tabs.update(sourceTabId, { active: true }); } catch (_) {}
        try { if (sourceWindowId) await chrome.windows.update(sourceWindowId, { focused: true }); } catch (_) {}
        await new Promise(resolve => setTimeout(resolve, 180));
      }
      const dataUrl = await chrome.tabs.captureVisibleTab(sourceWindowId, { format: 'png' });
      if (msg.openPreview) {
        const previewProps = { url: dataUrl, active: true };
        if (sourceWindowId) previewProps.windowId = sourceWindowId;
        await chrome.tabs.create(previewProps);
      }
      else if (previousActiveId && previousActiveId !== sourceTabId && msg.restoreFocus !== false) {
        setTimeout(() => { chrome.tabs.update(previousActiveId, { active: true }).catch(() => {}); }, 100);
      }
      sendResponse({ ok: true, dataUrl });
      return;
    }

    if (msg?.type === 'BF_GET_TEMPLATES') {
      const data = await chrome.storage.local.get('templates');
      sendResponse({ ok: true, templates: Array.isArray(data.templates) ? data.templates : [] });
      return;
    }

    if (msg?.type === 'BF_WAIT_FOR_TAB') {
      const started = Date.now();
      const timeout = Math.max(1000, Number(msg.timeoutMs || 15000));
      const match = tab => {
        const v = String(msg.value || '').toLowerCase();
        if (!v) return tab?.id;
        if (msg.matchMode === 'titleContains') return String(tab.title || '').toLowerCase().includes(v);
        return String(tab.url || '').toLowerCase().includes(v);
      };
      while (Date.now() - started < timeout) {
        const tabs = await chrome.tabs.query({});
        const found = tabs.find(match);
        if (found?.id) { sendResponse({ ok: true, tabId: found.id, url: found.url, title: found.title }); return; }
        await new Promise(r => setTimeout(r, 500));
      }
      sendResponse({ ok: false, error: 'Timeout: nem jelent meg megfelelő tab/ablak.' });
      return;
    }

    if (msg?.type === 'BF_CLOSE_TAB') {
      if (msg.tabId) await chrome.tabs.remove(Number(msg.tabId)).catch(()=>{});
      sendResponse({ ok: true });
      return;
    }

    if (msg?.type === 'BF_EXTRACT_FROM_TAB') {
      const tabId = Number(msg.tabId || 0);
      if (!tabId) throw new Error('Nincs popup/tab azonosító.');
      await ensureContentScript(tabId);
      const response = await chrome.tabs.sendMessage(tabId, { type:'BF_EXTRACT_ONCE', target: msg.target, extractMode: msg.extractMode, attributeName: msg.attributeName, timeoutMs: msg.timeoutMs });
      sendResponse(response || { ok:false, error:'Nincs válasz a tabtól.' });
      return;
    }

    if (msg?.type === 'BF_REFRESH_SCHEDULES') {
      await refreshSchedules();
      sendResponse({ ok: true });
      return;
    }

    if (msg?.type === 'BF_SYSTEM_NOTIFICATION') {
      const title = String(msg.title || 'BlockFlow').slice(0, 120);
      const message = String(msg.message || '').slice(0, 2000) || 'Értesítés';
      const notificationId = `blockflow-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      await chrome.notifications.create(notificationId, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icons/icon128.png'),
        title,
        message,
        priority: 1
      });
      sendResponse({ ok: true, notificationId });
      return;
    }
  })().catch(err => sendResponse({ ok: false, error: String(err.message || err) }));
  return true;
});
