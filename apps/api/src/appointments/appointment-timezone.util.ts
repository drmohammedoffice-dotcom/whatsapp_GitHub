export type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

const WEEKDAYS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function assertValidTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return timeZone;
  } catch {
    throw new RangeError(`Invalid IANA timezone: ${timeZone}`);
  }
}

export function getZonedParts(date: Date, timeZone: string): ZonedDateParts {
  assertValidTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return {
    year: Number(value('year')),
    month: Number(value('month')),
    day: Number(value('day')),
    hour: Number(value('hour')),
    minute: Number(value('minute')),
    second: Number(value('second')),
    weekday: WEEKDAYS[value('weekday')] ?? 0,
  };
}

/**
 * Convert a wall-clock time in an IANA zone to its UTC instant.
 * The second pass handles DST/offset transitions without relying on server TZ.
 */
export function zonedDateTimeToUtc(
  input: Omit<ZonedDateParts, 'weekday'>,
  timeZone: string,
): Date {
  assertValidTimeZone(timeZone);
  const desiredUtc = Date.UTC(
    input.year,
    input.month - 1,
    input.day,
    input.hour,
    input.minute,
    input.second,
  );
  let guess = new Date(desiredUtc);
  for (let i = 0; i < 3; i += 1) {
    const actual = getZonedParts(guess, timeZone);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second,
    );
    const correction = desiredUtc - actualAsUtc;
    if (correction === 0) break;
    guess = new Date(guess.getTime() + correction);
  }
  return guess;
}

export function addZonedDays(date: Date, days: number, timeZone: string): Date {
  const parts = getZonedParts(date, timeZone);
  const calendar = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return zonedDateTimeToUtc(
    {
      year: calendar.getUTCFullYear(),
      month: calendar.getUTCMonth() + 1,
      day: calendar.getUTCDate(),
      hour: parts.hour,
      minute: parts.minute,
      second: parts.second,
    },
    timeZone,
  );
}

export function zonedDayKey(date: Date, timeZone: string): string {
  const p = getZonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function formatInTimeZone(
  date: Date,
  timeZone: string,
  locale = 'ar-IQ',
): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
