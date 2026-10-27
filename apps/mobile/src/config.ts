import Constants from 'expo-constants';

/** Production ChatLoora web origin loaded inside the native shell. */
export const APP_URL = (
  (Constants.expoConfig?.extra?.appUrl as string | undefined) ||
  process.env.EXPO_PUBLIC_CHATLOORA_URL ||
  'https://www.chatloora.com'
).replace(/\/$/, '');

export const START_PATH = '/login';

/** Page opened instead of a blocked (payment/pricing) page. */
export const FALLBACK_PATH = '/dashboard';

const APP_HOSTS = ['chatloora.com', 'localhost', '127.0.0.1'];

/** Third-party pages that may load inside the WebView (TikTok/Meta OAuth, WhatsApp). */
const IN_APP_HOST_SUFFIXES = [
  ...APP_HOSTS,
  'tiktok.com',
  'facebook.com',
  'whatsapp.com',
];

/**
 * Hosts that refuse to run inside embedded WebViews (Google returns
 * `disallowed_useragent`), so they are opened in the system browser instead.
 */
const SYSTEM_BROWSER_HOST_SUFFIXES = ['accounts.google.com'];

function hostMatches(host: string, suffixes: string[]): boolean {
  return suffixes.some((h) => host === h || host.endsWith(`.${h}`));
}

type HttpUrl = {
  protocol: 'http:' | 'https:';
  /** Lower-case host without userinfo, port or trailing dot. */
  hostname: string;
  pathname: string;
  search: string;
  hash: string;
};

/**
 * Minimal http(s) URL parser. React Native's built-in `URL` is a regex approximation whose
 * `hostname` can be spoofed (`https://evil.com/@chatloora.com` reports `chatloora.com`), so the
 * authority is isolated here first (`/`, `\`, `?` and `#` end it, as in browsers).
 */
function parseHttpUrl(urlString: string): HttpUrl | null {
  const m = /^(https?):\/\/([^/\\?#]*)([^?#]*)(\?[^#]*)?(#.*)?$/i.exec(urlString.trim());
  if (!m) return null;
  const authority = m[2] ?? '';
  let hostname = authority.slice(authority.lastIndexOf('@') + 1);
  hostname = hostname.startsWith('[') ? hostname.slice(0, hostname.indexOf(']') + 1) : hostname.replace(/:\d*$/, '');
  hostname = hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname) return null;
  return {
    protocol: (m[1] ?? '').toLowerCase() === 'https' ? 'https:' : 'http:',
    hostname,
    pathname: m[3] || '/',
    search: m[4] ?? '',
    hash: m[5] ?? '',
  };
}

export function isAllowedNavigation(urlString: string): boolean {
  const u = parseHttpUrl(urlString);
  if (!u) return false;
  const host = u.hostname.toLowerCase();
  return hostMatches(host, IN_APP_HOST_SUFFIXES) && !hostMatches(host, SYSTEM_BROWSER_HOST_SUFFIXES);
}

export function requiresSystemBrowser(urlString: string): boolean {
  const u = parseHttpUrl(urlString);
  return !!u && hostMatches(u.hostname.toLowerCase(), SYSTEM_BROWSER_HOST_SUFFIXES);
}

/**
 * Store policy: the app is for managing the account only. Subscriptions are bought on
 * the website, so payment providers and pricing/checkout pages never open in the app
 * (not even in the system browser).
 */
const BLOCKED_HOST_SUFFIXES = ['wayl.io', 'wayl.com'];
const BLOCKED_APP_PATHS = [/^\/plans(\/|$)/, /^\/pricing(\/|$)/, /^\/tiktok\/ads\/topup(\/|$)/, /^\/tiktok\/ads\/balance(\/|$)/];

/** Payment providers stay blocked even inside iframes of in-app pages. */
export function isBlockedHost(urlString: string): boolean {
  const u = parseHttpUrl(urlString);
  return !!u && hostMatches(u.hostname.toLowerCase(), BLOCKED_HOST_SUFFIXES);
}

export function isBlockedInApp(urlString: string): boolean {
  const u = parseHttpUrl(urlString);
  if (!u) return false;
  const host = u.hostname.toLowerCase();
  if (hostMatches(host, BLOCKED_HOST_SUFFIXES)) return true;
  return hostMatches(host, APP_HOSTS) && BLOCKED_APP_PATHS.some((re) => re.test(u.pathname));
}

/**
 * Maps an incoming deep link (`chatloora://inbox`, `https://www.chatloora.com/inbox`)
 * to the ChatLoora page that should open in the WebView, or null if it is not ours.
 */
export function deepLinkToAppUrl(link: string | null | undefined): string | null {
  if (!link) return null;
  const custom = link.match(/^(?:chatloora|com\.chatloora\.app):\/\/\/?(.*)$/i);
  if (custom) {
    const path = custom[1] ?? '';
    return path ? `${APP_URL}/${path.replace(/^\/+/, '')}` : null;
  }
  const u = parseHttpUrl(link);
  if (u && hostMatches(u.hostname.toLowerCase(), APP_HOSTS)) {
    return `${APP_URL}${u.pathname}${u.search}${u.hash}`;
  }
  return null;
}

/** Returns the URL, or the dashboard when the store policy blocks it in the app. */
export function safeAppTarget(urlString: string): string {
  return isBlockedInApp(urlString) ? `${APP_URL}${FALLBACK_PATH}` : urlString;
}

/**
 * Hosts whose pages may talk to the native bridge: ChatLoora itself (and the configured
 * APP_URL host, e.g. localhost in development). OAuth/third-party pages never qualify.
 */
export const TRUSTED_BRIDGE_HOSTS: string[] = Array.from(
  new Set(['chatloora.com', parseHttpUrl(APP_URL)?.hostname].filter((h): h is string => !!h)),
);

export function isTrustedAppUrl(urlString: string | null | undefined): boolean {
  if (!urlString) return false;
  const u = parseHttpUrl(urlString);
  if (!u) return false;
  const isLocal = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  if (u.protocol !== 'https:' && !isLocal) return false;
  return hostMatches(u.hostname, TRUSTED_BRIDGE_HOSTS);
}

/** Resolves a site-relative path (`/inbox/42`) against APP_URL; anything else is rejected. */
export function appUrlFromRelativePath(path: unknown): string | null {
  if (typeof path !== 'string' || path.length > 2048) return null;
  // Must be `/x`, never `//host` or `/\host` (protocol-relative), and contain no whitespace/control chars.
  if (!/^\/(?![/\\])/.test(path) || /[\s\\\u0000-\u001f\u007f]/.test(path)) return null;
  return `${APP_URL}${path}`;
}
