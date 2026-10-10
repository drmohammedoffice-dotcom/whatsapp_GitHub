export const UNLIMITED_LIMIT = -1;

export type FeatureValueType = 'BOOLEAN' | 'LIMIT';

export type FeatureDefinitionMeta = {
  key: string;
  category: 'whatsapp' | 'tiktok' | 'whatsapp_api' | 'social' | 'ai' | 'team' | 'other';
  valueType: FeatureValueType;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  sortOrder: number;
};

export const FEATURE_REGISTRY: FeatureDefinitionMeta[] = [
  {
    key: 'whatsapp_enabled',
    category: 'whatsapp',
    valueType: 'BOOLEAN',
    nameAr: 'تفعيل واتساب',
    nameEn: 'Enable WhatsApp',
    descriptionAr: 'السماح بربط أرقام واتساب لصندوق الوارد',
    descriptionEn: 'Allow connecting WhatsApp numbers for the inbox',
    sortOrder: 10,
  },
  {
    key: 'maximum_whatsapp_numbers',
    category: 'whatsapp',
    valueType: 'LIMIT',
    nameAr: 'الحد الأقصى لأرقام واتساب',
    nameEn: 'Maximum WhatsApp numbers',
    descriptionAr: 'عدد أرقام واتساب المسموح ربطها لصندوق الوارد',
    descriptionEn: 'How many inbox WhatsApp numbers can be connected',
    sortOrder: 20,
  },
  {
    key: 'tiktok_integration_enabled',
    category: 'tiktok',
    valueType: 'BOOLEAN',
    nameAr: 'تكامل TikTok',
    nameEn: 'TikTok integration',
    descriptionAr: 'السماح بربط TikTok والبكسلات',
    descriptionEn: 'Allow TikTok ads, pixels, and tracking',
    sortOrder: 30,
  },
  {
    key: 'maximum_tiktok_whatsapp_numbers',
    category: 'tiktok',
    valueType: 'LIMIT',
    nameAr: 'أرقام واتساب لتتبع TikTok',
    nameEn: 'TikTok WhatsApp numbers',
    descriptionAr: 'عدد أرقام واتساب المخصصة لتتبع إعلانات TikTok',
    descriptionEn: 'WhatsApp numbers that can be used for TikTok pixel tracking',
    sortOrder: 40,
  },
  {
    key: 'maximum_tiktok_pixels',
    category: 'tiktok',
    valueType: 'LIMIT',
    nameAr: 'الحد الأقصى لبكسلات TikTok',
    nameEn: 'Maximum TikTok pixels',
    descriptionAr: 'عدد بكسلات TikTok المسموح إنشاؤها',
    descriptionEn: 'How many TikTok pixels can be created',
    sortOrder: 50,
  },
  {
    key: 'maximum_pixels',
    category: 'tiktok',
    valueType: 'LIMIT',
    nameAr: 'الحد الأقصى للبكسلات',
    nameEn: 'Maximum pixels',
    descriptionAr: 'حد البكسلات العام',
    descriptionEn: 'Overall pixel cap',
    sortOrder: 55,
  },
  {
    key: 'whatsapp_api_enabled',
    category: 'whatsapp_api',
    valueType: 'BOOLEAN',
    nameAr: 'WhatsApp API',
    nameEn: 'WhatsApp API',
    descriptionAr: 'السماح بربط WhatsApp Cloud API',
    descriptionEn: 'Allow WhatsApp Cloud API connections',
    sortOrder: 60,
  },
  {
    key: 'facebook_integration_enabled',
    category: 'social',
    valueType: 'BOOLEAN',
    nameAr: 'فيسبوك',
    nameEn: 'Facebook',
    descriptionAr: 'ربط صفحات فيسبوك وماسنجر',
    descriptionEn: 'Facebook Pages and Messenger',
    sortOrder: 70,
  },
  {
    key: 'instagram_integration_enabled',
    category: 'social',
    valueType: 'BOOLEAN',
    nameAr: 'إنستغرام',
    nameEn: 'Instagram',
    descriptionAr: 'ربط إنستغرام للأعمال',
    descriptionEn: 'Instagram Business integration',
    sortOrder: 80,
  },
  {
    key: 'telegram_integration_enabled',
    category: 'social',
    valueType: 'BOOLEAN',
    nameAr: 'تيليغرام',
    nameEn: 'Telegram',
    descriptionAr: 'ربط تيليغرام',
    descriptionEn: 'Telegram integration',
    sortOrder: 90,
  },
  {
    key: 'ai_reply_enabled',
    category: 'ai',
    valueType: 'BOOLEAN',
    nameAr: 'الرد الذكي بالذكاء الاصطناعي',
    nameEn: 'AI auto reply',
    descriptionAr: 'تفعيل الردود الآلية بالذكاء الاصطناعي',
    descriptionEn: 'Enable AI auto-replies and automation',
    sortOrder: 100,
  },
  {
    key: 'voice_ai_enabled',
    category: 'ai',
    valueType: 'BOOLEAN',
    nameAr: 'المساعد الصوتي الهاتفي',
    nameEn: 'Phone Voice AI',
    descriptionAr: 'السماح لرقم هاتف المستأجر بالرد بمساعد Chatloora الصوتي',
    descriptionEn: 'Allow a tenant phone number to answer with Chatloora Voice AI',
    sortOrder: 105,
  },
  {
    key: 'voice_minutes_limit',
    category: 'ai',
    valueType: 'LIMIT',
    nameAr: 'دقائق المكالمات الصوتية شهرياً',
    nameEn: 'Monthly voice minutes',
    descriptionAr: 'حد دقائق المكالمات الصوتية (-1 غير محدود، 0 معطّل)',
    descriptionEn: 'Monthly voice-call minutes (-1 unlimited, 0 disabled)',
    sortOrder: 106,
  },
  {
    key: 'voice_calls_limit',
    category: 'ai',
    valueType: 'LIMIT',
    nameAr: 'حد مكالمات المساعد الصوتي شهرياً',
    nameEn: 'Monthly voice calls',
    descriptionAr: 'عدد جلسات الصوت داخل التطبيق شهرياً (-1 غير محدود)',
    descriptionEn: 'Monthly in-app voice sessions (-1 unlimited)',
    sortOrder: 107,
  },
  {
    key: 'creative_studio_enabled',
    category: 'ai',
    valueType: 'BOOLEAN',
    nameAr: 'الاستوديو الإبداعي',
    nameEn: 'Creative Studio',
    descriptionAr: 'تفعيل استوديو Chatloora الإبداعي لتوليد الصور والفيديو',
    descriptionEn: 'Enable Chatloora Creative Studio for image and video generation',
    sortOrder: 108,
  },
  {
    key: 'creative_images_limit',
    category: 'ai',
    valueType: 'LIMIT',
    nameAr: 'حد صور الاستوديو الإبداعي شهرياً',
    nameEn: 'Creative Studio monthly images',
    descriptionAr: 'عدد الصور المسموح توليدها شهرياً (-1 غير محدود)',
    descriptionEn: 'Monthly generated images (-1 unlimited)',
    sortOrder: 109,
  },
  {
    key: 'creative_video_seconds_limit',
    category: 'ai',
    valueType: 'LIMIT',
    nameAr: 'حد ثواني فيديو الاستوديو شهرياً',
    nameEn: 'Creative Studio monthly video seconds',
    descriptionAr: 'مجموع ثواني الفيديو المسموح توليدها شهرياً (-1 غير محدود)',
    descriptionEn: 'Monthly generated video seconds (-1 unlimited)',
    sortOrder: 110,
  },
  {
    key: 'creative_4k_enabled',
    category: 'ai',
    valueType: 'BOOLEAN',
    nameAr: 'فيديو 4K في الاستوديو الإبداعي',
    nameEn: 'Creative Studio 4K',
    descriptionAr: 'السماح بتوليد فيديو بدقة 4K',
    descriptionEn: 'Allow 4K video generation in Creative Studio',
    sortOrder: 111,
  },
  {
    key: 'appointments_enabled',
    category: 'other',
    valueType: 'BOOLEAN',
    nameAr: 'نظام المواعيد',
    nameEn: 'Appointments',
    descriptionAr: 'المواعيد وربط تقويم Google',
    descriptionEn: 'Appointments and Google Calendar',
    sortOrder: 112,
  },
  {
    key: 'maximum_team_members',
    category: 'team',
    valueType: 'LIMIT',
    nameAr: 'أعضاء الفريق',
    nameEn: 'Maximum team members',
    descriptionAr: 'عدد أعضاء مساحة العمل',
    descriptionEn: 'Workspace team member cap',
    sortOrder: 120,
  },
];

