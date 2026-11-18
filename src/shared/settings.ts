import { DEFAULT_WHITELIST, normalizeDomain } from './rules';

export interface Settings {
  autoSleep: boolean;
  idleMinutes: number;
  whitelist: string[];
  mbPerTab: number;
}

export const SETTINGS_STORAGE_KEY = 'settings';

export const DEFAULT_SETTINGS: Settings = {
  autoSleep: true,
  idleMinutes: 30,
  whitelist: [...DEFAULT_WHITELIST],
  mbPerTab: 100,
};

let settingsWriteQueue: Promise<void> = Promise.resolve();

function enqueueSettingsWrite<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    settingsWriteQueue = settingsWriteQueue
      .then(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (err) {
          reject(err);
        }
      })
      .catch((err) => {
        console.error('Error in settings write queue:', err);
      });
  });
}

/**
 * Validates and sanitizes settings fields against constraints:
 * - idleMinutes: integer clamped between 1 and 1440
 * - whitelist: normalized with normalizeDomain, empty entries removed, duplicates removed
 * - autoSleep: boolean
 */
export function sanitizeSettings(
  settings: Partial<Settings>,
  fallback: Settings = DEFAULT_SETTINGS
): Settings {
  let autoSleep = fallback.autoSleep;
  if (typeof settings.autoSleep === 'boolean') {
    autoSleep = settings.autoSleep;
  }

  let idleMinutes = fallback.idleMinutes;
  if (typeof settings.idleMinutes === 'number' && !Number.isNaN(settings.idleMinutes)) {
    const rounded = Math.round(settings.idleMinutes);
    idleMinutes = Math.min(1440, Math.max(1, rounded));
  }

  let whitelist = fallback.whitelist;
  if (Array.isArray(settings.whitelist)) {
    const cleaned = settings.whitelist
      .map((entry) => normalizeDomain(entry))
      .filter((entry) => entry.length > 0);
    whitelist = Array.from(new Set(cleaned));
  }

  let mbPerTab = fallback.mbPerTab;
  if (typeof settings.mbPerTab === 'number' && !Number.isNaN(settings.mbPerTab)) {
    const rounded = Math.round(settings.mbPerTab);
    mbPerTab = Math.min(1000, Math.max(10, rounded));
  }

  return {
    autoSleep,
    idleMinutes,
    whitelist,
    mbPerTab,
  };
}

/**
 * Reads settings from chrome.storage.local, merging over DEFAULT_SETTINGS.
 */
export async function getSettings(): Promise<Settings> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return { ...DEFAULT_SETTINGS };
  }
  try {
    const result = await chrome.storage.local.get(SETTINGS_STORAGE_KEY);
    const stored = result[SETTINGS_STORAGE_KEY];
    if (!stored || typeof stored !== 'object') {
      return { ...DEFAULT_SETTINGS };
    }
    return sanitizeSettings(stored, DEFAULT_SETTINGS);
  } catch (error) {
    console.error('Failed to read settings from storage:', error);
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Saves partial settings to chrome.storage.local through a promise queue.
 */
export function saveSettings(partial: Partial<Settings>): Promise<Settings> {
  return enqueueSettingsWrite(async () => {
    const current = await getSettings();
    const updated = sanitizeSettings({ ...current, ...partial }, current);
    await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: updated });
    return updated;
  });
}

/**
 * Resets settings to DEFAULT_SETTINGS.
 */
export function resetSettings(): Promise<Settings> {
  return enqueueSettingsWrite(async () => {
    const defaults: Settings = {
      autoSleep: DEFAULT_SETTINGS.autoSleep,
      idleMinutes: DEFAULT_SETTINGS.idleMinutes,
      whitelist: [...DEFAULT_SETTINGS.whitelist],
      mbPerTab: DEFAULT_SETTINGS.mbPerTab,
    };
    await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: defaults });
    return defaults;
  });
}

