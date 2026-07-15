import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { ChannelsModule } from '../channels/channels.module';
import { TikTokLoginKitModule } from '../integrations/tiktok-login-kit/tiktok-login-kit.module';
import { WhatsAppModule } from '../modules/whatsapp/whatsapp.module';
import { QUEUES } from '../queues/queues.constants';
import { TikTokIntegrationController } from './tiktok-integration.controller';
import { TikTokIntegrationPublicController } from './tiktok-integration-public.controller';
import { TikTokIntegrationService } from './tiktok-integration.service';
import { TikTokIntegrationTrackingService } from './tiktok-integration-tracking.service';
import { TikTokIntegrationActivationService } from './tiktok-integration-activation.service';
import { TikTokIntegrationPixelStatusService } from './tiktok-integration-pixel-status.service';
import { TikTokTrackingPhonesService } from './tiktok-tracking-phones.service';
import { TikTokContactProcessor } from './tiktok-contact.processor';
import { TikTokEventsApiCredentialsService } from './tiktok-events-api-credentials.service';
import { TikTokLifecycleEventsService } from './tiktok-lifecycle-events.service';
import { SecurityModule } from '../security/security.module';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    SecurityModule,
    forwardRef(() => BillingModule),
    TikTokLoginKitModule,
    forwardRef(() => ChannelsModule),
    forwardRef(() => WhatsAppModule),
    BullModule.registerQueue({ name: QUEUES.TIKTOK_CONTACT }),
  ],
  controllers: [TikTokIntegrationController, TikTokIntegrationPublicController],
  providers: [
    TikTokIntegrationService,
    TikTokIntegrationTrackingService,
    TikTokIntegrationActivationService,
    TikTokIntegrationPixelStatusService,
    TikTokTrackingPhonesService,
    TikTokEventsApiCredentialsService,
    TikTokLifecycleEventsService,
    TikTokContactProcessor,
  ],
  exports: [
    TikTokIntegrationService,
    TikTokIntegrationTrackingService,
    TikTokLifecycleEventsService,
    TikTokEventsApiCredentialsService,
  ],
})
export class TikTokIntegrationModule {}
