import { Module, forwardRef } from '@nestjs/common';
import { QueuesModule } from '../queues/queues.module';
import { SecurityModule } from '../security/security.module';
import { TikTokModule } from '../tiktok/tiktok.module';
import { TikTokIntegrationModule } from '../tiktok-integration/tiktok-integration.module';
import { ChannelMessageService } from './channel-message.service';
import { ChannelSecretsService } from './channel-secrets.service';
import { ChannelTokenService } from './channel-token.service';
import { ChannelsController } from './channels.controller';
import { ChannelsService } from './channels.service';

@Module({
  imports: [QueuesModule, SecurityModule, forwardRef(() => TikTokModule), forwardRef(() => TikTokIntegrationModule)],
  controllers: [ChannelsController],
  providers: [ChannelsService, ChannelMessageService, ChannelSecretsService, ChannelTokenService],
  exports: [ChannelsService, ChannelMessageService, ChannelSecretsService, ChannelTokenService],
})
export class ChannelsModule {}
