import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ChannelPurpose, MessageDirection, MessageStatus, MessageType, WhatsAppConnectionLogEvent, WhatsAppSessionStatus } from '@watsapp/database';
import QRCode from 'qrcode';
import { ChannelMessageService } from '../../channels/channel-message.service';
import { ChannelsService } from '../../channels/channels.service';
import { isTrackingChannel } from '../../channels/channel-purpose';
import { TikTokIntegrationTrackingService } from '../../tiktok-integration/tiktok-integration-tracking.service';
import { BaileysProvider } from './baileys.provider';
import { QrGateway } from './qr.gateway';
import { SessionContext } from './interfaces/session.interface';
import { SessionManager } from './session.manager';
import { WhatsAppRepository } from './whatsapp.repository';
import { WhatsAppWebhookService } from './webhook.service';
import { parseDisconnectReason, phoneFromJid } from './utils/disconnect.util';
import { detectMessageType, extractMessageText, extractMediaInfo, unwrapMessage } from './utils/message.util';
import { LocalStorageService } from '../../storage/local-storage.service';

/** Silence window for TikTok Contact once-per-conversation (tracking-only). */
const TRACKING_CONTACT_WINDOW_MS = 24 * 60 * 60 * 1000;

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
    private readonly tiktokTracking: TikTokIntegrationTrackingService,
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
      void this.handleMessagesUpsert(context, args[0] as { messages?: unknown[]; type?: string });
    });
    socket.ev.on('messaging-history.set', (...args: any[]) => {
      void this.handleHistorySync(context, args[0] as { messages?: unknown[] });
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
      const phoneNumber = await this.resolveConnectedPhone(socket);
      const profilePhotoUrl = jid ? await this.baileysProvider.fetchProfilePhoto(socket, jid) : null;
      if (phoneNumber) {
        const session = await this.repository.findSessionForTeam(teamId, sessionId);
        await this.repository.clearPhoneForOtherSessions(
          teamId,
          sessionId,
          phoneNumber,
          session?.purpose ?? ChannelPurpose.INBOX,
        );
      }
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
      // Bind every tracking WhatsApp number to its pixel so Contact+Lead fire on all of them.
      const connectedSession = await this.repository.findSessionForTeam(teamId, sessionId);
      if (connectedSession?.purpose === ChannelPurpose.TRACKING) {
        await this.tiktokTracking
          .syncTrackingPhoneOnConnect(teamId, sessionId, phoneNumber)
          .catch((err) =>
            this.logger.warn(
              `[TikTokTracking] phone sync failed session=${sessionId}: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
      }
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

        const session = await this.repository.findSessionForTeam(teamId, sessionId);
        const purpose = session?.purpose ?? ChannelPurpose.INBOX;
        let preferFast = purpose === ChannelPurpose.INBOX;
        let preferSlow = purpose === ChannelPurpose.TRACKING;

        if (info.isConnectionReplaced && session?.phoneNumber) {
          const siblingPurpose =
            purpose === ChannelPurpose.INBOX ? ChannelPurpose.TRACKING : ChannelPurpose.INBOX;
          const sibling = await this.repository.findSiblingSessionByPhone(
            teamId,
            sessionId,
            session.phoneNumber,
            siblingPurpose,
          );
          if (sibling && purpose === ChannelPurpose.TRACKING) {
            preferSlow = true;
            preferFast = false;
            this.logger.warn(
              `[WhatsApp] Tracking session ${sessionId} deferred reconnect — Inbox sibling ${sibling.id} owns phone ${session.phoneNumber}`,
            );
          }
          if (sibling && purpose === ChannelPurpose.INBOX) {
            preferFast = true;
            preferSlow = false;
            this.logger.warn(
              `[WhatsApp] Inbox session ${sessionId} prioritized reconnect over tracking sibling ${sibling.id} for phone ${session.phoneNumber}`,
            );
          }
        }

        this.sessionManager.scheduleReconnect(context, {
          connectionReplaced: info.isConnectionReplaced,
          preferFast,
          preferSlow,
        });
      }
    }
  }

  private async handleMessagesUpsert(context: SessionContext, event: { messages?: unknown[]; type?: string }) {
    for (const raw of event.messages ?? []) {
      await this.persistIncoming(context, raw as Record<string, unknown>, event.type);
    }
  }

  /**
   * WhatsApp streams prior conversations through `messaging-history.set` after a
   * fresh link (we enable `syncFullHistory`). Persist those messages so chats
   * that existed before connecting the account show up in the inbox. History is
   * stored quietly: no AI auto-replies, no unread bumps, no per-message events.
   */
  /**
   * History sync is Inbox-only. TikTok tracking sessions must never import chats
   * into the Unified Inbox / CRM.
   */
  private async handleHistorySync(context: SessionContext, event: { messages?: unknown[] }) {
    const messages = event?.messages ?? [];
    if (!messages.length) return;
    const channel = await this.channels.ensureWhatsAppChannel(context.teamId, context.sessionId);
    if (channel.purpose === ChannelPurpose.TRACKING || isTrackingChannel(channel)) {
      this.logger.debug(`Skipping history sync for TikTok tracking session ${context.sessionId}`);
      return;
    }
    let imported = 0;
    for (const raw of messages) {
      try {
        if (await this.persistHistorical(context, channel.id, raw as Record<string, unknown>)) imported += 1;
      } catch (error) {
        this.logger.debug(`Skipped a historical message: ${String(error)}`);
      }
    }
    if (imported > 0) {
      this.channelMessages.emitConversationsRefreshed(context.teamId);
      this.logger.log(`Synced ${imported} historical WhatsApp message(s) for session ${context.sessionId}`);
    }
  }

  private async persistHistorical(context: SessionContext, channelId: string, raw: Record<string, unknown>): Promise<boolean> {
    const key = raw.key as { remoteJid?: string; id?: string; fromMe?: boolean; participant?: string; participantAlt?: string; remoteJidAlt?: string } | undefined;
    const providerChatId = key?.remoteJid;
    const providerMessageId = key?.id;
    if (!providerChatId || !providerMessageId) return false;
    // Only sync real 1:1 customer chats into history. Status, broadcast,
    // newsletters and group chats flood the support inbox and make it unusable.
    if (
      providerChatId === 'status@broadcast' ||
      providerChatId.endsWith('@newsletter') ||
      providerChatId.endsWith('@broadcast') ||
      providerChatId.endsWith('@g.us')
    ) {
      return false;
    }

    const messageContent = raw.message as Record<string, unknown> | undefined;
    if (!messageContent) return false;
    const text = extractMessageText(messageContent);
    const type = detectMessageType(messageContent);
    // Nothing meaningful to show (e.g. protocol/system stubs).
    if (!text && type === MessageType.TEXT) return false;

    const fromMe = Boolean(key?.fromMe);
    const timestamp = Number(raw.messageTimestamp || Date.now());
    const occurredAt = new Date(timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp);

    await this.repository.upsertChat({ teamId: context.teamId, sessionId: context.sessionId, providerChatId });
    let senderPhone = this.extractSenderPhone(key);
    if (!senderPhone && providerChatId.includes('@lid')) {
      const socket = this.sessionManager.getSocket(context.sessionId);
      senderPhone = await this.resolvePhoneFromLid(socket, providerChatId);
    }
    await this.channelMessages.ingest({
      teamId: context.teamId,
      channelId,
      externalIdentityId: providerChatId,
      senderPhone,
      displayName: raw.pushName as string | undefined,
      providerMessageId,
      direction: fromMe ? 'OUTBOUND' : 'INBOUND',
      type,
      status: fromMe ? MessageStatus.SENT : MessageStatus.RECEIVED,
      text,
      payload: messageContent,
      occurredAt,
      isHistory: true,
    });
    return true;
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
    // Tracking numbers only feed TikTok conversions: never copy their address book.
    const channel = await this.channels.ensureWhatsAppChannel(context.teamId, context.sessionId);
    if (channel.purpose === ChannelPurpose.TRACKING || isTrackingChannel(channel)) return;
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

  private async persistIncoming(context: SessionContext, raw: Record<string, unknown>, upsertType?: string) {
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
    if (!providerChatId || !providerMessageId) return;

    // Keep status/groups/newsletters out of the support inbox (same as history sync).
    if (
      providerChatId === 'status@broadcast' ||
      providerChatId.endsWith('@newsletter') ||
      providerChatId.endsWith('@broadcast') ||
      providerChatId.endsWith('@g.us')
    ) {
      return;
    }

    const fromMe = Boolean(key?.fromMe);
    const socket = this.sessionManager.getSocket(context.sessionId);
    let senderPhone = this.extractSenderPhone(key);
    if (!senderPhone && providerChatId.includes('@lid') && socket) {
      senderPhone = await this.resolvePhoneFromLid(socket, providerChatId);
    }

    const messageContent = raw.message as Record<string, unknown> | undefined;
    if (!messageContent) return;
    const unwrapped = unwrapMessage(messageContent) ?? messageContent;
    const text = extractMessageText(messageContent);
    const type = detectMessageType(messageContent);
    // Protocol/system stubs with no content should not create empty bubbles.
    if (!text && type === MessageType.TEXT) return;

    const timestamp = Number(raw.messageTimestamp || Date.now());
    const receivedAt = new Date(timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp);
    const channel = await this.channels.ensureWhatsAppChannel(context.teamId, context.sessionId);
    const tracking = channel.purpose === ChannelPurpose.TRACKING || isTrackingChannel(channel);

    // SYSTEM B — TikTok tracking: Events API only. No Inbox, AI, CRM, or contacts.
    if (tracking) {
      if (fromMe) return;
      await this.persistTrackingInbound(context, channel.id, {
        providerChatId,
        providerMessageId,
        senderPhone,
        text,
        type,
        receivedAt,
      });
      return;
    }

    // Media is only kept for the inbox; tracking numbers never download it.
    const media = await this.downloadIncomingMedia(context, raw, unwrapped, type, providerMessageId);

    const chat = await this.repository.upsertChat({
      teamId: context.teamId,
      sessionId: context.sessionId,
      providerChatId,
    });

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
    // fromMe = sent from our linked phone / inbox. Never use our own pushName as the customer label.
    const pushName = fromMe ? undefined : (raw.pushName as string | undefined);
    const ingested = await this.channelMessages.ingest({
      teamId: context.teamId,
      channelId: channel.id,
      externalIdentityId: providerChatId,
      senderPhone,
      displayName: pushName,
      providerMessageId,
      sourceMessageId: saved.id,
      direction: fromMe ? MessageDirection.OUTBOUND : MessageDirection.INBOUND,
      type,
      status: fromMe ? MessageStatus.SENT : MessageStatus.RECEIVED,
      text,
      payload: messageContent ?? {},
      mediaStorageKey: media?.storageKey ?? null,
      mediaMimeType: media?.mimeType ?? null,
      mediaFileName: media?.fileName ?? null,
      mediaSizeBytes: media?.sizeBytes ?? null,
      occurredAt: saved.receivedAt ?? saved.createdAt,
      // 'notify' + fromMe = the owner typed this on the linked phone (our own
      // API sends echo back as 'append'). A manual phone reply should pause AI.
      humanReply: fromMe && upsertType === 'notify',
    });
    if (!ingested.contact) return;
    if (!fromMe) {
      void this.enrichContactFromWhatsApp(context, ingested.contact.id, providerChatId, senderPhone, pushName).catch((error) => {
        this.logger.debug(`Contact enrichment skipped: ${String(error)}`);
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
    } else {
      // Still refresh phone/avatar for the chat peer when we reply from the phone.
      void this.enrichContactFromWhatsApp(context, ingested.contact.id, providerChatId, senderPhone, null).catch(() => undefined);
    }
  }

  /**
   * TikTok tracking inbound: attribute + Contact / Lead events only.
   * Uses synthetic conversation IDs — never creates Inbox Conversation / Contact rows.
   */
  private async persistTrackingInbound(
    context: SessionContext,
    channelId: string,
    input: {
      providerChatId: string;
      providerMessageId: string;
      senderPhone: string | null;
      text: string | null;
      type: MessageType;
      receivedAt: Date;
    },
  ) {
    const phone =
      input.senderPhone?.replace(/\D/g, '') ||
      phoneFromJid(input.providerChatId) ||
      input.providerChatId.replace(/[^\d]/g, '');
    if (!phone || phone.length < 8) {
      this.logger.warn(`[TikTokTracking] skip inbound — missing customer phone session=${context.sessionId}`);
      return;
    }

    const { conversationId, isNewConversation } = await this.tiktokTracking.resolveTrackingConversationKey({
      channelId,
      customerPhone: phone,
      windowMs: TRACKING_CONTACT_WINDOW_MS,
      teamId: context.teamId,
    });

    try {
      await this.tiktokTracking.handleFirstInboundMessage({
        teamId: context.teamId,
        channelId,
        conversationId,
        contactId: `ttk-contact:${channelId}:${phone}`,
        messageId: `ttk-msg:${input.providerMessageId}`,
        senderPhone: phone,
        messageText: input.text,
        messageType: input.type,
        isNewConversation,
      });
    } catch (err) {
      this.logger.error(
        `[TikTokTracking] Contact pipeline failed session=${context.sessionId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    await this.repository.logConnection({
      teamId: context.teamId,
      sessionId: context.sessionId,
      event: WhatsAppConnectionLogEvent.MESSAGE_RECEIVED,
      message: `TikTok tracking inbound ${input.providerMessageId}`,
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
    providerMessageId: string,
  ) {
    const mediaTypes: MessageType[] = [MessageType.IMAGE, MessageType.VIDEO, MessageType.AUDIO, MessageType.DOCUMENT, MessageType.STICKER];
    if (!mediaTypes.includes(type)) return null;
    const info = extractMediaInfo(messageContent);
    if (!info) return null;
    // Our own sends come back as `append` echoes with the same id: reuse what is stored.
    const known = await this.channelMessages.findStoredMedia(context.teamId, providerMessageId);
    if (known?.mediaStorageKey && (await this.storage.exists(known.mediaStorageKey))) {
      return {
        storageKey: known.mediaStorageKey,
        mimeType: known.mediaMimeType ?? info.mimeType ?? 'application/octet-stream',
        fileName: known.mediaFileName ?? info.fileName,
        sizeBytes: known.mediaSizeBytes ?? undefined,
      };
    }
    const socket = this.sessionManager.getSocket(context.sessionId);
    if (!socket) return null;
    try {
      // Baileys' downloadMediaMessage expects a full WAMessage. Build a
      // normalized one from the *unwrapped* content so media nested inside
      // ephemeral/view-once containers can still be downloaded.
      const normalizedMessage = { key: raw.key, message: messageContent, messageTimestamp: raw.messageTimestamp };
      const buffer = await this.baileysProvider.downloadMedia(socket, normalizedMessage);
      if (!buffer || buffer.length === 0) return null;
      // Same file sent to many customers (campaign/broadcast): keep a single copy.
      const checksum = createHash('sha256').update(buffer).digest('hex');
      const sharedKey = await this.channelMessages.findMediaKeyByChecksum(context.teamId, checksum);
      if (sharedKey && (await this.storage.exists(sharedKey))) {
        return {
          storageKey: sharedKey,
          mimeType: info.mimeType ?? 'application/octet-stream',
          fileName: info.fileName,
          sizeBytes: buffer.length,
        };
      }
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

  private async resolveConnectedPhone(
    socket: Awaited<ReturnType<BaileysProvider['createSocket']>>['socket'],
  ): Promise<string | null> {
    const jid = socket.user?.id ?? null;
    const direct = phoneFromJid(jid);
    if (direct) return direct;
    if (!jid?.includes('@lid')) return null;
    return this.resolvePhoneFromLid(socket, jid);
  }

  private async resolvePhoneFromLid(
    socket: Awaited<ReturnType<BaileysProvider['createSocket']>>['socket'] | null | undefined,
    jid: string,
  ): Promise<string | null> {
    if (!socket || !jid.includes('@lid')) return null;
    try {
      const lidMapping = (
        socket as unknown as {
          signalRepository?: { lidMapping?: { getPNForLID?: (lid: string) => Promise<string | null> } };
        }
      ).signalRepository?.lidMapping;
      if (lidMapping?.getPNForLID) {
        const pn = await lidMapping.getPNForLID(jid);
        return phoneFromJid(pn);
      }
    } catch (error) {
      this.logger.warn(`Failed to resolve phone from LID ${jid}: ${String(error)}`);
    }
    return null;
  }

  private async enrichContactFromWhatsApp(
    context: SessionContext,
    contactId: string,
    providerChatId: string,
    senderPhone?: string | null,
    pushName?: string | null,
  ) {
    const socket = this.sessionManager.getSocket(context.sessionId);
    let phone = senderPhone ?? null;
    if (!phone && providerChatId.includes('@lid')) {
      phone = await this.resolvePhoneFromLid(socket, providerChatId);
    }

    const photoJid = phone
      ? `${phone.replace(/\D/g, '')}@s.whatsapp.net`
      : providerChatId.includes('@')
        ? providerChatId
        : null;
    const avatarUrl = photoJid && socket
      ? await this.baileysProvider.fetchProfilePhoto(socket, photoJid)
      : null;

    if (!phone && !avatarUrl && !pushName) return;

    await this.channelMessages.enrichContactProfile(context.teamId, contactId, {
      phone,
      displayName: pushName,
      avatarUrl,
    });
  }
}
