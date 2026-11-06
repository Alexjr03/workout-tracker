import { describe, expect, it } from 'vitest';
import {
  monthCells,
  monthLabel,
  monthOf,
  shiftMonth,
  weightIncreases,
  type ExerciseBest,
} from './historyStats';

describe('months', () => {
  it('names and moves between months, across years', () => {
    expect(monthOf('2026-11-06')).toBe('2026-11');
    expect(monthLabel('2026-11')).toBe('November 2026');
    expect(shiftMonth('2026-11', 1)).toBe('2026-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('lays a month out Monday-first with blanks before the 1st', () => {
    // Nov 1 2026 is a Sunday: six blanks.
    const nov = monthCells('2026-11');
    expect(nov.slice(0, 7)).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(nov.at(-1)).toBe('2026-11-30');
    expect(nov).toHaveLength(36);
    // Jun 1 2026 is a Monday: no blanks.
    expect(monthCells('2026-06')[0]).toBe('2026-06-01');
    expect(monthCells('2026-02')).toHaveLength(28 + 6);
  });
});

describe('weightIncreases', () => {
  const best = (sessionId: string, exerciseId: string, weight: number, lowerIsBetter = false) =>
    ({
      sessionId,
      exerciseId,
      name: exerciseId,
      unit: 'lb',
      weight,
      lowerIsBetter,
    }) as ExerciseBest;

  it('marks a session that beats every earlier one, not the first time or a repeat', () => {
    const result = weightIncreases([
      best('s1', 'bench', 135),
      best('s2', 'bench', 135),
      best('s3', 'bench', 140),
      best('s4', 'bench', 130),
      best('s4', 'row', 100),
      best('s5', 'bench', 145),
      best('s5', 'row', 110),
    ]);
    expect([...result.keys()]).toEqual(['s3', 's5']);
    expect(result.get('s3')).toEqual([{ name: 'bench', weight: 140, unit: 'lb' }]);
    expect(result.get('s5')?.map((i) => i.name)).toEqual(['bench', 'row']);
  });

  it('counts less assistance as better for assisted exercises', () => {
    const result = weightIncreases([
      best('s1', 'pull-up', 50, true),
      best('s2', 'pull-up', 60, true),
      best('s3', 'pull-up', 40, true),
    ]);
    expect([...result.keys()]).toEqual(['s3']);
  });
});
