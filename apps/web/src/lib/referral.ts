const STORAGE_KEY = 'cl_ref';
const COOKIE = 'cl_ref';

export type StoredReferral = { code: string; source: 'CODE' | 'LINK' };

export function saveReferral(code: string, source: 'CODE' | 'LINK') {
  const value: StoredReferral = { code: code.trim().toUpperCase(), source };
  if (!value.code) return;
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  document.cookie = `${COOKIE}=${encodeURIComponent(value.code)};path=/;max-age=${60 * 60 * 24 * 90};samesite=lax`;
}

export function getStoredReferral(): StoredReferral | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StoredReferral;
      if (parsed?.code) return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function captureReferralFromSearch(search: string) {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const code = params.get('ref') ?? params.get('referral') ?? '';
  if (code.trim()) saveReferral(code, 'CODE');
}
