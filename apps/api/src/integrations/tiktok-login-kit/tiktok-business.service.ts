import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@watsapp/database';
import { PrismaService } from '../../prisma/prisma.service';
import { TikTokAdsService } from './tiktok-ads.service';
import { TikTokLoginService } from './tiktok-login.service';
import { TikTokMarketingOAuthService } from './tiktok-marketing-oauth.service';

const NO_ADS_ACCOUNT_MESSAGE =
  'No TikTok Ads account found. Connect via "Authorize TikTok Business" or create a TikTok Ads account at ads.tiktok.com.';

const MARKETING_NOT_CONFIGURED_MESSAGE =
  'TikTok Marketing API is not configured on the server. Set TIKTOK_BUSINESS_APP_ID in server environment.';

const MARKETING_NOT_CONNECTED_MESSAGE =
  'TikTok Business is not connected. Click "Authorize TikTok Business" to connect your ads account.';

export type TikTokBusinessStatus = {
  loginConnected: boolean;
  marketingConnected: boolean;
  marketingApiConfigured: boolean;
  hasBusinessAccess: boolean;
  businessCenter: { id: string; name: string | null } | null;
  advertisers: Array<{ advertiserId: string; name: string | null; currency: string | null; status: string | null }>;
  lastSyncAt: string | null;
  syncMessage: string | null;
  marketingExpiresAt: string | null;
  loginProfile: {
    openId: string;
    displayName: string | null;
    avatar: string | null;
    expiresAt: string;
  } | null;
};

@Injectable()
export class TikTokBusinessService {
  private readonly logger = new Logger(TikTokBusinessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly login: TikTokLoginService,
    private readonly marketingOAuth: TikTokMarketingOAuthService,
    private readonly ads: TikTokAdsService,
  ) {}

  async getStatus(userId: string): Promise<TikTokBusinessStatus> {
    const [loginRow, marketingRow] = await Promise.all([
      this.prisma.tikTokLoginAccount.findUnique({ where: { userId } }),
      this.prisma.tikTokMarketingConnection.findUnique({
        where: { userId },
        include: { advertisers: { orderBy: { name: 'asc' } } },
      }),
    ]);

    if (marketingRow) {
      return {
        loginConnected: Boolean(loginRow),
        marketingConnected: true,
        marketingApiConfigured: this.ads.isConfigured(),
        hasBusinessAccess: marketingRow.hasBusinessAccess,
        businessCenter: marketingRow.businessCenterId
          ? { id: marketingRow.businessCenterId, name: marketingRow.businessCenterName }
          : null,
        advertisers: marketingRow.advertisers.map((a) => ({
          advertiserId: a.advertiserId,
          name: a.name,
          currency: a.currency,
          status: a.status,
        })),
        lastSyncAt: marketingRow.lastBusinessSyncAt?.toISOString() ?? null,
        syncMessage: marketingRow.businessSyncMessage,
        marketingExpiresAt: marketingRow.marketingExpiresAt.toISOString(),
        loginProfile: loginRow
          ? {
              openId: loginRow.openId,
              displayName: loginRow.displayName,
              avatar: loginRow.avatar,
              expiresAt: loginRow.expiresAt.toISOString(),
            }
          : null,
      };
    }

    if (loginRow) {
      const loginAdvertisers = await this.prisma.tikTokLoginAdvertiser.findMany({
        where: { userId },
        orderBy: { name: 'asc' },
      });
      return {
        loginConnected: true,
        marketingConnected: false,
        marketingApiConfigured: this.ads.isConfigured(),
        hasBusinessAccess: loginRow.hasBusinessAccess,
        businessCenter: loginRow.businessCenterId
          ? { id: loginRow.businessCenterId, name: loginRow.businessCenterName }
          : null,
        advertisers: loginAdvertisers.map((a) => ({
          advertiserId: a.advertiserId,
          name: a.name,
          currency: a.currency,
          status: a.status,
        })),
        lastSyncAt: loginRow.lastBusinessSyncAt?.toISOString() ?? null,
        syncMessage: loginRow.businessSyncMessage ?? MARKETING_NOT_CONNECTED_MESSAGE,
        marketingExpiresAt: null,
        loginProfile: {
          openId: loginRow.openId,
          displayName: loginRow.displayName,
          avatar: loginRow.avatar,
          expiresAt: loginRow.expiresAt.toISOString(),
        },
      };
    }

    return {
      loginConnected: false,
      marketingConnected: false,
      marketingApiConfigured: this.ads.isConfigured(),
      hasBusinessAccess: false,
      businessCenter: null,
      advertisers: [],
      lastSyncAt: null,
      syncMessage: MARKETING_NOT_CONNECTED_MESSAGE,
      marketingExpiresAt: null,
      loginProfile: null,
    };
  }

