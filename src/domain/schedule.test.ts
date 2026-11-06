import { describe, expect, it } from 'vitest';
import routineJson from '../seed/routine.json';
import type { Schedule } from '../db/types';
import { addDays } from './dates';
import { canPushBack, pushBacksLeft, sessionForDate, weekStart } from './schedule';

const routine = { schedule: routineJson.schedule as Schedule };

describe('sessionForDate', () => {
  it('maps each weekday to the seed schedule', () => {
    // 2026-11-02 is a Monday.
    expect(sessionForDate('2026-11-02', routine)).toBe('upper-a');
    expect(sessionForDate('2026-11-03', routine)).toBe('legs');
    expect(sessionForDate('2026-11-04', routine)).toBe('upper-b');
    expect(sessionForDate('2026-11-05', routine)).toBe('cardio');
    expect(sessionForDate('2026-11-06', routine)).toBe('shoulders-arms');
  });

  it('returns rest on Saturday and Sunday', () => {
    expect(sessionForDate('2026-11-07', routine)).toBe('rest');
    expect(sessionForDate('2026-11-08', routine)).toBe('rest');
  });

  it('follows an edited schedule', () => {
    const edited = { schedule: { ...routine.schedule, thursday: 'upper-a' } };
    expect(sessionForDate('2026-11-05', edited)).toBe('upper-a');
  });
});

describe('push back a day', () => {
  // Week of Mon 2026-11-02 … Sun 2026-11-08.
  const week = (pushBacks: string[], from = '2026-11-02') =>
    Array.from({ length: 7 }, (_, i) => sessionForDate(addDays(from, i), routine, pushBacks));

  it('finds the Monday of a week', () => {
    expect(weekStart('2026-11-02')).toBe('2026-11-02');
    expect(weekStart('2026-11-05')).toBe('2026-11-02');
    expect(weekStart('2026-11-08')).toBe('2026-11-02');
  });

  it('shifts the rest of the week one day, using a weekend rest day', () => {
    expect(week(['2026-11-02'])).toEqual([
      'rest',
      'upper-a',
      'legs',
      'upper-b',
      'cardio',
      'shoulders-arms',
      'rest',
    ]);
  });

  it('can be done twice, using both rest days', () => {
    expect(week(['2026-11-02', '2026-11-03'])).toEqual([
      'rest',
      'rest',
      'upper-a',
      'legs',
      'upper-b',
      'cardio',
      'shoulders-arms',
    ]);
  });

  it('can start mid-week', () => {
    expect(week(['2026-11-04'])).toEqual([
      'upper-a',
      'legs',
      'rest',
      'upper-b',
      'cardio',
      'shoulders-arms',
      'rest',
    ]);
  });

  it('resets on Monday', () => {
    expect(week(['2026-11-02'], '2026-11-09')).toEqual([
      'upper-a',
      'legs',
      'upper-b',
      'cardio',
      'shoulders-arms',
      'rest',
      'rest',
    ]);
  });

  it('ignores a push-back with no rest day left to use, or on a rest day', () => {
    expect(week(['2026-11-02', '2026-11-03', '2026-11-04'])).toEqual(
      week(['2026-11-02', '2026-11-03']),
    );
    expect(week(['2026-11-07'])).toEqual(week([]));
  });

  it('says whether today can be pushed back', () => {
    expect(canPushBack('2026-11-02', routine, [])).toBe(true);
    expect(canPushBack('2026-11-03', routine, ['2026-11-02'])).toBe(true);
    expect(canPushBack('2026-11-04', routine, ['2026-11-02', '2026-11-03'])).toBe(false);
    expect(canPushBack('2026-11-07', routine, [])).toBe(false); // rest day
    expect(canPushBack('2026-11-06', routine, [])).toBe(true); // Friday → Saturday
  });

  it('counts push-backs left this week', () => {
    expect(pushBacksLeft('2026-11-02', routine, [])).toBe(2);
    expect(pushBacksLeft('2026-11-03', routine, ['2026-11-02'])).toBe(1);
    expect(pushBacksLeft('2026-11-06', routine, [])).toBe(2);
    expect(pushBacksLeft('2026-11-09', routine, ['2026-11-02', '2026-11-03'])).toBe(2);
  });
});
