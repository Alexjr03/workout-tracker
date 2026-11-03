import type { Weekday } from '../../domain/dates';
import type { WorkoutDb } from '../schema';
import type { ExerciseDef, Routine } from '../types';

/** An invalid routine edit; `message` is safe to show as is. */
export class RoutineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RoutineError';
  }
}

async function loadRoutine(db: WorkoutDb): Promise<Routine> {
  const routine = await db.routine.get('routine');
  if (!routine) throw new Error('App data is not seeded');
  return routine;
}

/** Which session a weekday shows (or 'rest'). Affects future days only. */
export async function setScheduleDay(db: WorkoutDb, day: Weekday, sessionId: string) {
  await db.transaction('rw', db.routine, async () => {
    const routine = await loadRoutine(db);
    if (sessionId !== 'rest' && !(sessionId in routine.sessions)) {
      throw new RoutineError(`Unknown session ${sessionId}.`);
    }
    await db.routine.update('routine', { schedule: { ...routine.schedule, [day]: sessionId } });
  });
}

export type ExercisePatch = Partial<Pick<ExerciseDef, 'name' | 'type' | 'loadBasis' | 'increment'>>;

/**
 * Edits a catalog exercise, and the templates that use it so names and types agree.
 * Logged sets and session snapshots are never touched.
 */
export async function updateExercise(db: WorkoutDb, exerciseId: string, patch: ExercisePatch) {
  const name = patch.name?.trim();
  if (patch.name !== undefined && !name) throw new RoutineError('Name is required.');
  if (patch.increment !== undefined && !(patch.increment > 0)) {
    throw new RoutineError('Increment must be more than 0 lb.');
  }
  const clean: ExercisePatch = { ...patch, ...(name !== undefined && { name }) };

  await db.transaction('rw', db.exercises, db.routine, async () => {
    if (!(await db.exercises.get(exerciseId))) {
      throw new RoutineError(`Unknown exercise ${exerciseId}.`);
    }
    await db.exercises.update(exerciseId, clean);

    if (clean.name === undefined && clean.type === undefined) return;
    const routine = await loadRoutine(db);
    const sessions = Object.fromEntries(
      Object.entries(routine.sessions).map(([id, template]) => [
        id,
        'exercises' in template
          ? {
              ...template,
              exercises: template.exercises.map((e) =>
                e.id === exerciseId
                  ? { ...e, name: clean.name ?? e.name, type: clean.type ?? e.type }
                  : e,
              ),
            }
          : template,
      ]),
    );
    await db.routine.update('routine', { sessions });
  });
}
