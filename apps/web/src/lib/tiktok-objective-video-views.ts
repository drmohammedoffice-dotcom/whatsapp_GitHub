/** مواصفات حملة مشاهدات الفيديو مرتبة من PDF تيك توك + حقول Marketing API الحقيقية */
export const VIDEO_VIEWS_OBJECTIVE_CONFIG = {
  menuId: 'VIDEO_VIEWS' as const,
  apiObjective: 'VIDEO_VIEWS' as const,
  labelAr: 'مشاهدات الفيديو',
  hintAr: 'احصل على المزيد من المشاهدات والتفاعل لإعلانات الفيديو الخاصة بك.',
  benefitsAr: [
    'زيادة مرات تشغيل إعلانات الفيديو الخاصة بك إلى أقصى حد.',
    'جذب الانتباه عن طريق عرض إعلاناتك للمستخدمين الذين يتفاعلون بشكل أكثر فعالية.',
  ],
  /** أهداف التحسين الحقيقية (Focused View) */
  optimizationGoals: [
    {
      id: 'ENGAGED_VIEW' as const,
      titleAr: 'مشاهدات لمدة 6 ثوان (مشاهدة مركّزة)',
      descAr: 'حسّن للحصول على مشاهدات مدتها 6 ثوانٍ أو تفاعل مع الإعلان (أيهما يحدث أولاً).',
      billingEvent: 'CPV' as const,
      unitAr: 'مشاهدة (مشاهدة مركّزة لمدة 6 ثوان)',
      api: { optimizationGoal: 'ENGAGED_VIEW', cpvVideoDuration: 'SIX_SECONDS' },
      recommendForSecondsUnder: 8,
    },
    {
      id: 'ENGAGED_VIEW_FIFTEEN' as const,
      titleAr: 'مشاهدات لمدة 15 ثانية (مشاهدة مركّزة)',
      descAr: 'حسّن للحصول على مشاهدات مدتها 15 ثانية أو تفاعل مع الإعلان (أيهما يحدث أولاً).',
      billingEvent: 'CPV' as const,
      unitAr: 'مشاهدة (مشاهدة مركّزة لمدة 15 ثانية)',
      api: { optimizationGoal: 'ENGAGED_VIEW_FIFTEEN', cpvVideoDuration: 'FIFTEEN_SECONDS' },
      recommendForSecondsFrom: 8,
    },
  ],
  frequency: {
    modes: [
      { id: 'NONE' as const, titleAr: 'المتابعة بدون الحد الأقصى المخصص لمرات الظهور' },
      { id: 'CAP' as const, titleAr: 'الحد الأقصى للتواتر المخصص' },
    ],
    defaultCap: { frequency: 3, frequencySchedule: 7 },
    apiFields: ['frequency', 'frequency_schedule'] as const,
  },
  placements: {
    platforms: [{ id: 'PLACEMENT_TIKTOK', labelAr: 'TikTok', defaultOn: true }],
    subplacements: [
      { id: 'IN_FEED', labelAr: 'داخل الموجز', defaultOn: true },
      { id: 'LEMON8', labelAr: 'Lemon8', defaultOn: false },
    ],
  },
  ad: {
    ctaOptional: true,
    destinationOptional: true,
    destinations: [
      { id: 'NONE' as const, titleAr: 'بدون وجهة' },
      { id: 'WEBSITE' as const, titleAr: 'موقع الويب', requiresUrl: true },
      { id: 'INSTANT_PAGE' as const, titleAr: 'صفحة TikTok الفورية', requiresPageId: true },
    ],
  },
} as const;

export type VideoViewsOptimizationGoal = (typeof VIDEO_VIEWS_OBJECTIVE_CONFIG.optimizationGoals)[number]['id'];
export type VideoViewsFrequencyMode = (typeof VIDEO_VIEWS_OBJECTIVE_CONFIG.frequency.modes)[number]['id'];
