import React, { useState } from 'react';
import { Globe, Moon, Loader2 } from 'lucide-react';
import { canSleepManually } from '../../shared/rules';
import { formatIdle } from '../../shared/activity';
import { isTabGoneError } from '../../shared/sleep';

export interface TabDisplayState {
  label: string;
  badgeClass: string;
  isAsleep: boolean;
}

/**
 * Pure helper function to determine a tab's state label and styling.
 * Priority order:
 * 1. discarded   -> "Asleep"
 * 2. active      -> "Active"
 * 3. pinned      -> "Pinned"
 * 4. audible     -> "Playing audio"
 * 5. last active -> "Idle Xm"
 * 6. otherwise   -> "Open"
 */
export function getTabState(tab: chrome.tabs.Tab, lastActiveTime?: number): TabDisplayState {
  if (tab.discarded) {
    return {
      label: 'Asleep',
      badgeClass: 'text-[var(--badge-asleep-text)] bg-[var(--badge-asleep-bg)]',
      isAsleep: true,
    };
  }
  if (tab.active) {
    return {
      label: 'Active',
      badgeClass: 'text-[var(--badge-active-text)] bg-[var(--badge-active-bg)]',
      isAsleep: false,
    };
  }
  if (tab.pinned) {
    return {
      label: 'Pinned',
      badgeClass: 'text-[var(--badge-pinned-text)] bg-[var(--badge-pinned-bg)]',
      isAsleep: false,
    };
  }
  if (tab.audible) {
    return {
      label: 'Playing audio',
      badgeClass: 'text-[var(--badge-audio-text)] bg-[var(--badge-audio-bg)]',
      isAsleep: false,
    };
  }
  if (typeof lastActiveTime === 'number' && lastActiveTime > 0) {
    const elapsedMs = Math.max(0, Date.now() - lastActiveTime);
    return {
      label: `Idle ${formatIdle(elapsedMs)}`,
      badgeClass: 'text-[var(--badge-idle-text)] bg-[var(--badge-idle-bg)]',
      isAsleep: false,
    };
  }
  return {
    label: 'Open',
    badgeClass: 'text-[var(--badge-open-text)] bg-[var(--badge-open-bg)]',
    isAsleep: false,
  };
}

/**
 * Safely extracts the hostname from a URL.
 */
export function getHostname(url?: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.hostname || parsed.protocol;
  } catch {
    return '';
  }
}

interface TabItemProps {
  tab: chrome.tabs.Tab;
  lastActiveTime?: number;
  onSleepSuccess: () => void;
  onSleepError: (message: string) => void;
}

export function TabItem({
  tab,
  lastActiveTime,
  onSleepSuccess,
  onSleepError,
}: TabItemProps) {
  const [imgError, setImgError] = useState(false);
  const [isSleeping, setIsSleeping] = useState(false);

  const stateInfo = getTabState(tab, lastActiveTime);
  const hostname = getHostname(tab.url);
  const canSleep = canSleepManually(tab);

  const handleSleep = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof tab.id !== 'number' || isSleeping) {
      return;
    }

    setIsSleeping(true);
    try {
      if (typeof chrome !== 'undefined' && chrome.tabs?.get && chrome.tabs?.discard) {
        let freshTab: chrome.tabs.Tab;
        try {
          freshTab = await chrome.tabs.get(tab.id);
        } catch (fetchErr) {
          if (isTabGoneError(fetchErr)) {
            console.debug(`Tab ${tab.id} was closed before discarding.`);
            return;
          }
          throw fetchErr;
        }

        if (!canSleepManually(freshTab)) {
          return;
        }

        await chrome.tabs.discard(tab.id);
        onSleepSuccess();
      }
    } catch (error) {
      if (isTabGoneError(error)) {
        console.debug(`Tab ${tab.id} was closed before discarding.`);
      } else {
        console.error(`Failed to discard tab ${tab.id}:`, error);
        onSleepError('Could not sleep this tab');
      }
    } finally {
      setIsSleeping(false);
    }
  };

  return (
    <div className="flex items-center gap-2.5 px-3 h-[44px] bg-[var(--color-surface)] border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-bg)]/50 transition-colors">
      {/* Favicon or fallback Globe icon */}
      <div className="shrink-0 flex items-center justify-center w-4 h-4">
        {tab.favIconUrl && !imgError ? (
          <img
            src={tab.favIconUrl}
            alt=""
            className="w-4 h-4 object-contain rounded-xs"
            onError={() => setImgError(true)}
          />
        ) : (
          <Globe className="w-4 h-4 text-[var(--color-muted)]" />
        )}
      </div>

      {/* Title & Hostname */}
      <div className="flex-1 min-w-0 pr-1">
        <div className={`flex items-center gap-1.5 min-w-0 ${stateInfo.isAsleep ? 'opacity-65' : ''}`}>
          <span className="text-[13px] font-medium text-[var(--color-text)] truncate leading-tight">
            {tab.title || 'Untitled Tab'}
          </span>
          {stateInfo.isAsleep && (
            <span
              title="Sleeping"
              className="text-[11px] font-semibold text-[var(--badge-asleep-text)] shrink-0 italic select-none"
            >
              z
            </span>
          )}
        </div>
        {hostname ? (
          <div className="text-[11px] text-[var(--color-muted)] truncate leading-none mt-0.5">
            {hostname}
          </div>
        ) : null}
      </div>

      {/* State Badge and Manual Sleep Button */}
      <div className="shrink-0 flex items-center gap-1.5">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium leading-none ${stateInfo.badgeClass}`}
        >
          {stateInfo.label}
        </span>

        {canSleep && (
          <button
            type="button"
            onClick={handleSleep}
            disabled={isSleeping}
            title="Put tab to sleep"
            aria-label="Put tab to sleep"
            className="inline-flex items-center gap-1 px-1.5 py-1 rounded-[8px] text-[11px] font-medium text-[var(--color-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-bg)] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
          >
            {isSleeping ? (
              <Loader2 className="w-3 h-3 animate-spin text-[var(--color-primary)]" />
            ) : (
              <Moon className="w-3 h-3" />
            )}
            <span>Sleep</span>
          </button>
        )}
      </div>
    </div>
  );
}
