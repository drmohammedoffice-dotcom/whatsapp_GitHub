import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SecurityModule } from '../security/security.module';
import { OfficialWhatsAppModule } from '../official-whatsapp/official-whatsapp.module';
import { AuthController } from './auth.controller';
import { AuthEmailService } from './auth-email.service';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Global()
@Module({
  imports: [JwtModule.register({}), SecurityModule, OfficialWhatsAppModule],
  controllers: [AuthController],
  providers: [AuthService, AuthEmailService, EmailVerificationService, JwtAuthGuard],
  exports: [JwtModule, JwtAuthGuard, AuthService],
})
export class AuthModule {}
