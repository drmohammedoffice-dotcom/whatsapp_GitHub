import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  log(input: { teamId: string; actorUserId?: string; action: string; resource: string; resourceId?: string; metadata?: object; ipAddress?: string; userAgent?: string }) {
    return this.prisma.auditLog.create({ data: input });
  }
}
