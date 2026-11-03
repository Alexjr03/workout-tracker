import { describe, expect, it } from 'vitest';
import { addDays, daysBetween, formatDayLabel, isLocalDate, toLocalDate, weekdayOf } from './dates';

describe('toLocalDate', () => {
  it('uses the local calendar day, not UTC', () => {
    expect(toLocalDate(new Date(2026, 10, 3, 0, 5))).toBe('2026-11-03');
    expect(toLocalDate(new Date(2026, 10, 3, 23, 59))).toBe('2026-11-03');
  });

  it('pads month and day', () => {
    expect(toLocalDate(new Date(2027, 0, 9, 12))).toBe('2027-01-09');
  });
});

describe('addDays', () => {
  it('adds and subtracts across month and year ends', () => {
    expect(addDays('2026-11-03', 14)).toBe('2026-11-17');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('is not shifted by DST changes', () => {
    // US DST starts 2026-03-08 and ends 2026-11-01.
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-10-31', 2)).toBe('2026-11-02');
  });
});

describe('daysBetween', () => {
  it('counts whole calendar days, signed', () => {
    expect(daysBetween('2026-11-03', '2026-11-17')).toBe(14);
    expect(daysBetween('2026-11-17', '2026-11-03')).toBe(-14);
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
  });
});

describe('weekdayOf', () => {
  it('names the weekday of a calendar date', () => {
    expect(weekdayOf('2026-11-02')).toBe('monday');
    expect(weekdayOf('2026-11-03')).toBe('tuesday');
    expect(weekdayOf('2026-11-08')).toBe('sunday');
  });
});

describe('formatDayLabel', () => {
  it('reads as weekday, month and day', () => {
    expect(formatDayLabel('2026-11-23')).toBe('Monday, Nov 23');
    expect(formatDayLabel('2027-01-02')).toBe('Saturday, Jan 2');
  });
});

describe('isLocalDate', () => {
  it('accepts real YYYY-MM-DD dates only', () => {
    expect(isLocalDate('2026-11-03')).toBe(true);
    expect(isLocalDate('2026-02-30')).toBe(false);
    expect(isLocalDate('2026-11-3')).toBe(false);
    expect(isLocalDate('not a date')).toBe(false);
  });
});
