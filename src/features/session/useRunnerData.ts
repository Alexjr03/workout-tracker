import { useLiveQuery } from 'dexie-react-hooks';
import { lastTimeSets, lastWeightFor } from '../../db/repos/sets';
import { db } from '../../db/schema';
import type { ExerciseDef, SessionExerciseLog, SetLog } from '../../db/types';

export interface RunnerSlot {
  slot: SessionExerciseLog;
  def: ExerciseDef;
  /** Name of the exercise this one was swapped in for, if any. */
  replacesName: string | null;
  sets: SetLog[];
}

export interface RunnerData {
  sessionName: string;
  sessionId: string;
  slots: RunnerSlot[];
  exerciseIndex: number;
  /** Values typed for the current set before the app closed. */
  draft: { weight: number | null; reps: number | null };
  restEndsAt: string | null;
  /** Only for the current exercise: history used for its defaults. */
  current: {
    lastLoggedWeight: number | null;
    lastTimeSets: { setIndex: number; reps: number }[];
    startingLoad: number | null;
  } | null;
}

async function load(): Promise<RunnerData | null> {
  const active = await db.activeSession.get('active');
  if (!active) return null;
  const [session, slots, sets, routine] = await Promise.all([
    db.sessions.get(active.sessionId),
    db.sessionExercises.where('sessionId').equals(active.sessionId).sortBy('order'),
    db.sets.where('sessionId').equals(active.sessionId).sortBy('setIndex'),
    db.routine.get('routine'),
  ]);
  if (!session) return null;

  const [defs, originals] = await Promise.all([
    db.exercises.bulkGet(slots.map((s) => s.exerciseId)),
    db.exercises.bulkGet(slots.map((s) => s.replacesExerciseId ?? '')),
  ]);
  const runnerSlots = slots.map((slot, i) => {
    const def = defs[i];
    if (!def) throw new Error(`Exercise ${slot.exerciseId} is missing from the catalog`);
    return {
      slot,
      def,
      replacesName: originals[i]?.name ?? null,
      sets: sets.filter((s) => s.sessionExerciseId === slot.id),
    };
  });

  const currentSlot = runnerSlots[active.exerciseIndex];
  const current = currentSlot
    ? {
        lastLoggedWeight: await lastWeightFor(db, currentSlot.def.id),
        lastTimeSets: await lastTimeSets(db, currentSlot.def.id),
        startingLoad: routine?.startingLoads[currentSlot.def.id]?.value ?? null,
      }
    : null;

  return {
    sessionName: session.templateName,
    sessionId: session.id,
    slots: runnerSlots,
    exerciseIndex: active.exerciseIndex,
    draft: { weight: active.draftWeight, reps: active.draftReps },
    restEndsAt: active.restEndsAt,
    current,
  };
}

/** undefined while loading, null when no session is active. */
export function useRunnerData(): RunnerData | null | undefined {
  return useLiveQuery(load);
}
