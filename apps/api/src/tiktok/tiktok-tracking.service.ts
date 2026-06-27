import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TikTokEventType } from '@watsapp/database';
import { PrismaService } from '../prisma/prisma.service';
import { TIKTOK_TRACKING_REF_PREFIX, TIKTOK_TRACKING_REF_SUFFIX } from './tiktok.constants';
import { TikTokEventsService } from './tiktok-events.service';
import { TikTokLogService } from './tiktok-log.service';

export type TrackingClickInput = {
  teamId: string;
  campaignId: string;
  ttclid?: string | null;
  source?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  referrer?: string | null;
  landingUrl?: string | null;
};

@Injectable()
export class TikTokTrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly events: TikTokEventsService,
    private readonly logs: TikTokLogService,
  ) {}

  async resolveTeam(workspaceId: string) {
    const team =
      (await this.prisma.team.findUnique({ where: { id: workspaceId } })) ??
      (await this.prisma.team.findUnique({ where: { slug: workspaceId } }));
    if (!team) throw new NotFoundException('Workspace not found');
    return team;
  }

  async resolveCampaign(teamId: string, campaignId: string) {
    const campaign =
      (await this.prisma.tikTokCampaign.findFirst({ where: { id: campaignId, teamId } })) ??
      (await this.prisma.tikTokCampaign.findFirst({
        where: { teamId, externalCampaignId: campaignId },
      }));
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async handleClick(input: TrackingClickInput) {
    const campaign = await this.resolveCampaign(input.teamId, input.campaignId);
    const click = await this.prisma.tikTokTrackingClick.create({
      data: {
        teamId: input.teamId,
        campaignId: campaign.id,
        ttclid: input.ttclid ?? null,
        source: input.source ?? null,
        userAgent: input.userAgent ?? null,
        ipAddress: input.ipAddress ?? null,
        referrer: input.referrer ?? null,
        landingUrl: input.landingUrl ?? null,
      },
    });

    await this.events.recordWithAccount({
      teamId: input.teamId,
      eventType: TikTokEventType.CLICK,
      campaignId: campaign.id,
      adGroupId: campaign.adGroupId,
      adId: campaign.adId,
      clickId: click.clickToken,
      payload: { ttclid: input.ttclid, source: input.source },
    });

    await this.events.recordWithAccount({
      teamId: input.teamId,
      eventType: TikTokEventType.LANDING_PAGE,
      campaignId: campaign.id,
      clickId: click.clickToken,
    });

    await this.logs.info(input.teamId, 'tracking.click', 'Tracking click recorded', {
      clickToken: click.clickToken,
      campaignId: campaign.id,
    });

    return { click, campaign };
  }

  async buildWhatsAppRedirectUrl(teamId: string, clickToken: string, campaignId: string) {
    const settings = await this.prisma.tikTokSettings.findUnique({ where: { teamId } });
    const campaign = await this.prisma.tikTokCampaign.findUnique({ where: { id: campaignId } });
    const session = await this.prisma.whatsAppSession.findFirst({
      where: { teamId, status: 'CONNECTED' },
      orderBy: { connectedAt: 'desc' },
    });

    const phone =
      campaign?.whatsappNumber?.replace(/\D/g, '') ??
      settings?.defaultWhatsAppNumber?.replace(/\D/g, '') ??
      session?.phoneNumber?.replace(/\D/g, '') ??
      null;

    if (!phone) {
      const webUrl = this.config.getOrThrow<string>('WEB_PUBLIC_URL');
      return `${webUrl}/whatsapp`;
    }

    const template =
      settings?.trackingRedirectMessage?.trim() ||
      `Hello, I am interested in your offer ${TIKTOK_TRACKING_REF_PREFIX}${clickToken}${TIKTOK_TRACKING_REF_SUFFIX}`;
    const text = template.includes(TIKTOK_TRACKING_REF_PREFIX)
      ? template
      : `${template} ${TIKTOK_TRACKING_REF_PREFIX}${clickToken}${TIKTOK_TRACKING_REF_SUFFIX}`;

    await this.events.recordWithAccount({
      teamId,
      eventType: TikTokEventType.LEAD,
      campaignId,
      clickId: clickToken,
    });

    return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  }

  buildTrackingLink(teamId: string, campaignId: string) {
    const webUrl = this.config.getOrThrow<string>('WEB_PUBLIC_URL');
    return `${webUrl}/t/${teamId}/${campaignId}`;
  }

  listCampaigns(teamId: string) {
    return this.prisma.tikTokCampaign.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { clicks: true, events: true } } },
    });
  }

  createCampaign(teamId: string, input: { name: string; externalCampaignId?: string; adGroupId?: string; adId?: string; whatsappNumber?: string }) {
    return this.prisma.tikTokAccount.findUnique({ where: { teamId } }).then((account) =>
      this.prisma.tikTokCampaign.create({
        data: {
          teamId,
          accountId: account?.id ?? null,
          name: input.name,
          externalCampaignId: input.externalCampaignId ?? null,
          adGroupId: input.adGroupId ?? null,
          adId: input.adId ?? null,
          whatsappNumber: input.whatsappNumber ?? null,
        },
      }),
    );
  }
}
