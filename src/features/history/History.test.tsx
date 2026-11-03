import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { saveCardio } from '../../db/repos/cardio';
import { swapExercise } from '../../db/repos/exercises';
import { finishSession, startSession } from '../../db/repos/sessions';
import { completeSet } from '../../db/repos/sets';
import { db } from '../../db/schema';
import { resetDb } from '../../test/db';
import { HistoryList } from './HistoryList';
import { SessionDetailScreen } from './SessionDetailScreen';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/history" element={<HistoryList />} />
        <Route path="/history/session/:sessionId" element={<SessionDetailScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function legsWithSwap() {
  const start = new Date(2026, 10, 24, 18);
  const id = await startSession(db, 'legs', start);
  const slots = await db.sessionExercises.where('sessionId').equals(id).sortBy('order');
  const [squat] = slots;
  const legPress = slots.find((s) => s.exerciseId === 'leg-press');
  if (!squat || !legPress) throw new Error('fixture');
  await completeSet(db, { slot: squat, weight: 95, reps: 8, now: start });
  await swapExercise(db, legPress.id, { newName: 'Hack squat' });
  const hack = await db.sessionExercises.get(legPress.id);
  if (!hack) throw new Error('fixture');
  await completeSet(db, { slot: hack, weight: 90, reps: 12, now: start });
  await finishSession(db, id, new Date(start.getTime() + 52 * 60_000));
  return id;
}

beforeEach(async () => {
  await resetDb();
});

describe('HistoryList', () => {
  it('says so when nothing is finished yet', async () => {
    renderAt('/history');
    expect(await screen.findByText('No finished sessions yet.')).toBeInTheDocument();
  });

  it('lists sessions newest first and opens one', async () => {
    const legs = await legsWithSwap();
    const cardio = await startSession(db, 'cardio', new Date(2026, 10, 26, 7));
    await saveCardio(
      db,
      cardio,
      { machine: 'StairMaster', durationMin: 35, notes: '' },
      new Date(2026, 10, 26, 7, 38),
    );

    renderAt('/history');
    const list = await screen.findByRole('list', { name: 'Sessions' });
    const items = within(list).getAllByRole('link');
    expect(items.map((a) => a.textContent)).toEqual([
      'Thursday, Nov 26CardioStairMaster · 35 min',
      'Tuesday, Nov 24LegsSwapped2 sets · 52 min',
    ]);
    expect(items[1]).toHaveAttribute('href', `/history/session/${legs}`);

    await userEvent.click(items[1] as HTMLElement);
    expect(await screen.findByRole('heading', { name: 'Legs' })).toBeInTheDocument();
  });

  it('links to exercise progress', async () => {
    renderAt('/history');
    expect(await screen.findByRole('link', { name: 'Exercise progress' })).toHaveAttribute(
      'href',
      '/history/exercises',
    );
  });

  it('loads more sessions on request', async () => {
    for (let d = 0; d < 32; d++) {
      const id = await startSession(db, 'cardio', new Date(2026, 9, 1 + d, 7));
      await saveCardio(
        db,
        id,
        { machine: 'StairMaster', durationMin: 30, notes: '' },
        new Date(2026, 9, 1 + d, 7, 30),
      );
    }
    renderAt('/history');
    const list = await screen.findByRole('list', { name: 'Sessions' });
    expect(within(list).getAllByRole('link')).toHaveLength(30);
    await userEvent.click(screen.getByRole('button', { name: 'Show more' }));
    await waitFor(() => expect(within(list).getAllByRole('link')).toHaveLength(32));
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
  });
});

describe('SessionDetailScreen', () => {
  it('shows every exercise with its sets, target and swap', async () => {
    const id = await legsWithSwap();
    renderAt(`/history/session/${id}`);
    expect(await screen.findByRole('heading', { name: 'Legs' })).toBeInTheDocument();
    expect(screen.getByText('Tuesday, Nov 24 · 52 min')).toBeInTheDocument();

    const squat = screen.getByRole('region', { name: 'Back squat or Smith machine squat' });
    expect(within(squat).getByText('3 × 6–8 · leave 1–2 reps in reserve')).toBeInTheDocument();
    expect(within(squat).getByText('95 × 8')).toBeInTheDocument();
    expect(within(squat).getByText('lb/side')).toBeInTheDocument();

    const hack = screen.getByRole('region', { name: 'Hack squat' });
    expect(within(hack).getByText('Leg press → Hack squat')).toBeInTheDocument();
    expect(within(hack).getByText('90 × 12')).toBeInTheDocument();

    expect(
      within(screen.getByRole('region', { name: 'Calf raise' })).getByText('Not done'),
    ).toBeInTheDocument();
  });

  it('shows cardio details', async () => {
    const id = await startSession(db, 'cardio', new Date(2026, 10, 26, 7));
    await saveCardio(
      db,
      id,
      { machine: 'StairMaster', durationMin: 35, notes: 'Level 7' },
      new Date(2026, 10, 26, 7, 38),
    );
    renderAt(`/history/session/${id}`);
    expect(await screen.findByText('StairMaster · 35 min')).toBeInTheDocument();
    expect(screen.getByText('Level 7')).toBeInTheDocument();
  });

  it('handles an unknown id', async () => {
    renderAt('/history/session/nope');
    expect(await screen.findByText('Session not found.')).toBeInTheDocument();
  });
});
