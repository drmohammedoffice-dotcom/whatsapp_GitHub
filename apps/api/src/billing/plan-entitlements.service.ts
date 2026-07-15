import { ForbiddenException, Injectable } from '@nestjs/common';
import { ChannelProvider } from '@watsapp/database';
import { isTrackingChannel } from '../channels/channel-purpose';
import { PrismaService } from '../prisma/prisma.service';
import { GRACE_PERIOD_MS, type PlanLimits, type PlanSlug, planLimitsForSlug, resolvePlanSlug } from './plan-limits';

export type PlanFeature = 'tracking_phone' | 'social_integrations' | 'ai';

export type TeamEntitlements = {
  planSlug: PlanSlug;
  planName: string | null;
  limits: PlanLimits;
  trackingPhoneCount: number;
  canAddTrackingPhone: boolean;
};

@Injectable()
export class PlanEntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTeamEntitlements(teamId: string): Promise<TeamEntitlements> {
    const subscription = await this.prisma.subscription.findUnique({
      where: { teamId },
      include: { plan: true },
    });
    const planSlug = resolvePlanSlug(subscription?.plan.slug);
    const limits = planLimitsForSlug(planSlug);
    const trackingPhoneCount = await this.countTrackingPhones(teamId);

    return {
      planSlug,
      planName: subscription?.plan.name ?? null,
      limits,
      trackingPhoneCount,
      canAddTrackingPhone: trackingPhoneCount < limits.maxTrackingPhones,
    };
  }

  async countTrackingPhones(teamId: string): Promise<number> {
    const channels = await this.prisma.channel.findMany({
      where: { teamId, provider: ChannelProvider.WHATSAPP_BAILEYS },
      select: { metadata: true, whatsAppSessionId: true },
    });
    return channels.filter((row) => isTrackingChannel(row.metadata) && row.whatsAppSessionId).length;
  }

  planUpgradeError(feature: PlanFeature, entitlements: TeamEntitlements) {
    const messages: Record<PlanFeature, string> = {
      tracking_phone: `Your ${entitlements.planName ?? 'current'} plan allows ${entitlements.limits.maxTrackingPhones} WhatsApp number(s) for TikTok pixels. Upgrade your subscription to connect more numbers.`,
      social_integrations:
        'Social channel integrations (WhatsApp inbox, Instagram, Facebook Messenger, Telegram) require a Professional or Business plan. Upgrade via WhatsApp to unlock.',
      ai: 'AI smart replies and automation require a Professional or Business plan. Upgrade via WhatsApp to unlock.',
    };

    return new ForbiddenException({
      message: messages[feature],
      code: 'PLAN_UPGRADE_REQUIRED',
      feature,
      planSlug: entitlements.planSlug,
      limits: entitlements.limits,
    });
  }

  async assertTrackingPhoneConnect(teamId: string) {
    const entitlements = await this.getTeamEntitlements(teamId);
    if (!entitlements.canAddTrackingPhone) {
      throw this.planUpgradeError('tracking_phone', entitlements);
    }
    return entitlements;
  }

  async assertSocialIntegrations(teamId: string) {
    const entitlements = await this.getTeamEntitlements(teamId);
    if (!entitlements.limits.socialIntegrations) {
      throw this.planUpgradeError('social_integrations', entitlements);
    }
    return entitlements;
  }

  async assertAiEnabled(teamId: string) {
    const entitlements = await this.getTeamEntitlements(teamId);
    if (!entitlements.limits.aiEnabled) {
      throw this.planUpgradeError('ai', entitlements);
    }
    return entitlements;
  }

  graceDeadline(expiredAt: Date | null | undefined): Date | null {
    if (!expiredAt) return null;
    return new Date(expiredAt.getTime() + GRACE_PERIOD_MS);
  }

  graceHoursRemaining(expiredAt: Date | null | undefined, now = new Date()): number | null {
    const deadline = this.graceDeadline(expiredAt);
    if (!deadline) return null;
    const ms = deadline.getTime() - now.getTime();
    if (ms <= 0) return 0;
    return Math.ceil(ms / (60 * 60 * 1000));
  }

  isWithinGracePeriod(expiredAt: Date | null | undefined, gracePurgedAt: Date | null | undefined, now = new Date()) {
    if (!expiredAt || gracePurgedAt) return false;
    const deadline = this.graceDeadline(expiredAt);
    return !!deadline && now < deadline;
  }
}
