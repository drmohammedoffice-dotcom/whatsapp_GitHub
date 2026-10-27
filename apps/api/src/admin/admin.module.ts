import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module';
import { LandingModule } from '../landing/landing.module';
import { SecurityModule } from '../security/security.module';
import { AdminAuthController } from './controllers/admin-auth.controller';
import { AdminOperationsController } from './controllers/admin-operations.controller';
import { AdminPlatformController } from './controllers/admin-platform.controller';
import { AdminStaffController } from './controllers/admin-staff.controller';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { AdminRolesGuard } from './guards/admin-roles.guard';
import { AdminAnalyticsService } from './services/admin-analytics.service';
import { AdminAuditService } from './services/admin-audit.service';
import { AdminAuthService } from './services/admin-auth.service';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminIntegrationsService } from './services/admin-integrations.service';
import { AdminNotificationsService } from './services/admin-notifications.service';
import { AdminOffersService } from './services/admin-offers.service';
import { AdminLandingService } from './services/admin-landing.service';
import { AdminSettingsService } from './services/admin-settings.service';
import { AdminStaffService } from './services/admin-staff.service';
import { AdminSubscriptionsService } from './services/admin-subscriptions.service';
import { AdminSupportService } from './services/admin-support.service';
import { AdminUsersService } from './services/admin-users.service';
import { AdminWorkspacesService } from './services/admin-workspaces.service';
import { OfficialWhatsAppModule } from '../official-whatsapp/official-whatsapp.module';
import { OfficialWhatsAppAdminController } from '../official-whatsapp/official-whatsapp.admin.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    SecurityModule,
    BillingModule,
    LandingModule,
    OfficialWhatsAppModule,
    StorageModule,
  ],
  controllers: [
    AdminAuthController,
    AdminPlatformController,
    AdminOperationsController,
    AdminStaffController,
    OfficialWhatsAppAdminController,
  ],
  providers: [
    AdminAuthService,
    AdminStaffService,
    AdminUsersService,
    AdminDashboardService,
    AdminSubscriptionsService,
    AdminWorkspacesService,
    AdminIntegrationsService,
    AdminSupportService,
    AdminNotificationsService,
    AdminSettingsService,
    AdminAnalyticsService,
    AdminOffersService,
    AdminLandingService,
    AdminAuditService,
    AdminJwtGuard,
    AdminRolesGuard,
  ],
})
export class AdminModule {}
