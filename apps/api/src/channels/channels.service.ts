import { Injectable, NotFoundException } from '@nestjs/common';
import { ChannelProvider, ChannelStatus, WhatsAppSessionStatus } from '@watsapp/database';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelSecretsService } from './channel-secrets.service';

@Injectable()
export class ChannelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: ChannelSecretsService,
  ) {}

  async list(teamId: string) {
    const channels = await this.prisma.channel.findMany({
      where: { teamId },
      include: { whatsAppSession: true },
      orderBy: { createdAt: 'desc' },
    });
    return channels.map((channel) => ({
      id: channel.id,
      provider: channel.provider,
      name: channel.name,
      status: channel.status,
      externalId: channel.externalId,
      lastSeenAt: channel.lastSeenAt,
      connected: channel.status === ChannelStatus.CONNECTED,
      hasCredentials: channel.provider === ChannelProvider.WHATSAPP_BAILEYS
        ? Boolean(channel.whatsAppSessionId)
        : this.secrets.hasToken(channel.metadata),
      metadata: this.publicMetadata(channel.metadata),
    }));
  }

  private publicMetadata(metadata: unknown) {
    const data = this.secrets.readMetadata(metadata as never);
    return {
      pageId: data.pageId,
      botId: data.botId,
      botUsername: data.botUsername,
    };
  }

  async ensureWhatsAppChannel(teamId: string, sessionId: string) {
    const session = await this.prisma.whatsAppSession.findFirst({ where: { id: sessionId, teamId } });
    if (!session) throw new NotFoundException('WhatsApp session not found');
    const existing = await this.prisma.channel.findUnique({ where: { whatsAppSessionId: sessionId } });
    if (existing) return existing;
    return this.prisma.channel.create({
      data: {
        teamId,
        provider: ChannelProvider.WHATSAPP_BAILEYS,
        name: session.displayName ?? session.phoneNumber ?? 'WhatsApp',
        status: this.mapStatus(session.status),
        externalId: session.jid ?? session.phoneNumber ?? sessionId,
        whatsAppSessionId: session.id,
      },
    });
  }

  async syncWhatsAppStatus(teamId: string, sessionId: string, status: WhatsAppSessionStatus, externalId?: string | null) {
    const channel = await this.ensureWhatsAppChannel(teamId, sessionId);
    return this.prisma.channel.update({
      where: { id: channel.id },
      data: { status: this.mapStatus(status), externalId: externalId ?? channel.externalId, lastSeenAt: status === WhatsAppSessionStatus.CONNECTED ? new Date() : channel.lastSeenAt },
    });
  }

  private mapStatus(status: WhatsAppSessionStatus): ChannelStatus {
    if (status === WhatsAppSessionStatus.CONNECTED) return ChannelStatus.CONNECTED;
    if (status === WhatsAppSessionStatus.CONNECTING || status === WhatsAppSessionStatus.PENDING_QR) return ChannelStatus.CONNECTING;
    if (status === WhatsAppSessionStatus.FAILED) return ChannelStatus.FAILED;
    return ChannelStatus.DISCONNECTED;
  }
}
