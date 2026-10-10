import { Module, forwardRef } from '@nestjs/common';
import { AiModule } from '../../ai/ai.module';
import { JwtModule } from '@nestjs/jwt';
import { BillingModule } from '../../billing/billing.module';
import { SecurityModule } from '../../security/security.module';
import { TikTokLoginApiClient } from './tiktok-login-kit-api.client';
import {
  TikTokLoginKitController,
  TikTokLoginKitStatusController,
} from './tiktok-login-kit.controller';
import { TikTokAdsService } from './tiktok-ads.service';
import { TikTokAdPublishService } from './tiktok-ad-publish.service';
import { TikTokBusinessController } from './tiktok-business.controller';
import {
  TikTokBusinessPublicController,
  TikTokMarketingOAuthGetLoginController,
} from './tiktok-business-public.controller';
import { TikTokBusinessService } from './tiktok-business.service';
import { TikTokLoginService } from './tiktok-login.service';
import { TikTokMarketingOAuthController } from './tiktok-marketing-oauth.controller';
import { TikTokMarketingOAuthService } from './tiktok-marketing-oauth.service';

@Module({
  imports: [JwtModule.register({}), SecurityModule, BillingModule, forwardRef(() => AiModule)],
  controllers: [
    TikTokLoginKitController,
    TikTokLoginKitStatusController,
    TikTokBusinessController,
    TikTokBusinessPublicController,
    TikTokMarketingOAuthController,
    TikTokMarketingOAuthGetLoginController,
  ],
  providers: [
    TikTokLoginApiClient,
    TikTokLoginService,
    TikTokAdsService,
    TikTokAdPublishService,
    TikTokBusinessService,
    TikTokMarketingOAuthService,
  ],
  exports: [
    TikTokLoginService,
    TikTokAdsService,
    TikTokBusinessService,
    TikTokMarketingOAuthService,
  ],
})
export class TikTokLoginKitModule {}
