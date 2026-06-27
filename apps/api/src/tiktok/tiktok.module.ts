import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { SecurityModule } from '../security/security.module';
import { QUEUES } from '../queues/queues.constants';
import { TikTokApiClient } from './tiktok-api.client';
import { TikTokController, TikTokTrackingController } from './tiktok.controller';
import { TikTokEventsService } from './tiktok-events.service';
import { TikTokLogService } from './tiktok-log.service';
import { TikTokOAuthService } from './tiktok-oauth.service';
import { TikTokTokenService } from './tiktok-token.service';
import { TikTokService } from './tiktok.service';
import { TikTokSyncProcessor } from './tiktok-sync.processor';
import { TikTokSyncService } from './tiktok-sync.service';
import { TikTokTrackingService } from './tiktok-tracking.service';

@Module({
  imports: [AuthModule, AuditModule, SecurityModule, BullModule.registerQueue({ name: QUEUES.TIKTOK_SYNC })],
  controllers: [TikTokController, TikTokTrackingController],
  providers: [
    TikTokApiClient,
    TikTokLogService,
    TikTokTokenService,
    TikTokOAuthService,
    TikTokSyncService,
    TikTokEventsService,
    TikTokTrackingService,
    TikTokService,
    TikTokSyncProcessor,
  ],
  exports: [TikTokEventsService, TikTokService],
})
export class TikTokModule {}
