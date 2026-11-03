import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../../test/db';
import { db } from '../schema';
import { saveCardio } from './cardio';
import { swapExercise } from './exercises';
import { listHistory, sessionDetail } from './history';
import { updateTemplateExercise } from './routine';
import { discardSession, finishSession, startSession } from './sessions';
import { completeSet } from './sets';

const MON = new Date(2026, 10, 23, 18);
const at = (base: Date, minutes: number) => new Date(base.getTime() + minutes * 60_000);

async function upperA(start: Date) {
  const id = await startSession(db, 'upper-a', start);
  const [bench, row] = await db.sessionExercises.where('sessionId').equals(id).sortBy('order');
  if (!bench || !row) throw new Error('fixture');
  await completeSet(db, { slot: bench, weight: 10, reps: 10, now: at(start, 2) });
  await completeSet(db, { slot: bench, weight: 12.5, reps: 8, now: at(start, 5) });
  await completeSet(db, { slot: row, weight: 50, reps: 9, now: at(start, 9) });
  await finishSession(db, id, at(start, 45));
  return id;
}

beforeEach(async () => {
  await resetDb();
});

describe('listHistory', () => {
  it('lists finished sessions newest first with sets and minutes', async () => {
    const older = await upperA(MON);
    const cardio = await startSession(db, 'cardio', new Date(2026, 10, 26, 7));
    await saveCardio(
      db,
      cardio,
      { machine: 'StairMaster', durationMin: 35, notes: '' },
      new Date(2026, 10, 26, 7, 40),
    );

    expect(await listHistory(db)).toEqual([
      {
        id: cardio,
        date: '2026-11-26',
        name: 'Cardio',
        kind: 'cardio',
        sets: 0,
        minutes: 40,
        cardio: { machine: 'StairMaster', durationMin: 35 },
        swapped: false,
      },
      {
        id: older,
        date: '2026-11-23',
        name: 'Upper A',
        kind: 'lifting',
        sets: 3,
        minutes: 45,
        cardio: null,
        swapped: false,
      },
    ]);
  });

  it('leaves out active and discarded sessions', async () => {
    await upperA(MON);
    const discarded = await startSession(db, 'legs', new Date(2026, 10, 24, 18));
    await discardSession(db, discarded);
    await startSession(db, 'upper-b', new Date(2026, 10, 25, 18));
    expect((await listHistory(db)).map((s) => s.name)).toEqual(['Upper A']);
  });

  it('marks sessions with a swapped exercise', async () => {
    const id = await startSession(db, 'legs', new Date(2026, 10, 24, 18));
    const slot = (await db.sessionExercises.where('sessionId').equals(id).toArray()).find(
      (s) => s.exerciseId === 'leg-press',
    );
    if (!slot) throw new Error('fixture');
    await swapExercise(db, slot.id, { newName: 'Hack squat' });
    await finishSession(db, id, new Date(2026, 10, 24, 19));
    expect((await listHistory(db))[0]?.swapped).toBe(true);
  });

  it('pages through long histories', async () => {
    for (let d = 0; d < 5; d++) {
      const id = await startSession(db, 'cardio', new Date(2026, 10, 10 + d, 7));
      await saveCardio(
        db,
        id,
        { machine: 'StairMaster', durationMin: 30, notes: '' },
        new Date(2026, 10, 10 + d, 8),
      );
    }
    const first = await listHistory(db, { limit: 2 });
    const next = await listHistory(db, { limit: 2, offset: 2 });
    expect(first.map((s) => s.date)).toEqual(['2026-11-14', '2026-11-13']);
    expect(next.map((s) => s.date)).toEqual(['2026-11-12', '2026-11-11']);
  });
});

describe('sessionDetail', () => {
  it('shows each exercise with its logged sets and the prescription it had', async () => {
    const id = await upperA(MON);
    await updateTemplateExercise(db, 'upper-a', 0, { sets: 5, repMin: 4, repMax: 6 });

    const detail = await sessionDetail(db, id);
    expect(detail?.name).toBe('Upper A');
    expect(detail?.exercises[0]).toEqual({
      name: 'Bench press',
      replacesName: null,
      prescribedSets: 3,
      optionalSets: 0,
      repMin: 8,
      repMax: 10,
      rirTarget: '1-2',
      unit: 'lb/side',
      sets: [
        { weight: 10, reps: 10 },
        { weight: 12.5, reps: 8 },
      ],
    });
    expect(detail?.exercises).toHaveLength(6);
    expect(detail?.exercises[2]?.sets).toEqual([]);
  });

  it('names the original of a swapped exercise', async () => {
    const id = await startSession(db, 'legs', new Date(2026, 10, 24, 18));
    const slot = (await db.sessionExercises.where('sessionId').equals(id).toArray()).find(
      (s) => s.exerciseId === 'leg-press',
    );
    if (!slot) throw new Error('fixture');
    await swapExercise(db, slot.id, { newName: 'Hack squat' });
    await finishSession(db, id);
    const detail = await sessionDetail(db, id);
    expect(detail?.exercises.find((e) => e.name === 'Hack squat')?.replacesName).toBe('Leg press');
  });

  it('includes cardio details', async () => {
    const id = await startSession(db, 'cardio', MON);
    await saveCardio(db, id, { machine: 'StairMaster', durationMin: 35, notes: 'Level 7' }, MON);
    expect((await sessionDetail(db, id))?.cardio).toEqual({
      machine: 'StairMaster',
      durationMin: 35,
      notes: 'Level 7',
    });
  });

  it('is null for an unknown session', async () => {
    expect(await sessionDetail(db, 'nope')).toBeNull();
  });
});
