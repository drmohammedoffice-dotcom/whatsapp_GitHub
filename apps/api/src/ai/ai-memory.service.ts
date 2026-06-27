import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../security/encryption.service';
import { MemoryDto } from './dto/ai.dto';

@Injectable()
export class AiMemoryService {
  constructor(private readonly prisma: PrismaService, private readonly encryption: EncryptionService) {}

  list(teamId: string, scope?: string) {
    return this.prisma.aiMemory.findMany({ where: { teamId, ...(scope ? { scope: scope as never } : {}) }, orderBy: { updatedAt: 'desc' }, take: 100 }).then((items) => items.map((item) => ({ ...item, value: this.encryption.decryptJson<string>(item.value) })));
  }

  async upsert(teamId: string, userId: string | undefined, dto: MemoryDto) {
    return this.prisma.aiMemory.create({ data: { teamId, userId, scope: dto.scope, key: dto.key, value: this.encryption.encryptJson(dto.value), contactId: dto.contactId, conversationId: dto.conversationId } });
  }

  async context(teamId: string, input: { conversationId?: string; contactId?: string }) {
    const memories = await this.prisma.aiMemory.findMany({ where: { teamId, OR: [{ scope: 'BUSINESS' }, { scope: 'LONG_TERM' }, ...(input.contactId ? [{ contactId: input.contactId }] : []), ...(input.conversationId ? [{ conversationId: input.conversationId }] : [])] }, take: 20, orderBy: { updatedAt: 'desc' } });
    return memories.map((memory) => `${memory.scope}:${memory.key}=${this.encryption.decryptJson<string>(memory.value)}`).join('\n');
  }
}
