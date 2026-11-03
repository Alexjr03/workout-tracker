import { fireEvent, render, screen, within } from '@testing-library/react';
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

describe('SettingsScreen fields', () => {
  const field = (name: string) => screen.getByRole('textbox', { name });
  const stored = async () => (await db.settings.get('settings')) ?? null;

  it('shows the current values', async () => {
    render(<SettingsScreen />);
    expect(await screen.findByLabelText('Program start date')).toHaveValue('2026-11-03');
    expect(field('Ramp-up weeks')).toHaveValue('2');
    expect(field('Compound rest')).toHaveValue('150');
    expect(field('Isolation rest')).toHaveValue('75');
    expect(field('Calorie max')).toHaveValue('1500');
    expect(field('Protein target')).toHaveValue('');
    expect(field('Starting weight')).toHaveValue('88');
    expect(field('Goal weight')).toHaveValue('70');
  });

  it('saves stepper changes straight away', async () => {
    render(<SettingsScreen />);
    await userEvent.click(await screen.findByRole('button', { name: 'Increase Compound rest' }));
    await userEvent.click(screen.getByRole('button', { name: 'Decrease Calorie max' }));
    await vi.waitFor(async () =>
      expect(await stored()).toMatchObject({
        restSeconds: { compound: 165, isolation: 75 },
        calorieMax: 1450,
      }),
    );
  });

  it('sets and clears the protein target', async () => {
    render(<SettingsScreen />);
    await userEvent.type(await screen.findByRole('textbox', { name: 'Protein target' }), '140');
    await vi.waitFor(async () => expect((await stored())?.proteinTargetG).toBe(140));
    await userEvent.clear(field('Protein target'));
    await vi.waitFor(async () => expect((await stored())?.proteinTargetG).toBeNull());
  });

  it('shows an error for an invalid value and keeps the saved one', async () => {
    render(<SettingsScreen />);
    const calories = await screen.findByRole('textbox', { name: 'Calorie max' });
    await userEvent.clear(calories);
    await userEvent.type(calories, '0');
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Calorie maximum must be more than 0.',
    );
    expect((await stored())?.calorieMax).toBe(1500);
  });

  it('changes the program start date', async () => {
    render(<SettingsScreen />);
    const date = await screen.findByLabelText('Program start date');
    // The iOS date picker sets the whole value at once.
    fireEvent.change(date, { target: { value: '2026-11-20' } });
    await vi.waitFor(async () => expect((await stored())?.programStartDate).toBe('2026-11-20'));
  });

  it('resets to the seed only after typing RESET', async () => {
    await db.settings.update('settings', { calorieMax: 2200 });
    render(<SettingsScreen />);
    await userEvent.click(await screen.findByRole('button', { name: 'Reset routine to defaults' }));
    const dialog = screen.getByRole('alertdialog');
    const confirm = within(dialog).getByRole('button', { name: 'Reset' });
    expect(confirm).toBeDisabled();
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Type RESET to confirm' }),
      'RESET',
    );
    await userEvent.click(confirm);

    expect(
      await screen.findByText('Routine and settings reset. Your logs are untouched.'),
    ).toBeInTheDocument();
    expect((await stored())?.calorieMax).toBe(1500);
  });

  it('can cancel a reset', async () => {
    await db.settings.update('settings', { calorieMax: 2200 });
    render(<SettingsScreen />);
    await userEvent.click(await screen.findByRole('button', { name: 'Reset routine to defaults' }));
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect((await stored())?.calorieMax).toBe(2200);
  });
});
