import { addDays, weekdayOf, WEEKDAYS, type LocalDate } from './dates';

/** A calendar month, 'YYYY-MM'. */
export type Month = string;

export const monthOf = (date: LocalDate): Month => date.slice(0, 7);

export function shiftMonth(month: Month, delta: number): Month {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** 'November 2026' */
export function monthLabel(month: Month): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** The month's days for a Monday-first grid, with nulls before the 1st. */
export function monthCells(month: Month): (LocalDate | null)[] {
  const first = `${month}-01`;
  const lead = (WEEKDAYS.indexOf(weekdayOf(first)) + 6) % 7;
  const days: LocalDate[] = [];
  for (let d = first; monthOf(d) === month; d = addDays(d, 1)) days.push(d);
  return [...Array<null>(lead).fill(null), ...days];
}

/** One exercise's heaviest set in one session (lightest for assisted exercises). */
export interface ExerciseBest {
  sessionId: string;
  exerciseId: string;
  name: string;
  unit: string;
  weight: number;
  /** Assisted exercises: less help is better. */
  lowerIsBetter: boolean;
}

export interface WeightIncrease {
  name: string;
  weight: number;
  unit: string;
}

/**
 * Per session, the exercises whose best weight beat every earlier session's. `bests` must be in
 * session order, oldest first. The first time an exercise is done is not an increase.
 */
export function weightIncreases(bests: ExerciseBest[]): Map<string, WeightIncrease[]> {
  const record = new Map<string, number>();
  const result = new Map<string, WeightIncrease[]>();
  for (const b of bests) {
    const previous = record.get(b.exerciseId);
    const beat =
      previous !== undefined && (b.lowerIsBetter ? b.weight < previous : b.weight > previous);
    if (previous === undefined || beat) record.set(b.exerciseId, b.weight);
    if (beat) {
      result.set(b.sessionId, [
        ...(result.get(b.sessionId) ?? []),
        { name: b.name, weight: b.weight, unit: b.unit },
      ]);
    }
  }
  return result;
}
