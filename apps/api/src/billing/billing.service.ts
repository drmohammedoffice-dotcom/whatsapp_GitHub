import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { BillingInterval, InvoiceStatus, PaymentStatus, SubscriptionStatus } from '@watsapp/database';
import { PrismaService } from '../prisma/prisma.service';
import type { PlanSlug } from './dto/billing.dto';
import { BillingAccessService } from './billing-access.service';
import { PlanEntitlementsService } from './plan-entitlements.service';
import { TikTokLifecycleEventsService } from '../tiktok-integration/tiktok-lifecycle-events.service';
import { WaylService, type WaylWebhookPayload } from './wayl.service';
import { ConfigService } from '@nestjs/config';

const PLAN_TIER: Record<string, string> = {
  basic: 'BASIC',
  professional: 'PROFESSIONAL',
  business: 'BUSINESS',
};

function planYearlyCents(plan: { priceCents: number; yearlyPriceCents: number | null }) {
  return plan.yearlyPriceCents ?? Math.round(plan.priceCents * 12 * 0.8);
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
  ) {}

  async listPlans() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    return plans.map((plan, index) => {
      const slug = plan.slug;
      const features = Array.isArray(plan.features) ? (plan.features as string[]) : [];
      const popular =
        slug === 'professional' ||
        (plans.length > 1 && index === Math.floor(plans.length / 2) && !plans.some((p) => p.slug === 'professional'));
      return {
        id: plan.id,
        slug,
        tier: PLAN_TIER[slug] ?? slug.toUpperCase(),
        name: plan.name,
        description: plan.description,
        monthlyPriceCents: plan.priceCents,
        yearlyPriceCents: planYearlyCents(plan),
        currency: plan.currency,
        features,
        popular,
      };
    });
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
        limits: null,
        trackingPhoneCount: 0,
        canAddTrackingPhone: false,
        isInGracePeriod: false,
        graceHoursRemaining: null,
        graceDaysRemaining: null,
        gracePurged: false,
        expiredAt: null,
      };
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
      planName: subscription.plan.name,
      limits: teamEntitlements.limits,
      trackingPhoneCount: teamEntitlements.trackingPhoneCount,
      canAddTrackingPhone: teamEntitlements.canAddTrackingPhone,
      billingCycle: subscription.billingCycle,
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
    };
  }

  async checkout(teamId: string, userId: string, planSlug: string, billingCycle: BillingInterval) {
    const plan = await this.prisma.subscriptionPlan.findFirst({
      where: { slug: planSlug, isActive: true },
    });
    if (!plan) throw new NotFoundException('Plan not found');

    const amountCents =
      billingCycle === BillingInterval.YEARLY ? planYearlyCents(plan) : plan.priceCents;

    const mrrCents = billingCycle === BillingInterval.YEARLY ? Math.round(amountCents / 12) : amountCents;

    const subscription = await this.prisma.subscription.upsert({
      where: { teamId },
      create: {
        teamId,
        planId: plan.id,
        ownerUserId: userId,
        status: SubscriptionStatus.PENDING,
        billingCycle,
        mrrCents,
      },
      update: {
        planId: plan.id,
        ownerUserId: userId,
        status: SubscriptionStatus.PENDING,
        billingCycle,
        mrrCents,
        cancelledAt: null,
        pausedAt: null,
      },
    });

    const payment = await this.prisma.payment.create({
      data: {
        subscriptionId: subscription.id,
        teamId,
        amountCents,
        currency: plan.currency,
        status: PaymentStatus.PENDING,
        provider: 'mock',
        description: `${plan.name} (${billingCycle.toLowerCase()})`,
        metadata: { planSlug, billingCycle },
      },
    });

    const referenceId = `wa-${subscription.id}-${Date.now()}`;
    const webhookUrl = `${this.config.get<string>('API_PUBLIC_URL')}/api/v1/billing/webhooks/wayl`;
    const redirectionUrl = `${this.config.get<string>('WEB_PUBLIC_URL')}/pricing/payment?paymentId=${payment.id}`;

    let waylLink: { url: string; referenceId: string; status: string } | null = null;
    let provider = 'mock';

    if (this.wayl.isConfigured) {
      try {
        const link = await this.wayl.createLink({
          referenceId,
          total: amountCents,
          currency: plan.currency,
          customParameter: `team:${teamId}`,
          lineItem: [
            {
              label: `${plan.name} (${billingCycle.toLowerCase()})`,
              amount: amountCents,
              type: 'increase',
            },
          ],
          webhookUrl,
          redirectionUrl,
          linkExpiresIn: '24h',
        });
        waylLink = { url: link.url, referenceId: link.referenceId, status: link.status };
        provider = 'wayl';

        // Update payment with Wayl metadata
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            provider,
            metadata: {
              planSlug,
              billingCycle,
              waylReferenceId: waylLink.referenceId,
              waylUrl: waylLink.url,
              waylStatus: waylLink.status,
            },
          },
        });
      } catch (err) {
        this.logger.warn(
          `Wayl checkout failed, falling back to mock: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return {
      subscriptionId: subscription.id,
      paymentId: payment.id,
      planSlug,
      planName: plan.name,
      billingCycle,
      amountCents,
      currency: plan.currency,
      checkoutPath: waylLink?.url ?? `/pricing/payment?paymentId=${payment.id}`,
      waylUrl: waylLink?.url ?? null,
    };
  }

  async confirmPayment(teamId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, teamId },
      include: { subscription: { include: { plan: true } } },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === PaymentStatus.COMPLETED) {
      return this.getStatus(teamId);
    }
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Payment cannot be completed');
    }

    const now = new Date();
    const periodEnd = new Date(now);
    if (payment.subscription.billingCycle === BillingInterval.YEARLY) {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.COMPLETED, paidAt: now },
      }),
      this.prisma.subscription.update({
        where: { id: payment.subscriptionId },
        data: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          trialEndsAt: null,
          expiredAt: null,
          gracePurgedAt: null,
        },
      }),
      this.prisma.invoice.create({
        data: {
          subscriptionId: payment.subscriptionId,
          teamId,
          number: `INV-${Date.now()}-${payment.id.slice(-6)}`,
          amountCents: payment.amountCents,
          currency: payment.currency,
          status: InvoiceStatus.PAID,
          paidAt: now,
          lineItems: {
            plan: payment.subscription.plan.slug,
            billingCycle: payment.subscription.billingCycle,
          },
        },
      }),
    ]);

    await this.access.restoreTeamIntegrations(teamId);

    this.emitPurchase(teamId, payment.id, payment.amountCents, payment.currency);

    return this.getStatus(teamId);
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

  async getPayment(teamId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, teamId },
      include: { subscription: { include: { plan: true } } },
    });
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
    const { referenceId, event, paymentStatus, total } = payload;

    this.logger.log(`Wayl webhook: event=${event} referenceId=${referenceId} status=${paymentStatus}`);

    // Find the payment by its Wayl reference ID stored in metadata
    const payment = await this.prisma.payment.findFirst({
      where: {
        provider: 'wayl',
        metadata: {
          path: ['waylReferenceId'],
          equals: referenceId,
        },
      },
      include: { subscription: { include: { plan: true } } },
    });

    if (!payment) {
      this.logger.warn(`Wayl webhook: no payment found for referenceId=${referenceId}`);
      return { received: true, matched: false };
    }

    // If already completed, ignore duplicate events
    if (payment.status === PaymentStatus.COMPLETED) {
      return { received: true, matched: true, alreadyCompleted: true };
    }

    // Only complete when Wayl reports the order as Complete
    const isComplete =
      paymentStatus === 'Complete' ||
      paymentStatus === 'Delivered' ||
      event === 'order.completed' ||
      event === 'order.delivered';

    if (!isComplete) {
      // Update metadata with latest Wayl status
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          metadata: {
            ...(payment.metadata as Record<string, unknown>),
            waylStatus: paymentStatus,
            waylEvent: event,
          },
        },
      });
      return { received: true, matched: true, completed: false };
    }

    // Verify amount matches
    if (total !== payment.amountCents) {
      this.logger.warn(
        `Wayl webhook: amount mismatch for referenceId=${referenceId} expected=${payment.amountCents} got=${total}`,
      );
      return { received: true, matched: true, amountMismatch: true };
    }

    // Complete the payment and activate the subscription
    const now = new Date();
    const periodEnd = new Date(now);
    if (payment.subscription.billingCycle === BillingInterval.YEARLY) {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    await this.prisma.$transaction([
      this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.COMPLETED,
          paidAt: now,
          metadata: {
            ...(payment.metadata as Record<string, unknown>),
            waylStatus: paymentStatus,
            waylEvent: event,
            waylOrderId: payload.id,
            waylPaymentMethod: payload.paymentMethod,
            waylCustomer: payload.customer,
          },
        },
      }),
      this.prisma.subscription.update({
        where: { id: payment.subscriptionId },
        data: {
          status: SubscriptionStatus.ACTIVE,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          trialEndsAt: null,
          expiredAt: null,
          gracePurgedAt: null,
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
            plan: payment.subscription.plan.slug,
            billingCycle: payment.subscription.billingCycle,
          },
        },
      }),
    ]);

    await this.access.restoreTeamIntegrations(payment.teamId);

    this.emitPurchase(payment.teamId, payment.id, payment.amountCents, payment.currency);

    return { received: true, matched: true, completed: true };
  }
}
