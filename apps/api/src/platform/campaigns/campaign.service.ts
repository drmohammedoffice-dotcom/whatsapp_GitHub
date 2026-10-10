import { Injectable, NotFoundException } from '@nestjs/common';
import { CampaignSourceType, Prisma } from '@watsapp/database';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CampaignService {
  constructor(private readonly prisma: PrismaService) {}

  list(teamId: string) {
    return this.prisma.campaign.findMany({
      where: { teamId },
      include: {
        trafficSource: true,
        whatsAppCloudAccount: { select: { id: true, name: true, phoneNumber: true } },
        routingRule: { select: { id: true, name: true, strategy: true } },
        aiAgent: { select: { id: true, name: true, type: true } },
        _count: { select: { redirectLogs: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(teamId: string, id: string) {
    const row = await this.prisma.campaign.findFirst({
      where: { id, teamId },
      include: {
        trafficSource: true,
        whatsAppCloudAccount: true,
        routingRule: { include: { poolMembers: { include: { account: true } } } },
        aiAgent: true,
      },
    });
    if (!row) throw new NotFoundException('Campaign not found');
    return row;
  }

  async getBySlug(slug: string) {
    const row = await this.prisma.campaign.findFirst({
      where: { slug, active: true },
      include: { team: true, whatsAppCloudAccount: true, routingRule: true },
    });
    if (!row) throw new NotFoundException('Campaign not found');
    return row;
  }

  create(
    teamId: string,
    input: {
      name: string;
      slug: string;
      businessId?: string;
      trafficSourceId?: string;
      trafficSourceType?: CampaignSourceType;
      trafficSourceName?: string;
      whatsAppCloudAccountId?: string;
      routingRuleId?: string;
      aiAgentId?: string;
      redirectMessage?: string;
      utmDefaults?: Prisma.InputJsonValue;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      let trafficSourceId = input.trafficSourceId;
      if (!trafficSourceId && input.trafficSourceType) {
        const source = await tx.trafficSource.create({
          data: {
            teamId,
            type: input.trafficSourceType,
            name: input.trafficSourceName ?? input.trafficSourceType,
          },
        });
        trafficSourceId = source.id;
      }

      return tx.campaign.create({
        data: {
          teamId,
          name: input.name,
          slug: input.slug,
          businessId: input.businessId,
          trafficSourceId,
          whatsAppCloudAccountId: input.whatsAppCloudAccountId,
          routingRuleId: input.routingRuleId,
          aiAgentId: input.aiAgentId,
          redirectMessage: input.redirectMessage,
          utmDefaults: input.utmDefaults,
        },
      });
    });
  }

  async update(
    teamId: string,
    id: string,
    input: Partial<{
      name: string;
      active: boolean;
      whatsAppCloudAccountId: string | null;
      routingRuleId: string | null;
      aiAgentId: string | null;
      redirectMessage: string | null;
    }>,
  ) {
    const row = await this.prisma.campaign.findFirst({ where: { id, teamId } });
    if (!row) throw new NotFoundException('Campaign not found');
    return this.prisma.campaign.update({ where: { id }, data: input });
  }

  trackingLink(teamId: string, campaignId: string, webPublicUrl: string) {
    return `${webPublicUrl.replace(/\/$/, '')}/go/${campaignId}`;
  }
}
