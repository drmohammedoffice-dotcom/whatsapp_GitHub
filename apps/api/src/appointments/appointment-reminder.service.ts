import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import {
  AppointmentReminderKind,
  AppointmentReminderStatus,
} from '@watsapp/database';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { QUEUES } from '../queues/queues.constants';

export type AppointmentReminderJob = {
  reminderId: string;
  teamId: string;
  appointmentId: string;
  kind: AppointmentReminderKind;
};

const KIND_OFFSET_MS: Record<AppointmentReminderKind, number> = {
  [AppointmentReminderKind.H24]: 24 * 60 * 60 * 1000,
  [AppointmentReminderKind.H2]: 2 * 60 * 60 * 1000,
  [AppointmentReminderKind.M30]: 30 * 60 * 1000,
};

@Injectable()
export class AppointmentReminderService {
  private readonly logger = new Logger(AppointmentReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUES.APPOINTMENT_REMINDERS) private readonly queue: Queue<AppointmentReminderJob>,
  ) {}

  async scheduleForAppointment(appointment: {
    id: string;
    teamId: string;
    startsAt: Date;
    status: string;
  }) {
    const kinds = [AppointmentReminderKind.H24, AppointmentReminderKind.H2, AppointmentReminderKind.M30];
    for (const kind of kinds) {
      const scheduledFor = new Date(appointment.startsAt.getTime() - KIND_OFFSET_MS[kind]);
      if (scheduledFor.getTime() <= Date.now()) {
        this.logger.log(`[Appointments] Skip reminder ${kind} (already past) appointmentId=${appointment.id}`);
        continue;
      }
      const delay = Math.max(0, scheduledFor.getTime() - Date.now());
      const reminder = await this.prisma.appointmentReminder.upsert({
        where: { appointmentId_kind: { appointmentId: appointment.id, kind } },
        update: {
          status: AppointmentReminderStatus.SCHEDULED,
          scheduledFor,
          sentAt: null,
          lastError: null,
          attempts: 0,
        },
        create: {
          teamId: appointment.teamId,
          appointmentId: appointment.id,
          kind,
          scheduledFor,
          status: AppointmentReminderStatus.SCHEDULED,
        },
      });

      const job = await this.queue.add(
        'send',
        {
          reminderId: reminder.id,
          teamId: appointment.teamId,
          appointmentId: appointment.id,
          kind,
        },
        {
          jobId: `appt-reminder-${reminder.id}`,
          delay,
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      );

      await this.prisma.appointmentReminder.update({
        where: { id: reminder.id },
        data: { jobId: String(job.id) },
      });
      this.logger.log(
        `[Appointments] Reminder scheduled kind=${kind} appointmentId=${appointment.id} delayMs=${delay}`,
      );
    }
  }

  async cancelForAppointment(appointmentId: string) {
    const reminders = await this.prisma.appointmentReminder.findMany({
      where: { appointmentId, status: AppointmentReminderStatus.SCHEDULED },
    });
    for (const reminder of reminders) {
      if (reminder.jobId) {
        try {
          const job = await this.queue.getJob(reminder.jobId);
          await job?.remove();
        } catch {
          /* ignore */
        }
      }
    }
    await this.prisma.appointmentReminder.updateMany({
      where: { appointmentId, status: AppointmentReminderStatus.SCHEDULED },
      data: { status: AppointmentReminderStatus.CANCELLED },
    });
  }
}
