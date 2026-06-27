import { Injectable, Logger } from '@nestjs/common';
import { MessageStatus, MessageType, WhatsAppConnectionLogEvent, WhatsAppSessionStatus } from '@watsapp/database';
import QRCode from 'qrcode';
import { ChannelMessageService } from '../../channels/channel-message.service';
import { ChannelsService } from '../../channels/channels.service';
import { BaileysProvider } from './baileys.provider';
import { QrGateway } from './qr.gateway';
import { SessionContext } from './interfaces/session.interface';
import { SessionManager } from './session.manager';
import { WhatsAppRepository } from './whatsapp.repository';
import { WhatsAppWebhookService } from './webhook.service';
import { parseDisconnectReason, phoneFromJid } from './utils/disconnect.util';
import { detectMessageType, extractMessageText, extractMediaInfo } from './utils/message.util';
import { LocalStorageService } from '../../storage/local-storage.service';

@Injectable()
export class WhatsAppEventsService {
  private readonly logger = new Logger(WhatsAppEventsService.name);

  constructor(
    private readonly repository: WhatsAppRepository,
    private readonly sessionManager: SessionManager,
    private readonly baileysProvider: BaileysProvider,
    private readonly qrGateway: QrGateway,
    private readonly channels: ChannelsService,
    private readonly channelMessages: ChannelMessageService,
    private readonly webhooks: WhatsAppWebhookService,
    private readonly storage: LocalStorageService,
  ) {}

  bindSocket(
    context: SessionContext,
    socketBundle: Awaited<ReturnType<BaileysProvider['createSocket']>>,
    restored = false,
  ) {
    const { socket, saveCreds } = socketBundle;
    socket.ev.on('creds.update', saveCreds);
    socket.ev.on('connection.update', (...args: any[]) => {
      void this.handleConnectionUpdate(context, socket, args[0] as Record<string, unknown>, restored);
    });
    socket.ev.on('messages.upsert', (...args: any[]) => {
      void this.handleMessagesUpsert(context, args[0] as { messages?: unknown[] });
    });
    socket.ev.on('messages.update', (...args: any[]) => {
      void this.handleMessagesUpdate(context, args[0] as unknown[]);
    });
    socket.ev.on('presence.update', (...args: any[]) => {
      void this.handlePresenceUpdate(context, args[0] as Record<string, unknown>);
    });
    socket.ev.on('contacts.update', (...args: any[]) => {
      void this.handleContactsUpdate(context, args[0] as unknown[]);
    });
  }

