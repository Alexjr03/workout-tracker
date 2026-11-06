import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveCardio } from '../../../db/repos/cardio';
import { startSession } from '../../../db/repos/sessions';
import { completeSet } from '../../../db/repos/sets';
import { db } from '../../../db/schema';
import { resetDb } from '../../../test/db';
import {
  backupFilename,
  BACKUP_SCHEMA_VERSION,
  buildBackup,
  exportBackup,
  shareOrDownload,
} from './exportData';

const NOW = new Date(2026, 10, 23, 21, 15);

beforeEach(async () => {
  await resetDb();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('buildBackup', () => {
  it('contains every table, the schema version and the export time', async () => {
    const id = await startSession(db, 'upper-a', NOW);
    const [bench] = await db.sessionExercises.where('sessionId').equals(id).sortBy('order');
    if (!bench) throw new Error('fixture');
    await completeSet(db, { slot: bench, weight: 10, reps: 10, now: NOW });
    await db.bodyWeight.put({ date: '2026-11-23', kg: 87.4 });
    await db.food.put({
      id: 'f1',
      date: '2026-11-23',
      kcal: 450,
      proteinG: null,
      createdAt: NOW.toISOString(),
    });

    const backup = await buildBackup(db, NOW);
    expect(backup).toMatchObject({
      app: 'workout-tracker',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: NOW.toISOString(),
    });
    expect(Object.keys(backup.data).sort()).toEqual(
      [
        'activeSession',
        'bodyWeight',
        'cardio',
        'exercises',
        'food',
        'routine',
        'savedFoods',
        'sessionExercises',
        'sessions',
        'sets',
        'settings',
      ].sort(),
    );
    expect(backup.data.sets).toHaveLength(1);
    expect(backup.data.exercises).toHaveLength(21);
    expect(backup.data.bodyWeight).toEqual([{ date: '2026-11-23', kg: 87.4 }]);
    expect(backup.data.settings[0]?.calorieMax).toBe(1500);
    // Survives JSON unchanged.
    expect(JSON.parse(JSON.stringify(backup))).toEqual(backup);
  });

  it('includes cardio logs', async () => {
    const id = await startSession(db, 'cardio', NOW);
    await saveCardio(db, id, { machine: 'StairMaster', durationMin: 30, notes: '' }, NOW);
    expect((await buildBackup(db, NOW)).data.cardio).toHaveLength(1);
  });
});

describe('backupFilename', () => {
  it('uses the local date', () => {
    expect(backupFilename(new Date(2026, 10, 23, 23, 59))).toBe('workout-backup-2026-11-23.json');
  });
});

describe('shareOrDownload', () => {
  const file = () =>
    new File(['{}'], 'workout-backup-2026-11-23.json', { type: 'application/json' });

  it('uses the Share Sheet when files can be shared', async () => {
    const share = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { canShare: () => true, share });
    expect(await shareOrDownload(file())).toBe('shared');
    expect(share).toHaveBeenCalledWith({
      files: [expect.objectContaining({ name: 'workout-backup-2026-11-23.json' })],
      title: 'Workout backup',
    });
  });

  it('reports a cancelled share', async () => {
    const abort = new DOMException('cancelled', 'AbortError');
    vi.stubGlobal('navigator', { canShare: () => true, share: () => Promise.reject(abort) });
    expect(await shareOrDownload(file())).toBe('cancelled');
  });

  it('falls back to a download when sharing fails for another reason', async () => {
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: () => Promise.reject(new DOMException('no', 'NotAllowedError')),
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: vi.fn() });
    expect(await shareOrDownload(file())).toBe('downloaded');
    expect(click).toHaveBeenCalledOnce();
  });

  it('downloads when the Share Sheet cannot take files', async () => {
    vi.stubGlobal('navigator', {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const revoke = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:x', revokeObjectURL: revoke });
    expect(await shareOrDownload(file())).toBe('downloaded');
    expect(click).toHaveBeenCalledOnce();
    expect(revoke).toHaveBeenCalledWith('blob:x');
  });
});

describe('exportBackup', () => {
  it('records the export time after a successful share', async () => {
    vi.stubGlobal('navigator', { canShare: () => true, share: () => Promise.resolve() });
    expect(await exportBackup(db, NOW)).toBe('shared');
    expect((await db.settings.get('settings'))?.lastExportAt).toBe(NOW.toISOString());
  });

  it('leaves the export time alone when the share is cancelled', async () => {
    const abort = new DOMException('cancelled', 'AbortError');
    vi.stubGlobal('navigator', { canShare: () => true, share: () => Promise.reject(abort) });
    expect(await exportBackup(db, NOW)).toBe('cancelled');
    expect((await db.settings.get('settings'))?.lastExportAt).toBeNull();
  });

  it('shares a JSON file that parses back to the backup', async () => {
    let shared: File | undefined;
    vi.stubGlobal('navigator', {
      canShare: () => true,
      share: (data: { files: File[] }) => {
        shared = data.files[0];
        return Promise.resolve();
      },
    });
    await exportBackup(db, NOW);
    expect(shared?.type).toBe('application/json');
    const parsed = JSON.parse((await shared?.text()) ?? '');
    expect(parsed.app).toBe('workout-tracker');
    expect(parsed.data.routine[0].schedule.monday).toBe('upper-a');
  });
});
