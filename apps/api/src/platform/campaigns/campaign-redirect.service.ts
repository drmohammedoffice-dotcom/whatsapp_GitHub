import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { WhatsAppRoutingService } from '../routing/whatsapp-routing.service';

export type RedirectQuery = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
  country?: string;
  ref?: string;
};

@Injectable()
export class CampaignRedirectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly routing: WhatsAppRoutingService,
    private readonly config: ConfigService,
  ) {}

  async handleRedirect(
    campaignSlugOrId: string,
    meta: {
      ipAddress?: string;
      userAgent?: string;
      referrer?: string;
      query: RedirectQuery;
    },
  ) {
    const campaign =
      (await this.prisma.campaign.findFirst({ where: { slug: campaignSlugOrId, active: true } })) ??
      (await this.prisma.campaign.findFirst({ where: { id: campaignSlugOrId, active: true } }));
    if (!campaign) throw new NotFoundException('Campaign not found');

    const pick = await this.routing.pickAccount({
      teamId: campaign.teamId,
      campaignId: campaign.id,
      countryCode: meta.query.country,
      routingRuleId: campaign.routingRuleId ?? undefined,
      manualAccountId: campaign.whatsAppCloudAccountId ?? undefined,
    });

    let phone = pick?.phoneNumber ?? null;

    if (!phone && campaign.whatsAppSessionId) {
      const session = await this.prisma.whatsAppSession.findUnique({ where: { id: campaign.whatsAppSessionId } });
      phone = session?.phoneNumber ?? null;
    }

    if (!phone) {
      const session = await this.prisma.whatsAppSession.findFirst({
        where: { teamId: campaign.teamId, status: 'CONNECTED' },
        orderBy: { connectedAt: 'desc' },
      });
      phone = session?.phoneNumber ?? null;
    }

    if (!phone) {
      const webUrl = this.config.getOrThrow<string>('WEB_PUBLIC_URL');
      return { redirectUrl: `${webUrl}/whatsapp`, phone: null };
    }

    const log = await this.prisma.redirectLog.create({
      data: {
        teamId: campaign.teamId,
        campaignId: campaign.id,
        ipAddress: meta.ipAddress ?? null,
        userAgent: meta.userAgent ?? null,
        device: this.parseDevice(meta.userAgent),
        referrer: meta.referrer ?? null,
        utmSource: meta.query.utm_source ?? null,
        utmMedium: meta.query.utm_medium ?? null,
        utmCampaign: meta.query.utm_campaign ?? null,
        utmTerm: meta.query.utm_term ?? null,
        utmContent: meta.query.utm_content ?? null,
        resolvedAccountId: pick?.accountId ?? null,
        metadata: { strategy: pick?.strategy, ref: meta.query.ref },
      },
    });

    const digits = phone.replace(/\D/g, '');
    const message = campaign.redirectMessage ?? 'Hello!';
    const text = encodeURIComponent(`${message} [ref:${log.clickToken}]`);
    const redirectUrl = `https://wa.me/${digits}?text=${text}`;

    await this.prisma.redirectLog.update({
      where: { id: log.id },
      data: { redirectedTo: redirectUrl },
    });

    return { redirectUrl, phone: digits, clickToken: log.clickToken };
  }

  private parseDevice(userAgent?: string) {
    if (!userAgent) return null;
    if (/mobile/i.test(userAgent)) return 'mobile';
    if (/tablet/i.test(userAgent)) return 'tablet';
    return 'desktop';
  }
}
