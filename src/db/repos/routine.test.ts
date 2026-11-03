import { beforeEach, describe, expect, it } from 'vitest';
import { sessionForDate } from '../../domain/schedule';
import { resetDb } from '../../test/db';
import { db } from '../schema';
import { RoutineError, setScheduleDay, updateExercise } from './routine';
import { finishSession, startSession } from './sessions';
import { completeSet } from './sets';

beforeEach(async () => {
  await resetDb();
});

const routine = async () => {
  const r = await db.routine.get('routine');
  if (!r) throw new Error('not seeded');
  return r;
};

describe('setScheduleDay', () => {
  it('changes which session a weekday shows', async () => {
    await setScheduleDay(db, 'thursday', 'upper-a');
    // 2026-11-26 is a Thursday.
    expect(sessionForDate('2026-11-26', await routine())).toBe('upper-a');
  });

  it('can make a day a rest day', async () => {
    await setScheduleDay(db, 'monday', 'rest');
    expect((await routine()).schedule.monday).toBe('rest');
  });

  it('rejects a session that does not exist', async () => {
    await expect(setScheduleDay(db, 'monday', 'nope')).rejects.toThrow(
      new RoutineError('Unknown session nope.'),
    );
    expect((await routine()).schedule.monday).toBe('upper-a');
  });
});

describe('updateExercise', () => {
  it('changes name, type, load basis and increment', async () => {
    await updateExercise(db, 'lateral-raise', {
      name: 'Cable lateral raise',
      type: 'isolation',
      loadBasis: 'total',
      increment: 2.5,
    });
    expect(await db.exercises.get('lateral-raise')).toMatchObject({
      name: 'Cable lateral raise',
      loadBasis: 'total',
      increment: 2.5,
    });
  });

  it('keeps the routine templates in step with the new name and type', async () => {
    await updateExercise(db, 'lateral-raise', { name: 'Cable lateral raise', type: 'compound' });
    const r = await routine();
    const uses = Object.values(r.sessions).flatMap((s) =>
      'exercises' in s ? s.exercises.filter((e) => e.id === 'lateral-raise') : [],
    );
    expect(uses).toHaveLength(3);
    expect(uses.every((e) => e.name === 'Cable lateral raise' && e.type === 'compound')).toBe(true);
  });

  it.each([
    [{ increment: 0 }, 'Increment must be more than 0 lb.'],
    [{ name: '   ' }, 'Name is required.'],
  ])('rejects %o', async (patch, message) => {
    await expect(updateExercise(db, 'bench-press', patch)).rejects.toThrow(
      new RoutineError(message),
    );
    expect((await db.exercises.get('bench-press'))?.increment).toBe(2.5);
  });

  it('rejects an unknown exercise', async () => {
    await expect(updateExercise(db, 'nope', { increment: 5 })).rejects.toThrow(
      new RoutineError('Unknown exercise nope.'),
    );
  });

  it('does not change values already logged', async () => {
    const id = await startSession(db, 'upper-a', new Date(2026, 10, 23, 18));
    const [bench] = await db.sessionExercises.where('sessionId').equals(id).sortBy('order');
    if (!bench) throw new Error('fixture');
    await completeSet(db, { slot: bench, weight: 10, reps: 10 });
    await finishSession(db, id);

    await updateExercise(db, 'bench-press', { loadBasis: 'total', increment: 5 });
    const [set] = await db.sets.toArray();
    expect(set).toMatchObject({ weight: 10, reps: 10, exerciseId: 'bench-press' });
    expect(await db.sessionExercises.get(bench.id)).toEqual(bench);
  });
});
