import { isLocalDate, toLocalDate } from '../../domain/dates';
import { canPushBack, sessionForDate, weekStart } from '../../domain/schedule';
import type { WorkoutDb } from '../schema';
import { buildSeed } from '../seed';
import type { Settings } from '../types';

/** An invalid settings value; `message` is safe to show as is. */
export class SettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SettingsError';
  }
}

export type SettingsPatch = Partial<Omit<Settings, 'id' | 'units' | 'lastExportAt'>>;

function validate(p: SettingsPatch) {
  if (p.restSeconds && !(p.restSeconds.compound > 0 && p.restSeconds.isolation > 0)) {
    throw new SettingsError('Rest times must be more than 0 seconds.');
  }
  if (p.calorieMax !== undefined && !(p.calorieMax > 0)) {
    throw new SettingsError('Calorie maximum must be more than 0.');
  }
  if (p.proteinTargetG !== undefined && p.proteinTargetG !== null && !(p.proteinTargetG > 0)) {
    throw new SettingsError('Protein target must be more than 0, or blank.');
  }
  if (p.rampUpWeeks !== undefined && !(Number.isInteger(p.rampUpWeeks) && p.rampUpWeeks >= 0)) {
    throw new SettingsError('Ramp-up weeks must be a whole number, 0 or more.');
  }
  for (const kg of [p.goalWeightKg, p.startingWeightKg]) {
    if (kg !== undefined && !(kg > 0)) throw new SettingsError('Weights must be more than 0 kg.');
  }
  if (p.programStartDate !== undefined && !isLocalDate(p.programStartDate)) {
    throw new SettingsError('Program start date is not a valid date.');
  }
}

/** Saves a change to Settings after validating it; invalid values change nothing. */
export async function updateSettings(db: WorkoutDb, patch: SettingsPatch): Promise<void> {
  validate(patch);
  await db.settings.update('settings', patch);
}

/**
 * Puts settings, routine and the seed exercises back to the seed values. Logs, custom
 * (swap) exercises, the program start date and the last backup time are kept.
 */
export async function resetToSeed(db: WorkoutDb, now = new Date()): Promise<void> {
  const seed = buildSeed(now);
  await db.transaction('rw', db.settings, db.routine, db.exercises, async () => {
    const current = await db.settings.get('settings');
    await db.settings.put({
      ...seed.settings,
      programStartDate: current?.programStartDate ?? seed.settings.programStartDate,
      lastExportAt: current?.lastExportAt ?? null,
    });
    await db.routine.put(seed.routine);
    await db.exercises.bulkPut(seed.exercises);
  });
}

/**
 * "Can't train today": makes today a rest day and moves the rest of the week one day later,
 * using up a rest day. Push-backs from earlier weeks are dropped (the schedule resets Monday).
 */
export async function pushBackToday(db: WorkoutDb, now = new Date()): Promise<void> {
  const today = toLocalDate(now);
  await db.transaction('rw', db.settings, db.routine, db.sessions, async () => {
    const [settings, routine, sessionsToday] = await Promise.all([
      db.settings.get('settings'),
      db.routine.get('routine'),
      db.sessions.where('date').equals(today).toArray(),
    ]);
    if (!settings || !routine) throw new Error('App data is not seeded');
    if (sessionsToday.some((s) => s.status === 'active')) {
      throw new SettingsError('Finish or discard the session in progress first.');
    }
    if (sessionsToday.some((s) => s.status === 'finished')) {
      throw new SettingsError("You've already trained today.");
    }
    const thisWeek = (settings.pushBacks ?? []).filter((d) => weekStart(d) === weekStart(today));
    if (sessionForDate(today, routine, thisWeek) === 'rest') {
      throw new SettingsError('Today is already a rest day.');
    }
    if (!canPushBack(today, routine, thisWeek)) {
      throw new SettingsError('No rest day left to use this week.');
    }
    await db.settings.update('settings', { pushBacks: [...thisWeek, today] });
  });
}
