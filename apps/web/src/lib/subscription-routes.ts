/** Routes that require an active subscription */
export const SUBSCRIPTION_PROTECTED_PREFIXES = [
  '/dashboard',
  '/conversations',
  '/contacts',
  '/settings',
  '/integrations',
  '/inbox',
  '/bookings',
  '/ai',
  '/tiktok',
  '/whatsapp',
] as const;

/** Routes accessible without an active subscription */
export const SUBSCRIPTION_EXEMPT_PREFIXES = [
  '/pricing',
  '/plans',
  '/account',
  '/login',
  '/register',
  '/reset-password',
  '/admin',
  '/r',
] as const;

export function isSubscriptionExemptPath(pathname: string) {
  return SUBSCRIPTION_EXEMPT_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isSubscriptionProtectedPath(pathname: string) {
  if (isSubscriptionExemptPath(pathname)) return false;
  return SUBSCRIPTION_PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export const SUBSCRIBER_HOME = '/tiktok/ads/create';

export function getPostAuthRedirect(isActive: boolean) {
  return isActive ? SUBSCRIBER_HOME : '/plans';
}
