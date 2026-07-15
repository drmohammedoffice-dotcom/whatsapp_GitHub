export const PLAN_SLUGS = ['basic', 'professional', 'business'] as const;

export type PlanSlug = (typeof PLAN_SLUGS)[number];

export type PlanLimits = {
  maxTrackingPhones: number;
  socialIntegrations: boolean;
  aiEnabled: boolean;
};

export const PLAN_LIMITS: Record<PlanSlug, PlanLimits> = {
  basic: { maxTrackingPhones: 1, socialIntegrations: false, aiEnabled: false },
  professional: { maxTrackingPhones: 5, socialIntegrations: true, aiEnabled: true },
  business: { maxTrackingPhones: 10, socialIntegrations: true, aiEnabled: true },
};

export const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

export function resolvePlanSlug(slug: string | null | undefined): PlanSlug {
  if (slug === 'professional' || slug === 'business') return slug;
  return 'basic';
}

export function planLimitsForSlug(slug: string | null | undefined): PlanLimits {
  return PLAN_LIMITS[resolvePlanSlug(slug)];
}
