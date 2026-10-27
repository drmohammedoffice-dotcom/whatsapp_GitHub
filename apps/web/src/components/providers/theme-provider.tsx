'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  isLightOnlyPath,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from './theme-config';

type ThemeContextValue = {
  /** User preference; 'system' (default) follows prefers-color-scheme live. */
  theme: ThemePreference;
  /** What is actually rendered right now. */
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemePreference) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
});

const DARK_QUERY = '(prefers-color-scheme: dark)';
/** The previous provider wrote theme=light for every visitor; never honour it. */
const LEGACY_STORAGE_KEY = 'theme';

function readPreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [preference, setPreference] = useState<ThemePreference>('system');
  const [systemDark, setSystemDark] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    setPreference(readPreference());
    setSystemDark(media.matches);
    setReady(true);

    try {
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      /* storage unavailable (private mode) */
    }

    const onSystemChange = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === THEME_STORAGE_KEY) setPreference(readPreference());
    };
    media.addEventListener('change', onSystemChange);
    window.addEventListener('storage', onStorage);
    return () => {
      media.removeEventListener('change', onSystemChange);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const lightOnly = isLightOnlyPath(pathname);
  const resolvedTheme: ResolvedTheme = lightOnly
    ? 'light'
    : preference === 'system'
      ? systemDark
        ? 'dark'
        : 'light'
      : preference;

  // Until mounted, keep whatever the inline <head> script applied (no flash).
  useEffect(() => {
    if (!ready) return;
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  }, [ready, resolvedTheme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setPreference(next);
    try {
      if (next === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY);
      else window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: preference, resolvedTheme, setTheme, toggleTheme }),
    [preference, resolvedTheme, setTheme, toggleTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
