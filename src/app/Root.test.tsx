import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startSession } from '../db/repos/sessions';
import { db } from '../db/schema';
import { resetDb } from '../test/db';
import { Root } from './Root';

const sw = vi.hoisted(() => ({
  setNeedRefresh: vi.fn(),
  updateServiceWorker: vi.fn(() => Promise.resolve()),
}));

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [true, sw.setNeedRefresh],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: sw.updateServiceWorker,
  }),
}));

describe('Root', () => {
  beforeEach(async () => {
    window.location.hash = '';
    vi.clearAllMocks();
    await resetDb();
  });

  it('hides the update prompt while a session is active', async () => {
    await startSession(db, 'legs', new Date(2026, 10, 24, 18));
    render(<Root />);
    expect(await screen.findByRole('button', { name: 'Resume Legs' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Update' })).not.toBeInTheDocument();
  });

  it('renders the app under a hash router', async () => {
    render(<Root />);
    await userEvent.click(screen.getByRole('link', { name: 'Body' }));
    expect(window.location.hash).toBe('#/body');
  });

  it('wires the update prompt to the service worker', async () => {
    render(<Root />);
    await userEvent.click(await screen.findByRole('button', { name: 'Update' }));
    expect(sw.updateServiceWorker).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(sw.setNeedRefresh).toHaveBeenCalledWith(false);
  });
});
