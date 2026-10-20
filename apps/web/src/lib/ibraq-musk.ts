export const IBRAQ_LANDING_KEY = 'ibraq-musk';
export const IBRAQ_PRODUCT_NAME = 'IBRAQ Musk Collection';
export const IBRAQ_PACK_PRICE_1 = 70_000;
export const IBRAQ_PACK_PRICE_2 = 120_000;
export const IBRAQ_PACK_SAVE = IBRAQ_PACK_PRICE_1 * 2 - IBRAQ_PACK_PRICE_2;

export const IBRAQ_SCENTS = [
  { name: 'مسك الخاص', hint: 'مسكي فاخر' },
  { name: 'مسك الباودر', hint: 'بودري ناعم' },
  { name: 'مسك عبق الرمان', hint: 'فاكهي' },
  { name: 'مسك الراز بيري', hint: 'فاكهي حلو' },
  { name: 'مسك البلوبيري', hint: 'فاكهي' },
  { name: 'مسك الشمس', hint: 'دافئ' },
  { name: 'مسك القمر', hint: 'ناعم' },
  { name: 'مسك الفجر', hint: 'منعش' },
  { name: 'مسك الليل', hint: 'شرقي' },
  { name: 'مسك الهيل', hint: 'شرقي دافئ' },
  { name: 'مسك السكر', hint: 'حلو' },
  { name: 'مسك الكاندي', hint: 'حلو' },
] as const;

export const IBRAQ_WHY = [
  '12 رائحة مختلفة',
  '20 مل لكل عطر',
  'إجمالي 240 مل',
  'مناسب للرجال والنساء',
  'بوكس أنيق مناسب للهدايا',
  'خيارات متعددة بدل الالتزام بعطر واحد',
] as const;

export type IbraqPackQty = 1 | 2;

export function resolveIbraqClientPricing(packQty: IbraqPackQty, deliveryFeeForOne = 0) {
  if (packQty === 2) {
    return {
      packQty: 2 as const,
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
    subtotal: IBRAQ_PACK_PRICE_1,
    shippingCost: shipping,
    total: IBRAQ_PACK_PRICE_1 + shipping,
    freeShipping: shipping === 0,
    savings: 0,
  };
}

const IRAQI_PHONE = /^07\d{9}$/;

export function toWesternDigits(input: string) {
  return String(input || '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

export function normalizeIraqiMobileClient(input: string): string | null {
  let digits = toWesternDigits(input).replace(/[^\d]/g, '');
  if (digits.startsWith('00964')) digits = digits.slice(5);
  else if (digits.startsWith('964')) digits = digits.slice(3);
  if (digits.startsWith('7') && digits.length === 10) digits = `0${digits}`;
  if (!IRAQI_PHONE.test(digits)) return null;
  return digits;
}

export function formatIqd(n: number) {
  return `${Math.round(n).toLocaleString('en-US')} د.ع`;
}
