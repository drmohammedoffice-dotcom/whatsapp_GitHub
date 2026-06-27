import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module';
import { ChannelsModule } from '../../channels/channels.module';
import { SecurityModule } from '../../security/security.module';
import { StorageModule } from '../../storage/storage.module';
import { WebhooksModule } from '../../webhooks/webhooks.module';
import { BaileysCredentialStore } from './baileys-credential.store';
import { BaileysProvider } from './baileys.provider';
import { WhatsAppEventsService } from './events.service';
import { QrGateway } from './qr.gateway';
import { SessionManager } from './session.manager';
import { WhatsAppWebhookService } from './webhook.service';
import { WhatsAppController, WhatsAppSessionsController } from './whatsapp.controller';
import { WhatsAppRepository } from './whatsapp.repository';
import { WhatsAppService } from './whatsapp.service';

@Module({
  imports: [ChannelsModule, SecurityModule, WebhooksModule, AuditModule, StorageModule],
  controllers: [WhatsAppController, WhatsAppSessionsController],
  providers: [
    WhatsAppService,
    WhatsAppRepository,
    BaileysCredentialStore,
    BaileysProvider,
    SessionManager,
    QrGateway,
    WhatsAppEventsService,
    WhatsAppWebhookService,
  ],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
