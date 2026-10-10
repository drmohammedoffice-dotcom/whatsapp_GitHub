import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module';
import { BillingModule } from '../../billing/billing.module';
import { ChannelsModule } from '../../channels/channels.module';
import { SecurityModule } from '../../security/security.module';
import { StorageModule } from '../../storage/storage.module';
import { TelegramClientManager } from './telegram-client.manager';
import { TelegramUserController } from './telegram-user.controller';
import { TelegramUserAuthService } from './telegram-user-auth.service';
import { TelegramUserEventsService } from './telegram-user-events.service';
import { TelegramUserService } from './telegram-user.service';
import { TelegramUserSyncService } from './telegram-user-sync.service';

@Module({
  imports: [ChannelsModule, SecurityModule, StorageModule, AuditModule, BillingModule],
  controllers: [TelegramUserController],
  providers: [
    TelegramClientManager,
    TelegramUserAuthService,
    TelegramUserEventsService,
    TelegramUserSyncService,
    TelegramUserService,
  ],
  exports: [TelegramUserService],
})
export class TelegramUserModule {}
