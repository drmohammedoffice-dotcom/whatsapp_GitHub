import { Module } from '@nestjs/common';
import { TikTokModule } from '../tiktok/tiktok.module';
import { SecurityModule } from '../security/security.module';
import { PrismaModule } from '../prisma/prisma.module';
import { BillingModule } from '../billing/billing.module';
import { BusinessController } from './business/business.controller';
import { BusinessService } from './business/business.service';
import { CampaignController } from './campaigns/campaign.controller';
import { CampaignGoController } from './campaigns/campaign-go.controller';
import { CampaignRedirectService } from './campaigns/campaign-redirect.service';
import { CampaignService } from './campaigns/campaign.service';
import { PlatformAdminController } from './platform-admin.controller';
import { WhatsAppRoutingController } from './routing/whatsapp-routing.controller';
import { WhatsAppRoutingService } from './routing/whatsapp-routing.service';
import { TikTokWebhookController } from './webhooks/tiktok-webhook.controller';
import { WebhookEventService } from './webhooks/webhook-event.service';
import { WhatsAppCloudController } from './whatsapp-cloud/whatsapp-cloud.controller';
import { WhatsAppCloudPublicController } from './whatsapp-cloud/whatsapp-cloud-public.controller';
import { WhatsAppCloudService } from './whatsapp-cloud/whatsapp-cloud.service';

@Module({
  imports: [TikTokModule, SecurityModule, PrismaModule, BillingModule],
  controllers: [
    BusinessController,
    CampaignController,
    CampaignGoController,
    WhatsAppCloudController,
    WhatsAppCloudPublicController,
    WhatsAppRoutingController,
    TikTokWebhookController,
    PlatformAdminController,
  ],
  providers: [
    BusinessService,
    CampaignService,
    CampaignRedirectService,
    WhatsAppCloudService,
    WhatsAppRoutingService,
    WebhookEventService,
  ],
  exports: [
    CampaignService,
    CampaignRedirectService,
    WhatsAppCloudService,
    WhatsAppRoutingService,
    WebhookEventService,
  ],
})
export class PlatformModule {}
