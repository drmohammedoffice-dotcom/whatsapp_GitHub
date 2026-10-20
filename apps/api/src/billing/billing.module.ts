import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SalesPartnersModule } from '../sales-partners/sales-partners.module';
import { OfficialWhatsAppModule } from '../official-whatsapp/official-whatsapp.module';
import { BillingController } from './billing.controller';
import { BillingWebhooksController } from './billing-webhooks.controller';
import { BillingService } from './billing.service';
import { BillingAccessService } from './billing-access.service';
import { PlanEntitlementsService } from './plan-entitlements.service';
import { SubscriptionExpiryService } from './subscription-expiry.service';
import { SubscriptionGracePurgeService } from './subscription-grace-purge.service';
import { SubscriptionActivationService } from './subscription-activation.service';
import { SubscriptionGuard } from './subscription.guard';
import { SubscriptionRenewalService } from './subscription-renewal.service';
import { WaylService } from './wayl.service';
import { BillingEmailService } from './billing-email.service';
import { FreeTrialService } from './free-trial.service';

@Module({
  imports: [AuthModule, SalesPartnersModule, OfficialWhatsAppModule],
  controllers: [BillingController, BillingWebhooksController],
  providers: [
    BillingService,
    BillingAccessService,
    PlanEntitlementsService,
    SubscriptionExpiryService,
    SubscriptionGracePurgeService,
    SubscriptionActivationService,
    SubscriptionRenewalService,
    SubscriptionGuard,
    WaylService,
    BillingEmailService,
    FreeTrialService,
  ],
  exports: [
    BillingService,
    BillingAccessService,
    PlanEntitlementsService,
    SubscriptionActivationService,
    SubscriptionGuard,
    WaylService,
    BillingEmailService,
    FreeTrialService,
  ],
})
export class BillingModule {}
