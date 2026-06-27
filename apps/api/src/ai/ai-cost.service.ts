import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AiCostService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: { teamId: string; provider: string; model: string; operation: string; promptTokens?: number; completionTokens?: number; cacheHit?: boolean }) {
    const promptTokens = input.promptTokens ?? 0;
    const completionTokens = input.completionTokens ?? 0;
    const costCents = Math.ceil((promptTokens + completionTokens * 4) / 1000);
    return this.prisma.aiCostEvent.create({ data: { teamId: input.teamId, provider: input.provider, model: input.model, operation: input.operation, promptTokens, completionTokens, costCents, cacheHit: input.cacheHit ?? false } });
  }

  summary(teamId: string) {
    return this.prisma.aiCostEvent.groupBy({ by: ['operation'], where: { teamId }, _sum: { costCents: true, promptTokens: true, completionTokens: true }, _count: { _all: true } });
  }
}
