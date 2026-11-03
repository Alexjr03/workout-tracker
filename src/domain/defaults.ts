import type { SetLog } from '../db/types';

/**
 * Weight to pre-fill for the next set. Priority: previous set in this session, then the
 * progression suggestion, then the last logged weight, then the routine's starting load.
 * Null means nothing is known and the number pad should open.
 */
export function defaultWeight(input: {
  previousSetWeight: number | null;
  suggestion: number | null;
  lastLoggedWeight: number | null;
  startingLoad: number | null;
}): number | null {
  return (
    input.previousSetWeight ??
    input.suggestion ??
    input.lastLoggedWeight ??
    input.startingLoad ??
    null
  );
}

/** Most recent logged weight for one exercise id. Swapped-in exercises have their own id. */
export function latestWeightFor(
  sets: Pick<SetLog, 'exerciseId' | 'weight' | 'completedAt'>[],
  exerciseId: string,
): number | null {
  let latest: (typeof sets)[number] | null = null;
  for (const s of sets) {
    if (s.exerciseId === exerciseId && (latest === null || s.completedAt > latest.completedAt)) {
      latest = s;
    }
  }
  return latest?.weight ?? null;
}

/** Reps to pre-fill: the same set number last time, else the top of the rep range. */
export function defaultReps(input: {
  setIndex: number;
  lastTimeSets: Pick<SetLog, 'setIndex' | 'reps'>[];
  repMax: number;
}): number {
  return input.lastTimeSets.find((s) => s.setIndex === input.setIndex)?.reps ?? input.repMax;
}
