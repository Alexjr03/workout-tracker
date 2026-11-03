import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/schema';
import { resetDb } from '../../test/db';
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
