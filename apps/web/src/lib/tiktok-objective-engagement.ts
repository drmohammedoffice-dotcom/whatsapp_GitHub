/** مواصفات حملة تفاعل المجتمع مرتبة من PDF تيك توك + حقول Marketing API الحقيقية */
export const ENGAGEMENT_OBJECTIVE_CONFIG = {
  menuId: 'ENGAGEMENT' as const,
  apiObjective: 'ENGAGEMENT' as const,
  labelAr: 'تفاعل المجتمع',
  hintAr: 'احصل على المزيد من المتابعين أو الزيارات لصفحة TikTok.',
  benefitsAr: [
    'ادفع المزيد من الأشخاص لمتابعة حسابك على TikTok.',
    'ادفع المزيد من الأشخاص لزيارة ملفك التعريفي على TikTok.',
    'الترويج للبث المباشر الخاص بك.',
  ],
  optimizationGoals: [
    {
      id: 'FOLLOWERS' as const,
      titleAr: 'متابعة',
      descAr: 'زد متابعي حسابك على TikTok.',
      billingEvent: 'OCPM' as const,
      unitAr: 'متابعة',
    },
    {
      id: 'PAGE_VISIT' as const,
      titleAr: 'زيارات صفحة TikTok',
      descAr: 'تم ترقية هدف زيارة الملف الشخصي لتوجيه الزيارات إلى صفحات تيك توك المختلفة بالإضافة إلى الملف التعريفي.',
      billingEvent: 'OCPM' as const,
      unitAr: 'زيارة صفحة',
    },
  ],
  placements: {
    platforms: [{ id: 'PLACEMENT_TIKTOK', labelAr: 'TikTok', defaultOn: true }],
    subplacements: [{ id: 'IN_FEED', labelAr: 'داخل الموجز', defaultOn: true }],
  },
  ad: {
    /** الوجهة عادة داخل تيك توك عبر الهوية المختارة؛ لا يوجد موقع ويب إلزامي */
    requiresExternalUrl: false,
    disclaimerOptional: true,
  },
} as const;

export type EngagementOptimizationGoal = (typeof ENGAGEMENT_OBJECTIVE_CONFIG.optimizationGoals)[number]['id'];