export type PlanLimits = {
  maxTrackingPhones: number;
  socialIntegrations: boolean;
  aiEnabled: boolean;
  appointmentsEnabled: boolean;
  whatsappEnabled: boolean;
  maxWhatsappNumbers: number;
  tiktokEnabled: boolean;
  maxTiktokWhatsappNumbers: number;
  maxTiktokPixels: number;
  maxPixels: number;
  whatsappApiEnabled: boolean;
  facebookEnabled: boolean;
  instagramEnabled: boolean;
  telegramEnabled: boolean;
  maxTeamMembers: number;
  voiceAiEnabled: boolean;
  voiceMinutesLimit: number;
  voiceCallsLimit: number;
  creativeStudioEnabled: boolean;
  creativeImagesLimit: number;
  creativeVideoSecondsLimit: number;
  creative4kEnabled: boolean;
};

export const EMPTY_PLAN_LIMITS: PlanLimits = {
  maxTrackingPhones: 0,
  socialIntegrations: false,
  aiEnabled: false,
  appointmentsEnabled: false,
  whatsappEnabled: false,
  maxWhatsappNumbers: 0,
  tiktokEnabled: false,
  maxTiktokWhatsappNumbers: 0,
  maxTiktokPixels: 0,
  maxPixels: 0,
  whatsappApiEnabled: false,
  facebookEnabled: false,
  instagramEnabled: false,
  telegramEnabled: false,
  maxTeamMembers: 1,
  voiceAiEnabled: false,
  voiceMinutesLimit: 0,
  voiceCallsLimit: 0,
  creativeStudioEnabled: false,
  creativeImagesLimit: 0,
  creativeVideoSecondsLimit: 0,
  creative4kEnabled: false,
};

