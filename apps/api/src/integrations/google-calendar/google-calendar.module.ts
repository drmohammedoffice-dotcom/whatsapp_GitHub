import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module';
import { BillingModule } from '../../billing/billing.module';
import { SecurityModule } from '../../security/security.module';
import { CalendarService } from './calendar.service';
import { GoogleCalendarApiClient } from './google-calendar-api.client';
import { GoogleCalendarOAuthService } from './google-calendar-oauth.service';
import { GoogleCalendarSyncService } from './google-calendar-sync.service';
import { GoogleCalendarTokenService } from './google-calendar-token.service';

/**
 * Shared Google Calendar providers without Outbound/Integrations deps,
 * so IntegrationsHub and Appointments can both import this safely.
 */
@Module({
  imports: [SecurityModule, AuditModule, BillingModule],
  providers: [
    GoogleCalendarApiClient,
    GoogleCalendarTokenService,
    GoogleCalendarOAuthService,
    GoogleCalendarSyncService,
    CalendarService,
  ],
  exports: [
    GoogleCalendarApiClient,
    GoogleCalendarTokenService,
    GoogleCalendarOAuthService,
    GoogleCalendarSyncService,
    CalendarService,
  ],
})
export class GoogleCalendarModule {}
