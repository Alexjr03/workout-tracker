import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { startSession } from '../../db/repos/sessions';
import { db } from '../../db/schema';
import { resetDb } from '../../test/db';
import { SessionRunner } from './SessionRunner';

const THU = new Date(2026, 10, 26, 7);

function SummaryStub() {
  return <h1>Summary {useParams().sessionId}</h1>;
}

function renderRunner() {
  return render(
    <MemoryRouter initialEntries={['/session']}>
      <Routes>
        <Route path="/session" element={<SessionRunner />} />
        <Route path="/summary/:sessionId" element={<SummaryStub />} />
      </Routes>
    </MemoryRouter>,
  );
}

const saveButton = () => screen.getByRole('button', { name: 'Save cardio' });

beforeEach(async () => {
  await resetDb();
});

describe('Cardio session', () => {
  it('shows machines, target and intensity from the routine', async () => {
    await startSession(db, 'cardio', THU);
    renderRunner();
    expect(await screen.findByRole('heading', { name: 'Cardio' })).toBeInTheDocument();
    const machines = screen.getByRole('group', { name: 'Machine' });
    expect(
      within(machines)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Incline treadmill', 'StairMaster', 'Other…']);
    expect(screen.getByText('Target 30–45 min · Pace where I can still talk')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Minutes' })).toHaveValue('30');
    expect(saveButton()).toBeDisabled();
  });

  it('follows an edited routine instead of built-in options', async () => {
    const routine = await db.routine.get('routine');
    const cardio = routine?.sessions.cardio;
    if (!routine || !cardio || !('cardio' in cardio)) throw new Error('fixture');
    await db.routine.update('routine', {
      sessions: {
        ...routine.sessions,
        cardio: {
          ...cardio,
          cardio: { ...cardio.cardio, machineOptions: ['Rower'], minMinutes: 20 },
        },
      },
    });
    await startSession(db, 'cardio', THU);
    renderRunner();
    const machines = await screen.findByRole('group', { name: 'Machine' });
    expect(
      within(machines)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Rower', 'Other…']);
    expect(screen.getByRole('textbox', { name: 'Minutes' })).toHaveValue('20');
  });

  it('saves machine and minutes without notes and finishes the session', async () => {
    const id = await startSession(db, 'cardio', THU);
    renderRunner();
    await userEvent.click(await screen.findByRole('button', { name: 'StairMaster' }));
    expect(screen.getByRole('button', { name: 'StairMaster' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Increase Minutes' }));
    await userEvent.click(saveButton());

    expect(await screen.findByRole('heading', { name: `Summary ${id}` })).toBeInTheDocument();
    const [log] = await db.cardio.toArray();
    expect(log).toMatchObject({
      sessionId: id,
      machine: 'StairMaster',
      durationMin: 35,
      notes: '',
    });
    expect(await db.sessions.get(id)).toMatchObject({ kind: 'cardio', status: 'finished' });
  });

  it('accepts a typed machine and notes', async () => {
    await startSession(db, 'cardio', THU);
    renderRunner();
    await userEvent.click(await screen.findByRole('button', { name: 'Other…' }));
    await userEvent.type(screen.getByRole('textbox', { name: 'Machine name' }), 'Rowing machine');
    await userEvent.type(screen.getByRole('textbox', { name: 'Notes' }), 'Easy pace');
    await userEvent.click(saveButton());

    await screen.findByRole('heading', { name: /^Summary/ });
    expect(await db.cardio.toArray()).toEqual([
      expect.objectContaining({ machine: 'Rowing machine', notes: 'Easy pace' }),
    ]);
  });

  it('needs a name when Other… is chosen', async () => {
    await startSession(db, 'cardio', THU);
    renderRunner();
    await userEvent.click(await screen.findByRole('button', { name: 'Other…' }));
    expect(saveButton()).toBeDisabled();
  });
});
