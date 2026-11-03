import { describe, expect, it } from 'vitest';
import { sessionSummary } from './summary';

const bench = { name: 'Bench press', loadBasis: 'per-side' as const, increment: 2.5 };
const row = { name: 'Machine row', loadBasis: 'total' as const, increment: 5 };

const sets = (pairs: [number, number][]) =>
  pairs.map(([weight, reps], setIndex) => ({ setIndex, weight, reps }));

describe('sessionSummary', () => {
  it('counts sets, minutes and progressions earned', () => {
    const summary = sessionSummary({
      startedAt: '2026-11-23T18:00:00.000Z',
      finishedAt: '2026-11-23T18:47:40.000Z',
      exercises: [
        {
          def: bench,
          prescribedSets: 3,
          optionalSets: 0,
          repMax: 10,
          sets: sets([
            [10, 10],
            [10, 10],
            [10, 10],
          ]),
        },
        {
          def: row,
          prescribedSets: 3,
          optionalSets: 0,
          repMax: 10,
          sets: sets([
            [50, 10],
            [50, 8],
          ]),
        },
      ],
    });
    expect(summary).toEqual({
      setsDone: 5,
      setsPrescribed: 6,
      minutes: 48,
      progressions: [{ name: 'Bench press', next: 12.5, loadBasis: 'per-side' }],
    });
  });

  it('counts an optional set only when it was done', () => {
    const summary = sessionSummary({
      startedAt: '2026-11-23T18:00:00.000Z',
      finishedAt: '2026-11-23T18:30:00.000Z',
      exercises: [
        {
          def: bench,
          prescribedSets: 3,
          optionalSets: 1,
          repMax: 10,
          sets: sets([
            [10, 10],
            [10, 10],
          ]),
        },
        {
          def: row,
          prescribedSets: 3,
          optionalSets: 1,
          repMax: 10,
          sets: sets([
            [50, 9],
            [50, 9],
            [50, 8],
          ]),
        },
      ],
    });
    expect(summary).toMatchObject({
      setsDone: 5,
      setsPrescribed: 5,
      progressions: [{ name: 'Bench press', next: 12.5, loadBasis: 'per-side' }],
    });
  });

  it('handles a session with nothing logged', () => {
    expect(
      sessionSummary({
        startedAt: '2026-11-23T18:00:00.000Z',
        finishedAt: '2026-11-23T18:00:20.000Z',
        exercises: [{ def: row, prescribedSets: 3, optionalSets: 0, repMax: 10, sets: [] }],
      }),
    ).toEqual({ setsDone: 0, setsPrescribed: 3, minutes: 0, progressions: [] });
  });
});
