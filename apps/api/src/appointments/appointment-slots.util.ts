import {
  addZonedDays,
  getZonedParts,
  zonedDateTimeToUtc,
} from './appointment-timezone.util';

export type BusinessHoursSlot = { day: number; open: string; close: string };

export type BusinessHoursConfig = {
  timezone?: string;
  schedule?: BusinessHoursSlot[];
};

export type TimeRange = { start: Date; end: Date };

function parseHm(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function overlaps(a: TimeRange, b: TimeRange): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Build available appointment slots from business hours, busy ranges, and duration.
 * Pure helper — unit-tested without Nest/DB.
 */
export function computeAvailableSlots(input: {
  from: Date;
  to: Date;
  durationMin: number;
  bufferMin?: number;
  businessHours?: BusinessHoursConfig | null;
  busy?: TimeRange[];
  maxSlots?: number;
  now?: Date;
}): TimeRange[] {
  const durationMin = Math.max(5, input.durationMin);
  const bufferMin = Math.max(0, input.bufferMin ?? 0);
  const step = durationMin + bufferMin;
  const busy = input.busy ?? [];
  const maxSlots = input.maxSlots ?? 12;
  const now = input.now ?? new Date();
  const schedule = input.businessHours?.schedule;
  const timeZone = input.businessHours?.timezone ?? 'Asia/Baghdad';

  const slots: TimeRange[] = [];
  const fromParts = getZonedParts(input.from, timeZone);
  let cursorDay = zonedDateTimeToUtc(
    {
      year: fromParts.year,
      month: fromParts.month,
      day: fromParts.day,
      hour: 0,
      minute: 0,
      second: 0,
    },
    timeZone,
  );

  while (cursorDay <= input.to && slots.length < maxSlots) {
    const cursorParts = getZonedParts(cursorDay, timeZone);
    const weekday = cursorParts.weekday;
    const daySlots = schedule?.length
      ? schedule.filter((s) => s.day === weekday)
      : [{ day: weekday, open: '09:00', close: '17:00' }];

    for (const day of daySlots) {
      let minute = parseHm(day.open);
      const closeMin = parseHm(day.close);
      while (minute + durationMin <= closeMin && slots.length < maxSlots) {
        const start = zonedDateTimeToUtc(
          {
            year: cursorParts.year,
            month: cursorParts.month,
            day: cursorParts.day,
            hour: Math.floor(minute / 60),
            minute: minute % 60,
            second: 0,
          },
          timeZone,
        );
        const end = new Date(start.getTime() + durationMin * 60_000);
        if (start >= input.from && end <= input.to && start > now) {
          const candidate = { start, end };
          const conflict = busy.some((b) => overlaps(candidate, b));
          if (!conflict) slots.push(candidate);
        }
        minute += step;
      }
    }
    cursorDay = addZonedDays(cursorDay, 1, timeZone);
  }

  return slots;
}

export function formatSlotLabel(
  slot: TimeRange,
  locale = 'ar-IQ',
  timeZone = 'Asia/Baghdad',
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(slot.start);
}
