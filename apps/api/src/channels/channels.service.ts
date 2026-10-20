import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ChannelProvider, ChannelPurpose, ChannelStatus, Prisma, WhatsAppSessionStatus } from '@watsapp/database';
import { isLikelyPhoneNumber, resolveStoredPhone } from '../modules/whatsapp/utils/disconnect.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  ChannelMetadataWithPurpose,
  fromPrismaPurpose,
  isTrackingChannel,
  readChannelPurpose,
  toPrismaPurpose,
  trackingChannelMetadata,
} from './channel-purpose';
import { ChannelSecretsService } from './channel-secrets.service';

export { isTrackingChannel, readChannelPurpose, trackingChannelMetadata, fromPrismaPurpose, toPrismaPurpose };

@Injectable()
export class ChannelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: ChannelSecretsService,
  ) {}

  /** Inbox / Integrations only — never returns TikTok tracking channels. */
  async list(teamId: string) {
    const channels = await this.prisma.channel.findMany({
      where: { teamId, purpose: ChannelPurpose.INBOX },
      include: { whatsAppSession: true, token: true },
      orderBy: { createdAt: 'desc' },
    });
    return channels.map((channel) => ({
      id: channel.id,
      provider: channel.provider,
      purpose: fromPrismaPurpose(channel.purpose),
      name: channel.name,
      status: channel.status,
      externalId: channel.externalId,
      whatsAppCloudAccountId: channel.whatsAppCloudAccountId,
      lastSeenAt: channel.lastSeenAt,
      connected: channel.status === ChannelStatus.CONNECTED,
      hasCredentials:
        channel.provider === ChannelProvider.WHATSAPP_BAILEYS
          ? Boolean(channel.whatsAppSessionId)
          : channel.provider === ChannelProvider.WHATSAPP_CLOUD
            ? Boolean(channel.whatsAppCloudAccountId)
            : Boolean(channel.token) || this.secrets.hasToken(channel.metadata),
      metadata: this.publicMetadata(channel.metadata),
    }));
  }

  private publicMetadata(metadata: unknown) {
    const data = this.secrets.readMetadata(metadata as never);
    return {
      pageId: data.pageId,
      botId: data.botId,
      botUsername: data.botUsername,
      instagramUsername: data.instagramUsername,
      profilePictureUrl: data.profilePictureUrl,
      webhookVerified: data.webhookVerified,
      connectionSource: data.connectionSource,
    };
  }

  async ensureWhatsAppChannel(
    teamId: string,
    sessionId: string,
    options?: { purpose?: 'inbox' | 'tracking'; integrationId?: string },
  ) {
    const session = await this.prisma.whatsAppSession.findFirst({ where: { id: sessionId, teamId } });
    if (!session) throw new NotFoundException('WhatsApp session not found');

    const requestedPurpose = toPrismaPurpose(options?.purpose ?? fromPrismaPurpose(session.purpose));
    const existing = await this.prisma.channel.findUnique({ where: { whatsAppSessionId: sessionId } });
    if (existing) {
      if (existing.purpose !== requestedPurpose && options?.purpose) {
        throw new BadRequestException(
          `WhatsApp session is bound to ${fromPrismaPurpose(existing.purpose)} and cannot be used as ${options.purpose}`,
        );
      }
      return existing;
    }

    const isTracking = requestedPurpose === ChannelPurpose.TRACKING;
    const metadata = isTracking
      ? trackingChannelMetadata({
          integrationId: options?.integrationId,
          phoneNumber: session.phoneNumber ?? undefined,
        })
      : undefined;

    const baseExternal = session.jid ?? session.phoneNumber ?? sessionId;
    const externalId = isTracking ? `tracking:${baseExternal}` : baseExternal;

    return this.prisma.channel.create({
      data: {
        teamId,
        provider: ChannelProvider.WHATSAPP_BAILEYS,
        purpose: requestedPurpose,
        name: isTracking
          ? session.phoneNumber ?? session.displayName ?? 'WhatsApp Tracking'
          : session.displayName ?? session.phoneNumber ?? 'WhatsApp',
        status: this.mapStatus(session.status),
        externalId,
        whatsAppSessionId: session.id,
        ...(metadata ? { metadata: metadata as Prisma.InputJsonValue } : {}),
      },
    });
  }

  async listTrackingChannels(teamId: string) {
    const channels = await this.prisma.channel.findMany({
      where: {
        teamId,
        provider: ChannelProvider.WHATSAPP_BAILEYS,
        purpose: ChannelPurpose.TRACKING,
      },
      include: { whatsAppSession: true },
      orderBy: { createdAt: 'desc' },
    });

    const active: typeof channels = [];
    for (const row of channels) {
      if (!row.whatsAppSession) {
        void this.prisma.channel.delete({ where: { id: row.id } }).catch(() => undefined);
        continue;
      }
      active.push(row);
    }
    return active;
  }

  async listInboxWhatsAppChannels(teamId: string) {
    return this.prisma.channel.findMany({
      where: {
        teamId,
        provider: { in: [ChannelProvider.WHATSAPP_BAILEYS, ChannelProvider.WHATSAPP_CLOUD] },
        purpose: ChannelPurpose.INBOX,
      },
      include: { whatsAppSession: true, whatsAppCloudAccount: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteByWhatsAppSessionId(teamId: string, sessionId: string) {
    const channel = await this.prisma.channel.findUnique({ where: { whatsAppSessionId: sessionId } });
    if (channel?.teamId === teamId) {
      await this.prisma.channel.delete({ where: { id: channel.id } });
    }
  }

  async syncWhatsAppStatus(teamId: string, sessionId: string, status: WhatsAppSessionStatus, externalId?: string | null) {
    const channel = await this.ensureWhatsAppChannel(teamId, sessionId);
    const session = await this.prisma.whatsAppSession.findFirst({ where: { id: sessionId, teamId } });
    const tracking = channel.purpose === ChannelPurpose.TRACKING || isTrackingChannel(channel);
    const data: Prisma.ChannelUpdateInput = {
      status: this.mapStatus(status),
      purpose: channel.purpose,
      lastSeenAt: status === WhatsAppSessionStatus.CONNECTED ? new Date() : channel.lastSeenAt,
    };

    if (externalId) {
      data.externalId = tracking && !externalId.startsWith('tracking:') ? `tracking:${externalId}` : externalId;
    }

    if (status === WhatsAppSessionStatus.CONNECTED && session) {
      const phoneNumber = resolveStoredPhone({
        phoneNumber: session.phoneNumber,
        jid: session.jid,
        externalId: externalId ?? channel.externalId,
      });
      if (tracking) {
        if (phoneNumber) data.name = phoneNumber;
        const metadata = (channel.metadata as ChannelMetadataWithPurpose | null) ?? {};
        data.metadata = {
          ...metadata,
          purpose: 'tracking',
          connectionSource: 'tiktok_tracking',
          ...(phoneNumber ? { phoneNumber } : {}),
        } as Prisma.InputJsonValue;
      } else if (phoneNumber || session.displayName) {
        data.name = session.displayName ?? phoneNumber ?? channel.name;
      }
    }

    return this.prisma.channel.update({
      where: { id: channel.id },
      data,
    });
  }

  async updateTrackingPhoneLabel(channelId: string, phoneNumber: string) {
    const channel = await this.prisma.channel.findUnique({ where: { id: channelId } });
    if (!channel || channel.purpose !== ChannelPurpose.TRACKING || !isLikelyPhoneNumber(phoneNumber)) return;
    const metadata = (channel.metadata as ChannelMetadataWithPurpose | null) ?? {};
    await this.prisma.channel.update({
      where: { id: channelId },
      data: {
        name: phoneNumber,
        metadata: {
          ...metadata,
          purpose: 'tracking',
          connectionSource: 'tiktok_tracking',
          phoneNumber,
        } as Prisma.InputJsonValue,
      },
    });
  }

  private mapStatus(status: WhatsAppSessionStatus): ChannelStatus {
    switch (status) {
      case WhatsAppSessionStatus.CONNECTED:
        return ChannelStatus.CONNECTED;
      case WhatsAppSessionStatus.CONNECTING:
      case WhatsAppSessionStatus.PENDING_QR:
        return ChannelStatus.CONNECTING;
      case WhatsAppSessionStatus.FAILED:
        return ChannelStatus.FAILED;
      default:
        return ChannelStatus.DISCONNECTED;
    }
  }
}
