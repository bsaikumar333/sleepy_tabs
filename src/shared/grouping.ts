import { isTabGoneError } from './sleep';

const GROUP_COLORS: chrome.tabGroups.ColorEnum[] = [
  'grey',
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'cyan',
  'orange',
];

/**
 * Extracts a normalized site key from a URL (e.g. "youtube.com", "wikipedia.org").
 * Strips leading "www." and returns null if not HTTP/HTTPS or unparseable.
 */
export function getSiteKey(url?: string): string | null {
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    let host = parsed.hostname.toLowerCase();
    if (host.startsWith('www.')) {
      host = host.slice(4);
    }
    return host || null;
  } catch {
    return null;
  }
}

/**
 * Groups open tabs by site domain within each browser window.
 * Only sites with 2 or more tabs in a window are grouped.
 * Reuses existing groups with the same title to avoid duplication.
 */
export async function groupTabsBySite(): Promise<{ groups: number; tabs: number }> {
  if (typeof chrome === 'undefined' || !chrome.tabs?.group || !chrome.tabGroups) {
    return { groups: 0, tabs: 0 };
  }

  const allTabs = await chrome.tabs.query({});

  // Group tabs by windowId (chrome.tabs.group cannot move tabs between windows)
  const tabsByWindow: Record<number, chrome.tabs.Tab[]> = {};
  for (const tab of allTabs) {
    if (tab.pinned) {
      continue;
    }
    if (typeof tab.id !== 'number' || typeof tab.windowId !== 'number') {
      continue;
    }
    if (!getSiteKey(tab.url)) {
      continue;
    }

    if (!tabsByWindow[tab.windowId]) {
      tabsByWindow[tab.windowId] = [];
    }
    tabsByWindow[tab.windowId].push(tab);
  }

  let totalGroupsCount = 0;
  let totalTabsCount = 0;
  let colorIndex = 0;

  for (const [windowIdStr, windowTabs] of Object.entries(tabsByWindow)) {
    const windowId = Number(windowIdStr);

    // Bucket tabs by siteKey within this window
    const siteBuckets: Record<string, number[]> = {};
    for (const tab of windowTabs) {
      const site = getSiteKey(tab.url);
      if (!site) {
        continue;
      }
      if (!siteBuckets[site]) {
        siteBuckets[site] = [];
      }
      siteBuckets[site].push(tab.id as number);
    }

    // Only create/update a group for sites that have 2 or more tabs in this window
    for (const [site, tabIds] of Object.entries(siteBuckets)) {
      if (tabIds.length < 2) {
        continue;
      }

      try {
        // Check if a group with the same title already exists in this window
        const existingGroups = await chrome.tabGroups.query({ windowId, title: site });
        let groupId: number;

        if (existingGroups.length > 0 && typeof existingGroups[0].id === 'number') {
          groupId = existingGroups[0].id;
          await chrome.tabs.group({ groupId, tabIds });
        } else {
          groupId = await chrome.tabs.group({ tabIds });
        }

        const color = GROUP_COLORS[colorIndex % GROUP_COLORS.length];
        colorIndex++;

        await chrome.tabGroups.update(groupId, {
          title: site,
          collapsed: false,
          color,
        });

        totalGroupsCount++;
        totalTabsCount += tabIds.length;
      } catch (err) {
        if (isTabGoneError(err)) {
          console.debug(`One or more tabs for site "${site}" were closed before grouping:`, err);
        } else {
          console.error(`Failed to group tabs for site "${site}" in window ${windowId}:`, err);
        }
      }
    }
  }

  return { groups: totalGroupsCount, tabs: totalTabsCount };
}

/**
 * Ungroups all currently grouped tabs across all browser windows.
 * Returns the count of ungrouped tabs.
 */
export async function ungroupAll(): Promise<number> {
  if (typeof chrome === 'undefined' || !chrome.tabs?.ungroup) {
    return 0;
  }
  try {
    const allTabs = await chrome.tabs.query({});
    const noneId = chrome.tabGroups?.TAB_GROUP_ID_NONE ?? -1;
    const groupedTabs = allTabs.filter(
      (tab) =>
        typeof tab.id === 'number' &&
        typeof tab.groupId === 'number' &&
        tab.groupId !== noneId
    );

    if (groupedTabs.length === 0) {
      return 0;
    }

    // Group tab IDs by window to safely ungroup per window
    const tabsByWindow: Record<number, number[]> = {};
    for (const tab of groupedTabs) {
      const wId = tab.windowId ?? 0;
      if (!tabsByWindow[wId]) {
        tabsByWindow[wId] = [];
      }
      tabsByWindow[wId].push(tab.id as number);
    }

    let ungroupedCount = 0;
    for (const tabIds of Object.values(tabsByWindow)) {
      try {
        await chrome.tabs.ungroup(tabIds);
        ungroupedCount += tabIds.length;
      } catch (err) {
        if (isTabGoneError(err)) {
          console.debug('One or more tabs were closed before ungrouping:', err);
        } else {
          console.error('Failed to ungroup tab batch:', err);
        }
      }
    }

    return ungroupedCount;
  } catch (err) {
    if (isTabGoneError(err)) {
      console.debug('Tab was closed during ungroupAll:', err);
    } else {
      console.error('Failed to ungroup tabs:', err);
    }
    return 0;
  }
}

