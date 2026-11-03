import { describe, expect, it } from 'vitest';
import type { TemplateExercise } from '../db/types';
import { addDays } from './dates';
import { prescriptionFor, rirText } from './rampUp';

const START = '2026-11-03';
const settings = { programStartDate: START, rampUpWeeks: 2 };

const bench: TemplateExercise = {
  id: 'bench-press',
  name: 'Bench press',
  type: 'compound',
  sets: 3,
  repMin: 8,
  repMax: 10,
};
const oneSet: TemplateExercise = { ...bench, id: 'one', sets: 1 };

describe('prescriptionFor', () => {
  it('drops one set and targets ~3 reps in reserve on day 0', () => {
    expect(prescriptionFor(bench, START, settings)).toEqual({
      sets: 2,
      repMin: 8,
      repMax: 10,
      rirTarget: '~3',
      rampUp: true,
    });
  });

  it('is still ramp-up on day 13', () => {
    expect(prescriptionFor(bench, addDays(START, 13), settings)).toMatchObject({
      sets: 2,
      rirTarget: '~3',
      rampUp: true,
    });
  });

  it('switches to full sets and 1-2 reps in reserve on day 14', () => {
    expect(prescriptionFor(bench, addDays(START, 14), settings)).toEqual({
      sets: 3,
      repMin: 8,
      repMax: 10,
      rirTarget: '1-2',
      rampUp: false,
    });
  });

  it('never goes below 1 set', () => {
    expect(prescriptionFor(oneSet, START, settings).sets).toBe(1);
  });

  it('treats dates before the start as ramp-up', () => {
    expect(prescriptionFor(bench, addDays(START, -3), settings).rampUp).toBe(true);
  });

  it('skips ramp-up entirely when rampUpWeeks is 0', () => {
    const none = { programStartDate: START, rampUpWeeks: 0 };
    expect(prescriptionFor(bench, START, none)).toMatchObject({ sets: 3, rampUp: false });
    expect(prescriptionFor(bench, addDays(START, -1), none).rampUp).toBe(false);
  });

  it('follows a longer ramp-up', () => {
    const three = { programStartDate: START, rampUpWeeks: 3 };
    expect(prescriptionFor(bench, addDays(START, 20), three).rampUp).toBe(true);
    expect(prescriptionFor(bench, addDays(START, 21), three).rampUp).toBe(false);
  });
});

describe('rirText', () => {
  it('describes the reps-in-reserve target', () => {
    expect(rirText('~3')).toBe('leave ~3 reps in reserve');
    expect(rirText('1-2')).toBe('leave 1–2 reps in reserve');
  });
});
