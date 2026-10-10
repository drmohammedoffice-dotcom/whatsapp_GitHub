import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AppointmentSource,
  AppointmentStatus,
} from '@watsapp/database';
import { PlanEntitlementsService } from '../billing/plan-entitlements.service';
import { CalendarService } from '../integrations/google-calendar/calendar.service';
import { PrismaService } from '../prisma/prisma.service';
import { formatSlotLabel } from './appointment-slots.util';
import { zonedDayKey } from './appointment-timezone.util';
import { AppointmentProfileService } from './appointment-profile.service';
import { AppointmentReminderService } from './appointment-reminder.service';
import type { CreateAppointmentDto, UpdateAppointmentDto } from './dto/appointment.dto';

export type AiAppointmentActionInput = {
  teamId: string;
  conversationId: string;
  contactId?: string | null;
  customerPhone: string;
  customerName?: string | null;
  startsAt: Date;
  endsAt?: Date;
  staffId?: string | null;
  serviceId?: string | null;
  notes?: string | null;
};

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly profile: AppointmentProfileService,
    private readonly calendar: CalendarService,
    private readonly reminders: AppointmentReminderService,
    private readonly entitlements: PlanEntitlementsService,
  ) {}

  async dashboard(teamId: string) {
    const now = new Date();
    const [total, aiCreated, cancelled, upcoming, confirmed, clinicProfile] = await Promise.all([
      this.prisma.appointment.count({ where: { teamId } }),
      this.prisma.appointment.count({ where: { teamId, source: AppointmentSource.AI } }),
      this.prisma.appointment.count({ where: { teamId, status: AppointmentStatus.CANCELLED } }),
      this.prisma.appointment.count({
        where: { teamId, status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] }, startsAt: { gte: now } },
      }),
      this.prisma.appointment.count({ where: { teamId, status: AppointmentStatus.CONFIRMED } }),
      this.prisma.appointmentBusinessProfile.findUnique({
        where: { teamId },
        select: { timezone: true },
      }),
    ]);
    const successRate = total === 0 ? 0 : Math.round((confirmed / total) * 1000) / 10;
    const upcomingList = await this.prisma.appointment.findMany({
      where: { teamId, status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED] }, startsAt: { gte: now } },
      include: { staff: true, service: true, contact: { select: { displayName: true } } },
      orderBy: { startsAt: 'asc' },
      take: 15,
    });
    return {
      total,
      aiCreated,
      cancelled,
      upcoming,
      confirmed,
      successRate,
      timezone: clinicProfile?.timezone ?? 'Asia/Baghdad',
      upcomingList,
    };
  }

  list(teamId: string, opts?: { status?: AppointmentStatus; from?: Date; to?: Date }) {
    return this.prisma.appointment.findMany({
      where: {
        teamId,
        status: opts?.status,
        startsAt: opts?.from || opts?.to ? { gte: opts.from, lte: opts.to } : undefined,
      },
      include: { staff: true, service: true, contact: { select: { id: true, displayName: true, phone: true } } },
      orderBy: { startsAt: 'desc' },
      take: 200,
    });
  }

  async getAvailableSlots(teamId: string, opts?: { from?: Date; to?: Date; durationMin?: number; serviceId?: string }) {
    await this.entitlements.assertAppointmentsEnabled(teamId);
    const profile = await this.profile.ensure(teamId);
    if (!profile.enabled) throw new BadRequestException('Appointment system is disabled for this workspace');
    if (!profile.aiCanReadCalendar) throw new BadRequestException('Calendar read is disabled for this workspace');

    let durationMin = opts?.durationMin ?? profile.defaultDurationMin;
    if (opts?.serviceId) {
      const service = await this.prisma.appointmentServiceOffer.findFirst({
        where: { id: opts.serviceId, teamId, isActive: true },
      });
      if (service) durationMin = service.durationMin;
    }

    const from = opts?.from ?? new Date();
    const to =
      opts?.to ??
      new Date(from.getTime() + Math.max(1, profile.bookingWindowDays) * 24 * 60 * 60 * 1000);

    let slots;
    try {
      slots = await this.calendar.getAvailableSlots({
        teamId,
        from,
        to,
        durationMin,
        bufferMin: Math.max(0, profile.bufferMin + (profile.bufferBeforeMin ?? 0) + (profile.bufferAfterMin ?? 0)),
        businessHours: this.profile.businessHoursOf(profile),
        timeZone: profile.timezone,
        maxSlots: 12,
      });
    } catch (error) {
      this.logger.warn(
        `[Appointments] Calendar slots fallback to local hours teamId=${teamId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      const { computeAvailableSlots } = await import('./appointment-slots.util');
      const localBusy = await this.prisma.appointment.findMany({
        where: {
          teamId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          startsAt: { lt: to },
          endsAt: { gt: from },
        },
        select: { startsAt: true, endsAt: true },
      });
      slots = computeAvailableSlots({
        from,
        to,
        durationMin,
        bufferMin: Math.max(0, profile.bufferMin + (profile.bufferBeforeMin ?? 0) + (profile.bufferAfterMin ?? 0)),
        businessHours: this.profile.businessHoursOf(profile),
        busy: localBusy.map((a) => ({ start: a.startsAt, end: a.endsAt })),
        maxSlots: 12,
      });
    }

    if (profile.maxDailyAppointments && profile.maxDailyAppointments > 0) {
      const dayCounts = new Map<string, number>();
      for (const a of await this.prisma.appointment.findMany({
        where: {
          teamId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          startsAt: { gte: from, lt: to },
        },
        select: { startsAt: true },
      })) {
        const key = zonedDayKey(a.startsAt, profile.timezone);
        dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
      }
      slots = slots.filter((slot) => {
        const key = zonedDayKey(slot.start, profile.timezone);
        return (dayCounts.get(key) ?? 0) < profile.maxDailyAppointments!;
      });
    }

    return {
      durationMin,
      timezone: profile.timezone,
      slots: slots.map((slot) => ({
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
        label: formatSlotLabel(slot, 'ar-IQ', profile.timezone),
      })),
    };
  }

  async create(teamId: string, dto: CreateAppointmentDto, source: AppointmentSource = AppointmentSource.HUMAN) {
    await this.entitlements.assertAppointmentsEnabled(teamId);
    const profile = await this.profile.ensure(teamId);
    if (!profile.enabled) throw new BadRequestException('Appointment system is disabled');

    const startsAt = new Date(dto.startsAt);
    if (Number.isNaN(startsAt.getTime())) throw new BadRequestException('Invalid startsAt');
    let endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    let durationMin = profile.defaultDurationMin;
    let serviceName: string | null = null;
    let staffName: string | null = null;

    if (dto.serviceId) {
      const service = await this.prisma.appointmentServiceOffer.findFirst({
        where: { id: dto.serviceId, teamId },
      });
      if (!service) throw new BadRequestException('Service not found');
      durationMin = service.durationMin;
      serviceName = service.name;
    }
    if (dto.staffId) {
      const staff = await this.prisma.appointmentStaff.findFirst({ where: { id: dto.staffId, teamId } });
      if (!staff) throw new BadRequestException('Staff not found');
      staffName = staff.name;
    }
    if (!endsAt) endsAt = new Date(startsAt.getTime() + durationMin * 60_000);

    const summary = [
      serviceName ?? 'Appointment',
      staffName ? `with ${staffName}` : null,
      dto.customerName ? `— ${dto.customerName}` : null,
    ]
      .filter(Boolean)
      .join(' ');

    let googleEventId: string | null = null;
    let googleCalendarId: string | null = null;
    try {
      const created = await this.calendar.createAppointment(teamId, {
        summary,
        description: dto.notes ?? undefined,
        startsAt,
        endsAt,
        timeZone: profile.timezone,
        attendeeName: dto.customerName ?? undefined,
      });
      googleEventId = created.eventId;
      googleCalendarId = created.calendarId;
    } catch (error) {
      const connection = await this.prisma.googleCalendarConnection.findUnique({
        where: { teamId },
        select: { status: true },
      });
      if (connection?.status === 'CONNECTED') {
        this.logger.error(
          `[Appointments] Google create failed; local appointment aborted to prevent time divergence teamId=${teamId}: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
      this.logger.warn(
        `[Appointments] Google Calendar is not connected; saving local-only appointment teamId=${teamId}`,
      );
    }

    const appointment = await this.prisma.appointment.create({
      data: {
        teamId,
        conversationId: dto.conversationId || null,
        contactId: dto.contactId || null,
        staffId: dto.staffId || null,
        serviceId: dto.serviceId || null,
        customerName: dto.customerName || null,
        customerPhone: dto.customerPhone.trim(),
        startsAt,
        endsAt,
        status: dto.status ?? AppointmentStatus.CONFIRMED,
        source,
        googleEventId,
        googleCalendarId,
        notes: dto.notes || null,
        syncOrigin: 'CHATLOORA',
        metadata: googleEventId ? undefined : { calendarWarning: 'google_event_not_created' },
      },
      include: { staff: true, service: true },
    });

    if (profile.aiCanSendReminders && appointment.status === AppointmentStatus.CONFIRMED) {
      await this.reminders.scheduleForAppointment(appointment);
    }

    this.logger.log(
      `[Appointments] Created id=${appointment.id} teamId=${teamId} source=${source} googleEventId=${googleEventId}`,
    );
    return appointment;
  }

  async createFromAi(input: AiAppointmentActionInput) {
    const profile = await this.profile.ensure(input.teamId);
    if (!profile.enabled || !profile.aiCanCreate) {
      this.logger.warn(`[Appointments] AI create blocked teamId=${input.teamId}`);
      return null;
    }
    return this.create(
      input.teamId,
      {
        customerPhone: input.customerPhone,
        customerName: input.customerName,
        startsAt: input.startsAt.toISOString(),
        endsAt: input.endsAt?.toISOString(),
        staffId: input.staffId,
        serviceId: input.serviceId,
        conversationId: input.conversationId,
        contactId: input.contactId,
        notes: input.notes,
        status: AppointmentStatus.CONFIRMED,
      },
      AppointmentSource.AI,
    );
  }

  async update(teamId: string, id: string, dto: UpdateAppointmentDto) {
    const existing = await this.prisma.appointment.findFirst({ where: { id, teamId } });
    if (!existing) throw new NotFoundException('Appointment not found');
    const profile = await this.profile.ensure(teamId);

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : existing.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : existing.endsAt;
    const status = dto.status ?? existing.status;

    if (existing.googleEventId && (dto.startsAt || dto.endsAt || dto.notes !== undefined)) {
      try {
        await this.calendar.updateAppointment(teamId, existing.googleEventId, {
          calendarId: existing.googleCalendarId ?? undefined,
          startsAt,
          endsAt,
          timeZone: profile.timezone,
          description: dto.notes ?? existing.notes ?? undefined,
          summary: existing.customerName
            ? `Appointment — ${existing.customerName}`
            : 'Appointment',
        });
      } catch (error) {
        this.logger.error(
          `[Appointments] Google update failed; local update aborted to prevent time divergence id=${id}: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error;
      }
    }

    const updated = await this.prisma.appointment.update({
      where: { id },
      data: {
        startsAt,
        endsAt,
        staffId: dto.staffId === undefined ? undefined : dto.staffId,
        serviceId: dto.serviceId === undefined ? undefined : dto.serviceId,
        customerName: dto.customerName === undefined ? undefined : dto.customerName,
        customerPhone: dto.customerPhone,
        notes: dto.notes === undefined ? undefined : dto.notes,
        status,
        cancelReason: dto.cancelReason === undefined ? undefined : dto.cancelReason,
        syncOrigin: 'CHATLOORA',
      },
      include: { staff: true, service: true },
    });

    if (status === AppointmentStatus.CANCELLED) {
      await this.reminders.cancelForAppointment(id);
      if (existing.googleEventId) {
        try {
          await this.calendar.deleteAppointment(teamId, existing.googleEventId, existing.googleCalendarId ?? undefined);
        } catch (error) {
          this.logger.warn(
            `[Appointments] Google delete on cancel failed id=${id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } else if (status === AppointmentStatus.CONFIRMED && (dto.startsAt || dto.endsAt)) {
      await this.reminders.cancelForAppointment(id);
      if (profile.aiCanSendReminders) await this.reminders.scheduleForAppointment(updated);
    }

    this.logger.log(`[Appointments] Updated id=${id} status=${updated.status}`);
    return updated;
  }

  async cancel(teamId: string, id: string, reason?: string) {
    return this.update(teamId, id, { status: AppointmentStatus.CANCELLED, cancelReason: reason ?? null });
  }

  async remove(teamId: string, id: string) {
    const existing = await this.prisma.appointment.findFirst({ where: { id, teamId } });
    if (!existing) throw new NotFoundException('Appointment not found');
    await this.reminders.cancelForAppointment(id);
    if (existing.googleEventId) {
      try {
        await this.calendar.deleteAppointment(teamId, existing.googleEventId, existing.googleCalendarId ?? undefined);
      } catch {
        /* ignore */
      }
    }
    await this.prisma.appointment.delete({ where: { id } });
    return { ok: true };
  }

  confirmationMessage(appointment: {
    customerName?: string | null;
    startsAt: Date;
    endsAt: Date;
    staff?: { name: string } | null;
    service?: { name: string } | null;
  }, timezone: string) {
    const when = formatSlotLabel(
      { start: appointment.startsAt, end: appointment.endsAt },
      'ar-IQ',
      timezone,
    );
    return [
      '✅ تم تأكيد موعدك',
      appointment.customerName ? `الاسم: ${appointment.customerName}` : null,
      appointment.service ? `الخدمة: ${appointment.service.name}` : null,
      appointment.staff ? `مع: ${appointment.staff.name}` : null,
      `الوقت: ${when}`,
      `المنطقة الزمنية: ${timezone}`,
    ]
      .filter(Boolean)
      .join('\n');
  }
}
