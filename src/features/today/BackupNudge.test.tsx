import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/schema';
import { resetDb } from '../../test/db';
import { BackupNudge } from './BackupNudge';

const NOW = new Date(2026, 10, 23, 12);

function renderNudge() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<BackupNudge now={NOW} />} />
        <Route path="/settings" element={<h1>Settings page</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

beforeEach(async () => {
  await resetDb();
});

describe('BackupNudge', () => {
  it('asks for a first backup when there has never been one', async () => {
    renderNudge();
    expect(await screen.findByText('No backup yet.')).toBeInTheDocument();
  });

  it('shows after more than 7 days', async () => {
    await db.settings.update('settings', { lastExportAt: daysAgo(8) });
    renderNudge();
    expect(await screen.findByText('Last backup was 8 days ago.')).toBeInTheDocument();
  });

  it('stays hidden within 7 days', async () => {
    await db.settings.update('settings', { lastExportAt: daysAgo(7) });
    const { container } = renderNudge();
    await new Promise((r) => setTimeout(r, 50));
    expect(container).toBeEmptyDOMElement();
  });

  it('disappears after an export', async () => {
    renderNudge();
    await screen.findByText('No backup yet.');
    await db.settings.update('settings', { lastExportAt: NOW.toISOString() });
    await waitFor(() => expect(screen.queryByText('No backup yet.')).not.toBeInTheDocument());
  });

  it('can be dismissed', async () => {
    renderNudge();
    await userEvent.click(await screen.findByRole('button', { name: 'Not now' }));
    expect(screen.queryByText('No backup yet.')).not.toBeInTheDocument();
  });

  it('links to Settings to export', async () => {
    renderNudge();
    await userEvent.click(await screen.findByRole('link', { name: 'Back up now' }));
    expect(await screen.findByRole('heading', { name: 'Settings page' })).toBeInTheDocument();
  });
});
