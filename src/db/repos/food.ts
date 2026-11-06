import type { LocalDate } from '../../domain/dates';
import type { WorkoutDb } from '../schema';
import type { FoodEntry, SavedFood } from '../types';

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

export interface SavedFoodInput {
  name: string;
  kcal: number;
  proteinG: number | null;
}

function checkSavedFood(input: SavedFoodInput): SavedFoodInput {
  const name = input.name.trim();
  if (!name) throw new Error('Give the food a name');
  if (!(input.kcal > 0)) throw new Error('Calories must be more than 0');
  return { ...input, name };
}

/** Creates a saved food, or updates one when `id` is given. Logged entries are not touched. */
export async function saveFood(db: WorkoutDb, input: SavedFoodInput, id?: string): Promise<string> {
  const food = checkSavedFood(input);
  if (id) {
    await db.savedFoods.update(id, food);
    return id;
  }
  const newId = crypto.randomUUID();
  await db.savedFoods.add({ id: newId, ...food, uses: 0 });
  return newId;
}

export async function deleteSavedFood(db: WorkoutDb, id: string): Promise<void> {
  await db.savedFoods.delete(id);
}

/** Saved foods, most used first, then by name. */
export async function listSavedFoods(db: WorkoutDb): Promise<SavedFood[]> {
  const foods = await db.savedFoods.toArray();
  return foods.sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name));
}

/** Logs a saved food to `date`, copying its numbers so later edits don't change the entry. */
export async function logSavedFood(
  db: WorkoutDb,
  id: string,
  date: LocalDate,
  { withProtein }: { withProtein: boolean },
  now = new Date(),
): Promise<FoodEntry> {
  return db.transaction('rw', db.savedFoods, db.food, async () => {
    const food = await db.savedFoods.get(id);
    if (!food) throw new Error('Saved food not found');
    await db.savedFoods.update(id, { uses: food.uses + 1 });
    const entry: FoodEntry = {
      id: crypto.randomUUID(),
      date,
      kcal: food.kcal,
      proteinG: withProtein ? food.proteinG : null,
      createdAt: now.toISOString(),
      name: food.name,
    };
    await db.food.add(entry);
    return entry;
  });
}
