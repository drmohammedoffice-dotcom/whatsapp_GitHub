const AUTH_COOKIE = 'chatloora_auth';
const SUB_COOKIE = 'chatloora_sub';

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${value}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

function clearCookie(name: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

export function setAuthCookie() {
  setCookie(AUTH_COOKIE, '1', 60 * 60 * 24 * 30);
}

export function clearAuthCookie() {
  clearCookie(AUTH_COOKIE);
}

export function setSubscriptionCookie(active: boolean) {
  setCookie(SUB_COOKIE, active ? 'active' : 'inactive', 60 * 60 * 24);
}

export function clearSubscriptionCookie() {
  clearCookie(SUB_COOKIE);
}

export function clearAccessCookies() {
  clearAuthCookie();
  clearSubscriptionCookie();
}

export { AUTH_COOKIE, SUB_COOKIE };
