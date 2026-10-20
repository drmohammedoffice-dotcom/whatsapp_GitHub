'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocale } from '@/components/providers/locale-provider';
import {
  DEFAULT_LANDING_VISIBILITY,
  fetchPublicLandingContent,
  resolveLandingCopy,
  type LandingContentPayload,
  type LandingVisibility,
} from '@/lib/landing-content';
import { getLandingCopy, type LandingCopy } from '@/lib/i18n/landing-copy';

type LandingContentContextValue = {
  copy: LandingCopy;
  visibility: LandingVisibility;
  loading: boolean;
};

const LandingContentContext = createContext<LandingContentContextValue | null>(null);

export function LandingContentProvider({ children }: { children: ReactNode }) {
  const { locale } = useLocale();
  const [payload, setPayload] = useState<LandingContentPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPublicLandingContent()
      .then((data) => {
        if (!cancelled) setPayload(data);
      })
      .catch(() => {
        if (!cancelled) {
          setPayload({
            contentEn: null,
            contentAr: null,
            visibility: DEFAULT_LANDING_VISIBILITY,
            updatedAt: null,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<LandingContentContextValue>(
    () => ({
      copy: resolveLandingCopy(locale, payload),
      visibility: payload?.visibility ?? DEFAULT_LANDING_VISIBILITY,
      loading,
    }),
    [locale, payload, loading],
  );

  return <LandingContentContext.Provider value={value}>{children}</LandingContentContext.Provider>;
}

export function useLandingContentOptional() {
  return useContext(LandingContentContext);
}

export function useLandingContent() {
  const ctx = useContext(LandingContentContext);
  const { locale } = useLocale();
  if (!ctx) {
    return {
      copy: getLandingCopy(locale),
      visibility: DEFAULT_LANDING_VISIBILITY,
      loading: false,
    };
  }
  return ctx;
}
