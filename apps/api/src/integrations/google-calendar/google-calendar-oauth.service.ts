import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleCalendarConnectionStatus, OAuthSessionStatus } from '@watsapp/database';
import { createHash, randomBytes } from 'crypto';
import { AuditService } from '../../audit/audit.service';
import { PlanEntitlementsService } from '../../billing/plan-entitlements.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../security/encryption.service';
import { GoogleCalendarApiClient } from './google-calendar-api.client';
import { GoogleCalendarTokenService } from './google-calendar-token.service';

@Injectable()
export class GoogleCalendarOAuthService {
  private readonly logger = new Logger(GoogleCalendarOAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly api: GoogleCalendarApiClient,
    private readonly tokens: GoogleCalendarTokenService,
    private readonly encryption: EncryptionService,
    private readonly audit: AuditService,
    private readonly entitlements: PlanEntitlementsService,
    private readonly config: ConfigService,
  ) {}

  status(teamId: string) {
    return this.prisma.googleCalendarConnection.findUnique({
      where: { teamId },
      select: {
        id: true,
        status: true,
        googleAccountEmail: true,
        calendarId: true,
        calendarSummary: true,
        calendarTimeZone: true,
        connectedAt: true,
        lastSyncAt: true,
        failureReason: true,
      },
    });
  }

  async startConnect(teamId: string, userId: string) {
    await this.entitlements.assertAppointmentsEnabled(teamId);
    if (!this.api.isConfigured()) {
      throw new ServiceUnavailableException(
        'Google Calendar is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.',
      );
    }

    const state = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.prisma.socialOAuthSession.create({
      data: {
        teamId,
        userId,
        provider: 'google_calendar',
        status: OAuthSessionStatus.PENDING,
        encryptedPayload: this.encryption.encryptJson({ state, teamId, userId }),
        expiresAt,
      },
    });

    await this.prisma.googleCalendarConnection.upsert({
      where: { teamId },
      update: { status: GoogleCalendarConnectionStatus.CONNECTING, failureReason: null },
      create: { teamId, status: GoogleCalendarConnectionStatus.CONNECTING },
    });

    const url = this.api.buildAuthUrl(state);
    this.logger.log(`[Google Calendar] Google OAuth Started teamId=${teamId}`);
    return { url, state };
  }

