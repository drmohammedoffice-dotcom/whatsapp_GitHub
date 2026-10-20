/** مواصفات حملة الزيارات مرتبة من PDF تيك توك + حقول Marketing API الحقيقية */
export const TRAFFIC_OBJECTIVE_CONFIG = {
  menuId: 'TRAFFIC' as const,
  apiObjective: 'TRAFFIC' as const,
  labelAr: 'الزيارات',
  hintAr: 'وجّه المزيد من الأشخاص إلى موقعك على الويب، أو تطبيقك، أو متجر TikTok Shop الخاص بك.',
  benefitsAr: [
    'ابدأ بسرعة دون الحاجة إلى بكسل، وتواصل مع جمهور واسع على الفور.',
    'حقّق نقرات وعمليات عرض صفحة الهبوط عالية الجودة بتكلفة فعّالة لكل نقرة (CPC).',
    'فعّل رحلة تحويل مدعومة سلسة وميسّرة لزيادة الأداء.',
  ],
  searchCampaign: {
    labelAr: 'الحملة الإعلانية للبحث',
    descAr: 'اضبط إعداد حملتك الإعلانية لاستهداف الإعلانات في نتائج البحث على TikTok.',
    api: { searchCampaign: true, campaignType: 'SEARCH' },
  },
  /** موقع التحسين في المجموعة الإعلانية */
  destinations: [
    {
      id: 'WEBSITE' as const,
      titleAr: 'موقع الويب',
      descAr: 'إرسال الزيارات إلى موقع الويب الخاص بك.',
      api: { promotionType: 'WEBSITE' },
    },
    {
      id: 'APP' as const,
      titleAr: 'التطبيق',
      descAr: 'إرسال الزيارات إلى تطبيقك.',
      api: { promotionType: 'APP_ANDROID', needsApp: true },
    },
    {
      id: 'TIKTOK_SHOP' as const,
      titleAr: 'متجر TikTok Shop',
      descAr: 'وجه حركة الزيارات إلى متجر TikTok Shop الخاص بك.',
      api: { promotionType: 'WEBSITE', productSource: 'STORE' },
    },
  ],
  /** أهداف التحسين الحقيقية حسب واجهة تيك توك ووثائق API */
  optimizationGoals: [
    {
      id: 'CLICK' as const,
      titleAr: 'النقر',
      billingEvent: 'CPC' as const,
      billingLabelAr: 'النقر (التكلفة لكل نقرة)',
      needsPixel: false,
      unitAr: 'نقرة',
    },
    {
      id: 'TRAFFIC_LANDING_PAGE_VIEW' as const,
      titleAr: 'مشاهدة الصفحة المقصودة',
      billingEvent: 'OCPM' as const,
      billingLabelAr: 'مشاهدة الصفحة المقصودة',
      needsPixel: true,
      unitAr: 'مشاهدة الصفحة المقصودة',
      optimizationEventDefault: 'LANDING_PAGE_VIEW',
    },
    {
      id: 'ENGAGED_SESSION' as const,
      titleAr: 'الجلسة المتفاعلة',
      billingEvent: 'OCPM' as const,
      billingLabelAr: 'الجلسة المتفاعلة',
      needsPixel: true,
      unitAr: 'الجلسة المتفاعلة',
      optimizationEventDefault: 'ENGAGED_SESSION',
    },
  ],
  adDestinations: [
    { id: 'WEBSITE' as const, titleAr: 'موقع الويب', requiresUrl: true },
    { id: 'INSTANT_PAGE' as const, titleAr: 'صفحة TikTok الفورية', requiresPageId: true, api: { promotionWebsiteType: 'TIKTOK_NATIVE_PAGE' } },
  ],
  placements: {
    platforms: [
      { id: 'PLACEMENT_TIKTOK', labelAr: 'TikTok، بما في ذلك نتائج البحث', defaultOn: true },
      { id: 'PLACEMENT_PANGLE', labelAr: 'TikTok Ad Network', defaultOn: false },
    ],
    subplacements: [
      { id: 'IN_FEED', labelAr: 'داخل الموجز', defaultOn: true },
      { id: 'SEARCH_FEED', labelAr: 'نتائج البحث', defaultOn: true },
      { id: 'LEMON8', labelAr: 'Lemon8', defaultOn: false },
    ],
  },
} as const;

export type TrafficDestination = (typeof TRAFFIC_OBJECTIVE_CONFIG.destinations)[number]['id'];
export type TrafficOptimizationGoal = (typeof TRAFFIC_OBJECTIVE_CONFIG.optimizationGoals)[number]['id'];
