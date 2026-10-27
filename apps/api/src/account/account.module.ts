import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WhatsAppModule } from '../modules/whatsapp/whatsapp.module';
import { SecurityModule } from '../security/security.module';
import { StorageModule } from '../storage/storage.module';
import { AccountController } from './account.controller';
import { AccountDeletionService } from './account-deletion.service';

@Module({
  imports: [AuthModule, SecurityModule, StorageModule, WhatsAppModule],
  controllers: [AccountController],
  providers: [AccountDeletionService],
})
export class AccountModule {}
