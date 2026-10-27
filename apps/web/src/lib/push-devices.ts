import type { PushPlatform } from '@/lib/native-bridge';
import { api } from '@/lib/utils';

/** localStorage key holding the push token registered for the signed-in user on this device. */
export const PUSH_TOKEN_STORAGE_KEY = 'chatloora.pushToken';

/** sessionStorage key: push registration already requested from the native app in this session. */
export const PUSH_REQUESTED_SESSION_KEY = 'chatloora.pushRequested';

export function getStoredPushToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Forget the stored push token locally (e.g. after the account was deleted server-side). */
export function clearStoredPushToken() {
  setStoredPushToken(null);
}

function setStoredPushToken(token: string | null) {
  if (typeof window === 'undefined') return;
  try {
    if (token) window.localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
    else window.localStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

/** Register this device's push token for the signed-in user (POST /api/v1/devices). */
export async function registerPushDevice(token: string, platform: PushPlatform): Promise<boolean> {
  try {
    await api('/devices', { method: 'POST', body: JSON.stringify({ token, platform }) }, { redirectOnInvalid: false });
    setStoredPushToken(token);
    return true;
  } catch {
    return false;
  }
}

/**
 * Best-effort: unregister the stored push token (DELETE /api/v1/devices).
 * Must run BEFORE the session tokens are cleared. Never throws and never
 * blocks logout for more than `timeoutMs`.
 */
export async function unregisterPushDevice(timeoutMs = 3_000): Promise<void> {
  try {
    window.sessionStorage.removeItem(PUSH_REQUESTED_SESSION_KEY);
  } catch {
    /* storage unavailable */
  }
  const token = getStoredPushToken();
  if (!token) return;
  try {
    await Promise.race([
      api('/devices', { method: 'DELETE', body: JSON.stringify({ token }) }, { redirectOnInvalid: false }),
      new Promise((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  } catch {
    /* ignore — logout must continue */
  } finally {
    setStoredPushToken(null);
  }
}
