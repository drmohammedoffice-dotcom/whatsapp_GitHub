import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SubscriptionStatus } from '@watsapp/database';
import { PrismaService } from '../prisma/prisma.service';
import { BillingAccessService } from './billing-access.service';
import { FreeTrialService } from './free-trial.service';

@Injectable()
export class SubscriptionExpiryService {
  private readonly logger = new Logger(SubscriptionExpiryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BillingAccessService,
    private readonly trials: FreeTrialService,
  ) {}

  @Cron('*/15 * * * *')
  async expireSubscriptions() {
    const now = new Date();
    await this.trials.sendDueNotices(now).catch((err) => {
      this.logger.warn(`Trial notices failed: ${err instanceof Error ? err.message : String(err)}`);
    });

    const candidates = await this.prisma.subscription.findMany({
      where: {
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] },
        OR: [
          { currentPeriodEnd: { lt: now } },
          { status: SubscriptionStatus.TRIAL, trialEndsAt: { lt: now } },
        ],
      },
      select: { id: true, teamId: true, status: true },
    });

    for (const sub of candidates) {
      const updated = await this.prisma.subscription.updateMany({
        where: { id: sub.id, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] } },
        data: { status: SubscriptionStatus.EXPIRED, expiredAt: now },
      });
      if (!updated.count) continue;
      await this.access.suspendTeamIntegrations(sub.teamId);
      if (sub.status === SubscriptionStatus.TRIAL) {
        await this.trials.notifyTrialEnded(sub.id).catch((err) => {
          this.logger.warn(`Trial ended email failed team=${sub.teamId}: ${err instanceof Error ? err.message : String(err)}`);
        });
      }
      this.logger.log(`Subscription expired team=${sub.teamId}`);
    }

    await this.trials.retryPendingPauses().catch((err) => {
      this.logger.warn(`Campaign pause retry failed: ${err instanceof Error ? err.message : String(err)}`);
    });
  }
}
