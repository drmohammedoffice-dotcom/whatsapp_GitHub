import { API_URL } from './utils';
import { getLandingCopy, type LandingCopy } from './i18n/landing-copy';
import type { Locale } from './i18n/types';

export type LandingVisibility = {
  problems: boolean;
  features: boolean;
  tiktok: boolean;
  how: boolean;
  video: boolean;
  testimonials: boolean;
  stats: boolean;
  trial: boolean;
  pricing: boolean;
  faq: boolean;
  contact: boolean;
};

export const DEFAULT_LANDING_VISIBILITY: LandingVisibility = {
  problems: true,
  features: true,
  tiktok: true,
  how: true,
  video: true,
  testimonials: true,
  stats: true,
  trial: true,
  pricing: true,
  faq: true,
  contact: true,
};

export type LandingContentPayload = {
  contentEn: LandingCopy | null;
  contentAr: LandingCopy | null;
  visibility: LandingVisibility;
  updatedAt: string | null;
};

export function deepMergeLanding<T>(base: T, override: unknown): T {
  if (override == null) return base;
  if (Array.isArray(base)) {
    return (Array.isArray(override) ? override : base) as T;
  }
  if (typeof base !== 'object' || base === null) {
    return (override !== undefined ? override : base) as T;
  }
  if (typeof override !== 'object' || override === null || Array.isArray(override)) {
    return base;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    if (key in out) {
      out[key] = deepMergeLanding(out[key], value);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

export function resolveLandingCopy(
  locale: Locale,
  payload?: Partial<LandingContentPayload> | null,
): LandingCopy {
  const defaults = getLandingCopy(locale);
  const override = locale === 'ar' ? payload?.contentAr : payload?.contentEn;
  return deepMergeLanding(defaults, override);
}

export function normalizeLandingVisibility(raw: unknown): LandingVisibility {
  const base = { ...DEFAULT_LANDING_VISIBILITY };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return base;
  for (const key of Object.keys(base) as Array<keyof LandingVisibility>) {
    const value = (raw as Record<string, unknown>)[key];
    if (typeof value === 'boolean') base[key] = value;
  }
  return base;
}

export async function fetchPublicLandingContent(): Promise<LandingContentPayload> {
  const response = await fetch(`${API_URL}/api/v1/landing/content`, { cache: 'no-store' });
  if (!response.ok) {
    return { contentEn: null, contentAr: null, visibility: DEFAULT_LANDING_VISIBILITY, updatedAt: null };
  }
  const body = (await response.json()) as {
    contentEn?: LandingCopy | null;
    contentAr?: LandingCopy | null;
    visibility?: unknown;
    updatedAt?: string | null;
  };
  return {
    contentEn: (body.contentEn as LandingCopy | null) ?? null,
    contentAr: (body.contentAr as LandingCopy | null) ?? null,
    visibility: normalizeLandingVisibility(body.visibility),
    updatedAt: body.updatedAt ?? null,
  };
}
