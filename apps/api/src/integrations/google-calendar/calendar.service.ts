import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { GoogleCalendarConnectionStatus } from '@watsapp/database';
import { PrismaService } from '../../prisma/prisma.service';
import { computeAvailableSlots, type BusinessHoursConfig, type TimeRange } from '../../appointments/appointment-slots.util';
import { GoogleCalendarApiClient, type GoogleCalendarEvent } from './google-calendar-api.client';
import { GoogleCalendarTokenService } from './google-calendar-token.service';

export type CreateCalendarAppointmentInput = {
  summary: string;
  description?: string;
  startsAt: Date;
  endsAt: Date;
  timeZone: string;
  attendeeEmail?: string;
  attendeeName?: string;
};

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly api: GoogleCalendarApiClient,
    private readonly tokens: GoogleCalendarTokenService,
  ) {}

  async getConnectionOrThrow(teamId: string) {
    const connection = await this.prisma.googleCalendarConnection.findUnique({ where: { teamId } });
    if (!connection || connection.status !== GoogleCalendarConnectionStatus.CONNECTED) {
      throw new BadRequestException('Google Calendar is not connected for this workspace');
    }
    return connection;
  }

  private async accessToken(teamId: string) {
    const token = await this.tokens.getAccessToken(teamId);
    if (!token) {
      throw new ServiceUnavailableException('Google Calendar access token unavailable — reconnect the calendar');
    }
    return token;
  }

  async getAvailableSlots(input: {
    teamId: string;
    from: Date;
    to: Date;
    durationMin: number;
    bufferMin?: number;
    businessHours?: BusinessHoursConfig | null;
    timeZone?: string;
    maxSlots?: number;
  }): Promise<TimeRange[]> {
    const connection = await this.getConnectionOrThrow(input.teamId);
    const token = await this.accessToken(input.teamId);
    this.logger.log(
      `[Appointments] GetAvailableSlots teamId=${input.teamId} from=${input.from.toISOString()} to=${input.to.toISOString()} duration=${input.durationMin}`,
    );

    let busy: TimeRange[] = [];
    try {
      const freeBusy = await this.api.freeBusy(token, {
        calendarId: connection.calendarId,
        timeMin: input.from.toISOString(),
        timeMax: input.to.toISOString(),
        timeZone: input.timeZone,
      });
      const ranges = freeBusy.calendars?.[connection.calendarId]?.busy ?? [];
      busy = ranges.map((r) => ({ start: new Date(r.start), end: new Date(r.end) }));
    } catch (error) {
      this.logger.error(
        `[Appointments] freeBusy failed teamId=${input.teamId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException('Failed to read Google Calendar availability');
    }

    const localBusy = await this.prisma.appointment.findMany({
      where: {
        teamId: input.teamId,
        status: { in: ['PENDING', 'CONFIRMED'] },
        startsAt: { lt: input.to },
        endsAt: { gt: input.from },
      },
      select: { startsAt: true, endsAt: true },
    });
    busy = [...busy, ...localBusy.map((a) => ({ start: a.startsAt, end: a.endsAt }))];

    return computeAvailableSlots({
      from: input.from,
      to: input.to,
      durationMin: input.durationMin,
      bufferMin: input.bufferMin,
      businessHours: input.businessHours,
      busy,
      maxSlots: input.maxSlots ?? 8,
    });
  }

  async createAppointment(teamId: string, input: CreateCalendarAppointmentInput) {
    const connection = await this.getConnectionOrThrow(teamId);
    const token = await this.accessToken(teamId);
    const event: GoogleCalendarEvent = {
      summary: input.summary,
      description: input.description,
      start: { dateTime: input.startsAt.toISOString(), timeZone: input.timeZone },
      end: { dateTime: input.endsAt.toISOString(), timeZone: input.timeZone },
      attendees: input.attendeeEmail
        ? [{ email: input.attendeeEmail, displayName: input.attendeeName }]
        : undefined,
    };
    this.logger.log(`[Appointments] CreateAppointment teamId=${teamId} start=${input.startsAt.toISOString()}`);
    const created = await this.api.createEvent(token, connection.calendarId, event);
    if (!created.id) {
      throw new ServiceUnavailableException('Google Calendar created an event without an id');
    }
    let verified: GoogleCalendarEvent;
    try {
      verified = await this.verifyEventTimes({
        teamId,
        token,
        calendarId: connection.calendarId,
        eventId: created.id,
        expectedStart: input.startsAt,
        expectedEnd: input.endsAt,
        expectedTimeZone: input.timeZone,
      });
    } catch (error) {
      // Never leave an unverified, potentially shifted event behind in Google.
      await this.api.deleteEvent(token, connection.calendarId, created.id).catch((rollbackError) => {
        this.logger.error(
          `[Appointments] GOOGLE_TIME_MISMATCH_ROLLBACK_FAILED teamId=${teamId} eventId=${created.id}: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`,
        );
      });
      throw error;
    }
    await this.prisma.googleCalendarConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: new Date() },
    });
    return { eventId: created.id, calendarId: connection.calendarId, raw: verified };
  }

  async updateAppointment(
    teamId: string,
    eventId: string,
    input: Partial<CreateCalendarAppointmentInput> & { calendarId?: string },
  ) {
    const connection = await this.getConnectionOrThrow(teamId);
    const token = await this.accessToken(teamId);
    const calendarId = input.calendarId ?? connection.calendarId;
    const patch: GoogleCalendarEvent = {};
    if (input.summary) patch.summary = input.summary;
    if (input.description !== undefined) patch.description = input.description;
    if (input.startsAt && input.timeZone) {
      patch.start = { dateTime: input.startsAt.toISOString(), timeZone: input.timeZone };
    }
    if (input.endsAt && input.timeZone) {
      patch.end = { dateTime: input.endsAt.toISOString(), timeZone: input.timeZone };
    }
    this.logger.log(`[Appointments] UpdateAppointment teamId=${teamId} eventId=${eventId}`);
    const updated = await this.api.updateEvent(token, calendarId, eventId, patch);
    if (input.startsAt && input.endsAt && input.timeZone) {
      return this.verifyEventTimes({
        teamId,
        token,
        calendarId,
        eventId,
        expectedStart: input.startsAt,
        expectedEnd: input.endsAt,
        expectedTimeZone: input.timeZone,
      });
    }
    return updated;
  }

  async deleteAppointment(teamId: string, eventId: string, calendarId?: string) {
    const connection = await this.getConnectionOrThrow(teamId);
    const token = await this.accessToken(teamId);
    this.logger.log(`[Appointments] DeleteAppointment teamId=${teamId} eventId=${eventId}`);
    await this.api.deleteEvent(token, calendarId ?? connection.calendarId, eventId);
  }

  async listUpcomingAppointments(teamId: string, opts?: { maxResults?: number; timeZone?: string }) {
    const connection = await this.getConnectionOrThrow(teamId);
    const token = await this.accessToken(teamId);
    this.logger.log(`[Appointments] ListUpcoming teamId=${teamId}`);
    return this.api.listUpcoming(token, connection.calendarId, {
      timeMin: new Date().toISOString(),
      maxResults: opts?.maxResults ?? 20,
      timeZone: opts?.timeZone,
    });
  }

  private async verifyEventTimes(input: {
    teamId: string;
    token: string;
    calendarId: string;
    eventId: string;
    expectedStart: Date;
    expectedEnd: Date;
    expectedTimeZone: string;
  }) {
    const event = await this.api.getEvent(
      input.token,
      input.calendarId,
      input.eventId,
    );
    const actualStart = event.start?.dateTime
      ? new Date(event.start.dateTime)
      : null;
    const actualEnd = event.end?.dateTime ? new Date(event.end.dateTime) : null;
    const startMatches =
      actualStart?.getTime() === input.expectedStart.getTime();
    const endMatches = actualEnd?.getTime() === input.expectedEnd.getTime();
    const zonesMatch =
      event.start?.timeZone === input.expectedTimeZone &&
      event.end?.timeZone === input.expectedTimeZone;

    if (!startMatches || !endMatches || !zonesMatch) {
      this.logger.error(
        `[Appointments] GOOGLE_TIME_MISMATCH teamId=${input.teamId} eventId=${input.eventId} expectedStart=${input.expectedStart.toISOString()} actualStart=${actualStart?.toISOString() ?? 'missing'} expectedEnd=${input.expectedEnd.toISOString()} actualEnd=${actualEnd?.toISOString() ?? 'missing'} expectedZone=${input.expectedTimeZone} actualStartZone=${event.start?.timeZone ?? 'missing'} actualEndZone=${event.end?.timeZone ?? 'missing'}`,
      );
      throw new ServiceUnavailableException(
        'Google Calendar time verification failed',
      );
    }

    this.logger.log(
      `[Appointments] Google event time verified teamId=${input.teamId} eventId=${input.eventId} start=${actualStart.toISOString()} end=${actualEnd.toISOString()} timeZone=${input.expectedTimeZone}`,
    );
    return event;
  }
}
