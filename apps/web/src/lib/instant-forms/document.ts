/** Shared Instant Form document schema (API + web). */

export type InstantFormBlockType =
  | 'heading'
  | 'subheading'
  | 'paragraph'
  | 'image'
  | 'gallery'
  | 'video'
  | 'tiktok_video'
  | 'youtube_video'
  | 'banner'
  | 'icons'
  | 'divider'
  | 'spacer'
  | 'countdown'
  | 'testimonials'
  | 'reviews'
  | 'faq'
  | 'comparison_table'
  | 'features'
  | 'product_card'
  | 'badge'
  | 'guarantee'
  | 'order_counter'
  | 'viewer_counter'
  | 'offer_countdown'
  | 'google_maps'
  | 'location'
  | 'before_after'
  | 'carousel'
  | 'tabs'
  | 'accordion'
  | 'footer'
  | 'header'
  | 'hero'
  | 'form'
  | 'button'
  | 'whatsapp_button'
  | 'multi_choice';

export type InstantFormFieldType =
  | 'name'
  | 'phone'
  | 'whatsapp'
  | 'email'
  | 'governorate'
  | 'city'
  | 'address'
  | 'area'
  | 'landmark'
  | 'quantity'
  | 'color'
  | 'size'
  | 'notes'
  | 'text'
  | 'textarea'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'multiselect'
  | 'date'
  | 'time'
  | 'image_upload'
  | 'file_upload'
  | 'custom';

export type InstantFormStyle = {
  backgroundColor?: string;
  backgroundImage?: string;
  color?: string;
  fontSize?: string;
  fontWeight?: string | number;
  fontFamily?: string;
  textAlign?: 'start' | 'center' | 'end';
  padding?: string;
  margin?: string;
  borderRadius?: string;
  border?: string;
  boxShadow?: string;
  width?: string;
  height?: string;
  maxWidth?: string;
  maxHeight?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  objectPosition?: string;
  aspectRatio?: string;
  opacity?: number;
  gradient?: string;
};

/** Visual color / variant choice (image swatch and/or name). */
export type InstantFormColorChoice = {
  id: string;
  label: string;
  /** Optional product-color photo shown as a clickable swatch */
  imageUrl?: string;
  /** Optional hex for a solid color chip when no image */
  hex?: string;
};

export type InstantFormField = {
  id: string;
  type: InstantFormFieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  hidden?: boolean;
  defaultValue?: string;
  /** Plain text options (select / radio / legacy color names) */
  options?: string[];
  /**
   * Rich color swatches for `color` fields: image and/or name.
   * When set, the public form shows clickable swatches instead of a dropdown.
   */
  choices?: InstantFormColorChoice[];
  /** Allow selecting more than one color (default true for color fields). */
  allowMultiple?: boolean;
  /** For multiselect / color: show quantity stepper under each selected choice. */
  withQuantity?: boolean;
  /**
   * For color fields: after picking a color + qty, customer picks a size per unit.
   * Defaults to true when `sizeOptions` (or product sizes) are available.
   */
  withSizes?: boolean;
  /** Available sizes offered with color selection (e.g. S, M, L). */
  sizeOptions?: string[];
  validation?: {
    regex?: string;
    minLength?: number;
    maxLength?: number;
    errorMessage?: string;
  };
};

export function createColorChoiceId(): string {
  return `c_${Math.random().toString(36).slice(2, 10)}`;
}

export function defaultColorField(): InstantFormField {
  const choices: InstantFormColorChoice[] = [
    { id: createColorChoiceId(), label: 'أسود', hex: '#111827' },
    { id: createColorChoiceId(), label: 'أبيض', hex: '#f8fafc' },
    { id: createColorChoiceId(), label: 'رمادي', hex: '#94a3b8' },
  ];
  return {
    id: createFieldId('color'),
    type: 'color',
    label: 'اختر اللون',
    placeholder: 'اختر لون المنتج',
    required: true,
    allowMultiple: true,
    withQuantity: true,
    withSizes: true,
    sizeOptions: ['S', 'M', 'L', 'XL', 'XXL'],
    choices,
    options: choices.map((c) => c.label),
  };
}

