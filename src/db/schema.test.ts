import { Dexie } from 'dexie';
import { describe, expect, it } from 'vitest';
import { createDb } from './schema';

describe('schema migrations', () => {
  it('v2 backfills optional-set fields on existing session exercises', async () => {
    const name = 'migration-test';
    const v1 = new Dexie(name);
    v1.version(1).stores({ sessionExercises: 'id, sessionId, exerciseId' });
    await v1.table('sessionExercises').add({
      id: 'slot-1',
      sessionId: 's1',
      order: 0,
      exerciseId: 'bench-press',
      replacesExerciseId: null,
      prescribedSets: 2,
      repMin: 8,
      repMax: 10,
      rirTarget: '~3',
      suggestedWeight: null,
    });
    v1.close();

    const db = createDb(name);
    expect(await db.sessionExercises.get('slot-1')).toMatchObject({
      prescribedSets: 2,
      optionalSets: 0,
      optionalSkipped: false,
    });
    await db.delete();
  });
});

describe('schema v3', () => {
  it('fills muscle groups for seed exercises and null for custom ones', async () => {
    const name = 'migration-v3-test';
    const v2 = new Dexie(name);
    v2.version(2).stores({ exercises: 'id, isCustom' });
    await v2.table('exercises').bulkAdd([
      {
        id: 'leg-press',
        name: 'Leg press',
        type: 'compound',
        loadBasis: 'per-side',
        increment: 2.5,
        isCustom: false,
      },
      {
        id: 'hack-squat',
        name: 'Hack squat',
        type: 'compound',
        loadBasis: 'total',
        increment: 5,
        isCustom: true,
      },
    ]);
    v2.close();

    const db = createDb(name);
    expect(await db.exercises.get('leg-press')).toMatchObject({ muscle: 'quads' });
    expect(await db.exercises.get('hack-squat')).toMatchObject({ muscle: null });
    await db.delete();
  });
});

describe('schema v4', () => {
  it('relabels dumbbell exercises as kg without touching logged numbers', async () => {
    const name = 'migration-v4-test';
    const v3 = new Dexie(name);
    v3.version(3).stores({ exercises: 'id, isCustom', sets: 'id, sessionId' });
    await v3.table('exercises').bulkAdd([
      {
        id: 'db-curl',
        name: 'Dumbbell curl',
        type: 'isolation',
        loadBasis: 'per-dumbbell',
        increment: 5,
        isCustom: false,
        muscle: 'biceps',
      },
      {
        id: 'bench-press',
        name: 'Bench press',
        type: 'compound',
        loadBasis: 'per-side',
        increment: 2.5,
        isCustom: false,
        muscle: 'chest',
      },
      {
        id: 'my-db-row',
        name: 'DB row',
        type: 'compound',
        loadBasis: 'per-dumbbell',
        increment: 4,
        isCustom: true,
        muscle: 'back',
      },
    ]);
    await v3
      .table('sets')
      .add({ id: 's1', sessionId: 'x', exerciseId: 'db-curl', weight: 12, reps: 10 });
    v3.close();

    const db = createDb(name);
    expect(await db.exercises.get('db-curl')).toMatchObject({ unit: 'kg', increment: 2 });
    expect(await db.exercises.get('bench-press')).toMatchObject({ unit: 'lb', increment: 2.5 });
    // A step the owner set themselves is kept.
    expect(await db.exercises.get('my-db-row')).toMatchObject({ unit: 'kg', increment: 4 });
    expect((await db.sets.get('s1'))?.weight).toBe(12);
    await db.delete();
  });
});
