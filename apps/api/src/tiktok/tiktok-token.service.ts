import { Injectable, Logger } from '@nestjs/common';
import { TikTokConnectionStatus } from '@watsapp/database';
import { EncryptionService } from '../security/encryption.service';
import { PrismaService } from '../prisma/prisma.service';
import { TikTokApiClient, TikTokTokenResponse } from './tiktok-api.client';
import { TikTokLogService } from './tiktok-log.service';

@Injectable()
export class TikTokTokenService {
  private readonly logger = new Logger(TikTokTokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly api: TikTokApiClient,
    private readonly logs: TikTokLogService,
  ) {}

  async storeTokens(accountId: string, tokenData: TikTokTokenResponse) {
    const accessExpiresAt = tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : null;
    const refreshExpiresAt = tokenData.refresh_token_expires_in
      ? new Date(Date.now() + tokenData.refresh_token_expires_in * 1000)
      : null;
    return this.prisma.tikTokToken.upsert({
      where: { accountId },
      update: {
        encryptedAccessToken: this.encryption.encryptJson(tokenData.access_token),
        encryptedRefreshToken: tokenData.refresh_token
          ? this.encryption.encryptJson(tokenData.refresh_token)
          : null,
        accessTokenExpiresAt: accessExpiresAt,
        refreshTokenExpiresAt: refreshExpiresAt,
        scopes: tokenData.scope ?? null,
      },
      create: {
        accountId,
        encryptedAccessToken: this.encryption.encryptJson(tokenData.access_token),
        encryptedRefreshToken: tokenData.refresh_token
          ? this.encryption.encryptJson(tokenData.refresh_token)
          : null,
        accessTokenExpiresAt: accessExpiresAt,
        refreshTokenExpiresAt: refreshExpiresAt,
        scopes: tokenData.scope ?? null,
      },
    });
  }

  async getAccessToken(teamId: string): Promise<string | null> {
    const account = await this.prisma.tikTokAccount.findUnique({
      where: { teamId },
      include: { token: true },
    });
    if (!account?.token) return null;

    const expiresAt = account.token.accessTokenExpiresAt;
    const needsRefresh = expiresAt && expiresAt.getTime() - Date.now() < 5 * 60 * 1000;
    if (!needsRefresh) {
      return this.encryption.decryptJson<string>(account.token.encryptedAccessToken);
    }

    if (!account.token.encryptedRefreshToken) {
      await this.markExpired(teamId, account.id);
      return null;
    }

    try {
      const refreshToken = this.encryption.decryptJson<string>(account.token.encryptedRefreshToken);
      const refreshed = await this.api.refreshAccessToken(refreshToken);
      await this.storeTokens(account.id, refreshed);
      await this.logs.info(teamId, 'oauth.refresh', 'TikTok access token refreshed');
      return refreshed.access_token;
    } catch (error) {
      await this.markExpired(teamId, account.id);
      await this.logs.error(teamId, 'oauth.refresh', 'Failed to refresh TikTok token', {
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async markExpired(teamId: string, accountId: string) {
    await this.prisma.tikTokAccount.update({
      where: { id: accountId },
      data: { status: TikTokConnectionStatus.EXPIRED },
    });
    await this.logs.warn(teamId, 'oauth.expired', 'TikTok token expired');
  }
}
