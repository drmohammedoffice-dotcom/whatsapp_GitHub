import { Injectable } from '@nestjs/common';
import { MessageDirection } from '@watsapp/database';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(teamId: string) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60_000);
    const [open, closed, messages, outbound, inbound, transfers, aiReplies, leads, satisfaction] = await Promise.all([
      this.prisma.conversation.count({ where: { teamId, status: 'OPEN' } }),
      this.prisma.conversation.count({ where: { teamId, status: 'CLOSED', closedAt: { gte: since } } }),
      this.prisma.conversationMessage.count({ where: { teamId, createdAt: { gte: since } } }),
      this.prisma.conversationMessage.count({ where: { teamId, direction: MessageDirection.OUTBOUND, createdAt: { gte: since } } }),
      this.prisma.conversationMessage.count({ where: { teamId, direction: MessageDirection.INBOUND, createdAt: { gte: since } } }),
      this.prisma.conversationTransfer.count({ where: { teamId, createdAt: { gte: since } } }),
      this.prisma.conversationEvent.count({ where: { conversation: { teamId }, type: 'AI_REPLY_SENT', createdAt: { gte: since } } }),
      this.prisma.lead.count({ where: { teamId, createdAt: { gte: since } } }),
      this.prisma.customerSatisfaction.aggregate({ where: { teamId, createdAt: { gte: since } }, _avg: { rating: true }, _count: { _all: true } }),
    ]);
    return {
      openConversations: open,
      closedConversations30d: closed,
      messages30d: messages,
      outbound30d: outbound,
      inbound30d: inbound,
      humanTransfers30d: transfers,
      successfulAiReplies30d: aiReplies,
      leads30d: leads,
      avgSatisfaction: satisfaction._avg.rating ?? 0,
      satisfactionSamples: satisfaction._count._all,
    };
  }

  async responseTime(teamId: string) {
    const inbound = await this.prisma.conversationMessage.findMany({ where: { teamId, direction: 'INBOUND' }, select: { conversationId: true, createdAt: true }, orderBy: { createdAt: 'asc' }, take: 500 });
    const outbound = await this.prisma.conversationMessage.findMany({ where: { teamId, direction: 'OUTBOUND' }, select: { conversationId: true, createdAt: true }, orderBy: { createdAt: 'asc' }, take: 500 });
    const responseTimes: number[] = [];
    for (const message of inbound) {
      const reply = outbound.find((item) => item.conversationId === message.conversationId && item.createdAt > message.createdAt);
      if (reply) responseTimes.push(reply.createdAt.getTime() - message.createdAt.getTime());
    }
    const averageMs = responseTimes.length ? Math.round(responseTimes.reduce((sum, value) => sum + value, 0) / responseTimes.length) : 0;
    return { averageMs, samples: responseTimes.length };
  }

  async volume(teamId: string) {
    const rows = await this.prisma.conversationMessage.groupBy({ by: ['direction'], where: { teamId }, _count: { _all: true } });
    return rows.map((row) => ({ direction: row.direction, count: row._count._all }));
  }

  agentPerformance(teamId: string) {
    return this.prisma.conversation.groupBy({ by: ['assigneeUserId', 'status'], where: { teamId, assigneeUserId: { not: null } }, _count: { _all: true } });
  }

  async aiMetrics(teamId: string) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60_000);
    const [runs, transfers, costs] = await Promise.all([
      this.prisma.aiRun.groupBy({ by: ['task', 'status'], where: { teamId, createdAt: { gte: since } }, _count: { _all: true } }),
      this.prisma.conversationTransfer.groupBy({ by: ['reason'], where: { teamId, createdAt: { gte: since } }, _count: { _all: true } }),
      this.prisma.aiCostEvent.aggregate({ where: { teamId, createdAt: { gte: since } }, _sum: { costCents: true, promptTokens: true, completionTokens: true } }),
    ]);
    return { runs, transfers, costs };
  }

  async topProducts(teamId: string) {
    return this.prisma.product.findMany({ where: { teamId, isActive: true }, orderBy: { viewCount: 'desc' }, take: 10, select: { id: true, name: true, viewCount: true, priceCents: true, category: true } });
  }

  async leadStats(teamId: string) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60_000);
    return this.prisma.lead.groupBy({ by: ['status'], where: { teamId, createdAt: { gte: since } }, _count: { _all: true } });
  }

  async conversationAnalytics(teamId: string) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60_000);
    const [byStatus, byAiMode, transfers] = await Promise.all([
      this.prisma.conversation.groupBy({ by: ['status'], where: { teamId }, _count: { _all: true } }),
      this.prisma.conversation.groupBy({ by: ['aiMode'], where: { teamId }, _count: { _all: true } }),
      this.prisma.conversationTransfer.findMany({ where: { teamId, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, reason: true, confidence: true, createdAt: true, conversationId: true } }),
    ]);
    return { byStatus, byAiMode, recentTransfers: transfers };
  }
}
