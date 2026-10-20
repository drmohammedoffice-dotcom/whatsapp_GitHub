import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ChannelProvider, ConversationAiMode, ConversationEventType, ConversationKind, MessageDirection, MessageStatus, MessageType } from '@watsapp/database';
import { SOCKET_EVENTS } from '@watsapp/shared';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { QUEUES } from '../queues/queues.constants';
import type { AiInboundJob } from '../ai/ai-inbound.processor';
import { channelProviderToAiPlatform } from '../ai/ai-platform';
import { TikTokEventsService } from '../tiktok/tiktok-events.service';
import { TikTokIntegrationTrackingService } from '../tiktok-integration/tiktok-integration-tracking.service';
import { isTrackingChannel } from './channel-purpose';

const AI_INBOUND_TYPES = new Set<MessageType>([
  MessageType.TEXT,
  MessageType.AUDIO,
  MessageType.IMAGE,
  MessageType.STICKER,
  MessageType.VIDEO,
]);

@Injectable()
export class ChannelMessageService {
  private readonly logger = new Logger(ChannelMessageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    @InjectQueue(QUEUES.AI_INBOUND) private readonly aiInboundQueue: Queue<AiInboundJob>,
    @Optional() private readonly _tiktokIntegrationTracking: TikTokIntegrationTrackingService,
    @Optional() @Inject(TikTokEventsService) private readonly tiktokEvents?: TikTokEventsService,
  ) {}

