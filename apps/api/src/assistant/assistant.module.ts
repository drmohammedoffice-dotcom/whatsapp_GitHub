import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { BillingModule } from '../billing/billing.module';
import { StorageModule } from '../storage/storage.module';
import { AssistantChatService } from './assistant-chat.service';
import { AssistantContextService } from './assistant-context.service';
import { AssistantKnowledgeService } from './assistant-knowledge.service';
import { AssistantRealtimeService } from './assistant-realtime.service';
import { AssistantSettingsService } from './assistant-settings.service';
import { AssistantController } from './assistant.controller';

@Module({
  imports: [AiModule, BillingModule, StorageModule],
  controllers: [AssistantController],
  providers: [
    AssistantSettingsService,
    AssistantKnowledgeService,
    AssistantContextService,
    AssistantChatService,
    AssistantRealtimeService,
  ],
  exports: [
    AssistantSettingsService,
    AssistantKnowledgeService,
    AssistantChatService,
    AssistantContextService,
    AssistantRealtimeService,
  ],
})
export class AssistantModule {}
