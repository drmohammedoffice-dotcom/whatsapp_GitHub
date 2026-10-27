export type PlanSlug = string;

/**
 * Plan limits as returned by the API. Only features that still exist in the
 * product (TikTok ads + WhatsApp tracking core) are typed here. Retired
 * features (AI, voice, creative studio, Facebook/Instagram/Telegram,
 * appointments, AI campaign review) are intentionally not modelled.
 */
export type PlanLimits = {
  maxTrackingPhones: number;
  whatsappEnabled?: boolean;
  maxWhatsappNumbers?: number;
  tiktokEnabled?: boolean;
  maxTiktokWhatsappNumbers?: number;
  maxTiktokPixels?: number;
  maxPixels?: number;
  whatsappApiEnabled?: boolean;
  maxTeamMembers?: number;
  instantFormsEnabled?: boolean;
  onlineStoreEnabled?: boolean;
};

export type PlanFeature =
  | 'tracking_phone'
  | 'whatsapp'
  | 'whatsapp_api'
  | 'tiktok'
  | 'tiktok_pixel'
  | 'instant_forms'
  | 'online_store';

/**
 * Comparison / limit keys of features that were removed from the product.
 * The API marks them `retired: true` and is phasing them out; the web filters
 * them defensively by key so they never show in pricing or plan editors.
 */
export const RETIRED_PLAN_FEATURE_KEYS: ReadonlySet<string> = new Set([
  'facebook_integration_enabled',
  'instagram_integration_enabled',
  'telegram_integration_enabled',
  'ai_reply_enabled',
  'voice_ai_enabled',
  'voice_minutes_limit',
  'voice_calls_limit',
  'creative_studio_enabled',
  'creative_images_limit',
  'creative_video_seconds_limit',
  'creative_4k_enabled',
  'ai_campaign_review_enabled',
  'appointments_enabled',
]);

/**
 * Keys that still exist in the API but are not enforced anywhere in the
 * product, so they must not be advertised (team-member seats are not limited
 * since agents/departments were removed).
 */
export const UNENFORCED_PLAN_FEATURE_KEYS: ReadonlySet<string> = new Set(['maximum_team_members']);

/** True when a plan comparison/limit row belongs to a retired feature. */
export function isRetiredPlanFeature(row: { key: string; retired?: boolean | null }) {
  return Boolean(row.retired) || RETIRED_PLAN_FEATURE_KEYS.has(row.key);
}

/** True when a plan feature row must not be shown to customers or in plan editors. */
export function isHiddenPlanFeature(row: { key: string; retired?: boolean | null }) {
  return isRetiredPlanFeature(row) || UNENFORCED_PLAN_FEATURE_KEYS.has(row.key);
}

/**
 * Free-text plan bullets (`features` / `featuresAr`) come from the API. Drop any
 * line that still advertises a removed feature so stale copy never leaks.
 */
const RETIRED_FEATURE_TEXT =
  /\bAI\b|artificial intelligence|ذكاء|\bvoice\b|صوت|creative|استوديو|instagram|إنستغرام|انستغرام|انستقرام|facebook|فيسبوك|فيس بوك|messenger|ماسنجر|telegram|تليغرام|تيليجرام|تلغرام|appointment|موعد|مواعيد|calendar|تقويم|partner|شريك|شركاء|team member|أعضاء الفريق|عضو فريق/i;

export function isRetiredFeatureText(line: string) {
  return RETIRED_FEATURE_TEXT.test(line);
}

export function resolvePlanSlug(slug?: string | null): PlanSlug {
  return slug?.trim() || 'basic';
}

export function planAllowsFeature(limits: PlanLimits | null | undefined, feature: PlanFeature) {
  if (!limits) return false;
  if (feature === 'tracking_phone') return Boolean(limits.tiktokEnabled ?? true) && (limits.maxTiktokWhatsappNumbers ?? limits.maxTrackingPhones) !== 0;
  if (feature === 'whatsapp') return (limits.whatsappEnabled ?? true) && (limits.maxWhatsappNumbers ?? 1) !== 0;
  if (feature === 'whatsapp_api') return Boolean(limits.whatsappApiEnabled);
  if (feature === 'tiktok' || feature === 'tiktok_pixel') return Boolean(limits.tiktokEnabled ?? true);
  if (feature === 'instant_forms') return Boolean(limits.instantFormsEnabled);
  if (feature === 'online_store') return Boolean(limits.onlineStoreEnabled);
  return false;
}
