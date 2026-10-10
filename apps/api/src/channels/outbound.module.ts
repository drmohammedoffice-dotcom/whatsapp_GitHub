import { Module, forwardRef } from '@nestjs/common';
import { ChannelsModule } from './channels.module';
import { StorageModule } from '../storage/storage.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { SecurityModule } from '../security/security.module';
import { IntegrationsModule } from '../integrations/integrations.module';
import { OutboundChannelService } from './outbound-channel.service';

@Module({
  imports: [ChannelsModule, StorageModule, SecurityModule, WhatsAppModule, forwardRef(() => IntegrationsModule)],
  providers: [OutboundChannelService],
  exports: [OutboundChannelService],
})
export class OutboundModule {}
