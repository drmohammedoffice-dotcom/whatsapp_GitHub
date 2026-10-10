import { Injectable, Logger } from '@nestjs/common';
import { GoogleCalendarConnectionStatus } from '@watsapp/database';
import { EncryptionService } from '../../security/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { GoogleCalendarApiClient, GoogleTokenResponse } from './google-calendar-api.client';

@Injectable()
export class GoogleCalendarTokenService {
  private readonly logger = new Logger(GoogleCalendarTokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly api: GoogleCalendarApiClient,
  ) {}

  async storeTokens(connectionId: string, tokenData: GoogleTokenResponse) {
    const accessExpiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000)
      : null;
    return this.prisma.googleCalendarToken.upsert({
      where: { connectionId },
      update: {
        encryptedAccessToken: this.encryption.encryptJson(tokenData.access_token),
        encryptedRefreshToken: tokenData.refresh_token
          ? this.encryption.encryptJson(tokenData.refresh_token)
          : undefined,
        accessTokenExpiresAt: accessExpiresAt,
        scopes: tokenData.scope ?? null,
      },
      create: {
        connectionId,
        encryptedAccessToken: this.encryption.encryptJson(tokenData.access_token),
        encryptedRefreshToken: tokenData.refresh_token
          ? this.encryption.encryptJson(tokenData.refresh_token)
          : null,
        accessTokenExpiresAt: accessExpiresAt,
        scopes: tokenData.scope ?? null,
      },
    });
  }

  async getAccessToken(teamId: string): Promise<string | null> {
    const connection = await this.prisma.googleCalendarConnection.findUnique({
      where: { teamId },
      include: { token: true },
    });
    if (!connection?.token) return null;

    const expiresAt = connection.token.accessTokenExpiresAt;
    const needsRefresh = expiresAt && expiresAt.getTime() - Date.now() < 5 * 60 * 1000;
    if (!needsRefresh) {
      return this.encryption.decryptJson<string>(connection.token.encryptedAccessToken);
    }

    if (!connection.token.encryptedRefreshToken) {
      await this.markExpired(connection.id);
      return null;
    }

    try {
      const refreshToken = this.encryption.decryptJson<string>(connection.token.encryptedRefreshToken);
      const refreshed = await this.api.refreshAccessToken(refreshToken);
      await this.storeTokens(connection.id, {
        ...refreshed,
        refresh_token: refreshed.refresh_token ?? refreshToken,
      });
      this.logger.log(`[Google Calendar] Access Token Refreshed teamId=${teamId}`);
      return refreshed.access_token;
    } catch (error) {
      this.logger.error(
        `[Appointments] Google token refresh failed teamId=${teamId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      await this.markExpired(connection.id);
      return null;
    }
  }

  private async markExpired(connectionId: string) {
    await this.prisma.googleCalendarConnection.update({
      where: { id: connectionId },
      data: { status: GoogleCalendarConnectionStatus.EXPIRED, failureReason: 'token_expired' },
    });
  }
}
