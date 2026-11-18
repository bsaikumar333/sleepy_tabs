import { useState, useEffect, useCallback } from 'react';
import {
  type Settings,
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  getSettings,
  saveSettings,
  resetSettings,
} from '../../shared/settings';

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    // Load initial settings
    getSettings()
      .then((loaded) => {
        if (isMounted) {
          setSettings(loaded);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load settings in useSettings:', err);
        if (isMounted) {
          setLoading(false);
        }
      });

    // Subscribe to storage changes
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes[SETTINGS_STORAGE_KEY]) {
        if (isMounted && changes[SETTINGS_STORAGE_KEY].newValue) {
          setSettings(changes[SETTINGS_STORAGE_KEY].newValue as Settings);
        }
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }

    return () => {
      isMounted = false;
      if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
    };
  }, []);

  const update = useCallback(async (partial: Partial<Settings>) => {
    try {
      const updated = await saveSettings(partial);
      setSettings(updated);
      return updated;
    } catch (err) {
      console.error('Failed to update settings:', err);
      throw err;
    }
  }, []);

  const reset = useCallback(async () => {
    try {
      const defaults = await resetSettings();
      setSettings(defaults);
      return defaults;
    } catch (err) {
      console.error('Failed to reset settings:', err);
      throw err;
    }
  }, []);

  return { settings, loading, update, reset };
}

