import { Injectable } from '@nestjs/common';
import { TikTokConnectionStatus } from '@watsapp/database';
import { PrismaService } from '../prisma/prisma.service';
import { TikTokApiClient } from './tiktok-api.client';
import { TikTokLogService } from './tiktok-log.service';
import { TikTokTokenService } from './tiktok-token.service';

@Injectable()
export class TikTokSyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly api: TikTokApiClient,
    private readonly tokens: TikTokTokenService,
    private readonly logs: TikTokLogService,
  ) {}

  async syncAccount(teamId: string) {
    const account = await this.prisma.tikTokAccount.findUnique({ where: { teamId } });
    if (!account || account.status !== TikTokConnectionStatus.CONNECTED) return null;

    const accessToken = await this.tokens.getAccessToken(teamId);
    if (!accessToken) return null;

    const advertisers = await this.api.getAdvertisers(accessToken);
    const advertiserIds = advertisers.map((a) => a.advertiser_id);
    const details = advertiserIds.length ? await this.api.getAdvertiserInfo(accessToken, advertiserIds) : [];

    for (const adv of details.length ? details : advertisers) {
      await this.prisma.tikTokAdvertiser.upsert({
        where: { accountId_advertiserId: { accountId: account.id, advertiserId: adv.advertiser_id } },
        update: {
          name: adv.advertiser_name ?? null,
          currency: adv.currency ?? null,
          timezone: adv.timezone ?? null,
          status: adv.status ?? null,
          raw: adv as never,
        },
        create: {
          teamId,
          accountId: account.id,
          advertiserId: adv.advertiser_id,
          name: adv.advertiser_name ?? null,
          currency: adv.currency ?? null,
          timezone: adv.timezone ?? null,
          status: adv.status ?? null,
          raw: adv as never,
        },
      });
    }

    const bcs = await this.api.getBusinessCenters(accessToken).catch(() => []);
    for (const bc of bcs) {
      const bcId = String(bc.bc_id ?? bc.id ?? '');
      if (!bcId) continue;
      await this.prisma.tikTokBusinessCenter.upsert({
        where: { accountId_businessCenterId: { accountId: account.id, businessCenterId: bcId } },
        update: {
          name: (bc.name as string) ?? null,
          currency: (bc.currency as string) ?? null,
          timezone: (bc.timezone as string) ?? null,
          raw: bc as never,
        },
        create: {
          teamId,
          accountId: account.id,
          businessCenterId: bcId,
          name: (bc.name as string) ?? null,
          currency: (bc.currency as string) ?? null,
          timezone: (bc.timezone as string) ?? null,
          raw: bc as never,
        },
      });
    }

    const primary = details[0] ?? advertisers[0];
    await this.prisma.tikTokAccount.update({
      where: { id: account.id },
      data: {
        lastSyncAt: new Date(),
        businessName: primary?.advertiser_name ?? account.businessName,
        advertiserId: account.advertiserId ?? primary?.advertiser_id ?? null,
        businessCenterId: bcs[0] ? String((bcs[0] as Record<string, unknown>).bc_id ?? '') || null : account.businessCenterId,
      },
    });

    await this.logs.info(teamId, 'sync.complete', 'TikTok account synced', {
      advertisers: advertiserIds.length,
      businessCenters: bcs.length,
    });
    return { advertisers: advertiserIds.length, businessCenters: bcs.length };
  }
}
