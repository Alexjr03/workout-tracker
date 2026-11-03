import type { WorkoutDb } from '../schema';

/** Keeps the values being typed for the current set, so a killed app reopens with them. */
export async function saveDraft(
  db: WorkoutDb,
  draft: { weight: number | null; reps: number | null },
): Promise<void> {
  await db.activeSession.update('active', { draftWeight: draft.weight, draftReps: draft.reps });
}
