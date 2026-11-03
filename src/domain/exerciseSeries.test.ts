import { describe, expect, it } from 'vitest';
import { exerciseSeries, rampUpRanges } from './exerciseSeries';

const s = (date: string, sets: [number, number][], rampUp = false) => ({
  date,
  rampUp,
  sets: sets.map(([weight, reps]) => ({ weight, reps })),
});

describe('exerciseSeries', () => {
  it('takes the top weight and the best reps at that weight, oldest first', () => {
    const series = exerciseSeries(
      [
        s('2026-11-16', [
          [12.5, 8],
          [12.5, 9],
          [10, 12],
        ]),
        s(
          '2026-11-09',
          [
            [10, 10],
            [10, 10],
          ],
          true,
        ),
      ],
      'per-side',
    );
    expect(series).toEqual([
      { date: '2026-11-09', topWeight: 10, bestReps: 10, rampUp: true },
      { date: '2026-11-16', topWeight: 12.5, bestReps: 9, rampUp: false },
    ]);
  });

  it('treats the least assistance as the top set for assisted exercises', () => {
    const series = exerciseSeries(
      [
        s('2026-11-16', [
          [40, 10],
          [35, 8],
        ]),
      ],
      'assistance',
    );
    expect(series[0]).toMatchObject({ topWeight: 35, bestReps: 8 });
  });

  it('skips sessions where the exercise has no sets', () => {
    expect(exerciseSeries([s('2026-11-16', [])], 'total')).toEqual([]);
  });
});

describe('rampUpRanges', () => {
  it('groups consecutive ramp-up sessions into ranges', () => {
    const points = [
      { date: '2026-11-03', rampUp: true },
      { date: '2026-11-10', rampUp: true },
      { date: '2026-11-17', rampUp: false },
      { date: '2026-11-24', rampUp: true },
    ];
    expect(rampUpRanges(points)).toEqual([
      { from: '2026-11-03', to: '2026-11-10' },
      { from: '2026-11-24', to: '2026-11-24' },
    ]);
  });

  it('is empty without ramp-up sessions', () => {
    expect(rampUpRanges([{ date: '2026-11-17', rampUp: false }])).toEqual([]);
  });
});