/** Multi-select cards: customer can pick several text and/or image options. */
export function defaultMultiChoiceField(): InstantFormField {
  const choices: InstantFormColorChoice[] = [
    { id: createColorChoiceId(), label: 'خيار 1' },
    { id: createColorChoiceId(), label: 'خيار 2' },
    { id: createColorChoiceId(), label: 'خيار 3' },
  ];
  return {
    id: createFieldId('choice'),
    type: 'multiselect',
    label: 'اختر ما يناسبك',
    placeholder: 'يمكن اختيار أكثر من خيار',
    required: false,
    allowMultiple: true,
    withQuantity: true,
    choices,
    options: choices.map((c) => c.label),
  };
}

export type InstantFormBlock = {
  id: string;
  type: InstantFormBlockType;
  props: Record<string, unknown>;
  style?: InstantFormStyle;
};

export type InstantFormTheme = {
  pageBackground?: string;
  pageBackgroundImage?: string;
  primaryColor?: string;
  secondaryColor?: string;
  textColor?: string;
  fontFamily?: string;
  maxWidth?: string;
  direction?: 'rtl' | 'ltr';
  borderRadius?: string;
};

export type InstantFormThankYou = {
  title: string;
  message: string;
  showOrderNumber?: boolean;
  whatsappButtonLabel?: string;
  whatsappMessage?: string;
  backLabel?: string;
};

export type InstantFormProduct = {
  name?: string;
  description?: string;
  price?: number;
  compareAtPrice?: number;
  discountLabel?: string;
  stock?: number;
  images?: string[];
  videoUrl?: string;
  rating?: number;
  salesCount?: number;
  badge?: string;
  colors?: string[];
  sizes?: string[];
  currency?: string;
  /** Product image display controls */
  imageWidth?: string;
  imageHeight?: string;
  imageObjectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  imageBorderRadius?: string;
};

export type InstantFormDocument = {
  version: 1;
  theme: InstantFormTheme;
  thankYou: InstantFormThankYou;
  product?: InstantFormProduct;
  blocks: InstantFormBlock[];
};

