import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingController } from './billing.controller';
import { BillingWebhooksController } from './billing-webhooks.controller';
import { BillingService } from './billing.service';
import { BillingAccessService } from './billing-access.service';
import { PlanEntitlementsService } from './plan-entitlements.service';
import { SubscriptionExpiryService } from './subscription-expiry.service';
import { SubscriptionGracePurgeService } from './subscription-grace-purge.service';
import { SubscriptionActivationService } from './subscription-activation.service';
import { SubscriptionGuard } from './subscription.guard';
import { WaylService } from './wayl.service';
import { BillingEmailService } from './billing-email.service';

@Module({
  imports: [AuthModule],
  controllers: [BillingController, BillingWebhooksController],
  providers: [
    BillingService,
    BillingAccessService,
    PlanEntitlementsService,
    SubscriptionExpiryService,
    SubscriptionGracePurgeService,
    SubscriptionActivationService,
    SubscriptionGuard,
    WaylService,
    BillingEmailService,
  ],
  exports: [
    BillingService,
    BillingAccessService,
    PlanEntitlementsService,
    SubscriptionActivationService,
    SubscriptionGuard,
    WaylService,
    BillingEmailService,
  ],
})
export class BillingModule {}
