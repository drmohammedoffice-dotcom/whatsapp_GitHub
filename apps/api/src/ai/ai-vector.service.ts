import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiProviderService } from './ai-provider.service';

export interface SearchResult { chunkId: string; documentId: string; title: string; content: string; score: number }

@Injectable()
export class AiVectorService {
  private readonly logger = new Logger(AiVectorService.name);

  constructor(private readonly prisma: PrismaService, private readonly provider: AiProviderService) {}

  async index(teamId: string, chunks: Array<{ id: string; content: string }>) {
    if (!chunks.length) return;
    try {
      const embeddings = await this.provider.embed(teamId, chunks.map((chunk) => chunk.content));
      for (let i = 0; i < chunks.length; i++) {
        await this.prisma.$executeRawUnsafe(
          'INSERT INTO ai_knowledge_embedding (chunk_id, team_id, embedding) VALUES ($1, $2, $3::vector) ON CONFLICT (chunk_id) DO UPDATE SET embedding = EXCLUDED.embedding, team_id = EXCLUDED.team_id',
          chunks[i].id,
          teamId,
          `[${embeddings[i].join(',')}]`,
        );
      }
    } catch (error) {
      this.logger.warn(`Vector indexing failed for team ${teamId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async search(teamId: string, query: string, limit = 8): Promise<SearchResult[]> {
    try {
      const [embedding] = await this.provider.embed(teamId, [query]);
      return await this.prisma.$queryRawUnsafe<SearchResult[]>(
        'SELECT c.id as "chunkId", c."documentId" as "documentId", d.title, c.content, (1 - (e.embedding <=> $2::vector))::float as score FROM ai_knowledge_embedding e JOIN "AiKnowledgeChunk" c ON c.id = e.chunk_id JOIN "AiKnowledgeDocument" d ON d.id = c."documentId" WHERE e.team_id = $1 ORDER BY e.embedding <=> $2::vector LIMIT $3',
        teamId,
        `[${embedding.join(',')}]`,
        limit,
      );
    } catch (error) {
      this.logger.warn(`Vector search failed for team ${teamId}, falling back to keyword search: ${error instanceof Error ? error.message : String(error)}`);
      return this.keywordSearch(teamId, query, limit);
    }
  }

  private async keywordSearch(teamId: string, query: string, limit: number): Promise<SearchResult[]> {
    const terms = query.toLowerCase().split(/\s+/).filter((term) => term.length > 2);
    if (!terms.length) return [];
    const chunks = await this.prisma.aiKnowledgeChunk.findMany({
      where: {
        teamId,
        OR: terms.map((term) => ({ content: { contains: term, mode: 'insensitive' as const } })),
      },
      include: { document: { select: { title: true } } },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
    return chunks.map((chunk) => ({
      chunkId: chunk.id,
      documentId: chunk.documentId,
      title: chunk.document.title,
      content: chunk.content,
      score: 0.5,
    }));
  }
}
