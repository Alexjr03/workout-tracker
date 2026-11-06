import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../test/db';
import { db } from '../schema';
import {
  addFood,
  deleteFood,
  deleteSavedFood,
  listSavedFoods,
  logSavedFood,
  restoreFood,
  saveFood,
} from './food';

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

describe('saved foods', () => {
  const DAY = '2026-11-06';

  it('logs a copy of the food and lists the most used first', async () => {
    const oats = await saveFood(db, { name: ' Oats ', kcal: 380, proteinG: 13 });
    const apple = await saveFood(db, { name: 'Apple', kcal: 95, proteinG: null });
    const egg = await saveFood(db, { name: 'Egg', kcal: 70, proteinG: 6 });
    await logSavedFood(db, egg, DAY, { withProtein: true });
    await logSavedFood(db, oats, DAY, { withProtein: true });
    const entry = await logSavedFood(db, oats, DAY, { withProtein: false });
    expect(entry).toMatchObject({ date: DAY, kcal: 380, proteinG: null, name: 'Oats' });

    expect((await listSavedFoods(db)).map((f) => f.name)).toEqual(['Oats', 'Egg', 'Apple']);
    expect((await db.savedFoods.get(apple))?.uses).toBe(0);
    expect((await db.food.where('date').equals(DAY).toArray()).map((e) => e.proteinG)).toContain(6);
  });

  it('edits and deletes a food without touching logged entries', async () => {
    const id = await saveFood(db, { name: 'Oats', kcal: 380, proteinG: 13 });
    const entry = await logSavedFood(db, id, DAY, { withProtein: true });
    expect(await saveFood(db, { name: 'Oats', kcal: 400, proteinG: 14 }, id)).toBe(id);
    expect((await db.savedFoods.get(id))?.kcal).toBe(400);
    await deleteSavedFood(db, id);
    expect(await db.savedFoods.count()).toBe(0);
    expect(await db.food.get(entry.id)).toEqual(entry);
  });

  it('needs a name and calories, and an existing food to log', async () => {
    await expect(saveFood(db, { name: '  ', kcal: 100, proteinG: null })).rejects.toThrow(
      'Give the food a name',
    );
    await expect(saveFood(db, { name: 'Air', kcal: 0, proteinG: null })).rejects.toThrow(
      'Calories must be more than 0',
    );
    await expect(logSavedFood(db, 'missing', DAY, { withProtein: false })).rejects.toThrow(
      'Saved food not found',
    );
  });
});
