import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ChannelProvider, MessageType } from '@watsapp/database';
import axios from 'axios';
import { readFile } from 'fs/promises';
import { PrismaService } from '../prisma/prisma.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
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

    throw new BadRequestException(`Unsupported channel provider: ${provider}`);
  }

  async sendMedia(teamId: string, conversationId: string, type: MessageType, media: OutboundMediaInput) {
    const { conversation, identity } = await this.resolveConversation(teamId, conversationId);
    const provider = conversation.channel.provider;

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
}
