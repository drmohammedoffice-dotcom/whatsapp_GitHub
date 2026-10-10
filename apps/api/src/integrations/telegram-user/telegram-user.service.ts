import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ChannelStatus, TelegramConnectionStatus } from '@watsapp/database';
import { TelegramClient } from 'telegram';
import { Api } from 'telegram/tl';
import { EncryptionService } from '../../security/encryption.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramClientManager } from './telegram-client.manager';
import { TelegramUserEventsService } from './telegram-user-events.service';
import { TelegramUserSyncService } from './telegram-user-sync.service';

@Injectable()
export class TelegramUserService implements OnModuleInit {
  private readonly logger = new Logger(TelegramUserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly clients: TelegramClientManager,
    private readonly events: TelegramUserEventsService,
    private readonly syncService: TelegramUserSyncService,
  ) {}

  async onModuleInit() {
    if (!this.clients.isConfigured()) {
      this.logger.warn('Telegram MTProto not configured — skipping session restore');
      return;
    }
    this.logger.log('Telegram MTProto configured — checking stored sessions');
    const connections = await this.prisma.telegramConnection.findMany({
      where: { status: TelegramConnectionStatus.CONNECTED, encryptedSession: { not: null } },
      include: { channel: true },
    });
    for (const connection of connections) {
      try {
        await this.restoreConnection(connection.id);
      } catch (error) {
        this.logger.error(`Failed to restore Telegram ${connection.id}: ${error instanceof Error ? error.message : String(error)}`);
        await this.prisma.telegramConnection.update({
          where: { id: connection.id },
          data: { status: TelegramConnectionStatus.EXPIRED, failureReason: 'Session restore failed' },
        });
      }
    }
  }

  isConfigured() {
    return this.clients.isConfigured();
  }

  async getStatus(teamId: string) {
    const connections = await this.prisma.telegramConnection.findMany({
      where: { teamId, status: TelegramConnectionStatus.CONNECTED },
      include: { channel: true },
      orderBy: { createdAt: 'desc' },
    });
    return {
      configured: this.clients.isConfigured(),
      connections: connections.map((c) => ({
        id: c.id,
        channelId: c.channel?.id ?? null,
        phoneNumber: c.phoneNumber,
        telegramUserId: c.telegramUserId,
        firstName: c.firstName,
        lastName: c.lastName,
        username: c.username,
        profilePhotoUrl: c.profilePhotoUrl,
        status: c.status,
        connectedAt: c.connectedAt,
        lastSyncAt: c.lastSyncAt,
        lastSeenAt: c.lastSeenAt,
        live: this.clients.getClient(c.id) !== undefined,
      })),
    };
  }

  async restoreConnection(connectionId: string) {
    const connection = await this.prisma.telegramConnection.findUnique({
      where: { id: connectionId },
      include: { channel: true },
    });
    if (!connection?.encryptedSession || !connection.channel) {
      throw new NotFoundException('Telegram connection not found');
    }

    await this.clients.removeClient(connectionId);
    const session = this.encryption.decryptJson<string>(connection.encryptedSession);
    const client = await this.clients.createClient(session);
    this.clients.setClient(connectionId, client);
    await this.events.attachHandlers(connectionId, client, connection.channel.id, connection.teamId);
    void this.warmPeerCache(connectionId, client, connection.teamId, connection.channel!.id);

    await this.prisma.telegramConnection.update({
      where: { id: connectionId },
      data: { status: TelegramConnectionStatus.CONNECTED, lastSeenAt: new Date(), failureReason: null },
    });
    if (connection.channel) {
      await this.prisma.channel.update({
        where: { id: connection.channel.id },
        data: { status: ChannelStatus.CONNECTED, lastSeenAt: new Date() },
      });
    }
    return { restored: true };
  }

  async disconnect(teamId: string, connectionId: string) {
    const connection = await this.prisma.telegramConnection.findFirst({
      where: { id: connectionId, teamId },
      include: { channel: true },
    });
    if (!connection) throw new NotFoundException('Telegram connection not found');

    await this.clients.removeClient(connectionId);
    await this.prisma.telegramConnection.update({
      where: { id: connectionId },
      data: {
        status: TelegramConnectionStatus.DISCONNECTED,
        encryptedSession: null,
        failureReason: null,
      },
    });
    if (connection.channel) {
      await this.prisma.channel.update({
        where: { id: connection.channel.id },
        data: { status: ChannelStatus.DISCONNECTED },
      });
    }
    return { disconnected: true };
  }

