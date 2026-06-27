import { Injectable } from '@nestjs/common';
import { AiDocumentStatus } from '@watsapp/database';
import { SOCKET_EVENTS } from '@watsapp/shared';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { AiDocumentExtractorService } from './ai-document-extractor.service';
import { AiVectorService } from './ai-vector.service';

@Injectable()
export class AiKnowledgeService {
  constructor(private readonly prisma: PrismaService, private readonly extractor: AiDocumentExtractorService, private readonly vector: AiVectorService, private readonly realtime: RealtimeGateway) {}

  list(teamId: string) {
    return this.prisma.aiKnowledgeDocument.findMany({ where: { teamId }, include: { source: true, _count: { select: { chunks: true } } }, orderBy: { createdAt: 'desc' } });
  }

  async ingestText(teamId: string, input: { title: string; content: string; mimeType?: string; url?: string; checksum?: string }) {
    const document = await this.prisma.aiKnowledgeDocument.create({ data: { teamId, title: input.title, mimeType: input.mimeType ?? 'text/plain', url: input.url, checksum: input.checksum, status: AiDocumentStatus.PROCESSING } });
    try {
      const chunks = await this.createChunks(teamId, document.id, input.content);
      await this.vector.index(teamId, chunks.map((chunk) => ({ id: chunk.id, content: chunk.content })));
      const ready = await this.prisma.aiKnowledgeDocument.update({ where: { id: document.id }, data: { status: AiDocumentStatus.READY } });
      this.realtime.emitTeam(teamId, SOCKET_EVENTS.AI_KNOWLEDGE_INDEXED, ready);
      return ready;
    } catch (error) {
      await this.prisma.aiKnowledgeDocument.update({ where: { id: document.id }, data: { status: AiDocumentStatus.FAILED, error: error instanceof Error ? error.message : 'Indexing failed' } });
      throw error;
    }
  }

  async ingestUpload(teamId: string, file: { buffer: Buffer; originalname: string; mimetype: string; size: number }) {
    const extracted = await this.extractor.fromUpload(file);
    return this.ingestText(teamId, extracted);
  }

  async crawl(teamId: string, url: string) {
    const extracted = await this.extractor.fromWebsite(url);
    return this.ingestText(teamId, { ...extracted, url });
  }

  search(teamId: string, query: string) {
    return this.vector.search(teamId, query);
  }

  private createChunks(teamId: string, documentId: string, content: string) {
    const words = content.replace(/\s+/g, ' ').trim().split(' ');
    const chunks: Array<{ teamId: string; documentId: string; content: string; tokenCount: number; position: number }> = [];
    for (let i = 0; i < words.length; i += 350) {
      const part = words.slice(i, i + 450).join(' ').trim();
      if (part) chunks.push({ teamId, documentId, content: part, tokenCount: part.split(' ').length, position: chunks.length });
    }
    return this.prisma.aiKnowledgeChunk.createManyAndReturn({ data: chunks });
  }
}
