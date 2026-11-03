import type { Schedule } from '../db/types';
import { weekdayOf, type LocalDate } from './dates';

/** Template id scheduled for `date`, or 'rest'. Strict calendar: missed days don't roll forward. */
export function sessionForDate(date: LocalDate, routine: { schedule: Schedule }): string {
  return routine.schedule[weekdayOf(date)];
}
