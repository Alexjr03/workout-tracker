import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../test/db';
import { db } from '../schema';
import type { SessionExerciseLog } from '../types';
import { swapOptions, SwapNotAllowedError, swapExercise } from './exercises';
import { finishSession, startSession } from './sessions';
import { completeSet, lastWeightFor } from './sets';

// Program starts 2026-11-03, so both Tuesdays are past ramp-up (full sets).
const LAST_WEEK = new Date(2026, 10, 17, 18);
const TUE = new Date(2026, 10, 24, 18);

async function slotsOf(sessionId: string) {
  return db.sessionExercises.where('sessionId').equals(sessionId).sortBy('order');
}

async function slotFor(sessionId: string, exerciseId: string): Promise<SessionExerciseLog> {
  const found = (await slotsOf(sessionId)).find((s) => s.exerciseId === exerciseId);
  if (!found) throw new Error(`no ${exerciseId} slot`);
  return found;
}

async function slotById(id: string) {
  const s = await db.sessionExercises.get(id);
  if (!s) throw new Error('missing slot');
  return s;
}

/** Finished Legs session last week with every set of `exerciseId` at `weight` × `reps`. */
async function lastWeek(exerciseId: string, weight: number, reps: number) {
  const id = await startSession(db, 'legs', LAST_WEEK);
  const slot = await slotFor(id, exerciseId);
  for (let i = 0; i < slot.prescribedSets; i++) {
    await completeSet(db, { slot, weight, reps, now: LAST_WEEK });
  }
  await finishSession(db, id, LAST_WEEK);
}

let sessionId: string;
let legPress: SessionExerciseLog;

beforeEach(async () => {
  await resetDb();
});

async function startToday() {
  sessionId = await startSession(db, 'legs', TUE);
  legPress = await slotFor(sessionId, 'leg-press');
}

