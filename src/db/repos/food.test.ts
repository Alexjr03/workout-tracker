import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../test/db';
import { db } from '../schema';
import { addFood, deleteFood, restoreFood } from './food';

beforeEach(async () => {
  await resetDb();
});

describe('food repo', () => {
  it('adds, deletes and restores an entry', async () => {
    const entry = await addFood(db, { date: '2026-11-06', kcal: 450, proteinG: 30 });
    const removed = await deleteFood(db, entry.id);
    expect(removed).toEqual(entry);
    expect(await db.food.count()).toBe(0);
    if (removed) await restoreFood(db, removed);
    expect(await db.food.get(entry.id)).toEqual(entry);
  });

  it('rejects zero calories', async () => {
    await expect(addFood(db, { date: '2026-11-06', kcal: 0, proteinG: null })).rejects.toThrow(
      'Calories must be more than 0',
    );
  });
});
