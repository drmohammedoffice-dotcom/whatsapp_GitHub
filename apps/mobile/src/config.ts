import Constants from 'expo-constants';

/** Production ChatLoora web origin loaded inside the native shell. */
export const APP_URL = (
  (Constants.expoConfig?.extra?.appUrl as string | undefined) ||
  process.env.EXPO_PUBLIC_CHATLOORA_URL ||
  'https://www.chatloora.com'
).replace(/\/$/, '');

export const START_PATH = '/login';

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

function parseHttpUrl(urlString: string): URL | null {
  try {
    const u = new URL(urlString);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u : null;
  } catch {
    return null;
  }
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