export function createBlockId(prefix = 'b'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function createFieldId(prefix = 'f'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** All 18 Iraqi governorates — used for city / governorate select fields. */
export const IRAQ_GOVERNORATES: string[] = [
  'بغداد',
  'البصرة',
  'نينوى',
  'أربيل',
  'السليمانية',
  'دهوك',
  'كركوك',
  'الأنبار',
  'ديالى',
  'صلاح الدين',
  'واسط',
  'بابل',
  'كربلاء',
  'النجف',
  'القادسية',
  'المثنى',
  'ذي قار',
  'ميسان',
];

/** Iraqi mobile: exactly 11 digits starting with 07 */
export const IRAQI_PHONE_REGEX = /^07\d{9}$/;
export const IRAQI_PHONE_ERROR = 'رقم الهاتف يجب أن يكون 11 رقماً ويبدأ بـ 07 (مثال: 07701234567)';

export function normalizeIraqiPhone(raw: unknown): string {
  return String(raw ?? '').replace(/\D/g, '').slice(0, 11);
}

export function isValidIraqiPhone(raw: unknown): boolean {
  return IRAQI_PHONE_REGEX.test(normalizeIraqiPhone(raw));
}

/** Convert Arabic-Indic / Persian digits to Western 0-9. */
export function toWesternDigits(raw: string): string {
  return String(raw)
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/**
 * Parse money/price input. Accepts Western digits (0-9) and Arabic/Persian digits.
 * Returns null when empty / not a finite number.
 */
export function parseMoneyInput(raw: unknown): number | null {
  if (raw == null) return null;
  const cleaned = toWesternDigits(String(raw))
    .replace(/,/g, '')
    .replace(/[^\d.]/g, '')
    .trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function moneyInputValue(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return '';
  return String(value);
}

export function emptyDocument(overrides?: Partial<InstantFormDocument>): InstantFormDocument {
  return {
    version: 1,
    theme: {
      pageBackground: '#f8fafc',
      primaryColor: '#7c3aed',
      secondaryColor: '#4f46e5',
      textColor: '#0f172a',
      fontFamily: 'Cairo, Tajawal, system-ui, sans-serif',
      maxWidth: '480px',
      direction: 'rtl',
      borderRadius: '16px',
      ...overrides?.theme,
    },
    thankYou: {
      title: 'تم استلام طلبك بنجاح',
      message: 'شكراً لك! سيتواصل معك فريقنا قريباً لتأكيد الطلب.',
      showOrderNumber: true,
      whatsappButtonLabel: 'تواصل عبر واتساب',
      backLabel: 'العودة',
      ...overrides?.thankYou,
    },
    product: overrides?.product,
    blocks: overrides?.blocks ?? [],
  };
}

export function defaultLeadFormFields(): InstantFormField[] {
  return [
    {
      id: createFieldId('name'),
      type: 'name',
      label: 'الاسم الكامل',
      placeholder: 'اكتب اسمك',
      required: true,
      validation: { minLength: 2, errorMessage: 'الاسم مطلوب' },
    },
    {
      id: createFieldId('phone'),
      type: 'phone',
      label: 'رقم الهاتف',
      placeholder: '07xxxxxxxxx',
      required: true,
      validation: {
        regex: '^07\\d{9}$',
        minLength: 11,
        maxLength: 11,
        errorMessage: IRAQI_PHONE_ERROR,
      },
    },
    {
      id: createFieldId('city'),
      type: 'city',
      label: 'المدينة / المحافظة',
      placeholder: 'اختر المحافظة',
      required: true,
      options: [...IRAQ_GOVERNORATES],
    },
    {
      id: createFieldId('address'),
      type: 'address',
      label: 'العنوان',
      placeholder: 'المنطقة والشارع',
      required: false,
    },
    {
      id: createFieldId('qty'),
      type: 'quantity',
      label: 'الكمية',
      defaultValue: '1',
      required: true,
    },
    {
      id: createFieldId('notes'),
      type: 'notes',
      label: 'ملاحظات',
      placeholder: 'أي تفاصيل إضافية',
      required: false,
    },
  ];
}

export function starterDocument(name = 'استمارة جديدة'): InstantFormDocument {
  const fields = defaultLeadFormFields();
  return emptyDocument({
    product: {
      name,
      price: 25000,
      compareAtPrice: 35000,
      discountLabel: 'خصم محدود',
      currency: 'IQD',
      badge: 'الأكثر مبيعاً',
      salesCount: 128,
      rating: 4.8,
    },
    blocks: [
      {
        id: createBlockId('hero'),
        type: 'hero',
        props: {
          title: name,
          subtitle: 'اطلب الآن وحصّل العرض الخاص',
          badge: 'عرض محدود',
        },
        style: {
          backgroundColor: '#7c3aed',
          color: '#ffffff',
          padding: '28px 20px',
          textAlign: 'center',
        },
      },
      {
        id: createBlockId('product'),
        type: 'product_card',
        props: {},
      },
      {
        id: createBlockId('features'),
        type: 'features',
        props: {
          title: 'لماذا تختارنا؟',
          items: ['توصيل سريع', 'ضمان الجودة', 'دعم على مدار الساعة'],
        },
      },
      {
        id: createBlockId('form'),
        type: 'form',
        props: {
          title: 'أكمل طلبك',
          submitLabel: 'إكمال الحجز',
          fields,
        },
      },
      {
        id: createBlockId('guarantee'),
        type: 'guarantee',
        props: {
          title: 'ضمان استرجاع',
          text: 'يمكنك استرجاع المنتج خلال 7 أيام إذا لم يناسبك.',
        },
      },
    ],
  });
}

export const BLOCK_CATALOG: Array<{
  type: InstantFormBlockType;
  labelAr: string;
  labelEn: string;
  category: 'content' | 'media' | 'commerce' | 'social' | 'layout' | 'form';
}> = [
  { type: 'hero', labelAr: 'قسم Hero', labelEn: 'Hero', category: 'layout' },
  { type: 'header', labelAr: 'Header', labelEn: 'Header', category: 'layout' },
  { type: 'footer', labelAr: 'Footer', labelEn: 'Footer', category: 'layout' },
  { type: 'heading', labelAr: 'عنوان رئيسي', labelEn: 'Heading', category: 'content' },
  { type: 'subheading', labelAr: 'عنوان فرعي', labelEn: 'Subheading', category: 'content' },
  { type: 'paragraph', labelAr: 'فقرة', labelEn: 'Paragraph', category: 'content' },
  { type: 'badge', labelAr: 'شارة', labelEn: 'Badge', category: 'content' },
  { type: 'divider', labelAr: 'فاصل', labelEn: 'Divider', category: 'layout' },
  { type: 'spacer', labelAr: 'مسافة', labelEn: 'Spacer', category: 'layout' },
  { type: 'image', labelAr: 'صورة', labelEn: 'Image', category: 'media' },
  { type: 'gallery', labelAr: 'معرض صور', labelEn: 'Gallery', category: 'media' },
  { type: 'carousel', labelAr: 'Carousel', labelEn: 'Carousel', category: 'media' },
  { type: 'before_after', labelAr: 'قبل وبعد', labelEn: 'Before/After', category: 'media' },
  { type: 'video', labelAr: 'فيديو', labelEn: 'Video', category: 'media' },
  { type: 'tiktok_video', labelAr: 'فيديو TikTok', labelEn: 'TikTok Video', category: 'media' },
  { type: 'youtube_video', labelAr: 'فيديو YouTube', labelEn: 'YouTube', category: 'media' },
  { type: 'banner', labelAr: 'Banner', labelEn: 'Banner', category: 'media' },
  { type: 'icons', labelAr: 'أيقونات', labelEn: 'Icons', category: 'content' },
  { type: 'features', labelAr: 'قائمة مميزات', labelEn: 'Features', category: 'commerce' },
  { type: 'product_card', labelAr: 'بطاقة منتج', labelEn: 'Product Card', category: 'commerce' },
  { type: 'comparison_table', labelAr: 'جدول مقارنة', labelEn: 'Comparison', category: 'commerce' },
  { type: 'guarantee', labelAr: 'ضمان', labelEn: 'Guarantee', category: 'commerce' },
  { type: 'order_counter', labelAr: 'عداد الطلبات', labelEn: 'Order Counter', category: 'social' },
  { type: 'viewer_counter', labelAr: 'عداد المشاهدين', labelEn: 'Viewers', category: 'social' },
  { type: 'countdown', labelAr: 'عداد تنازلي', labelEn: 'Countdown', category: 'social' },
  { type: 'offer_countdown', labelAr: 'عداد العرض', labelEn: 'Offer Timer', category: 'social' },
  { type: 'testimonials', labelAr: 'آراء العملاء', labelEn: 'Testimonials', category: 'social' },
  { type: 'reviews', labelAr: 'تقييمات', labelEn: 'Reviews', category: 'social' },
  { type: 'faq', labelAr: 'أسئلة شائعة', labelEn: 'FAQ', category: 'content' },
  { type: 'accordion', labelAr: 'Accordion', labelEn: 'Accordion', category: 'content' },
  { type: 'tabs', labelAr: 'Tabs', labelEn: 'Tabs', category: 'content' },
  { type: 'google_maps', labelAr: 'خرائط Google', labelEn: 'Google Maps', category: 'content' },
  { type: 'location', labelAr: 'الموقع', labelEn: 'Location', category: 'content' },
  { type: 'form', labelAr: 'نموذج الطلب', labelEn: 'Lead Form', category: 'form' },
  { type: 'multi_choice', labelAr: 'اختيارات متعددة', labelEn: 'Multi Choice', category: 'form' },
  { type: 'button', labelAr: 'زر', labelEn: 'Button', category: 'form' },
  { type: 'whatsapp_button', labelAr: 'زر واتساب', labelEn: 'WhatsApp', category: 'form' },
];

export function createDefaultBlock(type: InstantFormBlockType): InstantFormBlock {
  const id = createBlockId(type);
  switch (type) {
    case 'heading':
      return { id, type, props: { text: 'عنوان رئيسي' } };
    case 'subheading':
      return { id, type, props: { text: 'عنوان فرعي جذاب' } };
    case 'paragraph':
      return { id, type, props: { text: 'اكتب وصفاً مختصراً عن العرض أو الخدمة هنا.' } };
    case 'image':
      return {
        id,
        type,
        props: {
          src: '',
          alt: 'صورة المنتج',
          width: '100%',
          height: '240px',
          objectFit: 'cover',
          borderRadius: '16px',
          align: 'center',
        },
      };
    case 'gallery':
      return {
        id,
        type,
        props: {
          images: [] as string[],
          imageHeight: '140px',
          objectFit: 'cover',
          borderRadius: '12px',
          columns: 2,
        },
      };
    case 'video':
    case 'tiktok_video':
    case 'youtube_video':
      return { id, type, props: { url: '' } };
    case 'banner':
      return { id, type, props: { text: 'عرض خاص اليوم فقط', src: '' } };
    case 'icons':
      return { id, type, props: { items: ['⭐ جودة', '🚚 توصيل', '🛡️ ضمان'] } };
    case 'divider':
      return { id, type, props: {} };
    case 'spacer':
      return { id, type, props: { height: 24 } };
    case 'countdown':
    case 'offer_countdown':
      return {
        id,
        type,
        props: {
          title: 'ينتهي العرض خلال',
          endsAt: new Date(Date.now() + 1000 * 60 * 60 * 6).toISOString(),
        },
      };
    case 'testimonials':
      return {
        id,
        type,
        props: {
          items: [
            { name: 'سارة', text: 'خدمة ممتازة وسريعة', rating: 5 },
            { name: 'أحمد', text: 'جودة عالية وأنصح الجميع', rating: 5 },
          ],
        },
      };
    case 'reviews':
      return { id, type, props: { rating: 4.9, count: 240, label: 'تقييم العملاء' } };
    case 'faq':
    case 'accordion':
      return {
        id,
        type,
        props: {
          items: [
            { q: 'كم مدة التوصيل؟', a: 'خلال 24–72 ساعة حسب المحافظة.' },
            { q: 'هل يوجد ضمان؟', a: 'نعم، ضمان استرجاع خلال 7 أيام.' },
          ],
        },
      };
    case 'comparison_table':
      return {
        id,
        type,
        props: {
          headers: ['الميزة', 'نحن', 'الغير'],
          rows: [
            ['جودة', '✓', '✗'],
            ['سعر', 'مناسب', 'مرتفع'],
          ],
        },
      };
    case 'features':
      return { id, type, props: { title: 'المميزات', items: ['ميزة 1', 'ميزة 2', 'ميزة 3'] } };
    case 'product_card':
      return { id, type, props: {} };
    case 'badge':
      return { id, type, props: { text: 'جديد' } };
    case 'guarantee':
      return { id, type, props: { title: 'ضمان', text: 'ضمان رضا العملاء 100%' } };
    case 'order_counter':
      return { id, type, props: { label: 'طلب اليوم', value: 37 } };
    case 'viewer_counter':
      return { id, type, props: { label: 'يشاهدون الآن', value: 14 } };
    case 'google_maps':
    case 'location':
      return { id, type, props: { address: 'بغداد، العراق', embedUrl: '' } };
    case 'before_after':
      return { id, type, props: { before: '', after: '', labelBefore: 'قبل', labelAfter: 'بعد' } };
    case 'carousel':
      return { id, type, props: { images: [] as string[] } };
    case 'tabs':
      return {
        id,
        type,
        props: {
          tabs: [
            { label: 'الوصف', content: 'تفاصيل المنتج' },
            { label: 'الشحن', content: 'تفاصيل الشحن' },
          ],
        },
      };
    case 'footer':
      return { id, type, props: { text: '© Chatloora — جميع الحقوق محفوظة' } };
    case 'header':
      return { id, type, props: { title: 'Chatloora' } };
    case 'hero':
      return {
        id,
        type,
        props: { title: 'عرض خاص', subtitle: 'اطلب الآن', badge: 'حصري' },
        style: { backgroundColor: '#7c3aed', color: '#fff', padding: '28px 20px', textAlign: 'center' },
      };
    case 'button':
      return {
        id,
        type,
        props: { label: 'اشتر الآن', href: '#form', variant: 'primary' },
      };
    case 'whatsapp_button':
      return { id, type, props: { label: 'تواصل واتساب', message: 'مرحبا، أريد الاستفسار' } };
    case 'multi_choice': {
      const choices = [
        { id: createColorChoiceId(), label: 'خيار 1' },
        { id: createColorChoiceId(), label: 'خيار 2' },
        { id: createColorChoiceId(), label: 'خيار 3' },
      ];
      return {
        id,
        type,
        props: {
          title: 'اختر ما يناسبك',
          required: false,
          allowMultiple: true,
          showQuantity: true,
          choices,
        },
      };
    }
    case 'form':
    default:
      return {
        id,
        type: 'form',
        props: {
          title: 'أكمل طلبك',
          submitLabel: 'إكمال الحجز',
          fields: defaultLeadFormFields(),
        },
      };
  }
}
