import { computeAvailableSlots } from './appointment-slots.util';

describe('computeAvailableSlots', () => {
  it('returns slots within business hours and skips busy ranges', () => {
    const slots = computeAvailableSlots({
      from: new Date('2026-07-20T00:00:00.000Z'), // Monday UTC
      to: new Date('2026-07-20T23:59:59.000Z'),
      durationMin: 30,
      bufferMin: 0,
      businessHours: {
        timezone: 'UTC',
        schedule: [{ day: 1, open: '09:00', close: '11:00' }],
      },
      busy: [{ start: new Date('2026-07-20T09:00:00.000Z'), end: new Date('2026-07-20T09:30:00.000Z') }],
      now: new Date('2026-07-19T10:00:00.000Z'),
      maxSlots: 10,
    });

    expect(slots.map((slot) => slot.start.toISOString())).toEqual([
      '2026-07-20T09:30:00.000Z',
      '2026-07-20T10:00:00.000Z',
      '2026-07-20T10:30:00.000Z',
    ]);
    expect(slots.every((s) => s.end.getTime() - s.start.getTime() === 30 * 60_000)).toBe(true);
  });

  it('converts Baghdad clinic wall time to the correct UTC instant', () => {
    const slots = computeAvailableSlots({
      from: new Date('2026-07-19T21:00:00.000Z'),
      to: new Date('2026-07-20T20:59:59.999Z'),
      durationMin: 30,
      businessHours: {
        timezone: 'Asia/Baghdad',
        schedule: [{ day: 1, open: '09:00', close: '10:00' }],
      },
      now: new Date('2026-07-19T00:00:00.000Z'),
      maxSlots: 10,
    });

    expect(slots.map((slot) => slot.start.toISOString())).toEqual([
      '2026-07-20T06:00:00.000Z',
      '2026-07-20T06:30:00.000Z',
    ]);
  });

  it('returns empty when entire window is in the past', () => {
    const slots = computeAvailableSlots({
      from: new Date('2020-01-01T00:00:00.000Z'),
      to: new Date('2020-01-01T23:59:59.000Z'),
      durationMin: 30,
      now: new Date('2026-07-17T12:00:00.000Z'),
      maxSlots: 5,
    });
    expect(slots).toEqual([]);
  });
});
