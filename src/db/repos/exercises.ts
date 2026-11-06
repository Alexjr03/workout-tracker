import { progressionSuggestion } from '../../domain/progression';
import { uniqueSlug } from '../../domain/slug';
import type { WorkoutDb } from '../schema';
import type { ExerciseDef, Muscle } from '../types';
import { exerciseHistory } from './sessions';

export class SwapNotAllowedError extends Error {
  constructor() {
    super('Sets are already logged for this exercise');
    this.name = 'SwapNotAllowedError';
  }
}

/** A catalog exercise, or a new one (muscle group defaults to the original's). */
export type SwapTarget = { exerciseId: string } | { newName: string; muscle?: Muscle | null };

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
        muscle: target.muscle === undefined ? (originalDef?.muscle ?? null) : target.muscle,
        unit: originalDef?.unit ?? 'lb',
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

/**
 * Catalog exercises to swap to, without the current one: `recommended` train the same muscle
 * group as the slot's original exercise; `others` are the rest, same type first. Each by name.
 */
export async function swapOptions(
  db: WorkoutDb,
  slotId: string,
): Promise<{ recommended: ExerciseDef[]; others: ExerciseDef[] }> {
  const slot = await db.sessionExercises.get(slotId);
  if (!slot) return { recommended: [], others: [] };
  const originalDef = await db.exercises.get(slot.replacesExerciseId ?? slot.exerciseId);
  const all = (await db.exercises.toArray()).filter((e) => e.id !== slot.exerciseId);
  all.sort((a, b) => a.name.localeCompare(b.name));
  const muscle = originalDef?.muscle ?? null;
  const same = (e: ExerciseDef) => muscle !== null && e.muscle === muscle;
  const rest = all.filter((e) => !same(e));
  return {
    recommended: all.filter(same),
    others: [
      ...rest.filter((e) => e.type === originalDef?.type),
      ...rest.filter((e) => e.type !== originalDef?.type),
    ],
  };
}
