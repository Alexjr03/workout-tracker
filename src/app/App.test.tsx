import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../test/db';
import { AppRoutes } from './App';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await resetDb();
});

describe('AppRoutes', () => {
  it('shows the five tabs in order', () => {
    renderAt('/');
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const labels = within(nav)
      .getAllByRole('link')
      .map((link) => link.textContent);
    expect(labels).toEqual(['Today', 'History', 'Body', 'Food', 'Settings']);
  });

  it('opens Today by default and marks its tab as current', async () => {
    renderAt('/');
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
  });

  it('switches screens when a tab is tapped', async () => {
    renderAt('/');
    await userEvent.click(screen.getByRole('link', { name: 'Food' }));
    expect(screen.getByRole('heading', { name: 'Food' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Food' })).toHaveAttribute('aria-current', 'page');
  });

  it('hides the tab bar on the full-screen session runner', async () => {
    renderAt('/session');
    expect(await screen.findByText('No session in progress.')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument();
  });

  it('sends unknown paths to Today', async () => {
    renderAt('/nope');
    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
  });
});
