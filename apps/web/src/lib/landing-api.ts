import { normalizeList } from './safe-href';
import { API_URL } from './utils';

export type LandingOffer = {
  id: string;
  title: string;
  titleAr: string | null;
  description: string | null;
  descriptionAr: string | null;
  badgeText: string | null;
  badgeTextAr: string | null;
  ctaLabel: string | null;
  ctaLabelAr: string | null;
  ctaUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

export async function fetchLandingOffers(): Promise<LandingOffer[]> {
  try {
    const response = await fetch(`${API_URL}/api/v1/landing/offers`, { cache: 'no-store' });
    if (!response.ok) return [];
    const data = await response.json();
    return normalizeList<LandingOffer>(data);
  } catch {
    return [];
  }
}

export function offerText(offer: LandingOffer, locale: 'en' | 'ar', field: 'title' | 'description' | 'badgeText' | 'ctaLabel') {
  if (locale === 'ar') {
    const arKey = `${field}Ar` as keyof LandingOffer;
    const arValue = offer[arKey];
    if (typeof arValue === 'string' && arValue.trim()) return arValue;
  }
  return (offer[field] as string | null) ?? '';
}