  async syncBusinessAccounts(userId: string, teamId?: string) {
    this.logger.log(`[Business sync START] userId=${userId} teamId=${teamId ?? 'n/a'}`);

    const marketingRow = await this.prisma.tikTokMarketingConnection.findUnique({ where: { userId } });
    if (marketingRow) {
      return this.syncFromMarketingConnection(userId, teamId ?? marketingRow.teamId ?? undefined);
    }

    const creds = this.ads.resolveBusinessAppCredentials();
    if (!creds) {
      return this.getStatus(userId);
    }

    const account = await this.prisma.tikTokLoginAccount.findUnique({ where: { userId } });
    if (!account) {
      return this.getStatus(userId);
    }

    let accessToken: string;
    try {
      accessToken = await this.login.getValidAccessToken(userId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh TikTok login token';
      this.logger.error(`[Business sync] token error userId=${userId}: ${message}`);
      return this.getStatus(userId);
    }

    try {
      const [advertisers, businessCenters] = await Promise.all([
        this.ads.getAuthorizedAdvertisers(creds, accessToken),
        this.ads.getBusinessCenters(accessToken).catch(() => []),
      ]);

      const advertiserIds = advertisers.map((a) => a.advertiser_id);
      const details =
        advertiserIds.length > 0
          ? await this.ads.getAdvertiserDetails(accessToken, advertiserIds)
          : [];
      const merged = details.length > 0 ? details : advertisers;
      const hasBusinessAccess = merged.length > 0 || businessCenters.length > 0;
      const primaryBc = businessCenters[0] ?? null;

      await this.prisma.$transaction(async (tx) => {
        await tx.tikTokLoginAdvertiser.deleteMany({ where: { userId } });
        for (const adv of merged) {
          await tx.tikTokLoginAdvertiser.create({
            data: {
              userId,
              advertiserId: adv.advertiser_id,
              name: adv.advertiser_name ?? null,
              currency: adv.currency ?? null,
              timezone: adv.timezone ?? null,
              status: adv.status ?? null,
              raw: adv as never,
            },
          });
        }
        await tx.tikTokLoginAccount.update({
          where: { userId },
          data: {
            teamId: teamId ?? account.teamId,
            hasBusinessAccess,
            businessCenterId: primaryBc?.bc_id ?? null,
            businessCenterName: primaryBc?.name ?? null,
            lastBusinessSyncAt: new Date(),
            businessSyncMessage: hasBusinessAccess ? null : NO_ADS_ACCOUNT_MESSAGE,
          },
        });
      });

      this.logger.log(`[Business sync OK] userId=${userId} advertisers=${merged.length}`);
    } catch (err) {
      const message = this.friendlyApiError(err);
      this.logger.warn(`[Business sync FAILED] userId=${userId}: ${message}`);
    }

    return this.getStatus(userId);
  }

  private async syncFromMarketingConnection(userId: string, teamId?: string) {
    const creds = this.ads.resolveBusinessAppCredentials();
    if (!creds) {
      return this.getStatus(userId);
    }

    let accessToken: string;
    try {
      accessToken = await this.marketingOAuth.getValidMarketingAccessToken(userId);
    } catch (err) {
      this.logger.error(
        `[Business sync] marketing token error userId=${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return this.getStatus(userId);
    }

    try {
      const [advertisers, businessCenters] = await Promise.all([
        this.ads.getAuthorizedAdvertisers(creds, accessToken),
        this.ads.getBusinessCenters(accessToken).catch(() => []),
      ]);

      const advertiserIds = advertisers.map((a) => a.advertiser_id);
      const details =
        advertiserIds.length > 0
          ? await this.ads.getAdvertiserDetails(accessToken, advertiserIds)
          : [];
      const merged = details.length > 0 ? details : advertisers;
      const hasBusinessAccess = merged.length > 0 || businessCenters.length > 0;
      const primaryBc = businessCenters[0] ?? null;

      await this.prisma.$transaction(async (tx) => {
        await tx.tikTokMarketingAdvertiser.deleteMany({ where: { userId } });
        for (const adv of merged) {
          await tx.tikTokMarketingAdvertiser.create({
            data: {
              userId,
              advertiserId: adv.advertiser_id,
              name: adv.advertiser_name ?? null,
              currency: adv.currency ?? null,
              timezone: adv.timezone ?? null,
              status: adv.status ?? null,
              raw: adv as never,
            },
          });
        }
        await tx.tikTokMarketingConnection.update({
          where: { userId },
          data: {
            teamId: teamId ?? undefined,
            hasBusinessAccess,
            businessCenterId: primaryBc?.bc_id ?? null,
            businessCenterName: primaryBc?.name ?? null,
            lastBusinessSyncAt: new Date(),
            businessSyncMessage: hasBusinessAccess ? null : NO_ADS_ACCOUNT_MESSAGE,
          },
        });
      });

      this.logger.log(
        `[Business sync OK] userId=${userId} marketing advertisers=${merged.length}`,
      );
    } catch (err) {
      this.logger.warn(
        `[Business sync FAILED] userId=${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    return this.getStatus(userId);
  }

  async disconnect(userId: string, _teamId?: string) {
    await this.prisma.tikTokMarketingAdvertiser.deleteMany({ where: { userId } });
    await this.prisma.tikTokMarketingConnection.deleteMany({ where: { userId } });
    await this.login.disconnect(userId);
    return { disconnected: true };
  }

  async getAdvertisers(userId: string) {
    const status = await this.getStatus(userId);
    return {
      connected: status.marketingConnected || status.loginConnected,
      businessCenter: status.businessCenter,
      advertisers: status.advertisers,
      lastSyncAt: status.lastSyncAt,
    };
  }

  async getCampaigns(userId: string) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        advertiser_id: string;
        campaign_id: string;
        name: string | null;
        objective: string | null;
        status: string | null;
        budget: number | null;
        spend: number;
        impressions: number;
        clicks: number;
        cpc: number;
        cpm: number;
        conversions: number;
        synced_at: Date;
      }>
    >(Prisma.sql`
      SELECT advertiser_id, campaign_id, name, objective, status, budget,
             spend, impressions, clicks, cpc, cpm, conversions, synced_at
      FROM tiktok_campaigns
      WHERE user_id = ${userId}
      ORDER BY advertiser_id ASC, name ASC NULLS LAST
    `);

    return {
      campaigns: rows.map((c) => ({
        advertiserId: c.advertiser_id,
        campaignId: c.campaign_id,
        name: c.name,
        objective: c.objective,
        status: c.status,
        budget: c.budget,
        spend: Number(c.spend ?? 0),
        impressions: Number(c.impressions ?? 0),
        clicks: Number(c.clicks ?? 0),
        cpc: Number(c.cpc ?? 0),
        cpm: Number(c.cpm ?? 0),
        conversions: Number(c.conversions ?? 0),
        syncedAt: c.synced_at.toISOString(),
      })),
    };
  }

  async getAdGroups(userId: string) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        advertiser_id: string;
        adgroup_id: string;
        campaign_id: string | null;
        name: string | null;
        status: string | null;
        billing_event: string | null;
        budget: number | null;
        synced_at: Date;
      }>
    >(Prisma.sql`
      SELECT advertiser_id, adgroup_id, campaign_id, name, status, billing_event, budget, synced_at
      FROM tiktok_adgroups
      WHERE user_id = ${userId}
      ORDER BY advertiser_id ASC, name ASC NULLS LAST
    `);

    return {
      adgroups: rows.map((g) => ({
        advertiserId: g.advertiser_id,
        adGroupId: g.adgroup_id,
        campaignId: g.campaign_id,
        name: g.name,
        status: g.status,
        billingEvent: g.billing_event,
        budget: g.budget,
        syncedAt: g.synced_at.toISOString(),
      })),
    };
  }

