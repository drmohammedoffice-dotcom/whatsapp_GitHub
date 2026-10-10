import { Injectable, Logger } from '@nestjs/common';
import { BillingInterval, SubscriptionStatus } from '@watsapp/database';
import { PrismaService } from '../prisma/prisma.service';
import { BillingAccessService } from './billing-access.service';

const MONTHLY_DAYS = 30;

export type ActivateByEmailResult =
  | {
      ok: true;
      teamId: string;
      userId: string;
      planId: string;
      planSlug: string;
      planName: string;
      periodEnd: Date;
    }
  | {
      ok: false;
      reason: 'USER_NOT_FOUND' | 'NO_TEAM' | 'PLAN_NOT_FOUND';
    };

/**
 * Activates a workspace subscription the same way admin "Activate" does,
 * looking up the registrant by the email they used to sign up.
 */
@Injectable()
export class SubscriptionActivationService {
  private readonly logger = new Logger(SubscriptionActivationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly billingAccess: BillingAccessService,
  ) {}

  /** AI package key → SubscriptionPlan.slug */
  static planSlugFromPackageKey(key: 'basic' | 'pro' | 'business'): string {
    if (key === 'pro') return 'professional';
    return key;
  }

  async activateByEmail(
    email: string,
    planSlug: string,
    options?: { durationDays?: number; billingCycle?: BillingInterval; source?: string },
  ): Promise<ActivateByEmailResult> {
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalized },
      include: {
        teamMembers: { orderBy: { createdAt: 'asc' }, take: 1, select: { teamId: true } },
      },
    });
    if (!user) return { ok: false, reason: 'USER_NOT_FOUND' };
    const teamId = user.teamMembers[0]?.teamId;
    if (!teamId) return { ok: false, reason: 'NO_TEAM' };

    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { slug: planSlug } });
    if (!plan) return { ok: false, reason: 'PLAN_NOT_FOUND' };

    const billingCycle = options?.billingCycle ?? plan.interval ?? BillingInterval.MONTHLY;
    const yearlyCents = plan.yearlyPriceCents ?? Math.round(plan.priceCents * 12 * 0.8);
    const mrrCents =
      billingCycle === BillingInterval.YEARLY
        ? Math.round(yearlyCents / 12)
        : plan.priceCents;
    const now = new Date();
    const periodEnd = new Date(now);
    const days = options?.durationDays && options.durationDays > 0 ? options.durationDays : MONTHLY_DAYS;
    periodEnd.setDate(periodEnd.getDate() + days);

    const sub = await this.prisma.subscription.upsert({
      where: { teamId },
      create: {
        teamId,
        planId: plan.id,
        ownerUserId: user.id,
        status: SubscriptionStatus.ACTIVE,
        billingCycle,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        expiredAt: null,
        gracePurgedAt: null,
        mrrCents,
      },
      update: {
        planId: plan.id,
        ownerUserId: user.id,
        status: SubscriptionStatus.ACTIVE,
        billingCycle,
        pausedAt: null,
        cancelledAt: null,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        expiredAt: null,
        gracePurgedAt: null,
        mrrCents,
      },
    });

    await this.billingAccess.restoreTeamIntegrations(teamId);
    this.logger.log(
      `[Billing] Activated plan=${plan.slug} teamId=${teamId} email=${normalized} sub=${sub.id} source=${options?.source ?? 'manual'}`,
    );

    return {
      ok: true,
      teamId,
      userId: user.id,
      planId: plan.id,
      planSlug: plan.slug,
      planName: plan.name,
      periodEnd,
    };
  }
}
