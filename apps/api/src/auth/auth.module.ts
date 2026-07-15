import { Global, Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SecurityModule } from '../security/security.module';
import { TikTokIntegrationModule } from '../tiktok-integration/tiktok-integration.module';
import { AuthController } from './auth.controller';
import { AuthEmailService } from './auth-email.service';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Global()
@Module({
  imports: [JwtModule.register({}), SecurityModule, forwardRef(() => TikTokIntegrationModule)],
  controllers: [AuthController],
  providers: [AuthService, AuthEmailService, EmailVerificationService, JwtAuthGuard],
  exports: [JwtModule, JwtAuthGuard, AuthService],
})
export class AuthModule {}
