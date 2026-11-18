import {
  touchTab,
  removeTab,
  seedMissingTabs,
  resetAllTabs,
} from '../shared/activity';
import { getSettings } from '../shared/settings';
import { sleepIdleTabs } from '../shared/sleep';
import { updateBadge } from '../shared/badge';

// Sleepy Tabs background service worker
console.log('Sleepy Tabs service worker started');

const SESSION_ACTIVE_KEY = 'activeTabsByWindow';
const IDLE_ALARM_NAME = 'sleepy-idle-check';

let badgeDebounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Debounces badge updates so a rapid burst of tab events triggers only one refresh.
 */
function requestBadgeUpdate(): void {
  if (badgeDebounceTimer !== null) {
    clearTimeout(badgeDebounceTimer);
  }
  badgeDebounceTimer = setTimeout(() => {
    badgeDebounceTimer = null;
    updateBadge().catch((err) => console.error('Error updating badge:', err));
  }, 300);
}

/**
 * Ensures the 1-minute periodic alarm exists for checking idle tabs.
 */
async function ensureAlarm(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.alarms) {
    return;
  }
  try {
    const existing = await chrome.alarms.get(IDLE_ALARM_NAME);
    if (!existing) {
      chrome.alarms.create(IDLE_ALARM_NAME, { periodInMinutes: 1 });
      console.log(`Created alarm: ${IDLE_ALARM_NAME} (period: 1 min)`);
    }
  } catch (err) {
    console.error('Failed to ensure alarm:', err);
  }
}

/**
 * Retrieves the map of windowId -> tabId from chrome.storage.session.
 */
async function getActiveTabsByWindow(): Promise<Record<number, number>> {
  if (typeof chrome === 'undefined' || !chrome.storage?.session) {
    return {};
  }
  try {
    const result = await chrome.storage.session.get(SESSION_ACTIVE_KEY);
    return (result[SESSION_ACTIVE_KEY] as Record<number, number>) || {};
  } catch (err) {
    console.error('Failed to get session active tabs:', err);
    return {};
  }
}

/**
 * Stores the active tabId for a given windowId in chrome.storage.session.
 */
async function setActiveTabForWindow(windowId: number, tabId: number): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.session) {
    return;
  }
  try {
    const map = await getActiveTabsByWindow();
    map[windowId] = tabId;
    await chrome.storage.session.set({ [SESSION_ACTIVE_KEY]: map });
  } catch (err) {
    console.error('Failed to set session active tab:', err);
  }
}

/**
 * Removes a closed tab from the windowId -> tabId map in chrome.storage.session.
 */
async function removeTabFromWindowSession(tabId: number, windowId?: number): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.storage?.session) {
    return;
  }
  try {
    const map = await getActiveTabsByWindow();
    let changed = false;
    if (typeof windowId === 'number' && map[windowId] === tabId) {
      delete map[windowId];
      changed = true;
    } else {
      for (const [wId, tId] of Object.entries(map)) {
        if (tId === tabId) {
          delete map[Number(wId)];
          changed = true;
        }
      }
    }
    if (changed) {
      await chrome.storage.session.set({ [SESSION_ACTIVE_KEY]: map });
    }
  } catch (err) {
    console.error('Failed to remove tab from session:', err);
  }
}

// Initial worker startup setup
ensureAlarm().catch((err) => console.error('Error ensuring alarm at startup:', err));
updateBadge().catch((err) => console.error('Error updating badge at startup:', err));

// 1. chrome.tabs.onActivated:
// Touch newly active tab AND the tab previously active in the same window,
// so a tab used for two hours starts counting idle time from the moment user leaves it.
chrome.tabs.onActivated.addListener((activeInfo) => {
  (async () => {
    try {
      const activeMap = await getActiveTabsByWindow();
      const prevTabId = activeMap[activeInfo.windowId];

      if (typeof prevTabId === 'number' && prevTabId !== activeInfo.tabId) {
        await touchTab(prevTabId);
      }

      await touchTab(activeInfo.tabId);
      await setActiveTabForWindow(activeInfo.windowId, activeInfo.tabId);
    } catch (err) {
      console.error('Error handling onActivated:', err);
    }
  })();
});

