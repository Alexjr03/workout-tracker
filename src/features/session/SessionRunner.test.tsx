import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../db/schema';
import { startSession } from '../../db/repos/sessions';
import { completeSet } from '../../db/repos/sets';
import { resetDb } from '../../test/db';
import { SessionRunner } from './SessionRunner';

const MON = new Date(2026, 10, 23, 18); // after ramp-up

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

describe('SessionRunner: resume, undo, edit, finish', () => {
  it('keeps typed values when the app is reopened mid-set', async () => {
    await startSession(db, 'upper-a', MON);
    const first = renderRunner();
    await screen.findByText('Set 1 of 3');
    await userEvent.click(screen.getByRole('button', { name: 'Increase Weight' }));
    await userEvent.click(screen.getByRole('button', { name: 'Decrease Reps' }));
    first.unmount();

    renderRunner();
    await screen.findByText('Set 1 of 3');
    expect(weight()).toHaveValue('12.5');
    expect(reps()).toHaveValue('9');
  });

  it('undoes the last set and pre-fills it for correction', async () => {
    const id = await startSession(db, 'upper-a', MON);
    renderRunner();
    await screen.findByText('Set 1 of 3');
    expect(screen.queryByRole('button', { name: 'Undo last set' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Decrease Reps' }));
    await userEvent.click(completeButton());
    await screen.findByText('Set 2 of 3');
    await userEvent.click(screen.getByRole('button', { name: 'Undo last set' }));

    expect(await screen.findByText('Set 1 of 3')).toBeInTheDocument();
    expect(reps()).toHaveValue('9');
    expect(await db.sets.where('sessionId').equals(id).count()).toBe(0);
  });

  it('edits a logged set from the overview', async () => {
    const id = await startSession(db, 'upper-a', MON);
    const [bench] = await slotsOf(id);
    if (!bench) throw new Error('fixture');
    const set = await completeSet(db, { slot: bench, weight: 10, reps: 10 });

    renderRunner();
    await userEvent.click(await screen.findByRole('button', { name: 'Overview' }));
    await userEvent.click(screen.getByRole('button', { name: 'Edit Bench press set 1: 10 × 10' }));
    const editor = screen.getByRole('group', { name: 'Edit Bench press set 1' });
    await userEvent.click(within(editor).getByRole('button', { name: 'Decrease Reps' }));
    await userEvent.click(within(editor).getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByRole('button', { name: 'Edit Bench press set 1: 10 × 9' }),
    ).toBeInTheDocument();
    expect((await db.sets.get(set.id))?.reps).toBe(9);
  });

  it('asks before finishing with sets missing, and can keep going', async () => {
    const id = await startSession(db, 'upper-a', MON);
    renderRunner();
    await userEvent.click(await screen.findByRole('button', { name: 'Overview' }));
    await userEvent.click(screen.getByRole('button', { name: 'Finish session' }));

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('16 sets not done. Finish anyway?');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep going' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect((await db.sessions.get(id))?.status).toBe('active');

    await userEvent.click(screen.getByRole('button', { name: 'Finish session' }));
    await userEvent.click(screen.getByRole('button', { name: 'Finish anyway' }));
    expect(await screen.findByRole('heading', { name: `Summary ${id}` })).toBeInTheDocument();
    expect((await db.sessions.get(id))?.status).toBe('finished');
  });

  it('finishes without asking once every set is done', async () => {
    const id = await startSession(db, 'upper-a', MON);
    for (const slot of await slotsOf(id)) {
      for (let i = 0; i < slot.prescribedSets; i++) {
        await completeSet(db, { slot, weight: 20, reps: 10 });
      }
    }
    renderRunner();
    await screen.findByText('All sets done.');
    await userEvent.click(screen.getByRole('button', { name: 'Finish session' }));
    expect(await screen.findByRole('heading', { name: `Summary ${id}` })).toBeInTheDocument();
  });
});

describe('SessionRunner: rest timer', () => {
  it('starts the rest for the exercise type after a set, and can be skipped', async () => {
    const id = await startSession(db, 'upper-a', MON);
    renderRunner();
    await screen.findByText('Set 1 of 3');
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();

    await userEvent.click(completeButton());
    expect(await screen.findByRole('timer')).toHaveTextContent(/^2:(30|29)$/);

    await userEvent.click(screen.getByRole('button', { name: 'Skip' }));
    await vi.waitFor(() => expect(screen.queryByRole('timer')).not.toBeInTheDocument());
    expect((await db.activeSession.get('active'))?.restEndsAt).toBeNull();

    const slots = await slotsOf(id);
    const raise = slots.find((s) => s.exerciseId === 'lateral-raise');
    if (!raise) throw new Error('fixture');
    await userEvent.click(screen.getByRole('button', { name: 'Overview' }));
    await userEvent.click(screen.getByRole('button', { name: /^Lateral raise/ }));
    await screen.findByRole('heading', { name: 'Lateral raise' });
    await userEvent.type(weight(), '10');
    await userEvent.click(completeButton());
    expect(await screen.findByRole('timer')).toHaveTextContent(/^1:(15|14)$/);
  });

  it('saves a ±15 s adjustment', async () => {
    await startSession(db, 'upper-a', MON);
    renderRunner();
    await screen.findByText('Set 1 of 3');
    await userEvent.click(completeButton());
    await screen.findByRole('timer');
    const before = (await db.activeSession.get('active'))?.restEndsAt ?? '';
    await userEvent.click(screen.getByRole('button', { name: '+15 s' }));
    await vi.waitFor(async () => {
      const after = (await db.activeSession.get('active'))?.restEndsAt ?? '';
      expect(Date.parse(after) - Date.parse(before)).toBeGreaterThanOrEqual(14_000);
    });
  });
});

describe('SessionRunner: swap', () => {
  it('swaps to a new exercise for this session only', async () => {
    await startSession(db, 'upper-a', MON);
    renderRunner();
    await userEvent.click(await screen.findByRole('button', { name: 'Swap' }));
    const sheet = screen.getByRole('dialog', { name: 'Swap Bench press' });
    await userEvent.type(
      within(sheet).getByRole('textbox', { name: 'New exercise' }),
      'Floor press',
    );
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add and swap' }));

    expect(await screen.findByRole('heading', { name: 'Floor press' })).toBeInTheDocument();
    expect(screen.getByText('Swapped for Bench press')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(weight()).toHaveValue('');
    expect(screen.getByText('lb')).toBeInTheDocument();
  });

  it('swaps to a catalog exercise and back again', async () => {
    await startSession(db, 'upper-a', MON);
    renderRunner();
    await userEvent.click(await screen.findByRole('button', { name: 'Swap' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Incline dumbbell press' }));
    expect(
      await screen.findByRole('heading', { name: 'Incline dumbbell press' }),
    ).toBeInTheDocument();
    expect(screen.getByText('kg each')).toBeInTheDocument(); // gym dumbbells are kg

    await userEvent.click(screen.getByRole('button', { name: 'Swap' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back to Bench press' }));
    expect(await screen.findByRole('heading', { name: 'Bench press' })).toBeInTheDocument();
    expect(screen.queryByText(/Swapped for/)).not.toBeInTheDocument();
    expect(weight()).toHaveValue('10');
  });

  it('can be cancelled', async () => {
    await startSession(db, 'upper-a', MON);
    renderRunner();
    await userEvent.click(await screen.findByRole('button', { name: 'Swap' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bench press' })).toBeInTheDocument();
  });

  it('is not offered once a set of the exercise is logged', async () => {
    await startSession(db, 'upper-a', MON);
    renderRunner();
    await screen.findByText('Set 1 of 3');
    await userEvent.click(completeButton());
    await screen.findByText('Set 2 of 3');
    expect(screen.queryByRole('button', { name: 'Swap' })).not.toBeInTheDocument();
  });
});

describe('SessionRunner: optional ramp-up set', () => {
  const RAMP = new Date(2026, 10, 9, 18); // Monday, ramp-up week 2

  async function doRequiredBenchSets() {
    const id = await startSession(db, 'upper-a', RAMP);
    const [bench] = await slotsOf(id);
    if (!bench) throw new Error('fixture');
    await completeSet(db, { slot: bench, weight: 10, reps: 10 });
    await completeSet(db, { slot: bench, weight: 10, reps: 10 });
    return id;
  }

  it('shows every set, with the last one optional and skippable', async () => {
    await startSession(db, 'upper-a', RAMP);
    renderRunner();
    expect(await screen.findByText('Set 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('8–10 reps · leave ~3 reps in reserve')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Skip last set' })).not.toBeInTheDocument();
  });

  it('skips the optional set and moves to the next exercise', async () => {
    const id = await doRequiredBenchSets();
    renderRunner();
    expect(await screen.findByText('Set 3 of 3 · optional')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Skip last set' }));

    expect(
      await screen.findByRole('heading', { name: 'Chest-supported or machine row' }),
    ).toBeInTheDocument();
    const [bench] = await slotsOf(id);
    expect(bench?.optionalSkipped).toBe(true);
    expect(await db.sets.where('sessionId').equals(id).count()).toBe(2);

    await userEvent.click(screen.getByRole('button', { name: 'Overview' }));
    const list = screen.getByRole('list', { name: 'Exercises' });
    expect(within(list).getAllByRole('button')[0]).toHaveTextContent('Bench press2/2');
  });

  it('can still do the optional set', async () => {
    await doRequiredBenchSets();
    renderRunner();
    await screen.findByText('Set 3 of 3 · optional');
    await userEvent.click(completeButton());
    expect(
      await screen.findByRole('heading', { name: 'Chest-supported or machine row' }),
    ).toBeInTheDocument();
  });

  it('does not count optional sets as missing when finishing', async () => {
    const id = await startSession(db, 'upper-a', RAMP);
    for (const slot of await slotsOf(id)) {
      for (let i = 0; i < slot.prescribedSets - slot.optionalSets; i++) {
        await completeSet(db, { slot, weight: 20, reps: 10 });
      }
    }
    renderRunner();
    await userEvent.click(await screen.findByRole('button', { name: 'Overview' }));
    await userEvent.click(screen.getByRole('button', { name: 'Finish session' }));
    expect(await screen.findByRole('heading', { name: `Summary ${id}` })).toBeInTheDocument();
  });
});

describe('SessionRunner: last time', () => {
  it("shows last session's sets for the exercise next to the suggestion", async () => {
    const first = await startSession(db, 'upper-a', MON);
    const [bench] = await slotsOf(first);
    if (!bench) throw new Error('fixture');
    await completeSet(db, { slot: bench, weight: 10, reps: 10 });
    await completeSet(db, { slot: bench, weight: 10, reps: 10 });
    await completeSet(db, { slot: bench, weight: 10, reps: 10 });
    await db.sessions.update(first, { status: 'finished', finishedAt: MON.toISOString() });
    await db.activeSession.clear();

    await startSession(db, 'upper-a', new Date(2026, 10, 30, 18));
    renderRunner();
    expect(await screen.findByText('Last time: 10 × 10 · 10 × 10 · 10 × 10')).toBeInTheDocument();
    expect(screen.getByText(/↑ 12.5 lb\/side/)).toBeInTheDocument();
    expect(weight()).toHaveValue('12.5');
  });

  it('shows nothing without history', async () => {
    await startSession(db, 'upper-a', MON);
    renderRunner();
    await screen.findByText('Set 1 of 3');
    expect(screen.queryByText(/^Last time/)).not.toBeInTheDocument();
  });
});

describe('SessionRunner: swap suggestions', () => {
  it('lists same-muscle exercises first, then the rest', async () => {
    await startSession(db, 'upper-a', MON);
    renderRunner();
    await userEvent.click(await screen.findByRole('button', { name: 'Swap' }));
    const same = await screen.findByRole('list', { name: 'Same muscle group (Chest)' });
    expect(
      within(same)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Cable fly', 'Incline dumbbell press']);
    const rest = screen.getByRole('list', { name: 'Other exercises' });
    expect(within(rest).queryByRole('button', { name: 'Cable fly' })).not.toBeInTheDocument();
    expect(within(rest).getAllByRole('button').length).toBeGreaterThan(10);
  });

  it('gives a new exercise the muscle group picked', async () => {
    await startSession(db, 'upper-a', MON);
    renderRunner();
    await userEvent.click(await screen.findByRole('button', { name: 'Swap' }));
    const sheet = screen.getByRole('dialog', { name: 'Swap Bench press' });
    await vi.waitFor(() =>
      expect(within(sheet).getByRole('combobox', { name: 'Muscle group' })).toHaveDisplayValue(
        'Chest',
      ),
    );
    await userEvent.selectOptions(
      within(sheet).getByRole('combobox', { name: 'Muscle group' }),
      'Triceps',
    );
    await userEvent.type(within(sheet).getByRole('textbox', { name: 'New exercise' }), 'Dips');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Add and swap' }));
    await screen.findByRole('heading', { name: 'Dips' });
    expect((await db.exercises.get('dips'))?.muscle).toBe('triceps');
  });
});

describe('SessionRunner: how-to video', () => {
  it('opens and closes the video for the current exercise', async () => {
    await startSession(db, 'upper-a', MON);
    renderRunner();
    await userEvent.click(await screen.findByRole('button', { name: 'How to do Bench press' }));
    expect(screen.getByTitle('Bench press how-to video')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '✕ Close' }));
    expect(screen.queryByTitle('Bench press how-to video')).not.toBeInTheDocument();
    expect(screen.getByText('Set 1 of 3')).toBeInTheDocument();
  });
});
