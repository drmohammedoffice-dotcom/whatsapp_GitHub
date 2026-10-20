import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { BillingService } from './billing.service';

@Injectable()
export class SubscriptionRenewalService {
  private readonly logger = new Logger(SubscriptionRenewalService.name);

  constructor(private readonly billing: BillingService) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async createRenewalInvoices() {
    const result = await this.billing.startDueRenewals();
    if (result.created > 0) {
      this.logger.log(`Created ${result.created} Wayl renewal checkout(s)`);
    }
  }
}