  async getAds(userId: string) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        advertiser_id: string;
        ad_id: string;
        adgroup_id: string | null;
        campaign_id: string | null;
        name: string | null;
        status: string | null;
        synced_at: Date;
      }>
    >(Prisma.sql`
      SELECT advertiser_id, ad_id, adgroup_id, campaign_id, name, status, synced_at
      FROM tiktok_ads
      WHERE user_id = ${userId}
      ORDER BY advertiser_id ASC, name ASC NULLS LAST
    `);

    return {
      ads: rows.map((a) => ({
        advertiserId: a.advertiser_id,
        adId: a.ad_id,
        adGroupId: a.adgroup_id,
        campaignId: a.campaign_id,
        name: a.name,
        status: a.status,
        syncedAt: a.synced_at.toISOString(),
      })),
    };
  }

  async getAnalytics(userId: string) {
    const marketing = await this.prisma.tikTokMarketingConnection.findUnique({
      where: { userId },
      select: { teamId: true },
    });
    const teamId = marketing?.teamId ?? null;

    const [campaigns, adgroupCount, adCount, advertiserCount, conversations, topWhatsAppRows] =
      await Promise.all([
        this.getCampaigns(userId),
        this.prisma.$queryRaw<Array<{ count: bigint }>>(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM tiktok_adgroups WHERE user_id = ${userId}`,
        ),
        this.prisma.$queryRaw<Array<{ count: bigint }>>(
          Prisma.sql`SELECT COUNT(*)::bigint AS count FROM tiktok_ads WHERE user_id = ${userId}`,
        ),
        this.prisma.tikTokMarketingAdvertiser.count({ where: { userId } }),
        teamId
          ? this.prisma.tikTokTrackingClick.count({ where: { teamId } })
          : Promise.resolve(0),
        teamId
          ? this.prisma.$queryRaw<Array<{ whatsapp_number: string; mappings: bigint }>>(Prisma.sql`
              SELECT whatsapp_number, COUNT(*)::bigint AS mappings
              FROM tiktok_whatsapp_mappings
              WHERE "teamId" = ${teamId} AND is_active = true
              GROUP BY whatsapp_number
              ORDER BY mappings DESC
              LIMIT 5
            `)
          : Promise.resolve([]),
      ]);

    const campaignRows = campaigns.campaigns;
    const totals = campaignRows.reduce(
      (acc, c) => ({
        spend: acc.spend + c.spend,
        impressions: acc.impressions + c.impressions,
        clicks: acc.clicks + c.clicks,
        conversions: acc.conversions + c.conversions,
      }),
      { spend: 0, impressions: 0, clicks: 0, conversions: 0 },
    );

    const activeCampaigns = campaignRows.filter((c) => c.status !== 'DISABLE').length;
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const avgCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
    const avgCpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
    const costPerConversation = conversations > 0 ? totals.spend / conversations : 0;

    return {
      totals: {
        ...totals,
        conversations,
        costPerConversation: Math.round(costPerConversation * 100) / 100,
        ctr: Math.round(ctr * 100) / 100,
        avgCpc: Math.round(avgCpc * 100) / 100,
        avgCpm: Math.round(avgCpm * 100) / 100,
      },
      counts: {
        advertisers: advertiserCount,
        campaigns: campaignRows.length,
        activeCampaigns,
        adgroups: Number(adgroupCount[0]?.count ?? 0),
        ads: Number(adCount[0]?.count ?? 0),
      },
      topCampaigns: [...campaignRows]
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 10)
        .map((c) => ({
          advertiserId: c.advertiserId,
          campaignId: c.campaignId,
          name: c.name,
          spend: c.spend,
          impressions: c.impressions,
          clicks: c.clicks,
          conversions: c.conversions,
        })),
      topWhatsAppNumbers: topWhatsAppRows.map((row) => ({
        whatsappNumber: row.whatsapp_number,
        mappings: Number(row.mappings),
      })),
    };
  }

  async listMappings(teamId: string) {
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        advertiser_id: string | null;
        campaign_id: string | null;
        adgroup_id: string | null;
        ad_id: string | null;
        event_set_id: string | null;
        whatsapp_number: string;
        is_active: boolean;
        updated_at: Date;
      }>
    >(Prisma.sql`
      SELECT id, advertiser_id, campaign_id, adgroup_id, ad_id, event_set_id,
             whatsapp_number, is_active, updated_at
      FROM tiktok_whatsapp_mappings
      WHERE "teamId" = ${teamId}
      ORDER BY updated_at DESC
    `);

    return rows.map((row) => ({
      id: row.id,
      advertiserId: row.advertiser_id,
      externalCampaignId: row.campaign_id,
      externalAdGroupId: row.adgroup_id,
      externalAdId: row.ad_id,
      eventSetId: row.event_set_id,
      whatsappNumber: row.whatsapp_number,
      isActive: row.is_active,
      updatedAt: row.updated_at.toISOString(),
    }));
  }

  async upsertMapping(
    teamId: string,
    body: {
      id?: string;
      advertiserId?: string | null;
      campaignId?: string | null;
      adGroupId?: string | null;
      adId?: string | null;
      whatsappNumber: string;
      isActive?: boolean;
    },
  ) {
    const now = new Date();
    const id = body.id ?? randomUUID();
    const isActive = body.isActive ?? true;

    if (body.id) {
      await this.prisma.$executeRaw(Prisma.sql`
        UPDATE tiktok_whatsapp_mappings
        SET advertiser_id = ${body.advertiserId ?? null},
            campaign_id = ${body.campaignId ?? null},
            adgroup_id = ${body.adGroupId ?? null},
            ad_id = ${body.adId ?? null},
            whatsapp_number = ${body.whatsappNumber},
            is_active = ${isActive},
            updated_at = ${now}
        WHERE id = ${body.id} AND "teamId" = ${teamId}
      `);
    } else {
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO tiktok_whatsapp_mappings (
          id, "teamId", advertiser_id, campaign_id, adgroup_id, ad_id,
          whatsapp_number, is_active, created_at, updated_at
        ) VALUES (
          ${id}, ${teamId}, ${body.advertiserId ?? null}, ${body.campaignId ?? null},
          ${body.adGroupId ?? null}, ${body.adId ?? null}, ${body.whatsappNumber},
          ${isActive}, ${now}, ${now}
        )
      `);
    }

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        advertiser_id: string | null;
        campaign_id: string | null;
        adgroup_id: string | null;
        ad_id: string | null;
        event_set_id: string | null;
        whatsapp_number: string;
        is_active: boolean;
        updated_at: Date;
      }>
    >(Prisma.sql`
      SELECT id, advertiser_id, campaign_id, adgroup_id, ad_id, event_set_id,
             whatsapp_number, is_active, updated_at
      FROM tiktok_whatsapp_mappings
      WHERE id = ${id} AND "teamId" = ${teamId}
      LIMIT 1
    `);

    const row = rows[0];
    return {
      id: row.id,
      advertiserId: row.advertiser_id,
      externalCampaignId: row.campaign_id,
      externalAdGroupId: row.adgroup_id,
      externalAdId: row.ad_id,
      eventSetId: row.event_set_id,
      whatsappNumber: row.whatsapp_number,
      isActive: row.is_active,
      updatedAt: row.updated_at.toISOString(),
    };
  }

  async syncAll(userId: string, teamId?: string) {
    const status = await this.syncBusinessAccounts(userId, teamId);
    return { ...status, syncedCampaigns: 0, syncedAdGroups: 0, syncedAds: 0 };
  }

  async syncAdvertiser(userId: string, teamId: string | undefined, _advertiserId: string) {
    return this.syncAll(userId, teamId);
  }

  private friendlyApiError(err: unknown): string {
    const raw = err instanceof Error ? err.message : String(err);
    return raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
  }
}
