import { isLocalDate, type LocalDate } from '../../domain/dates';
import type { WorkoutDb } from '../schema';

/** One entry per day: saving a date again overwrites it. */
export async function saveBodyWeight(db: WorkoutDb, date: LocalDate, kg: number): Promise<void> {
  if (!isLocalDate(date)) throw new Error(`Invalid date ${date}`);
  if (!(kg > 0)) throw new Error('Weight must be more than 0 kg');
  await db.bodyWeight.put({ date, kg });
}

export async function deleteBodyWeight(db: WorkoutDb, date: LocalDate): Promise<void> {
  await db.bodyWeight.delete(date);
}
