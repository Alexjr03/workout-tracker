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

const BASIS_LABELS: Record<LoadBasis, string> = {
  'per-side': 'lb/side',
  'per-dumbbell': 'lb each',
  total: 'lb',
  assistance: 'lb assist',
};

export function loadBasisLabel(basis: LoadBasis): string {
  return BASIS_LABELS[basis];
}
