import type { ExerciseDef } from '../db/types';

/** One finished session's record of an exercise, with the prescription it was logged against. */
export interface ExerciseHistoryEntry {
  finishedAt: string;
  prescribedSets: number;
  repMax: number;
  sets: { setIndex: number; weight: number; reps: number }[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Next session's suggested weight, or null. Looks only at the most recent session: every
 * prescribed set must be logged with reps ≥ repMax. Builds on the lowest weight used.
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

  const prescribed = latest.sets.filter((s) => s.setIndex < latest.prescribedSets);
  const indexes = new Set(prescribed.map((s) => s.setIndex));
  if (indexes.size < latest.prescribedSets) return null;
  if (prescribed.some((s) => s.reps < latest.repMax)) return null;

  const base = Math.min(...prescribed.map((s) => s.weight));
  if (exercise.loadBasis === 'assistance') {
    const next = Math.max(0, round2(base - exercise.increment));
    return next === base ? null : next;
  }
  return round2(base + exercise.increment);
}
