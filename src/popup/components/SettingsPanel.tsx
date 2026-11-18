import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, RotateCcw } from 'lucide-react';
import type { Settings } from '../../shared/settings';
import { normalizeDomain } from '../../shared/rules';
import type { ToastType } from './Toast';

interface SettingsPanelProps {
  settings: Settings;
  onUpdate: (partial: Partial<Settings>) => Promise<Settings>;
  onReset: () => Promise<Settings>;
  showToast: (message: string, type: ToastType) => void;
}

export function SettingsPanel({
  settings,
  onUpdate,
  onReset,
  showToast,
}: SettingsPanelProps) {
  // Idle minutes local state
  const [idleInput, setIdleInput] = useState<string>(String(settings.idleMinutes));
  const [idleError, setIdleError] = useState<string | null>(null);
  const idleErrorTimeoutRef = useRef<number | null>(null);

  // MB per tab local state
  const [mbInput, setMbInput] = useState<string>(String(settings.mbPerTab ?? 100));
  const [mbError, setMbError] = useState<string | null>(null);
  const mbErrorTimeoutRef = useRef<number | null>(null);

  // New domain input state
  const [newDomain, setNewDomain] = useState<string>('');

  // Reset confirmation state
  const [confirmReset, setConfirmReset] = useState<boolean>(false);
  const resetConfirmTimerRef = useRef<number | null>(null);

  // Keep inputs in sync if settings update externally
  useEffect(() => {
    setIdleInput(String(settings.idleMinutes));
  }, [settings.idleMinutes]);

  useEffect(() => {
    setMbInput(String(settings.mbPerTab ?? 100));
  }, [settings.mbPerTab]);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      if (idleErrorTimeoutRef.current !== null) {
        window.clearTimeout(idleErrorTimeoutRef.current);
      }
      if (mbErrorTimeoutRef.current !== null) {
        window.clearTimeout(mbErrorTimeoutRef.current);
      }
      if (resetConfirmTimerRef.current !== null) {
        window.clearTimeout(resetConfirmTimerRef.current);
      }
    };
  }, []);

  const handleIdleCommit = () => {
    const trimmed = idleInput.trim();
    const parsed = Number.parseInt(trimmed, 10);

    if (Number.isNaN(parsed) || parsed < 1 || parsed > 1440) {
      setIdleError('Please enter a number between 1 and 1440');
      if (idleErrorTimeoutRef.current !== null) {
        window.clearTimeout(idleErrorTimeoutRef.current);
      }
      idleErrorTimeoutRef.current = window.setTimeout(() => {
        setIdleError(null);
        setIdleInput(String(settings.idleMinutes));
      }, 2500);
      return;
    }

    setIdleError(null);
    if (parsed !== settings.idleMinutes) {
      onUpdate({ idleMinutes: parsed }).catch((err) => {
        console.error('Failed to update idleMinutes:', err);
      });
    }
  };

  const handleIdleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const handleMbCommit = () => {
    const trimmed = mbInput.trim();
    const parsed = Number.parseInt(trimmed, 10);

    if (Number.isNaN(parsed) || parsed < 10 || parsed > 1000) {
      setMbError('Please enter a number between 10 and 1000');
      if (mbErrorTimeoutRef.current !== null) {
        window.clearTimeout(mbErrorTimeoutRef.current);
      }
      mbErrorTimeoutRef.current = window.setTimeout(() => {
        setMbError(null);
        setMbInput(String(settings.mbPerTab ?? 100));
      }, 2500);
      return;
    }

    setMbError(null);
    if (parsed !== settings.mbPerTab) {
      onUpdate({ mbPerTab: parsed }).catch((err) => {
        console.error('Failed to update mbPerTab:', err);
      });
    }
  };

  const handleMbKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const handleAddWhitelist = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeDomain(newDomain);
    if (!normalized) {
      return;
    }

    if (settings.whitelist.includes(normalized)) {
      showToast('Already in the list', 'neutral');
      return;
    }

    const updated = [...settings.whitelist, normalized];
    onUpdate({ whitelist: updated })
      .then(() => {
        setNewDomain('');
      })
      .catch((err) => {
        console.error('Failed to add to whitelist:', err);
      });
  };

  const handleRemoveWhitelist = (domainToRemove: string) => {
    const updated = settings.whitelist.filter((d) => d !== domainToRemove);
    onUpdate({ whitelist: updated }).catch((err) => {
      console.error('Failed to remove from whitelist:', err);
    });
  };

  const handleResetClick = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      resetConfirmTimerRef.current = window.setTimeout(() => {
        setConfirmReset(false);
      }, 3000);
      return;
    }

    if (resetConfirmTimerRef.current !== null) {
      window.clearTimeout(resetConfirmTimerRef.current);
    }
    setConfirmReset(false);
    try {
      await onReset();
      showToast('Settings reset to defaults', 'success');
    } catch (err) {
      console.error('Failed to reset settings:', err);
      showToast('Could not reset settings', 'error');
    }
  };

  return (
    <div className="space-y-3 py-1 text-[var(--color-text)]">
      {/* 1. Auto-sleep Switch */}
      <div className="flex items-center justify-between p-3 rounded-[8px] bg-[var(--color-surface)] border border-[var(--color-border)]">
        <div>
          <span className="text-[13px] font-semibold text-[var(--color-text)] block">
            Auto-sleep
          </span>
          <p className="text-[11px] text-[var(--color-muted)] mt-0.5">
            Put idle tabs to sleep automatically
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.autoSleep}
          aria-label="Toggle auto-sleep"
          onClick={() => onUpdate({ autoSleep: !settings.autoSleep })}
          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ${
            settings.autoSleep
              ? 'bg-[var(--color-primary)]'
              : 'bg-[var(--color-border)]'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 m-0.5 transform rounded-full bg-[var(--color-on-primary)] transition duration-200 ease-in-out ${
              settings.autoSleep ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </button>
      </div>

      {/* 2. Idle Time Input */}
      <div className="p-3 rounded-[8px] bg-[var(--color-surface)] border border-[var(--color-border)] space-y-1.5">
        <label
          htmlFor="idle-minutes-input"
          className="text-[13px] font-semibold text-[var(--color-text)] block"
        >
          Idle timeout
        </label>
        <div className="flex items-center gap-2">
          <span className="text-[13px] text-[var(--color-muted)]">
            Sleep tabs after
          </span>
          <input
            id="idle-minutes-input"
            type="number"
            min="1"
            max="1440"
            value={idleInput}
            onChange={(e) => setIdleInput(e.target.value)}
            onBlur={handleIdleCommit}
            onKeyDown={handleIdleKeyDown}
            className="w-16 px-2 py-1 text-center text-[13px] font-medium rounded-[8px] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
          />
          <span className="text-[13px] text-[var(--color-muted)]">
            minutes
          </span>
        </div>
        {idleError && (
          <p className="text-[11px] text-[var(--color-danger)] font-medium">
            {idleError}
          </p>
        )}
      </div>

      {/* 3. Estimated Memory Per Tab */}
      <div className="p-3 rounded-[8px] bg-[var(--color-surface)] border border-[var(--color-border)] space-y-1.5">
        <label
          htmlFor="mb-per-tab-input"
          className="text-[13px] font-semibold text-[var(--color-text)] block"
        >
          Estimated memory per tab
        </label>
        <div className="flex items-center gap-2">
          <input
            id="mb-per-tab-input"
            type="number"
            min="10"
            max="1000"
            value={mbInput}
            onChange={(e) => setMbInput(e.target.value)}
            onBlur={handleMbCommit}
            onKeyDown={handleMbKeyDown}
            className="w-20 px-2 py-1 text-center text-[13px] font-medium rounded-[8px] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
          />
          <span className="text-[13px] text-[var(--color-muted)]">
            MB
          </span>
        </div>
        {mbError && (
          <p className="text-[11px] text-[var(--color-danger)] font-medium">
            {mbError}
          </p>
        )}
        <p className="text-[11px] text-[var(--color-muted)] leading-tight pt-0.5">
          Chrome does not expose per-tab memory, so this is an estimate. Typical tabs use 50 to 300 MB.
        </p>
      </div>

      {/* 4. Whitelist Editor */}
      <div className="p-3 rounded-[8px] bg-[var(--color-surface)] border border-[var(--color-border)] space-y-2">
        <div>
          <span className="text-[13px] font-semibold text-[var(--color-text)] block">
            Never sleep these sites
          </span>
          <p className="text-[11px] text-[var(--color-muted)] mt-0.5">
            Whitelisted domains are protected from auto and bulk sleep
          </p>
        </div>

        {/* Chips container */}
        <div className="flex flex-wrap gap-1.5 max-h-[110px] overflow-y-auto p-1.5 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-bg)] [scrollbar-width:thin]">
          {settings.whitelist.length === 0 ? (
            <span className="text-[11px] text-[var(--color-muted)] italic py-0.5">
              No whitelisted domains
            </span>
          ) : (
            settings.whitelist.map((domain) => (
              <span
                key={domain}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)]"
              >
                <span>{domain}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveWhitelist(domain)}
                  title={`Remove ${domain}`}
                  aria-label={`Remove ${domain}`}
                  className="text-[var(--color-muted)] hover:text-[var(--color-danger)] rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
        </div>

        {/* Add domain input & button */}
        <form onSubmit={handleAddWhitelist} className="flex gap-1.5">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="e.g. youtube.com or https://..."
            className="flex-1 min-w-0 px-2.5 py-1 text-[13px] rounded-[8px] border border-[var(--color-border)] bg-[var(--color-bg)] text-[var(--color-text)] placeholder:text-[var(--color-muted)]/70 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-[12px] font-medium bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:opacity-90 rounded-[8px] transition-opacity cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </form>

        <p className="text-[11px] text-[var(--color-muted)] leading-tight">
          Adding google.com also protects docs.google.com and mail.google.com.
        </p>
      </div>

      {/* 4. Reset to Defaults */}
      <div className="pt-1 flex justify-center">
        <button
          type="button"
          onClick={handleResetClick}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[8px] text-[12px] font-medium border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ${
            confirmReset
              ? 'border-[var(--color-danger)] text-[var(--color-danger)] bg-[var(--color-surface)]'
              : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg)]'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{confirmReset ? 'Click again to confirm' : 'Reset to defaults'}</span>
        </button>
      </div>
    </div>
  );
}
