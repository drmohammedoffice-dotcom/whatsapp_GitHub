import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ChannelProvider, ChannelStatus, MessageStatus, MessageType } from '@watsapp/database';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ChannelMessageService } from '../../channels/channel-message.service';
import { ChannelSecretsService } from '../../channels/channel-secrets.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TelegramConnectDto } from './dto/telegram.dto';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly apiPublicUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: ChannelSecretsService,
    private readonly channelMessages: ChannelMessageService,
    config: ConfigService,
  ) {
    this.apiPublicUrl = config.getOrThrow<string>('API_PUBLIC_URL');
  }

  async connect(teamId: string, dto: TelegramConnectDto) {
    const me = await axios.get(`https://api.telegram.org/bot${dto.botToken}/getMe`);
    const bot = me.data?.result as { id?: number; username?: string; first_name?: string } | undefined;
    if (!bot?.id) throw new BadRequestException('Invalid Telegram bot token');
    const externalId = String(bot.id);
    const name = dto.name ?? bot.username ?? bot.first_name ?? 'Telegram Bot';
    const channel = await this.prisma.channel.upsert({
      where: { teamId_provider_externalId: { teamId, provider: ChannelProvider.TELEGRAM, externalId } },
      update: { name, status: ChannelStatus.CONNECTED, lastSeenAt: new Date(), metadata: { botId: externalId, botUsername: bot.username } },
      create: {
        teamId,
        provider: ChannelProvider.TELEGRAM,
        name,
        status: ChannelStatus.CONNECTED,
        externalId,
        lastSeenAt: new Date(),
        metadata: { botId: externalId, botUsername: bot.username },
      },
    });
    await this.secrets.setAccessToken(channel.id, dto.botToken, { botId: externalId, botUsername: bot.username });
    const webhookUrl = `${this.apiPublicUrl}/api/v1/telegram/webhook/${channel.id}`;
    try {
      await axios.post(`https://api.telegram.org/bot${dto.botToken}/setWebhook`, { url: webhookUrl });
    } catch (error) {
      this.logger.warn(`Telegram webhook registration failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return { channelId: channel.id, name: channel.name, botUsername: bot.username, webhookUrl };
  }

  async disconnect(teamId: string, channelId: string) {
    const channel = await this.prisma.channel.findFirst({ where: { id: channelId, teamId, provider: ChannelProvider.TELEGRAM } });
    if (!channel) throw new NotFoundException('Telegram channel not found');
    const token = await this.secrets.getAccessToken(channelId);
    if (token) {
      await axios.post(`https://api.telegram.org/bot${token}/deleteWebhook`).catch(() => undefined);
    }
    await this.secrets.clearSecrets(channelId);
    await this.prisma.channel.update({ where: { id: channelId }, data: { status: ChannelStatus.DISCONNECTED } });
    return { disconnected: true };
  }

  async handleWebhook(channelId: string, body: Record<string, unknown>) {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, provider: ChannelProvider.TELEGRAM, status: ChannelStatus.CONNECTED },
    });
    if (!channel) return { ok: true };
    const message = body.message as Record<string, unknown> | undefined;
    if (!message) return { ok: true };
    const chat = message.chat as { id?: number; first_name?: string; username?: string } | undefined;
    const from = message.from as { first_name?: string; username?: string } | undefined;
    const chatId = chat?.id ? String(chat.id) : null;
    const providerMessageId = String(message.message_id ?? '');
    if (!chatId || !providerMessageId) return { ok: true };

    const text = (message.text as string | undefined) ?? (message.caption as string | undefined) ?? null;
    let type: MessageType = MessageType.TEXT;
    if (message.voice || message.audio) type = MessageType.AUDIO;
    else if (message.photo) type = MessageType.IMAGE;
    else if (message.video) type = MessageType.VIDEO;
    else if (message.document) type = MessageType.DOCUMENT;
    else if (message.sticker) type = MessageType.STICKER;

    await this.channelMessages.ingest({
      teamId: channel.teamId,
      channelId: channel.id,
      externalIdentityId: chatId,
      displayName: from?.first_name ?? from?.username ?? chat?.first_name ?? chatId,
      providerMessageId,
      direction: 'INBOUND',
      type,
      status: MessageStatus.RECEIVED,
      text,
      payload: message,
      occurredAt: new Date(Number(message.date ?? Date.now()) * 1000),
    });
    return { ok: true };
  }
}
