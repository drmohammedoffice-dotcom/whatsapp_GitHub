import { Injectable } from '@nestjs/common';
import { TikTokLogLevel } from '@watsapp/database';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TikTokLogService {
  constructor(private readonly prisma: PrismaService) {}

  info(teamId: string, action: string, message?: string, metadata?: object) {
    return this.write(teamId, TikTokLogLevel.INFO, action, message, metadata);
  }

  warn(teamId: string, action: string, message?: string, metadata?: object) {
    return this.write(teamId, TikTokLogLevel.WARN, action, message, metadata);
  }

  error(teamId: string, action: string, message?: string, metadata?: object) {
    return this.write(teamId, TikTokLogLevel.ERROR, action, message, metadata);
  }

  list(teamId: string, limit = 100) {
    return this.prisma.tikTokLog.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private async write(teamId: string, level: TikTokLogLevel, action: string, message?: string, metadata?: object) {
    const account = await this.prisma.tikTokAccount.findUnique({ where: { teamId }, select: { id: true } });
    return this.prisma.tikTokLog.create({
      data: {
        teamId,
        accountId: account?.id,
        level,
        action,
        message,
        metadata: metadata ?? undefined,
      },
    });
  }
}
