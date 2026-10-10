import {
  IBRAQ_PACK_PRICE_1,
  IBRAQ_PACK_PRICE_2,
  IBRAQ_PACK_SAVE,
  normalizeIraqiMobileClient,
  resolveIbraqClientPricing,
} from './ibraq-musk';

describe('ibraq-musk pricing', () => {
  it('prices one pack with optional delivery', () => {
    expect(resolveIbraqClientPricing(1, 0)).toEqual({
      packQty: 1,
      subtotal: IBRAQ_PACK_PRICE_1,
      shippingCost: 0,
      total: IBRAQ_PACK_PRICE_1,
      freeShipping: true,
      savings: 0,
    });
    expect(resolveIbraqClientPricing(1, 5000).total).toBe(75_000);
  });

  it('prices two packs with free shipping and savings', () => {
    const two = resolveIbraqClientPricing(2, 5000);
    expect(two.subtotal).toBe(IBRAQ_PACK_PRICE_2);
    expect(two.shippingCost).toBe(0);
    expect(two.total).toBe(120_000);
    expect(two.freeShipping).toBe(true);
    expect(two.savings).toBe(IBRAQ_PACK_SAVE);
    expect(IBRAQ_PACK_SAVE).toBe(20_000);
  });
});

describe('ibraq-musk phone', () => {
  it('accepts iraqi mobiles', () => {
    expect(normalizeIraqiMobileClient('07701234567')).toBe('07701234567');
    expect(normalizeIraqiMobileClient('9647701234567')).toBe('07701234567');
    expect(normalizeIraqiMobileClient('٠٧٧٠١٢٣٤٥٦٧')).toBe('07701234567');
  });

  it('rejects invalid phones', () => {
    expect(normalizeIraqiMobileClient('123')).toBeNull();
    expect(normalizeIraqiMobileClient('0501234567')).toBeNull();
  });
});
