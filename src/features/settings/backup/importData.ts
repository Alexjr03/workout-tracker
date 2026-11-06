import type { WorkoutDb } from '../../../db/schema';
import exerciseDefaultsJson from '../../../seed/exerciseDefaults.json';
import { exerciseDefaultsSchema } from '../../../seed/schemas';
import { BACKUP_SCHEMA_VERSION } from './exportData';
import { backupSchema, type ValidBackup } from './schemas';

const exerciseDefaults = exerciseDefaultsSchema.parse(exerciseDefaultsJson);

/** A backup that can't be imported; `message` is safe to show as is. */
export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

export interface BackupCounts {
  sessions: number;
  sets: number;
  cardio: number;
  bodyWeight: number;
  food: number;
}

type Raw = { app?: unknown; schemaVersion?: unknown; data?: Record<string, unknown> };

/** Older export shapes, upgraded one version at a time to the current one. */
const MIGRATIONS: Record<number, (raw: Raw) => void> = {
  // v1 → v2: session exercises gained the optional ramp-up set fields.
  1: (raw) => {
    const slots = raw.data?.sessionExercises;
    if (!Array.isArray(slots)) return;
    for (const slot of slots as Record<string, unknown>[]) {
      slot.optionalSets ??= 0;
      slot.optionalSkipped ??= false;
    }
  },
  // v2 → v3: exercises gained a muscle group (seed ones get theirs, custom ones none).
  2: (raw) => {
    const exercises = raw.data?.exercises;
    if (!Array.isArray(exercises)) return;
    for (const e of exercises as Record<string, unknown>[]) {
      e.muscle ??= exerciseDefaults[String(e.id)]?.muscle ?? null;
    }
  },
  // v3 → v4: unit per exercise, as in the database migration (numbers kept as typed).
  3: (raw) => {
    const exercises = raw.data?.exercises;
    if (!Array.isArray(exercises)) return;
    for (const e of exercises as Record<string, unknown>[]) {
      if (e.unit) continue;
      e.unit = e.loadBasis === 'per-dumbbell' ? 'kg' : 'lb';
      if (e.unit === 'kg' && e.increment === 5) e.increment = 2;
    }
  },
  // v4 → v5: saved foods table added; older backups have none.
  4: (raw) => {
    if (raw.data) raw.data.savedFoods ??= [];
  },
};

/** Reads and validates a backup file's text, upgrading older versions. Throws BackupError. */
export function parseBackup(text: string): { backup: ValidBackup; counts: BackupCounts } {
  let raw: Raw;
  try {
    raw = JSON.parse(text) as Raw;
  } catch {
    throw new BackupError('This file is not valid JSON.');
  }
  if (raw?.app !== 'workout-tracker') throw new BackupError('This file is not a Workout backup.');

  let version = Number(raw.schemaVersion);
  if (version > BACKUP_SCHEMA_VERSION) {
    throw new BackupError(
      'This backup was made by a newer version of the app. Update the app first.',
    );
  }
  for (; version < BACKUP_SCHEMA_VERSION; version++) MIGRATIONS[version]?.(raw);
  raw.schemaVersion = BACKUP_SCHEMA_VERSION;

  const result = backupSchema.safeParse(raw);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue?.path.join('.') ?? 'unknown';
    throw new BackupError(`The backup is damaged (${where}): ${issue?.message ?? 'invalid'}`);
  }
  const { data } = result.data;
  if (data.settings.length !== 1 || data.routine.length !== 1) {
    throw new BackupError('The backup has no routine or settings.');
  }
  return {
    backup: result.data,
    counts: {
      sessions: data.sessions.length,
      sets: data.sets.length,
      cardio: data.cardio.length,
      bodyWeight: data.bodyWeight.length,
      food: data.food.length,
    },
  };
}

/**
 * Replaces everything on the device with the backup, in one transaction: all or nothing.
 * The backup file itself is a backup, so "last backup" becomes its export time.
 */
export async function restoreBackup(db: WorkoutDb, backup: ValidBackup): Promise<void> {
  const { data } = backup;
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
    await db.settings.bulkAdd(
      data.settings.map((s) => ({ ...s, lastExportAt: backup.exportedAt })),
    );
    await db.routine.bulkAdd(data.routine);
    await db.exercises.bulkAdd(data.exercises);
    await db.sessions.bulkAdd(data.sessions);
    await db.sessionExercises.bulkAdd(data.sessionExercises);
    await db.sets.bulkAdd(data.sets);
    await db.cardio.bulkAdd(data.cardio);
    await db.bodyWeight.bulkAdd(data.bodyWeight);
    await db.food.bulkAdd(data.food);
    await db.savedFoods.bulkAdd(data.savedFoods);
    await db.activeSession.bulkAdd(data.activeSession);
  });
}
