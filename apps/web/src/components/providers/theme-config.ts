/**
 * Shared theme constants (plain module so both the server layout and the client
 * ThemeProvider can import real values).
 */

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

/** Explicit user override. Absent = follow the OS (prefers-color-scheme). */
export const THEME_STORAGE_KEY = 'chatloora-theme';

/**
 * Customer-facing pages designed by merchants (instant forms, storefronts, product
 * landings, short-link redirects) and the Gmail-style webmail keep their own light
 * design regardless of the OS theme.
 */
export const LIGHT_ONLY_PATH_SOURCE = '^/(f|s|r|store|mail)(/|$)';
const LIGHT_ONLY_PATH = new RegExp(LIGHT_ONLY_PATH_SOURCE);

export function isLightOnlyPath(pathname: string | null | undefined): boolean {
  return LIGHT_ONLY_PATH.test(pathname ?? '');
}

/**
 * Runs in <head> before first paint so there is no light→dark flash. Keep it tiny
 * and dependency-free; ThemeProvider takes over after hydration.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var d=document.documentElement,t=null;try{t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)})}catch(e){}var dark=!new RegExp(${JSON.stringify(
  LIGHT_ONLY_PATH_SOURCE,
)}).test(location.pathname)&&(t==='dark'||(t!=='light'&&!!window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches));d.classList.toggle('dark',dark)}catch(e){}})();`;
