import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AssistantKnowledgeService } from '../../assistant/assistant-knowledge.service';
import { AssistantSettingsService, type AssistantSettings } from '../../assistant/assistant-settings.service';
import { AdminAuditService } from './admin-audit.service';

@Injectable()
export class AdminAssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AssistantSettingsService,
    private readonly knowledge: AssistantKnowledgeService,
    private readonly audit: AdminAuditService,
  ) {}

  getSettings() {
    return this.settings.get();
  }

  async updateSettings(adminUserId: string, patch: Partial<AssistantSettings>) {
    const next = await this.settings.update(patch);
    await this.audit.log({
      adminUserId,
      action: 'assistant.settings.update',
      resource: 'assistant',
      metadata: { keys: Object.keys(patch) },
    });
    return next;
  }

  listArticles() {
    return this.knowledge.list(true);
  }

  async createArticle(adminUserId: string, body: Parameters<AssistantKnowledgeService['create']>[0]) {
    const article = await this.knowledge.create(body);
    await this.audit.log({
      adminUserId,
      action: 'assistant.article.create',
      resource: 'assistant_article',
      resourceId: article.id,
    });
    return article;
  }

  async updateArticle(adminUserId: string, id: string, body: Record<string, unknown>) {
    const article = await this.knowledge.update(id, body);
    await this.audit.log({
      adminUserId,
      action: 'assistant.article.update',
      resource: 'assistant_article',
      resourceId: id,
    });
    return article;
  }

  async deleteArticle(adminUserId: string, id: string) {
    const article = await this.knowledge.remove(id);
    await this.audit.log({
      adminUserId,
      action: 'assistant.article.delete',
      resource: 'assistant_article',
      resourceId: id,
    });
    return article;
  }

  async stats() {
    const [conversations, messages, unanswered, downvotes, recentUser] = await Promise.all([
      this.prisma.platformAssistantConversation.count(),
      this.prisma.platformAssistantMessage.count(),
      this.prisma.platformAssistantMessage.count({ where: { unanswered: true } }),
      this.prisma.platformAssistantMessage.count({ where: { helpful: false } }),
      this.prisma.platformAssistantMessage.findMany({
        where: { role: 'USER' },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: { content: true },
      }),
    ]);
    const counts = new Map<string, number>();
    for (const row of recentUser) {
      const key = row.content.trim().slice(0, 80);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const topQuestions = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([question, count]) => ({ question, count }));
    return { conversations, messages, unanswered, downvotes, topQuestions };
  }
}
