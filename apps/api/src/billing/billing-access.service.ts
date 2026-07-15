import { Injectable } from '@nestjs/common';

import { SubscriptionStatus } from '@watsapp/database';

import { PrismaService } from '../prisma/prisma.service';

import type { PlanLimits, PlanSlug } from './plan-limits';

import { PlanEntitlementsService } from './plan-entitlements.service';



export type SubscriptionAccess = {

  hasSubscription: boolean;

  subscriptionStatus: SubscriptionStatus | null;

  planSlug: PlanSlug | null;

  limits: PlanLimits | null;

  isActive: boolean;

  isExpired: boolean;

  isInGracePeriod: boolean;

  graceHoursRemaining: number | null;

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

  constructor(

    private readonly prisma: PrismaService,

    private readonly entitlements: PlanEntitlementsService,

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

    const isExpired =

      subscription.status === SubscriptionStatus.EXPIRED ||

      subscription.status === SubscriptionStatus.CANCELLED ||

      (daysRemaining !== null && daysRemaining < 0);

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

      gracePurged: !!subscription.gracePurgedAt,

      daysRemaining,

      showExpiryWarning: isActive && daysRemaining !== null && daysRemaining <= 3,

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

  }



  async restoreTeamIntegrations(teamId: string) {

    await this.prisma.tikTokIntegration.updateMany({

      where: { teamId, billingSuspended: true },

      data: { billingSuspended: false },

    });

  }

}

