import { useState, useEffect, useCallback, useRef } from 'react';

export function useTabs() {
  const [tabs, setTabs] = useState<chrome.tabs.Tab[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const isMountedRef = useRef<boolean>(true);

  const fetchTabs = useCallback(async () => {
    try {
      if (typeof chrome === 'undefined' || !chrome.tabs?.query) {
        return;
      }
      const allTabs = await chrome.tabs.query({});
      if (isMountedRef.current) {
        setTabs(allTabs);
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching tabs:', error);
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchTabs();

    if (typeof chrome === 'undefined' || !chrome.tabs) {
      return;
    }

    const handleTabChange = () => {
      fetchTabs();
    };

    chrome.tabs.onCreated.addListener(handleTabChange);
    chrome.tabs.onRemoved.addListener(handleTabChange);
    chrome.tabs.onUpdated.addListener(handleTabChange);
    chrome.tabs.onActivated.addListener(handleTabChange);
    chrome.tabs.onAttached.addListener(handleTabChange);
    chrome.tabs.onDetached.addListener(handleTabChange);

    return () => {
      isMountedRef.current = false;
      chrome.tabs.onCreated.removeListener(handleTabChange);
      chrome.tabs.onRemoved.removeListener(handleTabChange);
      chrome.tabs.onUpdated.removeListener(handleTabChange);
      chrome.tabs.onActivated.removeListener(handleTabChange);
      chrome.tabs.onAttached.removeListener(handleTabChange);
      chrome.tabs.onDetached.removeListener(handleTabChange);
    };
  }, [fetchTabs]);

  return { tabs, loading };
}

