import { useState, useEffect } from 'react';
import { getLastActive, LAST_ACTIVE_STORAGE_KEY } from '../../shared/activity';

export function useLastActive() {
  const [lastActive, setLastActive] = useState<Record<number, number>>({});
  const [, setTick] = useState(0);

  useEffect(() => {
    let isMounted = true;

    // 1. Initial read
    getLastActive()
      .then((data) => {
        if (isMounted) {
          setLastActive(data);
        }
      })
      .catch((err) => console.error('Error reading lastActive in hook:', err));

    // 2. Subscribe to storage changes
    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && changes[LAST_ACTIVE_STORAGE_KEY]) {
        if (isMounted) {
          setLastActive(
            (changes[LAST_ACTIVE_STORAGE_KEY].newValue as Record<number, number>) || {}
          );
        }
      }
    };

    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener(handleStorageChange);
    }

    // 3. Re-render every 30 seconds so idle elapsed times keep incrementing
    const intervalId = window.setInterval(() => {
      if (isMounted) {
        setTick((prev) => prev + 1);
      }
    }, 30_000);

    // 4. Cleanup on unmount
    return () => {
      isMounted = false;
      if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
        chrome.storage.onChanged.removeListener(handleStorageChange);
      }
      window.clearInterval(intervalId);
    };
  }, []);

  return { lastActive };
}