/** Seed defaults for known slugs only. Runtime always prefers DB entitlements. */
export function seedLimitsForSlug(slug: string | null | undefined): PlanLimits {
  const key = (slug ?? '').toLowerCase();
  if (key === 'professional' || key === 'pro') {
    return {
      maxTrackingPhones: 5,
      socialIntegrations: true,
      aiEnabled: true,
      appointmentsEnabled: true,
      whatsappEnabled: true,
      maxWhatsappNumbers: 3,
      tiktokEnabled: true,
      maxTiktokWhatsappNumbers: 3,
      maxTiktokPixels: 15,
      maxPixels: 15,
      whatsappApiEnabled: true,
      facebookEnabled: true,
      instagramEnabled: true,
      telegramEnabled: true,
      maxTeamMembers: 5,
      voiceAiEnabled: true,
      voiceMinutesLimit: -1,
      voiceCallsLimit: -1,
      creativeStudioEnabled: true,
      creativeImagesLimit: 50,
      creativeVideoSecondsLimit: 120,
      creative4kEnabled: false,
    };
  }
  if (key === 'business' || key === 'enterprise') {
    return {
      maxTrackingPhones: 10,
      socialIntegrations: true,
      aiEnabled: true,
      appointmentsEnabled: true,
      whatsappEnabled: true,
      maxWhatsappNumbers: 10,
      tiktokEnabled: true,
      maxTiktokWhatsappNumbers: 10,
      maxTiktokPixels: -1,
      maxPixels: -1,
      whatsappApiEnabled: true,
      facebookEnabled: true,
      instagramEnabled: true,
      telegramEnabled: true,
      maxTeamMembers: 10,
      voiceAiEnabled: true,
      voiceMinutesLimit: -1,
      voiceCallsLimit: -1,
      creativeStudioEnabled: true,
      creativeImagesLimit: -1,
      creativeVideoSecondsLimit: -1,
      creative4kEnabled: true,
    };
  }
  return {
    maxTrackingPhones: 1,
    socialIntegrations: false,
    aiEnabled: false,
    appointmentsEnabled: false,
    whatsappEnabled: true,
    maxWhatsappNumbers: 1,
    tiktokEnabled: true,
    maxTiktokWhatsappNumbers: 1,
    maxTiktokPixels: 3,
    maxPixels: 3,
    whatsappApiEnabled: false,
    facebookEnabled: false,
    instagramEnabled: false,
    telegramEnabled: false,
    maxTeamMembers: 1,
    voiceAiEnabled: false,
    voiceMinutesLimit: 0,
    voiceCallsLimit: 0,
    creativeStudioEnabled: false,
    creativeImagesLimit: 0,
    creativeVideoSecondsLimit: 0,
    creative4kEnabled: false,
  };
}

