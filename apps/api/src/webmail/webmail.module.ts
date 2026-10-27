import { Module, forwardRef } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { SalesPartnersModule } from '../sales-partners/sales-partners.module';
import { SecurityModule } from '../security/security.module';
import { AdminJwtGuard } from '../admin/guards/admin-jwt.guard';
import { AdminRolesGuard } from '../admin/guards/admin-roles.guard';
import { AdminWebmailController } from './admin-webmail.controller';
import { WebmailAuthGuard } from './webmail-auth.guard';
import { WebmailController } from './webmail.controller';
import { WebmailInboundController } from './webmail-inbound.controller';
import { WebmailResendService } from './webmail-resend.service';
import { WebmailService } from './webmail.service';

@Module({
  imports: [SecurityModule, forwardRef(() => BillingModule), SalesPartnersModule],
  controllers: [WebmailController, AdminWebmailController, WebmailInboundController],
  providers: [WebmailService, WebmailResendService, WebmailAuthGuard, AdminJwtGuard, AdminRolesGuard],
  exports: [WebmailService, WebmailResendService],
})
export class WebmailModule {}
