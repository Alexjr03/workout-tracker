import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/schema';
import { startSession } from '../../db/repos/sessions';
import { completeSet } from '../../db/repos/sets';
import { resetDb } from '../../test/db';
import { SessionRunner } from './SessionRunner';

const MON = new Date(2026, 10, 23, 18); // after ramp-up

function renderRunner() {
  return render(
    <MemoryRouter initialEntries={['/session']}>
      <SessionRunner />
    </MemoryRouter>,
  );
}

const weight = () => screen.getByRole('textbox', { name: 'Weight' });
const reps = () => screen.getByRole('textbox', { name: 'Reps' });
const completeButton = () => screen.getByRole('button', { name: 'Complete set' });

async function slotsOf(sessionId: string) {
  return db.sessionExercises.where('sessionId').equals(sessionId).sortBy('order');
}

beforeEach(async () => {
  await resetDb();
});

describe('SessionRunner', () => {
  it('says so when no session is in progress', async () => {
    renderRunner();
    expect(await screen.findByText('No session in progress.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Today' })).toHaveAttribute('href', '/');
  });

  it('shows the current exercise, target and bench defaults', async () => {
    await startSession(db, 'upper-a', MON);
    renderRunner();
    expect(await screen.findByRole('heading', { name: 'Bench press' })).toBeInTheDocument();
    expect(screen.getByText('Set 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('8–10 reps · leave 1–2 reps in reserve')).toBeInTheDocument();
    expect(weight()).toHaveValue('10');
    expect(screen.getByText('lb/side')).toBeInTheDocument();
    expect(reps()).toHaveValue('10');
    expect(screen.getByText('Up next: Chest-supported or machine row')).toBeInTheDocument();
  });

  it('saves the set before showing the next one, keeping the weight', async () => {
    const id = await startSession(db, 'upper-a', MON);
    renderRunner();
    await screen.findByText('Set 1 of 3');
    await userEvent.click(completeButton());

    expect(await screen.findByText('Set 2 of 3')).toBeInTheDocument();
    expect(await db.sets.where('sessionId').equals(id).count()).toBe(1);
    expect(weight()).toHaveValue('10');

    await userEvent.click(screen.getByRole('button', { name: 'Increase Weight' }));
    await userEvent.click(screen.getByRole('button', { name: 'Decrease Reps' }));
    await userEvent.click(completeButton());
    expect(await screen.findByText('Set 3 of 3')).toBeInTheDocument();
    expect(weight()).toHaveValue('12.5');

    const saved = await db.sets.where('sessionId').equals(id).sortBy('setIndex');
    expect(saved.map((s) => [s.weight, s.reps])).toEqual([
      [10, 10],
      [12.5, 9],
    ]);
  });

  it('moves to the next exercise and needs a weight when none is known', async () => {
    const id = await startSession(db, 'upper-a', MON);
    const [bench] = await slotsOf(id);
    if (!bench) throw new Error('fixture');
    for (let i = 0; i < 3; i++) await completeSet(db, { slot: bench, weight: 10, reps: 10 });

    renderRunner();
    expect(
      await screen.findByRole('heading', { name: 'Chest-supported or machine row' }),
    ).toBeInTheDocument();
    expect(weight()).toHaveValue('');
    expect(screen.getByText('lb')).toBeInTheDocument();
    expect(completeButton()).toBeDisabled();

    await userEvent.type(weight(), '50');
    expect(completeButton()).toBeEnabled();
  });

  it('shows and pre-fills the progression suggestion', async () => {
    const first = await startSession(db, 'upper-a', MON);
    const [bench] = await slotsOf(first);
    if (!bench) throw new Error('fixture');
    for (let i = 0; i < 3; i++) await completeSet(db, { slot: bench, weight: 10, reps: 10 });
    await db.sessions.update(first, { status: 'finished', finishedAt: MON.toISOString() });
    await db.activeSession.clear();

    await startSession(db, 'upper-a', new Date(2026, 10, 30, 18));
    renderRunner();
    expect(
      await screen.findByText('↑ 12.5 lb/side: you hit 10 reps on every set'),
    ).toBeInTheDocument();
    expect(weight()).toHaveValue('12.5');
  });

  it('lets you jump to any exercise from the overview', async () => {
    await startSession(db, 'upper-a', MON);
    renderRunner();
    await userEvent.click(await screen.findByRole('button', { name: 'Overview' }));
    const list = screen.getByRole('list', { name: 'Exercises' });
    expect(within(list).getAllByRole('button')[0]).toHaveTextContent('Bench press0/3');

    await userEvent.click(within(list).getByRole('button', { name: /Lateral raise/ }));
    expect(await screen.findByRole('heading', { name: 'Lateral raise' })).toBeInTheDocument();
    expect(screen.getByText('Set 1 of 2')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Exercises' })).not.toBeInTheDocument();
  });

  it('shows when every set is done', async () => {
    const id = await startSession(db, 'upper-a', MON);
    for (const slot of await slotsOf(id)) {
      for (let i = 0; i < slot.prescribedSets; i++) {
        await completeSet(db, { slot, weight: 20, reps: 10 });
      }
    }
    renderRunner();
    expect(await screen.findByText('All sets done.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Complete set' })).not.toBeInTheDocument();
  });
});
