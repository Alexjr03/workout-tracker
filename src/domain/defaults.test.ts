import { describe, expect, it } from 'vitest';
import { defaultReps, defaultWeight, latestWeightFor } from './defaults';

describe('defaultWeight', () => {
  const none = {
    previousSetWeight: null,
    suggestion: null,
    lastLoggedWeight: null,
    startingLoad: null,
  };

  it('prefers the previous set in this session', () => {
    expect(
      defaultWeight({
        previousSetWeight: 15,
        suggestion: 12.5,
        lastLoggedWeight: 10,
        startingLoad: 10,
      }),
    ).toBe(15);
  });

  it('then the progression suggestion', () => {
    expect(
      defaultWeight({ ...none, suggestion: 12.5, lastLoggedWeight: 10, startingLoad: 10 }),
    ).toBe(12.5);
  });

  it('then the last logged weight', () => {
    expect(defaultWeight({ ...none, lastLoggedWeight: 10, startingLoad: 5 })).toBe(10);
  });

  it('then the starting load', () => {
    expect(defaultWeight({ ...none, startingLoad: 10 })).toBe(10);
  });

  it('is null when nothing is known (number pad opens)', () => {
    expect(defaultWeight(none)).toBeNull();
  });

  it('keeps a real 0 instead of falling through', () => {
    expect(defaultWeight({ ...none, previousSetWeight: 0, lastLoggedWeight: 20 })).toBe(0);
  });
});

describe('latestWeightFor', () => {
  const sets = [
    { exerciseId: 'leg-press', weight: 90, completedAt: '2026-10-27T18:00:00.000Z' },
    { exerciseId: 'hack-squat', weight: 50, completedAt: '2026-11-03T18:10:00.000Z' },
    { exerciseId: 'leg-press', weight: 95, completedAt: '2026-10-27T18:05:00.000Z' },
  ];

  it('returns the most recent weight for that exercise only', () => {
    expect(latestWeightFor(sets, 'leg-press')).toBe(95);
    expect(latestWeightFor(sets, 'hack-squat')).toBe(50);
  });

  it('is null for an exercise never logged', () => {
    expect(latestWeightFor(sets, 'calf-raise')).toBeNull();
  });
});

describe('defaultReps', () => {
  const lastTime = [
    { setIndex: 0, reps: 10 },
    { setIndex: 1, reps: 9 },
  ];

  it('uses the same set index from last time', () => {
    expect(defaultReps({ setIndex: 1, lastTimeSets: lastTime, repMax: 10 })).toBe(9);
  });

  it('falls back to repMax', () => {
    expect(defaultReps({ setIndex: 2, lastTimeSets: lastTime, repMax: 10 })).toBe(10);
    expect(defaultReps({ setIndex: 0, lastTimeSets: [], repMax: 12 })).toBe(12);
  });
});
