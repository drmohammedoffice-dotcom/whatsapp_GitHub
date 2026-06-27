import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ChannelProvider, ChannelStatus, MessageStatus, MessageType } from '@watsapp/database';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { createHmac } from 'crypto';
import { ChannelMessageService } from '../../channels/channel-message.service';
import { ChannelSecretsService } from '../../channels/channel-secrets.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MetaConnectDto } from './dto/meta.dto';

const META_GRAPH = 'https://graph.facebook.com/v21.0';

@Injectable()
export class MetaService {
  private readonly logger = new Logger(MetaService.name);
  private readonly verifyToken: string;
  private readonly appSecret?: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: ChannelSecretsService,
    private readonly channelMessages: ChannelMessageService,
    config: ConfigService,
  ) {
    this.verifyToken = config.get<string>('META_VERIFY_TOKEN', 'watsapp-meta-verify');
    this.appSecret = config.get<string>('META_APP_SECRET');
  }

  isConfigured() {
    return Boolean(this.appSecret);
  }

  async connect(teamId: string, dto: MetaConnectDto) {
    if (dto.provider !== ChannelProvider.META_MESSENGER && dto.provider !== ChannelProvider.META_INSTAGRAM) {
      throw new BadRequestException('Invalid Meta provider');
    }
    const page = await axios.get(`${META_GRAPH}/${dto.pageId}`, {
      params: { fields: 'id,name', access_token: dto.pageAccessToken },
    });
    const pageName = (page.data?.name as string | undefined) ?? dto.name ?? 'Meta Page';
    const channel = await this.prisma.channel.upsert({
      where: { teamId_provider_externalId: { teamId, provider: dto.provider, externalId: dto.pageId } },
      update: { name: pageName, status: ChannelStatus.CONNECTED, lastSeenAt: new Date() },
      create: {
        teamId,
        provider: dto.provider,
        name: pageName,
        status: ChannelStatus.CONNECTED,
        externalId: dto.pageId,
        lastSeenAt: new Date(),
        metadata: { pageId: dto.pageId },
      },
    });
    await this.secrets.setAccessToken(channel.id, dto.pageAccessToken, { pageId: dto.pageId });
    try {
      await axios.post(`${META_GRAPH}/${dto.pageId}/subscribed_apps`, null, {
        params: { subscribed_fields: 'messages,messaging_postbacks', access_token: dto.pageAccessToken },
      });
    } catch (error) {
      this.logger.warn(`Meta page subscription failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return { channelId: channel.id, provider: channel.provider, name: channel.name, status: channel.status };
  }

  async disconnect(teamId: string, channelId: string) {
    const channel = await this.prisma.channel.findFirst({ where: { id: channelId, teamId } });
    if (!channel) throw new NotFoundException('Channel not found');
    await this.secrets.clearSecrets(channelId);
    await this.prisma.channel.update({ where: { id: channelId }, data: { status: ChannelStatus.DISCONNECTED } });
    return { disconnected: true };
  }

  verifyWebhook(mode?: string, token?: string, challenge?: string) {
    if (mode === 'subscribe' && token === this.verifyToken) return challenge ?? 'ok';
    throw new BadRequestException('Webhook verification failed');
  }

  async handleWebhook(body: Record<string, unknown>, signature?: string) {
    if (this.appSecret && signature) this.assertSignature(body, signature);
    const object = String(body.object ?? '');
    if (object !== 'page' && object !== 'instagram') return { ok: true };

    for (const entry of (body.entry as Array<Record<string, unknown>> | undefined) ?? []) {
      const pageId = String(entry.id ?? '');
      const provider = object === 'instagram' ? ChannelProvider.META_INSTAGRAM : ChannelProvider.META_MESSENGER;
      const channel = await this.prisma.channel.findFirst({
        where: { provider, externalId: pageId, status: ChannelStatus.CONNECTED },
      });
      if (!channel) continue;

      for (const event of (entry.messaging as Array<Record<string, unknown>> | undefined) ?? []) {
        const message = event.message as Record<string, unknown> | undefined;
        if (!message || message.is_echo) continue;
        const senderId = (event.sender as { id?: string } | undefined)?.id;
        const text = (message.text as string | undefined) ?? null;
        const providerMessageId = String(message.mid ?? message.id ?? '');
        if (!senderId || !providerMessageId) continue;
        await this.channelMessages.ingest({
          teamId: channel.teamId,
          channelId: channel.id,
          externalIdentityId: senderId,
          displayName: senderId,
          providerMessageId,
          direction: 'INBOUND',
          type: text ? MessageType.TEXT : MessageType.TEXT,
          status: MessageStatus.RECEIVED,
          text,
          payload: message,
          occurredAt: new Date(Number(event.timestamp ?? Date.now())),
        });
      }
    }
    return { ok: true };
  }

  private assertSignature(body: Record<string, unknown>, signature: string) {
    const expected = `sha256=${createHmac('sha256', this.appSecret!).update(JSON.stringify(body)).digest('hex')}`;
    if (signature !== expected) throw new BadRequestException('Invalid Meta webhook signature');
  }
}
