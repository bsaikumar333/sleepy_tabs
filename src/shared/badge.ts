import { getSettings } from './settings';
import { estimateSavedMB, formatMB } from './memory';
import { isTabGoneError } from './sleep';

/**
 * Queries all tabs and updates the toolbar extension badge with the count of asleep (discarded) tabs
 * and estimated memory saved in the tooltip.
 * Always computes from fresh chrome.tabs.query and getSettings results.
 */
export async function updateBadge(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query || !chrome.action) {
    return;
  }
  try {
    const [allTabs, settings] = await Promise.all([
      chrome.tabs.query({}),
      getSettings(),
    ]);

    const sleepingCount = allTabs.filter((tab) => tab.discarded === true).length;
    const text = sleepingCount > 99 ? '99+' : sleepingCount > 0 ? String(sleepingCount) : '';

    const savedMB = estimateSavedMB(sleepingCount, settings.mbPerTab);
    const formattedSaved = formatMB(savedMB);
    const tabWord = sleepingCount === 1 ? 'tab' : 'tabs';

    await Promise.all([
      chrome.action.setBadgeText({ text }),
      chrome.action.setBadgeBackgroundColor({ color: '#B5532F' }),
      chrome.action.setTitle({
        title: `Sleepy Tabs: ${sleepingCount} ${tabWord} asleep, ≈ ${formattedSaved} saved`,
      }),
    ]);
  } catch (err) {
    if (isTabGoneError(err)) {
      console.debug('Tab was closed during updateBadge:', err);
    } else {
      console.error('Failed to update extension badge:', err);
    }
  }
}
