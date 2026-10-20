import { Injectable } from '@nestjs/common';
import { ChannelProvider, ChannelStatus } from '@watsapp/database';
import { ChannelSecretsService } from '../channels/channel-secrets.service';
import { ChannelTokenService } from '../channels/channel-token.service';
import { PrismaService } from '../prisma/prisma.service';

export type ConnectionHealth = 'connected' | 'disconnected' | 'expired' | 'reconnect_required' | 'connecting' | 'failed';

@Injectable()
export class ConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: ChannelSecretsService,
    private readonly channelTokens: ChannelTokenService,
  ) {}

  async list(teamId: string) {
    const channels = await this.prisma.channel.findMany({
      where: {
        teamId,
        status: ChannelStatus.CONNECTED,
        provider: {
          in: [ChannelProvider.META_MESSENGER, ChannelProvider.META_INSTAGRAM, ChannelProvider.TELEGRAM, ChannelProvider.TELEGRAM_USER],
        },
      },
      include: { token: true, whatsAppSession: false },
      orderBy: { createdAt: 'desc' },
    });

    const rows = await Promise.all(
      channels.map(async (channel) => {
        const metadata = this.secrets.readMetadata(channel.metadata);
        const hasCredentials =
          channel.provider === ChannelProvider.TELEGRAM_USER
            ? Boolean(channel.telegramConnectionId)
            : await this.secrets.hasCredentials(channel.id, channel.metadata);
        return {
          id: channel.id,
          provider: channel.provider,
          name: channel.name,
          status: channel.status,
          externalId: channel.externalId,
          lastSeenAt: channel.lastSeenAt,
          health: this.resolveHealth(channel.provider, channel.status, hasCredentials),
          hasCredentials,
          telegramConnectionId: channel.telegramConnectionId,
          metadata: {
            pageId: metadata.pageId,
            botId: metadata.botId,
            botUsername: metadata.botUsername,
            instagramUsername: (metadata as { instagramUsername?: string }).instagramUsername,
            profilePictureUrl: (metadata as { profilePictureUrl?: string }).profilePictureUrl,
            webhookVerified: (metadata as { webhookVerified?: boolean }).webhookVerified,
          },
          tokenExpiresAt: channel.token?.accessTokenExpiresAt ?? null,
        };
      }),
    );

    return rows.filter((row) => row.health === 'connected');
  }

  async findChannel(teamId: string, channelId: string) {
    return this.prisma.channel.findFirst({ where: { id: channelId, teamId } });
  }

  private resolveHealth(provider: ChannelProvider, status: ChannelStatus, hasCredentials: boolean): ConnectionHealth {
    if (provider === ChannelProvider.TELEGRAM_USER) {
      if (status === ChannelStatus.CONNECTED && hasCredentials) return 'connected';
      if (status === ChannelStatus.EXPIRED) return 'expired';
      return 'disconnected';
    }
    if (status === ChannelStatus.EXPIRED) return 'expired';
    if (status === ChannelStatus.CONNECTING) return 'connecting';
    if (status === ChannelStatus.FAILED) return 'failed';
    if (status === ChannelStatus.DISCONNECTED) return 'disconnected';
    if (status === ChannelStatus.CONNECTED && !hasCredentials) return 'reconnect_required';
    if (status === ChannelStatus.CONNECTED) return 'connected';
    return 'disconnected';
  }
}
