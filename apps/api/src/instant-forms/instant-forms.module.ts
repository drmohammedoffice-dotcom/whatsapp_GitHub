import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { StorageModule } from '../storage/storage.module';
import { TikTokIntegrationModule } from '../tiktok-integration/tiktok-integration.module';
import { InstantFormsController } from './instant-forms.controller';
import { InstantFormsPublicController } from './instant-forms-public.controller';
import { InstantFormsService } from './instant-forms.service';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => BillingModule),
    StorageModule,
    forwardRef(() => TikTokIntegrationModule),
  ],
  controllers: [InstantFormsPublicController, InstantFormsController],
  providers: [InstantFormsService],
  exports: [InstantFormsService],
})
export class InstantFormsModule {}
