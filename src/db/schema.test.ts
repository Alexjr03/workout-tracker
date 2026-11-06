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
