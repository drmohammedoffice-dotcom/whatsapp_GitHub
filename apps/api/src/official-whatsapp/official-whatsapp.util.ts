export const META_GRAPH_VERSION = 'v21.0';
export const META_GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

export const OFFICIAL_SENDER_ID = 'chatloora-official';

export const SYSTEM_SETTING_KEYS = {
  otp: 'official_whatsapp.otp',
  subscription: 'official_whatsapp.subscription_notifications',
} as const;

export function normalizeWaDigits(raw: string | null | undefined): string {
  return String(raw ?? '').replace(/[^\d]/g, '');
}

export function maskPhone(phone: string): string {
  const d = normalizeWaDigits(phone);
  if (d.length < 6) return '***';
  return `${d.slice(0, 3)}***${d.slice(-3)}`;
}

export function maskToken(token: string | null | undefined): string | null {
  return String(token ?? '').trim() ? 'stored' : null;
}

export function dateOnlyUtc(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
