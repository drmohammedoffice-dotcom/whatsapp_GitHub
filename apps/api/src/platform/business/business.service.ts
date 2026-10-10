import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@watsapp/database';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BusinessService {
  constructor(private readonly prisma: PrismaService) {}

  list(teamId: string) {
    return this.prisma.business.findMany({ where: { teamId }, orderBy: { name: 'asc' } });
  }

  create(teamId: string, input: { name: string; slug: string; industry?: string; timezone?: string }) {
    return this.prisma.business.create({
      data: { teamId, name: input.name, slug: input.slug, industry: input.industry, timezone: input.timezone ?? 'UTC' },
    });
  }

  async update(teamId: string, id: string, input: Partial<{ name: string; industry: string; timezone: string; metadata: Prisma.InputJsonValue }>) {
    const row = await this.prisma.business.findFirst({ where: { id, teamId } });
    if (!row) throw new NotFoundException('Business not found');
    return this.prisma.business.update({ where: { id }, data: input });
  }
}
