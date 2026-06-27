import { Module } from '@nestjs/common';
import { ChannelsModule } from './channels.module';
import { StorageModule } from '../storage/storage.module';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { OutboundChannelService } from './outbound-channel.service';

@Module({
  imports: [ChannelsModule, StorageModule, WhatsAppModule],
  providers: [OutboundChannelService],
  exports: [OutboundChannelService],
})
export class OutboundModule {}
