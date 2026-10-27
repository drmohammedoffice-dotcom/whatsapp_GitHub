import { API_URL, api } from './utils';
import { normalizeList } from './safe-href';
import { isHiddenPlanFeature, isRetiredFeatureText, type PlanLimits, type PlanSlug } from './plan-limits';

export type { PlanSlug, PlanLimits };

export type BillingCycle = 'MONTHLY' | 'YEARLY';

export type PlanTier = 'BASIC' | 'PROFESSIONAL' | 'BUSINESS';

export type SubscriptionStatus = 'TRIAL' | 'PENDING' | 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED' | null;

export type BillingPlan = {
  id: string;
  slug: string;
  tier: string;
  name: string;
  nameAr?: string;
  nameEn?: string;
  description: string | null;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  currency: string;
  features: string[];
  featuresAr?: string[];
  popular: boolean;
  comparison?: Array<{
    key: string;
    category: string;
    nameAr: string;
    nameEn: string;
    valueType: string;
    enabled: boolean;
    limit: number | null;
    /** Set by the API for features removed from the product; never shown. */
    retired?: boolean;
  }>;
  limits?: PlanLimits;
};

export type SubscriptionState = {
  hasSubscription: boolean;
  subscriptionStatus: SubscriptionStatus;
  plan: PlanTier | null;
  planSlug: PlanSlug | null;
  planName: string | null;
  limits: PlanLimits | null;
  trackingPhoneCount: number;
  canAddTrackingPhone: boolean;
  whatsappInboxCount?: number;
  canAddWhatsappNumber?: boolean;
  tiktokPixelCount?: number;
  canAddTiktokPixel?: boolean;
  teamMemberCount?: number;
  canAddTeamMember?: boolean;
  overLimit?: {
    trackingPhones: boolean;
    whatsappNumbers: boolean;
    tiktokPixels: boolean;
    teamMembers: boolean;
  };
  billingCycle: BillingCycle | null;
  autoRenew: boolean;
  trialExpired: boolean;
  isFreeTrial: boolean;
  freeTrialEnded: boolean;
  isActive: boolean;
  isExpired: boolean;
  isInGracePeriod: boolean;
  graceHoursRemaining: number | null;
  graceDaysRemaining: number | null;
  gracePurged: boolean;
  daysRemaining: number | null;
  showExpiryWarning: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  expiredAt: string | null;
};

export type CheckoutResult = {
  subscriptionId: string;
  paymentId: string;
  planSlug: PlanSlug;
  planName: string;
  billingCycle: BillingCycle;
  amountCents: number;
  currency: string;
  checkoutPath: string;
  waylUrl?: string | null;
};

export type PaymentDetails = {
  id: string;
  status: string;
  amountCents: number;
  currency: string;
  description: string | null;
  planName: string;
  planSlug: PlanSlug;
  billingCycle: BillingCycle;
  provider?: string;
  waylUrl?: string | null;
  waylStatus?: string | null;
};

export const WHATSAPP_SALES_NUMBER = '9647864314333';

export function formatPrice(amount: number, currency = 'USD') {
  if ((currency || '').toUpperCase() === 'IQD') {
    return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount)} IQD`;
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount / 100);
}

export function planButtonKey(slug: string) {
  if (slug === 'basic') return 'billing.getStarted';
  if (slug === 'professional') return 'billing.startProfessional';
  if (slug === 'business') return 'billing.startBusiness';
  return 'billing.choosePlan';
}

/**
 * Strip retired / unenforced features from a plan before it is shown anywhere
 * (pricing, plans page, checkout). The API marks retired rows with
 * `retired: true`; keys are also filtered defensively on the web.
 */
export function sanitizeBillingPlan(plan: BillingPlan): BillingPlan {
  const cleanLines = (lines: string[] | undefined) =>
    Array.isArray(lines) ? lines.filter((line) => typeof line === 'string' && !isRetiredFeatureText(line)) : lines;
  return {
    ...plan,
    features: cleanLines(plan.features) ?? [],
    featuresAr: cleanLines(plan.featuresAr),
    comparison: Array.isArray(plan.comparison) ? plan.comparison.filter((row) => !isHiddenPlanFeature(row)) : plan.comparison,
  };
}

export function fetchPublicPlans() {
  return fetch(`${API_URL}/api/v1/billing/plans`)
    .then(async (response) => {
      if (!response.ok) return [];
      const data = await response.json();
      return normalizeList<BillingPlan>(data).map(sanitizeBillingPlan);
    });
}

export function fetchSubscriptionStatus() {
  return api<SubscriptionState>('/billing/status');
}

export function buildWhatsAppRenewalUrl(
  locale: 'en' | 'ar',
  daysRemaining?: number | null,
  graceDaysRemaining?: number | null,
) {
  const text =
    locale === 'ar'
      ? [
          'مرحباً، أريد تجديد اشتراك ChatLoora.',
          daysRemaining !== null && daysRemaining !== undefined && daysRemaining >= 0
            ? `الأيام المتبقية على اشتراكي: ${Math.max(0, daysRemaining)}`
            : graceDaysRemaining !== null && graceDaysRemaining !== undefined
              ? `انتهى اشتراكي. الروابط وصفحات الهبوط متوقفة مؤقتاً والبيانات محفوظة. المهلة الظاهرة: ${graceDaysRemaining} يوم`
              : 'انتهى اشتراكي وأحتاج إلى تفعيله عبر واتساب.',
          'أرجو المساعدة. شكراً',
        ].join('\n')
      : [
          'Hello, I would like to renew my ChatLoora subscription.',
          daysRemaining !== null && daysRemaining !== undefined && daysRemaining >= 0
            ? `Days remaining on my subscription: ${Math.max(0, daysRemaining)}`
            : graceDaysRemaining !== null && graceDaysRemaining !== undefined
              ? `My subscription expired. Links/landing pages are paused; data is kept. Shown grace: ${graceDaysRemaining} day(s)`
              : 'My subscription has expired and I need to reactivate it via WhatsApp.',
          'Please help me. Thank you!',
        ].join('\n');
  return `https://wa.me/${WHATSAPP_SALES_NUMBER}?text=${encodeURIComponent(text)}`;
}

export function buildWhatsAppPlanUrl(params: {
  planName: string;
  billingCycle: BillingCycle;
  priceLabel: string;
  locale: 'en' | 'ar';
}) {
  const billingLabel =
    params.billingCycle === 'YEARLY'
      ? params.locale === 'ar'
        ? 'سنوي'
        : 'Yearly'
      : params.locale === 'ar'
        ? 'شهري'
        : 'Monthly';

  const text =
    params.locale === 'ar'
      ? [
          'مرحباً، أريد طلب باقة ChatLoora:',
          '',
          `📦 الباقة: ${params.planName}`,
          `💳 الفوترة: ${billingLabel}`,
          `💰 السعر: ${params.priceLabel}`,
          '',
          'أرجو التواصل لتفعيل اشتراكي. شكراً',
        ].join('\n')
      : [
          'Hello, I would like to subscribe to ChatLoora:',
          '',
          `📦 Plan: ${params.planName}`,
          `💳 Billing: ${billingLabel}`,
          `💰 Price: ${params.priceLabel}`,
          '',
          'Please help me activate my subscription. Thank you!',
        ].join('\n');

  return `https://wa.me/${WHATSAPP_SALES_NUMBER}?text=${encodeURIComponent(text)}`;
}
