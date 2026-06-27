import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ChannelProvider, MessageType } from '@watsapp/database';
import axios from 'axios';
import { readFile } from 'fs/promises';
import { PrismaService } from '../prisma/prisma.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
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
  ) {}

  async sendText(teamId: string, conversationId: string, text: string) {
    const { conversation, identity } = await this.resolveConversation(teamId, conversationId);
    const provider = conversation.channel.provider;

    if (provider === ChannelProvider.WHATSAPP_BAILEYS) {
      if (!conversation.channel.whatsAppSessionId) throw new BadRequestException('WhatsApp session not linked');
      return this.whatsapp.send(teamId, conversation.channel.whatsAppSessionId, identity.externalId, { text });
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

    if (provider === ChannelProvider.WHATSAPP_BAILEYS) {
      if (!conversation.channel.whatsAppSessionId) throw new BadRequestException('WhatsApp session not linked');
      const payload = this.buildWhatsAppMediaPayload(type, media);
      return this.whatsapp.send(teamId, conversation.channel.whatsAppSessionId, identity.externalId, payload);
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
}
