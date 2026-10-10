import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AuditModule } from '../audit/audit.module';
import { BillingModule } from '../billing/billing.module';
import { ChannelsModule } from '../channels/channels.module';
import { OutboundModule } from '../channels/outbound.module';
import { BookingsModule } from '../bookings/bookings.module';
import { ProductsModule } from '../products/products.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { QueuesModule } from '../queues/queues.module';
import { QUEUES } from '../queues/queues.constants';
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
import { AiAutoLearnService } from './ai-auto-learn.service';
import { AiSubscriptionProofService } from './ai-subscription-proof.service';
import { AiProviderConfigService } from './ai-provider-config.service';
import { AiProviderService } from './ai-provider.service';
import { AiSettingsService } from './ai-settings.service';
import { AiTrainingMediaService } from './ai-training-media.service';
import { AiToolsService } from './ai-tools.service';
import { AiTransferService } from './ai-transfer.service';
import { AiVectorService } from './ai-vector.service';
import { AutomationService } from './automation.service';
import { AI_GATEWAY_PROVIDERS } from './gateway/ai-gateway.module';
import { AiGatewayService } from './gateway/ai-gateway.service';
import { AiGatewayHealthService } from './gateway/ai-gateway-health.service';

@Module({
  imports: [
    SecurityModule,
    QueuesModule,
    BullModule.registerQueue({ name: QUEUES.AI_GATEWAY_RETRY }),
    ChannelsModule,
    OutboundModule,
    WhatsAppModule,
    NotificationsModule,
    AuditModule,
    BookingsModule,
    ProductsModule,
    AppointmentsModule,
    StorageModule,
    BillingModule,
  ],
  controllers: [AiController],
  providers: [
    AiProviderConfigService,
    ...AI_GATEWAY_PROVIDERS,
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
    AiAutoLearnService,
    AiSubscriptionProofService,
    AiOrchestratorService,
    AiInboundProcessor,
  ],
  exports: [
    AiAssistantService,
    AiKnowledgeService,
    AiMemoryService,
    AiSettingsService,
    AiTransferService,
    AutomationService,
    AiOrchestratorService,
    AiProviderService,
    AiGatewayService,
    AiGatewayHealthService,
  ],
})
export class AiModule {}

