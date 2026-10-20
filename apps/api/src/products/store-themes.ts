export type StoreThemeColors = {
  bg: string;
  bgAlt: string;
  text: string;
  muted: string;
  accent: string;
  accentText: string;
  card: string;
  border: string;
};

export type StoreThemePreset = {
  key: string;
  nameAr: string;
  nameEn: string;
  colors: StoreThemeColors;
};

export const STORE_THEME_PRESETS: StoreThemePreset[] = [
  {
    key: 'emerald',
    nameAr: 'زمردي ليلي',
    nameEn: 'Night Emerald',
    colors: {
      bg: '#020617',
      bgAlt: '#134e4a',
      text: '#f8fafc',
      muted: '#94a3b8',
      accent: '#10b981',
      accentText: '#022c22',
      card: 'rgba(255,255,255,0.06)',
      border: 'rgba(255,255,255,0.12)',
    },
  },
  {
    key: 'gold',
    nameAr: 'ذهبي ملكي',
    nameEn: 'Royal Gold',
    colors: {
      bg: '#1c1408',
      bgAlt: '#7c5a12',
      text: '#fffbeb',
      muted: '#e8d5a3',
      accent: '#fbbf24',
      accentText: '#422006',
      card: 'rgba(251,191,36,0.08)',
      border: 'rgba(251,191,36,0.22)',
    },
  },
  {
    key: 'rose',
    nameAr: 'وردي ناعم',
    nameEn: 'Soft Rose',
    colors: {
      bg: '#1f0a14',
      bgAlt: '#9d174d',
      text: '#fff1f2',
      muted: '#fecdd3',
      accent: '#fb7185',
      accentText: '#4c0519',
      card: 'rgba(251,113,133,0.1)',
      border: 'rgba(251,113,133,0.25)',
    },
  },
  {
    key: 'ocean',
    nameAr: 'أزرق محيطي',
    nameEn: 'Ocean Blue',
    colors: {
      bg: '#041525',
      bgAlt: '#0e4d7a',
      text: '#eff6ff',
      muted: '#93c5fd',
      accent: '#38bdf8',
      accentText: '#082f49',
      card: 'rgba(56,189,248,0.1)',
      border: 'rgba(56,189,248,0.22)',
    },
  },
  {
    key: 'sand',
    nameAr: 'رملي فاتح',
    nameEn: 'Warm Sand',
    colors: {
      bg: '#faf6ef',
      bgAlt: '#e7d3b0',
      text: '#1c1917',
      muted: '#78716c',
      accent: '#b45309',
      accentText: '#fff7ed',
      card: 'rgba(255,255,255,0.72)',
      border: 'rgba(28,25,23,0.12)',
    },
  },
  {
    key: 'midnight',
    nameAr: 'منتصف الليل',
    nameEn: 'Midnight',
    colors: {
      bg: '#030712',
      bgAlt: '#312e81',
      text: '#eef2ff',
      muted: '#a5b4fc',
      accent: '#818cf8',
      accentText: '#1e1b4b',
      card: 'rgba(129,140,248,0.1)',
      border: 'rgba(129,140,248,0.22)',
    },
  },
  {
    key: 'plum',
    nameAr: 'برقوقي',
    nameEn: 'Plum',
    colors: {
      bg: '#14081c',
      bgAlt: '#6b21a8',
      text: '#faf5ff',
      muted: '#e9d5ff',
      accent: '#c084fc',
      accentText: '#3b0764',
      card: 'rgba(192,132,252,0.1)',
      border: 'rgba(192,132,252,0.24)',
    },
  },
  {
    key: 'crimson',
    nameAr: 'قرمزي',
    nameEn: 'Crimson',
    colors: {
      bg: '#140506',
      bgAlt: '#7f1d1d',
      text: '#fef2f2',
      muted: '#fecaca',
      accent: '#f87171',
      accentText: '#450a0a',
      card: 'rgba(248,113,113,0.1)',
      border: 'rgba(248,113,113,0.24)',
    },
  },
];

export const DEFAULT_STORE_THEME = STORE_THEME_PRESETS[0]!.colors;

export function resolveStoreTheme(key?: string | null, custom?: unknown): StoreThemeColors {
  if (custom && typeof custom === 'object' && !Array.isArray(custom)) {
    const c = custom as Record<string, unknown>;
    const merged = { ...DEFAULT_STORE_THEME };
    for (const field of Object.keys(merged) as Array<keyof StoreThemeColors>) {
      if (typeof c[field] === 'string' && String(c[field]).trim()) merged[field] = String(c[field]);
    }
    return merged;
  }
  return STORE_THEME_PRESETS.find((t) => t.key === key)?.colors ?? DEFAULT_STORE_THEME;
}

export function parseThemeColors(raw: unknown): StoreThemeColors | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return resolveStoreTheme(null, raw);
}
