import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import {
  AppointmentReminderStatus,
  AppointmentStatus,
  MessageDirection,
  MessageStatus,
  MessageType,
} from '@watsapp/database';
import { Job } from 'bullmq';
import { ChannelMessageService } from '../channels/channel-message.service';
import { OutboundChannelService } from '../channels/outbound-channel.service';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUES } from '../queues/queues.constants';
import { formatSlotLabel } from './appointment-slots.util';
import type { AppointmentReminderJob } from './appointment-reminder.service';

@Processor(QUEUES.APPOINTMENT_REMINDERS)
export class AppointmentReminderProcessor extends WorkerHost {
  private readonly logger = new Logger(AppointmentReminderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbound: OutboundChannelService,
    private readonly channelMessages: ChannelMessageService,
  ) {
    super();
  }

  async process(job: Job<AppointmentReminderJob>) {
    const { reminderId, appointmentId, teamId, kind } = job.data;
    this.logger.log(`[Appointments] Reminder job start id=${reminderId} kind=${kind} appointmentId=${appointmentId}`);

    const reminder = await this.prisma.appointmentReminder.findFirst({
      where: { id: reminderId, teamId },
      include: {
        appointment: {
          include: { staff: true, service: true, conversation: true },
        },
      },
    });

    if (!reminder) {
      this.logger.warn(`[Appointments] Reminder missing id=${reminderId}`);
      return;
    }
    if (reminder.status !== AppointmentReminderStatus.SCHEDULED) {
      this.logger.log(`[Appointments] Reminder skipped status=${reminder.status}`);
      return;
    }

    const appointment = reminder.appointment;
    if (
      appointment.status === AppointmentStatus.CANCELLED ||
      appointment.status === AppointmentStatus.COMPLETED ||
      appointment.status === AppointmentStatus.NO_SHOW
    ) {
      await this.prisma.appointmentReminder.update({
        where: { id: reminderId },
        data: { status: AppointmentReminderStatus.SKIPPED },
      });
      return;
    }

    const profile = await this.prisma.appointmentBusinessProfile.findUnique({ where: { teamId } });
    if (!profile?.enabled || !profile.aiCanSendReminders) {
      await this.prisma.appointmentReminder.update({
        where: { id: reminderId },
        data: { status: AppointmentReminderStatus.SKIPPED, lastError: 'reminders_disabled' },
      });
      return;
    }

    if (!appointment.conversationId) {
      await this.prisma.appointmentReminder.update({
        where: { id: reminderId },
        data: {
          status: AppointmentReminderStatus.FAILED,
          attempts: { increment: 1 },
          lastError: 'no_conversation',
        },
      });
      throw new Error('Appointment has no linked conversation for WhatsApp reminder');
    }

    const when = formatSlotLabel({ start: appointment.startsAt, end: appointment.endsAt });
    const lead =
      kind === 'H24'
        ? 'تذكير: موعدك بعد 24 ساعة'
        : kind === 'H2'
          ? 'تذكير: موعدك بعد ساعتين'
          : 'تذكير: موعدك بعد 30 دقيقة';
    const text = [
      `⏰ ${lead}`,
      appointment.customerName ? `الاسم: ${appointment.customerName}` : null,
      appointment.service ? `الخدمة: ${appointment.service.name}` : null,
      appointment.staff ? `مع: ${appointment.staff.name}` : null,
      `الوقت: ${when}`,
      profile.orgName ? `المكان: ${profile.orgName}` : null,
      profile.address ? `العنوان: ${profile.address}` : null,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const response = await this.outbound.sendText(teamId, appointment.conversationId, text);
      const conversation = await this.prisma.conversation.findFirst({
        where: { id: appointment.conversationId, teamId },
        include: { contact: { include: { identities: true } } },
      });
      const identity =
        conversation?.contact.identities.find((i) => i.channelId === conversation.channelId) ??
        conversation?.contact.identities[0];
      if (conversation && identity) {
        await this.channelMessages.ingest({
          teamId,
          channelId: conversation.channelId,
          externalIdentityId: identity.externalId,
          displayName: conversation.contact.displayName,
          providerMessageId: response?.key?.id,
          direction: MessageDirection.OUTBOUND,
          type: MessageType.TEXT,
          status: MessageStatus.SENT,
          text,
          payload: response ?? {},
          occurredAt: new Date(),
        });
      }

      await this.prisma.appointmentReminder.update({
        where: { id: reminderId },
        data: {
          status: AppointmentReminderStatus.SENT,
          sentAt: new Date(),
          attempts: { increment: 1 },
          lastError: null,
        },
      });
      this.logger.log(`[Appointments] Reminder sent id=${reminderId} kind=${kind}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.appointmentReminder.update({
        where: { id: reminderId },
        data: {
          status: AppointmentReminderStatus.FAILED,
          attempts: { increment: 1 },
          lastError: message.slice(0, 500),
        },
      });
      this.logger.error(`[Appointments] Reminder failed id=${reminderId}: ${message}`);
      throw error;
    }
  }
}
