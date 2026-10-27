import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TikTokAdsBalanceCheckoutStatus } from '@watsapp/database';
import { PrismaService } from '../../prisma/prisma.service';
import { TikTokAdsService } from './tiktok-ads.service';
import { TikTokMarketingOAuthService } from './tiktok-marketing-oauth.service';
import {
  assertAdvertiserIdValid,
  assertAdvertiserOwned,
  assertDestinationSafe,
  canAutoConfirmFromBalanceChange,
  confirmationSourceAfterReturn,
  isPaymentVerified,
  statusAfterBalanceRefresh,
  statusAfterUserReturn,
} from './tiktok-ads-balance.rules';
import { buildTikTokAdsBillingUrl, buildTikTokAdsManagerUrl } from './tiktok-ads-balance-url';

@Injectable()
export class TikTokAdsBalanceService {
  private readonly logger = new Logger(TikTokAdsBalanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ads: TikTokAdsService,
    private readonly marketingOAuth: TikTokMarketingOAuthService,
  ) {}

  async listAdvertisers(userId: string) {
    const connection = await this.prisma.tikTokMarketingConnection.findUnique({
      where: { userId },
      include: { advertisers: { orderBy: { updatedAt: 'desc' } } },
    });
    if (!connection) {
      return {
        connected: false,
        advertisers: [] as Array<{
          advertiserId: string;
          name: string | null;
          currency: string | null;
          status: string | null;
          linked: boolean;
        }>,
      };
    }
    return {
      connected: true,
      hasBusinessAccess: connection.hasBusinessAccess,
      businessCenterId: connection.businessCenterId,
      advertisers: connection.advertisers.map((row) => ({
        advertiserId: row.advertiserId,
        name: row.name,
        currency: row.currency,
        status: row.status,
        linked: true,
      })),
    };
  }

