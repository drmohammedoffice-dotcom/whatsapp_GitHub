import { Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module';
import { OutboundModule } from '../channels/outbound.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AiModule } from '../ai/ai.module';
import { StorageModule } from '../storage/storage.module';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';

@Module({ imports: [ChannelsModule, OutboundModule, NotificationsModule, AiModule, StorageModule], controllers: [ConversationsController], providers: [ConversationsService], exports: [ConversationsService] })
export class ConversationsModule {}