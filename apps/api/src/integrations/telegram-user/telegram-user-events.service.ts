import { Injectable, Logger } from '@nestjs/common';
import { MessageDirection, MessageStatus, MessageType } from '@watsapp/database';
import { TelegramClient } from 'telegram';
import { NewMessage } from 'telegram/events';
import { Api } from 'telegram/tl';
import { ChannelMessageService } from '../../channels/channel-message.service';
import { LocalStorageService } from '../../storage/local-storage.service';
import { TelegramClientManager } from './telegram-client.manager';

@Injectable()
export class TelegramUserEventsService {
  private readonly logger = new Logger(TelegramUserEventsService.name);
  private readonly attached = new Set<string>();

  constructor(
    private readonly channelMessages: ChannelMessageService,
    private readonly storage: LocalStorageService,
    private readonly clients: TelegramClientManager,
  ) {}

  async attachHandlers(connectionId: string, client: TelegramClient, channelId: string, teamId: string) {
    if (this.attached.has(connectionId)) return;
    this.attached.add(connectionId);

    client.addEventHandler(async (event) => {
      try {
        const message = event.message;
        if (!(message instanceof Api.Message) || !message.peerId) return;
        await this.cachePeerFromMessage(connectionId, client, message);
        await this.ingestMessage(client, teamId, channelId, connectionId, message, false);
      } catch (error) {
        this.logger.warn(`Telegram event error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, new NewMessage({}));

    client.addEventHandler(async (event) => {
      if (!(event instanceof Api.UpdateUserTyping)) return;
      // Typing events can be forwarded via realtime in a future iteration.
    });
  }

  private async cachePeerFromMessage(connectionId: string, client: TelegramClient, message: Api.Message) {
    const chatId = this.resolvePeerId(message.peerId!);
    if (!chatId) return;

    try {
      const getSender = (message as Api.Message & { getSender?: () => Promise<unknown> }).getSender;
      if (getSender) {
        const sender = await getSender.call(message);
        if (sender instanceof Api.User && sender.accessHash != null) {
          this.clients.cachePeer(connectionId, chatId, String(sender.accessHash), sender.username);
          return;
        }
      }
    } catch {
      // fall through
    }

    try {
      const inputPeer = await client.getInputEntity(message.peerId!);
      if (inputPeer instanceof Api.InputPeerUser) {
        this.clients.cachePeer(connectionId, chatId, String(inputPeer.accessHash));
        return;
      }
    } catch {
      // fall through
    }

    try {
      const entity = await client.getEntity(message.peerId!);
      if (entity instanceof Api.User && entity.accessHash != null) {
        this.clients.cachePeer(connectionId, chatId, String(entity.accessHash), entity.username);
      }
    } catch {
      // non-fatal
    }
  }

  async ingestMessage(
    client: TelegramClient,
    teamId: string,
    channelId: string,
    connectionId: string,
    message: Api.Message,
    isHistory: boolean,
  ) {
    const chatId = this.resolvePeerId(message.peerId);
    if (!chatId) return;

    const providerMessageId = String(message.id);
    const direction = message.out ? MessageDirection.OUTBOUND : MessageDirection.INBOUND;
    let displayName = chatId;
    let text = message.message ?? null;
    let type: MessageType = MessageType.TEXT;
    let accessHash: string | undefined;
    let username: string | undefined;
    let mediaStorageKey: string | null = null;
    let mediaMimeType: string | null = null;
    let mediaFileName: string | null = null;
    let mediaSizeBytes: number | null = null;

    try {
      const inputPeer = await client.getInputEntity(message.peerId!);
      if (inputPeer instanceof Api.InputPeerUser) {
        accessHash = String(inputPeer.accessHash);
      }
    } catch {
      // fall through
    }

    try {
      const entity = await client.getEntity(message.peerId!);
      if (entity instanceof Api.User) {
        if (entity.firstName) {
          displayName = [entity.firstName, entity.lastName ?? ''].filter(Boolean).join(' ');
        }
        if (entity.accessHash != null) accessHash = String(entity.accessHash);
        if (entity.username) username = entity.username;
      } else if ('firstName' in entity && entity.firstName) {
        displayName = [entity.firstName, 'lastName' in entity ? entity.lastName : ''].filter(Boolean).join(' ');
      } else if ('title' in entity && entity.title) {
        displayName = entity.title;
      } else if ('username' in entity && entity.username) {
        displayName = entity.username;
      }
    } catch {
      // keep chatId as fallback
    }

    if (accessHash) {
      this.clients.cachePeer(connectionId, chatId, accessHash, username);
    }

    if (message.media) {
      const mapped = await this.mapMedia(client, teamId, message);
      type = mapped.type;
      text = text ?? mapped.caption;
      mediaStorageKey = mapped.storageKey;
      mediaMimeType = mapped.mimeType;
      mediaFileName = mapped.fileName;
      mediaSizeBytes = mapped.sizeBytes;
    }

    if (message.media instanceof Api.MessageMediaGeo) {
      type = MessageType.TEXT;
      const geo = message.media.geo;
      if (geo instanceof Api.GeoPoint) {
        text = text ?? `📍 Location: ${geo.lat}, ${geo.long}`;
      }
    }

    if (message.media instanceof Api.MessageMediaContact) {
      type = MessageType.TEXT;
      const c = message.media;
      text = text ?? `👤 ${c.firstName} ${c.lastName ?? ''} ${c.phoneNumber}`.trim();
    }

    await this.channelMessages.ingest({
      teamId,
      channelId,
      externalIdentityId: chatId,
      displayName,
      providerMessageId,
      direction,
      type,
      status: direction === MessageDirection.INBOUND ? MessageStatus.RECEIVED : MessageStatus.SENT,
      text,
      payload: { telegramMessageId: message.id, peerId: chatId, accessHash, username },
      mediaStorageKey,
      mediaMimeType,
      mediaFileName,
      mediaSizeBytes,
      occurredAt: new Date((message.date ?? Math.floor(Date.now() / 1000)) * 1000),
      isHistory,
    });

    if (!isHistory && direction === MessageDirection.INBOUND) {
      try {
        await client.markAsRead(message.peerId!, message.id);
      } catch {
        // non-fatal
      }
    }
  }

  private async mapMedia(client: TelegramClient, teamId: string, message: Api.Message) {
    const media = message.media!;
    let type: MessageType = MessageType.DOCUMENT;
    let mimeType = 'application/octet-stream';
    let fileName = `telegram-${message.id}`;

    if (media instanceof Api.MessageMediaPhoto) {
      type = MessageType.IMAGE;
      mimeType = 'image/jpeg';
      fileName = `${fileName}.jpg`;
    } else if (media instanceof Api.MessageMediaDocument) {
      const doc = media.document;
      if (doc instanceof Api.Document) {
        mimeType = doc.mimeType ?? mimeType;
        const attrs = doc.attributes ?? [];
        const fileAttr = attrs.find((a) => a instanceof Api.DocumentAttributeFilename) as Api.DocumentAttributeFilename | undefined;
        if (fileAttr?.fileName) fileName = fileAttr.fileName;
        if (attrs.some((a) => a instanceof Api.DocumentAttributeSticker)) type = MessageType.STICKER;
        else if (attrs.some((a) => a instanceof Api.DocumentAttributeAudio && (a as Api.DocumentAttributeAudio).voice)) {
          type = MessageType.AUDIO;
        } else if (attrs.some((a) => a instanceof Api.DocumentAttributeVideo)) type = MessageType.VIDEO;
        else if (mimeType.startsWith('image/')) type = MessageType.IMAGE;
        else if (mimeType.startsWith('video/')) type = MessageType.VIDEO;
        else if (mimeType.startsWith('audio/')) type = MessageType.AUDIO;
      }
    }

    const buffer = await client.downloadMedia(message, {});
    if (!buffer || !(buffer instanceof Buffer)) {
      return { type, caption: null, storageKey: null, mimeType: null, fileName: null, sizeBytes: null };
    }

    const stored = await this.storage.putBuffer(teamId, buffer, mimeType, fileName);

    return {
      type,
      caption: message.message ?? null,
      storageKey: stored.storageKey,
      mimeType,
      fileName,
      sizeBytes: buffer.length,
    };
  }

  private resolvePeerId(peer: Api.TypePeer): string | null {
    if (peer instanceof Api.PeerUser) return String(peer.userId);
    if (peer instanceof Api.PeerChat) return String(peer.chatId);
    if (peer instanceof Api.PeerChannel) return String(peer.channelId);
    return null;
  }
}
