import { Injectable } from '@nestjs/common';
import { TikTokEventType } from '@watsapp/database';
import { PrismaService } from '../prisma/prisma.service';
import { TIKTOK_TRACKING_REF_PREFIX, TIKTOK_TRACKING_REF_SUFFIX } from './tiktok.constants';
import { TikTokLogService } from './tiktok-log.service';
import { TikTokCustomEventDto } from './dto/tiktok.dto';

export type RecordEventInput = {
  teamId: string;
  eventType: TikTokEventType;
  campaignId?: string | null;
  adGroupId?: string | null;
  adId?: string | null;
  clickId?: string | null;
  customerId?: string | null;
  conversationId?: string | null;
  contactId?: string | null;
  customName?: string | null;
  payload?: object | null;
  occurredAt?: Date;
};

@Injectable()
export class TikTokEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logs: TikTokLogService,
  ) {}

  record(input: RecordEventInput) {
    return this.prisma.tikTokEvent.create({
      data: {
        teamId: input.teamId,
        accountId: undefined,
        eventType: input.eventType,
        campaignId: input.campaignId ?? null,
        adGroupId: input.adGroupId ?? null,
        adId: input.adId ?? null,
        clickId: input.clickId ?? null,
        customerId: input.customerId ?? null,
        conversationId: input.conversationId ?? null,
        contactId: input.contactId ?? null,
        customName: input.customName ?? null,
        payload: input.payload ?? undefined,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });
  }

  async recordWithAccount(input: RecordEventInput) {
    const account = await this.prisma.tikTokAccount.findUnique({ where: { teamId: input.teamId } });
    return this.prisma.tikTokEvent.create({
      data: {
        teamId: input.teamId,
        accountId: account?.id ?? null,
        eventType: input.eventType,
        campaignId: input.campaignId ?? null,
        adGroupId: input.adGroupId ?? null,
        adId: input.adId ?? null,
        clickId: input.clickId ?? null,
        customerId: input.customerId ?? null,
        conversationId: input.conversationId ?? null,
        contactId: input.contactId ?? null,
        customName: input.customName ?? null,
        payload: input.payload ?? undefined,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });
  }

  list(teamId: string, query?: { eventType?: TikTokEventType; campaignId?: string; limit?: number }) {
    return this.prisma.tikTokEvent.findMany({
      where: {
        teamId,
        ...(query?.eventType ? { eventType: query.eventType } : {}),
        ...(query?.campaignId ? { campaignId: query.campaignId } : {}),
      },
      orderBy: { occurredAt: 'desc' },
      take: query?.limit ?? 100,
    });
  }

  async stats(teamId: string, days = 30) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const events = await this.prisma.tikTokEvent.groupBy({
      by: ['eventType'],
      where: { teamId, occurredAt: { gte: since } },
      _count: { _all: true },
    });
    const map = Object.fromEntries(events.map((row) => [row.eventType, row._count._all])) as Record<string, number>;
    const clicks = map.CLICK ?? 0;
    const conversations = map.CONVERSATION_STARTED ?? 0;
    const sales = map.PURCHASE ?? 0;
    return {
      since: since.toISOString(),
      counts: {
        clicks,
        landingViews: map.LANDING_PAGE ?? 0,
        pageVisits: map.PAGE_VISIT ?? 0,
        whatsappOpens: map.LEAD ?? 0,
        conversationStarted: conversations,
        aiReplies: map.CONVERSATION_REPLIED ?? 0,
        humanReplies: 0,
        sales,
        custom: map.CUSTOM ?? 0,
      },
      conversionRate: clicks > 0 ? Number(((conversations / clicks) * 100).toFixed(2)) : 0,
      saleConversionRate: conversations > 0 ? Number(((sales / conversations) * 100).toFixed(2)) : 0,
      byType: map,
    };
  }

  createCustom(teamId: string, dto: TikTokCustomEventDto) {
    return this.recordWithAccount({
      teamId,
      eventType: dto.eventType,
      customName: dto.customName,
      campaignId: dto.campaignId,
      adGroupId: dto.adGroupId,
      adId: dto.adId,
      clickId: dto.clickId,
      customerId: dto.customerId,
      conversationId: dto.conversationId,
      payload: dto.payload,
    });
  }

  extractClickTokenFromMessage(text?: string | null): string | null {
    if (!text) return null;
    const start = text.indexOf(TIKTOK_TRACKING_REF_PREFIX);
    if (start === -1) return null;
    const from = start + TIKTOK_TRACKING_REF_PREFIX.length;
    const end = text.indexOf(TIKTOK_TRACKING_REF_SUFFIX, from);
    if (end === -1) return null;
    return text.slice(from, end).trim() || null;
  }

  async handleConversationStarted(input: {
    teamId: string;
    conversationId: string;
    contactId: string;
    messageText?: string | null;
    isNewConversation: boolean;
  }) {
    if (!input.isNewConversation) return null;

    const clickToken = this.extractClickTokenFromMessage(input.messageText);
    let click = clickToken
      ? await this.prisma.tikTokTrackingClick.findFirst({
          where: { teamId: input.teamId, clickToken },
        })
      : null;

    if (!click) {
      click = await this.prisma.tikTokTrackingClick.findFirst({
        where: {
          teamId: input.teamId,
          contactId: input.contactId,
          convertedAt: null,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (click) {
      await this.prisma.tikTokTrackingClick.update({
        where: { id: click.id },
        data: {
          conversationId: input.conversationId,
          contactId: input.contactId,
          convertedAt: new Date(),
        },
      });
    }

    const campaign = click
      ? await this.prisma.tikTokCampaign.findUnique({ where: { id: click.campaignId } })
      : null;

    const event = await this.recordWithAccount({
      teamId: input.teamId,
      eventType: TikTokEventType.CONVERSATION_STARTED,
      campaignId: click?.campaignId ?? null,
      adGroupId: campaign?.adGroupId ?? null,
      adId: campaign?.adId ?? null,
      clickId: click?.clickToken ?? clickToken,
      customerId: input.contactId,
      conversationId: input.conversationId,
      contactId: input.contactId,
      payload: click ? { source: click.source, ttclid: click.ttclid } : undefined,
    });

    await this.logs.info(input.teamId, 'event.conversation_started', 'Conversation linked to TikTok tracking', {
      conversationId: input.conversationId,
      clickToken: click?.clickToken,
    });
    return event;
  }

  async handleOutboundReply(teamId: string, conversationId: string, isAi: boolean) {
    return this.recordWithAccount({
      teamId,
      eventType: TikTokEventType.CONVERSATION_REPLIED,
      conversationId,
      payload: { source: isAi ? 'ai' : 'human' },
    });
  }
}
