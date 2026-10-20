import { Module, forwardRef } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { StorageModule } from '../storage/storage.module';
import { TikTokIntegrationModule } from '../tiktok-integration/tiktok-integration.module';
import { InstantFormAiService } from './instant-form-ai.service';
import { InstantFormsController } from './instant-forms.controller';
import { InstantFormsPublicController } from './instant-forms-public.controller';
import { InstantFormsService } from './instant-forms.service';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => BillingModule),
    forwardRef(() => AiModule),
    StorageModule,
    forwardRef(() => TikTokIntegrationModule),
  ],
  controllers: [InstantFormsPublicController, InstantFormsController],
  providers: [InstantFormsService, InstantFormAiService],
  exports: [InstantFormsService],
})
export class InstantFormsModule {}
