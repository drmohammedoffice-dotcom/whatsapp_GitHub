import { Module, forwardRef } from '@nestjs/common';
import { QueuesModule } from '../queues/queues.module';
import { SecurityModule } from '../security/security.module';
import { TikTokModule } from '../tiktok/tiktok.module';
import { ChannelMessageService } from './channel-message.service';
import { ChannelSecretsService } from './channel-secrets.service';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';

@Module({
  imports: [QueuesModule, SecurityModule, forwardRef(() => TikTokModule)],
  controllers: [ChannelsController],
  providers: [ChannelsService, ChannelMessageService, ChannelSecretsService],
  exports: [ChannelsService, ChannelMessageService, ChannelSecretsService],
})
export class ChannelsModule {}
