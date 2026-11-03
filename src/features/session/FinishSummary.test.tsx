import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { finishSession, startSession } from '../../db/repos/sessions';
import { completeSet } from '../../db/repos/sets';
import { db } from '../../db/schema';
import { resetDb } from '../../test/db';
import { FinishSummary } from './FinishSummary';

const MON = new Date(2026, 10, 23, 18);
const at = (minutes: number) => new Date(MON.getTime() + minutes * 60_000);

function renderSummary(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/summary/${id}`]}>
      <Routes>
        <Route path="/summary/:sessionId" element={<FinishSummary />} />
        <Route path="/" element={<h1>Today screen</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await resetDb();
});

describe('FinishSummary', () => {
  it('shows sets done, duration and progressions earned', async () => {
    const id = await startSession(db, 'upper-a', MON);
    const [bench, row] = await db.sessionExercises.where('sessionId').equals(id).sortBy('order');
    if (!bench || !row) throw new Error('fixture');
    for (let i = 0; i < 3; i++) await completeSet(db, { slot: bench, weight: 10, reps: 10 });
    await completeSet(db, { slot: row, weight: 50, reps: 8 });
    await finishSession(db, id, at(42));

    renderSummary(id);
    expect(await screen.findByRole('heading', { name: 'Upper A done' })).toBeInTheDocument();
    expect(screen.getByText('4 of 16 sets · 42 min')).toBeInTheDocument();
    expect(screen.getByText('Bench press: 12.5 lb/side next time')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByRole('heading', { name: 'Today screen' })).toBeInTheDocument();
  });

  it('says when no weight goes up', async () => {
    const id = await startSession(db, 'upper-a', MON);
    await finishSession(db, id, at(5));
    renderSummary(id);
    expect(await screen.findByText('No weight increases this time.')).toBeInTheDocument();
  });

  it('handles an unknown session id', async () => {
    renderSummary('nope');
    expect(await screen.findByText('Session not found.')).toBeInTheDocument();
  });
});
