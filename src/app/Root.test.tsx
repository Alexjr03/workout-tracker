import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  beforeEach(() => {
    window.location.hash = '';
    vi.clearAllMocks();
  });

  it('renders the app under a hash router', async () => {
    render(<Root />);
    await userEvent.click(screen.getByRole('link', { name: 'Body' }));
    expect(window.location.hash).toBe('#/body');
  });

  it('wires the update prompt to the service worker', async () => {
    render(<Root />);
    await userEvent.click(screen.getByRole('button', { name: 'Update' }));
    expect(sw.updateServiceWorker).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(sw.setNeedRefresh).toHaveBeenCalledWith(false);
  });
});
