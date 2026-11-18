import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  Moon,
  Clock,
  Loader2,
  Layers,
  Settings as SettingsIcon,
  ArrowLeft,
  FolderTree,
  Ungroup,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTabs } from './hooks/useTabs';
import { useLastActive } from './hooks/useLastActive';
import { useSettings } from './hooks/useSettings';
import { TabItem } from './components/TabItem';
import { SettingsPanel } from './components/SettingsPanel';
import { Toast, type ToastState, type ToastType } from './components/Toast';
import { canSleepAuto } from '../shared/rules';
import { sleepTabs, sleepIdleTabs, isTabIdleExpired } from '../shared/sleep';
import { groupTabsBySite, ungroupAll } from '../shared/grouping';
import { estimateSavedMB, formatMB } from '../shared/memory';

export default function App() {
  const [view, setView] = useState<'tabs' | 'settings'>('tabs');
  const { tabs, loading: loadingTabs } = useTabs();
  const { lastActive } = useLastActive();
  const {
    settings,
    loading: loadingSettings,
    update: updateSettings,
    reset: resetSettings,
  } = useSettings();

  const [toast, setToast] = useState<ToastState | null>(null);
  const [isSleepingAll, setIsSleepingAll] = useState(false);
  const [isSleepingIdle, setIsSleepingIdle] = useState(false);
  const [isGrouping, setIsGrouping] = useState(false);
  const [isUngrouping, setIsUngrouping] = useState(false);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, type: ToastType) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast({ message, type });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 2500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const handleSleepSuccess = useCallback(() => {
    showToast('Tab put to sleep', 'success');
  }, [showToast]);

  const handleSleepError = useCallback((message: string) => {
    showToast(message || 'Could not sleep this tab', 'error');
  }, [showToast]);

  // Count tabs eligible for "Sleep all"
  const sleepableCount = useMemo(() => {
    return tabs.filter((t) => canSleepAuto(t, settings.whitelist)).length;
  }, [tabs, settings.whitelist]);

  // Count currently sleeping tabs
  const sleepingCount = useMemo(() => {
    return tabs.filter((t) => t.discarded === true).length;
  }, [tabs]);

  // Estimated memory saved in MB
  const savedMB = useMemo(() => {
    return estimateSavedMB(sleepingCount, settings.mbPerTab ?? 100);
  }, [sleepingCount, settings.mbPerTab]);

  const formattedSavedMB = useMemo(() => {
    return formatMB(savedMB);
  }, [savedMB]);

  // Count tabs eligible for "Sleep idle tabs"
  const idleSleepableCount = useMemo(() => {
    const now = Date.now();
    return tabs.filter((t) =>
      isTabIdleExpired(t, settings.whitelist, settings.idleMinutes, lastActive, now)
    ).length;
  }, [tabs, settings.whitelist, settings.idleMinutes, lastActive]);

  const handleSleepAll = async () => {
    if (
      isSleepingAll ||
      isSleepingIdle ||
      isGrouping ||
      isUngrouping ||
      loadingTabs ||
      loadingSettings
    ) {
      return;
    }

    setIsSleepingAll(true);
    try {
      const allTabs =
        typeof chrome !== 'undefined' && chrome.tabs?.query
          ? await chrome.tabs.query({})
          : tabs;
      const count = await sleepTabs(allTabs, settings.whitelist);
      if (count > 0) {
        showToast(`Slept ${count} tab(s)`, 'success');
      } else {
        showToast('No tabs to sleep', 'neutral');
      }
    } catch (error) {
      console.error('Failed to sleep all tabs:', error);
      showToast('Could not sleep tabs', 'error');
    } finally {
      setIsSleepingAll(false);
    }
  };

  const handleSleepIdle = async () => {
    if (
      isSleepingIdle ||
      isSleepingAll ||
      isGrouping ||
      isUngrouping ||
      loadingTabs ||
      loadingSettings
    ) {
      return;
    }

    setIsSleepingIdle(true);
    try {
      const count = await sleepIdleTabs();
      if (count > 0) {
        showToast(`Slept ${count} idle tab(s)`, 'success');
      } else {
        showToast('No idle tabs to sleep', 'neutral');
      }
    } catch (error) {
      console.error('Failed to sleep idle tabs:', error);
      showToast('Could not sleep idle tabs', 'error');
    } finally {
      setIsSleepingIdle(false);
    }
  };

  const handleGroupTabs = async () => {
    if (
      isGrouping ||
      isUngrouping ||
      isSleepingAll ||
      isSleepingIdle ||
      loadingTabs
    ) {
      return;
    }

    setIsGrouping(true);
    try {
      const result = await groupTabsBySite();
      if (result.groups > 0) {
        showToast(
          `Grouped ${result.tabs} tab(s) into ${result.groups} group(s)`,
          'success'
        );
      } else {
        showToast('No sites with 2+ tabs to group', 'neutral');
      }
    } catch (err) {
      console.error('Failed to group tabs by site:', err);
      showToast('Could not group tabs', 'error');
    } finally {
      setIsGrouping(false);
    }
  };

  const handleUngroupTabs = async () => {
    if (
      isGrouping ||
      isUngrouping ||
      isSleepingAll ||
      isSleepingIdle ||
      loadingTabs
    ) {
      return;
    }

    setIsUngrouping(true);
    try {
      const count = await ungroupAll();
      if (count > 0) {
        showToast(`Ungrouped ${count} tab(s)`, 'success');
      } else {
        showToast('No groups to ungroup', 'neutral');
      }
    } catch (err) {
      console.error('Failed to ungroup tabs:', err);
      showToast('Could not ungroup tabs', 'error');
    } finally {
      setIsUngrouping(false);
    }
  };

  const tabCountText = `${tabs.length} ${tabs.length === 1 ? 'tab' : 'tabs'}`;

  return (
    <div className="relative w-[340px] bg-[var(--color-bg)] text-[var(--color-text)] font-sans antialiased flex flex-col min-h-[160px]">
      {/* Header */}
      <header className="px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] flex items-center justify-between sticky top-0 z-10">
        {view === 'tabs' ? (
          <>
            <div className="flex items-baseline gap-2">
              <h1 className="text-[16px] font-semibold text-[var(--color-text)] tracking-tight">
                Sleepy Tabs
              </h1>
              {!loadingTabs && (
                <span className="text-[12px] font-normal text-[var(--color-muted)]">
                  {tabCountText}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setView('settings')}
              title="Settings"
              aria-label="Settings"
              className="p-1 rounded-[8px] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
            >
              <SettingsIcon className="w-4 h-4" />
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setView('tabs')}
              title="Back to tabs"
              aria-label="Back to tabs"
              className="p-1 -ml-1 rounded-[8px] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-[16px] font-semibold text-[var(--color-text)] tracking-tight">
              Settings
            </h1>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="p-3">
        <AnimatePresence mode="wait">
          {view === 'tabs' ? (
            <motion.div
              key="tabs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              {/* Estimated Memory Saved Stats Line */}
              <div
                title="Estimate: sleeping tabs × memory per tab (set in Settings)"
                className="mb-1.5 px-0.5 text-[12px] text-[var(--color-muted)]"
              >
                {sleepingCount > 0 ? (
                  <span>
                    ≈{' '}
                    <span className="font-semibold text-[var(--color-primary)]">
                      {formattedSavedMB}
                    </span>{' '}
                    saved · {sleepingCount} {sleepingCount === 1 ? 'tab' : 'tabs'} asleep
                  </span>
                ) : (
                  <span>No tabs asleep yet</span>
                )}
              </div>

              {/* Status Line */}
              <div className="flex items-center justify-between mb-2 px-0.5 text-[11px] text-[var(--color-muted)]">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-block w-1.5 h-1.5 rounded-full ${
                      settings.autoSleep
                        ? 'bg-[var(--color-primary)]'
                        : 'bg-[var(--color-muted)]'
                    }`}
                  />
                  <span>
                    {settings.autoSleep
                      ? `Auto-sleep on: tabs idle for ${settings.idleMinutes}+ min`
                      : 'Auto-sleep off'}
                  </span>
                </div>
              </div>

              {/* Action Controls Section */}
              <div className="space-y-1.5 mb-2.5 px-0.5">
                {/* Row 1: Sleep Actions */}
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-medium text-[var(--color-text)]">
                    Open tabs
                  </span>
                  <div className="flex items-center gap-1.5">
                    {/* Secondary: Sleep idle */}
                    <button
                      type="button"
                      onClick={handleSleepIdle}
                      disabled={
                        idleSleepableCount === 0 ||
                        isSleepingIdle ||
                        isSleepingAll ||
                        isGrouping ||
                        isUngrouping ||
                        loadingTabs
                      }
                      title={
                        idleSleepableCount === 0
                          ? 'No tabs currently idle past limit'
                          : `Sleep ${idleSleepableCount} idle tab(s)`
                      }
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-[8px] text-[12px] font-medium bg-transparent border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors cursor-pointer disabled:opacity-40 disabled:border-[var(--color-border)] disabled:text-[var(--color-muted)] disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                    >
                      {isSleepingIdle ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Clock className="w-3.5 h-3.5" />
                      )}
                      <span>Sleep idle</span>
                    </button>

                    {/* Primary: Sleep all */}
                    <button
                      type="button"
                      onClick={handleSleepAll}
                      disabled={
                        sleepableCount === 0 ||
                        isSleepingAll ||
                        isSleepingIdle ||
                        isGrouping ||
                        isUngrouping ||
                        loadingTabs
                      }
                      title={
                        sleepableCount === 0
                          ? 'No sleepable tabs'
                          : `Sleep ${sleepableCount} eligible tab(s)`
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[8px] text-[12px] font-medium bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:opacity-90 active:opacity-95 transition-opacity cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                    >
                      {isSleepingAll ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Moon className="w-3.5 h-3.5" />
                      )}
                      <span>Sleep all</span>
                    </button>
                  </div>
                </div>

                {/* Row 2: Grouping Actions */}
                <div className="flex items-center justify-between pt-1.5 border-t border-[var(--color-border)]/60">
                  <span className="text-[11px] text-[var(--color-muted)]">
                    Tab groups
                  </span>
                  <div className="flex items-center gap-1.5">
                    {/* Secondary: Group by site */}
                    <button
                      type="button"
                      onClick={handleGroupTabs}
                      disabled={
                        isGrouping ||
                        isUngrouping ||
                        isSleepingAll ||
                        isSleepingIdle ||
                        loadingTabs
                      }
                      title="Group tabs by site (sites with 2+ tabs)"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-[8px] text-[12px] font-medium bg-transparent border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors cursor-pointer disabled:opacity-40 disabled:border-[var(--color-border)] disabled:text-[var(--color-muted)] disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                    >
                      {isGrouping ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <FolderTree className="w-3.5 h-3.5" />
                      )}
                      <span>Group by site</span>
                    </button>

                    {/* Secondary: Ungroup */}
                    <button
                      type="button"
                      onClick={handleUngroupTabs}
                      disabled={
                        isGrouping ||
                        isUngrouping ||
                        isSleepingAll ||
                        isSleepingIdle ||
                        loadingTabs
                      }
                      title="Ungroup all tabs"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-[8px] text-[12px] font-medium bg-transparent border border-[var(--color-primary)] text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 transition-colors cursor-pointer disabled:opacity-40 disabled:border-[var(--color-border)] disabled:text-[var(--color-muted)] disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
                    >
                      {isUngrouping ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Ungroup className="w-3.5 h-3.5" />
                      )}
                      <span>Ungroup</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabs List */}
              {loadingTabs ? (
                <div className="flex flex-col items-center justify-center py-10 text-[var(--color-muted)] gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-[12px]">Loading tabs...</span>
                </div>
              ) : tabs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-[var(--color-muted)] gap-2">
                  <Layers className="w-6 h-6 stroke-[1.5]" />
                  <span className="text-[12px]">No open tabs found</span>
                </div>
              ) : (
                <div className="max-h-[380px] overflow-y-auto rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] [scrollbar-width:thin]">
                  {tabs.map((tab) => (
                    <TabItem
                      key={tab.id}
                      tab={tab}
                      lastActiveTime={
                        typeof tab.id === 'number' ? lastActive[tab.id] : undefined
                      }
                      onSleepSuccess={handleSleepSuccess}
                      onSleepError={handleSleepError}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="settings"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
            >
              <SettingsPanel
                settings={settings}
                onUpdate={updateSettings}
                onReset={resetSettings}
                showToast={showToast}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Toast Notification */}
      <Toast toast={toast} />
    </div>
  );
}
