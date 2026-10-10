import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BillingModule } from '../billing/billing.module';
import { ChannelsModule } from '../channels/channels.module';
import { OutboundModule } from '../channels/outbound.module';
import { CalendarApiController, GoogleIntegrationsController } from '../integrations/google-calendar/google-calendar.controllers';
import { GoogleCalendarModule } from '../integrations/google-calendar/google-calendar.module';
import { QueuesModule } from '../queues/queues.module';
import { SecurityModule } from '../security/security.module';
import { AppointmentProfileService } from './appointment-profile.service';
import { AppointmentReminderProcessor } from './appointment-reminder.processor';
import { AppointmentReminderService } from './appointment-reminder.service';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { GoogleCalendarController } from './google-calendar.controller';

@Module({
  imports: [
    SecurityModule,
    AuditModule,
    BillingModule,
    QueuesModule,
    OutboundModule,
    ChannelsModule,
    GoogleCalendarModule,
  ],
  controllers: [
    AppointmentsController,
    GoogleCalendarController,
    GoogleIntegrationsController,
    CalendarApiController,
  ],
  providers: [
    AppointmentProfileService,
    AppointmentReminderService,
    AppointmentReminderProcessor,
    AppointmentsService,
  ],
  exports: [
    AppointmentsService,
    AppointmentProfileService,
    GoogleCalendarModule,
  ],
})
export class AppointmentsModule {}