  async ingest(input: {
    teamId: string;
    channelId: string;
    externalIdentityId: string;
    senderPhone?: string | null;
    displayName?: string | null;
    providerMessageId?: string | null;
    sourceMessageId?: string | null;
    direction: MessageDirection;
    type: MessageType;
    status: MessageStatus;
    text?: string | null;
    payload?: object | null;
    mediaStorageKey?: string | null;
    mediaMimeType?: string | null;
    mediaFileName?: string | null;
    mediaSizeBytes?: number | null;
    occurredAt?: Date;
    isHistory?: boolean;
    /**
     * Set when a human (workspace agent from the inbox, or the owner typing
     * from the linked phone) sent this outbound message — never for AI/system
     * sends. Used to auto-pause AI on manual takeover (pauseAiOnHumanReply).
     */
    humanReply?: boolean;
    /** DIRECT_MESSAGE (default) vs COMMENT for Meta page/IG post comments. */
    kind?: ConversationKind;
    conversationMetadata?: Record<string, unknown> | null;
    subject?: string | null;
  }) {
    const occurredAt = input.occurredAt ?? new Date();
    const isHistory = Boolean(input.isHistory);
    const kind = input.kind ?? ConversationKind.DIRECT_MESSAGE;
    const normalizedText = input.text?.trim() || this.mediaFallbackText(input.type) || null;

    const channelRow = await this.prisma.channel.findFirst({
      where: { id: input.channelId, teamId: input.teamId },
      select: { purpose: true, metadata: true, provider: true },
    });
    // Tracking WhatsApp must never create Inbox contacts/conversations/AI.
    // Primary path is WhatsAppEventsService.persistTrackingInbound; this is a hard guard.
    if (channelRow?.purpose === 'TRACKING' || isTrackingChannel(channelRow)) {
      console.warn(`[ChannelMessage] refused Inbox ingest for tracking channel ${input.channelId}`);
      return {
        contact: null,
        identity: null,
        conversation: null,
        message: null,
      };
    }

    const contact = await this.upsertContact(input.teamId, input.channelId, input.externalIdentityId, input.displayName, input.senderPhone);
    const existingConversationId = await this.findConversationId(
      input.teamId,
      input.channelId,
      contact.identity.id,
      null,
      kind,
    );
    const isNewConversation = !existingConversationId;
    const subject =
      input.subject?.trim() ||
      (kind === ConversationKind.COMMENT
        ? `💬 ${contact.contact.displayName}`
        : contact.contact.displayName);
    const conversation = await this.prisma.conversation.upsert({
      where: { id: existingConversationId ?? '__missing__' },
      update: isHistory
        ? {}
        : {
            lastMessageAt: occurredAt,
            unreadCount: input.direction === MessageDirection.INBOUND ? { increment: 1 } : undefined,
            status: input.direction === MessageDirection.INBOUND ? 'OPEN' : undefined,
            isArchived: false,
            ...(input.conversationMetadata
              ? { metadata: input.conversationMetadata as object }
              : {}),
          },
      create: {
        teamId: input.teamId,
        channelId: input.channelId,
        contactId: contact.contact.id,
        identityId: contact.identity.id,
        subject,
        kind,
        metadata: (input.conversationMetadata ?? undefined) as object | undefined,
        lastMessageAt: occurredAt,
        unreadCount: !isHistory && input.direction === MessageDirection.INBOUND ? 1 : 0,
        isArchived: false,
      },
    });

    // Historical messages can arrive in any order; keep lastMessageAt at the
    // most recent timestamp without downgrading a newer real-time value.
    if (isHistory) {
      await this.prisma.conversation.updateMany({
        where: { id: conversation.id, OR: [{ lastMessageAt: null }, { lastMessageAt: { lt: occurredAt } }] },
        data: { lastMessageAt: occurredAt },
      });
    }

    // Echoes of our own sends (AI/inbox) arrive again via the provider with the
    // same providerMessageId — they must not count as a fresh human reply.
    const existedBefore = input.providerMessageId
      ? await this.prisma.conversationMessage.findUnique({
          where: { conversationId_providerMessageId: { conversationId: conversation.id, providerMessageId: input.providerMessageId } },
          select: { id: true },
        })
      : null;

    const message = await this.prisma.conversationMessage.upsert({
      where: input.providerMessageId ? { conversationId_providerMessageId: { conversationId: conversation.id, providerMessageId: input.providerMessageId } } : { id: '__missing__' },
      update: {
        status: input.status,
        ...(input.mediaStorageKey
          ? {
              type: input.type,
              mediaStorageKey: input.mediaStorageKey,
              mediaMimeType: input.mediaMimeType ?? null,
              mediaFileName: input.mediaFileName ?? null,
              mediaSizeBytes: input.mediaSizeBytes ?? null,
            }
          : {}),
      },
      create: {
        teamId: input.teamId,
        conversationId: conversation.id,
        sourceMessageId: input.sourceMessageId,
        providerMessageId: input.providerMessageId,
        direction: input.direction,
        type: input.type,
        status: input.status,
        text: normalizedText,
        payload: input.payload ?? {},
        mediaStorageKey: input.mediaStorageKey ?? null,
        mediaMimeType: input.mediaMimeType ?? null,
        mediaFileName: input.mediaFileName ?? null,
        mediaSizeBytes: input.mediaSizeBytes ?? null,
        sentAt: input.direction === MessageDirection.OUTBOUND ? occurredAt : null,
        receivedAt: input.direction === MessageDirection.INBOUND ? occurredAt : null,
        ...(isHistory ? { createdAt: occurredAt } : {}),
      },
    });

    await this.prisma.conversationEvent.create({
      data: { conversationId: conversation.id, type: ConversationEventType.MESSAGE_CREATED, metadata: { messageId: message.id, direction: input.direction } },
    });

    if (!isHistory) {
      const payload = { ...message, conversation };
      this.realtime.emitTeam(input.teamId, SOCKET_EVENTS.CONVERSATION_MESSAGE_CREATED, payload);
      this.realtime.emitConversation(conversation.id, SOCKET_EVENTS.CONVERSATION_MESSAGE_CREATED, payload);
      this.realtime.emitTeam(input.teamId, SOCKET_EVENTS.CONVERSATION_UPDATED, conversation);
    }

    // Manual takeover: a human replied, so pause AI for this conversation
    // (when the workspace has pauseAiOnHumanReply enabled).
    if (
      !isHistory &&
      input.humanReply &&
      !existedBefore &&
      input.direction === MessageDirection.OUTBOUND &&
      conversation.aiMode === ConversationAiMode.AI_ACTIVE &&
      channelRow?.provider
    ) {
      await this.pauseAiForHumanReply(input.teamId, conversation.id, channelRow.provider);
    }

    // Skip echoes / re-sync of the same providerMessageId — otherwise pollers
    // would re-enqueue AI and spam public comment replies.
    if (
      !isHistory &&
      !existedBefore &&
      input.direction === MessageDirection.INBOUND &&
      AI_INBOUND_TYPES.has(input.type)
    ) {
      const aiText = normalizedText;
      // IMAGE may have empty caption (receipt photo) — still enqueue for AI subscription proof.
      if (input.type === MessageType.AUDIO || input.type === MessageType.IMAGE || aiText) {
        const queueOpts = {
          removeOnComplete: 100,
          removeOnFail: 50,
          // Keep retrying under API pressure — gateway also fails over across keys.
          attempts: 25,
          backoff: { type: 'custom' as const },
          ...(input.type === MessageType.AUDIO || input.type === MessageType.IMAGE
            ? { delay: 1500 }
            : {}),
        };
        try {
          await this.aiInboundQueue.add(
            'process',
            {
              teamId: input.teamId,
              conversationId: conversation.id,
              messageId: message.id,
              messageText: aiText,
              isNewConversation,
            },
            {
              ...queueOpts,
              jobId: `ai-inbound-${message.id}`,
            },
          );
          this.logger.log(
            `[AI] Enqueued ai-inbound job conversationId=${conversation.id} messageId=${message.id} teamId=${input.teamId} type=${input.type}`,
          );
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          if (/Job with this id already exists|already exists/i.test(msg)) {
            this.logger.warn(`[AI] Duplicate ai-inbound skipped messageId=${message.id}`);
          } else {
            throw error;
          }
        }
      }
    }

    if (!isHistory && this.tiktokEvents && input.direction === MessageDirection.INBOUND && isNewConversation) {
      void this.tiktokEvents
        .handleConversationStarted({
          teamId: input.teamId,
          conversationId: conversation.id,
          contactId: contact.contact.id,
          messageText: input.text,
          isNewConversation,
        })
        .catch(() => undefined);
    }

    // Inbox WhatsApp never fires TikTok Contact — tracking uses persistTrackingInbound only.
    return { contact: contact.contact, identity: contact.identity, conversation, message };
  }

