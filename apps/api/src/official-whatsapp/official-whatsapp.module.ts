import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SecurityModule } from '../security/security.module';
import { OfficialWhatsAppNotificationService } from './official-whatsapp.notifications.service';
import { OfficialWhatsAppOtpService } from './official-whatsapp.otp.service';
import { OfficialWhatsAppSenderService } from './official-whatsapp.sender.service';

@Module({
  imports: [ConfigModule, SecurityModule],
  controllers: [],
  providers: [OfficialWhatsAppSenderService, OfficialWhatsAppOtpService, OfficialWhatsAppNotificationService],
  exports: [OfficialWhatsAppSenderService, OfficialWhatsAppOtpService, OfficialWhatsAppNotificationService],
})
export class OfficialWhatsAppModule {}
