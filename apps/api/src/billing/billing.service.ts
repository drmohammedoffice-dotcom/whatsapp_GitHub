import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { BillingInterval, InvoiceStatus, OfficialNotificationType, PaymentStatus, SalesReferralSource, SubscriptionStatus } from '@watsapp/database';
import { PrismaService } from '../prisma/prisma.service';
import type { PlanSlug } from './dto/billing.dto';
import { FEATURE_REGISTRY, formatLimitLabel, type PlanLimits } from './feature-registry';
import { BillingAccessService } from './billing-access.service';
import { carryOverPeriodEnd, planDurationDays } from './billing-carryover';
import { PlanEntitlementsService } from './plan-entitlements.service';
import { TikTokLifecycleEventsService } from '../tiktok-integration/tiktok-lifecycle-events.service';
import { WaylService, type WaylWebhookPayload } from './wayl.service';
import { BillingEmailService } from './billing-email.service';
import { SubscriptionExpiryService } from './subscription-expiry.service';
import { ConfigService } from '@nestjs/config';
import { SalesPartnersService } from '../sales-partners/sales-partners.service';
import { OfficialWhatsAppNotificationService } from '../official-whatsapp/official-whatsapp.notifications.service';
import { resolveUsdToIqdRate, toWaylIqd } from './usd-to-iqd';

const PLAN_TIER: Record<string, string> = {
  basic: 'BASIC',
  professional: 'PROFESSIONAL',
  business: 'BUSINESS',
};

function planYearlyCents(plan: { priceCents: number; yearlyPriceCents: number | null }) {
  return plan.yearlyPriceCents ?? Math.round(plan.priceCents * 12 * 0.8);
}

