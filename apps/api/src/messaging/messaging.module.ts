import { Module } from '@nestjs/common';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { ChannelsModule } from '../channels/channels.module';
import { StorageModule } from '../storage/storage.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { MessagingController } from './messaging.controller';
import { MessagingService } from './messaging.service';

@Module({
  imports: [ApiKeysModule, ChannelsModule, WhatsAppModule, StorageModule],
  controllers: [MessagingController],
  providers: [MessagingService],
})
export class MessagingModule {}
