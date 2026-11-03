import { describe, expect, it } from 'vitest';
import routineJson from '../seed/routine.json';
import type { Schedule } from '../db/types';
import { sessionForDate } from './schedule';

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