  private async handleConnectionUpdate(
    context: SessionContext,
    socket: Awaited<ReturnType<BaileysProvider['createSocket']>>['socket'],
    update: Record<string, unknown>,
    restored: boolean,
  ) {
    const { teamId, sessionId } = context;

    if (update.qr) {
      const qrCode = await QRCode.toDataURL(String(update.qr));
      const expiresAt = new Date(Date.now() + 60_000).toISOString();
      await this.repository.updateSession(sessionId, {
        status: WhatsAppSessionStatus.PENDING_QR,
        qrCode,
        qrCodeUpdatedAt: new Date(),
        failureReason: null,
      });
      await this.channels.syncWhatsAppStatus(teamId, sessionId, WhatsAppSessionStatus.PENDING_QR);
      await this.repository.logConnection({
        teamId,
        sessionId,
        event: WhatsAppConnectionLogEvent.QR_GENERATED,
        message: 'QR code generated',
      });
      this.qrGateway.emitQrGenerated(teamId, { sessionId, qrCode, expiresAt });
      this.qrGateway.emitStatus(teamId, sessionId, WhatsAppSessionStatus.PENDING_QR);
    }

    if (update.connection === 'open') {
      this.sessionManager.clearReconnect(sessionId);
      const jid = socket.user?.id ?? null;
      const phoneNumber = phoneFromJid(jid);
      const profilePhotoUrl = jid ? await this.baileysProvider.fetchProfilePhoto(socket, jid) : null;
      await this.repository.updateSession(sessionId, {
        status: WhatsAppSessionStatus.CONNECTED,
        jid,
        phoneNumber,
        profilePhotoUrl,
        displayName: socket.user?.name ?? undefined,
        connectedAt: new Date(),
        lastSeenAt: new Date(),
        qrCode: null,
        failureReason: null,
      });
      await this.channels.syncWhatsAppStatus(teamId, sessionId, WhatsAppSessionStatus.CONNECTED, jid ?? undefined);
      await this.repository.logConnection({
        teamId,
        sessionId,
        event: restored ? WhatsAppConnectionLogEvent.SESSION_RESTORED : WhatsAppConnectionLogEvent.CONNECTED,
        message: restored ? 'Session restored after restart' : 'WhatsApp connected successfully',
        metadata: { jid, phoneNumber },
      });
      if (restored) this.qrGateway.emitSessionRestored(teamId, { sessionId, status: WhatsAppSessionStatus.CONNECTED });
      else this.qrGateway.emitConnected(teamId, { sessionId, status: WhatsAppSessionStatus.CONNECTED });
      this.sessionManager.startHeartbeat(context);
    }

    if (update.connection === 'close') {
      this.sessionManager.removeSocket(sessionId);
      this.sessionManager.clearHeartbeat(sessionId);
      const lastDisconnect = update.lastDisconnect as { error?: unknown } | undefined;
      const info = parseDisconnectReason(lastDisconnect?.error);
      const status = info.isLoggedOut ? WhatsAppSessionStatus.FAILED : WhatsAppSessionStatus.DISCONNECTED;
      await this.repository.updateSession(sessionId, {
        status,
        disconnectedAt: new Date(),
        failureReason: info.message,
        ...(info.isLoggedOut ? { qrCode: null } : {}),
      });
      await this.channels.syncWhatsAppStatus(teamId, sessionId, status);
      await this.repository.logConnection({
        teamId,
        sessionId,
        event: info.isLoggedOut ? WhatsAppConnectionLogEvent.LOGGED_OUT : WhatsAppConnectionLogEvent.DISCONNECTED,
        message: info.message,
        metadata: { code: info.code },
      });
      this.qrGateway.emitDisconnected(teamId, { sessionId, status, failureReason: info.message });

      if (info.shouldReconnect) {
        await this.repository.updateSession(sessionId, { status: WhatsAppSessionStatus.CONNECTING });
        await this.repository.logConnection({
          teamId,
          sessionId,
          event: WhatsAppConnectionLogEvent.RECONNECTING,
          message: 'Scheduling automatic reconnect',
        });
        this.qrGateway.emitReconnecting(teamId, { sessionId, status: WhatsAppSessionStatus.CONNECTING });
        this.sessionManager.scheduleReconnect(context);
      }
    }
  }

  private async handleMessagesUpsert(context: SessionContext, event: { messages?: unknown[] }) {
    for (const raw of event.messages ?? []) await this.persistIncoming(context, raw as Record<string, unknown>);
  }

  private async handleMessagesUpdate(context: SessionContext, updates: unknown[]) {
    for (const update of updates) {
      const item = update as { key?: { id?: string }; update?: { status?: number } };
      const providerMessageId = item.key?.id;
      if (!providerMessageId) continue;
      const statusCode = item.update?.status;
      let messageStatus: MessageStatus | undefined;
      if (statusCode === 3) messageStatus = MessageStatus.DELIVERED;
      if (statusCode === 4) messageStatus = MessageStatus.READ;
      if (!messageStatus) continue;
      await this.repository.updateMessageStatus(context.sessionId, providerMessageId, messageStatus);
      await this.webhooks.deliveryStatus(context.teamId, {
        sessionId: context.sessionId,
        providerMessageId,
        status: messageStatus,
      });
    }
  }

  private async handlePresenceUpdate(context: SessionContext, update: Record<string, unknown>) {
    await this.repository.updateSession(context.sessionId, { lastSeenAt: new Date() });
    await this.repository.logConnection({
      teamId: context.teamId,
      sessionId: context.sessionId,
      event: WhatsAppConnectionLogEvent.PRESENCE_UPDATED,
      metadata: update,
    });
    await this.webhooks.presence(context.teamId, { sessionId: context.sessionId, ...update });
  }

  private async handleContactsUpdate(context: SessionContext, contacts: unknown[]) {
    for (const contact of contacts) {
      const item = contact as { id?: string; notify?: string; name?: string };
      if (!item.id) continue;
      await this.repository.upsertWhatsAppContact({
        teamId: context.teamId,
        sessionId: context.sessionId,
        providerContactId: item.id,
        displayName: item.notify ?? item.name ?? null,
        phoneNumber: phoneFromJid(item.id),
      });
    }
    await this.repository.logConnection({
      teamId: context.teamId,
      sessionId: context.sessionId,
      event: WhatsAppConnectionLogEvent.CONTACTS_UPDATED,
      message: `${contacts.length} contacts updated`,
    });
  }

