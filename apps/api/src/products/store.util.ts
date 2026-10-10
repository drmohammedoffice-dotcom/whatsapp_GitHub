import { randomBytes } from 'crypto';

export const IQ_GOVERNORATES = [
  'بغداد',
  'البصرة',
  'نينوى',
  'أربيل',
  'النجف',
  'كربلاء',
  'بابل',
  'الأنبار',
  'ديالى',
  'ذي قار',
  'كركوك',
  'واسط',
  'ميسان',
  'القادسية',
  'صلاح الدين',
  'المثنى',
  'دهوك',
  'السليمانية',
] as const;

export function slugifyBrand(name: string) {
  const ascii = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 28);
  const suffix = randomBytes(3).toString('hex');
  return `${ascii || 'store'}-${suffix}`;
}

export function parseIqdAmount(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return Math.round(raw);
  const mapped = String(raw ?? '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/,/g, '')
    .replace(/[^\d.]/g, '');
  const value = Number(mapped);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

export function displayPrice(product: { unitPrice?: number | null; priceCents?: number | null }) {
  const unit = parseIqdAmount(product.unitPrice);
  if (unit) return unit;
  const cents = parseIqdAmount(product.priceCents);
  if (cents) return cents;
  return 0;
}

export function isProductInStock(product: { quantity: number; outOfStockManual: boolean }) {
  return !product.outOfStockManual && product.quantity > 0;
}

export function parseDeliveryRates(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const num = Number(value);
    if (key.trim() && Number.isFinite(num) && num >= 0) out[key.trim()] = num;
  }
  return out;
}

export function resolveDeliveryFee(
  settings: { deliveryMode: string; deliveryFee: number; deliveryRates: unknown },
  governorate?: string | null,
) {
  const base = Number(settings.deliveryFee) || 0;
  if (settings.deliveryMode !== 'VARIABLE') return Math.max(0, base);
  const rates = parseDeliveryRates(settings.deliveryRates);
  const key = governorate?.trim() || '';
  if (key && key in rates) return Math.max(0, rates[key]!);
  const match = Object.entries(rates).find(([name]) => name.toLowerCase() === key.toLowerCase());
  if (match) return Math.max(0, match[1]);
  return Math.max(0, base);
}

export function normalizeGiftPhone(value?: string | null) {
  if (!value) return '';
  return value.replace(/[^\d+]/g, '').trim();
}
