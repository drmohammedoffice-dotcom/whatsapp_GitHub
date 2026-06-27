import { Injectable } from '@nestjs/common';
import { TikTokConnectionStatus } from '@watsapp/database';
import { PrismaService } from '../prisma/prisma.service';
import { TikTokCreateCampaignDto, TikTokUpdateSettingsDto } from './dto/tiktok.dto';
import { TikTokApiClient } from './tiktok-api.client';
import { TikTokEventsService } from './tiktok-events.service';
import { TikTokOAuthService } from './tiktok-oauth.service';
import { TikTokSyncService } from './tiktok-sync.service';
import { TikTokTrackingService } from './tiktok-tracking.service';
import { TikTokLogService } from './tiktok-log.service';

@Injectable()
export class TikTokService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: TikTokOAuthService,
    private readonly syncService: TikTokSyncService,
    private readonly events: TikTokEventsService,
    private readonly tracking: TikTokTrackingService,
    private readonly logs: TikTokLogService,
    private readonly api: TikTokApiClient,
  ) {}

  async getStatus(teamId: string) {
    const account = await this.prisma.tikTokAccount.findUnique({
      where: { teamId },
      include: {
        token: { select: { accessTokenExpiresAt: true, refreshTokenExpiresAt: true, scopes: true, updatedAt: true } },
        settings: true,
        _count: { select: { advertisers: true, businessCenters: true, events: true, campaigns: true } },
      },
    });

    const configured = this.api.isConfigured();

    if (!account) {
      return {
        configured,
        connected: false,
        status: TikTokConnectionStatus.DISCONNECTED,
        businessName: null,
        advertiserId: null,
        businessCenterId: null,
        connectedAt: null,
        lastSync: null,
        tokenExpiration: null,
        counts: { advertisers: 0, businessCenters: 0, events: 0, campaigns: 0 },
        settings: null,
        partnerFeatures: {
          messagingManagement: false,
          eventsApi: true,
        },
      };
    }

    return {
      configured,
      connected: account.status === TikTokConnectionStatus.CONNECTED,
      status: account.status,
      businessName: account.businessName,
      advertiserId: account.advertiserId,
      businessCenterId: account.businessCenterId,
      connectedAt: account.connectedAt,
      lastSync: account.lastSyncAt,
      tokenExpiration: account.token?.accessTokenExpiresAt ?? null,
      refreshTokenExpiration: account.token?.refreshTokenExpiresAt ?? null,
      scopes: account.token?.scopes ?? null,
      counts: account._count,
      settings: account.settings,
      partnerFeatures: {
        messagingManagement: account.settings?.partnerMessagingEnabled ?? false,
        eventsApi: account.settings?.eventsApiEnabled ?? true,
      },
    };
  }

  connect(teamId: string, userId: string, advertiserId?: string) {
    return this.oauth.startConnect(teamId, userId, advertiserId);
  }

  disconnect(teamId: string, userId: string, reason?: string) {
    return this.oauth.disconnect(teamId, userId, reason);
  }

  reconnect(teamId: string, userId: string) {
    return this.oauth.startConnect(teamId, userId);
  }

  syncAccount(teamId: string) {
    return this.syncService.syncAccount(teamId);
  }

  getBusiness(teamId: string) {
    return this.prisma.tikTokAccount.findUnique({
      where: { teamId },
      include: {
        advertisers: { orderBy: { name: 'asc' } },
        businessCenters: { orderBy: { name: 'asc' } },
      },
    });
  }

  getCampaigns(teamId: string) {
    return this.tracking.listCampaigns(teamId);
  }

  createCampaign(teamId: string, dto: TikTokCreateCampaignDto) {
    return this.tracking.createCampaign(teamId, dto);
  }

  getEvents(teamId: string, query?: { eventType?: import('@watsapp/database').TikTokEventType; campaignId?: string; limit?: number }) {
    return this.events.list(teamId, query);
  }

  getEventStats(teamId: string) {
    return this.events.stats(teamId);
  }

  createCustomEvent(teamId: string, dto: Parameters<TikTokEventsService['createCustom']>[1]) {
    return this.events.createCustom(teamId, dto);
  }

  async updateSettings(teamId: string, dto: TikTokUpdateSettingsDto) {
    const account = await this.prisma.tikTokAccount.findUnique({ where: { teamId } });
    if (!account) {
      return this.prisma.tikTokSettings.create({
        data: {
          teamId,
          accountId: (
            await this.prisma.tikTokAccount.create({ data: { teamId } })
          ).id,
          ...dto,
        },
      });
    }
    return this.prisma.tikTokSettings.upsert({
      where: { teamId },
      update: dto,
      create: { teamId, accountId: account.id, ...dto },
    });
  }

  getLogs(teamId: string) {
    return this.logs.list(teamId);
  }

  getTrackingLink(teamId: string, campaignId: string) {
    return { url: this.tracking.buildTrackingLink(teamId, campaignId) };
  }
}