export type StoredEntitlement = { featureKey: string; enabled: boolean; limitValue: number | null };

export function limitsFromEntitlements(rows: StoredEntitlement[], fallback: PlanLimits): PlanLimits {
  const map = new Map(rows.map((row) => [row.featureKey, row]));
  const boolVal = (key: string, fallbackValue: boolean) => {
    const row = map.get(key);
    if (!row) return fallbackValue;
    return row.enabled;
  };
  const limitVal = (key: string, fallbackValue: number) => {
    const row = map.get(key);
    if (!row) return fallbackValue;
    if (!row.enabled) return 0;
    if (row.limitValue === null || row.limitValue === undefined) return fallbackValue;
    return row.limitValue;
  };

  const facebookEnabled = boolVal('facebook_integration_enabled', fallback.facebookEnabled);
  const instagramEnabled = boolVal('instagram_integration_enabled', fallback.instagramEnabled);
  const telegramEnabled = boolVal('telegram_integration_enabled', fallback.telegramEnabled);
  const maxTiktokWhatsappNumbers = limitVal('maximum_tiktok_whatsapp_numbers', fallback.maxTiktokWhatsappNumbers);
  const maxTiktokPixels = limitVal('maximum_tiktok_pixels', fallback.maxTiktokPixels);
  const maxPixels = limitVal('maximum_pixels', fallback.maxPixels);

  return {
    whatsappEnabled: boolVal('whatsapp_enabled', fallback.whatsappEnabled),
    maxWhatsappNumbers: limitVal('maximum_whatsapp_numbers', fallback.maxWhatsappNumbers),
    tiktokEnabled: boolVal('tiktok_integration_enabled', fallback.tiktokEnabled),
    maxTiktokWhatsappNumbers,
    maxTiktokPixels,
    maxPixels,
    maxTrackingPhones: maxTiktokWhatsappNumbers,
    whatsappApiEnabled: boolVal('whatsapp_api_enabled', fallback.whatsappApiEnabled),
    facebookEnabled,
    instagramEnabled,
    telegramEnabled,
    socialIntegrations: facebookEnabled || instagramEnabled || telegramEnabled,
    aiEnabled: boolVal('ai_reply_enabled', fallback.aiEnabled),
    appointmentsEnabled: boolVal('appointments_enabled', fallback.appointmentsEnabled),
    maxTeamMembers: limitVal('maximum_team_members', fallback.maxTeamMembers),
    voiceAiEnabled: boolVal('voice_ai_enabled', fallback.voiceAiEnabled),
    voiceMinutesLimit: limitVal('voice_minutes_limit', fallback.voiceMinutesLimit),
    voiceCallsLimit: limitVal('voice_calls_limit', fallback.voiceCallsLimit),
    creativeStudioEnabled: boolVal('creative_studio_enabled', fallback.creativeStudioEnabled),
    creativeImagesLimit: limitVal('creative_images_limit', fallback.creativeImagesLimit),
    creativeVideoSecondsLimit: limitVal('creative_video_seconds_limit', fallback.creativeVideoSecondsLimit),
    creative4kEnabled: boolVal('creative_4k_enabled', fallback.creative4kEnabled),
  };
}

