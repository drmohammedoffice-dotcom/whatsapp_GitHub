import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ASSISTANT_KNOWLEDGE_SEED } from './assistant-knowledge.catalog';
import { retrieveArticleScore } from './assistant.util';

@Injectable()
export class AssistantKnowledgeService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedBuiltin();
  }

  async seedBuiltin() {
    for (const article of ASSISTANT_KNOWLEDGE_SEED) {
      const existing = await this.prisma.platformAssistantArticle.findUnique({ where: { slug: article.slug } });
      if (existing) continue;
      await this.prisma.platformAssistantArticle.create({
        data: {
          slug: article.slug,
          category: article.category,
          titleAr: article.titleAr,
          titleEn: article.titleEn,
          bodyAr: article.bodyAr,
          bodyEn: article.bodyEn,
          keywords: article.keywords,
          isBuiltin: true,
          sortOrder: article.sortOrder,
        },
      });
    }
  }

  list(includeInactive = false) {
    return this.prisma.platformAssistantArticle.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  retrieve(query: string, limit = 4) {
    return this.prisma.platformAssistantArticle.findMany({ where: { isActive: true } }).then((rows) =>
      rows
        .map((row) => ({ row, score: retrieveArticleScore(query, row) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((item) => item.row),
    );
  }

  create(data: {
    slug: string;
    category: string;
    titleAr: string;
    titleEn: string;
    bodyAr: string;
    bodyEn: string;
    keywords?: string[];
    isActive?: boolean;
    sortOrder?: number;
  }) {
    return this.prisma.platformAssistantArticle.create({
      data: {
        ...data,
        slug: data.slug.trim().toLowerCase().replace(/\s+/g, '-'),
        keywords: data.keywords ?? [],
        isBuiltin: false,
      },
    });
  }

  async update(id: string, data: Record<string, unknown>) {
    const existing = await this.prisma.platformAssistantArticle.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Article not found');
    return this.prisma.platformAssistantArticle.update({ where: { id }, data: data as never });
  }

  async remove(id: string) {
    const existing = await this.prisma.platformAssistantArticle.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Article not found');
    return this.prisma.platformAssistantArticle.delete({ where: { id } });
  }
}