  private async persistIncoming(context: SessionContext, raw: Record<string, unknown>) {
    const key = raw.key as
      | {
          remoteJid?: string;
          remoteJidAlt?: string;
          id?: string;
          fromMe?: boolean;
          participant?: string;
          participantAlt?: string;
        }
      | undefined;
    const providerChatId = key?.remoteJid;
    const providerMessageId = key?.id;
    if (!providerChatId || !providerMessageId || key?.fromMe) return;

    const senderPhone = this.extractSenderPhone(key);

    const messageContent = raw.message as Record<string, unknown> | undefined;
    const text = extractMessageText(messageContent);
    const type = detectMessageType(messageContent);
    const chat = await this.repository.upsertChat({
      teamId: context.teamId,
      sessionId: context.sessionId,
      providerChatId,
    });
    const timestamp = Number(raw.messageTimestamp || Date.now());
    const receivedAt = new Date(timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp);

    const media = await this.downloadIncomingMedia(context, raw, messageContent, type);

    const saved = await this.repository.upsertInboundMessage({
      teamId: context.teamId,
      sessionId: context.sessionId,
      chatId: chat.id,
      providerMessageId,
      fromJid: key?.participant ?? providerChatId,
      type,
      text,
      payload: messageContent ?? {},
      receivedAt,
    });
    const channel = await this.channels.ensureWhatsAppChannel(context.teamId, context.sessionId);
    await this.channelMessages.ingest({
      teamId: context.teamId,
      channelId: channel.id,
      externalIdentityId: providerChatId,
      senderPhone,
      displayName: raw.pushName as string | undefined,
      providerMessageId,
      sourceMessageId: saved.id,
      direction: 'INBOUND',
      type,
      status: MessageStatus.RECEIVED,
      text,
      payload: messageContent ?? {},
      mediaStorageKey: media?.storageKey ?? null,
      mediaMimeType: media?.mimeType ?? null,
      mediaFileName: media?.fileName ?? null,
      mediaSizeBytes: media?.sizeBytes ?? null,
      occurredAt: saved.receivedAt ?? saved.createdAt,
    });
    await this.webhooks.incomingMessage(context.teamId, saved);
    await this.repository.logConnection({
      teamId: context.teamId,
      sessionId: context.sessionId,
      event: WhatsAppConnectionLogEvent.MESSAGE_RECEIVED,
      message: `Message ${providerMessageId}`,
    });
    this.qrGateway.emitMessageReceived(context.teamId, {
      sessionId: context.sessionId,
      messageId: saved.id,
      chatId: saved.chatId,
      fromJid: key?.participant ?? providerChatId,
      text,
      type,
      receivedAt: (saved.receivedAt ?? saved.createdAt).toISOString(),
    });
  }

  private extractSenderPhone(key?: {
    remoteJid?: string;
    remoteJidAlt?: string;
    participant?: string;
    participantAlt?: string;
  }): string | null {
    if (!key) return null;
    const candidates = [key.remoteJid, key.remoteJidAlt, key.participant, key.participantAlt];
    const phoneJid = candidates.find((jid) => jid && jid.includes('@s.whatsapp.net'));
    return phoneJid ? phoneFromJid(phoneJid) : null;
  }

  private async downloadIncomingMedia(
    context: SessionContext,
    raw: Record<string, unknown>,
    messageContent: Record<string, unknown> | undefined,
    type: MessageType,
  ) {
    const mediaTypes: MessageType[] = [MessageType.IMAGE, MessageType.VIDEO, MessageType.AUDIO, MessageType.DOCUMENT, MessageType.STICKER];
    if (!mediaTypes.includes(type)) return null;
    const info = extractMediaInfo(messageContent);
    if (!info) return null;
    const socket = this.sessionManager.getSocket(context.sessionId);
    if (!socket) return null;
    try {
      const buffer = await this.baileysProvider.downloadMedia(socket, raw);
      if (!buffer || buffer.length === 0) return null;
      const stored = await this.storage.putBuffer(context.teamId, buffer, info.mimeType ?? 'application/octet-stream', info.fileName ?? undefined);
      return {
        storageKey: stored.storageKey,
        mimeType: info.mimeType ?? 'application/octet-stream',
        fileName: info.fileName,
        sizeBytes: stored.sizeBytes,
      };
    } catch (error) {
      this.logger.warn(`Unable to persist incoming media for session ${context.sessionId}: ${String(error)}`);
      return null;
    }
  }
}
