import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { ChannelProvider, ConversationKind, MessageDirection, MessageType } from '@watsapp/database';
import axios from 'axios';
import { readFile } from 'fs/promises';
import { PrismaService } from '../prisma/prisma.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { TelegramUserService } from '../integrations/telegram-user/telegram-user.service';
import { EncryptionService } from '../security/encryption.service';
import { ChannelSecretsService } from './channel-secrets.service';

const META_GRAPH = 'https://graph.facebook.com/v21.0';

export type OutboundMediaInput = {
  buffer: Buffer;
  mimeType: string;
  fileName?: string;
  caption?: string;
  voiceNote?: boolean;
};

@Injectable()
export class OutboundChannelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
    private readonly secrets: ChannelSecretsService,
    private readonly storage: LocalStorageService,
    private readonly encryption: EncryptionService,
    @Inject(forwardRef(() => TelegramUserService)) private readonly telegramUser: TelegramUserService,
  ) {}

  async sendText(teamId: string, conversationId: string, text: string) {
    const { conversation, identity } = await this.resolveConversation(teamId, conversationId);
    const provider = conversation.channel.provider;

    if (provider === ChannelProvider.WHATSAPP_BAILEYS) {
      if (!conversation.channel.whatsAppSessionId) throw new BadRequestException('WhatsApp session not linked');
      return this.whatsapp.send(teamId, conversation.channel.whatsAppSessionId, identity.externalId, { text });
    }

    if (provider === ChannelProvider.WHATSAPP_CLOUD) {
      const accountId = conversation.channel.whatsAppCloudAccountId;
      if (!accountId) throw new BadRequestException('WhatsApp Cloud account not linked');
      const token = await this.getCloudToken(accountId);
      const phoneNumberId = conversation.channel.externalId;
      if (!phoneNumberId) throw new BadRequestException('WhatsApp Cloud phone number id missing');
      const to = String(identity.externalId ?? '').replace(/[^\d]/g, '');
      if (!to || to.length < 8) throw new BadRequestException('Recipient WhatsApp number is invalid');
      const response = await axios.post(
        `${META_GRAPH}/${phoneNumberId}/messages`,
        { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return { key: { id: response.data?.messages?.[0]?.id as string | undefined }, raw: response.data };
    }

    if (provider === ChannelProvider.TELEGRAM_USER) {
      const connectionId = conversation.channel.telegramConnectionId;
      if (!connectionId) throw new BadRequestException('Telegram connection not linked');
      const hint = await this.resolveTelegramPeerHint(conversationId);
      const result = await this.telegramUser.sendText(connectionId, identity.externalId, text, hint);
      return { key: { id: result.messageId }, raw: result };
    }

    const token = await this.secrets.getAccessToken(conversation.channel.id);
    if (!token) throw new BadRequestException('Channel credentials are missing');

    if (provider === ChannelProvider.TELEGRAM) {
      const response = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
        chat_id: identity.externalId,
        text,
      });
      return { key: { id: String(response.data?.result?.message_id ?? '') }, raw: response.data };
    }

    if (provider === ChannelProvider.META_MESSENGER || provider === ChannelProvider.META_INSTAGRAM) {
      const metadata = this.secrets.readMetadata(conversation.channel.metadata);
      const pageId = metadata.pageId ?? conversation.channel.externalId;
      if (!pageId) throw new BadRequestException('Meta page id is not configured');

      // Public comment reply (Facebook / Instagram) — never use the Send API for comments.
      if (conversation.kind === ConversationKind.COMMENT) {
        return this.sendMetaCommentReply(conversation, token, text);
      }

      const response = await axios.post(
        `${META_GRAPH}/${pageId}/messages`,
        { recipient: { id: identity.externalId }, message: { text } },
        { params: { access_token: token } },
      );
      return { key: { id: response.data?.message_id as string | undefined }, raw: response.data };
    }

    throw new BadRequestException(`Unsupported channel provider: ${provider}`);
  }

  async sendMedia(teamId: string, conversationId: string, type: MessageType, media: OutboundMediaInput) {
    const { conversation, identity } = await this.resolveConversation(teamId, conversationId);
    const provider = conversation.channel.provider;

    if (conversation.kind === ConversationKind.COMMENT) {
      throw new BadRequestException('Post comment replies support text only — media cannot be attached publicly');
    }

    if (provider === ChannelProvider.WHATSAPP_BAILEYS) {
      if (!conversation.channel.whatsAppSessionId) throw new BadRequestException('WhatsApp session not linked');
      const payload = this.buildWhatsAppMediaPayload(type, media);
      return this.whatsapp.send(teamId, conversation.channel.whatsAppSessionId, identity.externalId, payload);
    }

    if (provider === ChannelProvider.WHATSAPP_CLOUD) {
      const accountId = conversation.channel.whatsAppCloudAccountId;
      if (!accountId) throw new BadRequestException('WhatsApp Cloud account not linked');
      const token = await this.getCloudToken(accountId);
      const phoneNumberId = conversation.channel.externalId;
      if (!phoneNumberId) throw new BadRequestException('WhatsApp Cloud phone number id missing');
      const to = String(identity.externalId ?? '').replace(/[^\d]/g, '');
      if (!to || to.length < 8) throw new BadRequestException('Recipient WhatsApp number is invalid');

      const form = new FormData();
      form.append('messaging_product', 'whatsapp');
      form.append('file', new Blob([new Uint8Array(media.buffer)], { type: media.mimeType }), media.fileName ?? 'file');
      const upload = await axios.post(`${META_GRAPH}/${phoneNumberId}/media`, form, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const mediaId = upload.data?.id as string | undefined;
      if (!mediaId) throw new BadRequestException('WhatsApp Cloud media upload failed');

      const waType = type === MessageType.IMAGE || type === MessageType.STICKER ? 'image'
        : type === MessageType.VIDEO ? 'video'
        : type === MessageType.AUDIO ? 'audio'
        : 'document';
      const mediaPayload: Record<string, unknown> = { id: mediaId };
      if (media.caption && waType !== 'audio') mediaPayload.caption = media.caption;
      if (waType === 'document' && media.fileName) mediaPayload.filename = media.fileName;

      const response = await axios.post(
        `${META_GRAPH}/${phoneNumberId}/messages`,
        { messaging_product: 'whatsapp', to, type: waType, [waType]: mediaPayload },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return { key: { id: response.data?.messages?.[0]?.id as string | undefined }, raw: response.data };
    }

    if (provider === ChannelProvider.TELEGRAM_USER) {
      const connectionId = conversation.channel.telegramConnectionId;
      if (!connectionId) throw new BadRequestException('Telegram connection not linked');
      const hint = await this.resolveTelegramPeerHint(conversationId);
      const result = await this.telegramUser.sendMedia(connectionId, identity.externalId, media.buffer, {
        caption: media.caption,
        fileName: media.fileName,
        voiceNote: media.voiceNote,
        hint,
      });
      return { key: { id: result.messageId }, raw: result };
    }

    if (provider === ChannelProvider.TELEGRAM) {
      const token = await this.secrets.getAccessToken(conversation.channel.id);
      if (!token) throw new BadRequestException('Channel credentials are missing');
      const chatId = identity.externalId;
      const base = `https://api.telegram.org/bot${token}`;
      if (type === MessageType.IMAGE || type === MessageType.STICKER) {
        const form = new FormData();
        form.append('chat_id', chatId);
        form.append('photo', new Blob([new Uint8Array(media.buffer)], { type: media.mimeType }), media.fileName ?? 'image.jpg');
        if (media.caption) form.append('caption', media.caption);
        const response = await axios.post(`${base}/sendPhoto`, form);
        return { key: { id: String(response.data?.result?.message_id ?? '') }, raw: response.data };
      }
      if (type === MessageType.VIDEO) {
        const form = new FormData();
        form.append('chat_id', chatId);
        form.append('video', new Blob([new Uint8Array(media.buffer)], { type: media.mimeType }), media.fileName ?? 'video.mp4');
        if (media.caption) form.append('caption', media.caption);
        const response = await axios.post(`${base}/sendVideo`, form);
        return { key: { id: String(response.data?.result?.message_id ?? '') }, raw: response.data };
      }
      if (type === MessageType.AUDIO) {
        const form = new FormData();
        form.append('chat_id', chatId);
        form.append(media.voiceNote ? 'voice' : 'audio', new Blob([new Uint8Array(media.buffer)], { type: media.mimeType }), media.fileName ?? 'audio.ogg');
        const response = await axios.post(`${base}/${media.voiceNote ? 'sendVoice' : 'sendAudio'}`, form);
        return { key: { id: String(response.data?.result?.message_id ?? '') }, raw: response.data };
      }
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('document', new Blob([new Uint8Array(media.buffer)], { type: media.mimeType }), media.fileName ?? 'file');
      if (media.caption) form.append('caption', media.caption);
      const response = await axios.post(`${base}/sendDocument`, form);
      return { key: { id: String(response.data?.result?.message_id ?? '') }, raw: response.data };
    }

    throw new BadRequestException(`Media sending is not yet supported for provider: ${provider}`);
  }

  async readMediaBuffer(storageKey: string): Promise<Buffer> {
    return readFile(this.storage.resolvePath(storageKey));
  }

  private buildWhatsAppMediaPayload(type: MessageType, media: OutboundMediaInput): Record<string, unknown> {
    const { buffer, mimeType, fileName, caption, voiceNote } = media;
    if (type === MessageType.IMAGE) return { image: buffer, caption };
    if (type === MessageType.VIDEO) return { video: buffer, caption, mimetype: mimeType };
    if (type === MessageType.AUDIO) {
      return { audio: buffer, mimetype: mimeType, ptt: Boolean(voiceNote) };
    }
    if (type === MessageType.STICKER) return { sticker: buffer };
    return { document: buffer, mimetype: mimeType, fileName: fileName ?? 'file', caption };
  }

  private async sendMetaCommentReply(
    conversation: {
      id: string;
      channel: { provider: ChannelProvider };
      metadata: unknown;
    },
    token: string,
    text: string,
  ) {
    const meta =
      conversation.metadata && typeof conversation.metadata === 'object' && !Array.isArray(conversation.metadata)
        ? (conversation.metadata as Record<string, unknown>)
        : {};
    const commentId = String(meta.commentId ?? '');
    if (!commentId) throw new BadRequestException('Comment id missing on conversation — cannot reply publicly');

    const isInstagram = conversation.channel.provider === ChannelProvider.META_INSTAGRAM;
    const url = isInstagram
      ? `${META_GRAPH}/${commentId}/replies`
      : `${META_GRAPH}/${commentId}/comments`;

    try {
      const response = await axios.post(url, null, {
        params: { message: text, access_token: token },
      });
      const id = String(response.data?.id ?? response.data?.message_id ?? '');
      return { key: { id: id || undefined }, raw: response.data };
    } catch (error) {
      const ax = error as { response?: { data?: unknown } };
      throw new BadRequestException({
        message: 'Failed to reply to Meta comment',
        detail: ax.response?.data ?? String(error),
      });
    }
  }

  private async resolveConversation(teamId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, teamId },
      include: {
        channel: true,
        contact: { include: { identities: true } },
      },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    const identity =
      conversation.contact.identities.find((item) => item.channelId === conversation.channelId) ??
      conversation.contact.identities[0];
    if (!identity) throw new NotFoundException('No sendable channel identity found');
    return { conversation, identity };
  }

  private async getCloudToken(accountId: string) {
    const account = await this.prisma.whatsAppCloudAccount.findUnique({ where: { id: accountId } });
    if (!account?.encryptedAccessToken) throw new BadRequestException('WhatsApp Cloud token missing');
    if (account.status !== 'CONNECTED') throw new BadRequestException('WhatsApp Cloud account is not connected');
    return this.encryption.decryptJson<string>(account.encryptedAccessToken);
  }

  private async resolveTelegramPeerHint(conversationId: string) {
    const latest = await this.prisma.conversationMessage.findFirst({
      where: { conversationId, direction: MessageDirection.INBOUND },
      orderBy: { createdAt: 'desc' },
      select: { payload: true },
    });
    if (!latest?.payload || typeof latest.payload !== 'object' || Array.isArray(latest.payload)) return {};
    const payload = latest.payload as Record<string, unknown>;
    return {
      accessHash: typeof payload.accessHash === 'string' ? payload.accessHash : undefined,
      username: typeof payload.username === 'string' ? payload.username : undefined,
      replyToMessageId:
        typeof payload.telegramMessageId === 'number'
          ? String(payload.telegramMessageId)
          : typeof payload.telegramMessageId === 'string'
            ? payload.telegramMessageId
            : undefined,
    };
  }
}
