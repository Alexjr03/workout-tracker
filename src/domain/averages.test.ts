import { describe, expect, it } from 'vitest';
import { sevenDayAverage } from './averages';

const e = (date: string, kg: number) => ({ date, kg });

describe('sevenDayAverage', () => {
  it('averages the entries in the 7 calendar days up to and including the date', () => {
    const entries = [e('2026-11-01', 90), e('2026-11-02', 88), e('2026-11-08', 86)];
    // Window for Nov 8 is Nov 2 … Nov 8: Nov 1 is 7 days back, so it is left out.
    expect(sevenDayAverage(entries, '2026-11-08')).toBe(87);
    // Window for Nov 7 is Nov 1 … Nov 7.
    expect(sevenDayAverage(entries, '2026-11-07')).toBe(89);
  });

  it('skips days without an entry', () => {
    expect(sevenDayAverage([e('2026-11-03', 88.2), e('2026-11-06', 87.6)], '2026-11-06')).toBe(
      87.9,
    );
  });

  it('is the entry itself with a single entry', () => {
    expect(sevenDayAverage([e('2026-11-06', 87.4)], '2026-11-06')).toBe(87.4);
  });

  it('ignores entries after the date', () => {
    expect(sevenDayAverage([e('2026-11-06', 87), e('2026-11-07', 80)], '2026-11-06')).toBe(87);
  });

  it('is null when the window has no entries', () => {
    expect(sevenDayAverage([e('2026-10-01', 90)], '2026-11-06')).toBeNull();
  });
});
