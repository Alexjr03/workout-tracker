import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/schema';
import { resetDb } from '../../test/db';
import { BodyScreen } from './BodyScreen';

const NOV_6 = new Date(2026, 10, 6, 8);
const kg = () => screen.getByRole('textbox', { name: 'Weight' });

beforeEach(async () => {
  await resetDb();
});

describe('BodyScreen', () => {
  it('starts from the starting weight and saves today', async () => {
    render(<BodyScreen now={NOV_6} />);
    expect(await screen.findByRole('textbox', { name: 'Weight' })).toHaveValue('88');
    expect(screen.getByText('No entries yet.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Decrease Weight' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(async () =>
      expect(await db.bodyWeight.toArray()).toEqual([{ date: '2026-11-06', kg: 87.9 }]),
    );
  });

  it('defaults to the last entry and overwrites the same date', async () => {
    await db.bodyWeight.bulkPut([
      { date: '2026-11-04', kg: 87.6 },
      { date: '2026-11-06', kg: 87.2 },
    ]);
    render(<BodyScreen now={NOV_6} />);
    expect(await screen.findByRole('textbox', { name: 'Weight' })).toHaveValue('87.2');
    await userEvent.click(screen.getByRole('button', { name: 'Increase Weight' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(async () => expect((await db.bodyWeight.get('2026-11-06'))?.kg).toBe(87.3));
    expect(await db.bodyWeight.count()).toBe(2);
  });

  it('shows the latest weigh-in, change since last week and since start, kg to goal', async () => {
    await db.bodyWeight.bulkPut([
      { date: '2026-10-30', kg: 87.8 },
      { date: '2026-11-06', kg: 87.0 },
    ]);
    render(<BodyScreen now={NOV_6} />);
    const stats = await screen.findByRole('region', { name: 'Summary' });
    expect(within(stats).getByText('87 kg')).toBeInTheDocument();
    expect(within(stats).getByText('Friday, Nov 6')).toBeInTheDocument();
    expect(within(stats).getByText('−0.8 kg since last weigh-in')).toBeInTheDocument();
    expect(within(stats).getByText('−1.0 kg since start')).toBeInTheDocument();
    expect(within(stats).getByText('17.0 kg to goal')).toBeInTheDocument();
    expect(within(stats).getByText('Next weigh-in: Friday, Nov 13')).toBeInTheDocument();
  });

  it('says when a weigh-in is due', async () => {
    await db.bodyWeight.put({ date: '2026-10-30', kg: 87.8 });
    render(<BodyScreen now={NOV_6} />);
    const stats = await screen.findByRole('region', { name: 'Summary' });
    expect(within(stats).getByText('Weigh-in due today')).toBeInTheDocument();
    expect(within(stats).queryByText(/since last weigh-in/)).not.toBeInTheDocument();
  });

  it('charts weigh-ins with start/goal lines from Settings', async () => {
    await db.settings.update('settings', { startingWeightKg: 90, goalWeightKg: 72 });
    await db.bodyWeight.bulkPut([
      { date: '2026-10-30', kg: 87.8 },
      { date: '2026-11-06', kg: 87.0 },
    ]);
    render(<BodyScreen now={NOV_6} />);
    expect(await screen.findByRole('group', { name: 'Body weight' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Legend' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Oct 30: 87.8 kg' })).toBeInTheDocument();
    expect(screen.getByText('Start 90')).toBeInTheDocument();
    expect(screen.getByText('Goal 72')).toBeInTheDocument();
  });

  it('edits and deletes past entries', async () => {
    await db.bodyWeight.bulkPut([
      { date: '2026-11-04', kg: 87.6 },
      { date: '2026-11-06', kg: 87.2 },
    ]);
    render(<BodyScreen now={NOV_6} />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Edit Wednesday, Nov 4: 87.6 kg' }),
    );
    expect(screen.getByText('Editing Wednesday, Nov 4')).toBeInTheDocument();
    expect(kg()).toHaveValue('87.6');
    await userEvent.click(screen.getByRole('button', { name: 'Increase Weight' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await vi.waitFor(async () => expect((await db.bodyWeight.get('2026-11-04'))?.kg).toBe(87.7));

    await userEvent.click(
      await screen.findByRole('button', { name: 'Edit Wednesday, Nov 4: 87.7 kg' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete entry' }),
    );
    await vi.waitFor(async () => expect(await db.bodyWeight.get('2026-11-04')).toBeUndefined());
    await vi.waitFor(() => expect(screen.queryByText(/^Editing/)).not.toBeInTheDocument());
  });
});
