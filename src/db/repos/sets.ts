import { Dexie } from 'dexie';
import { nextExerciseIndex, requiredSets, targetSets } from '../../domain/session';
import { restEndsAt } from '../../domain/timer';
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

/** Exercise index after a change, aiming at each slot's target (skipped optional sets excluded). */
async function advance(db: WorkoutDb, sessionId: string, from: number) {
  const { slots, counts } = await loggedCounts(db, sessionId);
  const targets = slots.map((s) => ({ prescribedSets: targetSets(s) }));
  const exerciseIndex = nextExerciseIndex(targets, counts, from);
  return { exerciseIndex, setIndex: counts[exerciseIndex] ?? 0 };
}

/**
 * Saves one completed set, advances the active-session pointer and starts the rest timer for
 * the exercise's type, all in one transaction. Callers await this before the UI moves on, so
 * a closed app never loses a tapped set.
 */
export async function completeSet(
  db: WorkoutDb,
  input: { slot: SessionExerciseLog; weight: number; reps: number; now?: Date },
): Promise<SetLog> {
  const { slot, weight, reps, now = new Date() } = input;
  const tables = [db.sets, db.sessionExercises, db.activeSession, db.settings, db.exercises];
  return db.transaction('rw', tables, async () => {
    // A swapped-in exercise keeps the rest time of the one it replaces.
    const [settings, def] = await Promise.all([
      db.settings.get('settings'),
      db.exercises.get(slot.replacesExerciseId ?? slot.exerciseId),
    ]);
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

    await db.activeSession.update('active', {
      ...(await advance(db, slot.sessionId, slot.order)),
      draftWeight: null,
      draftReps: null,
      restEndsAt:
        settings && def ? restEndsAt(def.type, settings.restSeconds, now.getTime()) : null,
    });
    return set;
  });
}

/** Adjusted (±15 s) or skipped (null) rest timer. */
export async function setRestEndsAt(db: WorkoutDb, endsAt: string | null): Promise<void> {
  await db.activeSession.update('active', { restEndsAt: endsAt });
}

/**
 * Deletes the session's most recent set and points the runner back at it, with its values
 * pre-filled so it can be corrected. Returns the removed set, or null if none was logged.
 */
export async function undoLastSet(db: WorkoutDb, sessionId: string): Promise<SetLog | null> {
  return db.transaction('rw', db.sets, db.sessionExercises, db.activeSession, async () => {
    const sets = await db.sets.where('sessionId').equals(sessionId).sortBy('completedAt');
    const last = sets.at(-1);
    if (!last) return null;
    const slot = await db.sessionExercises.get(last.sessionExerciseId);
    await db.sets.delete(last.id);
    await db.activeSession.update('active', {
      exerciseIndex: slot?.order ?? 0,
      setIndex: last.setIndex,
      draftWeight: last.weight,
      draftReps: last.reps,
    });
    return last;
  });
}

export async function updateSet(
  db: WorkoutDb,
  setId: string,
  values: { weight: number; reps: number },
): Promise<void> {
  await db.sets.update(setId, values);
}

/**
 * Skips an exercise's optional ramp-up set (only once its required sets are done) and moves on.
 */
export async function skipOptionalSet(db: WorkoutDb, slotId: string): Promise<void> {
  await db.transaction('rw', db.sets, db.sessionExercises, db.activeSession, async () => {
    const slot = await db.sessionExercises.get(slotId);
    if (!slot) throw new Error(`Unknown session exercise ${slotId}`);
    const logged = await db.sets.where('sessionExerciseId').equals(slotId).count();
    if (slot.optionalSets === 0 || logged < requiredSets(slot)) {
      throw new Error('Only the optional last set can be skipped');
    }
    await db.sessionExercises.update(slotId, { optionalSkipped: true });
    await db.activeSession.update('active', {
      ...(await advance(db, slot.sessionId, slot.order)),
      draftWeight: null,
      draftReps: null,
    });
  });
}

/** Points the runner at an exercise. A skipped optional set becomes available again. */
export async function jumpToExercise(db: WorkoutDb, sessionId: string, exerciseIndex: number) {
  await db.transaction('rw', db.sets, db.sessionExercises, db.activeSession, async () => {
    const { slots, counts } = await loggedCounts(db, sessionId);
    const target = slots[exerciseIndex];
    if (target?.optionalSkipped) {
      await db.sessionExercises.update(target.id, { optionalSkipped: false });
    }
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
