import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ApiKeyCryptoService } from '../security/api-key-crypto.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService, private readonly crypto: ApiKeyCryptoService) {}

  list(teamId: string) {
    return this.prisma.apiKey.findMany({
      where: { teamId, revokedAt: null },
      select: { id: true, name: true, prefix: true, scopes: true, lastUsedAt: true, expiresAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(teamId: string, dto: CreateApiKeyDto) {
    const key = this.crypto.create();
    const record = await this.prisma.apiKey.create({
      data: { teamId, name: dto.name, prefix: key.prefix, keyHash: key.hash, scopes: dto.scopes ?? ['messages:write', 'messages:read'] },
      select: { id: true, name: true, prefix: true, scopes: true, createdAt: true },
    });
    return { ...record, apiKey: key.plaintext };
  }

  async revoke(teamId: string, id: string) {
    const result = await this.prisma.apiKey.updateMany({ where: { id, teamId, revokedAt: null }, data: { revokedAt: new Date() } });
    if (!result.count) throw new NotFoundException('API key not found');
  }
}
