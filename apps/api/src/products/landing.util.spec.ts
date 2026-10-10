import {
  FLASH_LANDING_KEY,
  IBRAQ_PACK_PRICE_1,
  IBRAQ_PACK_PRICE_2,
  IBRAQ_PACK_SAVE,
  isSupportedLandingKey,
  landingSalePrice,
  normalizeIraqiMobile,
  parseLandingMeta,
  resolveIbraqPackPricing,
  rollPromoEndsAt,
  sanitizeCustomerName,
  validateOrderAddress,
} from './landing.util';

describe('landing.util', () => {
  it('accepts Iraqi mobile formats', () => {
    expect(normalizeIraqiMobile('07701234567')).toBe('07701234567');
    expect(normalizeIraqiMobile('+9647701234567')).toBe('07701234567');
    expect(normalizeIraqiMobile('7701234567')).toBe('07701234567');
    expect(normalizeIraqiMobile('hello')).toBeNull();
    expect(normalizeIraqiMobile('12345')).toBeNull();
  });

  it('supports ibraq-musk landing key', () => {
    expect(isSupportedLandingKey('ibraq-musk')).toBe(true);
    expect(isSupportedLandingKey(FLASH_LANDING_KEY)).toBe(true);
    expect(isSupportedLandingKey('unknown')).toBe(false);
  });

  it('prices one pack without free shipping override', () => {
    const p = resolveIbraqPackPricing(1, 5000);
    expect(p.packQty).toBe(1);
    expect(p.unitPrice).toBe(IBRAQ_PACK_PRICE_1);
    expect(p.subtotal).toBe(IBRAQ_PACK_PRICE_1);
    expect(p.shippingCost).toBe(5000);
    expect(p.total).toBe(IBRAQ_PACK_PRICE_1 + 5000);
    expect(p.freeShipping).toBe(false);
  });

  it('prices two packs with free shipping and 20k savings', () => {
    const p = resolveIbraqPackPricing(2, 5000);
    expect(p.packQty).toBe(2);
    expect(p.unitPrice).toBe(IBRAQ_PACK_PRICE_2 / 2);
    expect(p.subtotal).toBe(IBRAQ_PACK_PRICE_2);
    expect(p.shippingCost).toBe(0);
    expect(p.total).toBe(IBRAQ_PACK_PRICE_2);
    expect(p.freeShipping).toBe(true);
    expect(p.savings).toBe(IBRAQ_PACK_SAVE);
    expect(IBRAQ_PACK_PRICE_1 * 2 - IBRAQ_PACK_PRICE_2).toBe(20000);
  });

  it('coerces non-two pack quantities to one pack', () => {
    expect(resolveIbraqPackPricing(3, 0).packQty).toBe(1);
    expect(resolveIbraqPackPricing(0, 0).packQty).toBe(1);
  });

  it('validates address length', () => {
    expect(validateOrderAddress('بغداد')).toBeNull();
    expect(validateOrderAddress('بغداد، الكرادة، شارع 12')).toContain('بغداد');
  });

  it('rolls expired promo windows forward by 3 days', () => {
    const now = new Date('2026-09-10T12:00:00.000Z');
    const ended = new Date('2026-09-07T12:00:00.000Z');
    const next = rollPromoEndsAt(now, ended);
    expect(next.toISOString()).toBe('2026-09-13T12:00:00.000Z');
  });

  it('keeps a future promo end unchanged', () => {
    const now = new Date('2026-09-10T12:00:00.000Z');
    const future = new Date('2026-09-12T12:00:00.000Z');
    expect(rollPromoEndsAt(now, future).toISOString()).toBe(future.toISOString());
  });

  it('parses landing metadata without trusting junk testimonials', () => {
    const meta = parseLandingMeta({
      landingKey: FLASH_LANDING_KEY,
      compareAtPrice: 100000,
      testimonials: [{ name: ' ', text: '' }, { name: 'أحمد', text: 'منتج واضح', stars: 5, published: true }],
    });
    expect(meta.compareAtPrice).toBe(100000);
    expect(meta.testimonials).toHaveLength(1);
  });

  it('sanitizes optional names', () => {
    expect(sanitizeCustomerName('')).toBeNull();
    expect(sanitizeCustomerName('  محمد علي  ')).toBe('محمد علي');
  });

  it('accepts only numeric Meta Pixel IDs', () => {
    expect(parseLandingMeta({ metaPixelId: '123456789012345' }).metaPixelId).toBe('123456789012345');
    expect(parseLandingMeta({ metaPixelId: '<script>alert(1)</script>' }).metaPixelId).toBeNull();
    expect(parseLandingMeta({ metaPixelId: 'abc' }).metaPixelId).toBeNull();
  });

  it('extracts Meta Pixel ID from Ads Manager snippet', () => {
    const snippet = `fbq('init', '123456789012345');\nfbq('track', 'PageView');\n<img src="https://www.facebook.com/tr?id=123456789012345&ev=PageView" />`;
    expect(parseLandingMeta({ metaPixelId: snippet }).metaPixelId).toBe('123456789012345');
  });

  it('uses salePrice from metadata for the flash offer', () => {
    const meta = parseLandingMeta({ salePrice: '25,000' });
    expect(meta.salePrice).toBe(25000);
    expect(landingSalePrice({ unitPrice: 35000, metadata: { salePrice: 25000 } })).toBe(25000);
  });

  it('keeps sanitized landing copy and drops empty junk', () => {
    const meta = parseLandingMeta({
      landingCopy: { heroTitle: '  فلاشة جديدة  ', heroBullets: ['أ', '', 'ب'], courses: [{ title: 'Canva', learn: ['قوالب'] }] },
    });
    expect(meta.landingCopy?.heroTitle).toBe('فلاشة جديدة');
    expect(meta.landingCopy?.heroBullets).toEqual(['أ', 'ب']);
    expect((meta.landingCopy?.courses as Array<{ title: string }>)[0].title).toBe('Canva');
  });
});
