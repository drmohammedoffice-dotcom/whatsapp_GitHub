import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TikTokConnectionStatus } from '@watsapp/database';
import { randomBytes } from 'crypto';
import { EncryptionService } from '../../security/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PlanEntitlementsService } from '../../billing/plan-entitlements.service';
import {
  TIKTOK_LOGIN_KIT_SCOPE,
  TikTokLoginApiClient,
} from './tiktok-login-kit-api.client';

const OAUTH_STATE_TTL_SEC = 600;
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

type OAuthStatePayload = {
  userId: string;
  teamId: string;
  nonce: string;
};

/**
 * TikTok Login Kit OAuth — user identity only (open.tiktokapis.com).
 * Business / Marketing API calls belong in TikTokAdsService + TikTokBusinessService.
 */
@Injectable()
export class TikTokLoginService {
  private readonly logger = new Logger(TikTokLoginService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly encryption: EncryptionService,
    private readonly api: TikTokLoginApiClient,
    private readonly entitlements: PlanEntitlementsService,
  ) {}

  loginKitRedirectUri(): string {
    return (
      this.config.get<string>('TIKTOK_REDIRECT_URI') ??
      `${this.config.getOrThrow<string>('API_PUBLIC_URL')}/api/auth/tiktok/callback`
    );
  }

  resolveCredentials() {
    const redirectUri = this.loginKitRedirectUri();
    const clientKey = this.config.get<string>('TIKTOK_CLIENT_KEY', '')?.trim();
    const clientSecret = this.config.get<string>('TIKTOK_CLIENT_SECRET', '')?.trim();
    if (!clientKey || !clientSecret) {
      throw new BadRequestException(
        'TikTok Login Kit is not configured. Set TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, and TIKTOK_REDIRECT_URI.',
      );
    }
    this.logger.log(
      `[Login OAuth credentials] source=env client_key=${clientKey} client_secret=*** redirect_uri=${redirectUri} scope=${TIKTOK_LOGIN_KIT_SCOPE}`,
    );
    return { clientKey, clientSecret, redirectUri };
  }

  defaultRedirectUri(): string {
    return this.loginKitRedirectUri();
  }

  isConfigured(): boolean {
    const key = this.config.get<string>('TIKTOK_CLIENT_KEY', '')?.trim();
    const secret = this.config.get<string>('TIKTOK_CLIENT_SECRET', '')?.trim();
    return Boolean(key && secret);
  }

  async startLogin(userId: string, teamId: string) {
    await this.entitlements.assertTiktokEnabled(teamId);
    const creds = this.resolveCredentials();
    const state = await this.jwt.signAsync(
      { userId, teamId, nonce: randomBytes(16).toString('hex') } satisfies OAuthStatePayload,
      {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        expiresIn: OAUTH_STATE_TTL_SEC,
      },
    );
    const authUrl = this.api.buildAuthorizeUrl({
      clientKey: creds.clientKey,
      redirectUri: creds.redirectUri,
      state,
      scopes: TIKTOK_LOGIN_KIT_SCOPE,
    });
    this.logger.log(
      `[Login OAuth start] userId=${userId} teamId=${teamId} scope=${TIKTOK_LOGIN_KIT_SCOPE}`,
    );
    return { authUrl, state, scope: TIKTOK_LOGIN_KIT_SCOPE, redirectUri: creds.redirectUri };
  }