describe('swapExercise', () => {
  it('creates a custom exercise for a new name and logs under its own id', async () => {
    await startToday();
    await db.activeSession.update('active', { draftWeight: 140, draftReps: 9 });
    await swapExercise(db, legPress.id, { newName: 'Hack squat' });

    expect(await db.activeSession.get('active')).toMatchObject({
      draftWeight: null,
      draftReps: null,
    });
    expect(await db.exercises.get('hack-squat')).toEqual({
      id: 'hack-squat',
      name: 'Hack squat',
      type: 'compound',
      loadBasis: 'total',
      increment: 5,
      isCustom: true,
      muscle: 'quads', // taken from the exercise it replaces
    });
    const slot = await slotById(legPress.id);
    expect(slot).toMatchObject({
      exerciseId: 'hack-squat',
      replacesExerciseId: 'leg-press',
      prescribedSets: 3,
      repMin: 10,
      repMax: 12,
      suggestedWeight: null,
    });

    const set = await completeSet(db, { slot, weight: 90, reps: 12, now: TUE });
    expect(set.exerciseId).toBe('hack-squat');
  });

  it("leaves the original's history, default weight and next suggestion alone", async () => {
    await lastWeek('leg-press', 140, 12);
    await startToday();
    expect(legPress.suggestedWeight).toBe(142.5);

    await swapExercise(db, legPress.id, { newName: 'Hack squat' });
    const slot = await slotById(legPress.id);
    for (let i = 0; i < 3; i++) await completeSet(db, { slot, weight: 90, reps: 8, now: TUE });
    await finishSession(db, sessionId, TUE);

    expect(await lastWeightFor(db, 'leg-press')).toBe(140);
    expect(await lastWeightFor(db, 'hack-squat')).toBe(90);
    const next = await startSession(db, 'legs', new Date(2026, 11, 1, 18));
    expect((await slotFor(next, 'leg-press')).suggestedWeight).toBe(142.5);

    const routine = await db.routine.get('routine');
    const legs = routine?.sessions.legs;
    expect(legs && 'exercises' in legs && legs.exercises.map((e) => e.id)).toContain('leg-press');
  });

  it("snapshots the substitute's own progression suggestion", async () => {
    await lastWeek('squat', 95, 8);
    await startToday();
    await swapExercise(db, legPress.id, { exerciseId: 'squat' });
    expect((await slotById(legPress.id)).suggestedWeight).toBe(97.5);
  });

  it('uses rest for the original exercise type', async () => {
    await startToday();
    await swapExercise(db, legPress.id, { exerciseId: 'leg-extension' });
    const slot = await slotById(legPress.id);
    await completeSet(db, { slot, weight: 50, reps: 12, now: TUE });
    expect((await db.activeSession.get('active'))?.restEndsAt).toBe(
      new Date(TUE.getTime() + 150_000).toISOString(),
    );
  });

  it('picks a free id when the name is taken', async () => {
    await startToday();
    await db.exercises.add({
      id: 'hack-squat',
      name: 'Hack squat',
      type: 'compound',
      loadBasis: 'total',
      increment: 5,
      isCustom: true,
      muscle: 'quads',
    });
    await swapExercise(db, legPress.id, { newName: 'Hack squat' });
    expect((await slotById(legPress.id)).exerciseId).toBe('hack-squat-2');
  });

  it('can swap back to the original', async () => {
    await startToday();
    await swapExercise(db, legPress.id, { newName: 'Hack squat' });
    await swapExercise(db, legPress.id, { exerciseId: 'leg-press' });
    expect(await slotById(legPress.id)).toMatchObject({
      exerciseId: 'leg-press',
      replacesExerciseId: null,
    });
  });

  it('keeps the first original when swapping twice', async () => {
    await startToday();
    await swapExercise(db, legPress.id, { newName: 'Hack squat' });
    await swapExercise(db, legPress.id, { exerciseId: 'squat' });
    expect(await slotById(legPress.id)).toMatchObject({
      exerciseId: 'squat',
      replacesExerciseId: 'leg-press',
    });
  });

  it('refuses once sets are logged for the slot', async () => {
    await startToday();
    await completeSet(db, { slot: legPress, weight: 140, reps: 10, now: TUE });
    await expect(swapExercise(db, legPress.id, { newName: 'Hack squat' })).rejects.toBeInstanceOf(
      SwapNotAllowedError,
    );
  });

  it('rejects an unknown slot, exercise or empty name', async () => {
    await startToday();
    await expect(swapExercise(db, 'nope', { exerciseId: 'squat' })).rejects.toThrow(
      'Unknown session exercise nope',
    );
    await expect(swapExercise(db, legPress.id, { exerciseId: 'nope' })).rejects.toThrow(
      'Unknown exercise nope',
    );
    await expect(swapExercise(db, legPress.id, { newName: '   ' })).rejects.toThrow(
      'Exercise name is required',
    );
  });
});

describe('swapOptions', () => {
  it('recommends exercises for the same muscle group first', async () => {
    await startToday();
    const { recommended } = await swapOptions(db, legPress.id);
    expect(recommended.map((o) => o.name)).toEqual([
      'Back squat or Smith machine squat',
      'Leg extension',
    ]);
  });

  it('lists the rest same-type first by name, without the current or recommended ones', async () => {
    await startToday();
    const { recommended, others } = await swapOptions(db, legPress.id);
    const ids = others.map((o) => o.id);
    expect(ids).not.toContain('leg-press');
    expect(ids.some((id) => recommended.some((r) => r.id === id))).toBe(false);
    const firstIsolation = others.findIndex((o) => o.type === 'isolation');
    expect(firstIsolation).toBeGreaterThan(0);
    expect(others.slice(0, firstIsolation).every((o) => o.type === 'compound')).toBe(true);
    expect(others.slice(firstIsolation).every((o) => o.type === 'isolation')).toBe(true);
    expect(others[0]?.name).toBe('Assisted pull-up');
  });

  it('keeps recommending for the original after a swap', async () => {
    await startToday();
    await swapExercise(db, legPress.id, { exerciseId: 'face-pull' });
    const { recommended, others } = await swapOptions(db, legPress.id);
    expect(recommended.map((o) => o.id)).toEqual(['squat', 'leg-extension', 'leg-press']);
    expect(others.map((o) => o.id)).not.toContain('face-pull');
  });

  it('is empty for an unknown slot', async () => {
    expect(await swapOptions(db, 'nope')).toEqual({ recommended: [], others: [] });
  });
});
