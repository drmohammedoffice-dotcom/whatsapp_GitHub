import { Injectable } from '@nestjs/common';
import { MessageStatus, MessageType, WhatsAppConnectionLogEvent, WhatsAppSessionStatus } from '@watsapp/database';
import { PrismaService } from '../../prisma/prisma.service';
import { ConnectionLogInput } from './interfaces/events.interface';

@Injectable()
export class WhatsAppRepository {
  constructor(private readonly prisma: PrismaService) {}

  listSessions(teamId: string, userId?: string) {
    return this.prisma.whatsAppSession.findMany({
      where: { teamId, ...(userId ? { createdByUserId: userId } : {}) },
      select: {
        id: true,
        displayName: true,
        phoneNumber: true,
        jid: true,
        profilePhotoUrl: true,
        status: true,
        qrCode: true,
        qrCodeUpdatedAt: true,
        connectedAt: true,
        disconnectedAt: true,
        lastSeenAt: true,
        lastHeartbeatAt: true,
        failureReason: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  findSessionForTeam(teamId: string, sessionId: string) {
    return this.prisma.whatsAppSession.findFirst({ where: { id: sessionId, teamId } });
  }

  createSession(teamId: string, userId?: string, displayName?: string) {
    return this.prisma.whatsAppSession.create({
      data: {
        teamId,
        createdByUserId: userId,
        displayName,
        status: WhatsAppSessionStatus.PENDING_QR,
      },
    });
  }

  updateSession(sessionId: string, data: Record<string, unknown>) {
    return this.prisma.whatsAppSession.update({ where: { id: sessionId }, data: data as never });
  }

  deleteSession(sessionId: string) {
    return this.prisma.whatsAppSession.delete({ where: { id: sessionId } });
  }

  purgeCredentials(sessionId: string) {
    return this.prisma.sessionCredential.deleteMany({ where: { sessionId } });
  }

  logConnection(input: ConnectionLogInput) {
    return this.prisma.whatsAppConnectionLog.create({
      data: {
        ...input,
        metadata: input.metadata as object | undefined,
      },
    });
  }

  listConnectionLogs(teamId: string, sessionId: string, take = 50) {
    return this.prisma.whatsAppConnectionLog.findMany({
      where: { teamId, sessionId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }

  upsertWhatsAppContact(input: {
    teamId: string;
    sessionId: string;
    providerContactId: string;
    displayName?: string | null;
    phoneNumber?: string | null;
    profilePhotoUrl?: string | null;
    metadata?: object;
  }) {
    return this.prisma.whatsAppContact.upsert({
      where: { sessionId_providerContactId: { sessionId: input.sessionId, providerContactId: input.providerContactId } },
      update: {
        displayName: input.displayName ?? undefined,
        phoneNumber: input.phoneNumber ?? undefined,
        profilePhotoUrl: input.profilePhotoUrl ?? undefined,
        metadata: input.metadata ?? undefined,
      },
      create: input,
    });
  }

  listChats(teamId: string, sessionId: string) {
    return this.prisma.chat.findMany({
      where: { teamId, sessionId },
      orderBy: { lastMessageAt: 'desc' },
      take: 200,
    });
  }

  listMessages(teamId: string, sessionId: string, chatId?: string) {
    return this.prisma.message.findMany({
      where: { teamId, sessionId, ...(chatId ? { chatId } : {}) },
      include: { attachments: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  upsertChat(input: { teamId: string; sessionId: string; providerChatId: string }) {
    return this.prisma.chat.upsert({
      where: { sessionId_providerChatId: { sessionId: input.sessionId, providerChatId: input.providerChatId } },
      update: { lastMessageAt: new Date() },
      create: {
        teamId: input.teamId,
        sessionId: input.sessionId,
        providerChatId: input.providerChatId,
        isGroup: input.providerChatId.endsWith('@g.us'),
        lastMessageAt: new Date(),
      },
    });
  }

  upsertInboundMessage(input: {
    teamId: string;
    sessionId: string;
    chatId: string;
    providerMessageId: string;
    fromJid: string;
    type: MessageType;
    text: string | null;
    payload: object;
    receivedAt: Date;
  }) {
    return this.prisma.message.upsert({
      where: { sessionId_providerMessageId: { sessionId: input.sessionId, providerMessageId: input.providerMessageId } },
      update: {},
      create: {
        teamId: input.teamId,
        sessionId: input.sessionId,
        chatId: input.chatId,
        providerMessageId: input.providerMessageId,
        fromJid: input.fromJid,
        toJid: input.sessionId,
        direction: 'INBOUND',
        type: input.type,
        status: MessageStatus.RECEIVED,
        text: input.text,
        payload: input.payload,
        receivedAt: input.receivedAt,
      },
    });
  }

  findRestorableSessions() {
    return this.prisma.whatsAppSession.findMany({
      where: {
        status: {
          in: [WhatsAppSessionStatus.CONNECTED, WhatsAppSessionStatus.CONNECTING, WhatsAppSessionStatus.DISCONNECTED],
        },
      },
      select: { id: true, teamId: true, createdByUserId: true },
    });
  }

  updateMessageStatus(sessionId: string, providerMessageId: string, status: MessageStatus) {
    return this.prisma.message.updateMany({
      where: { sessionId, providerMessageId },
      data: { status },
    });
  }
}