export function sanitizePaymentId(raw: string | undefined | null): string {
  const value = (raw ?? '').trim();
  const id = value.split(/[/?#&]/)[0] ?? '';
  if (!/^[a-z0-9]{16,40}$/i.test(id)) {
    throw new BadRequestException('Invalid payment id');
  }
  return id;
}

function isWaylPaid(status?: string | null, event?: string | null) {
  const s = (status ?? '').toLowerCase();
  const e = (event ?? '').toLowerCase();
  return (
    s === 'complete' ||
    s === 'completed' ||
    s === 'delivered' ||
    s === 'paid' ||
    s === 'success' ||
    e === 'order.completed' ||
    e === 'order.delivered' ||
    e === 'order.paid' ||
    (e === 'order.created' && s === 'paid')
  );
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BillingAccessService,
    private readonly entitlements: PlanEntitlementsService,
    private readonly moduleRef: ModuleRef,
    private readonly wayl: WaylService,
    private readonly config: ConfigService,
    private readonly email: BillingEmailService,
    private readonly salesPartners: SalesPartnersService,
  ) {}

  async listPlans() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { entitlements: true },
    });

    return Promise.all(
      plans.map(async (plan, index) => {
        const limits = await this.entitlements.getPlanLimits(plan.id, plan.slug);
        const popular = plan.isRecommended || (plan.slug === 'professional' && !plans.some((p) => p.isRecommended));
        return {
          id: plan.id,
          slug: plan.slug,
          tier: PLAN_TIER[plan.slug] ?? plan.slug.toUpperCase(),
          name: plan.nameEn ?? plan.name,
          nameAr: plan.nameAr ?? plan.name,
          nameEn: plan.nameEn ?? plan.name,
          description: this.packageCopy(plan.slug, 'en')?.description ?? plan.descriptionEn ?? plan.description,
          descriptionAr: this.packageCopy(plan.slug, 'ar')?.description ?? plan.descriptionAr ?? plan.description,
          descriptionEn: this.packageCopy(plan.slug, 'en')?.description ?? plan.descriptionEn ?? plan.description,
          monthlyPriceCents: plan.priceCents,
          yearlyPriceCents: planYearlyCents(plan),
          currency: plan.currency,
          popular,
          limits,
          features: this.packageCopy(plan.slug, 'en')?.features ?? this.featureBullets(limits, 'en'),
          featuresAr: this.packageCopy(plan.slug, 'ar')?.features ?? this.featureBullets(limits, 'ar'),
          comparison: this.comparisonRow(limits),
          sortOrder: plan.sortOrder || index,
        };
      }),
    );
  }

  private packageCopy(slug: string, locale: 'ar' | 'en') {
    const key = slug.toLowerCase();
    const tier: 1 | 2 | 3 | 0 = key === 'professional' || key === 'pro' ? 2 : key === 'business' || key === 'enterprise' ? 3 : key === 'basic' || key === 'starter' ? 1 : 0;
    if (!tier) return null;
    const copy = {
      1: {
        ar: {
          description: 'رقم واتساب واحد و3 بكسلات، مع إنشاء حملات تيك توك ودعم فني.',
          features: [
            '✓ ربط رقم واتساب واحد',
            '✓ 3 بكسلات تتبع',
            '✓ إنشاء حملات احترافية على تيك توك',
            '✓ دعم فني',
          ],
        },
        en: {
          description: 'One WhatsApp number and 3 pixels, with professional TikTok campaigns and support.',
          features: [
            '✓ 1 WhatsApp number',
            '✓ 3 tracking pixels',
            '✓ Professional TikTok campaign creation',
            '✓ Customer support',
          ],
        },
      },
      2: {
        ar: {
          description: '3 أرقام واتساب و15 بكسل، مع إنشاء الإعلانات وتقييمها بالذكاء الاصطناعي.',
          features: [
            '✓ ربط 3 أرقام واتساب',
            '✓ 15 بكسل تتبع',
            '✓ إنشاء الإعلانات على تيك توك',
            '✓ تقييم الحملات بالذكاء الاصطناعي',
            '✓ دعم فني متواصل',
          ],
        },
        en: {
          description: '3 WhatsApp numbers and 15 pixels, with ad creation and AI campaign review.',
          features: [
            '✓ 3 WhatsApp numbers',
            '✓ 15 tracking pixels',
            '✓ TikTok ad creation',
            '✓ AI campaign review',
            '✓ Ongoing customer support',
          ],
        },
      },
      3: {
        ar: {
          description: '10 أرقام واتساب وبكسلات بلا حد، مع إنشاء الإعلانات وتقييمها بالذكاء الاصطناعي.',
          features: [
            '✓ ربط 10 أرقام واتساب',
            '✓ بكسلات تتبع مفتوحة',
            '✓ إنشاء الإعلانات على تيك توك',
            '✓ تقييم الحملات بالذكاء الاصطناعي',
            '✓ دعم فني ذو أولوية',
          ],
        },
        en: {
          description: '10 WhatsApp numbers and unlimited pixels, with ad creation and AI campaign review.',
          features: [
            '✓ 10 WhatsApp numbers',
            '✓ Unlimited tracking pixels',
            '✓ TikTok ad creation',
            '✓ AI campaign review',
            '✓ Priority customer support',
          ],
        },
      },
    } as const;
    return copy[tier][locale];
  }

  private featureBullets(limits: PlanLimits, locale: 'ar' | 'en') {
    const included: string[] = [];
    const excluded: string[] = [];
    for (const feature of FEATURE_REGISTRY) {
      const label = locale === 'ar' ? feature.nameAr : feature.nameEn;
      if (feature.valueType === 'BOOLEAN') {
        const on = this.boolFromLimits(limits, feature.key);
        (on ? included : excluded).push(`${on ? '✓' : '✕'} ${label}`);
      } else {
        const limit = this.limitFromLimits(limits, feature.key);
        if (limit === 0) excluded.push(`✕ ${label}`);
        else included.push(`✓ ${label}: ${formatLimitLabel(limit, locale)}`);
      }
    }
    return [...included, ...excluded];
  }

  private comparisonRow(limits: PlanLimits) {
    return FEATURE_REGISTRY.map((feature) => ({
      key: feature.key,
      category: feature.category,
      nameAr: feature.nameAr,
      nameEn: feature.nameEn,
      valueType: feature.valueType,
      enabled: feature.valueType === 'BOOLEAN' ? this.boolFromLimits(limits, feature.key) : this.limitFromLimits(limits, feature.key) !== 0,
      limit: feature.valueType === 'LIMIT' ? this.limitFromLimits(limits, feature.key) : null,
    }));
  }

  private boolFromLimits(limits: PlanLimits, key: string) {
    const map: Record<string, boolean> = {
      whatsapp_enabled: limits.whatsappEnabled,
      tiktok_integration_enabled: limits.tiktokEnabled,
      whatsapp_api_enabled: limits.whatsappApiEnabled,
      facebook_integration_enabled: limits.facebookEnabled,
      instagram_integration_enabled: limits.instagramEnabled,
      telegram_integration_enabled: limits.telegramEnabled,
      ai_reply_enabled: limits.aiEnabled,
      appointments_enabled: limits.appointmentsEnabled,
      voice_ai_enabled: limits.voiceAiEnabled,
      creative_studio_enabled: limits.creativeStudioEnabled,
      creative_4k_enabled: limits.creative4kEnabled,
    };
    return Boolean(map[key]);
  }

  private limitFromLimits(limits: PlanLimits, key: string) {
    const map: Record<string, number> = {
      maximum_whatsapp_numbers: limits.maxWhatsappNumbers,
      maximum_tiktok_whatsapp_numbers: limits.maxTiktokWhatsappNumbers,
      maximum_tiktok_pixels: limits.maxTiktokPixels,
      maximum_pixels: limits.maxPixels,
      maximum_team_members: limits.maxTeamMembers,
      voice_minutes_limit: limits.voiceMinutesLimit,
      voice_calls_limit: limits.voiceCallsLimit,
      creative_images_limit: limits.creativeImagesLimit,
      creative_video_seconds_limit: limits.creativeVideoSecondsLimit,
    };
    return map[key] ?? 0;
  }

  async getStatusForUser(userId: string | undefined, jwtTeamId: string) {
    const teamId = await this.resolveWorkspaceTeamId(userId, jwtTeamId);
    return this.getStatus(teamId);
  }

  private async resolveWorkspaceTeamId(userId: string | undefined, jwtTeamId: string) {
    if (!userId) return jwtTeamId;
    const members = await this.prisma.teamMember.findMany({
      where: { userId },
      include: { team: { include: { subscriptions: true } } },
      orderBy: { createdAt: 'asc' },
    });
    if (!members[0]) return jwtTeamId;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isLive = (sub?: { status: string; currentPeriodEnd: Date | null; trialEndsAt: Date | null }) => {
      if (!sub) return false;
      if (sub.status !== 'ACTIVE' && sub.status !== 'TRIAL') return false;
      const end = sub.currentPeriodEnd ?? sub.trialEndsAt;
      if (sub.status === 'TRIAL') return !!end && new Date(end).getTime() > Date.now();
      if (!end) return sub.status === 'ACTIVE';
      const endDay = new Date(end);
      endDay.setHours(0, 0, 0, 0);
      return endDay.getTime() >= today.getTime();
    };
    const jwtMember = members.find((member) => member.teamId === jwtTeamId);
    if (jwtMember && isLive(jwtMember.team.subscriptions[0])) return jwtTeamId;
    const active = members.find((member) => isLive(member.team.subscriptions[0]));
    return active?.teamId ?? jwtTeamId;
  }

  async getStatus(teamId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { teamId },
      include: { plan: true },
    });

    if (!subscription) {
      return {
        hasSubscription: false,
        subscriptionStatus: null,
        plan: null,
        billingCycle: null,
        trialExpired: false,
        isActive: false,
        isExpired: true,
        daysRemaining: null,
        showExpiryWarning: false,
        trialEndsAt: null,
        currentPeriodEnd: null,
        planName: null,
        planSlug: null,
        autoRenew: false,
        limits: null,
        trackingPhoneCount: 0,
        canAddTrackingPhone: false,
        whatsappInboxCount: 0,
        canAddWhatsappNumber: false,
        tiktokPixelCount: 0,
        canAddTiktokPixel: false,
        teamMemberCount: 0,
        canAddTeamMember: false,
        overLimit: {
          trackingPhones: false,
          whatsappNumbers: false,
          tiktokPixels: false,
          teamMembers: false,
        },
        isInGracePeriod: false,
        graceHoursRemaining: null,
        graceDaysRemaining: null,
        gracePurged: false,
        expiredAt: null,
        isFreeTrial: false,
        freeTrialEnded: false,
      };
    }

    if (
      subscription.status === SubscriptionStatus.TRIAL &&
      subscription.trialEndsAt &&
      subscription.trialEndsAt.getTime() <= Date.now()
    ) {
      setTimeout(() => {
        void this.moduleRef
          .get(SubscriptionExpiryService, { strict: false })
          .expireSubscriptions()
          .catch((err: unknown) => {
            this.logger.warn(`Trial expiry kick failed: ${err instanceof Error ? err.message : String(err)}`);
          });
      }, 1500);
    }

    const access = await this.access.getTeamAccess(teamId);
    const teamEntitlements = await this.entitlements.getTeamEntitlements(teamId);
    const trialExpired =
      subscription.status === SubscriptionStatus.TRIAL &&
      !!subscription.trialEndsAt &&
      subscription.trialEndsAt < new Date();

    return {
      hasSubscription: true,
      subscriptionStatus: subscription.status,
      plan: PLAN_TIER[subscription.plan.slug as PlanSlug] ?? subscription.plan.slug.toUpperCase(),
      planSlug: subscription.plan.slug,
      planName: subscription.plan.nameAr ?? subscription.plan.name,
      limits: teamEntitlements.limits,
      trackingPhoneCount: teamEntitlements.trackingPhoneCount,
      canAddTrackingPhone: teamEntitlements.canAddTrackingPhone,
      whatsappInboxCount: teamEntitlements.whatsappInboxCount,
      canAddWhatsappNumber: teamEntitlements.canAddWhatsappNumber,
      tiktokPixelCount: teamEntitlements.tiktokPixelCount,
      canAddTiktokPixel: teamEntitlements.canAddTiktokPixel,
      teamMemberCount: teamEntitlements.teamMemberCount,
      canAddTeamMember: teamEntitlements.canAddTeamMember,
      overLimit: teamEntitlements.overLimit,
      billingCycle: subscription.billingCycle,
      autoRenew: subscription.autoRenew,
      trialExpired,
      isActive: access.isActive,
      isExpired: access.isExpired,
      isInGracePeriod: access.isInGracePeriod,
      graceHoursRemaining: access.graceHoursRemaining,
      graceDaysRemaining: access.graceDaysRemaining,
      gracePurged: access.gracePurged,
      daysRemaining: access.daysRemaining,
      showExpiryWarning: access.showExpiryWarning,
      trialEndsAt: subscription.trialEndsAt,
      currentPeriodEnd: subscription.currentPeriodEnd,
      expiredAt: subscription.expiredAt,
      isFreeTrial: subscription.status === SubscriptionStatus.TRIAL && access.isActive,
      freeTrialEnded: !!subscription.trialEndsAt && !access.isActive && subscription.status !== SubscriptionStatus.ACTIVE,
    };
  }

  async checkout(
    teamId: string,
    userId: string,
    planSlug: string,
    billingCycle: BillingInterval,
    referral?: { code?: string; source?: 'CODE' | 'LINK' },
  ) {
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { slug: planSlug, isActive: true },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    if (!this.wayl.isConfigured) {
      throw new BadRequestException('بوابة الدفع غير مفعّلة. تواصل مع الدعم.');
    }

    const amountCents =
      billingCycle === BillingInterval.YEARLY ? planYearlyCents(plan) : plan.priceCents;
    const usdToIqd = resolveUsdToIqdRate(this.config.get<string>('USD_TO_IQD_RATE'));
    const waylTotal = toWaylIqd(amountCents, plan.currency, usdToIqd);
    const mrrCents = billingCycle === BillingInterval.YEARLY ? Math.round(amountCents / 12) : amountCents;

    // Reuse a fresh pending Wayl link for the same plan/cycle to avoid slow re-create.
    const recentPending = await this.prisma.payment.findFirst({
      where: {
        teamId,
        provider: 'wayl',
        status: PaymentStatus.PENDING,
        createdAt: { gte: new Date(Date.now() - 20 * 60_000) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (recentPending) {
      const meta = (recentPending.metadata ?? {}) as Record<string, unknown>;
      const waylUrl = typeof meta.waylUrl === 'string' ? meta.waylUrl : null;
      if (
        waylUrl &&
        meta.planSlug === planSlug &&
        meta.billingCycle === billingCycle &&
        recentPending.amountCents === waylTotal
      ) {
        this.logger.log(`[checkout] Reusing pending Wayl payment ${recentPending.id}`);
        return {
          subscriptionId: recentPending.subscriptionId,
          paymentId: recentPending.id,
          planSlug,
          planName: plan.name,
          billingCycle,
          amountCents: waylTotal,
          currency: 'IQD',
          checkoutPath: waylUrl,
          waylUrl,
        };
      }
    }

    const existing = await this.prisma.subscription.findUnique({ where: { teamId } });
    const trialStillOpen =
      existing?.status === SubscriptionStatus.TRIAL &&
      !!existing.trialEndsAt &&
      existing.trialEndsAt.getTime() > Date.now();
    const keepActive = existing?.status === SubscriptionStatus.ACTIVE || trialStillOpen;

    const subscription = await this.prisma.subscription.upsert({
      where: { teamId },
      create: {
        teamId,
        planId: plan.id,
        ownerUserId: userId,
        status: SubscriptionStatus.PENDING,
        billingCycle,
        mrrCents,
        autoRenew: true,
      },
      update: keepActive
        ? { ownerUserId: userId }
        : {
            planId: plan.id,
            ownerUserId: userId,
            status: SubscriptionStatus.PENDING,
            billingCycle,
            mrrCents,
            autoRenew: true,
            cancelledAt: null,
            pausedAt: null,
          },
    });

    // Don't block checkout on referral attach.
    if (referral?.code) {
      void this.salesPartners
        .attachReferral(
          teamId,
          userId,
          referral.code,
          referral.source === 'LINK' ? SalesReferralSource.LINK : SalesReferralSource.CODE,
        )
        .catch((err) =>
          this.logger.warn(
            `[checkout] referral attach failed: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
    }

    const payment = await this.prisma.payment.create({
      data: {
        subscriptionId: subscription.id,
        teamId,
        amountCents: waylTotal,
        currency: 'IQD',
        status: PaymentStatus.PENDING,
        provider: 'wayl',
        description: `${plan.name} (${billingCycle.toLowerCase()})`,
        metadata: {
          planSlug,
          billingCycle,
          planId: plan.id,
          originalAmountCents: amountCents,
          usdToIqd,
        },
      },
    });

    const referenceId = `wa-${payment.id}`.slice(0, 80);
    const apiBase = (this.config.get<string>('API_PUBLIC_URL') ?? 'https://www.chatloora.com').replace(/\/$/, '');
    const webhookUrl = `${apiBase}/api/v1/billing/webhooks/wayl`;
    const redirectionUrl = `${apiBase}/api/v1/billing/wayl-return/${payment.id}`;

    try {
      const link = await this.wayl.createLink({
        referenceId,
        total: waylTotal,
        currency: 'IQD',
        customParameter: `team:${teamId}`,
        lineItem: [
          {
            label: `${plan.name} ${billingCycle === BillingInterval.YEARLY ? 'yearly' : 'monthly'}`.slice(0, 255),
            amount: waylTotal,
            type: 'increase',
          },
        ],
        webhookUrl,
        redirectionUrl,
        linkExpiresIn: '24h',
      });

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerRef: link.referenceId,
          metadata: {
            planSlug,
            billingCycle,
            planId: plan.id,
            originalAmountCents: amountCents,
            usdToIqd,
            waylReferenceId: link.referenceId,
            waylUrl: link.url,
            waylStatus: link.status,
            waylId: link.id,
          },
        },
      });

      return {
        subscriptionId: subscription.id,
        paymentId: payment.id,
        planSlug,
        planName: plan.name,
        billingCycle,
        amountCents: waylTotal,
        currency: 'IQD',
        checkoutPath: link.url,
        waylUrl: link.url,
      };
    } catch (err) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });
      throw err;
    }
  }

  async setAutoRenew(teamId: string, enabled: boolean) {
    const subscription = await this.prisma.subscription.findUnique({ where: { teamId } });
    if (!subscription) throw new NotFoundException('Subscription not found');
    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        autoRenew: enabled,
        cancelledAt: enabled ? null : new Date(),
      },
    });
    return this.getStatus(teamId);
  }

  async startDueRenewals() {
    const now = new Date();
    const soon = new Date(now);
    soon.setDate(soon.getDate() + 3);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const subs = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        autoRenew: true,
        currentPeriodEnd: { lte: soon, gt: now },
      },
      include: { plan: true, owner: true },
    });

    let created = 0;
    for (const sub of subs) {
      const pending = await this.prisma.payment.findFirst({
        where: {
          subscriptionId: sub.id,
          status: PaymentStatus.PENDING,
          provider: 'wayl',
          createdAt: { gte: weekAgo },
        },
      });
      if (pending || !sub.ownerUserId) continue;
      try {
        const result = await this.checkout(sub.teamId, sub.ownerUserId, sub.plan.slug, sub.billingCycle);
        if (sub.owner?.email && result.waylUrl) {
          await this.email.sendRenewalEmail({
            to: sub.owner.email,
            customerName: sub.owner.name ?? sub.owner.email,
            planName: sub.plan.name,
            amountLabel: `${result.amountCents.toLocaleString('en-US')} IQD`,
            payUrl: result.waylUrl,
            periodEnd: sub.currentPeriodEnd ?? soon,
          });
        }
        created += 1;
      } catch (err) {
        this.logger.warn(
          `Renewal checkout failed team=${sub.teamId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    return { created };
  }

  async syncWaylPayment(teamId: string, paymentId: string, userId?: string) {
    const id = sanitizePaymentId(paymentId);
    const payment = await this.findAccessiblePayment(teamId, userId, id);
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === PaymentStatus.COMPLETED) return this.getStatus(payment.teamId);

    const metadata = (payment.metadata ?? {}) as Record<string, unknown>;
    const referenceId =
      payment.providerRef || (typeof metadata.waylReferenceId === 'string' ? metadata.waylReferenceId : null);
    if (!referenceId || payment.provider !== 'wayl') {
      throw new BadRequestException('هذا الدفع يجب إكماله عبر بوابة Wayl');
    }

    const link = await this.wayl.getLink(referenceId);
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        metadata: { ...metadata, waylStatus: link.status },
      },
    });

    if (isWaylPaid(link.status)) {
      return this.activatePaidPayment(payment.id);
    }
    return this.getStatus(payment.teamId);
  }

  async publicReturnUrl(paymentId: string) {
    const web = (this.config.get<string>('WEB_PUBLIC_URL') ?? 'https://www.chatloora.com').replace(/\/$/, '');
    let purpose = '';
    try {
      const id = sanitizePaymentId(paymentId);
      const payment = await this.prisma.payment.findFirst({
        where: { OR: [{ id }, { providerRef: `wa-${id}` }, { providerRef: `tt-${id}` }, { providerRef: id }] },
      });
      const metadata = (payment?.metadata ?? {}) as Record<string, unknown>;
      purpose = typeof metadata.purpose === 'string' ? metadata.purpose : '';
    } catch {
      purpose = '';
    }
    if (purpose === 'tiktok_ad_topup') {
      return `${web}/tiktok/ads/topup?paymentId=${encodeURIComponent(paymentId)}`;
    }
    return `${web}/pricing/payment?paymentId=${encodeURIComponent(paymentId)}`;
  }

  async completeWaylReturn(paymentId: string) {
    const id = sanitizePaymentId(paymentId);
    let payment = await this.prisma.payment.findFirst({
      where: { OR: [{ id }, { providerRef: `wa-${id}` }, { providerRef: id }] },
    });
    if (!payment && id.length >= 16) {
      const prefix = id.slice(0, 16);
      const matches = await this.prisma.payment.findMany({
        where: {
          OR: [{ id: { startsWith: prefix } }, { providerRef: { startsWith: `wa-${prefix}` } }],
        },
        take: 5,
      });
      if (matches.length === 1) payment = matches[0];
    }
    if (!payment) throw new NotFoundException('Payment not found');
    return this.syncWaylPayment(payment.teamId, payment.id);
  }

  async confirmPayment(teamId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, teamId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === PaymentStatus.COMPLETED) {
      return this.getStatus(teamId);
    }
    if (payment.provider === 'wayl') {
      return this.syncWaylPayment(teamId, paymentId);
    }
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Payment cannot be completed');
    }
    throw new BadRequestException('أكمل الدفع عبر بوابة Wayl');
  }

  async activatePaidPayment(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { subscription: { include: { plan: true } } },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === PaymentStatus.COMPLETED) {
      return this.getStatus(payment.teamId);
    }

    const metadata = (payment.metadata ?? {}) as Record<string, unknown>;
    if (metadata.purpose === 'tiktok_ad_topup') {
      const now = new Date();
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.COMPLETED, paidAt: now },
      });
      await this.prisma.invoice.create({
        data: {
          subscriptionId: payment.subscriptionId,
          teamId: payment.teamId,
          number: `TT-${Date.now()}-${payment.id.slice(-6)}`,
          amountCents: payment.amountCents,
          currency: payment.currency,
          status: InvoiceStatus.PAID,
          paidAt: now,
          lineItems: {
            purpose: 'tiktok_ad_topup',
            advertiserId: metadata.advertiserId ?? null,
            advertiserName: metadata.advertiserName ?? null,
            amount: metadata.amount ?? null,
            tax: metadata.tax ?? null,
            total: metadata.total ?? payment.amountCents,
          },
        },
      });
      try {
        const { TikTokAdPublishService } = await import('../integrations/tiktok-login-kit/tiktok-ad-publish.service');
        const publisher = this.moduleRef.get(TikTokAdPublishService, { strict: false });
        await publisher.creditAdvertiserTopup(payment.id);
      } catch (err) {
        this.logger.warn(`TikTok topup credit failed: ${err instanceof Error ? err.message : String(err)}`);
      }
      return this.getStatus(payment.teamId);
    }

    const planId = typeof metadata.planId === 'string' ? metadata.planId : payment.subscription.planId;
    const billingCycle =
      metadata.billingCycle === BillingInterval.YEARLY ? BillingInterval.YEARLY : payment.subscription.billingCycle;
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });

    const now = new Date();
    const periodEnd = carryOverPeriodEnd(
      now,
      planDurationDays(billingCycle),
      payment.subscription.currentPeriodEnd,
    );

    const mrrCents =
      billingCycle === BillingInterval.YEARLY ? Math.round(payment.amountCents / 12) : payment.amountCents;

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.COMPLETED, paidAt: now },
      }),
      this.prisma.subscription.update({
        where: { id: payment.subscriptionId },
        data: {
          planId,
          status: SubscriptionStatus.ACTIVE,
          billingCycle,
          mrrCents,
          autoRenew: true,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          trialEndsAt: null,
          expiredAt: null,
          gracePurgedAt: null,
          cancelledAt: null,
          pausedAt: null,
        },
      }),
      this.prisma.invoice.create({
        data: {
          subscriptionId: payment.subscriptionId,
          teamId: payment.teamId,
          number: `INV-${Date.now()}-${payment.id.slice(-6)}`,
          amountCents: payment.amountCents,
          currency: payment.currency,
          status: InvoiceStatus.PAID,
          paidAt: now,
          lineItems: {
            plan: plan?.slug ?? payment.subscription.plan.slug,
            billingCycle,
          },
        },
      }),
    ]);

    await this.access.restoreTeamIntegrations(payment.teamId);
    this.emitPurchase(payment.teamId, payment.id, payment.amountCents, payment.currency);
    await this.sendInvoiceEmail(payment.teamId, payment.id, payment.subscriptionId, now, periodEnd, payment.amountCents, payment.currency);
    await this.salesPartners.creditFromPayment(payment.id).catch((err) => {
      this.logger.warn(`Sales commission skipped: ${err instanceof Error ? err.message : String(err)}`);
    });
    void this.notifyOfficialWhatsApp(payment.subscriptionId);
    return this.getStatus(payment.teamId);
  }

  private notifyOfficialWhatsApp(subscriptionId: string) {
    try {
      const svc = this.moduleRef.get(OfficialWhatsAppNotificationService, { strict: false });
      void svc.notifyPayment(subscriptionId, OfficialNotificationType.PAYMENT_SUCCESSFUL).catch((err: unknown) => {
        this.logger.warn(`Official WhatsApp payment notice skipped: ${err instanceof Error ? err.message : String(err)}`);
      });
      void svc.notifyPayment(subscriptionId, OfficialNotificationType.SUBSCRIPTION_ACTIVATED).catch((err: unknown) => {
        this.logger.warn(`Official WhatsApp activation notice skipped: ${err instanceof Error ? err.message : String(err)}`);
      });
    } catch (err) {
      this.logger.debug(
        `Official WhatsApp notice skipped: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private emitPurchase(teamId: string, paymentId: string, amountCents: number, currency: string) {
    try {
      const lifecycle = this.moduleRef.get(TikTokLifecycleEventsService, { strict: false });
      void lifecycle
        .sendPurchase({ teamId, paymentId, amountCents, currency })
        .catch((err) =>
          this.logger.warn(
            `Purchase event failed: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
    } catch (err) {
      this.logger.debug(
        `Purchase skipped (lifecycle unavailable): ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async findAccessiblePayment(teamId: string, userId: string | undefined, id: string) {
    const include = { subscription: { include: { plan: true } } } as const;
    let payment = await this.prisma.payment.findFirst({
      where: {
        OR: [{ id }, { providerRef: `wa-${id}` }, { providerRef: id }],
      },
      include,
    });
    if (!payment && id.length >= 16) {
      const prefix = id.slice(0, 16);
      const matches = await this.prisma.payment.findMany({
        where: {
          OR: [{ id: { startsWith: prefix } }, { providerRef: { startsWith: `wa-${prefix}` } }],
        },
        include,
        take: 5,
      });
      if (matches.length === 1) payment = matches[0];
    }
    if (!payment) return null;
    if (payment.teamId === teamId) return payment;
    if (!userId) return null;
    const member = await this.prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: payment.teamId, userId } },
    });
    return member ? payment : null;
  }

  async getPayment(teamId: string, paymentId: string, userId?: string) {
    const id = sanitizePaymentId(paymentId);
    const payment = await this.findAccessiblePayment(teamId, userId, id);
    if (!payment) throw new NotFoundException('Payment not found');

    const metadata = (payment.metadata ?? {}) as Record<string, unknown>;

    return {
      id: payment.id,
      status: payment.status,
      amountCents: payment.amountCents,
      currency: payment.currency,
      description: payment.description,
      planName: payment.subscription.plan.name,
      planSlug: payment.subscription.plan.slug,
      billingCycle: payment.subscription.billingCycle,
      provider: payment.provider,
      waylUrl: typeof metadata.waylUrl === 'string' ? metadata.waylUrl : null,
      waylStatus: typeof metadata.waylStatus === 'string' ? metadata.waylStatus : null,
    };
  }

  /**
   * Handle a Wayl webhook event (payment status change).
   * Called by the webhook controller after signature verification.
   */
  async handleWaylWebhook(payload: WaylWebhookPayload) {
    const { referenceId, event, paymentStatus } = payload;

    this.logger.log(`Wayl webhook: event=${event} referenceId=${referenceId} status=${paymentStatus}`);

    // Find the payment by its Wayl reference ID stored in metadata
    const payment = await this.prisma.payment.findFirst({
      where: {
        provider: 'wayl',
        OR: [
          { providerRef: referenceId },
          {
            metadata: {
              path: ['waylReferenceId'],
              equals: referenceId,
            },
          },
        ],
      },
    });

    if (!payment) {
      this.logger.warn(`Wayl webhook: no payment found for referenceId=${referenceId}`);
      return { received: true, matched: false };
    }

    if (payment.status === PaymentStatus.COMPLETED) {
      return { received: true, matched: true, alreadyCompleted: true };
    }

    let confirmedStatus: string | null = null;
    try {
      const link = await this.wayl.getLink(referenceId);
      confirmedStatus = link.status;
    } catch (err) {
      this.logger.warn(
        `Wayl webhook getLink failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { received: true, matched: true, pendingConfirmation: true };
    }

    const isComplete = isWaylPaid(confirmedStatus, event);

    if (!isComplete) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          metadata: {
            ...(payment.metadata as Record<string, unknown>),
            waylStatus: confirmedStatus,
            waylEvent: event,
          },
        },
      });
      return { received: true, matched: true, completed: false };
    }

    await this.activatePaidPayment(payment.id);
    return { received: true, matched: true, completed: true };
  }

  /**
   * Send a payment invoice email to the team owner after a successful payment.
   */
  private async sendInvoiceEmail(
    teamId: string,
    paymentId: string,
    subscriptionId: string,
    paidAt: Date,
    periodEnd: Date,
    amountCents?: number,
    currency?: string,
  ) {
    try {
      const team = await this.prisma.team.findUnique({
        where: { id: teamId },
        include: {
          members: {
            include: { user: true },
            where: { role: 'OWNER' },
            take: 1,
          },
          subscriptions: {
            where: { id: subscriptionId },
            include: { plan: true },
            take: 1,
          },
        },
      });

      const owner = team?.members[0]?.user;
      const subscription = team?.subscriptions[0];
      if (!owner || !subscription) {
        this.logger.warn(`Invoice email skipped: no owner or subscription for team=${teamId}`);
        return;
      }

      const invoice = await this.prisma.invoice.findFirst({
        where: { subscriptionId },
        orderBy: { createdAt: 'desc' },
      });

      await this.email.sendInvoiceEmail({
        to: owner.email,
        customerName: owner.name,
        invoiceNumber: invoice?.number ?? `INV-${Date.now()}`,
        planName: subscription.plan.name,
        billingCycle: subscription.billingCycle,
        amountCents: amountCents ?? invoice?.amountCents ?? subscription.mrrCents,
        currency: currency ?? invoice?.currency ?? subscription.plan.currency,
        paidAt,
        periodStart: subscription.currentPeriodStart ?? paidAt,
        periodEnd,
        paymentMethod: 'Wayl',
      });
    } catch (err) {
      this.logger.warn(
        `Invoice email failed for team=${teamId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
