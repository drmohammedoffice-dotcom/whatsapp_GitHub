import { Injectable, NotFoundException } from '@nestjs/common';
import { AiTransferReason, ConversationAiMode, ConversationEventType, NotificationType } from '@watsapp/database';
import { SOCKET_EVENTS } from '@watsapp/shared';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AiAssistantService } from './ai-assistant.service';

@Injectable()
export class AiTransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assistant: AiAssistantService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async transfer(input: {
    teamId: string;
    conversationId: string;
    reason: AiTransferReason;
    confidence?: number;
    fromAiRunId?: string;
    initiatedByUserId?: string;
    assigneeUserId?: string;
    customerMessage?: string;
    skipSummary?: boolean;
  }) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: input.conversationId, teamId: input.teamId },
      include: { contact: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const summary = input.skipSummary
      ? 'Transferred to human agent.'
      : (await this.assistant.conversationTask(input.teamId, input.initiatedByUserId, input.conversationId, 'Summarize this conversation for the human agent taking over. Include customer intent, key facts, and recommended next steps. Be concise.')).content;

    const assigneeUserId = input.assigneeUserId ?? (await this.pickAgent(input.teamId));

    const transfer = await this.prisma.conversationTransfer.create({
      data: {
        teamId: input.teamId,
        conversationId: input.conversationId,
        reason: input.reason,
        summary,
        confidence: input.confidence,
        fromAiRunId: input.fromAiRunId,
        assignedUserId: assigneeUserId,
        initiatedByUserId: input.initiatedByUserId,
        metadata: input.customerMessage ? { customerMessage: input.customerMessage } : undefined,
      },
    });

    await this.prisma.conversation.update({
      where: { id: input.conversationId },
      data: {
        aiMode: ConversationAiMode.HUMAN_ONLY,
        aiPausedAt: new Date(),
        assigneeUserId: assigneeUserId ?? conversation.assigneeUserId,
        status: 'OPEN',
      },
    });

    await this.prisma.conversationEvent.create({
      data: {
        conversationId: input.conversationId,
        actorUserId: input.initiatedByUserId,
        type: ConversationEventType.AI_TRANSFERRED,
        metadata: { transferId: transfer.id, reason: input.reason, assigneeUserId: assigneeUserId ?? null },
      },
    });

    if (assigneeUserId) {
      await this.notifications.create({
        teamId: input.teamId,
        userId: assigneeUserId,
        type: NotificationType.ASSIGNMENT,
        title: 'AI transferred conversation',
        body: `${conversation.contact.displayName}: ${this.reasonLabel(input.reason)}`,
        data: { conversationId: input.conversationId, transferId: transfer.id, summary },
      });
    }

    await this.audit.log({
      teamId: input.teamId,
      actorUserId: input.initiatedByUserId,
      action: 'ai.transfer',
      resource: 'conversationTransfer',
      resourceId: transfer.id,
      metadata: { conversationId: input.conversationId, reason: input.reason },
    });

    this.realtime.emitTeam(input.teamId, SOCKET_EVENTS.AI_TRANSFERRED, { transfer, conversationId: input.conversationId });
    this.realtime.emitConversation(input.conversationId, SOCKET_EVENTS.AI_TRANSFERRED, { transfer });

    return transfer;
  }

  async reactivateAi(teamId: string, conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findFirst({ where: { id: conversationId, teamId } });
    if (!conversation) throw new NotFoundException('Conversation not found');

    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { aiMode: ConversationAiMode.AI_ACTIVE, aiPausedAt: null, aiPausedByUserId: null },
    });

    await this.prisma.conversationEvent.create({
      data: { conversationId, actorUserId: userId, type: ConversationEventType.AI_REACTIVATED, metadata: {} },
    });

    this.realtime.emitTeam(teamId, SOCKET_EVENTS.AI_REACTIVATED, { conversationId });
    return updated;
  }

  async pauseAi(teamId: string, conversationId: string, userId?: string) {
    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { aiMode: ConversationAiMode.AI_PAUSED, aiPausedAt: new Date(), aiPausedByUserId: userId ?? null },
    });
    await this.prisma.conversationEvent.create({
      data: { conversationId, actorUserId: userId, type: ConversationEventType.AI_PAUSED, metadata: {} },
    });
    this.realtime.emitTeam(teamId, SOCKET_EVENTS.AI_PAUSED, { conversationId });
    return updated;
  }

  private async pickAgent(teamId: string) {
    const agents = await this.prisma.agentStatus.findMany({
      where: { teamId, presence: 'AVAILABLE' },
      orderBy: { updatedAt: 'asc' },
      take: 10,
    });
    if (!agents.length) return null;
    const loads = await Promise.all(
      agents.map(async (agent) => ({
        userId: agent.userId,
        count: await this.prisma.conversation.count({ where: { teamId, assigneeUserId: agent.userId, status: { in: ['OPEN', 'PENDING'] } } }),
        capacity: agent.capacity,
      })),
    );
    const available = loads.filter((l) => l.count < l.capacity).sort((a, b) => a.count - b.count);
    return available[0]?.userId ?? agents[0].userId;
  }

  private reasonLabel(reason: AiTransferReason) {
    const labels: Record<AiTransferReason, string> = {
      CUSTOMER_REQUEST: 'Customer requested human',
      LOW_CONFIDENCE: 'Low AI confidence',
      COMPLAINT: 'Complaint detected',
      REFUND_REQUEST: 'Refund request',
      SENSITIVE_ISSUE: 'Sensitive issue',
      CUSTOM_RULE: 'Custom rule',
      KNOWLEDGE_GAP: 'Information not in knowledge base',
    };
    return labels[reason] ?? reason;
  }
}
