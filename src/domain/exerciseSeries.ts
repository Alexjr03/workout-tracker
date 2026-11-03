import type { LoadBasis } from '../db/types';
import type { LocalDate } from './dates';

interface SessionSets {
  date: LocalDate;
  rampUp: boolean;
  sets: { weight: number; reps: number }[];
}

export interface ProgressPoint {
  date: LocalDate;
  /** Heaviest weight, or least assistance for assisted exercises. */
  topWeight: number;
  /** Most reps done at the top weight. */
  bestReps: number;
  rampUp: boolean;
}

/** One point per session that has sets for the exercise, oldest first. */
export function exerciseSeries(sessions: SessionSets[], loadBasis: LoadBasis): ProgressPoint[] {
  const pick = loadBasis === 'assistance' ? Math.min : Math.max;
  return sessions
    .filter((s) => s.sets.length > 0)
    .map((s) => {
      const topWeight = pick(...s.sets.map((set) => set.weight));
      const bestReps = Math.max(
        ...s.sets.filter((set) => set.weight === topWeight).map((set) => set.reps),
      );
      return { date: s.date, topWeight, bestReps, rampUp: s.rampUp };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Consecutive ramp-up sessions, as date ranges to shade on a chart. */
export function rampUpRanges(points: { date: LocalDate; rampUp: boolean }[]) {
  const ranges: { from: LocalDate; to: LocalDate }[] = [];
  let open: { from: LocalDate; to: LocalDate } | null = null;
  for (const p of points) {
    if (!p.rampUp) {
      open = null;
      continue;
    }
    if (open) open.to = p.date;
    else ranges.push((open = { from: p.date, to: p.date }));
  }
  return ranges;
}
