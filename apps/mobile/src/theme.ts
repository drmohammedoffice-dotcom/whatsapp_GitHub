import { useColorScheme } from 'react-native';

/** ChatLoora brand palette (same tokens as the web app). */
export const BRAND = {
  primary: '#7C3AED',
  accent: '#22D3EE',
} as const;

export type ShellTheme = {
  scheme: 'light' | 'dark';
  background: string;
  card: string;
  foreground: string;
  muted: string;
  border: string;
  primary: string;
  onPrimary: string;
};

const LIGHT: ShellTheme = {
  scheme: 'light',
  background: '#F8F7FC',
  card: '#FFFFFF',
  foreground: '#0F0A1F',
  muted: '#5E5873',
  border: '#E4E1EE',
  primary: BRAND.primary,
  onPrimary: '#FFFFFF',
};

const DARK: ShellTheme = {
  scheme: 'dark',
  background: '#0E0B1A',
  card: '#17132A',
  foreground: '#F4F2FA',
  muted: '#A9A3C0',
  border: '#2A2442',
  primary: BRAND.primary,
  onPrimary: '#FFFFFF',
};

/** Native shell colors following the system light/dark setting. */
export function useShellTheme(): ShellTheme {
  return useColorScheme() === 'dark' ? DARK : LIGHT;
}
