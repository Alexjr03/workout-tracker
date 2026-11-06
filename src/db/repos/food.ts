import type { LocalDate } from '../../domain/dates';
import type { WorkoutDb } from '../schema';
import type { FoodEntry } from '../types';

export async function addFood(
  db: WorkoutDb,
  input: { date: LocalDate; kcal: number; proteinG: number | null },
  now = new Date(),
): Promise<FoodEntry> {
  if (!(input.kcal > 0)) throw new Error('Calories must be more than 0');
  const entry: FoodEntry = { id: crypto.randomUUID(), ...input, createdAt: now.toISOString() };
  await db.food.add(entry);
  return entry;
}

/** Removes an entry and returns it, so it can be put back with `restoreFood`. */
export async function deleteFood(db: WorkoutDb, id: string): Promise<FoodEntry | undefined> {
  return db.transaction('rw', db.food, async () => {
    const entry = await db.food.get(id);
    await db.food.delete(id);
    return entry;
  });
}

export async function restoreFood(db: WorkoutDb, entry: FoodEntry): Promise<void> {
  await db.food.put(entry);
}
