import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { BillingModule } from '../billing/billing.module';
import { ChannelsModule } from '../channels/channels.module';
import { SecurityModule } from '../security/security.module';
import { StorageModule } from '../storage/storage.module';
import { WhatsAppModule } from '../modules/whatsapp/whatsapp.module';
import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';
import { IntegrationsHubController } from './integrations-hub.controller';
import { IntegrationsHubService } from './integrations-hub.service';
import { MetaApiClient } from './meta/meta-api.client';
import { InstagramApiClient } from './meta/instagram-api.client';
import { MetaController, MetaOAuthCallbackController, MetaWebhookController } from './meta/meta.controller';
import { MetaMediaService } from './meta/meta-media.service';
import { MetaOAuthService } from './meta/meta-oauth.service';
import { MetaService } from './meta/meta.service';
import { MetaCommentPollService } from './meta/meta-comment-poll.service';
import { MetaWebhookLogService } from './meta/meta-webhook-log.service';
import { TikTokLoginKitModule } from './tiktok-login-kit/tiktok-login-kit.module';
import { PlatformModule } from '../platform/platform.module';

@Module({
  imports: [
    ChannelsModule,
    AuthModule,
    AuditModule,
    SecurityModule,
    StorageModule,
    WhatsAppModule,
    TikTokLoginKitModule,
    BillingModule,
    PlatformModule,
  ],
  controllers: [
    MetaController,
    MetaOAuthCallbackController,
    MetaWebhookController,
    ConnectionsController,
    IntegrationsHubController,
  ],
  providers: [
    MetaService,
    MetaCommentPollService,
    MetaOAuthService,
    MetaWebhookLogService,
    MetaMediaService,
    MetaApiClient,
    InstagramApiClient,
    ConnectionsService,
    IntegrationsHubService,
  ],
  exports: [MetaService, ConnectionsService, IntegrationsHubService],
})
export class IntegrationsModule {}
