import { Injectable } from '@nestjs/common';
import { ChannelPurpose, ChannelProvider } from '@watsapp/database';
import { PlanEntitlementsService } from '../billing/plan-entitlements.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AssistantContextService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlements: PlanEntitlementsService,
  ) {}

  async snapshot(teamId: string) {
    const [entitlements, subscription, channels, tiktok, aiSettings] = await Promise.all([
      this.entitlements.getTeamEntitlements(teamId),
      this.prisma.subscription.findUnique({
        where: { teamId },
        include: { plan: true },
      }),
      this.prisma.channel.findMany({
        where: { teamId },
        select: {
          id: true,
          name: true,
          provider: true,
          purpose: true,
          status: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 40,
      }),
      this.prisma.tikTokIntegration.findMany({
        where: { teamId },
        select: {
          name: true,
          pixelName: true,
          pixelStatus: true,
          pixelStatusMessage: true,
          eventsApiStatus: true,
          wizardCompleted: true,
          wizardStep: true,
          billingSuspended: true,
        },
        take: 20,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.aiSettings.findMany({
        where: { teamId },
        select: { platform: true, enabled: true, autoReplyEnabled: true },
        take: 12,
      }),
    ]);

    const providerLabel = (provider: ChannelProvider) => {
      if (provider === ChannelProvider.WHATSAPP_BAILEYS) return 'whatsapp';
      if (provider === ChannelProvider.WHATSAPP_CLOUD) return 'whatsapp_api';
      if (provider === ChannelProvider.META_MESSENGER) return 'facebook';
      if (provider === ChannelProvider.META_INSTAGRAM) return 'instagram';
      if (provider === ChannelProvider.TELEGRAM || provider === ChannelProvider.TELEGRAM_USER) return 'telegram';
      return String(provider).toLowerCase();
    };

    return {
      plan: {
        name: subscription?.plan.nameAr ?? subscription?.plan.name ?? entitlements.planName,
        slug: entitlements.planSlug,
        status: subscription?.status ?? null,
        billingCycle: subscription?.billingCycle ?? null,
        currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
        trialEndsAt: subscription?.trialEndsAt?.toISOString() ?? null,
      },
      limits: entitlements.limits,
      usage: {
        whatsappInbox: entitlements.whatsappInboxCount,
        tiktokWhatsapp: entitlements.trackingPhoneCount,
        tiktokPixels: entitlements.tiktokPixelCount,
        teamMembers: entitlements.teamMemberCount,
        overLimit: entitlements.overLimit,
      },
      features: {
        whatsapp: entitlements.limits.whatsappEnabled,
        whatsappApi: entitlements.limits.whatsappApiEnabled,
        tiktok: entitlements.limits.tiktokEnabled,
        facebook: entitlements.limits.facebookEnabled,
        instagram: entitlements.limits.instagramEnabled,
        telegram: entitlements.limits.telegramEnabled,
        ai: entitlements.limits.aiEnabled,
        appointments: entitlements.limits.appointmentsEnabled,
        voiceAi: entitlements.limits.voiceAiEnabled,
      },
      channels: channels.map((channel) => ({
        name: channel.name,
        type: providerLabel(channel.provider),
        purpose: channel.purpose === ChannelPurpose.TRACKING ? 'tracking' : 'inbox',
        status: channel.status,
      })),
      tiktok: tiktok.map((row) => ({
        name: row.name ?? row.pixelName,
        pixelStatus: row.pixelStatus,
        pixelNote: row.pixelStatusMessage,
        eventsApiStatus: row.eventsApiStatus,
        wizardCompleted: row.wizardCompleted,
        wizardStep: row.wizardStep,
        billingSuspended: row.billingSuspended,
      })),
      aiSettings: aiSettings.map((row) => ({
        platform: row.platform,
        enabled: row.enabled,
        autoReplyEnabled: row.autoReplyEnabled,
      })),
    };
  }
}
