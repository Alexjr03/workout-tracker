import { describe, expect, it } from 'vitest';
import { loadBasisLabel, nextExerciseIndex, requiredSets, targetSets } from './session';

const slots = [{ prescribedSets: 3 }, { prescribedSets: 2 }, { prescribedSets: 1 }];

describe('nextExerciseIndex', () => {
  it('stays on the current exercise while it has sets left', () => {
    expect(nextExerciseIndex(slots, [1, 0, 0], 0)).toBe(0);
  });

  it('moves to the next exercise with sets left', () => {
    expect(nextExerciseIndex(slots, [3, 0, 0], 0)).toBe(1);
    expect(nextExerciseIndex(slots, [3, 2, 0], 1)).toBe(2);
  });

  it('skips exercises already finished out of order', () => {
    expect(nextExerciseIndex(slots, [3, 2, 0], 0)).toBe(2);
  });

  it('wraps back to an earlier unfinished exercise', () => {
    expect(nextExerciseIndex(slots, [1, 2, 1], 2)).toBe(0);
  });

  it('returns slots.length when every set is done', () => {
    expect(nextExerciseIndex(slots, [3, 2, 1], 2)).toBe(3);
  });

  it('counts exercises with no logged sets yet as 0', () => {
    expect(nextExerciseIndex(slots, [3], 0)).toBe(1);
  });

  it('treats extra logged sets as done', () => {
    expect(nextExerciseIndex(slots, [4, 0, 0], 0)).toBe(1);
  });
});

describe('loadBasisLabel', () => {
  it('names the unit for each load basis', () => {
    expect(loadBasisLabel('per-side')).toBe('lb/side');
    expect(loadBasisLabel('per-dumbbell')).toBe('lb each');
    expect(loadBasisLabel('total')).toBe('lb');
    expect(loadBasisLabel('assistance')).toBe('lb assist');
  });
});

describe('requiredSets / targetSets', () => {
  const rampUp = { prescribedSets: 3, optionalSets: 1, optionalSkipped: false };

  it('counts the optional last set as a target until it is skipped', () => {
    expect(requiredSets(rampUp)).toBe(2);
    expect(targetSets(rampUp)).toBe(3);
    expect(targetSets({ ...rampUp, optionalSkipped: true })).toBe(2);
  });

  it('treats everything as required when nothing is optional', () => {
    const normal = { prescribedSets: 3, optionalSets: 0, optionalSkipped: false };
    expect(requiredSets(normal)).toBe(3);
    expect(targetSets(normal)).toBe(3);
  });
});
