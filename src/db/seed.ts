import { toLocalDate } from '../domain/dates';
import exerciseDefaultsJson from '../seed/exerciseDefaults.json';
import routineJson from '../seed/routine.json';
import { exerciseDefaultsSchema, routineSeedSchema } from '../seed/schemas';
import type { WorkoutDb } from './schema';
import type { ExerciseDef, Routine, Settings } from './types';

/** Settings, routine and catalog exactly as the seed files define them. */
export function buildSeed(now: Date) {
  const seed = routineSeedSchema.parse(routineJson);
  const defaults = exerciseDefaultsSchema.parse(exerciseDefaultsJson);

  const settings: Settings = {
    id: 'settings',
    ...seed.settings,
    proteinTargetG: null,
    programStartDate: toLocalDate(now),
    lastExportAt: null,
  };
  const routine: Routine = {
    id: 'routine',
    schedule: seed.schedule,
    sessions: seed.sessions,
    startingLoads: seed.startingLoads,
  };

  const exercises = new Map<string, ExerciseDef>();
  for (const session of Object.values(seed.sessions)) {
    if (!('exercises' in session)) continue;
    for (const e of session.exercises) {
      const d = defaults[e.id];
      if (!d) throw new Error(`exerciseDefaults.json has no entry for ${e.id}`);
      exercises.set(e.id, { id: e.id, name: e.name, type: e.type, ...d, isCustom: false });
    }
  }
  return { settings, routine, exercises: [...exercises.values()] };
}

async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  return navigator.storage.persist().then(
    (granted) => granted,
    () => false,
  );
}

/**
 * Writes the seed routine once, on first launch. Later launches leave every row alone;
 * only an explicit "Reset to seed" (T15) rewrites it.
 */
export async function ensureSeeded(
  db: WorkoutDb,
  now = new Date(),
): Promise<{ seeded: boolean; persisted: boolean }> {
  const seeded = await db.transaction('rw', db.settings, db.routine, db.exercises, async () => {
    if (await db.settings.get('settings')) return false;
    const { settings, routine, exercises } = buildSeed(now);
    await db.settings.put(settings);
    await db.routine.put(routine);
    await db.exercises.bulkPut(exercises);
    return true;
  });
  const persisted = seeded ? await requestPersistence() : false;
  return { seeded, persisted };
}
