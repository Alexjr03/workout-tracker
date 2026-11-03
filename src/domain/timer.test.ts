import { describe, expect, it } from 'vitest';
import { adjustEndsAt, formatClock, remainingSeconds, restEndsAt } from './timer';

const NOW = Date.parse('2026-11-23T18:00:00.000Z');
const iso = (ms: number) => new Date(ms).toISOString();

describe('restEndsAt', () => {
  it('uses the rest time for the exercise type', () => {
    const rest = { compound: 150, isolation: 75 };
    expect(restEndsAt('compound', rest, NOW)).toBe(iso(NOW + 150_000));
    expect(restEndsAt('isolation', rest, NOW)).toBe(iso(NOW + 75_000));
  });
});

describe('remainingSeconds', () => {
  it('counts whole seconds left, rounding up', () => {
    expect(remainingSeconds(iso(NOW + 150_000), NOW)).toBe(150);
    expect(remainingSeconds(iso(NOW + 1_200), NOW)).toBe(2);
  });

  it('is 0 once the time has passed, never negative', () => {
    expect(remainingSeconds(iso(NOW), NOW)).toBe(0);
    expect(remainingSeconds(iso(NOW - 60_000), NOW)).toBe(0);
  });
});

describe('adjustEndsAt', () => {
  it('adds or removes seconds', () => {
    expect(adjustEndsAt(iso(NOW + 60_000), 15, NOW)).toBe(iso(NOW + 75_000));
    expect(adjustEndsAt(iso(NOW + 60_000), -15, NOW)).toBe(iso(NOW + 45_000));
  });

  it('never moves the end before now', () => {
    expect(adjustEndsAt(iso(NOW + 10_000), -15, NOW)).toBe(iso(NOW));
  });

  it('restarts from now when adding to a finished timer', () => {
    expect(adjustEndsAt(iso(NOW - 30_000), 15, NOW)).toBe(iso(NOW + 15_000));
  });
});

describe('formatClock', () => {
  it('formats as m:ss', () => {
    expect(formatClock(150)).toBe('2:30');
    expect(formatClock(75)).toBe('1:15');
    expect(formatClock(5)).toBe('0:05');
    expect(formatClock(0)).toBe('0:00');
  });
});
