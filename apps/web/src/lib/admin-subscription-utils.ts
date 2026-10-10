export function subscriptionDaysLeft(endDate: string | null | undefined, now = new Date()): number | null {
  if (!endDate) return null;
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return null;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((startOfEnd.getTime() - startOfToday.getTime()) / 86_400_000);
}

export function subscriptionExpiryState(endDate: string | null | undefined): 'ok' | 'expiring' | 'expired' | 'none' {
  const days = subscriptionDaysLeft(endDate);
  if (days === null) return 'none';
  if (days < 0) return 'expired';
  if (days <= 3) return 'expiring';
  return 'ok';
}

export function formatAdminDate(value: string | null | undefined, locale = 'en') {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(locale === 'ar' ? 'ar' : 'en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function toDateInputValue(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export const BILLING_CYCLE_DAYS = { MONTHLY: 30, YEARLY: 365 } as const;