  async handleCallback(code: string | undefined, state: string | undefined) {
    this.logger.log(`[Google Calendar] Google OAuth Callback received`);
    if (!code || !state) {
      this.logger.error(`[Google Calendar] Google OAuth Failed reason=missing_code_or_state`);
      throw new BadRequestException('Missing OAuth code or state');
    }

    const sessions = await this.prisma.socialOAuthSession.findMany({
      where: {
        provider: 'google_calendar',
        status: OAuthSessionStatus.PENDING,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
    });

    let matched: (typeof sessions)[number] | null = null;
    let payload: { state: string; teamId: string; userId: string } | null = null;
    for (const session of sessions) {
      try {
        const decrypted = this.encryption.decryptJson<{ state: string; teamId: string; userId: string }>(
          session.encryptedPayload,
        );
        if (decrypted.state === state) {
          matched = session;
          payload = decrypted;
          break;
        }
      } catch (error) {
        this.logger.warn(
          `[Google Calendar] OAuth state decrypt skipped: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (!matched || !payload) {
      this.logger.error(`[Google Calendar] Google OAuth Failed reason=invalid_or_expired_state`);
      throw new BadRequestException('Invalid or expired OAuth state');
    }

    try {
      const tokenData = await this.api.exchangeCode(code);
      const email = await this.api.getUserEmail(tokenData.access_token);
      const calendars = await this.api.listCalendars(tokenData.access_token);
      const primary = calendars.find((c) => c.primary) ?? calendars[0];

      const connection = await this.prisma.googleCalendarConnection.upsert({
        where: { teamId: payload.teamId },
        update: {
          status: GoogleCalendarConnectionStatus.CONNECTED,
          googleAccountEmail: email,
          calendarId: primary?.id ?? 'primary',
          calendarSummary: primary?.summary ?? 'Primary',
          calendarTimeZone: primary?.timeZone ?? null,
          connectedAt: new Date(),
          lastSyncAt: new Date(),
          syncToken: null,
          failureReason: null,
        },
        create: {
          teamId: payload.teamId,
          status: GoogleCalendarConnectionStatus.CONNECTED,
          googleAccountEmail: email,
          calendarId: primary?.id ?? 'primary',
          calendarSummary: primary?.summary ?? 'Primary',
          calendarTimeZone: primary?.timeZone ?? null,
          connectedAt: new Date(),
          lastSyncAt: new Date(),
        },
      });

      await this.tokens.storeTokens(connection.id, tokenData);
      this.logger.log(`[Google Calendar] Access Token Saved connectionId=${connection.id}`);
      if (tokenData.refresh_token) {
        this.logger.log(`[Google Calendar] Refresh Token Saved connectionId=${connection.id}`);
      }
      await this.prisma.socialOAuthSession.update({
        where: { id: matched.id },
        data: { status: OAuthSessionStatus.COMPLETED, completedAt: new Date() },
      });

      await this.audit.log({
        teamId: payload.teamId,
        actorUserId: payload.userId,
        action: 'google_calendar.connect',
        resource: 'googleCalendarConnection',
        resourceId: connection.id,
        metadata: { email, calendarId: connection.calendarId },
      });

      this.logger.log(`[Google Calendar] Google OAuth Success teamId=${payload.teamId} email=${email}`);
      this.logger.log(`[Google Calendar] Calendar Connected teamId=${payload.teamId} calendarId=${connection.calendarId}`);
      const webUrl = this.config.getOrThrow<string>('WEB_PUBLIC_URL').replace(/\/$/, '');
      return { redirectUrl: `${webUrl}/settings/google-calendar?google=connected` };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[Google Calendar] Google OAuth Failed teamId=${payload.teamId}: ${message}`);
      await this.prisma.googleCalendarConnection.upsert({
        where: { teamId: payload.teamId },
        update: { status: GoogleCalendarConnectionStatus.FAILED, failureReason: message.slice(0, 500) },
        create: {
          teamId: payload.teamId,
          status: GoogleCalendarConnectionStatus.FAILED,
          failureReason: message.slice(0, 500),
        },
      });
      const webUrl = this.config.getOrThrow<string>('WEB_PUBLIC_URL').replace(/\/$/, '');
      return { redirectUrl: `${webUrl}/settings/google-calendar?google=error` };
    }
  }

  async reconnect(teamId: string, userId: string) {
    this.logger.log(`[Google Calendar] Reconnect requested teamId=${teamId}`);
    return this.startConnect(teamId, userId);
  }

  async disconnect(teamId: string, userId: string) {
    const connection = await this.prisma.googleCalendarConnection.findUnique({ where: { teamId } });
    if (!connection) return { ok: true };
    await this.prisma.googleCalendarToken.deleteMany({ where: { connectionId: connection.id } });
    await this.prisma.googleCalendarConnection.update({
      where: { id: connection.id },
      data: {
        status: GoogleCalendarConnectionStatus.DISCONNECTED,
        googleAccountEmail: null,
        calendarSummary: null,
        calendarTimeZone: null,
        connectedAt: null,
        failureReason: null,
      },
    });
    await this.audit.log({
      teamId,
      actorUserId: userId,
      action: 'google_calendar.disconnect',
      resource: 'googleCalendarConnection',
      resourceId: connection.id,
    });
    return { ok: true };
  }

  async updateCalendarId(teamId: string, calendarId: string) {
    const connection = await this.prisma.googleCalendarConnection.findUnique({ where: { teamId } });
    if (!connection || connection.status !== GoogleCalendarConnectionStatus.CONNECTED) {
      throw new BadRequestException('Google Calendar is not connected');
    }
    const token = await this.tokens.getAccessToken(teamId);
    if (!token) throw new BadRequestException('Google Calendar token expired');
    const calendars = await this.api.listCalendars(token);
    const match = calendars.find((c) => c.id === calendarId);
    if (!match) throw new BadRequestException('Calendar not found on Google account');
    return this.prisma.googleCalendarConnection.update({
      where: { teamId },
      data: {
        calendarId: match.id,
        calendarSummary: match.summary ?? match.id,
        calendarTimeZone: match.timeZone ?? null,
        lastSyncAt: new Date(),
      },
      select: {
        id: true,
        status: true,
        googleAccountEmail: true,
        calendarId: true,
        calendarSummary: true,
        calendarTimeZone: true,
        connectedAt: true,
      },
    });
  }

  /** Stable fingerprint for logging without leaking tokens. */
  static fingerprint(value: string) {
    return createHash('sha256').update(value).digest('hex').slice(0, 12);
  }
}
