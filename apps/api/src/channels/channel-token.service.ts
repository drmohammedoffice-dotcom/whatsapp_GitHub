import { Injectable, Logger } from '@nestjs/common';
import { ChannelStatus } from '@watsapp/database';
import { EncryptionService } from '../security/encryption.service';
import { PrismaService } from '../prisma/prisma.service';

export type ChannelTokenInput = {
  accessToken: string;
  refreshToken?: string | null;
  accessTokenExpiresAt?: Date | null;
  refreshTokenExpiresAt?: Date | null;
  scopes?: string | null;
};

@Injectable()
export class ChannelTokenService {
  private readonly logger = new Logger(ChannelTokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async storeTokens(channelId: string, data: ChannelTokenInput) {
    return this.prisma.channelToken.upsert({
      where: { channelId },
      update: {
        encryptedAccessToken: this.encryption.encryptJson(data.accessToken),
        encryptedRefreshToken: data.refreshToken ? this.encryption.encryptJson(data.refreshToken) : null,
        accessTokenExpiresAt: data.accessTokenExpiresAt ?? null,
        refreshTokenExpiresAt: data.refreshTokenExpiresAt ?? null,
        scopes: data.scopes ?? null,
        lastRefreshedAt: new Date(),
      },
      create: {
        channelId,
        encryptedAccessToken: this.encryption.encryptJson(data.accessToken),
        encryptedRefreshToken: data.refreshToken ? this.encryption.encryptJson(data.refreshToken) : null,
        accessTokenExpiresAt: data.accessTokenExpiresAt ?? null,
        refreshTokenExpiresAt: data.refreshTokenExpiresAt ?? null,
        scopes: data.scopes ?? null,
        lastRefreshedAt: new Date(),
      },
    });
  }

  async getAccessToken(channelId: string): Promise<string | null> {
    const row = await this.prisma.channelToken.findUnique({ where: { channelId } });
    if (!row) return null;

    const expiresAt = row.accessTokenExpiresAt;
    if (expiresAt && expiresAt.getTime() <= Date.now()) {
      await this.markExpired(channelId);
      return null;
    }

    return this.encryption.decryptJson<string>(row.encryptedAccessToken);
  }

  async deleteTokens(channelId: string) {
    await this.prisma.channelToken.deleteMany({ where: { channelId } });
  }

  async hasToken(channelId: string): Promise<boolean> {
    const row = await this.prisma.channelToken.findUnique({ where: { channelId } });
    return Boolean(row);
  }

  private async markExpired(channelId: string) {
    await this.prisma.channel.update({
      where: { id: channelId },
      data: { status: ChannelStatus.EXPIRED },
    });
    this.logger.warn(`Channel ${channelId} token expired`);
  }
}
