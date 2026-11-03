import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../test/db';
import { db } from '../schema';
import type { SessionExerciseLog } from '../types';
import { startSession } from './sessions';
import { completeSet, jumpToExercise, lastTimeSets, lastWeightFor, setRestEndsAt } from './sets';

const MON = new Date(2026, 10, 23, 18); // after ramp-up: 3 sets of bench
let sessionId: string;
let slots: SessionExerciseLog[];

beforeEach(async () => {
  await resetDb();
  sessionId = await startSession(db, 'upper-a', MON);
  slots = await db.sessionExercises.where('sessionId').equals(sessionId).sortBy('order');
});

function slot(i: number): SessionExerciseLog {
  const s = slots[i];
  if (!s) throw new Error(`no slot ${i}`);
  return s;
}

describe('completeSet', () => {
  it('writes the set and moves to the next set of the same exercise', async () => {
    const set = await completeSet(db, { slot: slot(0), weight: 10, reps: 10, now: MON });
    expect(await db.sets.get(set.id)).toEqual({
      id: set.id,
      sessionExerciseId: slot(0).id,
      sessionId,
      exerciseId: 'bench-press',
      setIndex: 0,
      weight: 10,
      reps: 10,
      completedAt: MON.toISOString(),
    });
    expect(await db.activeSession.get('active')).toMatchObject({ exerciseIndex: 0, setIndex: 1 });
  });

  it('numbers sets by how many are already logged', async () => {
    await completeSet(db, { slot: slot(0), weight: 10, reps: 10, now: MON });
    const second = await completeSet(db, { slot: slot(0), weight: 10, reps: 9, now: MON });
    expect(second.setIndex).toBe(1);
  });

  it('moves to the next exercise after the last prescribed set', async () => {
    for (let i = 0; i < 3; i++) {
      await completeSet(db, { slot: slot(0), weight: 10, reps: 10, now: MON });
    }
    expect(await db.activeSession.get('active')).toMatchObject({ exerciseIndex: 1, setIndex: 0 });
  });

  it('clears draft values once the set is saved', async () => {
    await db.activeSession.update('active', { draftWeight: 15, draftReps: 8 });
    await completeSet(db, { slot: slot(0), weight: 15, reps: 8, now: MON });
    expect(await db.activeSession.get('active')).toMatchObject({
      draftWeight: null,
      draftReps: null,
    });
  });
});

describe('rest timer', () => {
  it('starts a compound rest (150 s) when a compound set is saved', async () => {
    await completeSet(db, { slot: slot(0), weight: 10, reps: 10, now: MON });
    expect((await db.activeSession.get('active'))?.restEndsAt).toBe(
      new Date(MON.getTime() + 150_000).toISOString(),
    );
  });

  it('starts an isolation rest (75 s) for an isolation exercise', async () => {
    await completeSet(db, { slot: slot(4), weight: 10, reps: 15, now: MON });
    expect((await db.activeSession.get('active'))?.restEndsAt).toBe(
      new Date(MON.getTime() + 75_000).toISOString(),
    );
  });

  it('follows edited rest settings', async () => {
    await db.settings.update('settings', { restSeconds: { compound: 180, isolation: 60 } });
    await completeSet(db, { slot: slot(0), weight: 10, reps: 10, now: MON });
    expect((await db.activeSession.get('active'))?.restEndsAt).toBe(
      new Date(MON.getTime() + 180_000).toISOString(),
    );
  });

  it('can be changed or cleared', async () => {
    const later = new Date(MON.getTime() + 30_000).toISOString();
    await setRestEndsAt(db, later);
    expect((await db.activeSession.get('active'))?.restEndsAt).toBe(later);
    await setRestEndsAt(db, null);
    expect((await db.activeSession.get('active'))?.restEndsAt).toBeNull();
  });
});

describe('jumpToExercise', () => {
  it('points the active session at another exercise and its next set', async () => {
    await completeSet(db, { slot: slot(3), weight: 20, reps: 8, now: MON });
    await jumpToExercise(db, sessionId, 3);
    expect(await db.activeSession.get('active')).toMatchObject({ exerciseIndex: 3, setIndex: 1 });
  });
});

describe('lastWeightFor / lastTimeSets', () => {
  it('finds the most recent weight for an exercise, across sessions', async () => {
    expect(await lastWeightFor(db, 'bench-press')).toBeNull();
    await completeSet(db, { slot: slot(0), weight: 10, reps: 10, now: MON });
    await completeSet(db, {
      slot: slot(0),
      weight: 12.5,
      reps: 8,
      now: new Date(MON.getTime() + 60_000),
    });
    expect(await lastWeightFor(db, 'bench-press')).toBe(12.5);
    expect(await lastWeightFor(db, 'machine-row')).toBeNull();
  });

  it('returns last finished session sets for an exercise', async () => {
    await completeSet(db, { slot: slot(0), weight: 10, reps: 10, now: MON });
    expect(await lastTimeSets(db, 'bench-press')).toEqual([]);

    await db.sessions.update(sessionId, { status: 'finished', finishedAt: MON.toISOString() });
    expect(await lastTimeSets(db, 'bench-press')).toEqual([
      expect.objectContaining({ setIndex: 0, weight: 10, reps: 10 }),
    ]);
  });
});
