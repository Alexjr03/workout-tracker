import { db } from '../db/schema';
import { ensureSeeded } from '../db/seed';

/** Fresh, seeded app database with the program starting on `programStart`. */
export async function resetDb(programStart = new Date(2026, 10, 3, 9)) {
  await db.delete();
  await db.open();
  await ensureSeeded(db, programStart);
  return db;
}
