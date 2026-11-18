import { canSleepAuto } from './rules';
import { getSettings } from './settings';
import { getLastActive, seedMissingTabs } from './activity';

/**
 * Checks if an error is a harmless race-condition error indicating a tab was already closed.
 */
export function isTabGoneError(error: unknown): boolean {
  if (!error) {
    return false;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /no tab with id/i.test(message);
}

/**
 * Checks whether a tab is eligible and has exceeded the idle threshold.
 */
export function isTabIdleExpired(
  tab: chrome.tabs.Tab,
  whitelist: string[] | readonly string[],
  idleMinutes: number,
  lastActive: Record<number, number>,
  now: number = Date.now()
): boolean {
  if (!canSleepAuto(tab, whitelist)) {
    return false;
  }
  if (typeof tab.id !== 'number') {
    return false;
  }
  const timestamp = lastActive[tab.id];
  if (typeof timestamp !== 'number' || timestamp <= 0) {
    return false;
  }
  return now - timestamp >= idleMinutes * 60_000;
}

/**
 * Discards all eligible tabs based on automatic sleep safety rules.
 * Runs each discard inside its own try/catch so one error does not abort the rest.
 * Active tabs across all windows are preserved, and user tabs are never switched.
 * Returns the count of tabs successfully discarded.
 */
export async function sleepTabs(
  tabs: chrome.tabs.Tab[],
  whitelist: string[] | readonly string[]
): Promise<number> {
  const eligibleTabs = tabs.filter((tab) => canSleepAuto(tab, whitelist));
  let count = 0;

  for (const tab of eligibleTabs) {
    if (typeof tab.id !== 'number') {
      continue;
    }
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs?.get && chrome.tabs?.discard) {
        // Re-fetch fresh tab state before discarding to prevent race condition
        let freshTab: chrome.tabs.Tab;
        try {
          freshTab = await chrome.tabs.get(tab.id);
        } catch (fetchErr) {
          if (isTabGoneError(fetchErr)) {
            console.debug(`Tab ${tab.id} was closed before discarding.`);
          } else {
            console.error(`Failed to get fresh state for tab ${tab.id}:`, fetchErr);
          }
          continue;
        }

        if (!canSleepAuto(freshTab, whitelist)) {
          continue;
        }

        await chrome.tabs.discard(tab.id);
        count++;
      }
    } catch (error) {
      if (isTabGoneError(error)) {
        console.debug(`Tab ${tab.id} was closed before discarding.`);
      } else {
        console.error(`Failed to discard tab ${tab.id} (${tab.title || 'untitled'}):`, error);
      }
    }
  }

  return count;
}

/**
 * Puts idle tabs to sleep based on saved settings and last-active timestamps.
 * Reads everything fresh on each execution: settings, lastActive, and open tabs.
 * Never sleeps active tabs, pinned tabs, audible tabs, non-HTTP(S) tabs, or whitelisted domains.
 * Tabs without timestamps are seeded with Date.now() so they can become idle later.
 */
export async function sleepIdleTabs(): Promise<number> {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query) {
    return 0;
  }

  // Read fresh settings, activity timestamps, and open tabs
  const [settings, lastActive, allTabs] = await Promise.all([
    getSettings(),
    getLastActive(),
    chrome.tabs.query({}),
  ]);

  const now = Date.now();
  const eligibleTabs: chrome.tabs.Tab[] = [];
  let missingTimestamps = false;

  for (const tab of allTabs) {
    if (typeof tab.id !== 'number') {
      continue;
    }

    const timestamp = lastActive[tab.id];
    if (typeof timestamp !== 'number' || timestamp <= 0) {
      missingTimestamps = true;
      continue;
    }

    if (isTabIdleExpired(tab, settings.whitelist, settings.idleMinutes, lastActive, now)) {
      eligibleTabs.push(tab);
    }
  }

  // If any open tabs lacked timestamps, seed them for future idle checks
  if (missingTimestamps) {
    seedMissingTabs().catch((err) => {
      console.error('Failed to seed missing tab timestamps in sleepIdleTabs:', err);
    });
  }

  let count = 0;
  for (const tab of eligibleTabs) {
    if (typeof tab.id !== 'number') {
      continue;
    }
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs?.get && chrome.tabs?.discard) {
        // Re-fetch fresh tab state before discarding to prevent race condition
        let freshTab: chrome.tabs.Tab;
        try {
          freshTab = await chrome.tabs.get(tab.id);
        } catch (fetchErr) {
          if (isTabGoneError(fetchErr)) {
            console.debug(`Tab ${tab.id} was closed before discarding.`);
          } else {
            console.error(`Failed to get fresh state for tab ${tab.id}:`, fetchErr);
          }
          continue;
        }

        if (!canSleepAuto(freshTab, settings.whitelist)) {
          continue;
        }

        await chrome.tabs.discard(tab.id);
        count++;
      }
    } catch (error) {
      if (isTabGoneError(error)) {
        console.debug(`Tab ${tab.id} was closed before discarding.`);
      } else {
        console.error(`Failed to discard idle tab ${tab.id} (${tab.title || 'untitled'}):`, error);
      }
    }
  }

  return count;
}
