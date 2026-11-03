import type { LoadBasis } from '../db/types';

/**
 * Exercise to show after a set: the current one while it has sets left, else the next one
 * with sets left (wrapping, since exercises can be done out of order). `slots.length` = all done.
 */
export function nextExerciseIndex(
  slots: { prescribedSets: number }[],
  loggedCounts: number[],
  current: number,
): number {
  const indexed = [...slots.entries()];
  const rotated = [...indexed.slice(current), ...indexed.slice(0, current)];
  const next = rotated.find(([i, slot]) => (loggedCounts[i] ?? 0) < slot.prescribedSets);
  return next ? next[0] : slots.length;
}

interface SetCounts {
  prescribedSets: number;
  optionalSets: number;
  optionalSkipped: boolean;
}

/** Sets that must be done; an optional ramp-up set may be skipped. */
export function requiredSets(slot: Omit<SetCounts, 'optionalSkipped'>): number {
  return slot.prescribedSets - slot.optionalSets;
}

/** Sets the runner still aims for: every set, unless the optional one was skipped. */
export function targetSets(slot: SetCounts): number {
  return slot.optionalSkipped ? requiredSets(slot) : slot.prescribedSets;
}

const BASIS_LABELS: Record<LoadBasis, string> = {
  'per-side': 'lb/side',
  'per-dumbbell': 'lb each',
  total: 'lb',
  assistance: 'lb assist',
};

export function loadBasisLabel(basis: LoadBasis): string {
  return BASIS_LABELS[basis];
}
