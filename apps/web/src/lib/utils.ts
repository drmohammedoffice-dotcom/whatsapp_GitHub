import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getMessage, LOCALE_STORAGE_KEY, type Locale } from '@/lib/i18n';
import { clearAccessCookies } from '@/lib/subscription-cookie';

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

export function setSession(
  tokens: { accessToken: string; refreshToken: string; teamId: string },
  options?: { clearImpersonation?: boolean },
) {
  window.localStorage.setItem('accessToken', tokens.accessToken);
  window.localStorage.setItem('refreshToken', tokens.refreshToken);
  window.localStorage.setItem('teamId', tokens.teamId);
  if (options?.clearImpersonation) clearAdminImpersonation();
}

const ADMIN_IMPERSONATION_KEY = 'adminImpersonation';

export function setAdminImpersonation(active: boolean) {
  if (typeof window === 'undefined') return;
  if (active) window.localStorage.setItem(ADMIN_IMPERSONATION_KEY, '1');
  else window.localStorage.removeItem(ADMIN_IMPERSONATION_KEY);
}

/** True when a Super Admin is viewing the app as a customer account. */
export function isAdminImpersonation() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(ADMIN_IMPERSONATION_KEY) === '1';
}

export function clearAdminImpersonation() {
  setAdminImpersonation(false);
}

export function clearSession() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem('accessToken');
  window.localStorage.removeItem('refreshToken');
  window.localStorage.removeItem('teamId');
  clearAdminImpersonation();
  clearAccessCookies();
}

type RefreshOutcome = 'ok' | 'invalid' | 'transient';

let refreshInFlight: Promise<RefreshOutcome> | null = null;
const REFRESH_LOCK_KEY = 'chatloora_auth_refresh_lock';
const ACCESS_SKEW_MS = 90_000;

function decodeJwtExpiryMs(accessToken: string | null): number | null {
  if (!accessToken) return null;
  try {
    const segment = accessToken.split('.')[1];
    if (!segment) return null;
    const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function isAccessTokenFresh(skewMs = ACCESS_SKEW_MS): boolean {
  const exp = decodeJwtExpiryMs(getAccessToken());
  if (!exp) return false;
  return exp - Date.now() > skewMs;
}

async function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && typeof navigator.locks?.request === 'function') {
    return navigator.locks.request('chatloora-auth-refresh', fn);
  }

  const owner = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const started = Date.now();
  while (Date.now() - started < 8_000) {
    const raw = window.localStorage.getItem(REFRESH_LOCK_KEY);
    const current = raw ? (JSON.parse(raw) as { id: string; expiresAt: number }) : null;
    if (!current || current.expiresAt < Date.now()) {
      window.localStorage.setItem(
        REFRESH_LOCK_KEY,
        JSON.stringify({ id: owner, expiresAt: Date.now() + 10_000 }),
      );
      await new Promise((resolve) => setTimeout(resolve, 25));
      const check = JSON.parse(window.localStorage.getItem(REFRESH_LOCK_KEY) || '{}') as { id?: string };
      if (check.id === owner) {
        try {
          return await fn();
        } finally {
          const still = JSON.parse(window.localStorage.getItem(REFRESH_LOCK_KEY) || '{}') as { id?: string };
          if (still.id === owner) window.localStorage.removeItem(REFRESH_LOCK_KEY);
        }
      }
    } else {
      await new Promise((resolve) => setTimeout(resolve, 120));
      if (isAccessTokenFresh(30_000)) {
        return fn();
      }
    }
  }
  return fn();
}

