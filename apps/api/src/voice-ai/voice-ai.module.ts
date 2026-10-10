import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AssistantModule } from '../assistant/assistant.module';
import { BillingModule } from '../billing/billing.module';
import { VoiceAiCallService } from './voice-ai-call.service';
import { VoiceAiCoreService } from './voice-ai-core.service';
import { VoiceAiSettingsService } from './voice-ai-settings.service';
import { VoiceAiTenantController } from './voice-ai-tenant.controller';
import { VoiceAiWebhookController } from './voice-ai-webhook.controller';

@Module({
  imports: [AiModule, AssistantModule, BillingModule],
  controllers: [VoiceAiWebhookController, VoiceAiTenantController],
  providers: [VoiceAiSettingsService, VoiceAiCoreService, VoiceAiCallService],
  exports: [VoiceAiSettingsService, VoiceAiCoreService, VoiceAiCallService],
})
export class VoiceAiModule {}
