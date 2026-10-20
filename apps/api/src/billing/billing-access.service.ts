import { Injectable, Logger } from '@nestjs/common';

import { ModuleRef } from '@nestjs/core';

import { SubscriptionStatus } from '@watsapp/database';

import { PrismaService } from '../prisma/prisma.service';

import type { PlanLimits, PlanSlug } from './plan-limits';

import { PlanEntitlementsService } from './plan-entitlements.service';

import { FreeTrialService } from './free-trial.service';



export type SubscriptionAccess = {

  hasSubscription: boolean;

  subscriptionStatus: SubscriptionStatus | null;

  planSlug: PlanSlug | null;

  limits: PlanLimits | null;

  isActive: boolean;

  isExpired: boolean;

  isInGracePeriod: boolean;

  graceHoursRemaining: number | null;

  graceDaysRemaining: number | null;

  gracePurged: boolean;

  daysRemaining: number | null;

  showExpiryWarning: boolean;

  currentPeriodEnd: Date | null;

  expiredAt: Date | null;

  billingCycle: string | null;

  planName: string | null;

};



@Injectable()

export class BillingAccessService {

  private readonly logger = new Logger(BillingAccessService.name);

  constructor(

    private readonly prisma: PrismaService,

    private readonly entitlements: PlanEntitlementsService,

    private readonly moduleRef: ModuleRef,

  ) {}



  static daysRemaining(endDate: Date | string | null | undefined, now = new Date()): number | null {

    if (!endDate) return null;

    const end = endDate instanceof Date ? endDate : new Date(endDate);

    if (Number.isNaN(end.getTime())) return null;

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const startOfEnd = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    return Math.round((startOfEnd.getTime() - startOfToday.getTime()) / 86_400_000);

  }



  static hasAccess(status: SubscriptionStatus, periodEnd: Date | null, now = new Date()): boolean {

    if (status !== SubscriptionStatus.ACTIVE && status !== SubscriptionStatus.TRIAL) return false;

    if (!periodEnd) return status === SubscriptionStatus.ACTIVE;

    if (status === SubscriptionStatus.TRIAL) return periodEnd.getTime() > now.getTime();

    const days = BillingAccessService.daysRemaining(periodEnd, now);

    return days !== null && days >= 0;

  }



  async getTeamAccess(teamId: string): Promise<SubscriptionAccess> {

    const subscription = await this.prisma.subscription.findUnique({

      where: { teamId },

      include: { plan: true },

    });



    if (!subscription) {

      return {

        hasSubscription: false,

        subscriptionStatus: null,

        planSlug: null,

        limits: null,

        isActive: false,

        isExpired: true,

        isInGracePeriod: false,

        graceHoursRemaining: null,

        graceDaysRemaining: null,

        gracePurged: false,

        daysRemaining: null,

        showExpiryWarning: false,

        currentPeriodEnd: null,

        expiredAt: null,

        billingCycle: null,

        planName: null,

      };

    }



    const periodEnd = subscription.currentPeriodEnd ?? subscription.trialEndsAt;

    const daysRemaining = BillingAccessService.daysRemaining(periodEnd);

    const trialEndedNow =

      subscription.status === SubscriptionStatus.TRIAL && !!periodEnd && periodEnd.getTime() <= Date.now();

    const isExpired =

      subscription.status === SubscriptionStatus.EXPIRED ||

      subscription.status === SubscriptionStatus.CANCELLED ||

      trialEndedNow ||

      (subscription.status !== SubscriptionStatus.TRIAL && daysRemaining !== null && daysRemaining < 0);

    const isActive = BillingAccessService.hasAccess(subscription.status, periodEnd);

    const teamEntitlements = await this.entitlements.getTeamEntitlements(teamId);

    const isInGracePeriod = this.entitlements.isWithinGracePeriod(

      subscription.expiredAt,

      subscription.gracePurgedAt,

    );



    return {

      hasSubscription: true,

      subscriptionStatus: subscription.status,

      planSlug: teamEntitlements.planSlug,

      limits: teamEntitlements.limits,

      isActive,

      isExpired,

      isInGracePeriod,

      graceHoursRemaining: isInGracePeriod

        ? this.entitlements.graceHoursRemaining(subscription.expiredAt)

        : null,

      graceDaysRemaining: isInGracePeriod

        ? this.entitlements.graceDaysRemaining(subscription.expiredAt)

        : null,

      gracePurged: !!subscription.gracePurgedAt,

      daysRemaining,

      showExpiryWarning:

        isActive &&

        (subscription.status === SubscriptionStatus.TRIAL

          ? !!periodEnd && periodEnd.getTime() - Date.now() <= 24 * 60 * 60 * 1000

          : daysRemaining !== null && daysRemaining <= 3),

      currentPeriodEnd: periodEnd,

      expiredAt: subscription.expiredAt,

      billingCycle: subscription.billingCycle,

      planName: subscription.plan.name,

    };

  }



  async assertTeamAccess(teamId: string) {

    const access = await this.getTeamAccess(teamId);

    if (!access.isActive) {

      return { allowed: false as const, access };

    }

    return { allowed: true as const, access };

  }



  async suspendTeamIntegrations(teamId: string) {

    await this.prisma.tikTokIntegration.updateMany({

      where: { teamId, billingSuspended: false },

      data: { billingSuspended: true },

    });

    await this.withTrial((trial) => trial.pauseTeamCampaigns(teamId));

  }



  async restoreTeamIntegrations(teamId: string) {

    await this.prisma.tikTokIntegration.updateMany({

      where: { teamId, billingSuspended: true },

      data: { billingSuspended: false },

    });

    await this.withTrial((trial) => trial.resumePausedCampaigns(teamId));

  }

  private async withTrial(run: (trial: FreeTrialService) => Promise<void>) {

    try {

      const trial = this.moduleRef.get(FreeTrialService, { strict: false });

      if (trial) await run(trial);

    } catch (err) {

      this.logger.warn(`Trial campaign sync skipped: ${err instanceof Error ? err.message : String(err)}`);

    }

  }

}

