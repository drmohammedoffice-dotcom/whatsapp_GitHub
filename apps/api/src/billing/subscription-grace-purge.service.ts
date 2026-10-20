import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { GRACE_PERIOD_MS } from './plan-limits';

/**
 * After subscription expiry, integrations stay suspended via `billingSuspended`
 * (set by SubscriptionExpiryService). We no longer delete pixels, tracking
 * WhatsApp sessions, clicks, or conversions — links/landing simply stay offline
 * until the plan is reactivated.
 */
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
        // Mark grace ended only — keep pixels, tracking links, WA sessions,
        // clicks and conversions. Public /r stays blocked by billingSuspended.
        await this.prisma.subscription.update({
          where: { id: sub.id },
          data: { gracePurgedAt: new Date() },
        });
        this.logger.log(
          `Grace retention (no delete) team=${sub.teamId} — pixels/links kept; landing stays suspended until renew`,
        );
      } catch (error) {
        this.logger.error(`Grace retention check failed team=${sub.teamId}: ${String(error)}`);
      }
    }
  }

  /**
   * Formerly deleted TRACKING WhatsApp sessions + all TikTok integrations.
   * Kept as a no-op for any callers; data survives non-renewal.
   */
  async purgeTeamResources(_teamId: string) {
    return;
  }
}
