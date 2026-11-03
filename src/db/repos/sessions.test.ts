import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../test/db';
import { db } from '../schema';
import {
  ActiveSessionExistsError,
  discardSession,
  getActiveSession,
  startSession,
} from './sessions';

// Program starts Tue 2026-11-03; ramp-up covers 11-03 … 11-16.
const DAY_3 = new Date(2026, 10, 6, 18); // Friday, ramp-up
const MON_AFTER = new Date(2026, 10, 23, 18); // Monday, week 4

beforeEach(async () => {
  await resetDb();
});

describe('startSession', () => {
  it('snapshots a ramp-up prescription for every exercise', async () => {
    const id = await startSession(db, 'upper-a', DAY_3);

    const session = await db.sessions.get(id);
    expect(session).toMatchObject({
      templateId: 'upper-a',
      templateName: 'Upper A',
      date: '2026-11-06',
      status: 'active',
      rampUp: true,
      kind: 'lifting',
      finishedAt: null,
    });

    const slots = await db.sessionExercises.where('sessionId').equals(id).sortBy('order');
    expect(slots.map((s) => [s.exerciseId, s.prescribedSets, s.optionalSets])).toEqual([
      ['bench-press', 3, 1],
      ['machine-row', 3, 1],
      ['lat-pulldown', 3, 1],
      ['db-shoulder-press', 3, 1],
      ['lateral-raise', 2, 1],
      ['triceps-pushdown', 2, 1],
    ]);
    expect(slots.every((s) => !s.optionalSkipped)).toBe(true);
    expect(slots.every((s) => s.rirTarget === '~3' && s.replacesExerciseId === null)).toBe(true);
    expect(slots[0]).toMatchObject({ repMin: 8, repMax: 10, suggestedWeight: null });
  });

  it('uses full sets and 1–2 RIR after ramp-up', async () => {
    const id = await startSession(db, 'upper-a', MON_AFTER);
    const slots = await db.sessionExercises.where('sessionId').equals(id).sortBy('order');
    expect(slots[0]).toMatchObject({ prescribedSets: 3, optionalSets: 0, rirTarget: '1-2' });
    expect((await db.sessions.get(id))?.rampUp).toBe(false);
  });

  it('records the active-session state at the first set', async () => {
    const id = await startSession(db, 'legs', DAY_3);
    expect(await db.activeSession.get('active')).toEqual({
      id: 'active',
      sessionId: id,
      exerciseIndex: 0,
      setIndex: 0,
      draftWeight: null,
      draftReps: null,
      restEndsAt: null,
    });
  });

  it('starts a cardio session with no exercise slots', async () => {
    const id = await startSession(db, 'cardio', DAY_3);
    expect((await db.sessions.get(id))?.kind).toBe('cardio');
    expect(await db.sessionExercises.where('sessionId').equals(id).count()).toBe(0);
  });

  it('allows only one active session', async () => {
    await startSession(db, 'upper-a', DAY_3);
    await expect(startSession(db, 'legs', DAY_3)).rejects.toBeInstanceOf(ActiveSessionExistsError);
    expect(await db.sessions.where('status').equals('active').count()).toBe(1);
  });

  it('rejects an unknown template', async () => {
    await expect(startSession(db, 'nope', DAY_3)).rejects.toThrow('Unknown session nope');
  });

  it('snapshots a progression suggestion from the last finished session', async () => {
    const first = await startSession(db, 'upper-a', MON_AFTER);
    const [bench] = await db.sessionExercises.where('sessionId').equals(first).sortBy('order');
    if (!bench) throw new Error('fixture');
    await db.sets.bulkAdd(
      [0, 1, 2].map((setIndex) => ({
        id: `s${setIndex}`,
        sessionExerciseId: bench.id,
        sessionId: first,
        exerciseId: 'bench-press',
        setIndex,
        weight: 10,
        reps: 10,
        completedAt: `2026-11-23T18:0${setIndex}:00.000Z`,
      })),
    );
    await db.sessions.update(first, { status: 'finished', finishedAt: '2026-11-23T19:00:00.000Z' });
    await db.activeSession.clear();

    const next = await startSession(db, 'upper-a', new Date(2026, 10, 30, 18));
    const slots = await db.sessionExercises.where('sessionId').equals(next).sortBy('order');
    expect(slots[0]?.suggestedWeight).toBe(12.5);
    expect(slots[1]?.suggestedWeight).toBeNull();
  });

  it('ignores discarded sessions when suggesting', async () => {
    const first = await startSession(db, 'upper-a', MON_AFTER);
    const [bench] = await db.sessionExercises.where('sessionId').equals(first).sortBy('order');
    if (!bench) throw new Error('fixture');
    await db.sets.bulkAdd(
      [0, 1, 2].map((setIndex) => ({
        id: `d${setIndex}`,
        sessionExerciseId: bench.id,
        sessionId: first,
        exerciseId: 'bench-press',
        setIndex,
        weight: 10,
        reps: 10,
        completedAt: `2026-11-23T18:0${setIndex}:00.000Z`,
      })),
    );
    await discardSession(db, first);

    const next = await startSession(db, 'upper-a', new Date(2026, 10, 30, 18));
    const [slot] = await db.sessionExercises.where('sessionId').equals(next).sortBy('order');
    expect(slot?.suggestedWeight).toBeNull();
  });
});

describe('getActiveSession / discardSession', () => {
  it('returns the active session until it is discarded', async () => {
    expect(await getActiveSession(db)).toBeUndefined();
    const id = await startSession(db, 'upper-b', DAY_3);
    expect((await getActiveSession(db))?.id).toBe(id);

    await discardSession(db, id);
    expect(await getActiveSession(db)).toBeUndefined();
    expect((await db.sessions.get(id))?.status).toBe('discarded');
    expect(await db.activeSession.get('active')).toBeUndefined();
  });
});
