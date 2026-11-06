import type { Schedule } from '../db/types';
import { addDays, daysBetween, weekdayOf, type LocalDate } from './dates';

const MONDAY_FIRST = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

/** The Monday on or before `date`; weeks (and push-backs) reset there. */
export function weekStart(date: LocalDate): LocalDate {
  return addDays(date, -MONDAY_FIRST.indexOf(weekdayOf(date) as (typeof MONDAY_FIRST)[number]));
}

/**
 * Mon…Sun template ids for the week containing `date`. Each push-back that week makes its day
 * a rest day and moves the rest of the week one day later, using up the next rest day after it.
 * A push-back on a rest day, or with no rest day left after it, does nothing.
 */
function effectiveWeek(schedule: Schedule, pushBacks: LocalDate[], date: LocalDate): string[] {
  const start = weekStart(date);
  const week: string[] = MONDAY_FIRST.map((d) => schedule[d]);
  for (const p of [...pushBacks].sort()) {
    if (weekStart(p) !== start) continue;
    const i = daysBetween(start, p);
    const nextRest = week.findIndex((id, k) => k > i && id === 'rest');
    if (week[i] === 'rest' || nextRest < 0) continue;
    week.splice(nextRest, 1);
    week.splice(i, 0, 'rest');
  }
  return week;
}

/** Template id scheduled for `date`, or 'rest'. Missed days only move if pushed back. */
export function sessionForDate(
  date: LocalDate,
  routine: { schedule: Schedule },
  pushBacks: LocalDate[] = [],
): string {
  const week = effectiveWeek(routine.schedule, pushBacks, date);
  // Always 7 entries, and the index is 0…6.
  return week[daysBetween(weekStart(date), date)] as string;
}

/** How many more times today can be pushed back this week (rest days left after today). */
export function pushBacksLeft(
  date: LocalDate,
  routine: { schedule: Schedule },
  pushBacks: LocalDate[],
): number {
  const week = effectiveWeek(routine.schedule, pushBacks, date);
  const i = daysBetween(weekStart(date), date);
  return week.filter((id, k) => k > i && id === 'rest').length;
}

/** Today can be pushed back when it is a training day and a rest day is left after it. */
export function canPushBack(
  date: LocalDate,
  routine: { schedule: Schedule },
  pushBacks: LocalDate[],
): boolean {
  return (
    sessionForDate(date, routine, pushBacks) !== 'rest' &&
    pushBacksLeft(date, routine, pushBacks) > 0
  );
}
