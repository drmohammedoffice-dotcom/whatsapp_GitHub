import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { ChannelProvider, ChannelStatus, ConversationKind, MessageDirection, MessageStatus, MessageType } from '@watsapp/database';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import axios from 'axios';
import { ChannelMessageService } from '../../channels/channel-message.service';
import { ChannelSecretsService } from '../../channels/channel-secrets.service';
import { ChannelTokenService } from '../../channels/channel-token.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MetaApiClient } from './meta-api.client';
import { InstagramApiClient } from './instagram-api.client';
import { MetaConnectDto } from './dto/meta.dto';
import { MetaMediaService } from './meta-media.service';
import { MetaWebhookLogService } from './meta-webhook-log.service';
@Injectable()
export class MetaService {
  private readonly logger = new Logger(MetaService.name);
  private readonly verifyToken: string;
  private readonly appSecret?: string;
  private readonly instagramApiAppSecret?: string;
  /** Skip IG Graph polling after Meta rate-limits an account (#80002). */
  private readonly igCommentRateLimitedUntil = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly secrets: ChannelSecretsService,
    private readonly channelTokens: ChannelTokenService,
    private readonly channelMessages: ChannelMessageService,
    private readonly api: MetaApiClient,
    private readonly instagramApi: InstagramApiClient,
    private readonly media: MetaMediaService,
    private readonly config: ConfigService,
    @Optional() private readonly webhookLog?: MetaWebhookLogService,
  ) {
    this.verifyToken = config.get<string>('META_VERIFY_TOKEN', 'chatloora_secure_verify_token_2026');
    this.appSecret = config.get<string>('META_APP_SECRET');
    this.instagramApiAppSecret = config.get<string>('INSTAGRAM_API_APP_SECRET');
  }

  getStatus() {
    return {
      configured: this.api.isConfigured(),
      webhookConfigured: Boolean(this.appSecret),
      oauthEnabled: this.api.isConfigured(),
    };
  }

  /** Public SDK bootstrap — app id only (safe for browser). */
  getSdkConfig() {
    const appId = this.config.get<string>('META_APP_ID')?.trim();
    if (!appId) {
      return { enabled: false as const };
    }
    return {
      enabled: true as const,
      appId,
      graphVersion: 'v21.0',
    };
  }

  /** @deprecated Use getStatus() */
  isConfigured() {
    return this.api.isConfigured();
  }

  /** @deprecated Use OAuth flow */
  async connect(teamId: string, dto: MetaConnectDto) {
    if (dto.provider !== ChannelProvider.META_MESSENGER && dto.provider !== ChannelProvider.META_INSTAGRAM) {
      throw new BadRequestException('Invalid Meta provider');
    }
    const page = await this.api.validatePage(dto.pageId, dto.pageAccessToken);
    const pageName = page.name ?? dto.name ?? 'Meta Page';
    const externalId = dto.provider === ChannelProvider.META_INSTAGRAM ? dto.pageId : dto.pageId;
    const channel = await this.prisma.channel.upsert({
      where: { teamId_provider_externalId: { teamId, provider: dto.provider, externalId } },
      update: { name: pageName, status: ChannelStatus.CONNECTED, lastSeenAt: new Date() },
      create: {
        teamId,
        provider: dto.provider,
        name: pageName,
        status: ChannelStatus.CONNECTED,
        externalId,
        lastSeenAt: new Date(),
        metadata: { pageId: dto.pageId, connectionSource: 'manual' },
      },
    });
    await this.channelTokens.storeTokens(channel.id, { accessToken: dto.pageAccessToken });
    await this.secrets.setAccessToken(channel.id, dto.pageAccessToken, { pageId: dto.pageId });
    try {
      await this.api.subscribePageToWebhooks(dto.pageId, dto.pageAccessToken);
    } catch (error) {
      this.logger.warn(`Meta page subscription failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    return { channelId: channel.id, provider: channel.provider, name: channel.name, status: channel.status };
  }

  async disconnect(teamId: string, channelId: string) {
    const channel = await this.prisma.channel.findFirst({ where: { id: channelId, teamId } });
    if (!channel) throw new NotFoundException('Channel not found');
    await this.channelTokens.deleteTokens(channelId);
    await this.secrets.clearSecrets(channelId);
    await this.prisma.channel.update({ where: { id: channelId }, data: { status: ChannelStatus.DISCONNECTED } });
    return { disconnected: true };
  }

  /**
   * Webhook verification for GET /api/webhooks/meta (plain-text challenge response).
   * Meta requires hub.challenge echoed back when hub.verify_token matches META_VERIFY_TOKEN.
   */
  verifyWebhookChallenge(mode?: string, token?: string, challenge?: string): string {
    if (mode === 'subscribe' && token === this.verifyToken && challenge) {
      this.logger.log('[Meta webhook verify OK]');
      return challenge;
    }
    this.logger.warn(`[Meta webhook verify FAILED] mode=${mode ?? 'n/a'}`);
    throw new BadRequestException('Webhook verification failed');
  }

  /** @deprecated Use verifyWebhookChallenge for production /api/webhooks/meta route */
  verifyWebhook(mode?: string, token?: string, challenge?: string) {
    if (mode === 'subscribe' && token === this.verifyToken) return challenge ?? 'ok';
    throw new BadRequestException('Webhook verification failed');
  }

  /**
   * Production webhook ingress: log payload, return immediately, process in background.
   * Meta requires a fast HTTP 200 — do not await message ingestion here.
   */
  acceptWebhookEvent(body: Record<string, unknown>, signature?: string, rawBody?: Buffer) {
    void this.webhookLog?.logIncomingEvent(body, signature);
    void this.handleWebhook(body, signature, rawBody).catch((err) => {
      this.logger.error(
        `[Meta webhook process FAILED] ${err instanceof Error ? err.message : String(err)}`,
      );
    });
  }

  async handleWebhook(body: Record<string, unknown>, signature?: string, rawBody?: Buffer) {
    if (signature && rawBody && (this.appSecret || this.instagramApiAppSecret)) {
      // Never drop inbound events on signature mismatch — Meta apps (Facebook + Instagram Login)
      // may sign with different secrets; log and continue so inbox stays live.
      if (!this.verifySignatureRaw(rawBody, signature)) {
        this.logger.warn(
          `[Meta webhook] signature mismatch object=${String(body.object ?? '')} — processing anyway (check META_APP_SECRET / INSTAGRAM_API_APP_SECRET)`,
        );
      }
    } else if (signature && !rawBody) {
        this.logger.warn('[Meta webhook] raw body missing — skipping signature check');
    }
    const object = String(body.object ?? '');
    if (object === 'whatsapp_business_account') {
      await this.handleWhatsAppWebhook(body);
      return { ok: true };
    }
    if (object !== 'page' && object !== 'instagram') return { ok: true };

    for (const entry of (body.entry as Array<Record<string, unknown>> | undefined) ?? []) {
      const entryId = String(entry.id ?? '');

      for (const event of (entry.messaging as Array<Record<string, unknown>> | undefined) ?? []) {
        const recipientId = (event.recipient as { id?: string } | undefined)?.id;
        const channels = await this.resolveWebhookChannels(object, entryId, recipientId);
        if (!channels.length) {
          this.logger.warn(
            `[Meta webhook] no connected channel for entryId=${entryId} recipientId=${recipientId ?? 'n/a'} object=${object}`,
          );
          continue;
        }
        for (const channel of channels) {
        await this.ingestMessagingEvent(channel, event);
        }
      }

      for (const change of (entry.changes as Array<Record<string, unknown>> | undefined) ?? []) {
        const field = String(change.field ?? '');
        const value = change.value as Record<string, unknown> | undefined;
        if (!value) continue;

        if (field === 'messages') {
          const channels = await this.resolveWebhookChannels(
            object,
            entryId,
            (value.recipient as { id?: string } | undefined)?.id,
          );
          if (!channels.length) {
          this.logger.warn(`[Meta webhook] no connected channel for changes entryId=${entryId} object=${object}`);
          continue;
        }
          for (const channel of channels) {
        await this.ingestMessagingEvent(channel, {
          sender: value.sender,
          recipient: value.recipient,
          timestamp: value.timestamp,
          message: value.message,
        });
          }
          continue;
        }

        // Public post comments (Facebook feed / Instagram comments) — separate from DMs.
        if (field === 'feed' || field === 'comments') {
          await this.ingestCommentChange(object, entryId, field, value);
        }
      }
    }
    return { ok: true };
  }

  /**
   * WhatsApp Cloud API webhook (object=whatsapp_business_account).
   * Parses inbound messages and statuses; ingests text/media into the team inbox.
   */
  private async handleWhatsAppWebhook(body: Record<string, unknown>) {
    for (const entry of (body.entry as Array<Record<string, unknown>> | undefined) ?? []) {
      const wabaId = String(entry.id ?? '');
      for (const change of (entry.changes as Array<Record<string, unknown>> | undefined) ?? []) {
        const field = String(change.field ?? '');
        const value = change.value as Record<string, unknown> | undefined;
        if (!value) continue;

        const phoneNumberId = (value.metadata as { phone_number_id?: string } | undefined)?.phone_number_id;
        const displayPhone = (value.metadata as { display_phone_number?: string } | undefined)?.display_phone_number;

        if (field === 'messages' && phoneNumberId) {
          if (await this.isOfficialChatlooraPhone(phoneNumberId)) {
            this.logger.log(`[WhatsApp webhook] official sender event ignored for customer inbox phone_number_id=${phoneNumberId}`);
            continue;
          }
          const channel = await this.resolveWhatsAppCloudChannel(phoneNumberId);
          if (!channel) {
            this.logger.warn(
              `[WhatsApp webhook] no connected Cloud channel for phone_number_id=${phoneNumberId} waba=${wabaId}`,
            );
            continue;
          }

          const contacts = (value.contacts as Array<{ wa_id?: string; profile?: { name?: string } }> | undefined) ?? [];
          const contactNameByWaId = new Map(
            contacts.filter((c) => c.wa_id).map((c) => [c.wa_id!, c.profile?.name ?? c.wa_id!]),
          );

          for (const msg of (value.messages as Array<Record<string, unknown>> | undefined) ?? []) {
            const providerMessageId = String(msg.id ?? '');
            if (providerMessageId) {
              const dup = await this.prisma.integrationWebhookEvent.findFirst({
                where: { provider: 'WHATSAPP_CLOUD', externalId: providerMessageId },
                select: { id: true },
              });
              if (dup) continue;
              await this.prisma.integrationWebhookEvent.create({
                data: {
                  teamId: channel.teamId,
                  provider: 'WHATSAPP_CLOUD',
                  eventType: 'message',
                  externalId: providerMessageId,
                  payload: { phoneNumberId, wabaId, id: providerMessageId },
                  status: 'PROCESSED',
                  processedAt: new Date(),
                },
              }).catch(() => undefined);
            }
            await this.ingestWhatsAppInboundMessage(channel, msg, contactNameByWaId, displayPhone);
          }

          for (const status of (value.statuses as Array<Record<string, unknown>> | undefined) ?? []) {
            await this.applyWhatsAppMessageStatus(channel.teamId, status);
          }
        } else {
          this.logger.log(
            `[WhatsApp webhook] waba=${wabaId} field=${field} phone_number_id=${phoneNumberId ?? 'n/a'}`,
          );
        }
      }
    }
  }

  private async isOfficialChatlooraPhone(phoneNumberId: string) {
    const official = await this.prisma.officialWhatsAppSender.findUnique({
      where: { id: 'chatloora-official' },
      select: { phoneNumberId: true },
    });
    const envId =
      this.config.get<string>('CHATLOORA_WHATSAPP_PHONE_NUMBER_ID')?.trim() ||
      this.config.get<string>('META_WA_PHONE_NUMBER_ID')?.trim() ||
      '';
    return Boolean(phoneNumberId) && (phoneNumberId === official?.phoneNumberId || phoneNumberId === envId);
  }

  private async applyWhatsAppMessageStatus(teamId: string, status: Record<string, unknown>) {
    const providerMessageId = String(status.id ?? '');
    const raw = String(status.status ?? '').toLowerCase();
    if (!providerMessageId || !raw) return;
    const mapped =
      raw === 'delivered'
        ? MessageStatus.DELIVERED
        : raw === 'read'
          ? MessageStatus.READ
          : raw === 'failed'
            ? MessageStatus.FAILED
            : raw === 'sent'
              ? MessageStatus.SENT
              : null;
    if (!mapped) return;
    await this.prisma.conversationMessage.updateMany({
      where: { teamId, providerMessageId },
      data: { status: mapped },
    });
  }

  private async resolveWhatsAppCloudChannel(phoneNumberId: string) {
    return this.prisma.channel.findFirst({
      where: {
        provider: ChannelProvider.WHATSAPP_CLOUD,
        externalId: phoneNumberId,
        status: ChannelStatus.CONNECTED,
      },
      select: { id: true, teamId: true },
    });
  }

  private async ingestWhatsAppInboundMessage(
    channel: { id: string; teamId: string },
    msg: Record<string, unknown>,
    contactNameByWaId: Map<string, string>,
    displayPhone?: string,
  ) {
    const from = String(msg.from ?? '');
    const providerMessageId = String(msg.id ?? '');
    if (!from || !providerMessageId) return;

    const waType = String(msg.type ?? 'text');
    const { type, text } = this.mapWhatsAppInboundContent(msg, waType);
    const displayName = contactNameByWaId.get(from) ?? from;

    this.logger.log(
      `[WhatsApp webhook message] team=${channel.teamId} channel=${channel.id} from=${from} type=${waType} business=${displayPhone ?? 'n/a'}`,
    );

    await this.channelMessages.ingest({
      teamId: channel.teamId,
      channelId: channel.id,
      externalIdentityId: from,
      senderPhone: from,
      displayName,
      providerMessageId,
      direction: MessageDirection.INBOUND,
      type,
      status: MessageStatus.RECEIVED,
      text,
      payload: msg,
      occurredAt: new Date(Number(msg.timestamp ?? Date.now()) * 1000),
    });
  }

  private mapWhatsAppInboundContent(msg: Record<string, unknown>, waType: string): { type: MessageType; text: string | null } {
    switch (waType) {
      case 'text':
        return { type: MessageType.TEXT, text: (msg.text as { body?: string } | undefined)?.body ?? null };
      case 'image':
        return {
          type: MessageType.IMAGE,
          text: (msg.image as { caption?: string } | undefined)?.caption ?? '[Image]',
        };
      case 'video':
        return {
          type: MessageType.VIDEO,
          text: (msg.video as { caption?: string } | undefined)?.caption ?? '[Video]',
        };
      case 'audio':
        return { type: MessageType.AUDIO, text: '[Voice message]' };
      case 'document':
        return {
          type: MessageType.DOCUMENT,
          text: (msg.document as { filename?: string; caption?: string } | undefined)?.caption
            ?? (msg.document as { filename?: string } | undefined)?.filename
            ?? '[Document]',
        };
      case 'sticker':
        return { type: MessageType.STICKER, text: '[Sticker]' };
      case 'location':
        return { type: MessageType.LOCATION, text: '[Location]' };
      case 'contacts':
        return { type: MessageType.CONTACT, text: '[Contact]' };
      case 'button':
        return {
          type: MessageType.TEXT,
          text: (msg.button as { text?: string } | undefined)?.text ?? '[Button reply]',
        };
      case 'interactive':
        return {
          type: MessageType.TEXT,
          text:
            (msg.interactive as { button_reply?: { title?: string }; list_reply?: { title?: string } } | undefined)
              ?.button_reply?.title
            ?? (msg.interactive as { list_reply?: { title?: string } } | undefined)?.list_reply?.title
            ?? '[Interactive reply]',
        };
      case 'reaction':
        return {
          type: MessageType.TEXT,
          text: (msg.reaction as { emoji?: string } | undefined)?.emoji ?? '[Reaction]',
        };
      default:
        return { type: MessageType.TEXT, text: `[${waType}]` };
    }
  }

  /**
   * Facebook Page `feed` comments and Instagram `comments` webhooks.
   * Stored as ConversationKind.COMMENT so they never mix with DMs in the inbox.
   */
  private async ingestCommentChange(
    object: string,
    entryId: string,
    field: string,
    value: Record<string, unknown>,
  ) {
    // Facebook feed: only process comment adds (ignore posts, likes, edits, removes for now).
    if (field === 'feed') {
      const item = String(value.item ?? '');
      const verb = String(value.verb ?? '');
      if (item !== 'comment' || (verb && verb !== 'add')) {
        this.logger.log(`[Meta comment] skip feed item=${item} verb=${verb}`);
        return;
      }
    }

    const from = value.from as { id?: string; name?: string; username?: string } | undefined;
    const commentId = String(value.comment_id ?? value.id ?? '');
    const text = String(value.message ?? value.text ?? '').trim();
    const fromId = from?.id ? String(from.id) : '';
    if (!commentId || !fromId) {
      this.logger.warn(`[Meta comment] missing commentId/fromId field=${field}`);
      return;
    }

    // Ignore echoes of our own page/IG account comments.
    if (fromId === entryId) return;

    const channels = await this.resolveWebhookChannels(
      object,
      entryId,
      object === 'instagram' ? entryId : undefined,
    );
    if (!channels.length) {
      this.logger.warn(`[Meta comment] no channel entryId=${entryId} object=${object} field=${field}`);
      return;
    }

    const postId = String(value.post_id ?? value.parent_id ?? (value.media as { id?: string } | undefined)?.id ?? '');
    const parentCommentId =
      value.parent_id && String(value.parent_id) !== postId ? String(value.parent_id) : null;
    const displayName = from?.name ?? from?.username ?? fromId;
    const occurredAt = value.created_time
      ? new Date(Number(value.created_time) * (Number(value.created_time) < 1e12 ? 1000 : 1))
      : new Date();

    for (const channel of channels) {
      this.logger.log(
        `[Meta comment] team=${channel.teamId} channel=${channel.id} from=${fromId} commentId=${commentId} postId=${postId || 'n/a'}`,
      );

      await this.channelMessages.ingest({
        teamId: channel.teamId,
        channelId: channel.id,
        // One inbox thread per commenter + post (never mix posts or DMs).
        externalIdentityId: postId ? `comment:${fromId}:${postId}` : `comment:${fromId}`,
        displayName,
        providerMessageId: commentId,
        direction: MessageDirection.INBOUND,
        type: MessageType.TEXT,
        status: MessageStatus.RECEIVED,
        text: text || '[Comment]',
        payload: value,
        occurredAt,
        kind: ConversationKind.COMMENT,
        subject: `💬 ${displayName}${postId ? ` · post ${postId}` : ''}`,
        conversationMetadata: {
          source: 'meta_comment',
          field,
          commentId,
          postId: postId || null,
          parentCommentId,
          fromId,
          pageOrIgId: entryId,
        },
      });
    }
  }

  private async ingestMessagingEvent(
    channel: { id: string; teamId: string },
    event: Record<string, unknown>,
  ) {
    const message = event.message as Record<string, unknown> | undefined;
    if (!message || message.is_echo) return;

    const senderId = (event.sender as { id?: string } | undefined)?.id;
    const providerMessageId = String(message.mid ?? message.id ?? '');
    if (!senderId || !providerMessageId) return;

    const pageToken = await this.channelTokens.getAccessToken(channel.id);
    // Still ingest text even if token decrypt fails — otherwise live DMs vanish from inbox.
    let displayName = senderId;
    if (pageToken) {
      try {
    const resolved = await this.media.resolveInboundMedia(channel.teamId, pageToken, {
      text: (message.text as string | undefined) ?? null,
      sticker_id: message.sticker_id as number | undefined,
      attachments: message.attachments as never,
    });
    await this.channelMessages.ingest({
      teamId: channel.teamId,
      channelId: channel.id,
      externalIdentityId: senderId,
          displayName,
      providerMessageId,
      direction: MessageDirection.INBOUND,
      type: resolved.type,
      status: MessageStatus.RECEIVED,
      text: resolved.text,
      payload: message,
      mediaStorageKey: resolved.mediaStorageKey,
      mediaMimeType: resolved.mediaMimeType,
      mediaFileName: resolved.mediaFileName,
      mediaSizeBytes: resolved.mediaSizeBytes,
      occurredAt: new Date(Number(event.timestamp ?? Date.now())),
    });
        return;
      } catch (error) {
        this.logger.warn(
          `[Meta webhook] media resolve failed channel=${channel.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } else {
      this.logger.warn(`[Meta webhook] missing page token channel=${channel.id} — ingesting text only`);
    }

    await this.channelMessages.ingest({
      teamId: channel.teamId,
      channelId: channel.id,
      externalIdentityId: senderId,
      displayName,
      providerMessageId,
      direction: MessageDirection.INBOUND,
      type: MessageType.TEXT,
      status: MessageStatus.RECEIVED,
      text: (message.text as string | undefined) ?? '[Message]',
      payload: message,
      occurredAt: new Date(Number(event.timestamp ?? Date.now())),
    });
  }

  /** Resolve all connected channels for a webhook entry (multi-tenant pages may be linked twice). */
  private async resolveWebhookChannels(object: string, entryId: string, recipientId?: string) {
    if (object === 'instagram') {
      return this.findChannelsForWebhook(ChannelProvider.META_INSTAGRAM, entryId);
    }

    const channels: Array<{ id: string; teamId: string }> = [];
    if (recipientId) {
      const instagramByRecipient = await this.prisma.channel.findMany({
        where: {
          provider: ChannelProvider.META_INSTAGRAM,
          status: ChannelStatus.CONNECTED,
          OR: [
            { externalId: recipientId },
            { metadata: { path: ['instagramBusinessAccountId'], equals: recipientId } },
          ],
        },
        select: { id: true, teamId: true },
      });
      channels.push(...instagramByRecipient);
    }

    if (!channels.length) {
      channels.push(...(await this.findChannelsForWebhook(ChannelProvider.META_MESSENGER, entryId)));
    }
    return channels;
  }

  /** @deprecated Prefer resolveWebhookChannels — kept for callers that expect a single channel. */
  private async resolveWebhookChannel(object: string, entryId: string, recipientId?: string) {
    const channels = await this.resolveWebhookChannels(object, entryId, recipientId);
    return channels[0] ?? null;
  }

  private async findChannelsForWebhook(provider: ChannelProvider, entryId: string) {
    const direct = await this.prisma.channel.findMany({
      where: { provider, externalId: entryId, status: ChannelStatus.CONNECTED },
      select: { id: true, teamId: true },
      orderBy: { updatedAt: 'desc' },
    });
    if (direct.length) return direct;

    if (provider === ChannelProvider.META_INSTAGRAM) {
      return this.prisma.channel.findMany({
        where: {
          provider: ChannelProvider.META_INSTAGRAM,
          status: ChannelStatus.CONNECTED,
          OR: [
            { metadata: { path: ['instagramBusinessAccountId'], equals: entryId } },
            { metadata: { path: ['pageId'], equals: entryId } },
          ],
        },
        select: { id: true, teamId: true },
        orderBy: { updatedAt: 'desc' },
      });
    }

    if (provider === ChannelProvider.META_MESSENGER) {
      return this.prisma.channel.findMany({
        where: {
          provider: ChannelProvider.META_MESSENGER,
          status: ChannelStatus.CONNECTED,
          metadata: { path: ['pageId'], equals: entryId },
        },
        select: { id: true, teamId: true },
        orderBy: { updatedAt: 'desc' },
      });
    }

    return [];
  }

  private async findChannelForWebhook(provider: ChannelProvider, entryId: string) {
    const channels = await this.findChannelsForWebhook(provider, entryId);
    return channels[0] ?? null;
  }

  /** Re-subscribe all connected Meta pages to app webhooks (fixes missing inbound messages). */
  async resubscribeWebhooks(teamId: string) {
    const callbackUrl = `${this.config.getOrThrow<string>('API_PUBLIC_URL').replace(/\/$/, '')}/api/webhooks/meta`;
    const verifyToken = this.config.get<string>('META_VERIFY_TOKEN', 'chatloora_secure_verify_token_2026');
    await this.api.ensureAppWebhookSubscription(callbackUrl, verifyToken);

    const channels = await this.prisma.channel.findMany({
      where: {
        teamId,
        provider: { in: [ChannelProvider.META_MESSENGER, ChannelProvider.META_INSTAGRAM] },
        status: ChannelStatus.CONNECTED,
      },
    });

    const results: Array<{ channelId: string; name: string; ok: boolean; error?: string }> = [];
    for (const channel of channels) {
      const metadata = this.secrets.readMetadata(channel.metadata);
      const pageId = metadata.pageId ?? channel.externalId;
      const token = await this.channelTokens.getAccessToken(channel.id);
      if (!pageId || !token) {
        results.push({ channelId: channel.id, name: channel.name, ok: false, error: 'Missing page token' });
        continue;
      }
      try {
        await this.api.subscribePageToWebhooks(pageId, token);
        results.push({ channelId: channel.id, name: channel.name, ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`[Meta resubscribe] failed for ${channel.name} (${pageId}): ${message}`);
        results.push({ channelId: channel.id, name: channel.name, ok: false, error: message });
      }
    }

    return {
      total: channels.length,
      subscribed: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  }

  /**
   * Sync Messenger and Instagram inboxes from Graph API when webhooks are unavailable.
   * Imports recent threads and messages into the local inbox.
   */
  async syncInboxMessages(teamId: string) {
    const commentSummary = await this.syncPostComments(teamId);

    const channels = await this.prisma.channel.findMany({
      where: {
        teamId,
        provider: { in: [ChannelProvider.META_MESSENGER, ChannelProvider.META_INSTAGRAM] },
        status: ChannelStatus.CONNECTED,
      },
    });

    const summary: Array<{ channelId: string; name: string; threads: number; imported: number; error?: string }> = [];

    for (const channel of channels) {
      const metadata = this.secrets.readMetadata(channel.metadata);
      const pageId = metadata.pageId ?? channel.externalId;
      const token = await this.secrets.getAccessToken(channel.id);
      if (!pageId || !token) {
        summary.push({ channelId: channel.id, name: channel.name, threads: 0, imported: 0, error: 'Missing page token' });
        continue;
      }

      const isInstagram = channel.provider === ChannelProvider.META_INSTAGRAM;
      const platform = isInstagram ? ('instagram' as const) : ('messenger' as const);
      const ownAccountIds = new Set(
        [pageId, channel.externalId, metadata.instagramBusinessAccountId].filter(Boolean) as string[],
      );

      try {
        const threads = await this.api.fetchPageConversations(pageId, token, 25, platform);
        let imported = 0;

        for (const thread of threads) {
          const participants = thread.participants?.data ?? [];
          const customer = participants.find((p) => !ownAccountIds.has(p.id));
          if (!customer) continue;

          const messages = thread.id
            ? await this.api.fetchThreadMessages(thread.id, token)
            : (thread.messages?.data ?? []);

          for (const msg of messages) {
            if (!msg.id || (msg.from?.id && ownAccountIds.has(msg.from.id))) continue;

            const resolved = await this.media.resolveInboundMedia(channel.teamId, token, {
              text: msg.message ?? null,
              sticker_id: msg.sticker_id,
              sticker: (msg as { sticker?: { id?: string; url?: string; image_url?: string } }).sticker,
              attachments: msg.attachments as never,
            });

            await this.channelMessages.ingest({
              teamId: channel.teamId,
              channelId: channel.id,
              externalIdentityId: customer.id,
              displayName: customer.name ?? msg.from?.name ?? customer.id,
              providerMessageId: msg.id,
              direction: MessageDirection.INBOUND,
              type: resolved.type,
              status: MessageStatus.RECEIVED,
              text: resolved.text,
              payload: msg,
              mediaStorageKey: resolved.mediaStorageKey,
              mediaMimeType: resolved.mediaMimeType,
              mediaFileName: resolved.mediaFileName,
              mediaSizeBytes: resolved.mediaSizeBytes,
              occurredAt: msg.created_time ? new Date(msg.created_time) : new Date(),
              isHistory: true,
            });
            imported++;
          }
        }

        this.logger.log(`[Meta sync] ${channel.name} (${platform}): ${threads.length} threads, ${imported} messages imported`);
        summary.push({ channelId: channel.id, name: channel.name, threads: threads.length, imported });
      } catch (error) {
        let message = error instanceof Error ? error.message : String(error);
        if (isInstagram) {
          const access = await this.api.inspectInstagramAccess(pageId, token);
          if (access.instagramMessagesDisabled) {
            message =
              'Instagram DM access is disabled. Enable it in Instagram app (Settings → Privacy → Messages → Allow access to messages) AND in Meta Business Suite when linking the Page to Instagram (Allow access to Instagram messages in Inbox), then reconnect.';
          } else if (access.likelyNeedsAdvancedAccess) {
            message =
              'Meta API returned 0 Instagram conversations. Real customer DMs require the ChatLoora app to be Live with Advanced Access for instagram_manage_messages (App Review + Business Verification in Meta Developer Console). Until then, only app testers can appear.';
          } else if (access.missingScopes.length) {
            message += ` | missing scopes: ${access.missingScopes.join(', ')}`;
          } else if (access.conversationsError) {
            message += ` | ${access.conversationsError}`;
          }
        }
        this.logger.warn(`[Meta sync] failed for ${channel.name}: ${message}`);
        summary.push({ channelId: channel.id, name: channel.name, threads: 0, imported: 0, error: message });
      }
    }

    return {
      channels: channels.length,
      imported: summary.reduce((n, s) => n + s.imported, 0),
      commentsImported: commentSummary.imported,
      results: summary,
      commentResults: commentSummary.results,
    };
  }

  /**
   * Pull Facebook + Instagram post comments via Graph API when webhooks are delayed or missing.
   * New comments are ingested as live (!isHistory) so the inbox updates and AI can reply publicly.
   */
  async syncPostComments(teamId: string) {
    await this.repairCommentDmBleed(teamId);

    const igSummary = await this.syncInstagramPostComments(teamId);
    const fbSummary = await this.syncFacebookPostComments(teamId);

    return {
      imported: igSummary.imported + fbSummary.imported,
      results: [...igSummary.results, ...fbSummary.results],
    };
  }

  private async syncInstagramPostComments(teamId: string) {
    const channels = await this.prisma.channel.findMany({
      where: { teamId, provider: ChannelProvider.META_INSTAGRAM, status: ChannelStatus.CONNECTED },
      orderBy: { updatedAt: 'desc' },
    });

    const seenIgIds = new Set<string>();
    const uniqueChannels = channels.filter((channel) => {
      const igId = channel.externalId;
      if (!igId || seenIgIds.has(igId)) return false;
      seenIgIds.add(igId);
      return true;
    });

    const results: Array<{ channelId: string; name: string; ok: boolean; media?: number; error?: string }> = [];
    let imported = 0;

    for (const channel of uniqueChannels) {
      const igId = channel.externalId;
      const token = await this.secrets.getAccessToken(channel.id);
      if (!igId || !token) {
        results.push({ channelId: channel.id, name: channel.name, ok: false, error: 'Missing token' });
        continue;
      }

      const rateLimitedUntil = this.igCommentRateLimitedUntil.get(igId) ?? 0;
      if (Date.now() < rateLimitedUntil) {
        results.push({
          channelId: channel.id,
          name: channel.name,
          ok: false,
          error: `Rate limited — retry after ${new Date(rateLimitedUntil).toISOString()}`,
        });
        continue;
      }

      try {
        const media = await this.api.fetchInstagramMedia(igId, token, 8);
        for (const [index, item] of media.entries()) {
          const isRecentPost = index < 3;
          if (!isRecentPost && !item.comments_count) continue;
          const comments = await this.api.fetchInstagramMediaComments(item.id, token, 50);
          for (const comment of comments) {
            const fromId = comment.from?.id ?? '';
            if (!fromId || fromId === igId || !comment.id) continue;
            const displayName =
              comment.from?.username ?? comment.username ?? comment.from?.id ?? fromId;
            const identityKey = `comment:${fromId}:${item.id}`;
            const commentMeta = {
              source: 'meta_comment_sync',
              commentId: comment.id,
              postId: item.id,
              fromId,
              instagramBusinessAccountId: igId,
            };

            const already = await this.prisma.conversationMessage.findFirst({
              where: { providerMessageId: comment.id, teamId },
              select: { id: true, conversationId: true },
            });
            if (already) {
              await this.ensureMessageOnPostCommentThread({
                teamId,
                channelId: channel.id,
                messageId: already.id,
                currentConversationId: already.conversationId,
                identityKey,
                displayName,
                postId: item.id,
                metadata: commentMeta,
              });
            } else {
              const occurredAt = comment.timestamp ? new Date(comment.timestamp) : new Date();
              // Only treat brand-new comments as live (AI + realtime). Backfills for
              // another team / older comments must not spam public AI replies.
              const ageMs = Date.now() - occurredAt.getTime();
              const isLive = ageMs >= 0 && ageMs < 300_000;
              await this.channelMessages.ingest({
                teamId,
                channelId: channel.id,
                externalIdentityId: identityKey,
                displayName,
                providerMessageId: comment.id,
                direction: MessageDirection.INBOUND,
                type: MessageType.TEXT,
                status: MessageStatus.RECEIVED,
                text: comment.text?.trim() || '[Comment]',
                payload: { ...comment, postId: item.id },
                occurredAt,
                isHistory: !isLive,
                kind: ConversationKind.COMMENT,
                subject: `💬 ${displayName} · post ${item.id}`,
                conversationMetadata: commentMeta,
              });
              imported++;
            }

            // Import public replies on the comment (including our AI/human replies).
            for (const reply of comment.replies?.data ?? []) {
              if (!reply.id) continue;
              const replyFromId = reply.from?.id ?? '';
              const replyUsername = reply.from?.username ?? reply.username ?? '';
              const isOwn =
                replyFromId === igId ||
                (!replyFromId && Boolean(replyUsername)); // page replies often omit from.id
              const replyAlready = await this.prisma.conversationMessage.findFirst({
                where: { providerMessageId: reply.id, teamId },
                select: { id: true, conversationId: true },
              });
              if (replyAlready) {
                await this.ensureMessageOnPostCommentThread({
                  teamId,
                  channelId: channel.id,
                  messageId: replyAlready.id,
                  currentConversationId: replyAlready.conversationId,
                  identityKey,
                  displayName,
                  postId: item.id,
                  metadata: { ...commentMeta, commentId: comment.id, replyId: reply.id },
                });
                continue;
              }
              await this.channelMessages.ingest({
                teamId,
                channelId: channel.id,
                externalIdentityId: identityKey,
                displayName: isOwn ? displayName : replyUsername || displayName,
                providerMessageId: reply.id,
                direction: isOwn ? MessageDirection.OUTBOUND : MessageDirection.INBOUND,
                type: MessageType.TEXT,
                status: isOwn ? MessageStatus.SENT : MessageStatus.RECEIVED,
                text: reply.text?.trim() || '[Reply]',
                payload: { ...reply, postId: item.id, parentCommentId: comment.id },
                occurredAt: reply.timestamp ? new Date(reply.timestamp) : new Date(),
                isHistory: true, // do not re-trigger AI for historical/public replies
                kind: ConversationKind.COMMENT,
                subject: `💬 ${displayName} · post ${item.id}`,
                conversationMetadata: {
                  ...commentMeta,
                  commentId: comment.id,
                  replyId: reply.id,
                },
              });
              imported++;
            }
          }
        }
        this.logger.log(`[Meta comment sync] ${channel.name}: ${media.length} media scanned`);
        results.push({ channelId: channel.id, name: channel.name, ok: true, media: media.length });
      } catch (error) {
        const graphDetail = this.api.graphErrorMessage(error);
        const message = error instanceof Error ? error.message : String(error);
        if (this.api.isGraphRateLimitError(error)) {
          this.igCommentRateLimitedUntil.set(igId!, Date.now() + 15 * 60_000);
          this.logger.warn(
            `[Meta comment sync] rate limited for ${channel.name} (igId=${igId}) — backing off 15m: ${graphDetail}`,
          );
        } else {
          this.logger.warn(`[Meta comment sync] failed for ${channel.name}: ${message} — ${graphDetail}`);
        }
        results.push({ channelId: channel.id, name: channel.name, ok: false, error: message });
      }
    }

    return { imported, results };
  }

  private async syncFacebookPostComments(teamId: string) {
    const channels = await this.prisma.channel.findMany({
      where: { teamId, provider: ChannelProvider.META_MESSENGER, status: ChannelStatus.CONNECTED },
    });

    const results: Array<{ channelId: string; name: string; ok: boolean; posts?: number; error?: string }> = [];
    let imported = 0;

    for (const channel of channels) {
      const pageId = channel.externalId;
      const token = await this.secrets.getAccessToken(channel.id);
      if (!pageId || !token) {
        results.push({ channelId: channel.id, name: channel.name, ok: false, error: 'Missing token' });
        continue;
      }

      try {
        const posts = await this.api.fetchFacebookPagePosts(pageId, token, 20);
        for (const post of posts) {
          const comments = await this.api.fetchFacebookPostComments(post.id, token, 50);
          for (const comment of comments) {
            imported += await this.ingestSyncedFacebookComment({
              teamId,
              channel,
              pageId,
              postId: post.id,
              comment,
              parentCommentId: null,
            });

            for (const reply of comment.comments?.data ?? []) {
              imported += await this.ingestSyncedFacebookComment({
                teamId,
                channel,
                pageId,
                postId: post.id,
                comment: reply,
                parentCommentId: comment.id,
              });
            }
          }
        }
        this.logger.log(`[Meta FB comment sync] ${channel.name}: ${posts.length} posts scanned`);
        results.push({ channelId: channel.id, name: channel.name, ok: true, posts: posts.length });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`[Meta FB comment sync] failed for ${channel.name}: ${message}`);
        results.push({ channelId: channel.id, name: channel.name, ok: false, error: message });
      }
    }

    return { imported, results };
  }

  private async ingestSyncedFacebookComment(input: {
    teamId: string;
    channel: { id: string; name: string };
    pageId: string;
    postId: string;
    comment: {
      id?: string;
      message?: string;
      created_time?: string;
      from?: { id?: string; name?: string };
    };
    parentCommentId: string | null;
  }) {
    const commentId = input.comment.id ?? '';
    const fromId = input.comment.from?.id ?? '';
    if (!commentId || !fromId || fromId === input.pageId) return 0;

    const displayName = input.comment.from?.name ?? fromId;
    const identityKey = `comment:${fromId}:${input.postId}`;
    const commentMeta = {
      source: 'meta_fb_comment_sync',
      commentId,
      postId: input.postId,
      parentCommentId: input.parentCommentId,
      fromId,
      pageId: input.pageId,
    };

    const already = await this.prisma.conversationMessage.findFirst({
      where: { providerMessageId: commentId, teamId: input.teamId },
      select: { id: true, conversationId: true },
    });
    if (already) {
      await this.ensureMessageOnPostCommentThread({
        teamId: input.teamId,
        channelId: input.channel.id,
        messageId: already.id,
        currentConversationId: already.conversationId,
        identityKey,
        displayName,
        postId: input.postId,
        metadata: commentMeta,
      });
      return 0;
    }

    const occurredAt = input.comment.created_time ? new Date(input.comment.created_time) : new Date();
    const ageMs = Date.now() - occurredAt.getTime();
    const isLive = ageMs >= 0 && ageMs < 120_000;

    await this.channelMessages.ingest({
      teamId: input.teamId,
      channelId: input.channel.id,
      externalIdentityId: identityKey,
      displayName,
      providerMessageId: commentId,
      direction: MessageDirection.INBOUND,
      type: MessageType.TEXT,
      status: MessageStatus.RECEIVED,
      text: input.comment.message?.trim() || '[Comment]',
      payload: { ...input.comment, postId: input.postId },
      occurredAt,
      isHistory: !isLive,
      kind: ConversationKind.COMMENT,
      subject: `💬 ${displayName} · post ${input.postId}`,
      conversationMetadata: commentMeta,
    });
    return 1;
  }

  /**
   * Move a comment/reply onto the per-post COMMENT thread so the inbox shows
   * one conversation per (user × post) instead of dumping every post together.
   */
  private async ensureMessageOnPostCommentThread(input: {
    teamId: string;
    channelId: string;
    messageId: string;
    currentConversationId: string;
    identityKey: string;
    displayName: string;
    postId: string;
    metadata: Record<string, unknown>;
  }) {
    const subject = `💬 ${input.displayName} · post ${input.postId}`;
    let identity = await this.prisma.contactIdentity.findFirst({
      where: { channelId: input.channelId, externalId: input.identityKey },
    });
    if (!identity) {
      const contact = await this.prisma.contact.create({
        data: {
          teamId: input.teamId,
          displayName: input.displayName,
          identities: {
            create: {
              teamId: input.teamId,
              channelId: input.channelId,
              externalId: input.identityKey,
              displayName: input.displayName,
            },
          },
        },
        include: { identities: true },
      });
      identity = contact.identities[0]!;
    }

    let target = await this.prisma.conversation.findFirst({
      where: {
        teamId: input.teamId,
        channelId: input.channelId,
        identityId: identity.id,
        kind: ConversationKind.COMMENT,
        status: { not: 'CLOSED' },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!target) {
      target = await this.prisma.conversation.create({
        data: {
          teamId: input.teamId,
          channelId: input.channelId,
          contactId: identity.contactId,
          identityId: identity.id,
          kind: ConversationKind.COMMENT,
          subject,
          metadata: input.metadata as object,
          status: 'OPEN',
          isArchived: false,
          lastMessageAt: new Date(),
        },
      });
    } else {
      await this.prisma.conversation.update({
        where: { id: target.id },
        data: {
          subject,
          metadata: input.metadata as object,
          isArchived: false,
          status: 'OPEN',
        },
      });
    }

    if (target.id === input.currentConversationId) return;

    const msg = await this.prisma.conversationMessage.findFirst({
      where: { id: input.messageId, teamId: input.teamId },
      select: { providerMessageId: true, createdAt: true },
    });
    if (!msg) return;

    if (msg.providerMessageId) {
      const clash = await this.prisma.conversationMessage.findFirst({
        where: {
          conversationId: target.id,
          providerMessageId: msg.providerMessageId,
          NOT: { id: input.messageId },
        },
        select: { id: true },
      });
      if (clash) {
        await this.prisma.conversationMessage.delete({ where: { id: input.messageId } });
        return;
      }
    }

    await this.prisma.conversationMessage.update({
      where: { id: input.messageId },
      data: { conversationId: target.id },
    });
    await this.prisma.conversation.updateMany({
      where: {
        id: target.id,
        OR: [{ lastMessageAt: null }, { lastMessageAt: { lt: msg.createdAt } }],
      },
      data: { lastMessageAt: msg.createdAt },
    });
  }

  /**
   * Older inbox replies to post comments were ingested without kind=COMMENT, so they
   * landed in the DM list. Move those messages back onto the COMMENT thread and
   * archive the phantom DM conversation.
   */
  private async repairCommentDmBleed(teamId: string) {
    const phantoms = await this.prisma.conversation.findMany({
      where: {
        teamId,
        kind: ConversationKind.DIRECT_MESSAGE,
        identity: { externalId: { startsWith: 'comment:' } },
        status: { not: 'CLOSED' },
      },
      select: { id: true, identityId: true, channelId: true, lastMessageAt: true },
      take: 100,
    });
    for (const phantom of phantoms) {
      const commentThread = await this.prisma.conversation.findFirst({
        where: {
          teamId,
          channelId: phantom.channelId,
          identityId: phantom.identityId,
          kind: ConversationKind.COMMENT,
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (!commentThread) {
        await this.prisma.conversation.update({
          where: { id: phantom.id },
          data: { kind: ConversationKind.COMMENT },
        });
        continue;
      }
      const messages = await this.prisma.conversationMessage.findMany({
        where: { conversationId: phantom.id },
        select: { id: true, providerMessageId: true },
      });
      for (const msg of messages) {
        if (msg.providerMessageId) {
          const exists = await this.prisma.conversationMessage.findUnique({
            where: {
              conversationId_providerMessageId: {
                conversationId: commentThread.id,
                providerMessageId: msg.providerMessageId,
              },
            },
            select: { id: true },
          });
          if (exists) {
            await this.prisma.conversationMessage.delete({ where: { id: msg.id } });
            continue;
          }
        }
        await this.prisma.conversationMessage.update({
          where: { id: msg.id },
          data: { conversationId: commentThread.id },
        });
      }
      await this.prisma.conversation.update({
        where: { id: phantom.id },
        data: { status: 'CLOSED', isArchived: true, unreadCount: 0 },
      });
      if (phantom.lastMessageAt) {
        await this.prisma.conversation.updateMany({
          where: {
            id: commentThread.id,
            OR: [{ lastMessageAt: null }, { lastMessageAt: { lt: phantom.lastMessageAt } }],
          },
          data: { lastMessageAt: phantom.lastMessageAt },
        });
      }
    }
  }

  /** Sync Facebook + Instagram post comments for every connected team. */
  async syncPostCommentsAllTeams() {
    const channels = await this.prisma.channel.findMany({
      where: {
        provider: { in: [ChannelProvider.META_INSTAGRAM, ChannelProvider.META_MESSENGER] },
        status: ChannelStatus.CONNECTED,
      },
      select: { teamId: true },
      distinct: ['teamId'],
    });
    const summaries: Array<{ teamId: string; imported: number }> = [];
    for (const { teamId } of channels) {
      try {
        const result = await this.syncPostComments(teamId);
        if (result.imported > 0) {
          this.logger.log(`[Meta comment poll] team=${teamId} imported=${result.imported}`);
        }
        summaries.push({ teamId, imported: result.imported });
      } catch (error) {
        this.logger.warn(
          `[Meta comment poll] team=${teamId} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    return { teams: summaries.length, summaries };
  }

  /** Check whether connected Instagram channels have the scopes needed for DMs + webhooks. */
  async inspectInstagramAccess(teamId: string) {
    const channels = await this.prisma.channel.findMany({
      where: { teamId, provider: ChannelProvider.META_INSTAGRAM, status: ChannelStatus.CONNECTED },
    });

    const results = [];
    for (const channel of channels) {
      const metadata = this.secrets.readMetadata(channel.metadata);
      const pageId = metadata.pageId ?? channel.externalId;
      const token = await this.secrets.getAccessToken(channel.id);
      if (!pageId || !token) {
        results.push({ channelId: channel.id, name: channel.name, ok: false, error: 'Missing page token' });
        continue;
      }
      const access = await this.api.inspectInstagramAccess(pageId, token);
      results.push({ channelId: channel.id, name: channel.name, pageId, instagramId: channel.externalId, ...access });
    }
    return { channels: results.length, results };
  }

  /**
   * Connect Instagram professional account via Instagram Login API token (chatloora-IG app).
   * Subscribes webhooks for comments + messages on graph.instagram.com/me/subscribed_apps.
   */
  async connectInstagramLogin(teamId: string, accessToken: string) {
    const trimmed = accessToken.trim();
    if (!trimmed) throw new BadRequestException('Instagram access token is required');

    const me = await this.instagramApi.getMe(trimmed).catch((error) => {
      const detail = axios.isAxiosError(error) ? error.response?.data : String(error);
      throw new BadRequestException({
        message: 'Invalid Instagram access token — generate a new token in Meta Developer Console',
        detail,
      });
    });

    const instagramId = String(me.user_id ?? me.id);
    const username = me.username ?? instagramId;
    const displayName = username.startsWith('@') ? username : `@${username}`;

    const subscriptions = await this.instagramApi.subscribeWebhooks(trimmed, 'comments,messages');
    if (!subscriptions?.success) {
      throw new BadRequestException('Instagram webhook subscription failed — check token permissions');
    }

    const callbackUrl = `${this.config.getOrThrow<string>('API_PUBLIC_URL').replace(/\/$/, '')}/api/webhooks/meta`;
    const appWebhook = await this.instagramApi.ensureAppWebhook(callbackUrl, this.verifyToken);

    const channel = await this.prisma.channel.upsert({
      where: {
        teamId_provider_externalId: {
          teamId,
          provider: ChannelProvider.META_INSTAGRAM,
          externalId: instagramId,
        },
      },
      update: {
        name: displayName,
        status: ChannelStatus.CONNECTED,
        purpose: 'INBOX',
        lastSeenAt: new Date(),
        metadata: {
          connectionSource: 'instagram_login',
          instagramUsername: me.username ?? null,
          instagramBusinessAccountId: instagramId,
        },
      },
      create: {
        teamId,
        provider: ChannelProvider.META_INSTAGRAM,
        externalId: instagramId,
        name: displayName,
        status: ChannelStatus.CONNECTED,
        purpose: 'INBOX',
        metadata: {
          connectionSource: 'instagram_login',
          instagramUsername: me.username ?? null,
          instagramBusinessAccountId: instagramId,
        },
      },
    });

    await this.channelTokens.storeTokens(channel.id, {
      accessToken: trimmed,
      scopes: 'instagram_business_basic,instagram_business_manage_comments,instagram_business_manage_messages',
    });

    this.logger.log(
      `[Instagram Login] connected team=${teamId} igId=${instagramId} username=${me.username ?? 'n/a'} appWebhook=${JSON.stringify(appWebhook)}`,
    );

    return {
      channelId: channel.id,
      instagramId,
      username: me.username ?? null,
      subscriptions: await this.instagramApi.listSubscriptions(trimmed),
      appWebhook,
    };
  }

  async resubscribeInstagramLoginWebhooks(teamId: string, channelId: string) {
    const channel = await this.prisma.channel.findFirst({
      where: { id: channelId, teamId, provider: ChannelProvider.META_INSTAGRAM, status: ChannelStatus.CONNECTED },
    });
    if (!channel) throw new NotFoundException('Instagram channel not found');

    const token = await this.channelTokens.getAccessToken(channel.id);
    if (!token) throw new BadRequestException('Instagram token missing — reconnect with a new token');

    const subscriptions = await this.instagramApi.subscribeWebhooks(token, 'comments,messages');
    const callbackUrl = `${this.config.getOrThrow<string>('API_PUBLIC_URL').replace(/\/$/, '')}/api/webhooks/meta`;
    const appWebhook = await this.instagramApi.ensureAppWebhook(callbackUrl, this.verifyToken);
    return { subscriptions, appWebhook, channelId: channel.id };
  }

  private verifySignatureRaw(rawBody: Buffer, signature: string): boolean {
    const secrets = [this.appSecret, this.instagramApiAppSecret].filter(
      (value): value is string => Boolean(value),
    );
    return secrets.some(
      (secret) =>
        signature === `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`,
    );
  }

  private assertSignatureRaw(rawBody: Buffer, signature: string) {
    if (!this.verifySignatureRaw(rawBody, signature)) {
      throw new BadRequestException('Invalid Meta webhook signature');
    }
  }

  private assertSignature(body: Record<string, unknown>, signature: string) {
    const expected = `sha256=${createHmac('sha256', this.appSecret!).update(JSON.stringify(body)).digest('hex')}`;
    if (signature !== expected) throw new BadRequestException('Invalid Meta webhook signature');
  }
}
