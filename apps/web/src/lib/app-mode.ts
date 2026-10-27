/**
 * Native-app ("mobile app mode") detection.
 *
 * The ChatLoora iOS / Android WebView appends `ChatLooraMobile/1.0` to the
 * user agent. Inside the native app we must not show any payments,
 * subscriptions or prices (App Store / Google Play billing policies).
 *
 * This module is framework-free so it can be imported from middleware (Edge).
 * The React hook lives in `@/lib/use-is-mobile-app`.
 */
export const MOBILE_APP_UA_TOKEN = 'ChatLooraMobile';

export function isMobileAppUserAgent(ua: string | null | undefined): boolean {
  if (!ua) return false;
  return ua.includes(MOBILE_APP_UA_TOKEN);
}

/** Client-only check (returns false during SSR). */
export function isMobileAppClient(): boolean {
  if (typeof navigator === 'undefined') return false;
  return isMobileAppUserAgent(navigator.userAgent);
}

/** Paths (and their subpaths) that sell plans / subscriptions / ad balance. Redirected inside the app. */
export const MOBILE_APP_BLOCKED_PREFIXES = [
  '/plans',
  '/pricing',
  '/tiktok/ads/topup',
  '/tiktok/ads/balance',
] as const;

export function isMobileAppBlockedPath(pathname: string): boolean {
  return MOBILE_APP_BLOCKED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Nav entries hidden inside the native app. */
export const MOBILE_APP_HIDDEN_NAV_HREFS = new Set<string>(['/plans', '/pricing', '/tiktok/ads/balance', '/tiktok/ads/topup']);

/** Neutral copy shown instead of "upgrade / renew / subscribe" prompts inside the native app. */
export const MOBILE_APP_UNAVAILABLE_MESSAGE = {
  ar: 'هذه الميزة غير متاحة في حسابك حالياً. تواصل مع الدعم.',
  en: 'This feature is not currently available on your account. Please contact support.',
} as const;
