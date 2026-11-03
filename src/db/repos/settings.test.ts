import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../test/db';
import { db } from '../schema';
import { swapExercise } from './exercises';
import { finishSession, startSession } from './sessions';
import { completeSet } from './sets';
import { resetToSeed, SettingsError, updateSettings } from './settings';

beforeEach(async () => {
  await resetDb();
});

const settings = async () => {
  const s = await db.settings.get('settings');
  if (!s) throw new Error('not seeded');
  return s;
};

describe('updateSettings', () => {
  it('saves valid changes', async () => {
    await updateSettings(db, {
      restSeconds: { compound: 180, isolation: 60 },
      calorieMax: 1600,
      proteinTargetG: 140,
      programStartDate: '2026-11-10',
      rampUpWeeks: 3,
      goalWeightKg: 72,
      startingWeightKg: 87.5,
    });
    expect(await settings()).toMatchObject({
      restSeconds: { compound: 180, isolation: 60 },
      calorieMax: 1600,
      proteinTargetG: 140,
      programStartDate: '2026-11-10',
      rampUpWeeks: 3,
      goalWeightKg: 72,
      startingWeightKg: 87.5,
    });
  });

  it('stores a cleared protein target as null', async () => {
    await updateSettings(db, { proteinTargetG: 140 });
    await updateSettings(db, { proteinTargetG: null });
    expect((await settings()).proteinTargetG).toBeNull();
  });

  it.each([
    [{ restSeconds: { compound: 0, isolation: 75 } }, 'Rest times must be more than 0 seconds.'],
    [{ calorieMax: 0 }, 'Calorie maximum must be more than 0.'],
    [{ calorieMax: -5 }, 'Calorie maximum must be more than 0.'],
    [{ proteinTargetG: 0 }, 'Protein target must be more than 0, or blank.'],
    [{ rampUpWeeks: -1 }, 'Ramp-up weeks must be a whole number, 0 or more.'],
    [{ rampUpWeeks: 1.5 }, 'Ramp-up weeks must be a whole number, 0 or more.'],
    [{ goalWeightKg: 0 }, 'Weights must be more than 0 kg.'],
    [{ startingWeightKg: 0 }, 'Weights must be more than 0 kg.'],
    [{ programStartDate: '2026-02-30' }, 'Program start date is not a valid date.'],
  ])('rejects %o', async (patch, message) => {
    const before = await settings();
    await expect(updateSettings(db, patch)).rejects.toThrow(new SettingsError(message));
    expect(await settings()).toEqual(before);
  });
});

describe('resetToSeed', () => {
  it('restores settings, routine and seed exercises but keeps logs and custom exercises', async () => {
    const id = await startSession(db, 'legs', new Date(2026, 10, 24, 18));
    const slots = await db.sessionExercises.where('sessionId').equals(id).sortBy('order');
    const legPress = slots.find((s) => s.exerciseId === 'leg-press');
    if (!legPress) throw new Error('fixture');
    await swapExercise(db, legPress.id, { newName: 'Hack squat' });
    const swapped = await db.sessionExercises.get(legPress.id);
    if (!swapped) throw new Error('fixture');
    await completeSet(db, { slot: swapped, weight: 90, reps: 10 });
    await finishSession(db, id);

    await updateSettings(db, { calorieMax: 2000, programStartDate: '2026-11-10' });
    await db.settings.update('settings', { lastExportAt: '2026-11-20T10:00:00.000Z' });
    await db.exercises.update('bench-press', { increment: 5 });
    const routine = await db.routine.get('routine');
    if (!routine) throw new Error('fixture');
    await db.routine.update('routine', { schedule: { ...routine.schedule, thursday: 'rest' } });

    await resetToSeed(db);

    expect(await settings()).toMatchObject({
      calorieMax: 1500,
      programStartDate: '2026-11-10', // kept: it's when you started, not routine data
      lastExportAt: '2026-11-20T10:00:00.000Z', // kept
    });
    expect((await db.routine.get('routine'))?.schedule.thursday).toBe('cardio');
    expect((await db.exercises.get('bench-press'))?.increment).toBe(2.5);
    expect(await db.exercises.get('hack-squat')).toMatchObject({ isCustom: true });
    expect(await db.sets.count()).toBe(1);
    expect(await db.sessions.count()).toBe(1);
  });
});
