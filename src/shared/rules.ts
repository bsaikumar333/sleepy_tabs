export const DEFAULT_WHITELIST: readonly string[] = [
  'mail.google.com',
  'docs.google.com',
];

/**
 * Returns true only for http: or https: URLs.
 * Safely parses the URL with new URL inside a try/catch block.
 */
export function isHttpUrl(url?: string): boolean {
  if (!url) {
    return false;
  }
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Normalizes a domain entry:
 * Trims, lowercases, strips http(s)://, strips a leading "www.",
 * drops anything after the first "/" (inclusive), and returns '' if empty.
 */
export function normalizeDomain(input: string): string {
  let cleaned = input.trim().toLowerCase();
  if (cleaned.startsWith('https://')) {
    cleaned = cleaned.slice(8);
  } else if (cleaned.startsWith('http://')) {
    cleaned = cleaned.slice(7);
  }
  if (cleaned.startsWith('www.')) {
    cleaned = cleaned.slice(4);
  }
  const slashIndex = cleaned.indexOf('/');
  if (slashIndex !== -1) {
    cleaned = cleaned.slice(0, slashIndex);
  }
  return cleaned.trim();
}

/**
 * Checks whether a URL matches any domain in the whitelist.
 * Returns true if the URL cannot be parsed (fails safe to avoid sleeping unknown/internal pages).
 * An entry matches when host === entry || host.endsWith('.' + entry).
 */
export function isWhitelisted(url: string | undefined, whitelist: string[] | readonly string[]): boolean {
  if (!url) {
    return true; // cannot be parsed; fail safe
  }
  let host = '';
  try {
    const parsed = new URL(url);
    host = parsed.hostname.toLowerCase();
  } catch {
    return true; // cannot be parsed; fail safe
  }

  for (const rawEntry of whitelist) {
    const entry = normalizeDomain(rawEntry);
    if (!entry) {
      continue;
    }
    if (host === entry || host.endsWith('.' + entry)) {
      return true;
    }
  }

  return false;
}

/**
 * Returns true only if the tab is eligible to be put to sleep automatically:
 * - Has a numeric id
 * - NOT active (in any window)
 * - NOT already discarded
 * - NOT pinned
 * - NOT audible
 * - isHttpUrl(tab.url) is true
 * - NOT isWhitelisted(tab.url, whitelist)
 */
export function canSleepAuto(tab: chrome.tabs.Tab, whitelist: string[] | readonly string[]): boolean {
  if (typeof tab.id !== 'number') {
    return false;
  }
  if (tab.active || tab.discarded || tab.pinned || tab.audible) {
    return false;
  }
  if (!isHttpUrl(tab.url)) {
    return false;
  }
  if (isWhitelisted(tab.url, whitelist)) {
    return false;
  }
  return true;
}

/**
 * Returns true only if the tab is eligible to be put to sleep manually:
 * - NOT active
 * - NOT already discarded
 * - has a numeric id
 * - isHttpUrl(tab.url) is true
 *
 * Pinned and audible tabs ARE allowed here because the user clicked Sleep on purpose.
 */
export function canSleepManually(tab: chrome.tabs.Tab): boolean {
  if (tab.active || tab.discarded) {
    return false;
  }
  if (typeof tab.id !== 'number') {
    return false;
  }
  return isHttpUrl(tab.url);
}
