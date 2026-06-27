import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@watsapp/database';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../security/encryption.service';
import { ExecuteToolDto, ToolDto } from './dto/ai.dto';

@Injectable()
export class AiToolsService {
  constructor(private readonly prisma: PrismaService, private readonly encryption: EncryptionService) {}

  list(teamId: string) {
    return this.prisma.aiTool.findMany({ where: { teamId }, select: { id: true, name: true, description: true, kind: true, schema: true, enabled: true, createdAt: true } });
  }

  create(teamId: string, dto: ToolDto) {
    const schema = dto.schema as Prisma.InputJsonValue;
    return this.prisma.aiTool.upsert({ where: { teamId_name: { teamId, name: dto.name } }, update: { description: dto.description, kind: dto.kind, schema, config: this.encryption.encryptJson(dto.config), enabled: true }, create: { teamId, name: dto.name, description: dto.description, kind: dto.kind, schema, config: this.encryption.encryptJson(dto.config) }, select: { id: true, name: true, description: true, kind: true, enabled: true } });
  }

  async execute(teamId: string, id: string, dto: ExecuteToolDto) {
    const tool = await this.prisma.aiTool.findFirst({ where: { id, teamId, enabled: true } });
    if (!tool) throw new NotFoundException('AI tool not found');
    const config = this.encryption.decryptJson<{ method?: string; url?: string; headers?: Record<string, string> }>(tool.config);
    if (!config.url) throw new BadRequestException('Tool config must include a URL');
    const response = await axios.request({ method: config.method ?? 'POST', url: config.url, headers: config.headers, data: dto.arguments, timeout: 20_000 });
    return { status: response.status, data: response.data };
  }
}
