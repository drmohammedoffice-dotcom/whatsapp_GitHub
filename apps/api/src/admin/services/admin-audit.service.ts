import { Injectable } from '@nestjs/common';
import { Prisma } from '@watsapp/database';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(input: {
    adminUserId?: string | null;
    action: string;
    resource: string;
    resourceId?: string | null;
    metadata?: Prisma.InputJsonValue;
    ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    return this.prisma.platformAuditLog.create({
      data: {
        adminUserId: input.adminUserId ?? null,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        metadata: input.metadata ?? undefined,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  }

  list(params: { skip?: number; take?: number; action?: string }) {
    const where = params.action ? { action: { contains: params.action } } : {};
    return this.prisma.platformAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: params.skip ?? 0,
      take: Math.min(params.take ?? 50, 200),
      include: { adminUser: { include: { user: { select: { email: true, name: true } } } } },
    });
  }
}
