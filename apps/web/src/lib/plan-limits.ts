export type PlanSlug = string;

export type PlanLimits = {
  maxTrackingPhones: number;
  socialIntegrations: boolean;
  aiEnabled: boolean;
  appointmentsEnabled: boolean;
  whatsappEnabled?: boolean;
  maxWhatsappNumbers?: number;
  tiktokEnabled?: boolean;
  maxTiktokWhatsappNumbers?: number;
  maxTiktokPixels?: number;
  maxPixels?: number;
  whatsappApiEnabled?: boolean;
  facebookEnabled?: boolean;
  instagramEnabled?: boolean;
  telegramEnabled?: boolean;
  maxTeamMembers?: number;
  voiceAiEnabled?: boolean;
  voiceMinutesLimit?: number;
  voiceCallsLimit?: number;
  creativeStudioEnabled?: boolean;
  creativeImagesLimit?: number;
  creativeVideoSecondsLimit?: number;
  creative4kEnabled?: boolean;
};

export type PlanFeature =
  | 'tracking_phone'
  | 'whatsapp'
  | 'whatsapp_api'
  | 'tiktok'
  | 'tiktok_pixel'
  | 'facebook'
  | 'instagram'
  | 'telegram'
  | 'social_integrations'
  | 'ai'
  | 'appointments'
  | 'team_members'
  | 'voice_ai'
  | 'creative_studio';

export function resolvePlanSlug(slug?: string | null): PlanSlug {
  return slug?.trim() || 'basic';
}

export function planAllowsFeature(limits: PlanLimits | null | undefined, feature: PlanFeature) {
  if (!limits) return false;
  if (feature === 'tracking_phone') return Boolean(limits.tiktokEnabled ?? true) && (limits.maxTiktokWhatsappNumbers ?? limits.maxTrackingPhones) !== 0;
  if (feature === 'whatsapp') return (limits.whatsappEnabled ?? true) && (limits.maxWhatsappNumbers ?? 1) !== 0;
  if (feature === 'whatsapp_api') return Boolean(limits.whatsappApiEnabled);
  if (feature === 'tiktok' || feature === 'tiktok_pixel') return Boolean(limits.tiktokEnabled ?? true);
  if (feature === 'facebook') return Boolean(limits.facebookEnabled ?? limits.socialIntegrations);
  if (feature === 'instagram') return Boolean(limits.instagramEnabled ?? limits.socialIntegrations);
  if (feature === 'telegram') return Boolean(limits.telegramEnabled ?? limits.socialIntegrations);
  if (feature === 'social_integrations') return Boolean(limits.socialIntegrations);
  if (feature === 'appointments') return Boolean(limits.appointmentsEnabled);
  if (feature === 'team_members') return (limits.maxTeamMembers ?? 1) !== 0;
  if (feature === 'voice_ai') return Boolean(limits.voiceAiEnabled);
  if (feature === 'creative_studio') return Boolean(limits.creativeStudioEnabled);
  return Boolean(limits.aiEnabled);
}