// 2. chrome.tabs.onCreated: touch tab and request badge update
chrome.tabs.onCreated.addListener((tab) => {
  if (typeof tab.id === 'number') {
    touchTab(tab.id).catch((err) => console.error('Error handling onCreated:', err));
  }
  requestBadgeUpdate();
});

// 3. chrome.tabs.onUpdated: touch on complete, update badge if status or discarded changed
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') {
    touchTab(tabId).catch((err) => console.error('Error handling onUpdated:', err));
  }
  if (changeInfo.discarded !== undefined || changeInfo.status !== undefined) {
    requestBadgeUpdate();
  }
});

// 4. chrome.tabs.onRemoved: clean up and request badge update
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  removeTab(tabId).catch((err) => console.error('Error handling onRemoved lastActive:', err));
  removeTabFromWindowSession(tabId, removeInfo.windowId).catch((err) =>
    console.error('Error handling onRemoved session:', err)
  );
  requestBadgeUpdate();
});

// 5. chrome.tabs.onAttached: request badge update
chrome.tabs.onAttached.addListener(() => {
  requestBadgeUpdate();
});

// 6. chrome.tabs.onDetached: request badge update
chrome.tabs.onDetached.addListener(() => {
  requestBadgeUpdate();
});

// 7. chrome.runtime.onInstalled:
// Seed missing tabs, initialize active tabs map, ensure alarm, and update badge
chrome.runtime.onInstalled.addListener(() => {
  ensureAlarm().catch((err) => console.error('Error ensuring alarm in onInstalled:', err));
  updateBadge().catch((err) => console.error('Error updating badge in onInstalled:', err));
  seedMissingTabs()
    .then(async () => {
      const activeTabs = await chrome.tabs.query({ active: true });
      const activeMap: Record<number, number> = {};
      for (const tab of activeTabs) {
        if (typeof tab.windowId === 'number' && typeof tab.id === 'number') {
          activeMap[tab.windowId] = tab.id;
        }
      }
      await chrome.storage.session.set({ [SESSION_ACTIVE_KEY]: activeMap });
    })
    .catch((err) => console.error('Error in onInstalled seedMissingTabs:', err));
});

// 8. chrome.runtime.onStartup:
// Reset all tabs to now, ensure alarm, and update badge
chrome.runtime.onStartup.addListener(() => {
  ensureAlarm().catch((err) => console.error('Error ensuring alarm in onStartup:', err));
  updateBadge().catch((err) => console.error('Error updating badge in onStartup:', err));
  resetAllTabs().catch((err) => console.error('Error in onStartup resetAllTabs:', err));
});

// 9. chrome.alarms.onAlarm:
// Check idle tabs every minute if autoSleep is enabled, then refresh badge
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== IDLE_ALARM_NAME) {
    return;
  }

  (async () => {
    try {
      const settings = await getSettings();
      if (!settings.autoSleep) {
        return;
      }
      const count = await sleepIdleTabs();
      if (count > 0) {
        console.log(`Sleepy Tabs alarm put ${count} idle tab(s) to sleep`);
      }
      await updateBadge();
    } catch (err) {
      console.error('Error running sleepy-idle-check alarm:', err);
    }
  })();
});

// 10. chrome.runtime.onMessage:
// Allow external/popup triggers to run idle sleeping
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'sleepIdleNow') {
    sleepIdleTabs()
      .then((count) => {
        updateBadge().catch(console.error);
        sendResponse({ count });
      })
      .catch((err) => {
        console.error('Failed to run sleepIdleNow via message:', err);
        sendResponse({ count: 0, error: String(err) });
      });
    return true; // Keep message channel open for async response
  }
  return false;
});