async function performRefresh(refreshToken: string): Promise<RefreshOutcome> {
  try {
    const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      signal: AbortSignal.timeout(8000),
    });

    if (response.ok) {
      const tokens = (await response.json()) as { accessToken: string; refreshToken: string; teamId: string };
      setSession(tokens);
      return 'ok';
    }

    // Another tab may have rotated already — adopt whatever is now in storage.
    const latestRefresh = getRefreshToken();
    if (latestRefresh && latestRefresh !== refreshToken && isAccessTokenFresh(30_000)) {
      return 'ok';
    }
    if (latestRefresh && latestRefresh !== refreshToken) {
      const retry = await fetch(`${API_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: latestRefresh }),
        signal: AbortSignal.timeout(8000),
      });
      if (retry.ok) {
        const tokens = (await retry.json()) as { accessToken: string; refreshToken: string; teamId: string };
        setSession(tokens);
        return 'ok';
      }
    }

    if (response.status === 401 || response.status === 403) return 'invalid';
    return 'transient';
  } catch {
    return 'transient';
  }
}

/** Rotate tokens even if the access token is still valid (e.g. switch to the paid workspace). */
export async function forceRefreshSession(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  if (refreshInFlight) {
    const outcome = await refreshInFlight;
    return outcome === 'ok' || (outcome === 'transient' && !!getAccessToken());
  }

  refreshInFlight = withRefreshLock(async () => {
    const tokenNow = getRefreshToken();
    if (!tokenNow) return 'invalid';
    return performRefresh(tokenNow);
  }).finally(() => {
    refreshInFlight = null;
  });

  const outcome = await refreshInFlight;
  return outcome === 'ok' || (outcome === 'transient' && !!getAccessToken());
}

export async function refreshSession(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  if (refreshInFlight) {
    const outcome = await refreshInFlight;
    return outcome === 'ok' || (outcome === 'transient' && !!getAccessToken());
  }

  refreshInFlight = withRefreshLock(async () => {
    if (isAccessTokenFresh(30_000)) return 'ok';
    const tokenNow = getRefreshToken();
    if (!tokenNow) return 'invalid';
    return performRefresh(tokenNow);
  }).finally(() => {
    refreshInFlight = null;
  });

  const outcome = await refreshInFlight;
  return outcome === 'ok' || (outcome === 'transient' && !!getAccessToken());
}

/** Refresh only when the access token is missing/near expiry. Avoids rotation on every navigation. */
export async function ensureValidSession(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (isAccessTokenFresh()) return true;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return !!getAccessToken();

  if (refreshInFlight) {
    const outcome = await refreshInFlight;
    if (outcome === 'ok') return true;
    if (outcome === 'transient') return !!getAccessToken();
    return false;
  }

  refreshInFlight = withRefreshLock(async () => {
    if (isAccessTokenFresh()) return 'ok';
    const tokenNow = getRefreshToken();
    if (!tokenNow) return 'invalid';
    return performRefresh(tokenNow);
  }).finally(() => {
    refreshInFlight = null;
  });

  const outcome = await refreshInFlight;
  if (outcome === 'ok') return true;
  if (outcome === 'transient') return !!getAccessToken();
  return false;
}

async function tryRefreshForRequest(): Promise<'ok' | 'invalid' | 'transient'> {
  if (refreshInFlight) return refreshInFlight;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return 'invalid';

  refreshInFlight = withRefreshLock(async () => {
    if (isAccessTokenFresh(30_000)) return 'ok';
    const tokenNow = getRefreshToken();
    if (!tokenNow) return 'invalid';
    return performRefresh(tokenNow);
  }).finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

function isLoginRedirectExempt(pathname: string) {
  return (
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/partners') ||
    pathname.startsWith('/become-a-partner') ||
    pathname.startsWith('/pricing') ||
    pathname.startsWith('/r/') ||
    pathname.startsWith('/t/') ||
    pathname.startsWith('/go/') ||
    pathname.startsWith('/p/') ||
    pathname.startsWith('/f/') ||
    pathname.startsWith('/s/') ||
    pathname.startsWith('/whatsapp/embedded-callback')
  );
}

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  if (isLoginRedirectExempt(window.location.pathname)) return;
  clearSession();
  window.location.href = '/login';
}

function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(LOCALE_STORAGE_KEY) === 'ar' ? 'ar' : 'en';
}

const ERROR_MESSAGE_KEYS: Record<string, string> = {
  'Email is already registered': 'errors.emailRegistered',
  'Invalid credentials': 'errors.invalidCredentials',
  'password must be longer than or equal to 12 characters': 'errors.passwordMin',
  'email must be an email': 'errors.emailInvalid',
  'Invalid bearer token': 'errors.unauthorized',
  'Missing bearer token': 'errors.unauthorized',
  'Invalid refresh token': 'errors.unauthorized',
  Unauthorized: 'errors.unauthorized',
  'Not authenticated': 'errors.unauthorized',
  'Temporary auth error': 'errors.temporaryAuth',
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
    const json = JSON.parse(raw) as { message?: string | string[]; hint?: string };
    const messages = Array.isArray(json.message) ? json.message : json.message ? [json.message] : [];
    if (messages.length) {
      const mapped = messages.map((m) => (ERROR_MESSAGE_KEYS[m] ? t(ERROR_MESSAGE_KEYS[m]) : m)).join(' · ');
      return json.hint ? `${mapped} — ${json.hint}` : mapped;
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

const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/reset-password'];

function isAuthEndpoint(path: string) {
  return AUTH_ENDPOINTS.some((endpoint) => path.startsWith(endpoint));
}

/** Ensure access token is fresh before authenticated requests (avoids raw 401 flashes). */
async function ensureAccessTokenForRequest(): Promise<string | null> {
  if (typeof window === 'undefined') return getAccessToken();
  if (isAccessTokenFresh(60_000)) return getAccessToken();
  if (!getRefreshToken()) return getAccessToken();
  const outcome = await tryRefreshForRequest();
  if (outcome === 'ok') return getAccessToken();
  if (outcome === 'transient') return getAccessToken();
  return null;
}

/**
 * Authenticated fetch with proactive refresh + single 401 retry.
 * Use for any API base path (e.g. /api/v1/... or /api/tiktok-integration/...).
 */
export async function authedFetch(
  url: string,
  init: RequestInit = {},
  options?: { retried?: boolean; redirectOnInvalid?: boolean },
): Promise<Response> {
  const retried = options?.retried ?? false;
  const redirectOnInvalid = options?.redirectOnInvalid ?? true;
  const token = await ensureAccessTokenForRequest();
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new TypeError('Failed to fetch');
  }

  if (response.status === 401 && typeof window !== 'undefined' && !retried) {
    const outcome = await tryRefreshForRequest();
    if (outcome === 'ok') {
      return authedFetch(url, init, { retried: true, redirectOnInvalid });
    }
    if (outcome === 'transient') {
      throw new Error('Temporary auth error');
    }
    if (redirectOnInvalid) redirectToLogin();
    throw new Error('Unauthorized');
  }

  if (response.status === 401 && typeof window !== 'undefined' && redirectOnInvalid) {
    redirectToLogin();
    throw new Error('Unauthorized');
  }

  return response;
}

async function readApiError(response: Response) {
  const raw = await response.text();
  try {
    const body = JSON.parse(raw) as { message?: unknown };
    if (typeof body.message === 'string' && body.message.trim()) return body.message;
  } catch {
    /* keep raw */
  }
  return raw || `Request failed (${response.status})`;
}

export async function api<T>(path: string, init: RequestInit = {}, options?: { redirectOnInvalid?: boolean }): Promise<T> {
  // For auth endpoints (login/register/refresh) a 401 is a credential error,
  // not an expired session. Surface the server message instead of redirecting.
  if (isAuthEndpoint(path)) {
    let response: Response;
    try {
      response = await fetch(`${API_URL}/api/v1${path}`, {
        ...init,
        headers: {
          'content-type': 'application/json',
          ...init.headers,
        },
      });
    } catch {
      throw new TypeError('Failed to fetch');
    }
    if (!response.ok) throw new Error(await readApiError(response));
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  const response = await authedFetch(
    `${API_URL}/api/v1${path}`,
    {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...init.headers,
      },
    },
    { redirectOnInvalid: options?.redirectOnInvalid ?? true },
  );

  if (!response.ok) throw new Error(await readApiError(response));
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function fetchAuthedBlobUrl(path: string): Promise<string> {
  const response = await authedFetch(`${API_URL}/api/v1${path}`, {}, { redirectOnInvalid: false });
  if (!response.ok) throw new Error('Unauthorized');
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

export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const response = await authedFetch(`${API_URL}/api/v1${path}`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) throw new Error(await readApiError(response));
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
