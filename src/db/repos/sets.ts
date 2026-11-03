import { Dexie } from 'dexie';
import { nextExerciseIndex } from '../../domain/session';
import type { WorkoutDb } from '../schema';
import type { SessionExerciseLog, SetLog } from '../types';
import { exerciseHistory } from './sessions';

async function loggedCounts(db: WorkoutDb, sessionId: string) {
  const [slots, sets] = await Promise.all([
    db.sessionExercises.where('sessionId').equals(sessionId).sortBy('order'),
    db.sets.where('sessionId').equals(sessionId).toArray(),
  ]);
  const counts = slots.map((s) => sets.filter((set) => set.sessionExerciseId === s.id).length);
  return { slots, counts };
}

/**
 * Saves one completed set and advances the active-session pointer in the same transaction.
 * Callers await this before the UI moves on, so a closed app never loses a tapped set.
 */
export async function completeSet(
  db: WorkoutDb,
  input: { slot: SessionExerciseLog; weight: number; reps: number; now?: Date },
): Promise<SetLog> {
  const { slot, weight, reps, now = new Date() } = input;
  return db.transaction('rw', db.sets, db.sessionExercises, db.activeSession, async () => {
    const setIndex = await db.sets.where('sessionExerciseId').equals(slot.id).count();
    const set: SetLog = {
      id: crypto.randomUUID(),
      sessionExerciseId: slot.id,
      sessionId: slot.sessionId,
      exerciseId: slot.exerciseId,
      setIndex,
      weight,
      reps,
      completedAt: now.toISOString(),
    };
    await db.sets.add(set);

    const { slots, counts } = await loggedCounts(db, slot.sessionId);
    const exerciseIndex = nextExerciseIndex(slots, counts, slot.order);
    await db.activeSession.update('active', {
      exerciseIndex,
      setIndex: counts[exerciseIndex] ?? 0,
      draftWeight: null,
      draftReps: null,
    });
    return set;
  });
}

export async function jumpToExercise(db: WorkoutDb, sessionId: string, exerciseIndex: number) {
  await db.transaction('rw', db.sets, db.sessionExercises, db.activeSession, async () => {
    const { counts } = await loggedCounts(db, sessionId);
    await db.activeSession.update('active', {
      exerciseIndex,
      setIndex: counts[exerciseIndex] ?? 0,
      draftWeight: null,
      draftReps: null,
    });
  });
}

/** Most recent weight logged for an exercise id, in any session. */
export async function lastWeightFor(db: WorkoutDb, exerciseId: string): Promise<number | null> {
  const last = await db.sets
    .where('[exerciseId+completedAt]')
    .between([exerciseId, Dexie.minKey], [exerciseId, Dexie.maxKey])
    .last();
  return last?.weight ?? null;
}

/** Sets from the most recent finished session of an exercise, for default reps. */
export async function lastTimeSets(db: WorkoutDb, exerciseId: string) {
  const history = await exerciseHistory(db, exerciseId);
  const latest = history.sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))[0];
  return latest?.sets ?? [];
}
