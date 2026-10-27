import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TikTokConnectionStatus } from '@watsapp/database';
import { randomBytes } from 'crypto';
import { EncryptionService } from '../../security/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanEntitlementsService } from '../../billing/plan-entitlements.service';
import { TikTokAdsAdvertiser, TikTokAdsService } from './tiktok-ads.service';

const OAUTH_STATE_TTL_SEC = 600;
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

type MarketingOAuthStatePayload = {
  userId: string;
  teamId: string;
  nonce: string;
  returnTo?: string;
  /** Browser origin where the user started OAuth (must match CORS_ORIGINS). */
  returnOrigin?: string;
};

export type MarketingOAuthStartOptions = {
  returnTo?: string;
  returnOrigin?: string;
};

@Injectable()
export class TikTokMarketingOAuthService {
  private readonly logger = new Logger(TikTokMarketingOAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly encryption: EncryptionService,
    private readonly ads: TikTokAdsService,
    private readonly entitlements: PlanEntitlementsService,
  ) {}

  async startLogin(userId: string, teamId: string, options?: string | MarketingOAuthStartOptions) {
    await this.entitlements.assertTiktokEnabled(teamId);
    const opts: MarketingOAuthStartOptions =
      typeof options === 'string' ? { returnTo: options } : options ?? {};
    const returnTo = opts.returnTo?.startsWith('/') ? opts.returnTo : undefined;
    const returnOrigin = this.sanitizeReturnOrigin(opts.returnOrigin);
    const creds = this.requireCredentials();
    const state = await this.jwt.signAsync(
      {
        userId,
        teamId,
        nonce: randomBytes(16).toString('hex'),
        ...(returnTo ? { returnTo } : {}),
        ...(returnOrigin ? { returnOrigin } : {}),
      } satisfies MarketingOAuthStatePayload,
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: OAUTH_STATE_TTL_SEC,
      },
    );
    const authUrl = this.ads.buildAuthorizeUrl(creds, state);
    this.logger.log(
      `[Marketing OAuth start] userId=${userId} teamId=${teamId} returnOrigin=${returnOrigin ?? 'default'}`,
    );
    return { authUrl, state, redirectUri: creds.redirectUri };
  }

  async handleCallback(
    authCode: string | undefined,
    state: string | undefined,
    error?: string,
    callbackMeta?: { query: Record<string, string>; url: string },
  ) {
    this.logger.log(
      `[Marketing OAuth callback RECEIVED] url=${callbackMeta?.url ?? 'n/a'} query=${JSON.stringify(callbackMeta?.query ?? {})} auth_code=${authCode ?? 'null'} state=${state ?? 'null'} error=${error ?? 'null'}`,
    );

    if (error) {
      this.logger.error(`[Marketing OAuth callback DENIED] error=${error}`);
      throw new BadRequestException(`TikTok Business authorization denied: ${error}`);
    }
    if (!authCode || !state) {
      throw new BadRequestException('Missing auth_code or state from TikTok Business callback');
    }

    let payload: MarketingOAuthStatePayload;
    try {
      payload = await this.jwt.verifyAsync<MarketingOAuthStatePayload>(state, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      this.logger.log(
        `[Marketing OAuth callback state OK] userId=${payload.userId} teamId=${payload.teamId} nonce=${payload.nonce}`,
      );
    } catch (err) {
      this.logger.error(
        `[Marketing OAuth callback state INVALID] ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException('Invalid or expired OAuth state');
    }

    const creds = this.requireCredentials();
    const tokenData = await this.ads.exchangeAuthCode(creds, authCode);

    const advertiserIdsFromToken = (tokenData.advertiser_ids ?? []).map(String);
    this.logger.log(
      `[Marketing OAuth token OK] userId=${payload.userId} advertiser_ids=${advertiserIdsFromToken.join(',') || 'none'} expires_in=${tokenData.expires_in ?? 'n/a'}`,
    );

    const marketingExpiresAt = new Date(Date.now() + (tokenData.expires_in ?? 86400) * 1000);
    const marketingRefreshExpiresAt = tokenData.refresh_token_expires_in
      ? new Date(Date.now() + tokenData.refresh_token_expires_in * 1000)
      : null;

    await this.prisma.tikTokMarketingConnection.upsert({
      where: { userId: payload.userId },
      update: {
        teamId: payload.teamId,
        tiktokOpenId: (tokenData as { open_id?: string }).open_id ?? undefined,
        encryptedMarketingAccessToken: this.encryption.encryptJson(tokenData.access_token),
        encryptedMarketingRefreshToken: tokenData.refresh_token
          ? this.encryption.encryptJson(tokenData.refresh_token)
          : null,
        marketingExpiresAt,
        marketingRefreshExpiresAt,
        connectedAt: new Date(),
      },
      create: {
        userId: payload.userId,
        teamId: payload.teamId,
        tiktokOpenId: (tokenData as { open_id?: string }).open_id ?? null,
        encryptedMarketingAccessToken: this.encryption.encryptJson(tokenData.access_token),
        encryptedMarketingRefreshToken: tokenData.refresh_token
          ? this.encryption.encryptJson(tokenData.refresh_token)
          : null,
        marketingExpiresAt,
        marketingRefreshExpiresAt,
        connectedAt: new Date(),
      },
    });

    await this.fetchAndPersistAdvertisers(
      payload.userId,
      payload.teamId,
      creds,
      tokenData.access_token,
      advertiserIdsFromToken,
    );

    const webUrl = this.resolveWebBase(payload.returnOrigin);
    const returnPath = payload.returnTo?.startsWith('/') ? payload.returnTo : '/tiktok';
    const separator = returnPath.includes('?') ? '&' : '?';
    const successUrl = `${webUrl}${returnPath}${separator}connected=1`;
    this.logger.log(`[Marketing OAuth COMPLETE] userId=${payload.userId} redirect=${successUrl}`);
    return successUrl;
  }

  /**
   * Prefer the origin the user started from (keeps localStorage session),
   * otherwise fall back to WEB_PUBLIC_URL.
   */
  resolveWebBase(returnOrigin?: string | null): string {
    return this.sanitizeReturnOrigin(returnOrigin) ?? this.config.getOrThrow<string>('WEB_PUBLIC_URL').replace(/\/$/, '');
  }

  private sanitizeReturnOrigin(raw?: string | null): string | undefined {
    const candidate = String(raw ?? '').trim().replace(/\/$/, '');
    if (!/^https?:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(candidate)) return undefined;
    const allowed = (this.config.get<string>('CORS_ORIGINS') ?? '')
      .split(',')
      .map((o) => o.trim().replace(/\/$/, ''))
      .filter(Boolean);
    const webPublic = this.config.get<string>('WEB_PUBLIC_URL')?.replace(/\/$/, '');
    if (webPublic && !allowed.includes(webPublic)) allowed.push(webPublic);
    if (!allowed.length) return undefined;
    return allowed.includes(candidate) ? candidate : undefined;
  }

  /**
   * Valid TikTok Marketing token for the user. A token that cannot be decrypted or
   * refreshed means the connection is broken: ask the user to reconnect instead of
   * failing with a 500.
   */
  async getValidMarketingAccessToken(userId: string): Promise<string> {
    const row = await this.prisma.tikTokMarketingConnection.findUnique({ where: { userId } });
    if (!row) {
      throw new BadRequestException('حساب تيك توك غير مربوط. اربط حسابك من صفحة تكامل TikTok.');
    }
    try {
      return await this.resolveMarketingAccessToken(userId, row);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      this.logger.warn(`[Marketing OAuth] token unusable userId=${userId}: ${error instanceof Error ? error.message : String(error)}`);
      throw new ConflictException({
        code: 'TIKTOK_RECONNECT_REQUIRED',
        message: 'انتهى ربط حسابك في تيك توك أو أصبح غير صالح. أعد ربط حسابك من صفحة تكامل TikTok.',
      });
    }
  }

  private async resolveMarketingAccessToken(
    userId: string,
    row: NonNullable<Awaited<ReturnType<PrismaService['tikTokMarketingConnection']['findUnique']>>>,
  ): Promise<string> {

    if (row.marketingExpiresAt.getTime() - Date.now() > TOKEN_REFRESH_BUFFER_MS) {
      return this.encryption.decryptJson<string>(row.encryptedMarketingAccessToken);
    }

    const refreshToken = row.encryptedMarketingRefreshToken
      ? this.encryption.decryptJson<string>(row.encryptedMarketingRefreshToken)
      : null;
    if (!refreshToken) {
      return this.encryption.decryptJson<string>(row.encryptedMarketingAccessToken);
    }

    const creds = this.requireCredentials();
    const refreshed = await this.ads.refreshMarketingAccessToken(creds, refreshToken);
    const marketingExpiresAt = new Date(Date.now() + (refreshed.expires_in ?? 86400) * 1000);
    const marketingRefreshExpiresAt = refreshed.refresh_token_expires_in
      ? new Date(Date.now() + refreshed.refresh_token_expires_in * 1000)
      : row.marketingRefreshExpiresAt;

    await this.prisma.tikTokMarketingConnection.update({
      where: { userId },
      data: {
        encryptedMarketingAccessToken: this.encryption.encryptJson(refreshed.access_token),
        encryptedMarketingRefreshToken: refreshed.refresh_token
          ? this.encryption.encryptJson(refreshed.refresh_token)
          : row.encryptedMarketingRefreshToken,
        marketingExpiresAt,
        marketingRefreshExpiresAt,
      },
    });

    return refreshed.access_token;
  }

  /** Force-refresh marketing token (e.g. after Events API 401). */
  async forceRefreshMarketingAccessToken(userId: string): Promise<string> {
    const row = await this.prisma.tikTokMarketingConnection.findUnique({ where: { userId } });
    if (!row) {
      throw new BadRequestException('TikTok Marketing account not connected');
    }

    const refreshToken = row.encryptedMarketingRefreshToken
      ? this.encryption.decryptJson<string>(row.encryptedMarketingRefreshToken)
      : null;
    if (!refreshToken) {
      this.logger.warn(`[Marketing OAuth] force refresh skipped — no refresh token userId=${userId}`);
      return this.encryption.decryptJson<string>(row.encryptedMarketingAccessToken);
    }

    const creds = this.requireCredentials();
    const refreshed = await this.ads.refreshMarketingAccessToken(creds, refreshToken);
    const marketingExpiresAt = new Date(Date.now() + (refreshed.expires_in ?? 86400) * 1000);
    const marketingRefreshExpiresAt = refreshed.refresh_token_expires_in
      ? new Date(Date.now() + refreshed.refresh_token_expires_in * 1000)
      : row.marketingRefreshExpiresAt;

    await this.prisma.tikTokMarketingConnection.update({
      where: { userId },
      data: {
        encryptedMarketingAccessToken: this.encryption.encryptJson(refreshed.access_token),
        encryptedMarketingRefreshToken: refreshed.refresh_token
          ? this.encryption.encryptJson(refreshed.refresh_token)
          : row.encryptedMarketingRefreshToken,
        marketingExpiresAt,
        marketingRefreshExpiresAt,
      },
    });

    this.logger.log(`[Marketing OAuth] force refresh OK userId=${userId}`);
    return refreshed.access_token;
  }

  private requireCredentials() {
    const creds = this.ads.resolveBusinessAppCredentials();
    if (!creds) {
      throw new BadRequestException(
        'TikTok Marketing API is not configured. Set TIKTOK_BUSINESS_APP_ID, TIKTOK_BUSINESS_APP_SECRET, and TIKTOK_BUSINESS_REDIRECT_URI.',
      );
    }
    return creds;
  }

  private async fetchAndPersistAdvertisers(
    userId: string,
    teamId: string,
    creds: { appId: string; appSecret: string; redirectUri: string },
    accessToken: string,
    advertiserIdsFromToken: string[],
  ) {
    this.logger.log(`[Marketing OAuth advertiser fetch START] userId=${userId}`);

    let advertisers: TikTokAdsAdvertiser[] = [];
    try {
      advertisers = await this.ads.getAuthorizedAdvertisers(creds, accessToken);
      this.logger.log(
        `[Marketing OAuth advertiser fetch] authorized=${advertisers.length} ids=${advertisers.map((a) => a.advertiser_id).join(',')}`,
      );
    } catch (err) {
      this.logger.warn(
        `[Marketing OAuth advertiser fetch FAILED] ${err instanceof Error ? err.message : String(err)} — falling back to token advertiser_ids`,
      );
      advertisers = advertiserIdsFromToken.map((id) => ({ advertiser_id: id }));
    }

    const ids = advertisers.length
      ? advertisers.map((a) => a.advertiser_id)
      : advertiserIdsFromToken;

    const details =
      ids.length > 0 ? await this.ads.getAdvertiserDetails(accessToken, ids).catch(() => []) : [];
    const merged = details.length > 0 ? details : advertisers;

    const businessCenters = await this.ads.getBusinessCenters(accessToken).catch((err) => {
      this.logger.warn(
        `[Marketing OAuth BC fetch] ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    });

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
          hasBusinessAccess,
          businessCenterId: primaryBc?.bc_id ?? null,
          businessCenterName: primaryBc?.name ?? null,
          lastBusinessSyncAt: new Date(),
          businessSyncMessage: hasBusinessAccess
            ? null
            : 'No TikTok Ads account found. Create one at ads.tiktok.com and authorize again.',
        },
      });
    });

    if (teamId) {
      await this.mirrorToTeamAccount(teamId, userId, merged, primaryBc);
    }

    this.logger.log(
      `[Marketing OAuth advertiser fetch OK] userId=${userId} advertisers=${merged.length} businessCenters=${businessCenters.length}`,
    );
  }

  private async mirrorToTeamAccount(
    teamId: string,
    userId: string,
    advertisers: TikTokAdsAdvertiser[],
    primaryBc: { bc_id: string; name?: string } | null,
  ) {
    const marketing = await this.prisma.tikTokMarketingConnection.findUnique({ where: { userId } });
    if (!marketing) return;

    const primary = advertisers[0];
    const businessName = primary?.advertiser_name ?? marketing.businessCenterName ?? null;
    const teamAccount = await this.prisma.tikTokAccount.upsert({
      where: { teamId },
      update: {
        status: TikTokConnectionStatus.CONNECTED,
        businessName: businessName ?? undefined,
        advertiserId: primary?.advertiser_id ?? undefined,
        businessCenterId: primaryBc?.bc_id ?? marketing.businessCenterId ?? undefined,
        connectedAt: marketing.connectedAt ?? new Date(),
        lastSyncAt: new Date(),
      },
      create: {
        teamId,
        status: TikTokConnectionStatus.CONNECTED,
        businessName,
        advertiserId: primary?.advertiser_id ?? null,
        businessCenterId: primaryBc?.bc_id ?? marketing.businessCenterId ?? null,
        connectedAt: marketing.connectedAt ?? new Date(),
        lastSyncAt: new Date(),
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
  }
}
