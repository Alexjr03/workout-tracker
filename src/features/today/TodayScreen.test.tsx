import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/schema';
import { discardSession, finishSession, startSession } from '../../db/repos/sessions';
import { completeSet } from '../../db/repos/sets';
import { resetDb } from '../../test/db';
import { TodayScreen } from './TodayScreen';

// Program starts Tue 2026-11-03 (resetDb default). `today` is a local date; noon local time.
function renderToday(today: string) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<TodayScreen now={new Date(`${today}T12:00`)} />} />
        <Route path="/session" element={<h1>Session runner</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  await resetDb();
});

describe('TodayScreen', () => {
  it("shows Monday's Upper A with a Start button", async () => {
    renderToday('2026-11-23');
    const card = await screen.findByRole('region', { name: 'Upper A' });
    expect(within(card).getByText('6 exercises')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Start Upper A' })).toBeInTheDocument();
    expect(screen.getByText('Monday, Nov 23')).toBeInTheDocument();
    expect(await screen.findByRole('region', { name: 'Backup reminder' })).toBeInTheDocument();
    expect(screen.queryByText(/Ramp-up week/)).not.toBeInTheDocument();
  });

  it('shows target minutes when the session has them', async () => {
    renderToday('2026-11-27');
    const card = await screen.findByRole('region', { name: 'Shoulders and arms' });
    expect(within(card).getByText('5 exercises · 30-40 min')).toBeInTheDocument();
  });

  it('shows the cardio target and intensity cue', async () => {
    renderToday('2026-11-26');
    const card = await screen.findByRole('region', { name: 'Cardio' });
    expect(within(card).getByText('30–45 min · Pace where I can still talk')).toBeInTheDocument();
  });

  it('shows a rest day and lets any session be started', async () => {
    renderToday('2026-11-28');
    expect(await screen.findByRole('heading', { name: 'Rest day' })).toBeInTheDocument();
    const others = screen.getByRole('region', { name: 'Start a different session' });
    expect(
      within(others)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Upper A', 'Legs', 'Upper B', 'Cardio', 'Shoulders and arms']);
  });

  it('lists the other sessions on a training day', async () => {
    renderToday('2026-11-23');
    const others = await screen.findByRole('region', { name: 'Start a different session' });
    expect(within(others).getAllByRole('button')).toHaveLength(4);
    expect(within(others).queryByRole('button', { name: 'Upper A' })).not.toBeInTheDocument();
  });

  it('shows the ramp-up week during ramp-up', async () => {
    renderToday('2026-11-03');
    expect(await screen.findByText('Ramp-up week 1 of 2')).toBeInTheDocument();
  });

  it('shows ramp-up week 2 on day 7', async () => {
    renderToday('2026-11-10');
    expect(await screen.findByText('Ramp-up week 2 of 2')).toBeInTheDocument();
  });

  it('starts the scheduled session and opens the runner', async () => {
    renderToday('2026-11-23');
    await userEvent.click(await screen.findByRole('button', { name: 'Start Upper A' }));
    expect(await screen.findByRole('heading', { name: 'Session runner' })).toBeInTheDocument();
    const active = await db.sessions.where('status').equals('active').toArray();
    expect(active.map((s) => s.templateId)).toEqual(['upper-a']);
  });

  it('starts a different session from the list', async () => {
    renderToday('2026-11-28');
    const others = await screen.findByRole('region', { name: 'Start a different session' });
    await userEvent.click(within(others).getByRole('button', { name: 'Legs' }));
    expect(await screen.findByRole('heading', { name: 'Session runner' })).toBeInTheDocument();
    expect((await db.sessions.where('status').equals('active').first())?.templateId).toBe('legs');
  });

  it('offers Resume when a session is active', async () => {
    await startSession(db, 'legs', new Date(2026, 10, 24, 18));
    renderToday('2026-11-24');
    await userEvent.click(await screen.findByRole('button', { name: 'Resume Legs' }));
    expect(await screen.findByRole('heading', { name: 'Session runner' })).toBeInTheDocument();
  });

  it('asks before replacing an active session, and can cancel', async () => {
    await startSession(db, 'legs', new Date(2026, 10, 23, 18));
    renderToday('2026-11-23');
    await userEvent.click(await screen.findByRole('button', { name: 'Start Upper A' }));

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Legs is still in progress.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect((await db.sessions.where('status').equals('active').first())?.templateId).toBe('legs');
  });

  it('discards the active session and starts the new one when confirmed', async () => {
    await startSession(db, 'legs', new Date(2026, 10, 23, 18));
    renderToday('2026-11-23');
    await userEvent.click(await screen.findByRole('button', { name: 'Start Upper A' }));
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Discard Legs and start Upper A',
      }),
    );
    expect(await screen.findByRole('heading', { name: 'Session runner' })).toBeInTheDocument();
    const statuses = (await db.sessions.toArray()).map((s) => [s.templateId, s.status]).sort();
    expect(statuses).toEqual([
      ['legs', 'discarded'],
      ['upper-a', 'active'],
    ]);
  });
});

