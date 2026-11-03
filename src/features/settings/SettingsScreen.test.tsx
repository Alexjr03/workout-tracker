import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/schema';
import { resetDb } from '../../test/db';
import { buildBackup } from './backup/exportData';
import { SettingsScreen } from './SettingsScreen';

beforeEach(async () => {
  await resetDb();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SettingsScreen backup', () => {
  it('shows that no backup was made yet', async () => {
    render(<SettingsScreen />);
    expect(await screen.findByText('Last backup: never')).toBeInTheDocument();
  });

  it('exports through the Share Sheet and updates the last backup', async () => {
    const share = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { canShare: () => true, share });
    render(<SettingsScreen />);
    await userEvent.click(await screen.findByRole('button', { name: 'Export backup' }));

    expect(await screen.findByText('Backup exported.')).toBeInTheDocument();
    expect(share).toHaveBeenCalledOnce();
    expect(await screen.findByText('Last backup: today')).toBeInTheDocument();
    expect((await db.settings.get('settings'))?.lastExportAt).not.toBeNull();
  });

  it('shows an error when the export fails', async () => {
    vi.stubGlobal('navigator', {
      canShare: () => {
        throw new Error('Sharing unavailable');
      },
    });
    render(<SettingsScreen />);
    await userEvent.click(await screen.findByRole('button', { name: 'Export backup' }));
    expect(await screen.findByText('Export failed: Sharing unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export backup' })).toBeEnabled();
  });

  it('says so when the export is cancelled', async () => {
    const abort = new DOMException('cancelled', 'AbortError');
    vi.stubGlobal('navigator', { canShare: () => true, share: () => Promise.reject(abort) });
    render(<SettingsScreen />);
    await userEvent.click(await screen.findByRole('button', { name: 'Export backup' }));
    expect(await screen.findByText('Export cancelled.')).toBeInTheDocument();
    expect(screen.getByText('Last backup: never')).toBeInTheDocument();
  });
});

describe('SettingsScreen import', () => {
  /** A backup holding one body-weight entry, which is then removed from the device. */
  async function backupFile() {
    await db.bodyWeight.put({ date: '2026-11-20', kg: 87.9 });
    const json = JSON.stringify(await buildBackup(db));
    await db.bodyWeight.clear();
    return new File([json], 'workout-backup.json', { type: 'application/json' });
  }

  it('previews the backup, asks, then replaces everything', async () => {
    const file = await backupFile();
    render(<SettingsScreen />);
    await userEvent.upload(await screen.findByLabelText('Import backup'), file);

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('0 sessions, 0 sets, 0 cardio, 1 body weight, 0 food entries');
    expect(dialog).toHaveTextContent('Replace all data on this device?');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Replace all data' }));

    expect(await screen.findByText('Backup restored.')).toBeInTheDocument();
    expect(await db.bodyWeight.count()).toBe(1);
  });

  it('can be cancelled without changing anything', async () => {
    const file = await backupFile();
    render(<SettingsScreen />);
    await userEvent.upload(await screen.findByLabelText('Import backup'), file);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(await db.bodyWeight.count()).toBe(0);
  });

  it('explains a bad file and changes nothing', async () => {
    render(<SettingsScreen />);
    const bad = new File(['{"app":"other"}'], 'x.json', { type: 'application/json' });
    await userEvent.upload(await screen.findByLabelText('Import backup'), bad);
    expect(await screen.findByText('This file is not a Workout backup.')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
