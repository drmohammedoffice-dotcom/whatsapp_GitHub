import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TikTokIntegrationModule } from '../tiktok-integration/tiktok-integration.module';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingAccessService } from './billing-access.service';
import { PlanEntitlementsService } from './plan-entitlements.service';
import { SubscriptionExpiryService } from './subscription-expiry.service';
import { SubscriptionGracePurgeService } from './subscription-grace-purge.service';
import { SubscriptionGuard } from './subscription.guard';

@Module({
  imports: [AuthModule, forwardRef(() => TikTokIntegrationModule)],
  controllers: [BillingController],
  providers: [
    BillingService,
    BillingAccessService,
    PlanEntitlementsService,
    SubscriptionExpiryService,
    SubscriptionGracePurgeService,
    SubscriptionGuard,
  ],
  exports: [BillingService, BillingAccessService, PlanEntitlementsService, SubscriptionGuard],
})
export class BillingModule {}

