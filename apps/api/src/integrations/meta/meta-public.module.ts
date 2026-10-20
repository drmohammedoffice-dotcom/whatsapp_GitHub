import { Module } from '@nestjs/common';

import { JwtModule } from '@nestjs/jwt';

import { AuditModule } from '../../audit/audit.module';

import { AuthModule } from '../../auth/auth.module';

import { BillingModule } from '../../billing/billing.module';

import { ChannelsModule } from '../../channels/channels.module';

import { SecurityModule } from '../../security/security.module';

import { StorageModule } from '../../storage/storage.module';

import { MetaApiClient } from './meta-api.client';
import { InstagramApiClient } from './instagram-api.client';

import { MetaMediaService } from './meta-media.service';

import { MetaOAuthService } from './meta-oauth.service';

import { MetaPublicController } from './meta-public.controller';

import { MetaWebhookLogService } from './meta-webhook-log.service';

import { MetaService } from './meta.service';



/**

 * Standalone Meta webhook + OAuth module for production routes:

 * - GET/POST /api/webhooks/meta

 * - POST /api/auth/meta/login

 * - GET /api/auth/meta/callback

 *

 * Registered separately so VPS deployments can enable Meta without upgrading the full IntegrationsModule.

 */

@Module({

  imports: [ChannelsModule, AuthModule, AuditModule, SecurityModule, StorageModule, BillingModule, JwtModule.register({})],

  controllers: [MetaPublicController],

  providers: [MetaService, MetaOAuthService, MetaWebhookLogService, MetaMediaService, MetaApiClient, InstagramApiClient],

  exports: [MetaService, MetaOAuthService],

})

export class MetaPublicModule {}

