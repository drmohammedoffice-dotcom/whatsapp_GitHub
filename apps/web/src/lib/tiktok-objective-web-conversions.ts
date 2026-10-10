/** مواصفات تحويلات موقع الويب — منفصلة عن مبيعات المنتجات / Sales
 * API: objective_type=WEB_CONVERSIONS فقط (بدون virtual_objective_type / sales_destination)
 * Smart+ معطّل: Smart+ Web في تيك توك يظهر كمبيعات→موقع ويب
 */
export const WEB_CONVERSIONS_OBJECTIVE_CONFIG = {
  menuId: 'WEB_CONVERSIONS' as const,
  apiObjective: 'WEB_CONVERSIONS' as const,
  labelAr: 'تحويلات موقع الويب',
  hintAr: 'تحكّم بالإجراءات عالية القيمة على موقعك عبر البكسل.',
  tikTokAdsManagerLabelAr: 'تحويلات موقع الويب',
  benefitsAr: [
    'حملة تحويلات موقع ويب منفصلة تماماً عن مبيعات متجر تيك توك.',
    'حسّن لشراء / إرسال نموذج / أحداث البكسل الأخرى.',
    'تُنشر يدوياً فقط كـ WEB_CONVERSIONS حتى لا تظهر كمبيعات في تيك توك.',
  ],
  campaignModes: [
    {
      id: 'MANUAL' as const,
      titleAr: 'حملة يدوية · تحويلات موقع الويب',
      descAr: 'تُنشر كـ WEB_CONVERSIONS في مدير إعلانات تيك توك — بدون مسار مبيعات.',
      api: { smartPlus: false },
    },
  ],
  searchCampaign: {
    labelAr: 'حملة الترويج ضمن نتائج البحث',
    badgeAr: 'جديد',
    descAr: 'يسمح باختيار كلمات مفتاحية وعرض الإعلانات داخل صفحة نتائج البحث على TikTok.',
    disabledWhenSmartPlus: false,
  },
  optimizationGoal: 'CONVERT' as const,
  billingEvent: 'OCPM' as const,
  billingNoteAr: 'تعتمد الفوترة على الظهور (التكلفة المحسّنة لكل ألف ظهور).',
  optimizationEvents: [
    { id: 'CONSULT', titleAr: 'Contact / الاتصال (واتساب)' },
    { id: 'SHOPPING', titleAr: 'شراء / إتمام الدفع (Purchase)' },
    { id: 'FORM', titleAr: 'إرسال النموذج (Submit Form)' },
    { id: 'ON_WEB_CART', titleAr: 'إضافة إلى السلة' },
    { id: 'BUTTON', titleAr: 'نقر الزر' },
    { id: 'ON_WEB_DETAIL', titleAr: 'عرض المحتوى' },
    { id: 'ON_WEB_SEARCH', titleAr: 'بحث' },
    { id: 'ON_WEB_SUBSCRIBE', titleAr: 'اشتراك' },
    { id: 'ON_WEB_REGISTER', titleAr: 'التسجيل' },
  ],
  attribution: {
    clickWindowDefault: 'SEVEN_DAYS' as const,
    viewWindowDefault: 'ONE_DAY' as const,
    eventCountDefault: 'EVERY' as const,
    clickWindows: [
      { id: 'ONE_DAY', titleAr: 'يوم واحد' },
      { id: 'SEVEN_DAYS', titleAr: '7 أيام' },
      { id: 'FOURTEEN_DAYS', titleAr: '14 يوماً' },
      { id: 'TWENTY_EIGHT_DAYS', titleAr: '28 يوماً' },
    ],
    viewWindows: [
      { id: 'OFF', titleAr: 'إيقاف' },
      { id: 'ONE_DAY', titleAr: 'يوم واحد' },
      { id: 'SEVEN_DAYS', titleAr: '7 أيام' },
    ],
    eventCounts: [
      { id: 'EVERY', titleAr: 'كل مرة' },
      { id: 'ONCE', titleAr: 'مرة واحدة' },
    ],
  },
} as const;

export type WebConversionsCampaignMode = (typeof WEB_CONVERSIONS_OBJECTIVE_CONFIG.campaignModes)[number]['id'];
