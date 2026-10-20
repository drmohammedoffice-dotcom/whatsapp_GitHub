import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AppointmentSource, AppointmentStatus, GoogleCalendarConnectionStatus } from '@watsapp/database';
import { PrismaService } from '../../prisma/prisma.service';
import { GoogleCalendarApiClient, type GoogleCalendarEvent } from './google-calendar-api.client';
import { GoogleCalendarTokenService } from './google-calendar-token.service';

/**
 * Two-way sync between Google Calendar events and ChatLoora appointments.
 * Conflict rule: ChatLoora-origin updates win while `syncOrigin=CHATLOORA` within a short window;
 * otherwise Google event state is applied for events that exist on Google.
 */
@Injectable()
export class GoogleCalendarSyncService {
  private readonly logger = new Logger(GoogleCalendarSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly api: GoogleCalendarApiClient,
    private readonly tokens: GoogleCalendarTokenService,
  ) {}

  async syncCalendar(teamId: string) {
    this.logger.log(`[Google Calendar] Sync Started teamId=${teamId}`);
    const connection = await this.prisma.googleCalendarConnection.findUnique({ where: { teamId } });
    if (!connection || connection.status !== GoogleCalendarConnectionStatus.CONNECTED) {
      throw new ServiceUnavailableException('Google Calendar is not connected');
    }

    const token = await this.tokens.getAccessToken(teamId);
    if (!token) throw new ServiceUnavailableException('Google Calendar token expired — reconnect');

    let syncToken = connection.syncToken;
    let pageToken: string | undefined;
    let imported = 0;
    let updated = 0;
    let cancelled = 0;
    let nextSyncToken: string | undefined;

    try {
      do {
        let page;
        try {
          page = await this.api.listEventsPage(token, connection.calendarId, {
            syncToken,
            pageToken,
            showDeleted: true,
            maxResults: 250,
            ...(syncToken
              ? {}
              : {
                  timeMin: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                  timeMax: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
                }),
          });
        } catch (error) {
          const status = (error as { response?: { status?: number } })?.response?.status;
          if (status === 410 && syncToken) {
            this.logger.warn(`[Google Calendar] Sync token expired teamId=${teamId} — full sync`);
            syncToken = null;
            pageToken = undefined;
            await this.prisma.googleCalendarConnection.update({
              where: { id: connection.id },
              data: { syncToken: null },
            });
            continue;
          }
          throw error;
        }

        for (const event of page.items) {
          const result = await this.applyGoogleEvent(teamId, connection.calendarId, event);
          if (result === 'imported') imported += 1;
          if (result === 'updated') updated += 1;
          if (result === 'cancelled') cancelled += 1;
        }

        pageToken = page.nextPageToken;
        if (page.nextSyncToken) nextSyncToken = page.nextSyncToken;
      } while (pageToken);

      await this.prisma.googleCalendarConnection.update({
        where: { id: connection.id },
        data: {
          lastSyncAt: new Date(),
          syncToken: nextSyncToken ?? syncToken,
          failureReason: null,
        },
      });

      this.logger.log(
        `[Google Calendar] Sync Completed teamId=${teamId} imported=${imported} updated=${updated} cancelled=${cancelled}`,
      );
      return { ok: true, imported, updated, cancelled, lastSyncAt: new Date().toISOString() };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.googleCalendarConnection.update({
        where: { id: connection.id },
        data: { failureReason: message.slice(0, 500) },
      });
      this.logger.error(`[Google Calendar] Sync Failed teamId=${teamId}: ${message}`);
      throw new ServiceUnavailableException(`Google Calendar sync failed: ${message}`);
    }
  }

  private async applyGoogleEvent(
    teamId: string,
    calendarId: string,
    event: GoogleCalendarEvent,
  ): Promise<'imported' | 'updated' | 'cancelled' | 'skipped'> {
    if (!event.id) return 'skipped';

    const existing = await this.prisma.appointment.findFirst({
      where: { teamId, googleEventId: event.id },
    });

    const cancelled = event.status === 'cancelled';
    if (cancelled) {
      if (!existing) return 'skipped';
      if (existing.status === AppointmentStatus.CANCELLED) return 'skipped';
      // Prefer ChatLoora if it just updated locally.
      if (existing.syncOrigin === 'CHATLOORA' && Date.now() - existing.updatedAt.getTime() < 60_000) {
        return 'skipped';
      }
      await this.prisma.appointment.update({
        where: { id: existing.id },
        data: { status: AppointmentStatus.CANCELLED, cancelReason: 'cancelled_on_google', syncOrigin: 'GOOGLE' },
      });
      return 'cancelled';
    }

    const startsAt = event.start?.dateTime ? new Date(event.start.dateTime) : null;
    const endsAt = event.end?.dateTime ? new Date(event.end.dateTime) : null;
    if (!startsAt || !endsAt || Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return 'skipped';
    }

    const phoneGuess =
      event.attendees?.find((a) => a.displayName || a.email)?.displayName ||
      event.summary ||
      'Google Calendar';

    if (!existing) {
      await this.prisma.appointment.create({
        data: {
          teamId,
          customerName: event.summary?.slice(0, 120) || 'Google event',
          customerPhone: String(phoneGuess).replace(/\D/g, '').slice(0, 20) || '0000000000',
          startsAt,
          endsAt,
          status: AppointmentStatus.CONFIRMED,
          source: AppointmentSource.API,
          googleEventId: event.id,
          googleCalendarId: calendarId,
          notes: event.description ?? null,
          syncOrigin: 'GOOGLE',
          metadata: { importedFromGoogle: true },
        },
      });
      return 'imported';
    }

    if (existing.syncOrigin === 'CHATLOORA' && Date.now() - existing.updatedAt.getTime() < 60_000) {
      return 'skipped';
    }

    await this.prisma.appointment.update({
      where: { id: existing.id },
      data: {
        startsAt,
        endsAt,
        notes: event.description ?? existing.notes,
        customerName: event.summary?.slice(0, 120) || existing.customerName,
        googleCalendarId: calendarId,
        syncOrigin: 'GOOGLE',
        status:
          existing.status === AppointmentStatus.CANCELLED ? AppointmentStatus.CONFIRMED : existing.status,
      },
    });
    return 'updated';
  }
}
