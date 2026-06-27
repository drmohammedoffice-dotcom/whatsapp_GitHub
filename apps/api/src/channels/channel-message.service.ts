import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConversationEventType, MessageDirection, MessageStatus, MessageType } from '@watsapp/database';
import { SOCKET_EVENTS } from '@watsapp/shared';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { QUEUES } from '../queues/queues.constants';
import type { AiInboundJob } from '../ai/ai-inbound.processor';
import { TikTokEventsService } from '../tiktok/tiktok-events.service';

@Injectable()
export class ChannelMessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    @InjectQueue(QUEUES.AI_INBOUND) private readonly aiInboundQueue: Queue<AiInboundJob>,
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
  }) {
    const contact = await this.upsertContact(input.teamId, input.channelId, input.externalIdentityId, input.displayName, input.senderPhone);
    const existingConversationId = await this.findConversationId(input.teamId, input.channelId, contact.identity.id);
    const isNewConversation = !existingConversationId;
    const conversation = await this.prisma.conversation.upsert({
      where: { id: existingConversationId ?? '__missing__' },
      update: {
        lastMessageAt: input.occurredAt ?? new Date(),
        unreadCount: input.direction === MessageDirection.INBOUND ? { increment: 1 } : undefined,
        status: input.direction === MessageDirection.INBOUND ? 'OPEN' : undefined,
      },
      create: {
        teamId: input.teamId,
        channelId: input.channelId,
        contactId: contact.contact.id,
        identityId: contact.identity.id,
        subject: contact.contact.displayName,
        lastMessageAt: input.occurredAt ?? new Date(),
        unreadCount: input.direction === MessageDirection.INBOUND ? 1 : 0,
      },
    });

    const message = await this.prisma.conversationMessage.upsert({
      where: input.providerMessageId ? { conversationId_providerMessageId: { conversationId: conversation.id, providerMessageId: input.providerMessageId } } : { id: '__missing__' },
      update: { status: input.status },
      create: {
        teamId: input.teamId,
        conversationId: conversation.id,
        sourceMessageId: input.sourceMessageId,
        providerMessageId: input.providerMessageId,
        direction: input.direction,
        type: input.type,
        status: input.status,
        text: input.text,
        payload: input.payload ?? {},
        mediaStorageKey: input.mediaStorageKey ?? null,
        mediaMimeType: input.mediaMimeType ?? null,
        mediaFileName: input.mediaFileName ?? null,
        mediaSizeBytes: input.mediaSizeBytes ?? null,
        sentAt: input.direction === MessageDirection.OUTBOUND ? input.occurredAt ?? new Date() : null,
        receivedAt: input.direction === MessageDirection.INBOUND ? input.occurredAt ?? new Date() : null,
      },
    });

    await this.prisma.conversationEvent.create({
      data: { conversationId: conversation.id, type: ConversationEventType.MESSAGE_CREATED, metadata: { messageId: message.id, direction: input.direction } },
    });

    const payload = { ...message, conversation };
    this.realtime.emitTeam(input.teamId, SOCKET_EVENTS.CONVERSATION_MESSAGE_CREATED, payload);
    this.realtime.emitConversation(conversation.id, SOCKET_EVENTS.CONVERSATION_MESSAGE_CREATED, payload);
    this.realtime.emitTeam(input.teamId, SOCKET_EVENTS.CONVERSATION_UPDATED, conversation);

    if (input.direction === MessageDirection.INBOUND && (input.type === MessageType.TEXT || input.type === MessageType.AUDIO)) {
      await this.aiInboundQueue.add(
        'process',
        {
          teamId: input.teamId,
          conversationId: conversation.id,
          messageId: message.id,
          messageText: input.text,
          isNewConversation,
        },
        { removeOnComplete: 100, removeOnFail: 50, attempts: 2, backoff: { type: 'exponential', delay: 2000 } },
      );
    }

    if (this.tiktokEvents && input.direction === MessageDirection.INBOUND && isNewConversation) {
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

    return { contact: contact.contact, identity: contact.identity, conversation, message };
  }

  private async upsertContact(
    teamId: string,
    channelId: string,
    externalId: string,
    displayName?: string | null,
    senderPhone?: string | null,
  ) {
    const realPhone = this.normalizeRealPhone(externalId, senderPhone);
    const existing = await this.prisma.contactIdentity.findUnique({ where: { channelId_externalId: { channelId, externalId } }, include: { contact: true } });
    if (existing) {
      if (realPhone && this.shouldUpdateContactPhone(existing.contact.phone, realPhone)) {
        const updated = await this.prisma.contact.update({ where: { id: existing.contact.id }, data: { phone: realPhone } });
        this.realtime.emitTeam(teamId, SOCKET_EVENTS.CONTACT_UPDATED, updated);
        return { identity: existing, contact: updated };
      }
      return { identity: existing, contact: existing.contact };
    }

    const contact = await this.prisma.contact.create({
      data: {
        teamId,
        displayName: displayName || externalId,
        phone: realPhone,
      },
    });
    const identity = await this.prisma.contactIdentity.create({ data: { teamId, contactId: contact.id, channelId, externalId, displayName } });
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.CONTACT_UPDATED, contact);
    return { identity, contact };
  }

  private normalizeRealPhone(externalId: string, senderPhone?: string | null): string | null {
    const candidate = senderPhone?.trim();
    if (candidate) return candidate.replace(/[^\d+]/g, '');
    if (externalId.includes('@lid') || externalId.includes('@broadcast') || externalId.includes('@g.us')) return null;
    if (externalId.includes('@')) return externalId.split('@')[0].split(':')[0];
    return externalId;
  }

  private shouldUpdateContactPhone(currentPhone: string | null, realPhone: string): boolean {
    if (!currentPhone) return true;
    const normalized = currentPhone.replace(/[^\d+]/g, '');
    if (normalized === realPhone) return false;
    // Replace clearly invalid stored values (e.g. LID numbers or status placeholders)
    if (!/^\+?\d{6,}$/.test(normalized)) return true;
    // LID user numbers are typically 15+ digits; real phones are shorter
    if (normalized.length >= 15 && realPhone.length < 15) return true;
    return false;
  }

  private async findConversationId(teamId: string, channelId: string, identityId: string) {
    const existing = await this.prisma.conversation.findFirst({ where: { teamId, channelId, identityId, status: { not: 'CLOSED' } }, orderBy: { createdAt: 'desc' } });
    return existing?.id ?? null;
  }
}
