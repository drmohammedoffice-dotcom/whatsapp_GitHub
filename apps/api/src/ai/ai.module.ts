import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ChannelsModule } from '../channels/channels.module';
import { OutboundModule } from '../channels/outbound.module';
import { BookingsModule } from '../bookings/bookings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QueuesModule } from '../queues/queues.module';
import { SecurityModule } from '../security/security.module';
import { StorageModule } from '../storage/storage.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { AiAssistantService } from './ai-assistant.service';
import { AiCacheService } from './ai-cache.service';
import { AiController } from './ai.controller';
import { AiCostService } from './ai-cost.service';
import { AiDocumentExtractorService } from './ai-document-extractor.service';
import { AiInboundProcessor } from './ai-inbound.processor';
import { AiKnowledgeService } from './ai-knowledge.service';
import { AiMediaService } from './ai-media.service';
import { AiMemoryService } from './ai-memory.service';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { AiProviderConfigService } from './ai-provider-config.service';
import { AiProviderService } from './ai-provider.service';
import { AiSettingsService } from './ai-settings.service';
import { AiTrainingMediaService } from './ai-training-media.service';
import { AiToolsService } from './ai-tools.service';
import { AiTransferService } from './ai-transfer.service';
import { AiVectorService } from './ai-vector.service';
import { AutomationService } from './automation.service';

@Module({
  imports: [SecurityModule, QueuesModule, ChannelsModule, OutboundModule, WhatsAppModule, NotificationsModule, AuditModule, BookingsModule, StorageModule],
  controllers: [AiController],
  providers: [
    AiProviderConfigService,
    AiProviderService,
    AiCacheService,
    AiCostService,
    AiDocumentExtractorService,
    AiVectorService,
    AiKnowledgeService,
    AiMemoryService,
    AiAssistantService,
    AiToolsService,
    AiMediaService,
    AiSettingsService,
    AiTrainingMediaService,
    AiTransferService,
    AutomationService,
    AiOrchestratorService,
    AiInboundProcessor,
  ],
  exports: [AiAssistantService, AiKnowledgeService, AiMemoryService, AiSettingsService, AiTransferService, AutomationService, AiOrchestratorService],
})
export class AiModule {}
