import type { WorkoutDb } from '../../../db/schema';
import { toLocalDate } from '../../../domain/dates';

/**
 * Bump with every change to the export shape and add a migration in importData.ts.
 * v2: optional ramp-up sets. v3: exercise muscle groups. v4: unit per exercise.
 */
export const BACKUP_SCHEMA_VERSION = 4;

export async function buildBackup(db: WorkoutDb, now = new Date()) {
  return db.transaction('r', db.tables, async () => ({
    app: 'workout-tracker' as const,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    data: {
      settings: await db.settings.toArray(),
      routine: await db.routine.toArray(),
      exercises: await db.exercises.toArray(),
      sessions: await db.sessions.toArray(),
      sessionExercises: await db.sessionExercises.toArray(),
      sets: await db.sets.toArray(),
      cardio: await db.cardio.toArray(),
      bodyWeight: await db.bodyWeight.toArray(),
      food: await db.food.toArray(),
      activeSession: await db.activeSession.toArray(),
    },
  }));
}

export type Backup = Awaited<ReturnType<typeof buildBackup>>;

export function backupFilename(now: Date): string {
  return `workout-backup-${toLocalDate(now)}.json`;
}

export type ExportResult = 'shared' | 'downloaded' | 'cancelled';

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}

/** iOS Share Sheet (Save to Files, AirDrop…) where it takes files, else a download link. */
export async function shareOrDownload(file: File): Promise<ExportResult> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Workout backup' });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Share failed for another reason: fall through to a plain download.
    }
  }
  download(file);
  return 'downloaded';
}

/** Exports every table as JSON and records when, unless the user cancelled. */
export async function exportBackup(db: WorkoutDb, now = new Date()): Promise<ExportResult> {
  const backup = await buildBackup(db, now);
  const file = new File([JSON.stringify(backup, null, 2)], backupFilename(now), {
    type: 'application/json',
  });
  const result = await shareOrDownload(file);
  if (result !== 'cancelled') {
    await db.settings.update('settings', { lastExportAt: now.toISOString() });
  }
  return result;
}