describe('TodayScreen: workout complete', () => {
  async function finishToday(templateId: string) {
    const start = new Date(2026, 10, 23, 18);
    const id = await startSession(db, templateId, start);
    const [first] = await db.sessionExercises.where('sessionId').equals(id).sortBy('order');
    if (first) await completeSet(db, { slot: first, weight: 10, reps: 10, now: start });
    await finishSession(db, id, new Date(start.getTime() + 47 * 60_000));
    return id;
  }

  it("replaces the Start card once today's session is finished", async () => {
    const id = await finishToday('upper-a');
    renderToday('2026-11-23');
    const done = await screen.findByRole('region', { name: 'Workout complete' });
    expect(within(done).getByText('Upper A')).toBeInTheDocument();
    expect(within(done).getByText('1 set · 47 min')).toBeInTheDocument();
    expect(within(done).getByRole('link', { name: 'See details' })).toHaveAttribute(
      'href',
      `/history/session/${id}`,
    );
    expect(screen.queryByRole('button', { name: 'Start Upper A' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Start a different session' })).toBeInTheDocument();
  });

  it('counts any session finished today, not only the scheduled one', async () => {
    await finishToday('legs');
    renderToday('2026-11-23');
    const done = await screen.findByRole('region', { name: 'Workout complete' });
    expect(within(done).getByText('Legs')).toBeInTheDocument();
  });

  it('still offers Resume when another session was started after finishing', async () => {
    await finishToday('upper-a');
    await startSession(db, 'cardio', new Date(2026, 10, 23, 19));
    renderToday('2026-11-23');
    const done = await screen.findByRole('region', { name: 'Workout complete' });
    expect(await within(done).findByRole('button', { name: 'Resume Cardio' })).toBeInTheDocument();
  });

  it('ignores discarded sessions and sessions from other days', async () => {
    const id = await startSession(db, 'upper-a', new Date(2026, 10, 23, 18));
    await discardSession(db, id);
    await finishToday('legs'); // dated Nov 23
    renderToday('2026-11-24');
    expect(await screen.findByRole('button', { name: 'Start Legs' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Workout complete' })).not.toBeInTheDocument();
  });
});

describe("TodayScreen: can't train today", () => {
  it('pushes the week back a day after confirming', async () => {
    const view = renderToday('2026-11-23');
    await userEvent.click(await screen.findByRole('button', { name: "Can't train today" }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveTextContent('Upper A moves to tomorrow');
    expect(dialog).toHaveTextContent('2 rest days left this week; this uses 1. Resets Monday.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Push back a day' }));

    expect(await screen.findByRole('heading', { name: 'Rest day' })).toBeInTheDocument();
    expect(screen.getByText('Week pushed back 1 day · resets Monday')).toBeInTheDocument();
    view.unmount();

    renderToday('2026-11-24');
    expect(await screen.findByRole('button', { name: 'Start Upper A' })).toBeInTheDocument();
  });

  it('can be cancelled', async () => {
    renderToday('2026-11-23');
    await userEvent.click(await screen.findByRole('button', { name: "Can't train today" }));
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Upper A' })).toBeInTheDocument();
    expect((await db.settings.get('settings'))?.pushBacks ?? []).toEqual([]);
  });

  it('is not offered on a rest day, after training, or with no rest day left', async () => {
    const rest = renderToday('2026-11-28');
    await screen.findByRole('heading', { name: 'Rest day' });
    expect(screen.queryByRole('button', { name: "Can't train today" })).not.toBeInTheDocument();
    rest.unmount();

    await db.settings.update('settings', { pushBacks: ['2026-11-23', '2026-11-24'] });
    const full = renderToday('2026-11-25');
    expect(await screen.findByRole('button', { name: 'Start Upper A' })).toBeInTheDocument();
    expect(screen.getByText('Week pushed back 2 days · resets Monday')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: "Can't train today" })).not.toBeInTheDocument();
    full.unmount();

    const id = await startSession(db, 'legs', new Date(2026, 10, 26, 7));
    await finishSession(db, id, new Date(2026, 10, 26, 8));
    renderToday('2026-11-26');
    await screen.findByRole('region', { name: 'Workout complete' });
    expect(screen.queryByRole('button', { name: "Can't train today" })).not.toBeInTheDocument();
  });
});
