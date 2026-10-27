'use client';

import type { LandingCopy } from '@/lib/i18n/landing-copy';
import { DEFAULT_LANDING_VISIBILITY, type LandingVisibility } from '@/lib/landing-content';
import { useLandingContent } from './landing-content-provider';

export function useLandingCopy(): LandingCopy {
  return useLandingContent().copy;
}

export function useLandingVisibility(): LandingVisibility {
  return useLandingContent().visibility ?? DEFAULT_LANDING_VISIBILITY;
}