export function entitlementsFromLimits(limits: PlanLimits): StoredEntitlement[] {
  return [
    { featureKey: 'whatsapp_enabled', enabled: limits.whatsappEnabled, limitValue: null },
    { featureKey: 'maximum_whatsapp_numbers', enabled: limits.maxWhatsappNumbers !== 0, limitValue: limits.maxWhatsappNumbers },
    { featureKey: 'tiktok_integration_enabled', enabled: limits.tiktokEnabled, limitValue: null },
    {
      featureKey: 'maximum_tiktok_whatsapp_numbers',
      enabled: limits.maxTiktokWhatsappNumbers !== 0,
      limitValue: limits.maxTiktokWhatsappNumbers,
    },
    { featureKey: 'maximum_tiktok_pixels', enabled: limits.maxTiktokPixels !== 0, limitValue: limits.maxTiktokPixels },
    { featureKey: 'maximum_pixels', enabled: limits.maxPixels !== 0, limitValue: limits.maxPixels },
    { featureKey: 'whatsapp_api_enabled', enabled: limits.whatsappApiEnabled, limitValue: null },
    { featureKey: 'facebook_integration_enabled', enabled: limits.facebookEnabled, limitValue: null },
    { featureKey: 'instagram_integration_enabled', enabled: limits.instagramEnabled, limitValue: null },
    { featureKey: 'telegram_integration_enabled', enabled: limits.telegramEnabled, limitValue: null },
    { featureKey: 'ai_reply_enabled', enabled: limits.aiEnabled, limitValue: null },
    { featureKey: 'appointments_enabled', enabled: limits.appointmentsEnabled, limitValue: null },
    { featureKey: 'maximum_team_members', enabled: limits.maxTeamMembers !== 0, limitValue: limits.maxTeamMembers },
    { featureKey: 'voice_ai_enabled', enabled: limits.voiceAiEnabled, limitValue: null },
    { featureKey: 'voice_minutes_limit', enabled: limits.voiceMinutesLimit !== 0, limitValue: limits.voiceMinutesLimit },
    { featureKey: 'voice_calls_limit', enabled: limits.voiceCallsLimit !== 0, limitValue: limits.voiceCallsLimit },
    { featureKey: 'creative_studio_enabled', enabled: limits.creativeStudioEnabled, limitValue: null },
    { featureKey: 'creative_images_limit', enabled: limits.creativeImagesLimit !== 0, limitValue: limits.creativeImagesLimit },
    {
      featureKey: 'creative_video_seconds_limit',
      enabled: limits.creativeVideoSecondsLimit !== 0,
      limitValue: limits.creativeVideoSecondsLimit,
    },
    { featureKey: 'creative_4k_enabled', enabled: limits.creative4kEnabled, limitValue: null },
  ];
}

export function canCreateWithLimit(currentCount: number, limit: number) {
  if (limit < 0) return true;
  return currentCount < limit;
}

export function isOverLimit(currentCount: number, limit: number) {
  if (limit < 0) return false;
  return currentCount > limit;
}

export function formatLimitLabel(limit: number, locale: 'ar' | 'en') {
  if (limit < 0) return locale === 'ar' ? 'غير محدود' : 'Unlimited';
  if (limit === 0) return locale === 'ar' ? 'غير متاح' : 'Not included';
  return String(limit);
}
