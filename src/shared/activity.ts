export const LAST_ACTIVE_STORAGE_KEY = 'lastActive';

export type LastActiveMap = Record<number, number>;

// Promise write queue: all writes are serialized to prevent overlapping writes from clobbering each other
let writeQueue: Promise<void> = Promise.resolve();

function enqueueWrite<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    writeQueue = writeQueue
      .then(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      })
      .catch((err) => {
        console.error('Error in activity write queue:', err);
      });
  });
}

/**
 * Reads the lastActive map from chrome.storage.local.
 */
export async function getLastActive(): Promise<Record<number, number>> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return {};
  }
  try {
    const result = await chrome.storage.local.get(LAST_ACTIVE_STORAGE_KEY);
    return (result[LAST_ACTIVE_STORAGE_KEY] as Record<number, number>) || {};
  } catch (error) {
    console.error('Failed to read lastActive from storage:', error);
    return {};
  }
}

/**
 * Updates the last-active timestamp of a tab to Date.now().
 */
export function touchTab(tabId: number): Promise<void> {
  if (typeof tabId !== 'number' || tabId <= 0) {
    return Promise.resolve();
  }
  return enqueueWrite(async () => {
    const current = await getLastActive();
    current[tabId] = Date.now();
    await chrome.storage.local.set({ [LAST_ACTIVE_STORAGE_KEY]: current });
  });
}

/**
 * Removes a tab's entry from lastActive when the tab is closed.
 */
export function removeTab(tabId: number): Promise<void> {
  if (typeof tabId !== 'number') {
    return Promise.resolve();
  }
  return enqueueWrite(async () => {
    const current = await getLastActive();
    if (tabId in current) {
      delete current[tabId];
      await chrome.storage.local.set({ [LAST_ACTIVE_STORAGE_KEY]: current });
    }
  });
}

/**
 * Seeds Date.now() only for currently open tabs that do not have an entry yet.
 * Used during extension installation and reload.
 */
export function seedMissingTabs(): Promise<void> {
  return enqueueWrite(async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs?.query) {
      return;
    }
    const allTabs = await chrome.tabs.query({});
    const current = await getLastActive();
    const now = Date.now();
    let hasChanges = false;

    for (const tab of allTabs) {
      if (typeof tab.id === 'number' && current[tab.id] === undefined) {
        current[tab.id] = now;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      await chrome.storage.local.set({ [LAST_ACTIVE_STORAGE_KEY]: current });
    }
  });
}

/**
 * Resets all currently open tabs to Date.now().
 * Used on browser startup since tab IDs change after restart.
 */
export function resetAllTabs(): Promise<void> {
  return enqueueWrite(async () => {
    if (typeof chrome === 'undefined' || !chrome.tabs?.query) {
      return;
    }
    const allTabs = await chrome.tabs.query({});
    const newLastActive: Record<number, number> = {};
    const now = Date.now();

    for (const tab of allTabs) {
      if (typeof tab.id === 'number') {
        newLastActive[tab.id] = now;
      }
    }

    await chrome.storage.local.set({ [LAST_ACTIVE_STORAGE_KEY]: newLastActive });
  });
}

/**
 * Formats an elapsed idle time in milliseconds into a concise display string:
 * - "<1m" under one minute
 * - "12m" under one hour
 * - "1h 5m" afterwards
 */
export function formatIdle(ms: number): string {
  if (ms < 60_000) {
    return '<1m';
  }
  if (ms < 3_600_000) {
    const mins = Math.floor(ms / 60_000);
    return `${mins}m`;
  }
  const hours = Math.floor(ms / 3_600_000);
  const remainingMins = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${remainingMins}m`;
}

