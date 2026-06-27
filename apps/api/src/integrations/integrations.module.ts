import { Module } from '@nestjs/common';
import { ChannelsModule } from '../channels/channels.module';
import { MetaController, MetaWebhookController } from './meta/meta.controller';
import { MetaService } from './meta/meta.service';
import { TelegramController, TelegramWebhookController } from './telegram/telegram.controller';
import { TelegramService } from './telegram/telegram.service';

@Module({
  imports: [ChannelsModule],
  controllers: [MetaController, MetaWebhookController, TelegramController, TelegramWebhookController],
  providers: [MetaService, TelegramService],
})
export class IntegrationsModule {}
