/** Routes that require an active subscription */
export const SUBSCRIPTION_PROTECTED_PREFIXES = [
  '/dashboard',
  '/conversations',
  '/contacts',
  '/settings',
  '/integrations',
  '/analytics',
  '/inbox',
  '/platform',
  '/bookings',
  '/appointments',
  '/agents',
  '/ai',
  '/tiktok',
  '/whatsapp',
  '/telegram',
  '/messenger',
  '/instagram',
  '/connect',
  '/success-partner',
] as const;

/** Routes accessible without an active subscription */
export const SUBSCRIPTION_EXEMPT_PREFIXES = [
  '/pricing',
  '/plans',
  '/account',
  '/login',
  '/register',
  '/reset-password',
  '/go',
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

const HIDDEN_FROM_SUBSCRIBERS = [
  '/inbox',
  '/connect',
  '/bookings',
  '/appointments',
  '/agents',
  '/analytics',
  '/whatsapp',
  '/messenger',
  '/instagram',
  '/telegram',
];

export function isHiddenSubscriberPath(pathname: string) {
  return HIDDEN_FROM_SUBSCRIBERS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isAdminOnlyStudioPath(pathname: string) {
  return pathname === '/ai' || pathname.startsWith('/ai/');
}

export function getPostAuthRedirect(isActive: boolean) {
  return isActive ? SUBSCRIBER_HOME : '/plans';
}
