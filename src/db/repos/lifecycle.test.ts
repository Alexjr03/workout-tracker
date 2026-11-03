import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../test/db';
import { db } from '../schema';
import type { SessionExerciseLog } from '../types';
import { saveDraft } from './activeSession';
import { finishSession, startSession } from './sessions';
import { completeSet, undoLastSet, updateSet } from './sets';

const MON = new Date(2026, 10, 23, 18);
const at = (minutes: number) => new Date(MON.getTime() + minutes * 60_000);
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

describe('saveDraft', () => {
  it('stores the values being entered for the current set', async () => {
    await saveDraft(db, { weight: 15, reps: 7 });
    expect(await db.activeSession.get('active')).toMatchObject({ draftWeight: 15, draftReps: 7 });
  });

  it('does nothing without an active session', async () => {
    await db.activeSession.clear();
    await saveDraft(db, { weight: 15, reps: 7 });
    expect(await db.activeSession.count()).toBe(0);
  });
});

describe('undoLastSet', () => {
  it('removes the most recent set and returns to its exercise', async () => {
    for (let i = 0; i < 3; i++) {
      await completeSet(db, { slot: slot(0), weight: 10, reps: 10, now: at(i) });
    }
    await completeSet(db, { slot: slot(1), weight: 50, reps: 9, now: at(5) });
    expect(await db.activeSession.get('active')).toMatchObject({ exerciseIndex: 1, setIndex: 1 });

    const undone = await undoLastSet(db, sessionId);
    expect(undone).toMatchObject({ exerciseId: 'machine-row', weight: 50, reps: 9 });
    expect(await db.sets.where('sessionId').equals(sessionId).count()).toBe(3);
    expect(await db.activeSession.get('active')).toMatchObject({
      exerciseIndex: 1,
      setIndex: 0,
      draftWeight: 50,
      draftReps: 9,
    });
  });

  it('returns to an earlier exercise when its set was the last one', async () => {
    for (let i = 0; i < 3; i++) {
      await completeSet(db, { slot: slot(0), weight: 10, reps: 10, now: at(i) });
    }
    await undoLastSet(db, sessionId);
    expect(await db.activeSession.get('active')).toMatchObject({ exerciseIndex: 0, setIndex: 2 });
  });

  it('returns null when nothing has been logged', async () => {
    expect(await undoLastSet(db, sessionId)).toBeNull();
  });
});

describe('updateSet', () => {
  it('changes weight and reps of a logged set', async () => {
    const set = await completeSet(db, { slot: slot(0), weight: 10, reps: 10, now: at(0) });
    await updateSet(db, set.id, { weight: 12.5, reps: 8 });
    expect(await db.sets.get(set.id)).toMatchObject({ weight: 12.5, reps: 8, setIndex: 0 });
  });
});

describe('finishSession', () => {
  it('marks the session finished and clears the active state', async () => {
    await completeSet(db, { slot: slot(0), weight: 10, reps: 10, now: at(0) });
    await finishSession(db, sessionId, at(50));
    expect(await db.sessions.get(sessionId)).toMatchObject({
      status: 'finished',
      finishedAt: at(50).toISOString(),
    });
    expect(await db.activeSession.get('active')).toBeUndefined();
  });

  it('makes the session count for the next progression suggestion', async () => {
    for (let i = 0; i < 3; i++) {
      await completeSet(db, { slot: slot(0), weight: 10, reps: 10, now: at(i) });
    }
    await finishSession(db, sessionId, at(50));
    const next = await startSession(db, 'upper-a', new Date(2026, 10, 30, 18));
    const [bench] = await db.sessionExercises.where('sessionId').equals(next).sortBy('order');
    expect(bench?.suggestedWeight).toBe(12.5);
  });
});
