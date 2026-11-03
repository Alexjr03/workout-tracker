import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { updateSettings } from '../../db/repos/settings';
import { db } from '../../db/schema';
import { resetDb } from '../../test/db';
import { TodayScreen } from '../today/TodayScreen';

beforeEach(async () => {
  await resetDb();
});

describe('program start date', () => {
  it('drives the ramp-up badge on Today', async () => {
    const view = render(
      <MemoryRouter>
        <TodayScreen now={new Date(2026, 10, 23, 12)} />
      </MemoryRouter>,
    );
    await screen.findByText('Monday, Nov 23');
    expect(screen.queryByText(/Ramp-up week/)).not.toBeInTheDocument();

    await updateSettings(db, { programStartDate: '2026-11-20' });
    expect(await screen.findByText('Ramp-up week 1 of 2')).toBeInTheDocument();
    view.unmount();
  });
});
