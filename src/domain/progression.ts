import type { ExerciseDef } from '../db/types';

/** One finished session's record of an exercise, with the prescription it was logged against. */
export interface ExerciseHistoryEntry {
  finishedAt: string;
  prescribedSets: number;
  /** Trailing sets that could be skipped (ramp-up). */
  optionalSets: number;
  repMax: number;
  sets: { setIndex: number; weight: number; reps: number }[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Next session's suggested weight, or null. Looks only at the most recent session: every
 * required set must be logged, and every prescribed set that was logged (an optional one
 * included) must reach repMax. Builds on the lowest weight used.
 * Assistance exercises progress by removing assistance, never below 0.
 */
export function progressionSuggestion(
  history: ExerciseHistoryEntry[],
  exercise: Pick<ExerciseDef, 'loadBasis' | 'increment'>,
): number | null {
  const latest = history.reduce<ExerciseHistoryEntry | null>(
    (best, e) => (best === null || e.finishedAt > best.finishedAt ? e : best),
    null,
  );
  if (!latest) return null;

  const required = latest.prescribedSets - latest.optionalSets;
  const prescribed = latest.sets.filter((s) => s.setIndex < latest.prescribedSets);
  const indexes = new Set(prescribed.map((s) => s.setIndex));
  for (let i = 0; i < required; i++) if (!indexes.has(i)) return null;
  if (prescribed.some((s) => s.reps < latest.repMax)) return null;

  const base = Math.min(...prescribed.map((s) => s.weight));
  if (exercise.loadBasis === 'assistance') {
    const next = Math.max(0, round2(base - exercise.increment));
    return next === base ? null : next;
  }
  return round2(base + exercise.increment);
}
