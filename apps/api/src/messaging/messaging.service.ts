import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MessageStatus, MessageType, WhatsAppSessionStatus } from '@watsapp/database';
import { ChannelMessageService } from '../channels/channel-message.service';
import { ChannelsService } from '../channels/channels.service';
import { UploadedMediaFile } from '../common/uploaded-media-file';
import { PrismaService } from '../prisma/prisma.service';
import { LocalStorageService } from '../storage/local-storage.service';
import { WhatsAppService } from '../whatsapp/whatsapp.service';
import { SendContactDto, SendLocationDto, SendMediaDto, SendMessageDto } from './dto/send-message.dto';

type MediaKind = 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'VIDEO';

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
    private readonly storage: LocalStorageService,
    private readonly channels: ChannelsService,
    private readonly channelMessages: ChannelMessageService,
  ) {}

  async sendText(teamId: string, dto: SendMessageDto) {
    const context = await this.prepareOutbound(teamId, dto.to, MessageType.TEXT, dto.sessionId, dto.text);
    const response = await this.whatsapp.send(teamId, context.session.id, dto.to, { text: dto.text });
    return this.markSent(context.message.id, response?.key?.id);
  }

  async sendMedia(teamId: string, type: MediaKind, dto: SendMediaDto, file?: UploadedMediaFile) {
    if (!file) throw new BadRequestException('file is required');
    const stored = await this.storage.putMedia(teamId, file);
    const context = await this.prepareOutbound(teamId, dto.to, type as MessageType, dto.sessionId, dto.caption, { mimeType: file.mimetype, fileName: file.originalname });
    await this.prisma.attachment.create({ data: { messageId: context.message.id, storageKey: stored.storageKey, fileName: file.originalname, mimeType: file.mimetype, sizeBytes: stored.sizeBytes, checksum: stored.checksum } });

    const buffer = file.buffer;
    const payload =
      type === 'IMAGE' ? { image: buffer, caption: dto.caption } :
      type === 'DOCUMENT' ? { document: buffer, fileName: file.originalname, mimetype: file.mimetype, caption: dto.caption } :
      type === 'AUDIO' ? { audio: buffer, mimetype: file.mimetype } :
      { video: buffer, caption: dto.caption, mimetype: file.mimetype };
    const response = await this.whatsapp.send(teamId, context.session.id, dto.to, payload);
    return this.markSent(context.message.id, response?.key?.id);
  }

  async sendLocation(teamId: string, dto: SendLocationDto) {
    const context = await this.prepareOutbound(teamId, dto.to, MessageType.LOCATION, dto.sessionId, dto.name, { latitude: dto.latitude, longitude: dto.longitude, name: dto.name });
    const response = await this.whatsapp.send(teamId, context.session.id, dto.to, { location: { degreesLatitude: dto.latitude, degreesLongitude: dto.longitude, name: dto.name } });
    return this.markSent(context.message.id, response?.key?.id);
  }

  async sendContact(teamId: string, dto: SendContactDto) {
    const vcard = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${dto.displayName}`, `TEL;type=CELL;type=VOICE;waid=${dto.phoneNumber}:${dto.phoneNumber}`, 'END:VCARD'].join('\n');
    const context = await this.prepareOutbound(teamId, dto.to, MessageType.CONTACT, dto.sessionId, dto.displayName, { displayName: dto.displayName, phoneNumber: dto.phoneNumber });
    const response = await this.whatsapp.send(teamId, context.session.id, dto.to, { contacts: { displayName: dto.displayName, contacts: [{ vcard }] } });
    return this.markSent(context.message.id, response?.key?.id);
  }

  chats(teamId: string) {
    return this.prisma.chat.findMany({ where: { teamId }, orderBy: { lastMessageAt: 'desc' }, take: 100 });
  }

  messages(teamId: string, chatId?: string) {
    return this.prisma.message.findMany({
      where: { teamId, ...(chatId ? { chatId } : {}) },
      include: { attachments: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  private async prepareOutbound(teamId: string, to: string, type: MessageType, sessionId?: string, text?: string, payload?: object) {
    const session = await this.resolveSession(teamId, sessionId);
    const providerChatId = this.toWhatsAppJid(to);
    const chat = await this.prisma.chat.upsert({
      where: { sessionId_providerChatId: { sessionId: session.id, providerChatId } },
      update: { lastMessageAt: new Date() },
      create: { teamId, sessionId: session.id, providerChatId, isGroup: providerChatId.endsWith('@g.us'), lastMessageAt: new Date() },
    });
    const message = await this.prisma.message.create({
      data: {
        teamId,
        sessionId: session.id,
        chatId: chat.id,
        fromJid: session.jid ?? session.id,
        toJid: providerChatId,
        direction: 'OUTBOUND',
        type,
        status: 'PENDING',
        text,
        payload: payload ?? {},
      },
    });
    return { session, chat, message };
  }

  private async markSent(messageId: string, providerMessageId?: string) {
    const message = await this.prisma.message.update({
      where: { id: messageId },
      data: { providerMessageId, status: 'SENT', sentAt: new Date() },
      include: { attachments: true },
    });
    const channel = await this.channels.ensureWhatsAppChannel(message.teamId, message.sessionId);
    await this.channelMessages.ingest({
      teamId: message.teamId,
      channelId: channel.id,
      externalIdentityId: message.toJid,
      providerMessageId,
      sourceMessageId: message.id,
      direction: 'OUTBOUND',
      type: message.type,
      status: MessageStatus.SENT,
      text: message.text,
      payload: message.payload as object,
      occurredAt: message.sentAt ?? new Date(),
    });
    return message;
  }

  private async resolveSession(teamId: string, sessionId?: string) {
    const session = await this.prisma.whatsAppSession.findFirst({
      where: { teamId, ...(sessionId ? { id: sessionId } : {}), status: WhatsAppSessionStatus.CONNECTED },
      orderBy: { connectedAt: 'desc' },
    });
    if (!session) throw new NotFoundException('No connected WhatsApp session available');
    return session;
  }

  private toWhatsAppJid(value: string) {
    if (value.includes('@')) return value;
    return `${value.replace(/[^0-9]/g, '')}@s.whatsapp.net`;
  }
}
