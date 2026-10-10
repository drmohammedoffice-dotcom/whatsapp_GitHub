import Constants from 'expo-constants';

/** Production ChatLoora web origin loaded inside the native shell. */
export const APP_URL = (
  (Constants.expoConfig?.extra?.appUrl as string | undefined) ||
  process.env.EXPO_PUBLIC_CHATLOORA_URL ||
  'https://www.chatloora.com'
).replace(/\/$/, '');

export const START_PATH = '/login';

const ALLOWED_HOST_SUFFIXES = [
  'chatloora.com',
  'localhost',
  '127.0.0.1',
  'tiktok.com',
  'facebook.com',
  'instagram.com',
  'google.com',
  'accounts.google.com',
  'wayl.io',
  'wayl.com',
  'whatsapp.com',
  'api.whatsapp.com',
  'resend.com',
];

export function isAllowedNavigation(urlString: string): boolean {
  try {
    const u = new URL(urlString);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
    const host = u.hostname.toLowerCase();
    return ALLOWED_HOST_SUFFIXES.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}
