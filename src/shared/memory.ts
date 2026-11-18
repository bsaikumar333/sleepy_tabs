/**
 * Calculates estimated memory saved in megabytes.
 */
export function estimateSavedMB(sleepingCount: number, mbPerTab: number): number {
  const count = Math.max(0, sleepingCount);
  const perTab = Math.max(0, mbPerTab);
  return count * perTab;
}

/**
 * Formats a memory amount in megabytes into a human-readable string:
 * - "0 MB" for 0
 * - "450 MB" under 1000
 * - "1.2 GB" from 1000 up (one decimal)
 */
export function formatMB(mb: number): string {
  if (mb <= 0 || Number.isNaN(mb)) {
    return '0 MB';
  }
  if (mb < 1000) {
    return `${Math.round(mb)} MB`;
  }
  const gb = (mb / 1000).toFixed(1);
  return `${gb} GB`;
}