  async handleCallback(
    code: string | undefined,
    state: string | undefined,
    error?: string,
    callbackMeta?: { query: Record<string, string>; url: string },
  ) {
    this.logger.log(
      `[Login OAuth callback] url=${callbackMeta?.url ?? 'n/a'} code=${code ?? 'null'} error=${error ?? 'null'}`,
    );

    if (error) {
      this.logger.error(`[Login OAuth callback DENIED] error=${error}`);
      throw new BadRequestException(`TikTok authorization denied: ${error}`);
    }
    if (!code || !state) {
      throw new BadRequestException('Missing code or state from TikTok callback');
    }

    let payload: OAuthStatePayload;
    try {
      payload = await this.jwt.verifyAsync<OAuthStatePayload>(state, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
    } catch (err) {
      this.logger.error(
        `[Login OAuth state INVALID] ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new BadRequestException('Invalid or expired OAuth state');
    }

    const creds = this.resolveCredentials();
    const tokenData = await this.api.exchangeCode({
      clientKey: creds.clientKey,
      clientSecret: creds.clientSecret,
      code,
      redirectUri: creds.redirectUri,
    });

    let displayName: string | null = null;
    let avatar: string | null = null;
    try {
      const profile = await this.api.fetchUserInfo(tokenData.access_token);
      displayName = profile.display_name ?? null;
      avatar = profile.avatar_url ?? null;
    } catch (err) {
      this.logger.warn(
        `[Login OAuth user/info FAILED] ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

    await this.prisma.tikTokLoginAccount.upsert({
      where: { userId: payload.userId },
      update: {
        teamId: payload.teamId,
        openId: tokenData.open_id,
        displayName,
        avatar,
        encryptedAccessToken: this.encryption.encryptJson(tokenData.access_token),
        encryptedRefreshToken: tokenData.refresh_token
          ? this.encryption.encryptJson(tokenData.refresh_token)
          : null,
        expiresAt,
      },
      create: {
        userId: payload.userId,
        teamId: payload.teamId,
        openId: tokenData.open_id,
        displayName,
        avatar,
        encryptedAccessToken: this.encryption.encryptJson(tokenData.access_token),
        encryptedRefreshToken: tokenData.refresh_token
          ? this.encryption.encryptJson(tokenData.refresh_token)
          : null,
        expiresAt,
      },
    });

    await this.mirrorLoginToTeamAccount(payload.teamId, {
      openId: tokenData.open_id,
      displayName,
      encryptedAccessToken: this.encryption.encryptJson(tokenData.access_token),
      encryptedRefreshToken: tokenData.refresh_token
        ? this.encryption.encryptJson(tokenData.refresh_token)
        : null,
      expiresAt,
    });

    const webUrl = this.config.getOrThrow<string>('WEB_PUBLIC_URL').replace(/\/$/, '');
    const successUrl = `${webUrl}/tiktok?connected=1`;
    this.logger.log(`[Login OAuth COMPLETE] userId=${payload.userId} redirect=${successUrl}`);
    return successUrl;
  }

  async getAccount(userId: string) {
    const row = await this.prisma.tikTokLoginAccount.findUnique({ where: { userId } });
    if (!row) return { connected: false as const };
    return {
      connected: true as const,
      openId: row.openId,
      displayName: row.displayName,
      avatar: row.avatar,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    };
  }

  async disconnect(userId: string) {
    await this.prisma.tikTokLoginAdvertiser.deleteMany({ where: { userId } });
    await this.prisma.tikTokLoginAccount.deleteMany({ where: { userId } });
    return { disconnected: true };
  }

  /** Returns a valid Login Kit access token, refreshing when near expiry. */
  async getValidAccessToken(userId: string): Promise<string> {
    const row = await this.prisma.tikTokLoginAccount.findUnique({ where: { userId } });
    if (!row) {
      throw new BadRequestException('TikTok account not connected');
    }

    const now = Date.now();
    if (row.expiresAt.getTime() - now > TOKEN_REFRESH_BUFFER_MS) {
      return this.encryption.decryptJson<string>(row.encryptedAccessToken);
    }

    const refreshToken = row.encryptedRefreshToken
      ? this.encryption.decryptJson<string>(row.encryptedRefreshToken)
      : null;
    if (!refreshToken) {
      return this.encryption.decryptJson<string>(row.encryptedAccessToken);
    }

    const creds = this.resolveCredentials();
    this.logger.log(`[Login OAuth refresh] userId=${userId}`);
    const tokenData = await this.api.refreshToken({
      clientKey: creds.clientKey,
      clientSecret: creds.clientSecret,
      refreshToken,
    });

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
    await this.prisma.tikTokLoginAccount.update({
      where: { userId },
      data: {
        encryptedAccessToken: this.encryption.encryptJson(tokenData.access_token),
        encryptedRefreshToken: tokenData.refresh_token
          ? this.encryption.encryptJson(tokenData.refresh_token)
          : row.encryptedRefreshToken,
        expiresAt,
        openId: tokenData.open_id ?? row.openId,
      },
    });

    return tokenData.access_token;
  }

  private async mirrorLoginToTeamAccount(
    teamId: string,
    login: {
      openId: string;
      displayName: string | null;
      encryptedAccessToken: string;
      encryptedRefreshToken: string | null;
      expiresAt: Date;
    },
  ) {
    const teamAccount = await this.prisma.tikTokAccount.upsert({
      where: { teamId },
      update: {
        status: TikTokConnectionStatus.CONNECTED,
        openId: login.openId,
        businessName: login.displayName ?? undefined,
        connectedAt: new Date(),
        lastSyncAt: new Date(),
      },
      create: {
        teamId,
        status: TikTokConnectionStatus.CONNECTED,
        openId: login.openId,
        businessName: login.displayName,
        connectedAt: new Date(),
        lastSyncAt: new Date(),
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
  }
}

/** @deprecated Use TikTokLoginService */
export type TikTokLoginKitService = TikTokLoginService;
