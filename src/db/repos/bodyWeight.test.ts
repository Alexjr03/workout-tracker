import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../test/db';
import { db } from '../schema';
import { deleteBodyWeight, saveBodyWeight } from './bodyWeight';

beforeEach(async () => {
  await resetDb();
});

describe('body weight repo', () => {
  it('keeps one entry per day and deletes', async () => {
    await saveBodyWeight(db, '2026-11-06', 87.4);
    await saveBodyWeight(db, '2026-11-06', 87.1);
    expect(await db.bodyWeight.toArray()).toEqual([{ date: '2026-11-06', kg: 87.1 }]);
    await deleteBodyWeight(db, '2026-11-06');
    expect(await db.bodyWeight.count()).toBe(0);
  });

  it('rejects a bad date or weight', async () => {
    await expect(saveBodyWeight(db, '2026-02-30', 87)).rejects.toThrow('Invalid date');
    await expect(saveBodyWeight(db, '2026-11-06', 0)).rejects.toThrow('more than 0 kg');
    expect(await db.bodyWeight.count()).toBe(0);
  });
});
