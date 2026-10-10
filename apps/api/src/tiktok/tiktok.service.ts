import { BadRequestException, Injectable } from '@nestjs/common';
import { TikTokConnectionStatus } from '@watsapp/database';
import { PrismaService } from '../prisma/prisma.service';
import { TikTokCreateCampaignDto, TikTokAppCredentialsDto, TikTokUpdateSettingsDto } from './dto/tiktok.dto';
import { TikTokAppCredentialsService } from './tiktok-app-credentials.service';
import { TikTokEventsService } from './tiktok-events.service';
import { TikTokOAuthService } from './tiktok-oauth.service';
import { TikTokSyncService } from './tiktok-sync.service';
import { TikTokTrackingService } from './tiktok-tracking.service';
import { TikTokLogService } from './tiktok-log.service';

const accountInclude = {
  token: { select: { accessTokenExpiresAt: true, refreshTokenExpiresAt: true, scopes: true, updatedAt: true } },
  settings: true,
  _count: { select: { advertisers: true, businessCenters: true, events: true, campaigns: true } },
} as const;

@Injectable()
export class TikTokService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: TikTokOAuthService,
    private readonly syncService: TikTokSyncService,
    private readonly events: TikTokEventsService,
    private readonly tracking: TikTokTrackingService,
    private readonly logs: TikTokLogService,
    private readonly appCredentials: TikTokAppCredentialsService,
  ) {}

  async getStatus(teamId: string, userId?: string) {
    const configured = await this.appCredentials.isConfigured(teamId);
    const appCredentials = await this.appCredentials.getView(teamId);

    let account = await this.prisma.tikTokAccount.findUnique({
      where: { teamId },
      include: accountInclude,
    });

    if (account?.status === TikTokConnectionStatus.CONNECTING && !account.token) {
      account = await this.prisma.tikTokAccount.update({
        where: { id: account.id },
        data: { status: TikTokConnectionStatus.DISCONNECTED },
        include: accountInclude,
      });
    }

    if (userId) {
      const marketing = await this.prisma.tikTokMarketingConnection.findUnique({
        where: { userId },
        include: { advertisers: { orderBy: { name: 'asc' } } },
      });
      if (marketing) {
        account = await this.mirrorMarketingConnection(teamId, marketing);
      } else {
        const login = await this.prisma.tikTokLoginAccount.findUnique({ where: { userId } });
        if (login) {
          account = await this.mirrorLoginAccount(teamId, userId, login);
        }
      }
    }

    if (!account) {
      return {
        configured,
        appCredentials,
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
      appCredentials,
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

  private async mirrorMarketingConnection(
    teamId: string,
    marketing: {
      encryptedMarketingAccessToken: string;
      encryptedMarketingRefreshToken: string | null;
      marketingExpiresAt: Date;
      marketingRefreshExpiresAt: Date | null;
      connectedAt: Date | null;
      businessCenterId: string | null;
      businessCenterName: string | null;
      lastBusinessSyncAt: Date | null;
      advertisers: Array<{ advertiserId: string; name: string | null }>;
    },
  ) {
    const primary = marketing.advertisers[0];
    const teamAccount = await this.prisma.tikTokAccount.upsert({
      where: { teamId },
      update: {
        status: TikTokConnectionStatus.CONNECTED,
        businessName: primary?.name ?? marketing.businessCenterName ?? undefined,
        advertiserId: primary?.advertiserId ?? undefined,
        businessCenterId: marketing.businessCenterId ?? undefined,
        connectedAt: marketing.connectedAt ?? new Date(),
        lastSyncAt: marketing.lastBusinessSyncAt ?? new Date(),
      },
      create: {
        teamId,
        status: TikTokConnectionStatus.CONNECTED,
        businessName: primary?.name ?? marketing.businessCenterName ?? null,
        advertiserId: primary?.advertiserId ?? null,
        businessCenterId: marketing.businessCenterId ?? null,
        connectedAt: marketing.connectedAt ?? new Date(),
        lastSyncAt: marketing.lastBusinessSyncAt ?? new Date(),
      },
    });

    await this.prisma.tikTokToken.upsert({
      where: { accountId: teamAccount.id },
      update: {
        encryptedAccessToken: marketing.encryptedMarketingAccessToken,
        encryptedRefreshToken: marketing.encryptedMarketingRefreshToken,
        accessTokenExpiresAt: marketing.marketingExpiresAt,
        refreshTokenExpiresAt: marketing.marketingRefreshExpiresAt,
      },
      create: {
        accountId: teamAccount.id,
        encryptedAccessToken: marketing.encryptedMarketingAccessToken,
        encryptedRefreshToken: marketing.encryptedMarketingRefreshToken,
        accessTokenExpiresAt: marketing.marketingExpiresAt,
        refreshTokenExpiresAt: marketing.marketingRefreshExpiresAt,
      },
    });

    return this.prisma.tikTokAccount.findUniqueOrThrow({
      where: { id: teamAccount.id },
      include: accountInclude,
    });
  }

  private async mirrorLoginAccount(
    teamId: string,
    userId: string,
    login: {
      openId: string;
      displayName: string | null;
      encryptedAccessToken: string;
      encryptedRefreshToken: string | null;
      expiresAt: Date;
      createdAt: Date;
      businessCenterId: string | null;
      lastBusinessSyncAt: Date | null;
    },
  ) {
    const loginAdvertiser = await this.prisma.tikTokLoginAdvertiser.findFirst({
      where: { userId },
      orderBy: { name: 'asc' },
    });

    const teamAccount = await this.prisma.tikTokAccount.upsert({
      where: { teamId },
      update: {
        status: TikTokConnectionStatus.CONNECTED,
        openId: login.openId,
        businessName: loginAdvertiser?.name ?? login.displayName ?? undefined,
        advertiserId: loginAdvertiser?.advertiserId ?? undefined,
        businessCenterId: login.businessCenterId ?? undefined,
        connectedAt: login.createdAt,
        lastSyncAt: login.lastBusinessSyncAt ?? login.createdAt,
      },
      create: {
        teamId,
        status: TikTokConnectionStatus.CONNECTED,
        openId: login.openId,
        businessName: loginAdvertiser?.name ?? login.displayName ?? null,
        advertiserId: loginAdvertiser?.advertiserId ?? null,
        businessCenterId: login.businessCenterId ?? null,
        connectedAt: login.createdAt,
        lastSyncAt: login.lastBusinessSyncAt ?? login.createdAt,
      },
    });

    await this.prisma.tikTokToken.upsert({
      where: { accountId: teamAccount.id },
      update: {
        encryptedAccessToken: login.encryptedAccessToken,
        encryptedRefreshToken: login.encryptedRefreshToken,
        accessTokenExpiresAt: login.expiresAt,
      },
      create: {
        accountId: teamAccount.id,
        encryptedAccessToken: login.encryptedAccessToken,
        encryptedRefreshToken: login.encryptedRefreshToken,
        accessTokenExpiresAt: login.expiresAt,
      },
    });

    return this.prisma.tikTokAccount.findUniqueOrThrow({
      where: { id: teamAccount.id },
      include: accountInclude,
    });
  }

  connect(_teamId: string, _userId: string, _advertiserId?: string) {
    throw new BadRequestException(
      'Use POST /api/auth/tiktok-business/login to connect TikTok Ads from the integration page.',
    );
  }

  disconnect(teamId: string, userId: string, reason?: string) {
    return this.oauth.disconnect(teamId, userId, reason);
  }

  reconnect(_teamId: string, _userId: string) {
    throw new BadRequestException(
      'Use POST /api/auth/tiktok-business/login to reconnect TikTok Ads.',
    );
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

  getAppCredentials(teamId: string) {
    return this.appCredentials.getView(teamId);
  }

  saveAppCredentials(teamId: string, dto: TikTokAppCredentialsDto) {
    return this.appCredentials.save(teamId, dto);
  }

  clearAppCredentials(teamId: string) {
    return this.appCredentials.clear(teamId);
  }

  getDefaultRedirectUri() {
    return { redirectUri: this.appCredentials.defaultRedirectUri() };
  }
}
