import { sanitizeLandingCopy } from './landing-copy.util';
import { displayPrice, parseIqdAmount } from './store.util';

export const FLASH_LANDING_KEY = 'flash-12-courses';
export const FLASH_LANDING_SKU = 'FLASH-12-COURSES';
export const IBRAQ_MUSK_LANDING_KEY = 'ibraq-musk';
export const IBRAQ_MUSK_SKU = 'IBRAQ-MUSK-12x20';
export const PROMO_CYCLE_MS = 3 * 24 * 60 * 60 * 1000;

/** تسعير باقات إبراق — بكج واحد / بكجين */
export const IBRAQ_PACK_PRICE_1 = 70_000;
export const IBRAQ_PACK_PRICE_2 = 120_000;
export const IBRAQ_PACK_SAVE = IBRAQ_PACK_PRICE_1 * 2 - IBRAQ_PACK_PRICE_2;

export const SUPPORTED_LANDING_KEYS = [FLASH_LANDING_KEY, IBRAQ_MUSK_LANDING_KEY] as const;
export type SupportedLandingKey = (typeof SUPPORTED_LANDING_KEYS)[number];

export function isSupportedLandingKey(key: string): key is SupportedLandingKey {
  return (SUPPORTED_LANDING_KEYS as readonly string[]).includes(key);
}

export function landingSkuForKey(key: string): string {
  if (key === IBRAQ_MUSK_LANDING_KEY) return IBRAQ_MUSK_SKU;
  return FLASH_LANDING_SKU;
}

export function resolveIbraqPackPricing(packQty: number, deliveryFeeForOne: number) {
  const qty = packQty === 2 ? 2 : 1;
  if (qty === 2) {
    return {
      packQty: 2 as const,
      unitPrice: IBRAQ_PACK_PRICE_2 / 2,
      subtotal: IBRAQ_PACK_PRICE_2,
      shippingCost: 0,
      total: IBRAQ_PACK_PRICE_2,
      freeShipping: true,
      savings: IBRAQ_PACK_SAVE,
    };
  }
  const shipping = Math.max(0, Number(deliveryFeeForOne) || 0);
  return {
    packQty: 1 as const,
    unitPrice: IBRAQ_PACK_PRICE_1,
    subtotal: IBRAQ_PACK_PRICE_1,
    shippingCost: shipping,
    total: IBRAQ_PACK_PRICE_1 + shipping,
    freeShipping: shipping === 0,
    savings: 0,
  };
}

export type LandingTestimonial = {
  name: string;
  text: string;
  stars: number;
  date?: string;
  photoUrl?: string | null;
  published: boolean;
};

export type LandingMeta = {
  landingKey?: string;
  compareAtPrice?: number;
  storageGb?: string;
  freeDelivery?: boolean;
  promoEndsAt?: string | null;
  testimonials?: LandingTestimonial[];
  metaPixelId?: string | null;
  landingCopy?: Record<string, unknown>;
  salePrice?: number;
};

export function parseLandingMeta(raw: unknown): LandingMeta {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const rec = raw as Record<string, unknown>;
  const compare = Number(rec.compareAtPrice);
  const testimonials: LandingTestimonial[] = [];
  if (Array.isArray(rec.testimonials)) {
    for (const item of rec.testimonials) {
      if (!item || typeof item !== 'object') continue;
      const t = item as Record<string, unknown>;
      const name = String(t.name || '').trim();
      const text = String(t.text || '').trim();
      if (!name || !text) continue;
      testimonials.push({
        name,
        text,
        stars: Math.min(5, Math.max(1, Math.round(Number(t.stars) || 5))),
        date: t.date ? String(t.date) : undefined,
        photoUrl: t.photoUrl ? String(t.photoUrl) : null,
        published: t.published !== false,
      });
    }
  }
  return {
    landingKey: rec.landingKey ? String(rec.landingKey).trim() : undefined,
    compareAtPrice: Number.isFinite(compare) && compare > 0 ? compare : undefined,
    storageGb: rec.storageGb ? String(rec.storageGb) : undefined,
    freeDelivery: rec.freeDelivery !== false,
    promoEndsAt: rec.promoEndsAt ? String(rec.promoEndsAt) : null,
    testimonials,
    metaPixelId: sanitizeMetaPixelId(rec.metaPixelId),
    landingCopy: sanitizeLandingCopy(rec.landingCopy),
    salePrice: parseIqdAmount(rec.salePrice) ?? undefined,
  };
}

export function landingSalePrice(product: {
  unitPrice?: number | null;
  priceCents?: number | null;
  metadata?: unknown;
}): number {
  const meta = parseLandingMeta(product.metadata);
  if (meta.salePrice && meta.salePrice > 0) return meta.salePrice;
  return displayPrice(product);
}

export function sanitizeMetaPixelId(raw: unknown): string | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (/^\d{10,20}$/.test(value)) return value;
  const fromInit = value.match(/fbq\s*\(\s*['"]init['"]\s*,\s*['"](\d{10,20})['"]/i);
  if (fromInit?.[1]) return fromInit[1];
  const fromTracker = value.match(/facebook\.com\/tr\?id=(\d{10,20})/i);
  if (fromTracker?.[1]) return fromTracker[1];
  return null;
}

export function rollPromoEndsAt(now: Date, stored?: Date | string | null, cycleMs = PROMO_CYCLE_MS): Date {
  const start = stored ? new Date(stored) : null;
  if (!start || Number.isNaN(start.getTime())) return new Date(now.getTime() + cycleMs);
  let end = start.getTime();
  if (end > now.getTime()) return new Date(end);
  while (end <= now.getTime()) end += cycleMs;
  return new Date(end);
}

export function normalizeIraqiMobile(input: string): string | null {
  const digits = String(input || '').replace(/[^\d]/g, '');
  let local = digits;
  if (local.startsWith('00964')) local = local.slice(5);
  else if (local.startsWith('964')) local = local.slice(3);
  if (local.startsWith('7') && local.length === 10) local = `0${local}`;
  if (!/^07\d{9}$/.test(local)) return null;
  return local;
}

export function validateOrderAddress(address: string): string | null {
  const trimmed = String(address || '').trim().replace(/\s+/g, ' ');
  if (trimmed.length < 8) return null;
  if (trimmed.length > 400) return trimmed.slice(0, 400);
  return trimmed;
}

export function sanitizeCustomerName(name?: string | null): string | null {
  const trimmed = String(name || '').trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  return trimmed.slice(0, 80);
}
