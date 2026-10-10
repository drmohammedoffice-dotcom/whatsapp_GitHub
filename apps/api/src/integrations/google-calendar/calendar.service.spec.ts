import { ServiceUnavailableException } from '@nestjs/common';
import { CalendarService } from './calendar.service';

describe('CalendarService timezone integrity', () => {
  const startsAt = new Date('2026-07-20T06:00:00.000Z');
  const endsAt = new Date('2026-07-20T06:30:00.000Z');

  function setup(overrides?: { googleStart?: string; googleEnd?: string; timeZone?: string }) {
    const prisma = {
      googleCalendarConnection: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'connection-1',
          teamId: 'team-1',
          status: 'CONNECTED',
          calendarId: 'primary',
        }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const api = {
      createEvent: jest.fn().mockResolvedValue({ id: 'event-1' }),
      getEvent: jest.fn().mockResolvedValue({
        id: 'event-1',
        start: {
          dateTime: overrides?.googleStart ?? startsAt.toISOString(),
          timeZone: overrides?.timeZone ?? 'Asia/Baghdad',
        },
        end: {
          dateTime: overrides?.googleEnd ?? endsAt.toISOString(),
          timeZone: overrides?.timeZone ?? 'Asia/Baghdad',
        },
      }),
      deleteEvent: jest.fn().mockResolvedValue(undefined),
    };
    const tokens = { getAccessToken: jest.fn().mockResolvedValue('token') };
    return {
      service: new CalendarService(prisma as never, api as never, tokens as never),
      prisma,
      api,
    };
  }

  it('sends explicit clinic timezone and verifies the exact UTC instants from Google', async () => {
    const { service, api } = setup();
    await service.createAppointment('team-1', {
      summary: 'Clinic appointment',
      startsAt,
      endsAt,
      timeZone: 'Asia/Baghdad',
    });

    expect(api.createEvent).toHaveBeenCalledWith(
      'token',
      'primary',
      expect.objectContaining({
        start: { dateTime: startsAt.toISOString(), timeZone: 'Asia/Baghdad' },
        end: { dateTime: endsAt.toISOString(), timeZone: 'Asia/Baghdad' },
      }),
    );
    expect(api.getEvent).toHaveBeenCalledWith('token', 'primary', 'event-1');
    expect(api.deleteEvent).not.toHaveBeenCalled();
  });

  it('deletes an event and fails when Google returns a shifted time', async () => {
    const { service, api } = setup({ googleStart: '2026-07-20T07:00:00.000Z' });

    await expect(
      service.createAppointment('team-1', {
        summary: 'Clinic appointment',
        startsAt,
        endsAt,
        timeZone: 'Asia/Baghdad',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(api.deleteEvent).toHaveBeenCalledWith('token', 'primary', 'event-1');
  });
});
