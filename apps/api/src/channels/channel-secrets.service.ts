import { Injectable } from '@nestjs/common';
import { Prisma } from '@watsapp/database';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../security/encryption.service';
import { ChannelTokenService } from './channel-token.service';

type ChannelMetadata = {
  pageId?: string;
  botId?: string;
  botUsername?: string;
  instagramUsername?: string;
  instagramBusinessAccountId?: string;
  profilePictureUrl?: string;
  webhookVerified?: boolean;
  connectionSource?: string;
  tokenEnc?: string;
};

@Injectable()
export class ChannelSecretsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly channelTokens: ChannelTokenService,
  ) {}

  async setAccessToken(channelId: string, token: string, extra: Partial<ChannelMetadata> = {}) {
    await this.channelTokens.storeTokens(channelId, { accessToken: token });
    const channel = await this.prisma.channel.findUniqueOrThrow({ where: { id: channelId } });
    const current = this.readMetadata(channel.metadata);
    const metadata: ChannelMetadata = {
      ...current,
      ...extra,
      tokenEnc: this.encryption.encryptJson(token),
    };
    await this.prisma.channel.update({
      where: { id: channelId },
      data: { metadata: metadata as Prisma.InputJsonValue },
    });
  }

  async getAccessToken(channelId: string): Promise<string | null> {
    const fromTokenTable = await this.channelTokens.getAccessToken(channelId);
    if (fromTokenTable) return fromTokenTable;

    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) return null;
    const metadata = this.readMetadata(channel.metadata);
    if (!metadata.tokenEnc) return null;
    return this.encryption.decryptJson<string>(metadata.tokenEnc);
  }

  async clearSecrets(channelId: string) {
    await this.channelTokens.deleteTokens(channelId);
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel) return;
    const metadata = this.readMetadata(channel.metadata);
    delete metadata.tokenEnc;
    await this.prisma.channel.update({
      where: { id: channelId },
      data: { metadata: metadata as Prisma.InputJsonValue },
    });
  }

  readMetadata(raw: Prisma.JsonValue | null): ChannelMetadata {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return raw as ChannelMetadata;
  }

  hasToken(raw: Prisma.JsonValue | null): boolean {
    return Boolean(this.readMetadata(raw).tokenEnc);
  }

  async hasCredentials(channelId: string, metadata: Prisma.JsonValue | null): Promise<boolean> {
    if (await this.channelTokens.hasToken(channelId)) return true;
    return this.hasToken(metadata);
  }
}