  /** Nudge connected inbox clients to reload after a bulk/history sync. */
  emitConversationsRefreshed(teamId: string) {
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.CONVERSATION_UPDATED, { refreshedAt: new Date().toISOString() });
  }

  /**
   * Enforce the pauseAiOnHumanReply setting: when the workspace owner/agent
   * answers a customer manually (from the inbox or from the linked phone),
   * flip the conversation to AI_PAUSED so the assistant stops interjecting.
   * The inbox toggle (reactivate) turns it back on.
   */
  private async pauseAiForHumanReply(teamId: string, conversationId: string, provider: ChannelProvider) {
    try {
      const platform = channelProviderToAiPlatform(provider);
      const settings = await this.prisma.aiSettings.findUnique({
        where: { teamId_platform: { teamId, platform } },
        select: { enabled: true, autoReplyEnabled: true, pauseAiOnHumanReply: true },
      });
      // Nothing to pause when AI is off; do not fight the user's explicit setting.
      if (!settings?.pauseAiOnHumanReply || !settings.enabled || !settings.autoReplyEnabled) return;

      const updated = await this.prisma.conversation.updateMany({
        where: { id: conversationId, teamId, aiMode: ConversationAiMode.AI_ACTIVE },
        data: { aiMode: ConversationAiMode.AI_PAUSED, aiPausedAt: new Date() },
      });
      if (!updated.count) return;

      await this.prisma.conversationEvent.create({
        data: { conversationId, type: ConversationEventType.AI_PAUSED, metadata: { reason: 'HUMAN_REPLY' } },
      });
      this.realtime.emitTeam(teamId, SOCKET_EVENTS.AI_PAUSED, { conversationId, reason: 'HUMAN_REPLY' });
      this.logger.log(`[AI] Paused after human reply conversationId=${conversationId} teamId=${teamId}`);
    } catch (error) {
      this.logger.warn(`[AI] pauseAiForHumanReply failed conversationId=${conversationId}: ${String(error)}`);
    }
  }

  private async upsertContact(
    teamId: string,
    channelId: string,
    externalId: string,
    displayName?: string | null,
    senderPhone?: string | null,
  ) {
    const realPhone = this.normalizeRealPhone(externalId, senderPhone);
    const label = this.resolveContactLabel(displayName, realPhone, externalId);
    const existing = await this.prisma.contactIdentity.findUnique({
      where: { channelId_externalId: { channelId, externalId } },
      include: { contact: true },
    });
    if (existing) {
      const data: { phone?: string; displayName?: string } = {};
      if (realPhone && this.shouldUpdateContactPhone(existing.contact.phone, realPhone)) {
        data.phone = realPhone;
      }
      if (this.shouldUpdateContactDisplayName(existing.contact.displayName, label, realPhone)) {
        data.displayName = label;
      }
      if (Object.keys(data).length) {
        const updated = await this.prisma.contact.update({ where: { id: existing.contact.id }, data });
        if (data.displayName) {
          await this.prisma.conversation.updateMany({
            where: { teamId, contactId: updated.id, channelId },
            data: { subject: data.displayName },
          });
        }
        this.realtime.emitTeam(teamId, SOCKET_EVENTS.CONTACT_UPDATED, updated);
        return { identity: existing, contact: updated };
      }
      return { identity: existing, contact: existing.contact };
    }

    const contact = await this.prisma.contact.create({
      data: {
        teamId,
        displayName: label,
        phone: realPhone,
      },
    });
    const identity = await this.prisma.contactIdentity.create({
      data: { teamId, contactId: contact.id, channelId, externalId, displayName: label },
    });
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.CONTACT_UPDATED, contact);
    return { identity, contact };
  }

  /** Apply phone / WhatsApp push name / profile photo after LID resolution or Baileys profile fetch. */
  async enrichContactProfile(
    teamId: string,
    contactId: string,
    patch: { phone?: string | null; displayName?: string | null; avatarUrl?: string | null },
  ) {
    const contact = await this.prisma.contact.findFirst({ where: { id: contactId, teamId } });
    if (!contact) return null;

    const data: { phone?: string; displayName?: string; avatarUrl?: string } = {};
    const phone = patch.phone?.replace(/[^\d+]/g, '') || null;
    if (phone && this.shouldUpdateContactPhone(contact.phone, phone)) data.phone = phone;

    const label = this.resolveContactLabel(patch.displayName ?? contact.displayName, data.phone ?? contact.phone, contact.displayName);
    if (this.shouldUpdateContactDisplayName(contact.displayName, label, data.phone ?? contact.phone)) {
      data.displayName = label;
    }
    if (patch.avatarUrl?.trim() && patch.avatarUrl !== contact.avatarUrl) {
      data.avatarUrl = patch.avatarUrl.trim();
    }
    if (!Object.keys(data).length) return contact;

    const updated = await this.prisma.contact.update({ where: { id: contactId }, data });
    if (data.displayName) {
      await this.prisma.conversation.updateMany({
        where: { teamId, contactId },
        data: { subject: data.displayName },
      });
    }
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.CONTACT_UPDATED, updated);
    return updated;
  }

  private resolveContactLabel(displayName?: string | null, phone?: string | null, externalId?: string | null): string {
    const name = displayName?.trim() || '';
    if (name && !this.isOpaqueWhatsAppId(name)) return name;
    if (phone && /^\+?\d{8,15}$/.test(phone.replace(/[^\d+]/g, ''))) {
      return phone.replace(/[^\d+]/g, '');
    }
    if (externalId && !this.isOpaqueWhatsAppId(externalId) && externalId.includes('@s.whatsapp.net')) {
      const fromJid = externalId.split('@')[0]?.split(':')[0] ?? '';
      if (/^\d{8,15}$/.test(fromJid)) return fromJid;
    }
    return phone?.replace(/[^\d+]/g, '') || 'WhatsApp';
  }

  private isOpaqueWhatsAppId(value: string): boolean {
    const v = value.trim();
    if (!v) return true;
    if (v.includes('@lid') || v.includes('@g.us') || v.includes('@broadcast')) return true;
    // Raw LID-looking digit strings (WhatsApp LIDs are typically very long)
    if (/^\d{15,}$/.test(v.replace(/\D/g, '')) && !v.includes('@s.whatsapp.net')) return true;
    return false;
  }

  private shouldUpdateContactDisplayName(current: string, next: string, phone?: string | null): boolean {
    if (!next || next === current) return false;
    if (this.isOpaqueWhatsAppId(current) && !this.isOpaqueWhatsAppId(next)) return true;
    if (phone && current === phone && next !== phone && !this.isOpaqueWhatsAppId(next)) return true;
    if (!current || current === 'WhatsApp') return true;
    return false;
  }

  private normalizeRealPhone(externalId: string, senderPhone?: string | null): string | null {
    const candidate = senderPhone?.trim();
    if (candidate) {
      const digits = candidate.replace(/[^\d+]/g, '');
      if (/^\+?\d{8,15}$/.test(digits)) return digits.replace(/^\+/, '');
    }
    if (externalId.includes('@lid') || externalId.includes('@broadcast') || externalId.includes('@g.us')) return null;
    if (externalId.includes('@s.whatsapp.net')) {
      const fromJid = externalId.split('@')[0]?.split(':')[0] ?? '';
      return /^\d{8,15}$/.test(fromJid) ? fromJid : null;
    }
    if (externalId.includes('@')) return null;
    const bare = externalId.replace(/[^\d]/g, '');
    return /^\d{8,15}$/.test(bare) ? bare : null;
  }

  private shouldUpdateContactPhone(currentPhone: string | null, realPhone: string): boolean {
    if (!currentPhone) return true;
    const normalized = currentPhone.replace(/[^\d+]/g, '');
    if (normalized === realPhone || normalized === `+${realPhone}`) return false;
    // Replace clearly invalid stored values (e.g. LID numbers or status placeholders)
    if (!/^\+?\d{8,15}$/.test(normalized)) return true;
    // LID user numbers are typically 15+ digits; real phones are shorter
    if (normalized.length >= 15 && realPhone.length < 15) return true;
    return false;
  }

  private mediaFallbackText(type: MessageType): string | null {
    switch (type) {
      case MessageType.IMAGE:
        return '[صورة من الزبون]';
      case MessageType.STICKER:
        return '[ملصق من الزبون]';
      case MessageType.VIDEO:
        return '[فيديو من الزبون]';
      case MessageType.DOCUMENT:
        return '[ملف من الزبون]';
      default:
        return null;
    }
  }

  private async findConversationId(
    teamId: string,
    channelId: string,
    identityId: string,
    reopenAfterMs: number | null = null,
    kind: ConversationKind = ConversationKind.DIRECT_MESSAGE,
  ) {
    const existing = await this.prisma.conversation.findFirst({
      where: { teamId, channelId, identityId, kind, status: { not: 'CLOSED' } },
      orderBy: { createdAt: 'desc' },
    });
    if (!existing) return null;

    // Tracking Business WA: after the WhatsApp conversation window of silence,
    // close the old thread so the next inbound is a new conversation → new Contact.
    if (reopenAfterMs != null && reopenAfterMs > 0) {
      const lastAt = (existing.lastMessageAt ?? existing.createdAt).getTime();
      if (Date.now() - lastAt > reopenAfterMs) {
        await this.prisma.conversation.update({
          where: { id: existing.id },
          data: { status: 'CLOSED' },
        });
        return null;
      }
    }

    return existing.id;
  }
}
