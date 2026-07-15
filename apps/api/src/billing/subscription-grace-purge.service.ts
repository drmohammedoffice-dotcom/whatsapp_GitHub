import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ChannelProvider } from '@watsapp/database';
import { isTrackingChannel } from '../channels/channel-purpose';
import { PrismaService } from '../prisma/prisma.service';
import { GRACE_PERIOD_MS } from './plan-limits';

@Injectable()
export class SubscriptionGracePurgeService {
  private readonly logger = new Logger(SubscriptionGracePurgeService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async purgeGraceExpiredTeams() {
    const cutoff = new Date(Date.now() - GRACE_PERIOD_MS);
    const candidates = await this.prisma.subscription.findMany({
      where: {
        status: 'EXPIRED',
        expiredAt: { lt: cutoff },
        gracePurgedAt: null,
      },
      select: { id: true, teamId: true },
    });

    for (const sub of candidates) {
      try {
        await this.purgeTeamResources(sub.teamId);
        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: { gracePurgedAt: new Date() },
        });
        this.logger.log(`Grace purge completed team=${sub.teamId}`);
      } catch (error) {
        this.logger.error(`Grace purge failed team=${sub.teamId}: ${String(error)}`);
      }
    }
  }

  async purgeTeamResources(teamId: string) {
    const channels = await this.prisma.channel.findMany({
      where: { teamId, provider: ChannelProvider.WHATSAPP_BAILEYS },
      select: { id: true, whatsAppSessionId: true, metadata: true },
    });

    const sessionIds = channels
      .filter((row) => isTrackingChannel(row.metadata) && row.whatsAppSessionId)
      .map((row) => row.whatsAppSessionId!);

    if (sessionIds.length > 0) {
      await this.prisma.sessionCredential.deleteMany({ where: { sessionId: { in: sessionIds } } });
      await this.prisma.channel.deleteMany({ where: { whatsAppSessionId: { in: sessionIds } } });
      await this.prisma.whatsAppSession.deleteMany({ where: { id: { in: sessionIds }, teamId } });
    }

    await this.prisma.tikTokIntegration.deleteMany({ where: { teamId } });
  }
}
