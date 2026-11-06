import { beforeEach, describe, expect, it } from 'vitest';
import { saveCardio } from '../../../db/repos/cardio';
import { finishSession, startSession } from '../../../db/repos/sessions';
import { completeSet } from '../../../db/repos/sets';
import { db } from '../../../db/schema';
import { resetDb } from '../../../test/db';
import { BACKUP_SCHEMA_VERSION, buildBackup } from './exportData';
import { BackupError, parseBackup, restoreBackup } from './importData';

const NOW = new Date(2026, 10, 23, 18);

async function logSomething() {
  const id = await startSession(db, 'upper-a', NOW);
  const [bench] = await db.sessionExercises.where('sessionId').equals(id).sortBy('order');
  if (!bench) throw new Error('fixture');
  await completeSet(db, { slot: bench, weight: 10, reps: 10, now: NOW });
  await completeSet(db, { slot: bench, weight: 10, reps: 9, now: NOW });
  await finishSession(db, id, NOW);
  const cardio = await startSession(db, 'cardio', NOW);
  await saveCardio(db, cardio, { machine: 'StairMaster', durationMin: 35, notes: '' }, NOW);
  await db.bodyWeight.put({ date: '2026-11-23', kg: 87.2 });
  await db.food.put({
    id: 'f1',
    date: '2026-11-23',
    kcal: 600,
    proteinG: null,
    createdAt: NOW.toISOString(),
  });
  await db.savedFoods.put({ id: 'oats', name: 'Oats', kcal: 380, proteinG: 13, uses: 2 });
}

beforeEach(async () => {
  await resetDb();
});

describe('parseBackup', () => {
  it('accepts an export and counts what is in it', async () => {
    await logSomething();
    const text = JSON.stringify(await buildBackup(db, NOW));
    const { backup, counts } = parseBackup(text);
    expect(backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(counts).toEqual({ sessions: 2, sets: 2, cardio: 1, bodyWeight: 1, food: 1 });
  });

  it('upgrades a version 1 backup made before optional ramp-up sets', async () => {
    await logSomething();
    const v1 = await buildBackup(db, NOW);
    const raw = JSON.parse(JSON.stringify(v1));
    raw.schemaVersion = 1;
    for (const slot of raw.data.sessionExercises) {
      delete slot.optionalSets;
      delete slot.optionalSkipped;
    }
    const { backup } = parseBackup(JSON.stringify(raw));
    expect(backup.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(
      backup.data.sessionExercises.every((s) => s.optionalSets === 0 && !s.optionalSkipped),
    ).toBe(true);
  });

  it('upgrades a version 3 backup made before per-exercise units, keeping numbers', async () => {
    await logSomething();
    const raw = JSON.parse(JSON.stringify(await buildBackup(db, NOW)));
    raw.schemaVersion = 3;
    for (const e of raw.data.exercises) {
      delete e.unit;
      if (e.loadBasis === 'per-dumbbell') e.increment = 5;
    }
    const before = raw.data.sets.map((s: { weight: number }) => s.weight);
    const { backup } = parseBackup(JSON.stringify(raw));
    const ex = (id: string) => backup.data.exercises.find((e) => e.id === id);
    expect(ex('db-curl')).toMatchObject({ unit: 'kg', increment: 2 });
    expect(ex('bench-press')).toMatchObject({ unit: 'lb', increment: 2.5 });
    expect(backup.data.sets.map((s) => s.weight)).toEqual(before);
  });

  it('upgrades a version 2 backup made before muscle groups', async () => {
    const raw = JSON.parse(JSON.stringify(await buildBackup(db, NOW)));
    raw.schemaVersion = 2;
    raw.data.exercises.push({
      id: 'hack-squat',
      name: 'Hack squat',
      type: 'compound',
      loadBasis: 'total',
      increment: 5,
      isCustom: true,
    });
    for (const e of raw.data.exercises) delete e.muscle;
    const { backup } = parseBackup(JSON.stringify(raw));
    const muscleOf = (id: string) => backup.data.exercises.find((e) => e.id === id)?.muscle;
    expect(muscleOf('leg-press')).toBe('quads');
    expect(muscleOf('hack-squat')).toBeNull();
  });

  it('upgrades a version 4 backup made before saved foods', async () => {
    await logSomething();
    const raw = JSON.parse(JSON.stringify(await buildBackup(db, NOW)));
    raw.schemaVersion = 4;
    delete raw.data.savedFoods;
    const { backup } = parseBackup(JSON.stringify(raw));
    expect(backup.data.savedFoods).toEqual([]);
    expect(backup.data.food).toHaveLength(1);
  });

  it.each([
    ['not JSON', '{oops', 'This file is not valid JSON.'],
    [
      'another app',
      JSON.stringify({ app: 'other', schemaVersion: 1, data: {} }),
      'This file is not a Workout backup.',
    ],
    [
      'a newer version',
      JSON.stringify({ app: 'workout-tracker', schemaVersion: 99, exportedAt: '', data: {} }),
      'This backup was made by a newer version of the app. Update the app first.',
    ],
  ])('rejects %s', (_label, text, message) => {
    expect(() => parseBackup(text)).toThrow(new BackupError(message));
  });

  it('rejects damaged data and says where', async () => {
    const raw = JSON.parse(JSON.stringify(await buildBackup(db, NOW)));
    raw.data.settings[0].calorieMax = 'lots';
    expect(() => parseBackup(JSON.stringify(raw))).toThrow(
      /^The backup is damaged \(data\.settings\.0\.calorieMax\)/,
    );
  });

  it('rejects a backup without settings or routine', async () => {
    const raw = JSON.parse(JSON.stringify(await buildBackup(db, NOW)));
    raw.data.routine = [];
    expect(() => parseBackup(JSON.stringify(raw))).toThrow(
      'The backup has no routine or settings.',
    );
  });
});

describe('restoreBackup', () => {
  it('round-trips: export → wipe → import gives identical data', async () => {
    await logSomething();
    const before = await buildBackup(db, NOW);
    const { backup } = parseBackup(JSON.stringify(before));

    await db.delete();
    await db.open();
    await restoreBackup(db, backup);

    const after = await buildBackup(db, NOW);
    // The only change: the restored file now counts as the last backup.
    expect(after.data.settings[0]?.lastExportAt).toBe(before.exportedAt);
    const withoutLastExport = (b: typeof before) => ({
      ...b,
      data: { ...b.data, settings: b.data.settings.map((s) => ({ ...s, lastExportAt: null })) },
    });
    expect(withoutLastExport(after)).toEqual(withoutLastExport(before));
  });

  it('replaces data that is on the device', async () => {
    const { backup } = parseBackup(JSON.stringify(await buildBackup(db, NOW)));
    await logSomething();
    await restoreBackup(db, backup);
    expect(await db.sessions.count()).toBe(0);
    expect(await db.bodyWeight.count()).toBe(0);
  });

  it('changes nothing when a write fails', async () => {
    await logSomething();
    const before = await buildBackup(db, NOW);
    const { backup } = parseBackup(JSON.stringify(before));
    // Two sets with the same id make the bulk insert fail halfway.
    const dup = backup.data.sets[0];
    if (!dup) throw new Error('fixture');
    backup.data.sets.push({ ...dup });

    await expect(restoreBackup(db, backup)).rejects.toThrow();
    expect(await buildBackup(db, NOW)).toEqual(before);
  });
});