  async startCheckout(input: {
    userId: string;
    teamId: string;
    advertiserId: string;
  }) {
    const advertiserId = String(input.advertiserId ?? '').trim();
    try {
      assertAdvertiserIdValid(advertiserId);
    } catch {
      throw new BadRequestException('معرّف الحساب الإعلاني غير صالح');
    }

    const advertiser = await this.prisma.tikTokMarketingAdvertiser.findUnique({
      where: { userId_advertiserId: { userId: input.userId, advertiserId } },
    });
    try {
      assertAdvertiserOwned(Boolean(advertiser));
    } catch {
      throw new ForbiddenException('لا تملك صلاحية الوصول إلى هذا الحساب الإعلاني');
    }
    if (!advertiser) {
      throw new ForbiddenException('لا تملك صلاحية الوصول إلى هذا الحساب الإعلاني');
    }

    let destinationUrl: string;
    try {
      destinationUrl = buildTikTokAdsBillingUrl(advertiserId);
      assertDestinationSafe(destinationUrl);
    } catch (err) {
      this.logger.warn(`Billing URL build failed: ${err instanceof Error ? err.message : String(err)}`);
      throw new BadRequestException('تعذر تجهيز رابط صفحة التعبئة الرسمية');
    }

    let balanceBefore: number | null = null;
    let currency = advertiser.currency;
    try {
      const token = await this.marketingOAuth.getValidMarketingAccessToken(input.userId);
      const [profile, balance] = await Promise.all([
        this.ads.getAdvertiserProfile(token, advertiserId).catch(() => null),
        this.ads.getAdvertiserBalance(token, advertiserId).catch(() => null),
      ]);
      if (profile?.currency) currency = profile.currency;
      if (balance && Number.isFinite(balance.balance)) balanceBefore = balance.balance;
      if (profile?.name || profile?.currency) {
        await this.prisma.tikTokMarketingAdvertiser
          .update({
            where: { userId_advertiserId: { userId: input.userId, advertiserId } },
            data: {
              name: profile.name ?? undefined,
              currency: profile.currency ?? undefined,
              timezone: profile.timezone ?? undefined,
            },
          })
          .catch(() => undefined);
      }
    } catch (err) {
      this.logger.warn(
        `Could not snapshot balance before checkout: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const row = await this.prisma.tikTokAdsBalanceCheckout.create({
      data: {
        teamId: input.teamId,
        userId: input.userId,
        advertiserId,
        advertiserName: advertiser.name,
        currency: currency ?? null,
        status: TikTokAdsBalanceCheckoutStatus.REDIRECTED,
        destinationUrl,
        balanceBefore,
        confirmationSource: null,
        metadata: {
          mode: 'external_tiktok_billing',
          managerFallbackUrl: buildTikTokAdsManagerUrl(advertiserId),
          paymentHandledBy: 'tiktok',
          chatlooraCollectsPayment: false,
        },
      },
    });

    return this.mapCheckout(row, {
      instructions: [
        'payment_on_tiktok_only',
        'open_billing_add_balance',
        'return_to_chatloora_does_not_confirm',
      ],
      managerUrl: buildTikTokAdsManagerUrl(advertiserId),
    });
  }

  async listCheckouts(teamId: string, userId: string, take = 40) {
    const rows = await this.prisma.tikTokAdsBalanceCheckout.findMany({
      where: { teamId, userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(take, 1), 100),
    });
    return { checkouts: rows.map((row) => this.mapCheckout(row)) };
  }

  async getCheckout(teamId: string, userId: string, id: string) {
    const row = await this.prisma.tikTokAdsBalanceCheckout.findFirst({
      where: { id, teamId, userId },
    });
    if (!row) throw new NotFoundException('عملية التعبئة غير موجودة');
    return this.mapCheckout(row);
  }

  /**
   * User returned to Chatloora — never treat this as payment confirmation.
   */
  async markReturned(teamId: string, userId: string, id: string) {
    const row = await this.prisma.tikTokAdsBalanceCheckout.findFirst({
      where: { id, teamId, userId },
    });
    if (!row) throw new NotFoundException('عملية التعبئة غير موجودة');

    const nextStatus = statusAfterUserReturn(row.status);
    if (nextStatus === row.status) {
      return this.mapCheckout(row);
    }

    const updated = await this.prisma.tikTokAdsBalanceCheckout.update({
      where: { id: row.id },
      data: {
        status: nextStatus,
        confirmationSource: confirmationSourceAfterReturn(),
        lastCheckedAt: new Date(),
      },
    });
    return this.mapCheckout(updated, {
      paymentVerified: false,
      notice: 'return_does_not_confirm_payment',
    });
  }

  async cancelCheckout(teamId: string, userId: string, id: string) {
    const row = await this.prisma.tikTokAdsBalanceCheckout.findFirst({
      where: { id, teamId, userId },
    });
    if (!row) throw new NotFoundException('عملية التعبئة غير موجودة');
    if (row.status === TikTokAdsBalanceCheckoutStatus.CONFIRMED) {
      throw new BadRequestException('لا يمكن إلغاء عملية مؤكّدة');
    }
    const updated = await this.prisma.tikTokAdsBalanceCheckout.update({
      where: { id: row.id },
      data: {
        status: TikTokAdsBalanceCheckoutStatus.CANCELLED,
        confirmationSource: 'user_cancelled',
        lastCheckedAt: new Date(),
      },
    });
    return this.mapCheckout(updated);
  }

  /**
   * Refresh advertiser balance for display only.
   * Does NOT set CONFIRMED — balance change alone cannot be tied to this checkout reliably.
   */
  async refreshStatus(teamId: string, userId: string, id: string) {
    const row = await this.prisma.tikTokAdsBalanceCheckout.findFirst({
      where: { id, teamId, userId },
    });
    if (!row) throw new NotFoundException('عملية التعبئة غير موجودة');

    let balanceAfter = row.balanceAfter;
    let currency = row.currency;
    try {
      const token = await this.marketingOAuth.getValidMarketingAccessToken(userId);
      const balance = await this.ads.getAdvertiserBalance(token, row.advertiserId);
      balanceAfter = balance.balance;
      if (balance.currency) currency = balance.currency;
    } catch (err) {
      this.logger.warn(
        `Balance refresh failed for checkout ${id}: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException('تعذر استرجاع رصيد الحساب من تيك توك حالياً');
    }

    // Intentionally never auto-CONFIRMED: balance delta cannot be tied to this checkout.
    if (canAutoConfirmFromBalanceChange()) {
      throw new BadRequestException('Unexpected auto-confirm path');
    }
    const nextStatus = statusAfterBalanceRefresh(row.status);

    const updated = await this.prisma.tikTokAdsBalanceCheckout.update({
      where: { id: row.id },
      data: {
        balanceAfter,
        currency: currency ?? row.currency,
        status: nextStatus,
        lastCheckedAt: new Date(),
        confirmationSource: row.confirmationSource ?? 'balance_snapshot_unverified',
      },
    });

    return this.mapCheckout(updated, {
      paymentVerified: false,
      notice: 'balance_snapshot_is_not_payment_proof',
    });
  }

  private mapCheckout(
    row: {
      id: string;
      teamId: string;
      userId: string;
      advertiserId: string;
      advertiserName: string | null;
      currency: string | null;
      status: TikTokAdsBalanceCheckoutStatus;
      destinationUrl: string;
      confirmationSource: string | null;
      balanceBefore: number | null;
      balanceAfter: number | null;
      lastCheckedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      metadata?: unknown;
    },
    extra?: Record<string, unknown>,
  ) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    return {
      id: row.id,
      advertiserId: row.advertiserId,
      advertiserName: row.advertiserName,
      currency: row.currency,
      status: row.status,
      destinationUrl: row.destinationUrl,
      confirmationSource: row.confirmationSource,
      balanceBefore: row.balanceBefore,
      balanceAfter: row.balanceAfter,
      lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      paymentVerified: isPaymentVerified(row.status),
      amount: null as number | null,
      chatlooraCollectsPayment: false,
      managerFallbackUrl:
        typeof meta.managerFallbackUrl === 'string'
          ? meta.managerFallbackUrl
          : buildTikTokAdsManagerUrl(row.advertiserId),
      ...extra,
    };
  }
}
