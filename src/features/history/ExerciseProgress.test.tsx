import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { finishSession, startSession } from '../../db/repos/sessions';
import { completeSet } from '../../db/repos/sets';
import { db } from '../../db/schema';
import { resetDb } from '../../test/db';
import { ExerciseProgress } from './ExerciseProgress';

/** Finished session of `templateId` on `date` with one set of the first exercise, or of `exerciseId`. */
async function logSet(
  templateId: string,
  date: Date,
  weight: number,
  reps: number,
  exerciseId?: string,
) {
  const id = await startSession(db, templateId, date);
  const slots = await db.sessionExercises.where('sessionId').equals(id).sortBy('order');
  const slot = exerciseId ? slots.find((s) => s.exerciseId === exerciseId) : slots[0];
  if (!slot) throw new Error('fixture');
  await completeSet(db, { slot, weight, reps, now: date });
  await finishSession(db, id, date);
}

const renderProgress = () =>
  render(
    <MemoryRouter>
      <ExerciseProgress />
    </MemoryRouter>,
  );

beforeEach(async () => {
  await resetDb();
});

describe('ExerciseProgress', () => {
  it('asks for a logged set first', async () => {
    renderProgress();
    expect(await screen.findByText('Log a set to see progress.')).toBeInTheDocument();
  });

  it('charts the top weight per session, with ramp-up shaded', async () => {
    await logSet('upper-a', new Date(2026, 10, 9, 18), 10, 10); // ramp-up
    await logSet('upper-a', new Date(2026, 10, 23, 18), 12.5, 9);
    const { container } = renderProgress();

    expect(await screen.findByRole('combobox', { name: 'Exercise' })).toHaveDisplayValue(
      'Bench press',
    );
    expect(screen.getByRole('group', { name: 'Bench press: top weight' })).toBeInTheDocument();
    expect(screen.getByText('lb/side')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nov 23: 12.5 lb/side' })).toBeInTheDocument();
    expect(container.querySelector('.chart-shade')).not.toBeNull();
    expect(screen.getByText('Ramp-up')).toBeInTheDocument();
  });

  it('switches to best reps at the top weight', async () => {
    await logSet('upper-a', new Date(2026, 10, 23, 18), 12.5, 9);
    renderProgress();
    await userEvent.click(await screen.findByRole('button', { name: 'Best reps' }));
    expect(screen.getByRole('button', { name: 'Best reps' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(
      screen.getByRole('group', { name: 'Bench press: best reps at top weight' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nov 23: 9 reps' })).toBeInTheDocument();
  });

  it('labels assisted exercises as lower is better', async () => {
    await logSet('upper-b', new Date(2026, 10, 25, 18), 40, 10, 'assisted-pull-up');
    renderProgress();
    expect(await screen.findByText('lb assist (lower is better)')).toBeInTheDocument();
  });

  it('switches exercise', async () => {
    await logSet('upper-a', new Date(2026, 10, 23, 18), 10, 10);
    await logSet('legs', new Date(2026, 10, 24, 18), 95, 8);
    renderProgress();
    await userEvent.selectOptions(
      await screen.findByRole('combobox', { name: 'Exercise' }),
      'Back squat or Smith machine squat',
    );
    expect(
      await screen.findByRole('group', { name: 'Back squat or Smith machine squat: top weight' }),
    ).toBeInTheDocument();
  });
});
