import type { ReactNode } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../../db/schema';
import { loadBasisSchema } from '../../../seed/schemas';
import { resetDb } from '../../../test/db';
import { TodayScreen } from '../../today/TodayScreen';
import { CatalogEditor } from './CatalogEditor';
import { ScheduleEditor } from './ScheduleEditor';

beforeEach(async () => {
  await resetDb();
});

const inRouter = (ui: ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('ScheduleEditor', () => {
  it('shows each weekday with its session', async () => {
    inRouter(<ScheduleEditor />);
    expect(await screen.findByRole('combobox', { name: 'Monday' })).toHaveDisplayValue('Upper A');
    expect(screen.getByRole('combobox', { name: 'Thursday' })).toHaveDisplayValue('Cardio');
    expect(screen.getByRole('combobox', { name: 'Sunday' })).toHaveDisplayValue('Rest');
    expect(
      within(screen.getByRole('combobox', { name: 'Monday' }))
        .getAllByRole('option')
        .map((o) => o.textContent),
    ).toEqual(['Rest', 'Upper A', 'Legs', 'Upper B', 'Cardio', 'Shoulders and arms']);
  });

  it('changing Thursday to Upper A changes Today on Thursdays', async () => {
    const view = inRouter(<ScheduleEditor />);
    await userEvent.selectOptions(
      await screen.findByRole('combobox', { name: 'Thursday' }),
      'Upper A',
    );
    await vi.waitFor(async () =>
      expect((await db.routine.get('routine'))?.schedule.thursday).toBe('upper-a'),
    );
    view.unmount();

    inRouter(<TodayScreen now={new Date(2026, 10, 26, 12)} />);
    expect(await screen.findByRole('region', { name: 'Upper A' })).toBeInTheDocument();
  });
});

describe('CatalogEditor', () => {
  it('lists every exercise by name', async () => {
    inRouter(<CatalogEditor />);
    const list = await screen.findByRole('list', { name: 'Exercises' });
    const names = within(list)
      .getAllByRole('button')
      .map((b) => b.textContent);
    expect(names).toHaveLength(21);
    expect(names[0]).toMatch(/^Assisted pull-up/);
  });

  it('offers exactly the load basis options', async () => {
    inRouter(<CatalogEditor />);
    await userEvent.click(await screen.findByRole('button', { name: /^Bench press/ }));
    const basis = screen.getByRole('combobox', { name: 'Weight is logged as' });
    expect(
      within(basis)
        .getAllByRole('option')
        .map((o) => (o as HTMLOptionElement).value),
    ).toEqual(loadBasisSchema.options);
    expect(basis).toHaveValue('per-side');
  });

  it('saves an edited exercise', async () => {
    inRouter(<CatalogEditor />);
    await userEvent.click(await screen.findByRole('button', { name: /^Bench press/ }));
    const form = screen.getByRole('group', { name: 'Edit Bench press' });
    await userEvent.click(within(form).getByRole('button', { name: 'Increase Increment' }));
    await userEvent.selectOptions(
      within(form).getByRole('combobox', { name: 'Type' }),
      'Isolation',
    );
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }));

    await vi.waitFor(async () =>
      expect(await db.exercises.get('bench-press')).toMatchObject({
        increment: 5,
        type: 'isolation',
      }),
    );
    await vi.waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Edit Bench press' })).not.toBeInTheDocument(),
    );
  });

  it('sets the muscle group', async () => {
    inRouter(<CatalogEditor />);
    await userEvent.click(await screen.findByRole('button', { name: /^Face pull/ }));
    const form = screen.getByRole('group', { name: 'Edit Face pull' });
    expect(within(form).getByRole('combobox', { name: 'Muscle group' })).toHaveDisplayValue(
      'Shoulders',
    );
    await userEvent.selectOptions(
      within(form).getByRole('combobox', { name: 'Muscle group' }),
      'Back',
    );
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }));
    await vi.waitFor(async () =>
      expect((await db.exercises.get('face-pull'))?.muscle).toBe('back'),
    );
  });

  it('shows an error and keeps the form open for an empty name', async () => {
    inRouter(<CatalogEditor />);
    await userEvent.click(await screen.findByRole('button', { name: /^Bench press/ }));
    const form = screen.getByRole('group', { name: 'Edit Bench press' });
    await userEvent.clear(within(form).getByRole('textbox', { name: 'Name' }));
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Name is required.');
    expect((await db.exercises.get('bench-press'))?.name).toBe('Bench press');
  });

  it('can cancel an edit', async () => {
    inRouter(<CatalogEditor />);
    await userEvent.click(await screen.findByRole('button', { name: /^Bench press/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('group', { name: 'Edit Bench press' })).not.toBeInTheDocument();
  });
});
