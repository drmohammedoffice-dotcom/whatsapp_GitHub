export { UNLIMITED_LIMIT, canCreateWithLimit, isOverLimit } from './feature-registry';
export type { PlanLimits } from './feature-registry';
export { EMPTY_PLAN_LIMITS, seedLimitsForSlug as planLimitsForSlug } from './feature-registry';

export const PLAN_SLUGS = ['basic', 'professional', 'business'] as const;
export type PlanSlug = string;

export const GRACE_PERIOD_DAYS = 3;
export const GRACE_PERIOD_MS = GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

export function resolvePlanSlug(slug: string | null | undefined): string {
  return (slug ?? 'basic').toLowerCase() || 'basic';
}
