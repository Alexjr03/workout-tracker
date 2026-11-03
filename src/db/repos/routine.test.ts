import { beforeEach, describe, expect, it } from 'vitest';
import { sessionForDate } from '../../domain/schedule';
import { resetDb } from '../../test/db';
import { db } from '../schema';
import {
  addTemplateExercise,
  moveTemplateExercise,
  removeTemplateExercise,
  RoutineError,
  setScheduleDay,
  updateExercise,
  updateTemplateExercise,
} from './routine';
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

describe('session template edits', () => {
  const exercisesOf = async (templateId: string) => {
    const t = (await routine()).sessions[templateId];
    if (!t || !('exercises' in t)) throw new Error('not a lifting template');
    return t.exercises;
  };

  it('changes sets and rep range', async () => {
    await updateTemplateExercise(db, 'upper-a', 0, { sets: 4, repMin: 6, repMax: 8 });
    expect((await exercisesOf('upper-a'))[0]).toMatchObject({
      id: 'bench-press',
      sets: 4,
      repMin: 6,
      repMax: 8,
    });
  });

  it.each([
    [{ sets: 0 }, 'Sets must be at least 1.'],
    [{ repMin: 0 }, 'Reps must be at least 1.'],
    [{ repMin: 11 }, "Rep min can't be more than rep max."],
  ])('rejects %o', async (patch, message) => {
    await expect(updateTemplateExercise(db, 'upper-a', 0, patch)).rejects.toThrow(
      new RoutineError(message),
    );
    expect((await exercisesOf('upper-a'))[0]).toMatchObject({ sets: 3, repMin: 8, repMax: 10 });
  });

  it('a sets change affects the next session, not an active or finished one', async () => {
    const past = await startSession(db, 'upper-a', new Date(2026, 10, 23, 18));
    await finishSession(db, past);
    const active = await startSession(db, 'upper-a', new Date(2026, 10, 30, 18));

    await updateTemplateExercise(db, 'upper-a', 0, { sets: 4 });

    const benchOf = async (id: string) =>
      (await db.sessionExercises.where('sessionId').equals(id).sortBy('order'))[0]?.prescribedSets;
    expect(await benchOf(past)).toBe(3);
    expect(await benchOf(active)).toBe(3);
    await finishSession(db, active);
    expect(await benchOf(await startSession(db, 'upper-a', new Date(2026, 11, 7, 18)))).toBe(4);
  });

  it('moves exercises up and down, ignoring moves past either end', async () => {
    await moveTemplateExercise(db, 'upper-a', 1, -1);
    expect((await exercisesOf('upper-a')).map((e) => e.id).slice(0, 2)).toEqual([
      'machine-row',
      'bench-press',
    ]);
    await moveTemplateExercise(db, 'upper-a', 0, -1);
    await moveTemplateExercise(db, 'upper-a', 5, 1);
    expect((await exercisesOf('upper-a'))[5]?.id).toBe('triceps-pushdown');
  });

  it('removes an exercise but keeps its history', async () => {
    const id = await startSession(db, 'upper-a', new Date(2026, 10, 23, 18));
    const slots = await db.sessionExercises.where('sessionId').equals(id).sortBy('order');
    const triceps = slots.find((s) => s.exerciseId === 'triceps-pushdown');
    if (!triceps) throw new Error('fixture');
    await completeSet(db, { slot: triceps, weight: 40, reps: 12 });
    await finishSession(db, id);

    await removeTemplateExercise(db, 'upper-a', 5);
    expect((await exercisesOf('upper-a')).map((e) => e.id)).not.toContain('triceps-pushdown');
    expect(await db.sets.where('exerciseId').equals('triceps-pushdown').count()).toBe(1);
    expect(await db.exercises.get('triceps-pushdown')).toBeDefined();
  });

  it('keeps at least one exercise', async () => {
    for (let i = 0; i < 5; i++) await removeTemplateExercise(db, 'upper-a', 0);
    await expect(removeTemplateExercise(db, 'upper-a', 0)).rejects.toThrow(
      new RoutineError('A session needs at least one exercise.'),
    );
  });

  it('adds a catalog exercise with default sets and reps', async () => {
    await addTemplateExercise(db, 'upper-a', 'face-pull');
    expect((await exercisesOf('upper-a')).at(-1)).toEqual({
      id: 'face-pull',
      name: 'Face pull',
      type: 'isolation',
      sets: 3,
      repMin: 8,
      repMax: 12,
    });
  });

  it('refuses duplicates, unknown exercises and cardio sessions', async () => {
    await expect(addTemplateExercise(db, 'upper-a', 'bench-press')).rejects.toThrow(
      new RoutineError('Bench press is already in this session.'),
    );
    await expect(addTemplateExercise(db, 'upper-a', 'nope')).rejects.toThrow(
      new RoutineError('Unknown exercise nope.'),
    );
    await expect(addTemplateExercise(db, 'cardio', 'face-pull')).rejects.toThrow(
      new RoutineError('Cardio sessions have no exercises to edit.'),
    );
    await expect(updateTemplateExercise(db, 'nope', 0, { sets: 2 })).rejects.toThrow(
      new RoutineError('Unknown session nope.'),
    );
  });
});
