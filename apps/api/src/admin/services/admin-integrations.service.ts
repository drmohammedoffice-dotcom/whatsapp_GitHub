import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminIntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listWhatsApp() {
    const [sessions, cloud] = await Promise.all([
      this.prisma.whatsAppSession.findMany({
        include: { team: { select: { id: true, name: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.whatsAppCloudAccount.findMany({
        include: { team: { select: { id: true, name: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const sessionRows = await Promise.all(
      sessions.map(async (s) => ({
        id: s.id,
        type: 'session' as const,
        phoneNumber: s.phoneNumber ?? s.jid?.split('@')[0] ?? null,
        status: s.status,
        workspace: s.team,
        messageCount: await this.prisma.message.count({ where: { teamId: s.teamId } }),
      })),
    );

    const cloudRows = cloud.map((c) => ({
      id: c.id,
      type: 'cloud' as const,
      phoneNumber: c.phoneNumber,
      status: c.status,
      workspace: c.team,
      messageCount: null,
    }));

    return [...sessionRows, ...cloudRows];
  }

  async disconnectWhatsApp(id: string, type: 'session' | 'cloud') {
    if (type === 'session') {
      return this.prisma.whatsAppSession.update({
        where: { id },
        data: { status: 'DISCONNECTED' },
      });
    }
    return this.prisma.whatsAppCloudAccount.update({
      where: { id },
      data: { status: 'DISCONNECTED' },
    });
  }

  async listTikTok() {
    const [connections, advertisers, eventSets, campaigns] = await Promise.all([
      this.prisma.tikTokMarketingConnection.findMany({
        include: { user: { select: { email: true, name: true } }, advertisers: true },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.tikTokMarketingAdvertiser.findMany({ orderBy: { updatedAt: 'desc' }, take: 200 }),
      this.prisma.tikTokEventSet.findMany({ orderBy: { updatedAt: 'desc' }, take: 200 }),
      this.prisma.tikTokMarketingCampaign.groupBy({
        by: ['advertiserId'],
        _count: { id: true },
        _sum: { spend: true },
      }),
    ]);

    return { connections, advertisers, eventSets, campaignStats: campaigns };
  }

  async listMeta() {
    const connections = await this.prisma.metaConnection.findMany({
      include: { team: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    const webhookEvents = await this.prisma.integrationWebhookEvent.groupBy({
      by: ['status'],
      where: { provider: 'META' },
      _count: { id: true },
    });

    return {
      connections: connections.map((c) => ({
        ...c,
        tokenExpiresAt: c.userAccessTokenExpiresAt,
        hasFacebookPage: Boolean(c.pageId),
        hasInstagram: Boolean(c.instagramId),
      })),
      webhookSummary: webhookEvents,
    };
  }
}
