import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
export const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? API_URL;

const REMEMBERED_EMAIL_KEY = 'rememberedEmail';

export function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('accessToken');
}

export function getRefreshToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('refreshToken');
}

export function getTeamId() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('teamId');
}

export function getRememberedEmail() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(REMEMBERED_EMAIL_KEY);
}

export function setRememberedEmail(email: string | null) {
  if (typeof window === 'undefined') return;
  if (email) window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
  else window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
}

export function setSession(tokens: { accessToken: string; refreshToken: string; teamId: string }) {
  window.localStorage.setItem('accessToken', tokens.accessToken);
  window.localStorage.setItem('refreshToken', tokens.refreshToken);
  window.localStorage.setItem('teamId', tokens.teamId);
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem('accessToken');
  window.localStorage.removeItem('refreshToken');
  window.localStorage.removeItem('teamId');
}

let refreshInFlight: Promise<boolean> | null = null;

export async function refreshSession(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!response.ok) return false;
      const tokens = (await response.json()) as { accessToken: string; refreshToken: string; teamId: string };
      setSession(tokens);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function ensureValidSession(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const refreshToken = getRefreshToken();
  if (refreshToken) return refreshSession();
  return !!getAccessToken();
}

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  const authRoute = window.location.pathname.startsWith('/login')
    || window.location.pathname.startsWith('/register')
    || window.location.pathname.startsWith('/reset-password');
  if (!authRoute) {
    clearSession();
    window.location.href = '/login';
  }
}

import { getMessage, LOCALE_STORAGE_KEY, type Locale } from '@/lib/i18n';

function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LOCALE_STORAGE_KEY) === 'ar' ? 'ar' : 'en';
}

const ERROR_MESSAGE_KEYS: Record<string, string> = {
  'Email is already registered': 'errors.emailRegistered',
  'Invalid credentials': 'errors.invalidCredentials',
  'password must be longer than or equal to 12 characters': 'errors.passwordMin',
  'email must be an email': 'errors.emailInvalid',
};

export function parseApiError(error: unknown): string {
  const locale = getStoredLocale();
  const t = (key: string) => getMessage(locale, key);

  if (error instanceof TypeError) {
    return `${t('errors.network')} ${API_URL}`;
  }
  if (!(error instanceof Error)) return t('errors.unexpected');

  const raw = error.message.trim();
  try {
    const json = JSON.parse(raw) as { message?: string | string[] };
    const messages = Array.isArray(json.message) ? json.message : json.message ? [json.message] : [];
    if (messages.length) {
      return messages.map((m) => (ERROR_MESSAGE_KEYS[m] ? t(ERROR_MESSAGE_KEYS[m]) : m)).join(' · ');
    }
  } catch {
    /* not JSON */
  }

  for (const [key, messageKey] of Object.entries(ERROR_MESSAGE_KEYS)) {
    if (raw.includes(key)) return t(messageKey);
  }

  if (raw.includes('Forbidden')) return t('errors.forbidden');
  if (raw.includes('Unauthorized') || raw.includes('401')) return t('errors.unauthorized');
  if (raw.length > 200) return t('errors.requestFailedLong');
  return raw || t('errors.requestFailed');
}

export async function api<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const token = getAccessToken();
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new TypeError('Failed to fetch');
  }

  if (response.status === 401 && typeof window !== 'undefined' && !retried) {
    const refreshed = await refreshSession();
    if (refreshed) return api<T>(path, init, true);
    redirectToLogin();
    throw new Error('Unauthorized');
  }

  if (response.status === 401 && typeof window !== 'undefined') {
    redirectToLogin();
    throw new Error('Unauthorized');
  }

  if (!response.ok) throw new Error(await response.text());
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function fetchAuthedBlobUrl(path: string, retried = false): Promise<string> {
  const token = getAccessToken();
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1${path}`, {
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}) },
    });
  } catch {
    throw new TypeError('Failed to fetch');
  }

  if (response.status === 401 && typeof window !== 'undefined' && !retried) {
    const refreshed = await refreshSession();
    if (refreshed) return fetchAuthedBlobUrl(path, true);
    throw new Error('Unauthorized');
  }

  if (!response.ok) throw new Error(await response.text());
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export async function downloadAuthedFile(path: string, fileName: string): Promise<void> {
  const url = await fetchAuthedBlobUrl(path);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function apiUpload<T>(path: string, formData: FormData, retried = false): Promise<T> {
  const token = getAccessToken();
  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1${path}`, {
      method: 'POST',
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: formData,
    });
  } catch {
    throw new TypeError('Failed to fetch');
  }

  if (response.status === 401 && typeof window !== 'undefined' && !retried) {
    const refreshed = await refreshSession();
    if (refreshed) return apiUpload<T>(path, formData, true);
    redirectToLogin();
    throw new Error('Unauthorized');
  }

  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/api/v1/health`, { cache: 'no-store' });
    return response.ok;
  } catch {
    return false;
  }
}
