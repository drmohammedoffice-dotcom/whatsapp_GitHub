/** مواصفات حملة الوصول مستخرجة من PDF تيك توك + حقول Marketing API الحقيقية */
export const REACH_OBJECTIVE_CONFIG = {
  menuId: 'REACH' as const,
  apiObjective: 'REACH' as const,
  labelAr: 'الوصول',
  hintAr: 'اعرض إعلانك أمام أقصى عدد من الأشخاص.',
  campaignTypes: [
    {
      id: 'AUCTION' as const,
      titleAr: 'الوصول إلى المزاد',
      descAr: 'الإعلانات بمعدل الوصول الأكثر فعالية.',
      api: { searchCampaign: false },
    },
    {
      id: 'TOP_SEARCH' as const,
      titleAr: 'TopSearch',
      descAr: 'اعرض إعلانك في صدارة نتائج البحث لزيادة الظهور وحصة الصوت إلى أقصى حد.',
      badgeAr: 'جديد',
      api: { searchCampaign: true, campaignType: 'SEARCH' },
    },
  ],
  optimizationGoal: 'REACH' as const,
  billingEvent: 'CPM' as const,
  frequency: {
    modes: [
      { id: 'TARGET' as const, titleAr: 'التكرار المستهدف', recommended: true },
      { id: 'CAP' as const, titleAr: 'تحديد عدد مرات الظهور', recommended: false },
    ],
    /** قيم API: لا تعرض أكثر من `frequency` مرات كل `frequencySchedule` أيام */
    defaultCap: { frequency: 3, frequencySchedule: 7 },
    apiFields: ['frequency', 'frequency_schedule'] as const,
  },
  destinations: [
    { id: 'WEBSITE' as const, titleAr: 'موقع الويب', requiresUrl: true, requiresPixel: false },
    { id: 'INSTANT_PAGE' as const, titleAr: 'صفحة TikTok الفورية', requiresPageId: true },
  ],
  placements: {
    platforms: [
      { id: 'PLACEMENT_TIKTOK', label: 'TikTok' },
    ],
    /** قيم tiktok_subplacements المقبولة حالياً من تيك توك */
    subplacements: [
      { id: 'IN_FEED', labelAr: 'داخل الموجز', defaultOn: true },
      { id: 'SEARCH_FEED', labelAr: 'نتائج البحث', defaultOn: true },
      { id: 'LEMON8', labelAr: 'Lemon8', defaultOn: false },
      { id: 'TIKTOK_LITE', labelAr: 'TikTok Lite', defaultOn: false },
    ],
  },
  interactions: [
    { id: 'allowComments', labelAr: 'السماح بالتعليقات', api: 'comment_disabled', invert: true },
    { id: 'allowDownload', labelAr: 'السماح بتنزيل الفيديو', api: 'video_download_disabled', invert: true },
    { id: 'allowShare', labelAr: 'السماح بمشاركة الفيديو', api: 'share_disabled', invert: true },
  ],
} as const;
