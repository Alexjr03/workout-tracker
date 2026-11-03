import { progressionSuggestion } from '../../domain/progression';
import { uniqueSlug } from '../../domain/slug';
import type { WorkoutDb } from '../schema';
import type { ExerciseDef } from '../types';
import { exerciseHistory } from './sessions';

export class SwapNotAllowedError extends Error {
  constructor() {
    super('Sets are already logged for this exercise');
    this.name = 'SwapNotAllowedError';
  }
}

export type SwapTarget = { exerciseId: string } | { newName: string };

/**
 * Replaces the exercise in one session slot. The template is untouched; the substitute logs
 * under its own id, so its history, default weight and progression stay separate. It keeps the
 * slot's sets and rep range. Only allowed before any set of the slot is logged.
 */
export async function swapExercise(db: WorkoutDb, slotId: string, target: SwapTarget) {
  const tables = [db.sessionExercises, db.exercises, db.sessions, db.sets, db.activeSession];
  await db.transaction('rw', tables, async () => {
    const slot = await db.sessionExercises.get(slotId);
    if (!slot) throw new Error(`Unknown session exercise ${slotId}`);
    if ((await db.sets.where('sessionExerciseId').equals(slotId).count()) > 0) {
      throw new SwapNotAllowedError();
    }
    const original = slot.replacesExerciseId ?? slot.exerciseId;

    let def: ExerciseDef | undefined;
    if ('newName' in target) {
      const name = target.newName.trim();
      if (!name) throw new Error('Exercise name is required');
      const originalDef = await db.exercises.get(original);
      def = {
        id: uniqueSlug(name, new Set(await db.exercises.toCollection().primaryKeys())),
        name,
        type: originalDef?.type ?? 'compound',
        loadBasis: 'total',
        increment: 5,
        isCustom: true,
      };
      await db.exercises.add(def);
    } else {
      def = await db.exercises.get(target.exerciseId);
      if (!def) throw new Error(`Unknown exercise ${target.exerciseId}`);
    }

    await db.sessionExercises.update(slotId, {
      exerciseId: def.id,
      replacesExerciseId: def.id === original ? null : original,
      suggestedWeight: progressionSuggestion(await exerciseHistory(db, def.id), def),
    });
    // Values typed for the old exercise don't apply to the new one.
    await db.activeSession.update('active', { draftWeight: null, draftReps: null });
  });
}

/** Catalog exercises to swap to: same type as the slot's original first, each group by name. */
export async function swapOptions(db: WorkoutDb, slotId: string): Promise<ExerciseDef[]> {
  const slot = await db.sessionExercises.get(slotId);
  if (!slot) return [];
  const originalDef = await db.exercises.get(slot.replacesExerciseId ?? slot.exerciseId);
  const all = await db.exercises.toArray();
  const byName = (a: ExerciseDef, b: ExerciseDef) => a.name.localeCompare(b.name);
  const others = all.filter((e) => e.id !== slot.exerciseId);
  return [
    ...others.filter((e) => e.type === originalDef?.type).sort(byName),
    ...others.filter((e) => e.type !== originalDef?.type).sort(byName),
  ];
}
