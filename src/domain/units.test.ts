import { describe, expect, it } from 'vitest';
import { convertIncrement, convertWeight } from './units';

describe('convertWeight', () => {
  it('converts lb to kg, rounded to 0.25 kg', () => {
    expect(convertWeight(10, 'lb', 'kg')).toBe(4.5);
    expect(convertWeight(12.5, 'lb', 'kg')).toBe(5.75);
    expect(convertWeight(140, 'lb', 'kg')).toBe(63.5);
  });

  it('converts kg to lb, rounded to 0.5 lb', () => {
    expect(convertWeight(4.5, 'kg', 'lb')).toBe(10);
    expect(convertWeight(20, 'kg', 'lb')).toBe(44);
  });

  it('survives a round trip for common loads', () => {
    for (const lb of [5, 10, 12.5, 15, 45, 90, 135]) {
      expect(convertWeight(convertWeight(lb, 'lb', 'kg'), 'kg', 'lb')).toBe(lb);
    }
  });

  it('leaves values alone when the unit does not change', () => {
    expect(convertWeight(12.3, 'kg', 'kg')).toBe(12.3);
    expect(convertWeight(0, 'lb', 'kg')).toBe(0);
  });
});

describe('convertIncrement', () => {
  it('snaps to a typical gym step in the new unit', () => {
    expect(convertIncrement(2.5, 'lb', 'kg')).toBe(1.25);
    expect(convertIncrement(5, 'lb', 'kg')).toBe(2.5);
    expect(convertIncrement(1.25, 'kg', 'lb')).toBe(2.5);
    expect(convertIncrement(2.5, 'kg', 'lb')).toBe(5);
    expect(convertIncrement(2, 'kg', 'lb')).toBe(5);
  });

  it('leaves the step alone when the unit does not change', () => {
    expect(convertIncrement(3, 'kg', 'kg')).toBe(3);
  });
});
