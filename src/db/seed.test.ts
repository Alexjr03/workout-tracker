import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDb, type WorkoutDb } from './schema';
import { ensureSeeded } from './seed';

let db: WorkoutDb;
let n = 0;

beforeEach(() => {
  db = createDb(`seed-test-${n++}`);
});

afterEach(async () => {
  await db.delete();
  vi.unstubAllGlobals();
});

const NOV_3 = new Date(2026, 10, 3, 9, 30);

describe('ensureSeeded', () => {
  it('writes settings, routine and the exercise catalog on first run', async () => {
    const result = await ensureSeeded(db, NOV_3);
    expect(result.seeded).toBe(true);

    const settings = await db.settings.get('settings');
    expect(settings).toMatchObject({
      units: { liftWeight: 'lb', bodyWeight: 'kg' },
      rampUpWeeks: 2,
      restSeconds: { compound: 150, isolation: 75 },
      calorieMax: 1500,
      goalWeightKg: 70,
      startingWeightKg: 88,
      programStartDate: '2026-11-03',
      proteinTargetG: null,
      lastExportAt: null,
    });

    const routine = await db.routine.get('routine');
    expect(routine?.schedule.monday).toBe('upper-a');
    expect(routine?.startingLoads['bench-press']?.value).toBe(10);
    expect(Object.keys(routine?.sessions ?? {})).toEqual([
      'upper-a',
      'legs',
      'upper-b',
      'cardio',
      'shoulders-arms',
    ]);

    expect(await db.exercises.count()).toBe(21);
    expect(await db.exercises.get('bench-press')).toEqual({
      id: 'bench-press',
      name: 'Bench press',
      type: 'compound',
      loadBasis: 'per-side',
      increment: 2.5,
      isCustom: false,
      muscle: 'chest',
      unit: 'lb',
    });
    expect(await db.exercises.get('db-curl')).toMatchObject({ unit: 'kg', increment: 2 });
    expect(await db.exercises.get('assisted-pull-up')).toMatchObject({ loadBasis: 'assistance' });
  });

  it('never seeds twice, even with a later date', async () => {
    await ensureSeeded(db, NOV_3);
    await db.settings.update('settings', { calorieMax: 1800 });

    const second = await ensureSeeded(db, new Date(2026, 11, 1));
    expect(second.seeded).toBe(false);
    const settings = await db.settings.get('settings');
    expect(settings?.calorieMax).toBe(1800);
    expect(settings?.programStartDate).toBe('2026-11-03');
  });

  it('asks the browser to persist storage', async () => {
    const persist = vi.fn(() => Promise.resolve(true));
    vi.stubGlobal('navigator', { storage: { persist } });
    const result = await ensureSeeded(db, NOV_3);
    expect(persist).toHaveBeenCalledOnce();
    expect(result.persisted).toBe(true);
  });

  it('still seeds when persistent storage is unavailable or refused', async () => {
    vi.stubGlobal('navigator', {});
    expect(await ensureSeeded(db, NOV_3)).toEqual({ seeded: true, persisted: false });

    const other = createDb(`seed-test-${n++}`);
    vi.stubGlobal('navigator', { storage: { persist: () => Promise.reject(new Error('nope')) } });
    expect(await ensureSeeded(other, NOV_3)).toEqual({ seeded: true, persisted: false });
    await other.delete();
  });
});
