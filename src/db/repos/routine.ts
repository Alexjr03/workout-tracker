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

export type ExercisePatch = Partial<
  Pick<ExerciseDef, 'name' | 'type' | 'loadBasis' | 'increment' | 'muscle'>
>;

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

type TemplateExerciseList = Extract<
  Routine['sessions'][string],
  { exercises: unknown }
>['exercises'];

function validateExercises(exercises: TemplateExerciseList) {
  if (exercises.length === 0) throw new RoutineError('A session needs at least one exercise.');
  for (const e of exercises) {
    if (!(Number.isInteger(e.sets) && e.sets >= 1))
      throw new RoutineError('Sets must be at least 1.');
    if (!(e.repMin >= 1 && e.repMax >= 1)) throw new RoutineError('Reps must be at least 1.');
    if (e.repMin > e.repMax) throw new RoutineError("Rep min can't be more than rep max.");
  }
}

/** Applies `edit` to a lifting template's exercise list after validating the result. */
async function editTemplate(
  db: WorkoutDb,
  templateId: string,
  edit: (exercises: TemplateExerciseList) => TemplateExerciseList | Promise<TemplateExerciseList>,
) {
  await db.transaction('rw', db.routine, db.exercises, async () => {
    const routine = await loadRoutine(db);
    const template = routine.sessions[templateId];
    if (!template) throw new RoutineError(`Unknown session ${templateId}.`);
    if (!('exercises' in template)) {
      throw new RoutineError('Cardio sessions have no exercises to edit.');
    }
    const exercises = await edit(template.exercises);
    validateExercises(exercises);
    await db.routine.update('routine', {
      sessions: { ...routine.sessions, [templateId]: { ...template, exercises } },
    });
  });
}

/** Sets and rep range for future sessions; started and finished sessions keep their snapshot. */
export function updateTemplateExercise(
  db: WorkoutDb,
  templateId: string,
  index: number,
  patch: { sets?: number; repMin?: number; repMax?: number },
) {
  return editTemplate(db, templateId, (exercises) =>
    exercises.map((e, i) => (i === index ? { ...e, ...patch } : e)),
  );
}

/** Moves an exercise one place up (-1) or down (+1); moves past either end do nothing. */
export function moveTemplateExercise(db: WorkoutDb, templateId: string, index: number, by: -1 | 1) {
  return editTemplate(db, templateId, (exercises) => {
    const to = index + by;
    const moving = exercises[index];
    if (!moving || to < 0 || to >= exercises.length) return exercises;
    const next = exercises.filter((_, i) => i !== index);
    next.splice(to, 0, moving);
    return next;
  });
}

/** Takes an exercise out of a session template. Its history and catalog entry stay. */
export function removeTemplateExercise(db: WorkoutDb, templateId: string, index: number) {
  return editTemplate(db, templateId, (exercises) => exercises.filter((_, i) => i !== index));
}

/** Adds a catalog exercise to the end of a template with 3 × 8–12. */
export function addTemplateExercise(db: WorkoutDb, templateId: string, exerciseId: string) {
  return editTemplate(db, templateId, async (exercises) => {
    const def = await db.exercises.get(exerciseId);
    if (!def) throw new RoutineError(`Unknown exercise ${exerciseId}.`);
    if (exercises.some((e) => e.id === exerciseId)) {
      throw new RoutineError(`${def.name} is already in this session.`);
    }
    return [
      ...exercises,
      { id: def.id, name: def.name, type: def.type, sets: 3, repMin: 8, repMax: 12 },
    ];
  });
}
