import { Injectable, NotFoundException } from '@nestjs/common';
import { ConversationEventType, ConversationStatus, MessageStatus, MessageType, NotificationType, Permission } from '@watsapp/database';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { SOCKET_EVENTS } from '@watsapp/shared';
import { AuditService } from '../audit/audit.service';
import { AiSettingsService } from '../ai/ai-settings.service';
import { AiTransferService } from '../ai/ai-transfer.service';
import { ChannelMessageService } from '../channels/channel-message.service';
import { OutboundChannelService } from '../channels/outbound-channel.service';
import { UploadedMediaFile } from '../common/uploaded-media-file';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { LocalStorageService } from '../storage/local-storage.service';
import { AssignConversationDto, ConversationQueryDto, ReplyDto, TagConversationDto, TextBodyDto, UpdateConversationStatusDto } from './dto/conversation.dto';

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbound: OutboundChannelService,
    private readonly channelMessages: ChannelMessageService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeGateway,
    private readonly aiSettings: AiSettingsService,
    private readonly aiTransfer: AiTransferService,
    private readonly storage: LocalStorageService,
  ) {}

  list(teamId: string, query: ConversationQueryDto) {
    const archived = query.archived;
    return this.prisma.conversation.findMany({
      where: {
        teamId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.assigneeUserId ? { assigneeUserId: query.assigneeUserId } : {}),
        ...(archived !== undefined ? { isArchived: archived } : { isArchived: false }),
        ...(query.pinned !== undefined ? { isPinned: query.pinned } : {}),
        ...(query.unread ? { unreadCount: { gt: 0 } } : {}),
        ...(query.read ? { unreadCount: 0 } : {}),
        ...(query.labelId ? { tags: { some: { labelId: query.labelId } } } : {}),
        ...(query.provider ? { channel: { provider: query.provider } } : {}),
        ...(query.search ? { OR: [{ subject: { contains: query.search, mode: 'insensitive' } }, { contact: { displayName: { contains: query.search, mode: 'insensitive' } } }, { messages: { some: { text: { contains: query.search, mode: 'insensitive' } } } }] } : {}),
      },
      include: { contact: true, channel: true, assignee: { select: { id: true, name: true, email: true } }, tags: { include: { label: true } }, messages: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: [{ isPinned: 'desc' }, { lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
      take: query.limit ?? 200,
    });
  }

  async get(teamId: string, id: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, teamId },
      include: {
        contact: { include: { identities: { include: { channel: true } }, labels: { include: { label: true } } } },
        channel: true,
        department: true,
        assignee: { select: { id: true, name: true, email: true } },
        tags: { include: { label: true } },
        messages: { orderBy: { createdAt: 'asc' } },
        notes: { include: { author: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'asc' } },
        comments: { include: { author: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: 'asc' } },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  async getMessageMedia(teamId: string, conversationId: string, messageId: string) {
    const message = await this.prisma.conversationMessage.findFirst({
      where: { id: messageId, conversationId, teamId },
    });
    if (!message || !message.mediaStorageKey) throw new NotFoundException('Media not found');
    const path = this.storage.resolvePath(message.mediaStorageKey);
    try {
      const info = await stat(path);
      return {
        stream: createReadStream(path),
        mimeType: message.mediaMimeType ?? 'application/octet-stream',
        fileName: message.mediaFileName ?? this.fallbackFileName(messageId, message.mediaMimeType),
        sizeBytes: info.size,
      };
    } catch {
      throw new NotFoundException('Media file is no longer available');
    }
  }

  private fallbackFileName(messageId: string, mimeType?: string | null) {
    const ext = mimeType?.includes('/') ? mimeType.split('/')[1].split(';')[0] : 'bin';
    return `${messageId}.${ext}`;
  }

  async reply(teamId: string, conversationId: string, dto: ReplyDto) {
    const conversation = await this.get(teamId, conversationId);
    const identity = conversation.contact.identities.find((item) => item.channelId === conversation.channelId) ?? conversation.contact.identities[0];
    if (!identity) throw new NotFoundException('No sendable channel identity found');
    const response = await this.outbound.sendText(teamId, conversationId, dto.text);
    const result = await this.channelMessages.ingest({
      teamId,
      channelId: conversation.channelId,
      externalIdentityId: identity.externalId,
      displayName: conversation.contact.displayName,
      providerMessageId: response?.key?.id,
      direction: 'OUTBOUND',
      type: MessageType.TEXT,
      status: MessageStatus.SENT,
      text: dto.text,
      payload: response ?? {},
      occurredAt: new Date(),
    });
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { unreadCount: 0, lastReadAt: new Date() } });
    const settings = await this.aiSettings.ensure(teamId);
    if (settings.pauseAiOnHumanReply) {
      await this.aiTransfer.pauseAi(teamId, conversationId);
    }
    return result.message;
  }

  async replyMedia(
    teamId: string,
    conversationId: string,
    file: UploadedMediaFile,
    options: { caption?: string; voiceNote?: boolean | string; asSticker?: boolean | string },
  ) {
    const voiceNote = options.voiceNote === true || options.voiceNote === 'true';
    const asSticker = options.asSticker === true || options.asSticker === 'true';
    const conversation = await this.get(teamId, conversationId);
    const identity = conversation.contact.identities.find((item) => item.channelId === conversation.channelId) ?? conversation.contact.identities[0];
    if (!identity) throw new NotFoundException('No sendable channel identity found');
    const stored = await this.storage.putMedia(teamId, file);
    const type = this.detectOutboundType(file.mimetype, { voiceNote, asSticker });
    const response = await this.outbound.sendMedia(teamId, conversationId, type, {
      buffer: file.buffer,
      mimeType: file.mimetype,
      fileName: file.originalname,
      caption: options.caption,
      voiceNote,
    });
    const result = await this.channelMessages.ingest({
      teamId,
      channelId: conversation.channelId,
      externalIdentityId: identity.externalId,
      displayName: conversation.contact.displayName,
      providerMessageId: response?.key?.id,
      direction: 'OUTBOUND',
      type,
      status: MessageStatus.SENT,
      text: options.caption ?? null,
      payload: response ?? {},
      mediaStorageKey: stored.storageKey,
      mediaMimeType: file.mimetype,
      mediaFileName: file.originalname,
      mediaSizeBytes: stored.sizeBytes,
      occurredAt: new Date(),
    });
    await this.prisma.conversation.update({ where: { id: conversationId }, data: { unreadCount: 0, lastReadAt: new Date() } });
    const settings = await this.aiSettings.ensure(teamId);
    if (settings.pauseAiOnHumanReply) {
      await this.aiTransfer.pauseAi(teamId, conversationId);
    }
    return result.message;
  }

  private detectOutboundType(mimeType: string, options: { voiceNote?: boolean; asSticker?: boolean }): MessageType {
    if (options.asSticker || mimeType === 'image/webp') return MessageType.STICKER;
    if (options.voiceNote || mimeType.startsWith('audio/')) return MessageType.AUDIO;
    if (mimeType.startsWith('image/')) return MessageType.IMAGE;
    if (mimeType.startsWith('video/')) return MessageType.VIDEO;
    return MessageType.DOCUMENT;
  }

  async assign(teamId: string, conversationId: string, actorUserId: string | undefined, dto: AssignConversationDto) {
    await this.get(teamId, conversationId);
    if (dto.assigneeUserId) {
      const member = await this.prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId: dto.assigneeUserId } } });
      if (!member) throw new NotFoundException('Assignee is not a team member');
    }
    const conversation = await this.prisma.conversation.update({ where: { id: conversationId }, data: { assigneeUserId: dto.assigneeUserId ?? null } });
    await this.event(conversationId, actorUserId, dto.assigneeUserId ? ConversationEventType.ASSIGNED : ConversationEventType.UNASSIGNED, { assigneeUserId: dto.assigneeUserId });
    if (dto.assigneeUserId) {
      await this.notifications.create({ teamId, userId: dto.assigneeUserId, type: NotificationType.ASSIGNMENT, title: 'Conversation assigned', body: conversation.subject ?? 'A conversation was assigned to you', data: { conversationId } });
    }
    await this.audit.log({ teamId, actorUserId, action: 'conversation.assign', resource: 'conversation', resourceId: conversationId, metadata: { assigneeUserId: dto.assigneeUserId } });
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.CONVERSATION_ASSIGNED, conversation);
    this.realtime.emitConversation(conversationId, SOCKET_EVENTS.CONVERSATION_ASSIGNED, conversation);
    return conversation;
  }

  async status(teamId: string, conversationId: string, actorUserId: string | undefined, dto: UpdateConversationStatusDto) {
    await this.get(teamId, conversationId);
    const conversation = await this.prisma.conversation.update({ where: { id: conversationId }, data: { status: dto.status, closedAt: dto.status === ConversationStatus.CLOSED ? new Date() : null } });
    await this.event(conversationId, actorUserId, ConversationEventType.STATUS_CHANGED, { status: dto.status });
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.CONVERSATION_UPDATED, conversation);
    return conversation;
  }

  async archive(teamId: string, conversationId: string, actorUserId: string | undefined, value: boolean) {
    await this.get(teamId, conversationId);
    const conversation = await this.prisma.conversation.update({ where: { id: conversationId }, data: { isArchived: value } });
    await this.event(conversationId, actorUserId, value ? ConversationEventType.ARCHIVED : ConversationEventType.UNARCHIVED, {});
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.CONVERSATION_ARCHIVED, conversation);
    return conversation;
  }

  async pin(teamId: string, conversationId: string, actorUserId: string | undefined, value: boolean) {
    await this.get(teamId, conversationId);
    const conversation = await this.prisma.conversation.update({ where: { id: conversationId }, data: { isPinned: value } });
    await this.event(conversationId, actorUserId, value ? ConversationEventType.PINNED : ConversationEventType.UNPINNED, {});
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.CONVERSATION_PINNED, conversation);
    return conversation;
  }

  async markRead(teamId: string, conversationId: string) {
    await this.get(teamId, conversationId);
    return this.prisma.conversation.update({ where: { id: conversationId }, data: { unreadCount: 0, lastReadAt: new Date() } });
  }

  async note(teamId: string, conversationId: string, actorUserId: string, dto: TextBodyDto) {
    await this.get(teamId, conversationId);
    const note = await this.prisma.conversationNote.create({ data: { conversationId, authorUserId: actorUserId, body: dto.body }, include: { author: { select: { id: true, name: true, email: true } } } });
    await this.event(conversationId, actorUserId, ConversationEventType.NOTE_CREATED, { noteId: note.id });
    this.realtime.emitConversation(conversationId, SOCKET_EVENTS.CONVERSATION_NOTE_CREATED, note);
    return note;
  }

  async comment(teamId: string, conversationId: string, actorUserId: string, dto: TextBodyDto) {
    const conversation = await this.get(teamId, conversationId);
    const comment = await this.prisma.internalComment.create({ data: { conversationId, authorUserId: actorUserId, body: dto.body }, include: { author: { select: { id: true, name: true, email: true } } } });
    await this.event(conversationId, actorUserId, ConversationEventType.COMMENT_CREATED, { commentId: comment.id });
    if (conversation.assigneeUserId && conversation.assigneeUserId !== actorUserId) {
      await this.notifications.create({ teamId, userId: conversation.assigneeUserId, type: NotificationType.MENTION, title: 'New internal comment', body: dto.body, data: { conversationId } });
    }
    this.realtime.emitConversation(conversationId, SOCKET_EVENTS.CONVERSATION_COMMENT_CREATED, comment);
    return comment;
  }

  async tag(teamId: string, conversationId: string, actorUserId: string | undefined, dto: TagConversationDto) {
    await this.get(teamId, conversationId);
    const label = await this.prisma.label.findFirst({ where: { id: dto.labelId, teamId } });
    if (!label) throw new NotFoundException('Label not found');
    const tag = await this.prisma.conversationTag.upsert({ where: { conversationId_labelId: { conversationId, labelId: dto.labelId } }, update: {}, create: { conversationId, labelId: dto.labelId } });
    await this.event(conversationId, actorUserId, ConversationEventType.TAGGED, { labelId: dto.labelId });
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.TAG_UPDATED, tag);
    return tag;
  }

  async untag(teamId: string, conversationId: string, actorUserId: string | undefined, labelId: string) {
    await this.get(teamId, conversationId);
    await this.prisma.conversationTag.deleteMany({ where: { conversationId, labelId } });
    await this.event(conversationId, actorUserId, ConversationEventType.UNTAGGED, { labelId });
  }

  private event(conversationId: string, actorUserId: string | undefined, type: ConversationEventType, metadata: object) {
    return this.prisma.conversationEvent.create({ data: { conversationId, actorUserId, type, metadata } });
  }

  static inboxPermissions(): Permission[] {
    return [Permission.INBOX_READ];
  }
}
