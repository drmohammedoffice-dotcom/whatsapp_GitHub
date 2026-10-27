import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { AssistantModule } from '../assistant/assistant.module';
import { BillingModule } from '../billing/billing.module';
import { LandingModule } from '../landing/landing.module';
import { SalesPartnersModule } from '../sales-partners/sales-partners.module';
import { SecurityModule } from '../security/security.module';
import { VoiceAiModule } from '../voice-ai/voice-ai.module';
import { CreativeStudioCoreModule } from '../creative-studio/creative-studio.core.module';
import { AdminAuthController } from './controllers/admin-auth.controller';
import { AdminOperationsController } from './controllers/admin-operations.controller';
import { AdminPlatformController } from './controllers/admin-platform.controller';
import { AdminCreativeController } from './controllers/admin-creative.controller';
import { AdminStaffController } from './controllers/admin-staff.controller';
import { AdminJwtGuard } from './guards/admin-jwt.guard';
import { AdminRolesGuard } from './guards/admin-roles.guard';
import { AdminCreativeService } from './services/admin-creative.service';
import { AdminAiGatewayService } from './services/admin-ai-gateway.service';
import { AdminAnalyticsService } from './services/admin-analytics.service';
import { AdminAuditService } from './services/admin-audit.service';
import { AdminAuthService } from './services/admin-auth.service';
import { AdminDashboardService } from './services/admin-dashboard.service';
import { AdminIntegrationsService } from './services/admin-integrations.service';
import { AdminNotificationsService } from './services/admin-notifications.service';
import { AdminOffersService } from './services/admin-offers.service';
import { AdminLandingService } from './services/admin-landing.service';
import { AdminAssistantService } from './services/admin-assistant.service';
import { AdminVoiceService } from './services/admin-voice.service';
import { AdminSettingsService } from './services/admin-settings.service';
import { AdminStaffService } from './services/admin-staff.service';
import { AdminSubscriptionsService } from './services/admin-subscriptions.service';
import { AdminSupportService } from './services/admin-support.service';
import { AdminUsersService } from './services/admin-users.service';
import { AdminWorkspacesService } from './services/admin-workspaces.service';
import { AdminSalesPartnersController } from '../sales-partners/admin-sales-partners.controller';
import { OfficialWhatsAppModule } from '../official-whatsapp/official-whatsapp.module';
import { OfficialWhatsAppAdminController } from '../official-whatsapp/official-whatsapp.admin.controller';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [
    SecurityModule,
    BillingModule,
    AiModule,
    AssistantModule,
    LandingModule,
    SalesPartnersModule,
    VoiceAiModule,
    CreativeStudioCoreModule,
    OfficialWhatsAppModule,
    StorageModule,
  ],
  controllers: [
    AdminAuthController,
    AdminPlatformController,
    AdminOperationsController,
    AdminStaffController,
    AdminSalesPartnersController,
    AdminCreativeController,
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
    AdminAssistantService,
    AdminVoiceService,
    AdminAuditService,
    AdminAiGatewayService,
    AdminCreativeService,
    AdminJwtGuard,
    AdminRolesGuard,
  ],
})
export class AdminModule {}
