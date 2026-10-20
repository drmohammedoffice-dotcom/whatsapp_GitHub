'use client';

import { createContext, useContext, useEffect } from 'react';

type ThemeContextValue = {
  theme: 'light';
  setTheme: (theme: 'light') => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    localStorage.setItem('theme', 'light');
    document.documentElement.classList.remove('dark');
  }, []);

  const value: ThemeContextValue = {
    theme: 'light',
    setTheme: () => {
      localStorage.setItem('theme', 'light');
      document.documentElement.classList.remove('dark');
    },
    toggleTheme: () => {},
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
