'use client';

import { useLocale } from '@/components/providers/locale-provider';
import { getLandingCopy, type LandingCopy } from '@/lib/i18n/landing-copy';

export function useLandingCopy(): LandingCopy {
  const { locale } = useLocale();
  return getLandingCopy(locale);
}
