import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/schema';
import { resetDb } from '../../test/db';
import { FoodScreen } from './FoodScreen';

const NOV_6 = new Date(2026, 10, 6, 13);
const entry = (id: string, date: string, kcal: number, proteinG: number | null = null) => ({
  id,
  date,
  kcal,
  proteinG,
  createdAt: `${date}T12:00:00.000Z`,
});

beforeEach(async () => {
  await resetDb();
});

describe('FoodScreen', () => {
  it('shows calories eaten against the maximum', async () => {
    await db.food.bulkPut([entry('a', '2026-11-06', 600), entry('b', '2026-11-06', 650)]);
    render(<FoodScreen now={NOV_6} />);
    expect(await screen.findByText('1,250 / 1,500 kcal')).toBeInTheDocument();
    expect(screen.getByText('250 remaining')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Calories' })).not.toHaveClass('over');
  });

  it('warns when over the maximum', async () => {
    await db.food.put(entry('a', '2026-11-06', 1600));
    render(<FoodScreen now={NOV_6} />);
    expect(await screen.findByText('−100 remaining')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Calories' })).toHaveClass('over');
    expect(screen.getByText('Over your maximum')).toBeInTheDocument();
  });

  it('adds with quick-add buttons and a typed number', async () => {
    render(<FoodScreen now={NOV_6} />);
    await userEvent.click(await screen.findByRole('button', { name: '+250' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Calories' }), '420');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('670 / 1,500 kcal')).toBeInTheDocument();
    const kcals = (await db.food.toArray()).map((f) => [f.date, f.kcal]).sort();
    expect(kcals).toEqual([
      ['2026-11-06', 250],
      ['2026-11-06', 420],
    ]);
  });

  it('deletes an entry with undo', async () => {
    await db.food.put(entry('a', '2026-11-06', 600));
    render(<FoodScreen now={NOV_6} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Delete 600 kcal' }));
    expect(await screen.findByText('0 / 1,500 kcal')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('600 / 1,500 kcal')).toBeInTheDocument();
    expect(await db.food.count()).toBe(1);
  });

  it('browses previous days but not the future', async () => {
    await db.food.put(entry('a', '2026-11-05', 900));
    render(<FoodScreen now={NOV_6} />);
    expect(await screen.findByRole('button', { name: 'Next day' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Previous day' }));
    expect(await screen.findByText('Thursday, Nov 5')).toBeInTheDocument();
    expect(screen.getByText('900 / 1,500 kcal')).toBeInTheDocument();
  });

  it('hides protein until a target is set', async () => {
    render(<FoodScreen now={NOV_6} />);
    await screen.findByText('0 / 1,500 kcal');
    expect(screen.queryByText(/protein/i)).not.toBeInTheDocument();
  });

  it('tracks protein against the target once set', async () => {
    await db.settings.update('settings', { proteinTargetG: 140 });
    await db.food.put(entry('a', '2026-11-06', 500, 40));
    render(<FoodScreen now={NOV_6} />);
    expect(await screen.findByText('Protein 40 / 140 g')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', { name: 'Calories' }), '300');
    await userEvent.type(screen.getByRole('textbox', { name: 'Protein (g)' }), '25');
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Protein 65 / 140 g')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Entries' });
    expect(within(list).getByText('300 kcal · 25 g protein')).toBeInTheDocument();
  });

  it('ignores Add with no calories', async () => {
    render(<FoodScreen now={NOV_6} />);
    expect(await screen.findByRole('button', { name: 'Add' })).toBeDisabled();
    await vi.waitFor(async () => expect(await db.food.count()).toBe(0));
  });
});
