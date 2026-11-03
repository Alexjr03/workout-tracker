import { describe, expect, it } from 'vitest';
import { progressionSuggestion, type ExerciseHistoryEntry } from './progression';

const bench = { loadBasis: 'per-side' as const, increment: 2.5 };
const pullUp = { loadBasis: 'assistance' as const, increment: 5 };

function entry(
  sets: [weight: number, reps: number][],
  opts: Partial<Omit<ExerciseHistoryEntry, 'sets'>> = {},
): ExerciseHistoryEntry {
  return {
    finishedAt: '2026-11-02T18:00:00.000Z',
    prescribedSets: 3,
    repMax: 10,
    sets: sets.map(([weight, reps], setIndex) => ({ setIndex, weight, reps })),
    ...opts,
  };
}

describe('progressionSuggestion', () => {
  it('suggests +2.5 lb/side for bench after 10/10/10 at 10', () => {
    const history = [
      entry([
        [10, 10],
        [10, 10],
        [10, 10],
      ]),
    ];
    expect(progressionSuggestion(history, bench)).toBe(12.5);
  });

  it('counts reps above repMax as reaching it', () => {
    const history = [
      entry([
        [10, 12],
        [10, 11],
        [10, 10],
      ]),
    ];
    expect(progressionSuggestion(history, bench)).toBe(12.5);
  });

  it('returns null when one set falls short', () => {
    const history = [
      entry([
        [10, 10],
        [10, 9],
        [10, 10],
      ]),
    ];
    expect(progressionSuggestion(history, bench)).toBeNull();
  });

  it('returns null when a prescribed set is missing', () => {
    const history = [
      entry([
        [10, 10],
        [10, 10],
      ]),
    ];
    expect(progressionSuggestion(history, bench)).toBeNull();
  });

  it('ignores extra sets beyond the prescription', () => {
    const history = [
      entry(
        [
          [10, 10],
          [10, 10],
          [10, 6],
        ],
        { prescribedSets: 2 },
      ),
    ];
    expect(progressionSuggestion(history, bench)).toBe(12.5);
  });

  it('builds on the lowest weight when weights were mixed', () => {
    const history = [
      entry([
        [12.5, 10],
        [10, 10],
        [12.5, 10],
      ]),
    ];
    expect(progressionSuggestion(history, bench)).toBe(12.5);
  });

  it('suggests during ramp-up when both of 2 prescribed sets hit max', () => {
    const history = [
      entry(
        [
          [10, 10],
          [10, 10],
        ],
        { prescribedSets: 2 },
      ),
    ];
    expect(progressionSuggestion(history, bench)).toBe(12.5);
  });

  it('uses only the most recent session', () => {
    const older = entry(
      [
        [10, 10],
        [10, 10],
        [10, 10],
      ],
      { finishedAt: '2026-10-26T18:00:00.000Z' },
    );
    const newer = entry(
      [
        [12.5, 8],
        [12.5, 8],
        [12.5, 7],
      ],
      { finishedAt: '2026-11-02T18:00:00.000Z' },
    );
    expect(progressionSuggestion([newer, older], bench)).toBeNull();
    expect(progressionSuggestion([older, newer], bench)).toBeNull();
  });

  it('returns null with no history', () => {
    expect(progressionSuggestion([], bench)).toBeNull();
  });

  it('suggests less assistance for assisted exercises', () => {
    const history = [
      entry([
        [40, 10],
        [40, 10],
        [40, 10],
      ]),
    ];
    expect(progressionSuggestion(history, pullUp)).toBe(35);
  });

  it('never suggests assistance below 0, and nothing once at 0', () => {
    const near = [
      entry([
        [3, 10],
        [3, 10],
        [3, 10],
      ]),
    ];
    expect(progressionSuggestion(near, pullUp)).toBe(0);
    const zero = [
      entry([
        [0, 10],
        [0, 10],
        [0, 10],
      ]),
    ];
    expect(progressionSuggestion(zero, pullUp)).toBeNull();
  });

  it('avoids floating point drift', () => {
    const history = [
      entry([
        [0.1, 10],
        [0.1, 10],
        [0.1, 10],
      ]),
    ];
    expect(progressionSuggestion(history, { loadBasis: 'total', increment: 0.2 })).toBe(0.3);
  });
});
