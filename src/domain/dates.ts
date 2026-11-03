/** A local calendar day, 'YYYY-MM-DD'. String comparison orders dates correctly. */
export type LocalDate = string;

export const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const DAY_MS = 86_400_000;
const PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (n: number) => String(n).padStart(2, '0');

/** The calendar day of `date` in the device's time zone. */
export function toLocalDate(date: Date): LocalDate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Day arithmetic runs in UTC so DST changes never shift a calendar day.
function toUtcMs(date: LocalDate): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): LocalDate {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

export function weekdayOf(date: LocalDate): Weekday {
  return WEEKDAYS[new Date(toUtcMs(date)).getUTCDay()] as Weekday;
}

/** 'Monday, Nov 23' */
export function formatDayLabel(date: LocalDate): string {
  return new Date(toUtcMs(date)).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function isLocalDate(value: string): boolean {
  return PATTERN.test(value) && fromUtcMs(toUtcMs(value)) === value;
}
