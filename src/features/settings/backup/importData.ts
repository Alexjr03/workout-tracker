import type { WorkoutDb } from '../../../db/schema';
import { BACKUP_SCHEMA_VERSION } from './exportData';
import { backupSchema, type ValidBackup } from './schemas';

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
    await db.activeSession.bulkAdd(data.activeSession);
  });
}
