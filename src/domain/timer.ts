import type { ExerciseType, Settings } from '../db/types';

// The rest timer is an absolute end time, not a tick count: iOS pauses JS in the background,
// so remaining time is always recomputed from the clock.

export function restEndsAt(
  type: ExerciseType,
  restSeconds: Settings['restSeconds'],
  now: number,
): string {
  return new Date(now + restSeconds[type] * 1000).toISOString();
}

export function remainingSeconds(endsAt: string, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(endsAt) - now) / 1000));
}

/** Moves the end time by `deltaSeconds`, never before now. */
export function adjustEndsAt(endsAt: string, deltaSeconds: number, now: number): string {
  const base = Math.max(Date.parse(endsAt), now);
  return new Date(Math.max(now, base + deltaSeconds * 1000)).toISOString();
}

export function formatClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