  async syncChats(teamId: string, connectionId: string) {
    const connection = await this.prisma.telegramConnection.findFirst({
      where: { id: connectionId, teamId, status: TelegramConnectionStatus.CONNECTED },
    });
    if (!connection) throw new NotFoundException('Connected Telegram account not found');
    return this.syncService.syncConnection(connectionId);
  }

  getClient(connectionId: string) {
    return this.clients.getClient(connectionId);
  }

  async persistSession(connectionId: string) {
    const client = this.clients.getClient(connectionId);
    if (!client) return;
    const sessionString = this.clients.saveSessionString(client);
    await this.prisma.telegramConnection.update({
      where: { id: connectionId },
      data: { encryptedSession: this.encryption.encryptJson(sessionString), lastSeenAt: new Date() },
    });
  }

  async sendText(connectionId: string, peerId: string, text: string, hint?: TelegramPeerHint) {
    const client = this.clients.getClient(connectionId);
    if (!client) throw new NotFoundException('Telegram client is not connected');
    const target = await this.resolveSendTarget(client, connectionId, peerId, hint);
    const result = await client.sendMessage(target, {
      message: text,
      ...(hint?.replyToMessageId ? { replyTo: Number(hint.replyToMessageId) } : {}),
    });
    return { messageId: String(result.id) };
  }

  async sendMedia(
    connectionId: string,
    peerId: string,
    buffer: Buffer,
    options: { caption?: string; fileName?: string; voiceNote?: boolean; hint?: TelegramPeerHint },
  ) {
    const client = this.clients.getClient(connectionId);
    if (!client) throw new NotFoundException('Telegram client is not connected');
    const target = await this.resolveSendTarget(client, connectionId, peerId, options.hint);
    const result = await client.sendFile(target, {
      file: buffer,
      caption: options.caption,
      attributes: options.voiceNote
        ? [new Api.DocumentAttributeAudio({ voice: true, duration: 0 })]
        : undefined,
    });
    return { messageId: String(result.id) };
  }

  private async resolveSendTarget(
    client: TelegramClient,
    connectionId: string,
    peerId: string,
    hint?: TelegramPeerHint,
  ) {
    const cached = this.clients.getCachedPeer(connectionId, peerId);
    const accessHash = hint?.accessHash ?? cached?.accessHash;
    const username = hint?.username ?? cached?.username;

    if (username?.trim()) {
      return username.replace(/^@/, '');
    }

    if (accessHash) {
      return new Api.InputPeerUser({
        userId: BigInt(peerId) as never,
        accessHash: BigInt(accessHash) as never,
      });
    }

    try {
      const dialogEntity = await this.findDialogEntity(client, peerId);
      if (dialogEntity) return dialogEntity;
    } catch (error) {
      this.logger.warn(`Telegram dialog lookup failed for ${peerId}: ${error instanceof Error ? error.message : String(error)}`);
    }

    try {
      return await client.getInputEntity(peerId);
    } catch {
      // fall through
    }

    throw new NotFoundException(`Could not resolve Telegram peer ${peerId}`);
  }

  private async warmPeerCache(connectionId: string, client: TelegramClient, teamId: string, channelId: string) {
    try {
      const dialogs = await client.getDialogs({ limit: 200 });
      for (const dialog of dialogs) {
        const entity = dialog.entity;
        if (entity instanceof Api.User && entity.accessHash != null) {
          this.clients.cachePeer(connectionId, String(entity.id), String(entity.accessHash), entity.username);
        }
      }

      const identities = await this.prisma.contactIdentity.findMany({
        where: { teamId, channelId },
        select: { externalId: true },
        take: 200,
      });
      for (const identity of identities) {
        if (this.clients.getCachedPeer(connectionId, identity.externalId)) continue;
        try {
          const entity = await client.getEntity(identity.externalId);
          if (entity instanceof Api.User && entity.accessHash != null) {
            this.clients.cachePeer(connectionId, identity.externalId, String(entity.accessHash), entity.username);
          }
        } catch {
          // skip unresolved contacts
        }
      }

      this.logger.log(`Warmed Telegram peer cache for ${connectionId} (${dialogs.length} dialogs)`);
    } catch (error) {
      this.logger.warn(`Failed to warm Telegram peer cache for ${connectionId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async findDialogEntity(client: TelegramClient, peerId: string) {
    const dialogs = await client.getDialogs({ limit: 200 });
    for (const dialog of dialogs) {
      const entity = dialog.entity;
      if (!entity || !('id' in entity)) continue;
      if (String(entity.id) === peerId) return entity;
    }
    return null;
  }
}

export type TelegramPeerHint = {
  accessHash?: string | null;
  username?: string | null;
  replyToMessageId?: string | null;
};
