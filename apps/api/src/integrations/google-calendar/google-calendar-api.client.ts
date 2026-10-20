import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export type GoogleTokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  id_token?: string;
};

export type GoogleCalendarListEntry = {
  id: string;
  summary?: string;
  primary?: boolean;
  timeZone?: string;
};

export type GoogleFreeBusyResponse = {
  calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }>;
};

export type GoogleCalendarEvent = {
  id?: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  attendees?: Array<{ email?: string; displayName?: string }>;
  status?: string;
};

@Injectable()
export class GoogleCalendarApiClient {
  private readonly logger = new Logger(GoogleCalendarApiClient.name);
  private readonly http: AxiosInstance;

  constructor(private readonly config: ConfigService) {
    this.http = axios.create({ timeout: 20_000 });
  }

  get clientId() {
    return this.config.get<string>('GOOGLE_CLIENT_ID')?.trim() || '';
  }

  get clientSecret() {
    return this.config.get<string>('GOOGLE_CLIENT_SECRET')?.trim() || '';
  }

  get redirectUri() {
    return (
      this.config.get<string>('GOOGLE_REDIRECT_URI')?.trim() ||
      `${this.config.get<string>('API_PUBLIC_URL')}/api/v1/integrations/google/callback`
    );
  }

  isConfigured() {
    return Boolean(this.clientId && this.clientSecret);
  }

  buildAuthUrl(state: string, scopes = ['https://www.googleapis.com/auth/calendar']) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      scope: scopes.join(' '),
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<GoogleTokenResponse> {
    const { data } = await this.withRetry(() =>
      this.http.post<GoogleTokenResponse>('https://oauth2.googleapis.com/token', {
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    );
    return data;
  }

  async refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
    const { data } = await this.withRetry(() =>
      this.http.post<GoogleTokenResponse>('https://oauth2.googleapis.com/token', {
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token',
      }),
    );
    return data;
  }

  async getUserEmail(accessToken: string): Promise<string | null> {
    try {
      const { data } = await this.http.get<{ email?: string }>('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return data.email ?? null;
    } catch (error) {
      this.logger.warn(`Failed to fetch Google userinfo: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  async listCalendars(accessToken: string): Promise<GoogleCalendarListEntry[]> {
    const { data } = await this.withRetry(() =>
      this.http.get<{ items?: GoogleCalendarListEntry[] }>('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    );
    return data.items ?? [];
  }

  async freeBusy(
    accessToken: string,
    input: { calendarId: string; timeMin: string; timeMax: string; timeZone?: string },
  ): Promise<GoogleFreeBusyResponse> {
    const { data } = await this.withRetry(() =>
      this.http.post<GoogleFreeBusyResponse>(
        'https://www.googleapis.com/calendar/v3/freeBusy',
        {
          timeMin: input.timeMin,
          timeMax: input.timeMax,
          timeZone: input.timeZone,
          items: [{ id: input.calendarId }],
        },
        { headers: { Authorization: `Bearer ${accessToken}` } },
      ),
    );
    return data;
  }

  async createEvent(
    accessToken: string,
    calendarId: string,
    event: GoogleCalendarEvent,
  ): Promise<GoogleCalendarEvent> {
    const { data } = await this.withRetry(() =>
      this.http.post<GoogleCalendarEvent>(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
        event,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      ),
    );
    return data;
  }

  async getEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
  ): Promise<GoogleCalendarEvent> {
    const { data } = await this.withRetry(() =>
      this.http.get<GoogleCalendarEvent>(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      ),
    );
    return data;
  }

  async updateEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    event: GoogleCalendarEvent,
  ): Promise<GoogleCalendarEvent> {
    const { data } = await this.withRetry(() =>
      this.http.patch<GoogleCalendarEvent>(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        event,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      ),
    );
    return data;
  }

  async deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
    await this.withRetry(() =>
      this.http.delete(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      ),
    );
  }

  async listUpcoming(
    accessToken: string,
    calendarId: string,
    input: { timeMin: string; maxResults?: number; timeZone?: string },
  ): Promise<GoogleCalendarEvent[]> {
    const params = new URLSearchParams({
      timeMin: input.timeMin,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: String(input.maxResults ?? 20),
    });
    if (input.timeZone) params.set('timeZone', input.timeZone);
    const { data } = await this.withRetry(() =>
      this.http.get<{ items?: GoogleCalendarEvent[] }>(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      ),
    );
    return data.items ?? [];
  }

  /**
   * Incremental or windowed events.list for two-way sync.
   * When syncToken is invalid Google returns 410 — caller should clear token and full-sync.
   */
  async listEventsPage(
    accessToken: string,
    calendarId: string,
    input: {
      syncToken?: string | null;
      timeMin?: string;
      timeMax?: string;
      pageToken?: string;
      maxResults?: number;
      showDeleted?: boolean;
    },
  ): Promise<{ items: GoogleCalendarEvent[]; nextPageToken?: string; nextSyncToken?: string }> {
    const params = new URLSearchParams({
      maxResults: String(input.maxResults ?? 250),
      singleEvents: 'true',
    });
    if (input.syncToken) {
      params.set('syncToken', input.syncToken);
    } else {
      if (input.timeMin) params.set('timeMin', input.timeMin);
      if (input.timeMax) params.set('timeMax', input.timeMax);
      params.set('orderBy', 'startTime');
    }
    if (input.pageToken) params.set('pageToken', input.pageToken);
    if (input.showDeleted) params.set('showDeleted', 'true');

    const { data } = await this.withRetry(() =>
      this.http.get<{
        items?: GoogleCalendarEvent[];
        nextPageToken?: string;
        nextSyncToken?: string;
      }>(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      ),
    );
    return {
      items: data.items ?? [],
      nextPageToken: data.nextPageToken,
      nextSyncToken: data.nextSyncToken,
    };
  }

  private async withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i < attempts; i += 1) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const status = (error as { response?: { status?: number } })?.response?.status;
        const retryable = !status || status >= 500 || status === 429;
        if (!retryable || i === attempts - 1) break;
        const delay = 400 * 2 ** i;
        this.logger.warn(`Google Calendar API retry ${i + 1}/${attempts} after ${delay}ms (status=${status})`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastError;
  }
}
