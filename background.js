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

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    if (msg?.type === 'OPEN_BUILDER') {
      const target = await getUsableTargetTab(msg.tabId || sender?.tab?.id);
      if (target?.id) await setLastActiveTab(target.id);
      const qs = target?.id ? `?targetTabId=${encodeURIComponent(target.id)}` : '';
      await chrome.windows.create({
        url: chrome.runtime.getURL('builder.html') + qs,
        type: 'popup',
        width: 1320,
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
      if (msg.payload?.type === 'BF_START_PICKER') {
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
      await chrome.tabs.create({ url: msg.url });
      sendResponse({ ok: true });
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
        try { item.sendResponse({ ok: true, action: msg.action || 'continue' }); } catch (_) {}
        try { await chrome.storage.local.remove(`feedback_${id}`); } catch (_) {}
        if (item.windowId) { try { await chrome.windows.remove(item.windowId); } catch (_) {} }
      }
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
