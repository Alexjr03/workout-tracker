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
